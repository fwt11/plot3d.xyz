# plot3d.xyz

An interactive browser-based data visualization app for scientific research. Create publication-quality 2D and 3D charts from CSV/Excel data, with built-in curve fitting, annotations, and one-click export to common formats.

> Designed for researchers in materials science, statistics, and experimental science who need to produce paper figures or explore data interactively.

## Highlights

- **16 chart types** — 2D (line, scatter, bar, area, pie, polar, box, histogram, heatmap, violin) and 3D (surface, scatter3d, contour3d, bar3d, isosurface, volume).
- **Spreadsheet data editor** — import CSV/XLSX, edit cells in place, manage column types (X/Y/Z/label/error/…), add computed columns, apply math transforms.
- **Curve fitting** — linear, polynomial (1–6), exponential, logarithmic, power, Gaussian, logistic, plus multi-peak fitting; R², RMSE, MAE, confidence bands, parameter bounds, global fit.
- **Statistics** — descriptive statistics, hypothesis tests (t-test, chi-square, normality…), distribution functions.
- **Annotations** — text, LaTeX (KaTeX), arrows, rectangles, lines; percent or data-coordinate positioning; drag-to-move.
- **Export** — PNG, SVG, PDF, TIFF, with configurable DPI (1×/2×/4×) and background; right-click any chart to export or copy to clipboard.
- **14 journal templates** — Nature, Science, ACS, Elsevier, Angewandte, Cell, PRL (single & double column).
- **Reproducibility** — `.plot3d` project files (v6, line-based JSON with content-hash IDs); Matplotlib script export for offline plotting; shareable URL encoding.
- **Bilingual UI** — English and Simplified Chinese.

## Quick start

### Requirements

- Node.js ≥ 18
- npm ≥ 9

### Install & run

```bash
npm install
npm run dev      # start Vite dev server with HMR
npm run build    # production build (tsc + vite)
npm run preview  # preview the production build
```

### Available scripts

| Command           | What it does                                          |
| ----------------- | ----------------------------------------------------- |
| `npm run dev`     | Start the Vite dev server                             |
| `npm run build`   | Type-check then build the production bundle           |
| `npm run preview` | Serve the built `dist/` for verification              |
| `npm run lint`    | ESLint with TypeScript, React Hooks, and react-refresh rules |
| `npm run check`   | `tsc --noEmit` strict type-check                      |
| `npm run test`    | Run the Vitest suite (unit tests)                     |
| `npm run test:coverage` | Vitest with v8 coverage report                  |

## Features in detail

### Chart types

**2D** — line, scatter, bar, area, pie, polar, box plot, histogram, heatmap, violin.

**3D** — surface, scatter3d, contour3d, bar3d, isosurface, volume rendering.

All share one Plotly.js engine (lazy-loaded on first chart view) with a unified layout builder.

### Data handling

- **Import** — CSV (PapaParse), Excel `.xlsx`/`.xls` (SheetJS).
- **Edit** — in-place cell editing (silent on each keystroke, snapshot on blur so undo history stays clean), column add/delete, column-type switching.
- **Transforms** — math functions (log, sqrt, abs, exp, 1/x), trig, sort, normalize, fill/interpolate missing values, remove outliers, smoothing.
- **Computed columns** — formula expressions across existing columns.
- **Generated samples** — sine wave, sinc surface, sphere, random data, and others.

### Charts configuration

- **Axes** — label, unit, range, log scale, scientific notation, gridlines, tick rotation, date/time axis with IANA timezone.
- **Multi-layer** — independent dataset-per-layer mapping, color/line-style/point-style per layer, dual Y-axis.
- **Error bars** — symmetric (single error column), asymmetric (plus/minus), X-direction error bars, and statistical error (SD/SE/CI95) computed from repeated measurements.
- **Colormaps** — jet, viridis, hot, coolwarm, parula, plasma, cividis (color-blind-friendly), inferno, magma, turbo, batlow (color-blind-friendly).
- **Inset frames** — small inset plots at any of the four corners (Phase 4.5).
- **Legend** — show/hide, six positions including in-plot corners.

### Annotations

- Text, LaTeX (KaTeX) with safe sanitization, arrows, rectangles, lines.
- Positioned in percent (relative to plot area) or data coordinates — works on 3D too.
- Lockable, reorderable (bring-to-front / send-to-back), copy/paste/duplicate.

