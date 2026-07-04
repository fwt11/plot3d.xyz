# Multi-Subplot Canvas — Design

**Date:** 2026-07-04
**Status:** Approved (pending spec review)
**Author:** brainstorming session

## Problem

plot3d.xyz renders exactly one chart. Researchers routinely need multi-panel
figures — several stacked or gridded subplots sharing one canvas, each an
independent plot (e.g. a time series, a correlation trace, and an FFT amplitude
spectrum stacked vertically, as in a typical journal figure). Today this is
impossible; users must export separate images and composite them by hand.

## Goal

Let a single canvas display a grid of independent subplots, with full feature
parity: every existing capability (chart types, layers, axes, annotations, curve
fitting, statistics, templates, export, save/load, share, undo/redo) works on
each subplot.

## Decisions (from brainstorming)

1. **Layout model:** regular grid (rows × cols). Not free-form, not variable row
   heights (both deferred).
2. **Per-cell content:** each cell is a fully independent chart (own type,
   layers, datasets, axes, title, annotations).
3. **Scope:** full feature parity from v1.
4. **Store model:** the existing single chart becomes a **1×1 grid** — a special
   case of the figure. Single source of truth.
5. **Rendering:** **one Plotly instance per cell** in a CSS grid (not one native
   Plotly subplot figure). Guarantees mixed 2D/3D/polar/pie work without
   shared-axis fragility.
6. **Store refactor strategy:** **Approach A (selector shim).** Store holds a
   `figure`; existing actions retarget the active subplot; components migrate via
   a one-line selector swap. Chosen over a full explicit refactor (higher risk)
   and a parallel store (two sources of truth).

## Data model

New type in `src/types.ts`:

```ts
export interface FigureConfig {
  rows: number;              // grid rows (default 1)
  cols: number;              // grid cols (default 1)
  subplots: ChartConfig[];   // length === rows*cols, row-major order
  activeIndex: number;       // which subplot the panels edit
  gap: number;               // px gap between cells (default 8)
}
```

`ChartConfig` is **unchanged**. Each cell is a complete, independent chart config
exactly as today. Invariant: `subplots.length === rows * cols`; `activeIndex` in
`[0, subplots.length)`.

## Store: `chartStore` (Approach A)

- State becomes `{ figure: FigureConfig }`.
- Exported selector: `selectActiveChart = (s) => s.figure.subplots[s.figure.activeIndex]`.
  Components read the active chart via `useChartStore(selectActiveChart)` instead
  of `useChartStore(s => s.chartConfig)`. This is a mechanical one-line change per
  accessor site and keeps Zustand change-detection honest (no fake getter).
- Every existing action (`setXAxis`, `setYAxis`, `setChartType`, `addLayer`,
  `updateLayer`, all annotation actions, `applyConfigPatch`, …) is rewritten to
  mutate `figure.subplots[activeIndex]`. **Signatures are unchanged**, so callers
  don't change.
- New actions:
  - `setGrid(rows, cols)` — resize the grid. Growing appends fresh default
    `ChartConfig`s (blank line chart + default sample dataset layer, mirroring
    the current `defaultChartConfig`). Each appended subplot gets a fresh
    `id: uid()` (and fresh layer/annotation ids) — never reuse an existing
    subplot's id, so subplots stay uniquely addressable. Shrinking removes
    trailing subplots; if a
    removed subplot has layers or annotations, prompt via the existing confirm
    dialog first. `activeIndex` clamps into range. Maintains the
    `length === rows*cols` invariant.
  - `setActiveSubplot(index)` — set which subplot the panels edit.
  - `addSubplot` / `removeSubplot(index)` — used internally by `setGrid`; not
    exposed as primary UI in v1.
  - `setGap(px)`.
- All mutating actions continue to push a history snapshot (via existing
  `setWithHistory`).

## Rendering: `ChartView` split

