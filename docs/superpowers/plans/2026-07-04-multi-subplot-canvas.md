# Multi-Subplot Canvas Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one canvas display a grid of independent charts (subplots), with every existing feature working on the active subplot.

**Architecture:** The single `chartConfig` in `chartStore` becomes a `figure` = `{ rows, cols, subplots: ChartConfig[], activeIndex, gap }`. The existing single chart is a 1×1 figure. Existing store actions retarget `figure.subplots[activeIndex]` with unchanged signatures; components migrate via a one-line `selectActiveChart` selector swap (Approach A). Each grid cell is its own Plotly instance (`SubplotView`) in a CSS grid.

**Tech Stack:** React 18 + TypeScript (strict), Zustand v5, Plotly.js (lazy), Vitest, Tailwind, i18next.

**Reference spec:** `docs/superpowers/specs/2026-07-04-multi-subplot-canvas-design.md`

**Ground-truth notes (verified against code):**
- `chartStore.ts` holds a single `chartConfig`; all actions mutate it via `setWithHistory`.
- `plotStore.ts` is a barrel of re-exports (no selectors yet).
- `historyStore.ts` snapshots `chartConfig` in `captureSnapshot`/`restoreSnapshot`.
- **Live** save/load is `projectFile.ts` at `PROJECT_VERSION = 5` (NOT `projectFileV6.ts`, which is test-only).
- `fitStore.ts` holds a single global `fitResult` (no chart reference cached).
- ~14 accessor sites read `useChartStore(s => s.chartConfig)` across ConfigPanel, LayerPanel, AnnotationPanel, FitResultsBar, MultiPeakFitModal, TemplatePanel, ChartTab, FileTab, TransformTab, Ribbon, ChartView, Workspace.
- Test runner: `npx vitest run <path>`; type-check: `npm run check`.

---

## Chunk 1: Data model, store, selector shim, history

This chunk introduces `FigureConfig`, converts the store to hold a `figure`, adds the `selectActiveChart` selector, migrates the history snapshot, and swaps all accessor sites. After this chunk the app behaves identically to today (as a 1×1 figure) — a pure refactor with no user-visible change. This is the riskiest chunk; it must land green before any grid UI.

### Task 1.1: Add `FigureConfig` type

**Files:**
- Modify: `src/types.ts` (append after `ChartConfig`, near line 228)

- [ ] **Step 1: Add the type**

In `src/types.ts`, after the `ChartConfig` interface, add:

```ts
export interface FigureConfig {
  /** Grid rows (>= 1). */
  rows: number;
  /** Grid columns (>= 1). */
  cols: number;
  /** Subplots in row-major order. Invariant: length === rows * cols. */
  subplots: ChartConfig[];
  /** Index of the subplot the config panels edit. In [0, subplots.length). */
  activeIndex: number;
  /** Gap between grid cells in px. */
  gap: number;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: PASS (no usages yet).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add FigureConfig for multi-subplot"
```

### Task 1.2: Extract `createDefaultChartConfig` factory

The store currently has a module-level `defaultChartConfig` singleton. Grid growth needs a fresh config (fresh ids) per new cell. Extract a factory.

**Files:**
- Modify: `src/store/chartStore.ts:21-53`
- Test: `src/store/chartStore.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/store/chartStore.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createDefaultChartConfig } from './chartStore';

describe('createDefaultChartConfig', () => {
  it('returns a config with a fresh unique id and one layer', () => {
    const a = createDefaultChartConfig();
    const b = createDefaultChartConfig();
    expect(a.id).not.toEqual(b.id);
    expect(a.type).toBe('line');
    expect(a.layers.length).toBeGreaterThanOrEqual(1);
    expect(a.layers[0].id).not.toEqual(b.layers[0].id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/chartStore.test.ts`
Expected: FAIL — `createDefaultChartConfig` is not exported.

- [ ] **Step 3: Implement the factory**

In `src/store/chartStore.ts`, replace the `const defaultChartConfig: ChartConfig = { ... }` singleton with an exported factory. Keep `sharedDefaultDataset` as-is. The factory must call `uid()` for the config id and each layer id:

```ts
export function createDefaultChartConfig(): ChartConfig {
  return {
    id: uid(),
    type: 'line',
    title: '',
    xAxis: { ...defaultAxis, label: i18n.t('store.xAxis') },
    yAxis: { ...defaultAxis, label: i18n.t('store.yAxis') },
    legend: { visible: true, position: 'inside-top-right', bordered: false },
    colorMap: 'viridis',
    annotations: [],
    marginTop: 60,
    marginRight: 48,
    marginBottom: 70,
    marginLeft: 72,
    exportConfig: { resolutionMultiplier: 2, background: 'white', figureMultiplier: 1 },
    fontSize: 16,
    scene3D: { aspectMode: 'cube', aspectRatio: { x: 1, y: 1, z: 1 }, projection: 'orthographic' },
    layers: [
      {
        id: uid(),
        datasetId: sharedDefaultDataset.id,
        xColumn: sharedDefaultDataset.columns[0].id,
        yColumn: sharedDefaultDataset.columns[1].id,
        color: '#1f77b4',
        visible: true,
        lineStyle: 'solid',
        lineWidth: 3,
        pointStyle: 'none',
        pointSize: 5,
        fill: false,
        fillOpacity: 0.35,
      },
    ],
  };
}
```

Note: the very first subplot must reuse `sharedDefaultDataset` (the datasetStore shares that instance), so the factory references `sharedDefaultDataset` for the initial layer — correct for all cells since new cells default to the same shared dataset until the user changes them.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/chartStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/chartStore.ts src/store/chartStore.test.ts
git commit -m "refactor(store): extract createDefaultChartConfig factory"
```

### Task 1.3: Convert store to hold `figure` + add `selectActiveChart`

This is the core shim. State changes from `{ chartConfig }` to `{ figure }`. Every existing action retargets `figure.subplots[activeIndex]`. Signatures are unchanged.

**Files:**
- Modify: `src/store/chartStore.ts` (whole store body)
- Test: `src/store/chartStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/store/chartStore.test.ts`:

```ts
import { useChartStore, selectActiveChart } from './chartStore';