### Curve fitting

- **Built-in models** — linear, polynomial (1–6), exponential, logarithmic, power, Gaussian, logistic.
- **Multi-peak fitting** — sum of Gaussians/Lorentzians with peak detection.
- **Diagnostics** — R², RMSE, MAE, confidence bands, parameter uncertainty.
- **Weighted least squares** — column-driven or stat-driven weights.
- **Global fit** — fit one model across multiple layers simultaneously.
- **Web Worker** — heavy computations run off the main thread (`src/workers/fitWorker.ts`).

### Statistics

Descriptive stats, correlation, t-test, chi-square, Shapiro–Wilk normality, peak detection.

### Export

- **Vector**: SVG (2D), PDF via `jsPDF` (rasterized for 3D).
- **Raster**: PNG (1×/2×/4× DPI), TIFF.
- **Matplotlib script** — export a `.py` script that reproduces the current chart at the chosen DPI. Useful when reviewers require Matplotlib-specific output.
- **Background** — transparent, white, or follow the active theme.
- **Right-click any chart** for a context menu with quick export / copy-to-clipboard.

### Project files & sharing

- **`.plot3d` v6** — single-file JSON that captures datasets, chart config, theme, and language. Auto-migrates from older versions on load. Size cap: 50 MB.
- **Shareable URLs** — base64url-encoded chart config in the URL hash (`#d=...`), no server required. 8 KB limit.
- **Save**: `Ctrl/Cmd + S`. Open from the File tab in the Ribbon.

### Other

- Undo / redo (`Ctrl+Z` / `Ctrl+Y` or `Ctrl+Shift+Z`) — up to 50 history steps, with branching.
- Dark and light themes (toggle from the UI; persisted to `localStorage`).
- English and Simplified Chinese (toggle from the UI; persisted to `localStorage`).
- Custom right-click context menus on the data table, chart canvas, and layer panel.
- Keyboard shortcuts for layer add, chart-type switch, zoom in/out, reset, find in table, and annotation tool switching.

## Tech stack

- **Framework** — React 18, TypeScript (strict mode).
- **Build** — Vite 6 with manual chunking (`plotly`, `xlsx`, `export`, `vendor`).
- **Chart engine** — Plotly.js (`plotly.js-dist-min`, lazy-loaded) + `react-plotly.js` factory.
- **State** — Zustand v5, split by domain (datasets, chart, history, UI, chart interaction, toasts).
- **Styling** — Tailwind CSS 3 + CSS variables (theme driven by `[data-theme]` on `<html>`).
- **i18n** — i18next + react-i18next.
- **Data** — PapaParse (CSV), SheetJS (Excel).
- **Export** — jsPDF (PDF), html-to-image (raster), Plotly native downloadImage, custom TIFF encoder.
- **LaTeX** — KaTeX.
- **Tests** — Vitest + v8 coverage (384+ tests across fitting, statistics, project file, share, templates, Matplotlib exporter).

## Project layout