- The current `ChartView` body becomes **`SubplotView`**, taking a prop
  `subplotIndex: number`. It reads its config via
  `useChartStore(s => s.figure.subplots[subplotIndex])` and operates entirely on
  that subplot — traces, layout, annotations, per-cell right-click export menu.
  The existing `ResizeObserver` logic moves inside `SubplotView`; each instance
  observes its own grid cell.
- **`ChartView`** becomes a thin **grid container**: a CSS grid with
  `grid-template-rows: repeat(rows, 1fr)`, `grid-template-columns: repeat(cols,
  1fr)`, `gap: figure.gap`, mapping each subplot to `<SubplotView subplotIndex={i} />`.
- **Active-cell selection:** clicking anywhere in a cell calls
  `setActiveSubplot(i)`. The active cell shows a thin `--accent` outline so the
  user knows which subplot the left/right panels edit. In the 1×1 case no outline
  is drawn and behavior is identical to today.
- **Interaction store scoping:** `chartInteractionStore` (hover/zoom for the
  status bar) is global. `SubplotView` reports hover/zoom **only when it is the
  active subplot**, so non-active cells don't fight the status bar.

## Feature parity

The selector shim means most features work on the active subplot with no logic
change — only the mechanical `selectActiveChart` swap:

- **ConfigPanel, LayerPanel, ChartTab, TransformTab, AnnotationPanel,
  MultiPeakFitModal, FitResultsBar, TemplatePanel** — read the active chart and
  call existing actions; they now edit whichever subplot is active.
- **Curve fitting (`fitStore`)** — `fitStore` holds a **single global
  `fitResult`** (not keyed by chart/layer, and it stores no chart reference, so
  there is no stale-pointer bug). v1 behavior: the fit result is global and
  reflects the most recent fit, which always runs against the active subplot's
  data. Switching the active subplot does **not** re-scope or clear the displayed
  fit result — the user re-runs a fit on the newly active subplot to update it.
  Per-subplot fit-result storage is out of scope for v1 (see Out of scope).
- **Journal templates** — `applyConfigPatch` patches the active chart, so
  templates apply to the active subplot. Whole-grid template application is out of
  scope.
- **Annotations** — already stored per `ChartConfig`, so per-cell automatically.
  The annotation keyboard shortcuts in `Workspace.tsx` operate on the active
  subplot via the shim.

**New UI — Layout control:** added to the **Chart ribbon tab**. Rows × cols
steppers (1×1 up to 4×4) plus a gap slider. Cell selection for editing is done by
clicking the cell in the canvas. This is the only genuinely new panel UI.

## Persistence & export

### `.plot3d` project file (`projectFileV6.ts`) → v7

- v7 stores `figure: FigureConfig` in place of a single `chartConfig`.
- **Backward compat:** files at v6 and earlier have `chartConfig` and no
  `figure`. The loader wraps them:
  `figure = { rows:1, cols:1, subplots:[migratedChartConfig], activeIndex:0, gap:8 }`,
  reusing the existing per-`ChartConfig` sanitizer once. Every old project opens
  as a 1×1 figure — identical to today.
- Save serializes `figure` with every subplot sanitized.

### Share URL (`shareLink.ts`)

- Encodes `figure`. Because the URL hash limit is ~8 KB (concrete guard
  constant: `8192` bytes of encoded payload), multi-subplot figures may exceed
  it. Add a guard: if the encoded figure exceeds the limit, show a
  toast ("figure too large to share via URL; save as .plot3d instead") rather
  than emit a broken link. Single-chart figures stay under the limit as before.

### Combined image export (`exportLayout.ts`)

Each cell is a separate Plotly instance, so combined export composites cells:

- **PNG:** render each cell via existing `export2DChartPNGFromSVG` /
  `export3DToPng`, then composite onto one output canvas positioned per the grid
  (rows/cols/gap), honoring the active `exportConfig` DPI and background. The grid
  right-click "Export PNG" exports the whole figure; the per-cell menu still
  exports a single cell.