describe('chartStore figure model', () => {
  it('initializes as a 1x1 figure with one subplot', () => {
    const s = useChartStore.getState();
    expect(s.figure.rows).toBe(1);
    expect(s.figure.cols).toBe(1);
    expect(s.figure.subplots.length).toBe(1);
    expect(s.figure.activeIndex).toBe(0);
  });

  it('selectActiveChart returns the active subplot', () => {
    const s = useChartStore.getState();
    expect(selectActiveChart(s)).toBe(s.figure.subplots[s.figure.activeIndex]);
  });

  it('setChartTitle mutates only the active subplot', () => {
    useChartStore.getState().setChartTitle('Hello');
    const s = useChartStore.getState();
    expect(s.figure.subplots[s.figure.activeIndex].title).toBe('Hello');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/store/chartStore.test.ts`
Expected: FAIL — `figure` / `selectActiveChart` don't exist.

- [ ] **Step 3: Implement the figure store**

In `src/store/chartStore.ts`:

1. Add the selector (exported) near the top after imports:

```ts
import type { FigureConfig } from '@/types';

/** Select the currently active subplot's ChartConfig. */
export const selectActiveChart = (s: ChartStore): ChartConfig =>
  s.figure.subplots[s.figure.activeIndex];
```

2. Change the store interface: replace `chartConfig: ChartConfig;` with `figure: FigureConfig;` and add new actions:

```ts
  figure: FigureConfig;
  // ...existing actions unchanged in signature...
  setGrid: (rows: number, cols: number) => void;
  setActiveSubplot: (index: number) => void;
  setGap: (gap: number) => void;
```

3. Replace the `setWithHistory` helper's body: keep pushing history, but add a helper `patchActive` that maps over subplots:

```ts
const patchActive = (
  s: ChartStore,
  fn: (c: ChartConfig) => ChartConfig
): Partial<ChartStore> => ({
  figure: {
    ...s.figure,
    subplots: s.figure.subplots.map((c, i) =>
      i === s.figure.activeIndex ? fn(c) : c
    ),
  },
});
```

4. Initialize state: `figure: { rows: 1, cols: 1, subplots: [createDefaultChartConfig()], activeIndex: 0, gap: 8 }`.

5. Rewrite EVERY existing action to use `patchActive`. Example conversions (apply the same pattern to all):

```ts
setChartTitle: (title) =>
  setWithHistory((s) => patchActive(s, (c) => ({ ...c, title })),
    i18n.t('history.setChartTitle', { defaultValue: 'Edit title' })),

setXAxis: (axis) =>
  setWithHistory((s) => patchActive(s, (c) => ({ ...c, xAxis: { ...c.xAxis, ...axis } })),
    i18n.t('history.setXAxis', { defaultValue: 'Edit X axis' })),

addLayer: (layer) =>
  setWithHistory((s) => patchActive(s, (c) => ({ ...c, layers: [...c.layers, layer] })),
    i18n.t('history.addLayer', { defaultValue: 'Add layer' })),
```

Convert ALL of: `setChartType`, `setChartTitle`, `setXAxis`, `setYAxis`, `setYAxisRight`, `setZAxis`, `setLegend`, `setColorMap`, `addLayer`, `removeLayer`, `updateLayer`, `moveLayer`, `reorderLayers`, `setMargins`, `setExportConfig`, `setFontSize`, `setScene3D`, `applyConfigPatch`, and all annotation actions (`addAnnotation`, `removeAnnotation`, `updateAnnotation`, `updateAnnotationSilent`, `duplicateAnnotation`, `bringAnnotationToFront`, `sendAnnotationToBack`, `reorderAnnotations`). `updateAnnotationSilent` uses `set` (no history) — wrap with `patchActive` inside `set` instead of `setWithHistory`.

**`setChartType` needs special handling** — its existing body looks up datasets for Z-column injection. Put that lookup INSIDE the `patchActive` callback (it can call `useDatasetStore.getState()` freely):

```ts
setChartType: (type) =>
  setWithHistory((s) => patchActive(s, (c) => {
    const is3D = is3DChart(type);
    const needsZ = is3D || type === 'heatmap';
    let layers = c.layers;
    let zAxis = c.zAxis;
    if (needsZ && !zAxis) {
      zAxis = { ...defaultAxis, label: i18n.t('store.zAxis') };
    }
    if (needsZ) {
      const datasets = useDatasetStore.getState().datasets;
      layers = layers.map((layer) => {
        if (layer.zColumn) return layer;
        const ds = datasets.find((d) => d.id === layer.datasetId);
        if (!ds) return layer;
        const zCol = ds.columns.find((col) => col.type === 'Z');
        return zCol ? { ...layer, zColumn: zCol.id } : layer;
      });
    }
    return { ...c, type, layers, zAxis };
  }), i18n.t('history.setChartType', { defaultValue: 'Change chart type' })),
```

6. Add the new actions:

```ts
setGrid: (rows, cols) =>
  setWithHistory((s) => {
    const count = Math.max(1, rows) * Math.max(1, cols);
    let subplots = s.figure.subplots.slice(0, count);
    while (subplots.length < count) subplots.push(createDefaultChartConfig());
    const activeIndex = Math.min(s.figure.activeIndex, count - 1);
    return { figure: { ...s.figure, rows, cols, subplots, activeIndex } };
  }, i18n.t('history.setGrid', { defaultValue: 'Change grid layout' })),

setActiveSubplot: (index) =>
  set((s) => ({
    figure: {
      ...s.figure,
      activeIndex: Math.max(0, Math.min(index, s.figure.subplots.length - 1)),
    },
  })),

setGap: (gap) =>
  setWithHistory((s) => ({ figure: { ...s.figure, gap: Math.max(0, gap) } }),
    i18n.t('history.setGap', { defaultValue: 'Adjust grid gap' })),
```

Note: `setActiveSubplot` uses plain `set` (selecting a cell is not an undoable edit).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/store/chartStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/chartStore.ts src/store/chartStore.test.ts
git commit -m "feat(store): hold a figure; actions target active subplot"
```

### Task 1.4: Export `selectActiveChart` from the store barrel

**Files:**
- Modify: `src/store/plotStore.ts`

- [ ] **Step 1: Add re-export**

In `src/store/plotStore.ts`, change the chartStore line to:

```ts
export { useChartStore, selectActiveChart } from './chartStore';
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: still failing in components (they read `s.chartConfig`) — that's next. But `plotStore.ts` itself resolves. Proceed.

- [ ] **Step 3: Commit**

```bash
git add src/store/plotStore.ts
git commit -m "feat(store): re-export selectActiveChart from barrel"
```

### Task 1.5: Migrate history snapshot to `figure`

**Files:**
- Modify: `src/store/historyStore.ts:8-12` (StateSnapshot), `:71-89` (capture/restore)

- [ ] **Step 1: Write the failing test**

Create `src/store/historyStore.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { useChartStore } from './chartStore';
import { useHistoryStore } from './historyStore';

describe('history snapshots figure', () => {
  it('undo restores the previous figure', () => {
    useHistoryStore.getState().clearHistory();
    const before = useChartStore.getState().figure.subplots[0].title;
    useChartStore.getState().setChartTitle('Changed');
    expect(useChartStore.getState().figure.subplots[0].title).toBe('Changed');
    useHistoryStore.getState().undo();
    expect(useChartStore.getState().figure.subplots[0].title).toBe(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/historyStore.test.ts`
Expected: FAIL (snapshot still keyed on `chartConfig`; restore is a no-op for figure).

- [ ] **Step 3: Update the snapshot**

In `src/store/historyStore.ts`:
- Change `StateSnapshot.chartConfig: ChartConfig` → `figure: FigureConfig` (import `FigureConfig` from `@/types`).
- In `captureSnapshot`: `figure: chart.figure` (was `chartConfig: chart.chartConfig`).
- In `restoreSnapshot`: `useChartStore.setState({ figure: snapshot.figure })`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/historyStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/historyStore.ts src/store/historyStore.test.ts
git commit -m "feat(history): snapshot the whole figure"
```

### Task 1.6: Swap all component accessor sites to `selectActiveChart`

Mechanical, per-file. Each site that reads `useChartStore((s) => s.chartConfig)` becomes `useChartStore(selectActiveChart)`. Import `selectActiveChart` from `@/store/plotStore` (or `@/store/chartStore`). Actions (`setXAxis`, etc.) are read the same way as before — their signatures are unchanged.

**Files (modify each):**
- `src/components/ConfigPanel.tsx:174`
- `src/components/LayerPanel.tsx`
- `src/components/AnnotationPanel.tsx`
- `src/components/FitResultsBar.tsx`
- `src/components/MultiPeakFitModal.tsx`
- `src/components/TemplatePanel.tsx`
- `src/components/ribbon/ChartTab.tsx:12`
- `src/components/ribbon/FileTab.tsx:84`
- `src/components/ribbon/TransformTab.tsx`
- `src/components/Ribbon.tsx:44`
- `src/pages/Workspace.tsx` (`s.chartConfig.annotations` → `selectActiveChart(s).annotations`; StatusBar `s.chartConfig.type`/`.layers` → via `selectActiveChart`)

Also fix direct `getState().chartConfig` reads:
- `src/pages/Workspace.tsx:210` save handler → `serializeProject({ ..., figure: chartState.figure })` (the serialize signature changes in Chunk 4; for now, temporarily read the active chart: see note).
- `src/components/ribbon/FileTab.tsx:513-521, 543-551` save/load → same note.

> **Sequencing note:** `serializeProject` / `loadProjectFile` still expect `chartConfig` until Chunk 4. To keep the build green after this task, in the two save handlers pass the active chart: `chartConfig: selectActiveChart(chartState)` and on load `useChartStore.setState({ figure: { rows:1, cols:1, subplots:[project.chartConfig], activeIndex:0, gap:8 } })`. Chunk 4 replaces these with real figure serialization. This keeps each chunk shippable.

- [ ] **Step 1: Do the swaps**

For every file above, replace the selector and add the import. Example for `ConfigPanel.tsx`:

```ts
import { selectActiveChart } from '@/store/plotStore';
// ...
const chartConfig = useChartStore(selectActiveChart);
```

For `ChartView.tsx` — apply the same one-line swap now (`const chartConfig = useChartStore(selectActiveChart);` at line 35). Rationale: this keeps the build green and the app runnable at the end of Chunk 1 (so the Step 4 smoke check is valid). Chunk 2 Task 2.1 rewrites ChartView entirely, so this single line is superseded, not "reverted" — the whole component body is replaced.

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: PASS. Every swapped file (including ChartView's one line) type-checks clean; the app still renders one chart (1×1 figure).

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: PASS (existing tests still green; behavior unchanged as 1×1).

- [ ] **Step 4: Manual smoke check**

Run: `npm run dev`, open the app. Verify the single chart renders, title/axis/layer edits work, undo/redo works. (1×1 figure = today's behavior.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: read active subplot via selectActiveChart everywhere"
```

---
## Chunk 2: Grid rendering (SubplotView + ChartView)

Split `ChartView.tsx` into a per-cell `SubplotView(subplotIndex)` and a thin grid `ChartView`. After this chunk, setting the grid via the store (even before UI exists — drive it from a test / devtools) renders N Plotly instances in a CSS grid, with click-to-select-active and an accent outline on the active cell.

### Task 2.1: Create `SubplotView` from the current ChartView body

**Files:**
- Create: `src/components/SubplotView.tsx`
- Modify: `src/components/ChartView.tsx` (becomes the grid container in Task 2.2)

- [ ] **Step 1: Copy ChartView body into SubplotView**

Create `src/components/SubplotView.tsx`. Move the entire current `ChartView` component implementation into `export default function SubplotView({ subplotIndex }: { subplotIndex: number })`. Change how it reads config and actions:

```ts
import { selectActiveChart } from '@/store/plotStore';

// Read THIS cell's config (not the global active one):
const chartConfig = useChartStore((s) => s.figure.subplots[subplotIndex]);
const activeIndex = useChartStore((s) => s.figure.activeIndex);
const setActiveSubplot = useChartStore((s) => s.setActiveSubplot);
const isActive = activeIndex === subplotIndex;
```

Important: annotation and other mutating actions in the store always target the ACTIVE subplot. So `SubplotView` must select itself active before editing. Wrap the annotation callbacks so a click/edit first calls `setActiveSubplot(subplotIndex)`:

```ts
const handleAddAnnotation = useCallback((ann: Annotation) => {
  setActiveSubplot(subplotIndex);
  addAnnotation(ann);
}, [setActiveSubplot, subplotIndex, addAnnotation]);
```

Apply the same "select-active-first" wrapping to **every** mutating callback so edits in a non-active cell still hit the right subplot. That means ALL of the callbacks handed to `<AnnotationCanvas>` and the context menu:
`handleAddAnnotation`, `handleUpdateAnnotationSilent`, `handleFinishAnnotation`, and the props `onRemove` (removeAnnotation), `onDuplicate` (duplicateAnnotation), `onBringToFront` (bringAnnotationToFront), `onSendToBack` (sendAnnotationToBack), plus every annotation action inside the right-click context menu (`duplicateAnnotation`, `updateAnnotation` for lock, `bringAnnotationToFront`, `sendAnnotationToBack`, `removeAnnotation`).

Practical implementation: define one local helper and route all mutators through it, rather than wrapping each inline:

```ts
const withActive = useCallback(<A extends unknown[]>(fn: (...a: A) => void) =>
  (...a: A) => { setActiveSubplot(subplotIndex); fn(...a); },
  [setActiveSubplot, subplotIndex]);

// then, e.g.:
const handleAddAnnotation = useMemo(() => withActive(addAnnotation), [withActive, addAnnotation]);
const onRemove = useMemo(() => withActive(removeAnnotation), [withActive, removeAnnotation]);
// ...same for duplicate / bringToFront / sendToBack / updateAnnotation / finish / silent
```

Pass these wrapped versions to `<AnnotationCanvas>` and use them in the context menu. This guarantees no annotation mutation can target the wrong subplot.

- [ ] **Step 2: Scope interaction store to the active cell**

In `SubplotView`, only report hover/zoom when active:

```ts
const handleHover = useCallback((event) => {
  if (!isActive) return;
  // ...existing body...
}, [isActive, setHover]);
```

Same guard for `handleRelayout`.

- [ ] **Step 3: Add click-to-select + active outline**

On the root container `div` of `SubplotView`, add cell selection. Use `onPointerDownCapture` (capture phase) so the selection fires even if Plotly's canvas handlers stop propagation of the bubbling event:

```tsx
onPointerDownCapture={() => setActiveSubplot(subplotIndex)}
style={{
  background: cssVars.bgSurface,
  outline: isActive && total > 1 ? `2px solid var(--accent)` : 'none',
  outlineOffset: '-2px',
}}
```

Where `total` = `useChartStore((s) => s.figure.subplots.length)`. (No outline when there's only one cell — preserves today's look.)

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SubplotView.tsx
git commit -m "feat(chart): add per-cell SubplotView"
```

### Task 2.2: Make `ChartView` a grid container

**Files:**
- Modify: `src/components/ChartView.tsx` (replace entire body)

- [ ] **Step 1: Replace ChartView with a grid**

```tsx
import { useChartStore } from '@/store/plotStore';
import SubplotView from '@/components/SubplotView';

export default function ChartView() {
  const rows = useChartStore((s) => s.figure.rows);
  const cols = useChartStore((s) => s.figure.cols);
  const gap = useChartStore((s) => s.figure.gap);
  const count = useChartStore((s) => s.figure.subplots.length);

  if (count === 1) {
    // Fast path: identical to today, no grid wrapper overhead.
    return <SubplotView subplotIndex={0} />;
  }

  return (
    <div
      className="w-full h-full"
      style={{
        display: 'grid',
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: `${gap}px`,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="relative min-w-0 min-h-0">
          <SubplotView subplotIndex={i} />
        </div>
      ))}
    </div>
  );
}
```

Note: each cell wrapper needs `min-w-0 min-h-0` so the Plotly ResizeObserver in `SubplotView` measures the grid track, not content size.

- [ ] **Step 2: Type-check + test suite**

Run: `npm run check && npx vitest run`
Expected: PASS.

- [ ] **Step 3: Defer the multi-cell manual check to Chunk 3**

There is no grid UI yet (it arrives in Chunk 3 Task 3.1). Do NOT add a temporary `window` global to drive `setGrid` from the console — that risks committing debug code. Instead, verify here only that the **1×1 fast path** still renders exactly as before (`npm run dev` → single chart works). The real multi-cell manual verification happens in Chunk 3 Task 3.1 Step 4, once the layout control exists.

- [ ] **Step 4: Commit**

```bash
git add src/components/ChartView.tsx
git commit -m "feat(chart): render subplot grid in ChartView"
```

---

## Chunk 3: Layout control UI (Chart ribbon tab)

Add rows×cols steppers and a gap slider to the Chart tab so users can create and size the grid. Add i18n strings.

### Task 3.1: Add Layout control to ChartTab

**Files:**
- Modify: `src/components/ribbon/ChartTab.tsx`
- Modify: `src/i18n/en.json`, `src/i18n/zh.json`

- [ ] **Step 1: Add i18n strings**

In `src/i18n/en.json` under the `chart` object, add:
```json
"layout": "Layout",
"rows": "Rows",
"cols": "Columns",
"gap": "Gap"
```
In `src/i18n/zh.json` under `chart`:
```json
"layout": "布局",
"rows": "行",
"cols": "列",
"gap": "间距"
```

- [ ] **Step 2: Add a Layout RibbonGroup**

In `ChartTab.tsx`, read the figure grid + actions:

```ts
const rows = useChartStore((s) => s.figure.rows);
const cols = useChartStore((s) => s.figure.cols);
const gap = useChartStore((s) => s.figure.gap);
const setGrid = useChartStore((s) => s.setGrid);
const setGap = useChartStore((s) => s.setGap);
```

Add a new `<RibbonGroup label={t('chart.layout')}>` (place after the chart-type groups) containing:
- A "Rows" number input (min 1, max 4) → `onChange` calls `setGrid(newRows, cols)`.
- A "Columns" number input (min 1, max 4) → `setGrid(rows, newCols)`.
- A "Gap" range input (0–40) → `setGap(value)`.

```tsx
<RibbonGroup label={t('chart.layout')}>
  <div className="flex flex-col gap-1 px-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
    <label className="flex items-center gap-1">
      {t('chart.rows')}
      <input type="number" min={1} max={4} value={rows}
        onChange={(e) => setGrid(Math.max(1, Math.min(4, +e.target.value || 1)), cols)}
        className="w-12 px-1 rounded" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }} />
    </label>
    <label className="flex items-center gap-1">
      {t('chart.cols')}
      <input type="number" min={1} max={4} value={cols}
        onChange={(e) => setGrid(rows, Math.max(1, Math.min(4, +e.target.value || 1)))}
        className="w-12 px-1 rounded" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }} />
    </label>
    <label className="flex items-center gap-1">
      {t('chart.gap')}
      <input type="range" min={0} max={40} value={gap}
        onChange={(e) => setGap(+e.target.value)} />
    </label>
  </div>
</RibbonGroup>
```

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Manual check (the real end-to-end)**

`npm run dev`. Chart tab → set Rows=3, Cols=1. Confirm 3 stacked subplots appear (matching the reference figure). Click each; edit its chart type/axes/layers independently. Adjust Gap. Undo/redo the grid change. Shrink back to 1×1 → confirm a confirm-dialog is NOT required here (trailing removal of untouched defaults is fine) OR appears if the removed cells were edited — see Task 3.2.

- [ ] **Step 5: Commit**

```bash
git add src/components/ribbon/ChartTab.tsx src/i18n/en.json src/i18n/zh.json
git commit -m "feat(ribbon): add grid layout control to Chart tab"
```

### Task 3.2: Confirm before destroying edited subplots on shrink

**Files:**
- Modify: `src/components/ribbon/ChartTab.tsx` (wrap the rows/cols handlers)

- [ ] **Step 1: Guard shrink with confirm dialog**

The store's `setGrid` drops trailing subplots. When shrinking, if any dropped subplot has annotations or >1 layer (i.e. user-modified), ask first using the existing confirm store. Its real API (verified in `src/store/confirmStore.ts`) is `confirm({ title, message, confirmLabel?, cancelLabel?, danger?, onConfirm })` — **`title` and `message` are both required**. There's also a convenience `confirm(options)` export.

```ts
import { useConfirmStore } from '@/store/confirmStore';
```

Wrap the handlers. "Edited" means `annotations.length > 0 || layers.length > 1` — a title/color/axis tweak alone does NOT trip the confirm (a fresh cell always has exactly 1 default layer and 0 annotations):

```ts
const requestGrid = (r: number, c: number) => {
  const fig = useChartStore.getState().figure;
  const nextCount = r * c;
  const dropped = fig.subplots.slice(nextCount);
  const hasContent = dropped.some((s) => s.annotations.length > 0 || s.layers.length > 1);
  if (hasContent) {
    useConfirmStore.getState().confirm({
      title: t('chart.layout'),
      message: t('chart.confirmShrinkGrid'),
      danger: true,
      onConfirm: () => setGrid(r, c),
    });
  } else {
    setGrid(r, c);
  }
};
```

Point the inputs' `onChange` at `requestGrid`. Add the i18n key `chart.confirmShrinkGrid` to BOTH locale files:
- `en.json` → `"confirmShrinkGrid": "Removing subplots will discard their content. Continue?"`
- `zh.json` → `"confirmShrinkGrid": "缩小网格将丢弃被移除子图的内容，是否继续？"`

- [ ] **Step 2: Type-check + manual**

Run: `npm run check`. Then in the app: make a 2×1, edit the 2nd cell (add a layer), shrink to 1×1 → confirm dialog appears; cancel keeps both; confirm drops the 2nd.

- [ ] **Step 3: Commit**

```bash
git add src/components/ribbon/ChartTab.tsx src/i18n/en.json src/i18n/zh.json
git commit -m "feat(ribbon): confirm before discarding edited subplots"
```

---
## Chunk 4: Persistence & export (project file, share, PNG/SVG, matplotlib)

Wire figure serialization into the live save/load path (`projectFile.ts`, v5→v6) with backward-compatible migration of old files, update share encoding with a size guard, add combined multi-cell image export, and emit `plt.subplots` for matplotlib. Each task is independently shippable; single-cell (1×1) output stays byte-identical to today wherever possible.

### Task 4.1: Project file v6 — figure format + migration

**Files:**
- Modify: `src/utils/projectFile.ts` (ProjectFile interface, serialize, sanitize, load, `PROJECT_VERSION`)
- Test: `src/utils/projectFile.test.ts` (create or extend)

- [ ] **Step 1: Write failing tests**

Create `src/utils/projectFile.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sanitizeProjectFile, serializeProject } from './projectFile';
import type { FigureConfig } from '@/types';

const oldV5File = {
  version: 5,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  datasets: [{ id: 'ds1', name: 'D', columns: [
    { id: 'x', name: 'x', type: 'X', values: [1, 2, 3] },
    { id: 'y', name: 'y', type: 'Y', values: [4, 5, 6] },
  ]}],
  chartConfig: { id: 'c1', type: 'line', title: 'Old', layers: [
    { id: 'l1', datasetId: 'ds1', xColumn: 'x', yColumn: 'y', color: '#000',
      visible: true, lineStyle: 'solid', lineWidth: 2, pointStyle: 'none', pointSize: 4, fill: false },
  ]},
  theme: 'dark', lang: 'en',
};

describe('projectFile figure migration', () => {
  it('wraps a v5 single-chart file as a 1x1 figure', () => {
    const p = sanitizeProjectFile(oldV5File);
    expect(p).not.toBeNull();
    const fig = p!.figure as FigureConfig;
    expect(fig.rows).toBe(1);
    expect(fig.cols).toBe(1);
    expect(fig.subplots.length).toBe(1);
    expect(fig.subplots[0].title).toBe('Old');
    expect(fig.activeIndex).toBe(0);
  });

  it('round-trips a 2x1 figure', () => {
    const p = sanitizeProjectFile(oldV5File)!;
    const fig2 = { ...p.figure, rows: 2, cols: 1,
      subplots: [p.figure.subplots[0], { ...p.figure.subplots[0], id: 'c2', title: 'Second' }],
    };
    const serialized = serializeProject({ datasets: p.datasets, figure: fig2, theme: 'dark', lang: 'en' });
    const restored = sanitizeProjectFile(serialized)!;
    expect(restored.figure.subplots.length).toBe(2);
    expect(restored.figure.subplots[1].title).toBe('Second');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/utils/projectFile.test.ts`
Expected: FAIL — `figure` not on ProjectFile; `serializeProject` signature mismatch.

- [ ] **Step 3: Implement v6 format**

In `src/utils/projectFile.ts`:
1. Bump `const PROJECT_VERSION = 6;`.
2. Change `ProjectFile` interface: replace `chartConfig: ChartConfig;` with `figure: FigureConfig;` (import `FigureConfig`).
3. Change `serializeProject` param + body to take `figure: FigureConfig` and deep-clone it (keep `datasets`, `theme`, `lang`).
4. In `sanitizeProjectFile`: accept both shapes. If `data.figure` exists, sanitize each `data.figure.subplots[i]` via the existing `sanitizeChartConfig`, drop dangling layers per subplot (reuse the existing layer-filter block in a loop over subplots), and clamp `activeIndex`. If `data.figure` is absent but `data.chartConfig` exists (v5 and earlier), sanitize that one config and wrap: `figure = { rows:1, cols:1, subplots:[cfg], activeIndex:0, gap:8 }`.
5. Update `isValidProjectFile`: valid if it has `version`, `datasets` array, AND (`figure` object OR `chartConfig` object).
6. In `loadProjectFile`, keep the existing version-bump ladder; the sanitizer now handles the figure wrap.

> **Cross-file collision — land 4.1 and 4.2 together.** `projectFileV6.ts` already defines `PROJECT_VERSION = 6` and its `isValidProjectFile` (a) caps `version <= 6` and (b) requires `d.chartConfig` to be an object (rejects a file that has `figure` instead). Once the live path writes `version: 6` with a `figure`, `projectFileV6.test.ts` will break. Therefore **do not commit Task 4.1 alone** — either combine 4.1+4.2 into one commit, or run `npx vitest run src/utils/projectFileV6.test.ts` after 4.1 expecting RED and fix it in 4.2 immediately after. The final suite must be green before moving on.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/utils/projectFile.test.ts`
Expected: PASS.

- [ ] **Step 5: Update save/load callers to pass `figure`**

In `src/components/ribbon/FileTab.tsx` (save ~line 515) and `src/pages/Workspace.tsx` (save ~line 209): change `serializeProject({ ..., chartConfig: chartState.chartConfig })` to `serializeProject({ ..., figure: chartState.figure })`. In FileTab load (~line 547): `useChartStore.setState({ figure: project.figure })` (replace the temporary 1×1 wrap from Task 1.6).

- [ ] **Step 6: Type-check + full suite + manual round-trip**

Run: `npm run check && npx vitest run`
Then `npm run dev`: create a 2×1, edit both cells, Ctrl+S to save `.plot3d`, reload the page, open the file → both subplots restored. Also open an OLD single-chart `.plot3d` (if available) → opens as 1×1.

- [ ] **Step 7: Commit**

```bash
git add src/utils/projectFile.ts src/utils/projectFile.test.ts src/components/ribbon/FileTab.tsx src/pages/Workspace.tsx
git commit -m "feat(project): v6 figure format with v5 migration"
```

### Task 4.2: Update `projectFileV6.ts` for consistency (must land with 4.1)

`projectFileV6.ts` is test-only (not wired into live save/load), but its validator will actively REJECT the new figure files (see the collision note in Task 4.1), breaking `projectFileV6.test.ts`. So this task is not optional polish — it must land in the same commit as 4.1 (or immediately after, with the suite green before any other work).

**Files:**
- Modify: `src/utils/projectFileV6.ts` (`isValidProjectFile` version range, field check)
- Modify: `src/utils/projectFileV6.test.ts`

- [ ] **Step 1: Update version + field checks**

In `projectFileV6.ts`: allow `d.version` up to 6; change the `chartConfig` presence check to accept `figure` OR `chartConfig`. Update `orderProjectForSerialization` to emit `figure` when present (fall back to `chartConfig`).

- [ ] **Step 2: Fix its test**

Update `src/utils/projectFileV6.test.ts` so its sample project uses `figure` (or asserts the v5→v6 wrap). Keep the stable-stringify tests intact.

- [ ] **Step 3: Run**

Run: `npx vitest run src/utils/projectFileV6.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/utils/projectFileV6.ts src/utils/projectFileV6.test.ts
git commit -m "chore(project): align projectFileV6 with figure format"
```

### Task 4.3: Share URL — encode figure + size guard

**Files:**
- Modify: `src/utils/shareLink.ts`
- Test: `src/utils/shareLink.test.ts` (extend)

- [ ] **Step 1: Write failing tests**

Add to `src/utils/shareLink.test.ts`:

```ts
import { encodeShareFigure, decodeShareFigure, SHARE_URL_LIMIT } from './shareLink';

it('round-trips a figure', () => {
  const fig = { rows: 1, cols: 1, activeIndex: 0, gap: 8, subplots: [{ id: 'c1', type: 'line' }] } as any;
  const url = encodeShareFigure(fig);
  expect(url).not.toBeNull();
  expect(decodeShareFigure(url as string)?.subplots[0].type).toBe('line');
});

it('returns null when the encoded figure exceeds the limit', () => {
  const big = { rows: 1, cols: 1, activeIndex: 0, gap: 8,
    subplots: [{ id: 'c', type: 'line', title: 'x'.repeat(SHARE_URL_LIMIT * 2) }] } as any;
  expect(encodeShareFigure(big)).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/utils/shareLink.test.ts`
Expected: FAIL — new functions absent.

- [ ] **Step 3: Implement figure share functions**

In `shareLink.ts`, add the figure functions. Keep the existing `encodeShareUrl`/`decodeShareUrl` (single-config) as-is for any current callers.

> **Intentional behavior change (document it):** today `encodeShareUrl` NEVER returns null — on an oversized payload it produces an overlong (and effectively broken) URL. The new `encodeShareFigure` returns `null` past the limit so the caller can warn instead of emitting a broken link. This is a deliberate improvement, not byte-identical to the old behavior. The size check compares the ENCODED payload (`base64.length`) against `SHARE_URL_LIMIT`, independent of origin length.

```ts
import type { FigureConfig } from '@/types';

/** Encode a figure to a share URL, or null if it exceeds SHARE_URL_LIMIT. */
export function encodeShareFigure(figure: FigureConfig): string | null {
  const json = JSON.stringify(figure);
  const base64 = base64UrlEncode(json);
  if (base64.length > SHARE_URL_LIMIT) return null;
  const base = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  return `${base}#d=${base64}`;
}

export function decodeShareFigure(url: string): FigureConfig | null {
  const fragment = parseShareHash(url);
  if (!fragment) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(fragment)) as FigureConfig;
    if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.subplots)) return null;
    return parsed;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Wire the caller + toast**

Find the share caller (`grep -rn "encodeShareUrl" src`). Update it to call `encodeShareFigure(useChartStore.getState().figure)`; if it returns null, `addToast(t('toast.shareTooLarge', ...), 'warning')`. On load, if a `#d=` hash is present, `decodeShareFigure` and `useChartStore.setState({ figure })`. Add `toast.shareTooLarge` to both locale files.

- [ ] **Step 5: Run tests + type-check**

Run: `npm run check && npx vitest run src/utils/shareLink.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/shareLink.ts src/utils/shareLink.test.ts src/i18n/en.json src/i18n/zh.json
git commit -m "feat(share): encode figure with size guard"
```

### Task 4.4: Combined image export (PNG + SVG)

**Files:**
- Modify: `src/utils/exportLayout.ts` (add `exportFigureToPng`, `exportFigureToSvg`)
- Modify: `src/components/SubplotView.tsx` (grid-level export entry) or `ChartView.tsx`

- [ ] **Step 1: Add composite PNG export**

In `exportLayout.ts`, add a function that composites each cell's rendered PNG onto one canvas laid out by the grid:

```ts
export async function exportFigureToPng(
  cellDivs: HTMLElement[],
  rows: number,
  cols: number,
  gap: number,
  opts: { scale: number; backgroundColor?: string; figureMultiplier: number },
): Promise<string> {
  // Render each cell to a dataURL (reuse export2DChartPNGFromSVG / export3DToPng by cell type),
  // load into Image, then draw into a grid on an output canvas sized to the bounding box.
  // Cells are placed at (col * (cellW + gap), row * (cellH + gap)) in row-major order.
  // Return the composite canvas.toDataURL('image/png').
}
```

Implementation detail: render cells concurrently with `Promise.all` — for each cell div, pick `export3DToPng` if it carries `data-chart-area-3d`, else `export2DChartPNGFromSVG` (both return dataURLs). Load each dataURL into an `Image` (await `img.onload`), measure each cell div's pixel size for aspect, use the largest cell width/height × scale as the uniform per-cell target, then draw each image at `(col * (cellW + gap), row * (cellH + gap))` in row-major order. Fill background first if `backgroundColor` is set.

- [ ] **Step 2: Add composite SVG export**

Add `exportFigureToSvg` that, for each cell, awaits `serialize2DChartSVG` (2D) or `export3DToPng` (3D, embedded as `<image href=...>`), then wraps each result in a `<g transform="translate(x,y)">` inside one parent `<svg>` sized to the grid. Because both are async, collect with `Promise.all` and assemble in order. 3D cells use raster embed (same limitation as today).

- [ ] **Step 3: Wire the grid export entry**

In `ChartView.tsx` (grid path), add a container-level right-click handler that, when the figure has >1 cell, offers "Export figure as PNG/SVG" which collects the cell divs (`container.querySelectorAll('[data-chart-area]')`) and calls the composite functions with the active subplot's `exportConfig`. Keep `SubplotView`'s existing per-cell right-click export for single-cell export. For 1×1, behavior is unchanged (SubplotView handles it directly).

- [ ] **Step 4: Manual verification (no unit test — canvas/DOM heavy)**

This path is canvas/DOM-heavy and cannot be unit-tested; verify manually. `npm run dev`, then check THREE grid compositions:
(a) **all-2D** 3×1 (the reference figure) → Export PNG shows all three stacked panels with correct background/DPI; Export SVG opens in a browser with all panels present and vector 2D.
(b) **all-3D** 2×1 → Export PNG shows both 3D panels (raster); SVG embeds both as `<image>`.
(c) **mixed 2D+3D** 2×1 → PNG composites both; SVG has vector 2D + raster 3D.
State explicitly in the commit/PR that this was verified by eye, since it has no automated coverage.

- [ ] **Step 5: Commit**

```bash
git add src/utils/exportLayout.ts src/components/ChartView.tsx
git commit -m "feat(export): composite multi-cell PNG/SVG export"
```

### Task 4.5: Matplotlib export — `plt.subplots` grid

> **Scope reality:** `generateMatplotlibScript` is ~314 lines. Its body emits `ax.`/`ax2` calls across 7+ chart-type branches, a `buildAnnotationCode` helper (~line 173–221, uses `ax.`/`fig.text`), a title/labels/limits/grid/legend tail, and a per-chart `figsize` computed from margins. Threading an axes-variable through all of this is a real refactor (~30–50 string sites), NOT a one-liner. We therefore do it in two safe sub-steps: (1) lock current 1×1 output with a snapshot test, (2) extract a body function that takes `axVar`, and delegate. **We do NOT claim byte-identical 1×1 output as a goal** — the snapshot test simply tells us exactly what changed so we can decide if a diff is acceptable (e.g. `ax` → `axs[0]`) or must be preserved (header/imports/data section).

**Files:**
- Modify: `src/utils/matplotlibExporter.ts`
- Test: `src/utils/matplotlibExporter.test.ts` (extend if present, else create)

- [ ] **Step 1: Lock the current single-chart output with a snapshot**

First check the existing test file (`ls src/utils/matplotlibExporter.test.ts`; read its fixtures). Add a snapshot test of the CURRENT `generateMatplotlibScript` for a representative line chart:

```ts
it('single-chart matplotlib output is stable', () => {
  expect(generateMatplotlibScript(cfg, datasets, { dpi: 300 })).toMatchSnapshot();
});
```

Run `npx vitest run src/utils/matplotlibExporter.test.ts` to record the snapshot. This is the guard: after refactor, this test shows the exact diff.

- [ ] **Step 2: Write failing tests for the figure function**

```ts
import { generateFigureMatplotlibScript } from './matplotlibExporter';

it('1x1 emits a single-axes script', () => {
  const fig = { rows:1, cols:1, activeIndex:0, gap:8, subplots:[cfg] } as any;
  const script = generateFigureMatplotlibScript(fig, datasets, {});
  expect(script).toContain('plt.subplots');
});

it('2x1 emits both axes populated', () => {
  const fig = { rows:2, cols:1, activeIndex:0, gap:8, subplots:[cfg, cfg2] } as any;
  const script = generateFigureMatplotlibScript(fig, datasets, {});
  expect(script).toContain('plt.subplots(2, 1');
  expect(script).toMatch(/axs\[0\]/);
  expect(script).toMatch(/axs\[1\]/);
});
```

(Reuse `cfg`/`datasets` from the existing fixtures; define a second `cfg2` with a different title.)

Run: `npx vitest run src/utils/matplotlibExporter.test.ts` → FAIL (`generateFigureMatplotlibScript` absent).

- [ ] **Step 3: Extract the per-axes body into a helper**

Refactor `generateMatplotlibScript` in place:
1. Extract everything from the **Traces** section through the axis labels/limits/grid/legend tail into a new internal function:
   ```ts
   function emitSubplotBody(
     lines: string[], chartConfig: ChartConfig, datasets: Dataset[],
     axVar: string, idxPrefix: string,
   ): void { /* moved body; replace 'ax' → axVar, and per-trace var suffixes use idxPrefix to avoid collisions across subplots */ }
   ```
   - Replace literal `ax` with `axVar`; replace `ax2` with `` `${axVar}2` ``.
   - Update `buildAnnotationCode` similarly to accept `axVar` (its `ax.`/`fig.text` calls).
   - Prefix all generated python variable names (`x_${i}`, `labels_${i}`, `pie_labels_${i}`, twin `ax2`) with a per-subplot `idxPrefix` (e.g. `s0_`, `s1_`) so multiple subplots don't reuse `x_0`.
2. `generateMatplotlibScript` keeps emitting header + data + `fig, ax = plt.subplots(...)`, then calls `emitSubplotBody(lines, chartConfig, datasets, 'ax', '')`. The empty prefix preserves existing variable names — check the snapshot from Step 1; the only acceptable diffs are none (goal: single-chart snapshot unchanged). If the snapshot changes, adjust `emitSubplotBody` until the single-chart path reproduces the original exactly.

- [ ] **Step 4: Implement `generateFigureMatplotlibScript`**

```ts
export function generateFigureMatplotlibScript(
  figure: FigureConfig, datasets: Dataset[], options: { dpi?: number; filename?: string } = {},
): string {
  if (figure.subplots.length === 1) {
    return generateMatplotlibScript(figure.subplots[0], datasets, options);
  }
  const lines: string[] = [];
  // header/imports once (include Axes3D import if ANY subplot is 3D)
  // fig, axs = plt.subplots(rows, cols, figsize=(...))
  // axs = np.atleast_1d(axs).ravel()
  figure.subplots.forEach((cfg, i) => {
    // emit this subplot's data + body with axVar=`axs[${i}]`, idxPrefix=`s${i}_`
    emitSubplotBody(lines, cfg, datasets, `axs[${i}]`, `s${i}_`);
  });
  // fig.tight_layout(); plt.savefig(...) / plt.show()
  return lines.join('\n');
}
```

Note: for a 1×1 figure it delegates to the single-chart function, so 1×1 output is exactly the existing path (snapshot guaranteed unchanged). 3D subplots inside a grid need `subplot_kw` per-axes; if mixing 2D and 3D, create axes individually via `fig.add_subplot(rows, cols, i+1, projection=...)` instead of `plt.subplots` — document this branch and cover an all-2D grid in tests (mixed-3D grid is best-effort, flagged below).

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/utils/matplotlibExporter.test.ts`
Expected: PASS, and the Step-1 single-chart snapshot is UNCHANGED (if it changed, fix `emitSubplotBody` before proceeding).

- [ ] **Step 6: Wire the caller**

`grep -rn "downloadMatplotlibScript" src` to find call sites (FileTab ~line 500; ChartView/SubplotView context menu). Update `downloadMatplotlibScript` to accept a `FigureConfig` and call `generateFigureMatplotlibScript`. The per-cell context menu (single subplot) keeps calling `generateMatplotlibScript` for that one cell.

- [ ] **Step 7: Commit**

```bash
git add src/utils/matplotlibExporter.ts src/utils/matplotlibExporter.test.ts src/components/ribbon/FileTab.tsx
git commit -m "feat(matplotlib): emit plt.subplots grid for figures"
```

---

## Final verification

- [ ] **Full suite green:** `npx vitest run` — all tests pass.
- [ ] **Type-check clean:** `npm run check`.
- [ ] **Lint clean:** `npm run lint`.
- [ ] **Build:** `npm run build`.
- [ ] **End-to-end manual (the reference figure):** `npm run dev` → build a 3×1 grid; give each cell its own data/type (line, then a second trace plot, then an FFT-style plot); export PNG; save `.plot3d`; reload; confirm restoration. Confirm 1×1 still behaves exactly as before (no outline, single export path).

## Out of scope (do not build)

- Free-form / overlapping subplots; variable row heights; drag-to-resize cells.
- Applying a template or chart type to the whole grid at once.
- Cross-subplot shared axes / linked zoom.
- Per-subplot fit-result storage (fitStore stays single-global in v1).
- Whole-grid annotation operations.