```
src/
├── components/          UI components
│   ├── ribbon/          Ribbon toolbar tabs (File, Chart, Transform, Fit, Stats, Generate, Annotation)
│   ├── ChartView.tsx    Unified 2D/3D chart renderer (lazy-loads Plotly)
│   ├── ConfigPanel.tsx  Right-side chart configuration panel
│   ├── ContextMenu.tsx  Custom right-click menu
│   ├── DataTable.tsx    Spreadsheet data editor
│   ├── LayerPanel.tsx   Layer management
│   ├── TemplatePanel.tsx Journal & custom templates
│   ├── AnnotationCanvas.tsx / AnnotationOverlay.tsx / AnnotationPanel.tsx / AnnotationToolbar.tsx
│   ├── ExportModal.tsx  Export configuration
│   ├── HistoryPanel.tsx Undo/redo tree
│   ├── MultiPeakFitModal.tsx
│   ├── ComputedColumnModal.tsx
│   ├── DataProcessingModal.tsx
│   ├── TransformPreviewModal.tsx
│   ├── FindReplaceModal.tsx
│   ├── FloatingPanel.tsx
│   ├── Toast.tsx        Toast notifications
│   ├── ConfirmDialog.tsx Confirmation dialog
│   └── ErrorBoundary.tsx
├── pages/
│   └── Workspace.tsx    Main workspace layout
├── store/               Zustand stores
│   ├── chartStore.ts    Chart config, layers, annotations
│   ├── datasetStore.ts  Dataset CRUD & transforms
│   ├── historyStore.ts  Undo/redo + branching history (cap 50 / 10 branches)
│   ├── uiStore.ts       Theme + language (localStorage-persisted)
│   ├── chartInteractionStore.ts  Hover + zoom state
│   ├── toastStore.ts
│   ├── confirmStore.ts
│   └── plotStore.ts     Re-exports for external use
├── utils/               Pure helpers
│   ├── chart.ts         Chart-type utilities
│   ├── tracesBuilder.ts Plotly trace construction
│   ├── layoutBuilder.ts Plotly layout construction
│   ├── colormaps.ts     Colormap data
│   ├── curveFitting.ts  Curve-fit algorithms (QR, Gauss–Newton)
│   ├── multiPeakFit.ts  Multi-peak fitting
│   ├── dataProcessing.ts Smoothing, interpolation, outliers
│   ├── statistics.ts    Descriptive statistics + correlation
│   ├── hypothesisTests.ts t-test, chi-square, normality
│   ├── peakDetection.ts
│   ├── fitAnnotation.ts Annotate fitted curves on charts
│   ├── fitReport.ts     Statistical reports from fits
│   ├── fitExport.ts     Export fitted curves (CSV/JSON)
│   ├── fitWorkerClient.ts Web Worker client
│   ├── projectFile.ts   .plot3d v6 format (serialize/deserialize + migration)
│   ├── projectFileV6.ts Content-hash IDs, stable stringify
│   ├── shareLink.ts     URL hash sharing
│   ├── journalTemplates.ts 14 journal templates
│   ├── matplotlibExporter.ts Matplotlib script generator
│   ├── tiffEncoder.ts   TIFF writer
│   ├── sampleData.ts    Sample datasets + uid
│   ├── annotations.tsx  Annotation helpers
│   ├── latex.ts         KaTeX rendering + sanitization
│   ├── contextMenu.ts
│   └── plotlyLoader.ts  Lazy-loads Plotly + react-plotly factory
├── workers/
│   └── fitWorker.ts     Heavy fitting off the main thread
├── i18n/
│   ├── index.ts         i18next setup
│   ├── en.json
│   └── zh.json
├── App.tsx              Root: ErrorBoundary, Workspace, ConfirmDialog
├── main.tsx             React render entry
├── types.ts             Core domain types
├── index.css            Tailwind + CSS-variable themes
└── assets/
```

## Browser support

Modern evergreen browsers (Chrome, Edge, Firefox, Safari) with ES2020 support. The Chart 3D exports rely on `html-to-image` rasterization; some printers/PDF readers handle 3D raster differently than true vector — prefer SVG/PDF for 2D output when sending to journals.

## Known limitations

- **EPS export** is SVG or PNG renamed to `.eps` (no real PostScript). UI flags it as experimental.
- **PDF export** embeds PNG for both 2D and 3D (not a true vector PDF).
- **DataTable** renders all rows with controlled `<input>` elements; thousands of rows will feel sluggish. Virtual scrolling is not yet wired in.
- **`isosurface3d` / `volume3d` plot types** are declared in the type union but rely on Plotly's experimental support and may behave inconsistently for very large grids.

See `AGENTS.md` for full development conventions, security notes, and `.plot3d` migration policy.

## License

[GNU General Public License v3.0](LICENSE)

## History

- Older review (now stale): [`REVIEW-2026-06-21.md`](./REVIEW-2026-06-21.md) — written 2026-06-21, most P0/P1 items were resolved by 2026-06-28. For current state see [`docs/superpowers/specs/2026-06-28-plot3d-improvement-plan-design.md`](./docs/superpowers/specs/2026-06-28-plot3d-improvement-plan-design.md).
- Phase summaries: [`PHASE-0.md`](./PHASE-0.md) through [`PHASE-5.md`](./PHASE-5.md) document the iterative delivery (test framework, 17 fit models, axis/inset improvements, Matplotlib exporter, .plot3d v6, journal templates, share URLs).