- **SVG:** composite each cell's SVG into one parent `<svg>` with translated
  `<g>` groups per grid position. 3D cells embed raster (same limitation as
  today).
- The 1×1 path is unchanged.

### Matplotlib export (`matplotlibExporter.ts`)

- Emit `fig, axs = plt.subplots(rows, cols)` and route each subplot's trace/axis
  code into `axs[r][c]`. Each subplot body reuses the existing per-chart
  generation. 1×1 emits the same single-axes script as today.

### Undo/redo (`historyStore`)

- `captureSnapshot` / `restoreSnapshot` snapshot `figure` instead of
  `chartConfig` (one-line change each). Grid resizes, active-subplot switches that
  mutate, and all per-subplot edits are undoable as whole-figure snapshots.

## Testing (Vitest)

- **Migration (critical regression guard):** load v6 and older fixtures → assert
  each becomes a 1×1 `figure` with the chart intact.
- **Round-trip:** serialize a 2×2 figure → deserialize → deep-equal; include a
  subplot with annotations, a fit layer, and a 3D cell.
- **Store actions:** `setGrid` grow (append defaults) / shrink (trailing removal,
  clamp `activeIndex`); `setActiveSubplot`; assert `setXAxis`/`addLayer` mutate
  only the active subplot.
- **Share guard:** oversized figure returns the "too large" signal, not a broken
  URL.
- **Matplotlib:** 1×1 output unchanged (snapshot); 2×1 emits `plt.subplots(2,1)`
  with both axes populated.
- **Selector:** `selectActiveChart` returns the correct subplot as `activeIndex`
  changes.

## File-by-file changes

| File | Change |
|---|---|
| `src/types.ts` | Add `FigureConfig`. |
| `src/store/chartStore.ts` | State `{figure}`; actions retargeted to active subplot; add `setGrid`/`setActiveSubplot`/`addSubplot`/`removeSubplot`/`setGap`; export `selectActiveChart`. |
| `src/store/plotStore.ts` | Re-export `selectActiveChart` / figure selectors. |
| `src/store/historyStore.ts` | Snapshot `figure` instead of `chartConfig`. |
| `src/components/ChartView.tsx` | Split into grid `ChartView` + `SubplotView(subplotIndex)`. |
| `src/components/ConfigPanel.tsx`, `LayerPanel.tsx`, `AnnotationPanel.tsx`, `FitResultsBar.tsx`, `MultiPeakFitModal.tsx`, `TemplatePanel.tsx` | Mechanical swap to `selectActiveChart`. |
| `src/components/ribbon/ChartTab.tsx` | Add Layout control (rows×cols steppers + gap slider). |
| `src/components/ribbon/FileTab.tsx`, `Ribbon.tsx`, `ribbon/TransformTab.tsx` | Selector swap; save/export wired to `figure`. |
| `src/pages/Workspace.tsx` | Save handler serializes `figure`; annotation shortcuts + status bar use active subplot. |
| `src/utils/projectFileV6.ts` (+`projectFile.ts`) | v7 format; wrap-old-file migration; per-subplot sanitize. |
| `src/utils/shareLink.ts` | Encode `figure` + size guard. |
| `src/utils/exportLayout.ts` | Composite multi-cell PNG/SVG export. |
| `src/utils/matplotlibExporter.ts` | Emit `plt.subplots` grid. |
| `src/i18n/en.json`, `src/i18n/zh.json` | Layout control strings; share-too-large toast. |
| `tests/` | New tests listed above. |

## Out of scope (v1)

- Free-form / overlapping subplots.
- Per-subplot variable row heights / drag-to-resize cells.
- Applying a template or chart type to the whole grid at once.
- Cross-subplot shared axes / linked zoom.
- Per-subplot curve-fit result storage (`fitStore` stays a single global result
  in v1; re-run a fit after switching the active subplot).
- Whole-grid annotation operations (annotation shortcuts act on the active
  subplot only).
