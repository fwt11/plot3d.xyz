# plot3d.xyz — 项目开发指南（AI Agent 版）

本文件面向需要在该项目中编写、修改或调试代码的 AI coding agent。阅读者被假设**完全不了解本项目**。

## 1. 项目概述

**plot3d.xyz** 是一款面向科研工作者的浏览器端交互式数据可视化应用，主打 2D/3D 科研图表绘制、数据编辑、曲线拟合与导出。目标用户为材料科学、统计学和实验科学研究人员，应用场景包括论文配图与数据探索。

- **产品定位**：单页 Web 应用（SPA），纯前端运行，无后端服务。
- **核心能力**：
  - 2D 图表：折线图、散点图、柱状图、面积图、饼图、极坐标图、箱线图、小提琴图、直方图、热力图。
  - 3D 图表：曲面图、3D 散点、3D 等高线、3D 柱状图、等值面（isosurface）、体积渲染（volume）。
  - 数据处理：CSV / Excel 导入，单元格编辑，列变换，平滑，插值，缺失值/异常值处理。
  - 曲线拟合：线性、多项式、指数、对数、幂律、高斯、Logistic，多峰拟合与全局拟合（globalFit）。
  - 标注与导出：文本 / LaTeX / 箭头 / 矩形等标注；导出 PNG / SVG / PDF / TIFF，并可生成 matplotlib Python 复现脚本（部分格式有实现限制，见 §9）。
- **项目文件格式**：`.plot3d`，保存完整应用状态（数据集、图表配置、主题、语言），当前版本号为 `6`。

## 2. 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript（`strict` 模式） |
| 构建工具 | Vite 6 |
| 图表引擎 | Plotly.js（`plotly.js-dist-min`，懒加载）+ `react-plotly.js` |
| 状态管理 | Zustand v5 |
| 样式 | Tailwind CSS 3 + CSS 变量（主题色通过 `[data-theme]` 驱动） |
| 国际化 | i18next + react-i18next，支持中/英双语 |
| 数据处理 | PapaParse（CSV）、SheetJS / xlsx（Excel） |
| 导出 | jsPDF（PDF）、html-to-image（光栅化）、Plotly 原生 `downloadImage` |
| LaTeX | KaTeX |
| 图标 | lucide-react |
| 代码检查 | ESLint 9 + typescript-eslint + react-hooks + react-refresh |
| 测试 | Vitest 2（jsdom 环境）+ v8 coverage |

## 3. 项目结构

```
src/
├── App.tsx                    # 应用根组件，挂载 ErrorBoundary、Workspace
├── main.tsx                   # React 渲染入口
├── types.ts                   # 核心 TypeScript 类型定义（DataColumn、Dataset、ChartConfig、FigureConfig 等）
├── index.css                  # Tailwind 入口 + 深浅色主题 CSS 变量
├── pages/
│   └── Workspace.tsx          # 主工作区，整合 Ribbon、数据表、图层面板、配置面板、状态栏
├── components/
│   ├── ChartView.tsx          # 图表容器：按 FigureConfig 行列网格排布 SubplotView（约 114 行，已拆分）
│   ├── SubplotView.tsx        # 单个子图的 2D/3D 渲染（懒加载 Plotly、右键菜单、交互）
│   ├── DataTable.tsx          # 数据表格编辑（>200 行启用虚拟滚动）
│   ├── LayerPanel.tsx         # 图层管理
│   ├── ConfigPanel.tsx        # 右侧图表配置面板（含 SnapshotInput）
│   ├── Ribbon.tsx             # 顶部 Ribbon 工具栏容器
│   ├── ContextMenu.tsx        # 自定义右键菜单
│   ├── AnnotationCanvas.tsx   # 标注画布（图形标注的绘制与拖拽编辑）
│   ├── AnnotationOverlay.tsx  # 图表上方标注层（可拖拽）
│   ├── AnnotationRenderer.tsx # 标注渲染
│   ├── AnnotationToolbar.tsx  # 标注工具栏
│   ├── AnnotationPanel.tsx    # 标注配置面板
│   ├── FitResultsBar.tsx      # 拟合结果展示条
│   ├── MultiPeakFitModal.tsx  # 多峰拟合弹窗
│   ├── ExportModal.tsx        # 导出配置弹窗
│   ├── HistoryPanel.tsx       # 撤销/重做历史面板
│   ├── ConfirmDialog.tsx      # 确认对话框
│   ├── Toast.tsx              # Toast 提示
│   └── ribbon/                # Ribbon 各标签页（file/transform/stats/fit/chart/annotation/about）
│       ├── FileTab.tsx        # 文件导入/导出/项目保存/示例数据生成
│       ├── ChartTab.tsx       # 图表类型与标题
│       ├── TransformTab.tsx   # 数据变换
│       ├── FitTab.tsx         # 曲线拟合
│       ├── StatsTab.tsx       # 描述性统计
│       ├── AnnotationTab.tsx  # 标注管理
│       ├── AboutTab.tsx       # 关于页
│       └── chartTypes.tsx     # 图表类型定义与选择器
├── store/
│   ├── datasetStore.ts        # 数据集 CRUD、数据处理方法
│   ├── chartStore.ts          # 图表配置（FigureConfig + 子图）、图层、标注
│   ├── historyStore.ts        # 撤销/重做/分支历史
│   ├── uiStore.ts             # 主题、语言、localStorage 持久化
│   ├── fitStore.ts            # 拟合类型/结果状态
│   ├── annotationToolStore.ts # 当前标注工具
│   ├── chartInteractionStore.ts # 鼠标悬停、缩放状态
│   ├── toastStore.ts          # Toast 状态
│   ├── confirmStore.ts        # 确认对话框状态
│   ├── sharedDefaults.ts      # store 间共享的默认值
│   └── plotStore.ts           # store 聚合导出（推荐外部使用）
├── utils/
│   ├── chart.ts               # 图表类型判断（is3DChart 等）
│   ├── tracesBuilder.ts       # Plotly trace 构建、误差棒、网格数据提取
│   ├── layoutBuilder.ts       # Plotly layout 构建
│   ├── plotlyLoader.ts        # Plotly + react-plotly.js 懒加载（从 ChartView 拆出）
│   ├── colormaps.ts           # 颜色映射数据
│   ├── curveFitting.ts        # 曲线拟合算法（含 QR、Gauss-Newton、globalFit）
│   ├── dataProcessing.ts      # 平滑、插值、筛选、缺失值、异常值
│   ├── statistics.ts          # 描述性统计、相关系数、分布函数
│   ├── distributions.ts       # 分布 CDF/逆函数
│   ├── hypothesisTests.ts     # 假设检验
│   ├── peakDetection.ts       # 峰值检测
│   ├── multiPeakFit.ts        # 多峰拟合
│   ├── fitReport.ts           # 拟合报告统计量（F 检验等）
│   ├── fitExport.ts           # 拟合结果导出（CSV / LaTeX / 剪贴板）
│   ├── exportLayout.ts        # 整图（figure 网格）PNG/SVG 导出
│   ├── matplotlibExporter.ts  # 生成 matplotlib Python 复现脚本
│   ├── projectFile.ts         # .plot3d 项目文件序列化/反序列化/版本迁移（PROJECT_VERSION = 6）
│   ├── projectFileV6.ts       # v6 格式：稳定键序、内容哈希 ID
│   ├── shareLink.ts           # 分享链接：FigureConfig ↔ URL fragment 编解码
│   ├── sampleData.ts          # 示例数据生成与 uid 工具
│   ├── annotations.tsx        # 标注创建工具
│   ├── latex.ts               # KaTeX 渲染与 LaTeX 清洗
│   ├── journalTemplates.ts    # 期刊模板
│   ├── contextMenu.ts         # 右键菜单数据类型
│   └── tiffEncoder.ts         # TIFF 编码
├── workers/
│   └── fitWorker.ts           # Web Worker：耗时拟合计算
└── i18n/
    ├── index.ts               # i18next 配置
    ├── zh.json                # 中文文案
    └── en.json                # 英文文案
```

> 上表只列主要文件；`src/utils/` 下还有 `annotationCoords.ts`、`dateFunctions.ts`、`segmentColors.ts`、`peakTypes.ts` 等辅助模块，以及与源码同目录的 `*.test.ts` 单测（见 §7）。

### Tier A 测试覆盖（spec §5.1，branch coverage ≥ 95% 目标）

以下数字为 `npm run test:coverage`（v8 provider）2026-07-24 实测；阈值在 `vitest.config.ts` 中按实测值设置。

| 文件 | 行数 | 实测 branch | 备注 |
|------|------|-------------|------|
| `src/utils/curveFitting.ts` | 1824 | 82.1% | Phase 1 后已补大量回归/边界测试（band、bounds、weighted、newfits 四个专项测试文件）；剩余为 Gauss-Newton 发散 fallback 等需病态输入的分支 |
| `src/utils/statistics.ts` | 607 | 77.9% | `skewness` / `kurtosis` 等已修复并补测；剩余为部分导出的边界 case |
| `src/utils/hypothesisTests.ts` | 643 | 89.8% | `shapiroWilk` Royston 近似的符号错误**已修复**并补了回归测试 |
| `src/utils/dataProcessing.ts` | 604 | 78.8% | `detectPeaks` / `cubicSpline` / `savitzkyGolay` 已修复并补测；剩余为 pchipInterp / fillMissingValues fallback 等难确定性触发的分支 |
| `src/utils/multiPeakFit.ts` | 393 | 93.6% | gaussianElim NaN 发散路径需病态输入 |
| `src/utils/distributions.ts` | 277 | 91.0% | `tCritical005` 末尾 `return 1.96` 是死代码（前面分支已覆盖所有 df） |

Tier B/C（`tracesBuilder.ts` 85.4% branch、`layoutBuilder.ts` 50.0% branch）也纳入 coverage 统计与阈值，详见 `vitest.config.ts`。

> **注意**：vitest 阈值按上述实测 branch 设置，未达 spec §5.1 的 95% 目标。**不允许"假装调高"**——提升覆盖率应通过补测试或修死代码，而非调阈值。

### 大文件清单（>500 行）— 拆分候选

以下为 `wc -l` 实测（2026-07-24）。`ChartView.tsx` 已在 Phase 2 拆分为约 114 行的网格容器 + `SubplotView.tsx` + `plotlyLoader.ts`，不再是拆分目标。

| 文件 | 行数 | 备注 |
|------|------|------|
| `src/utils/curveFitting.ts` | 1824 | Phase 1 后大幅扩充（globalFit、置信带、加权拟合等），可考虑按拟合族拆分 |
| `src/components/LayerPanel.tsx` | 909 | 可拆出 `LayerStyleEditor.tsx`；排序拖拽可抽到 hook |
| `src/components/SubplotView.tsx` | 901 | Phase 2 拆分后的子图渲染主体 |
| `src/components/AnnotationCanvas.tsx` | 865 | 标注画布 |
| `src/utils/exportLayout.ts` | 752 | 整图导出 |
| `src/utils/matplotlibExporter.ts` | 733 | matplotlib 脚本生成 |
| `src/store/datasetStore.ts` | 724 | 暂不拆 |
| `src/utils/statistics.ts` | 702 | 纯函数，按功能域拆意义不大 |
| `src/components/DataTable.tsx` | 671 | 暂不拆（虚拟化已做） |
| `src/components/ribbon/FileTab.tsx` | 664 | 暂不拆 |
| `src/utils/hypothesisTests.ts` | 643 | 纯函数 |
| `src/pages/Workspace.tsx` | 624 | 暂不拆 |
| `src/utils/dataProcessing.ts` | 604 | 纯函数 |
| `src/components/FitResultsBar.tsx` | 596 | 暂不拆 |
| `src/components/ExportModal.tsx` | 535 | 暂不拆 |

## 4. 构建与开发命令

所有命令通过 `npm` 执行。

```bash
# 安装依赖
npm install

# 启动开发服务器（Vite HMR）
npm run dev

# 类型检查（strict，不输出文件）
npm run check

# ESLint 代码检查
npm run lint

# 运行单元测试（vitest run，单次）
npm test

# 监听模式跑测试
npm run test:watch

# 测试 + v8 覆盖率（含 vitest.config.ts 中的阈值校验）
npm run test:coverage

# i18n 中英文 key 一致性检查（scripts/check-i18n.mjs）
npm run check:i18n

# 构建生产版本（tsc + vite build）
npm run build

# 预览生产版本
npm run preview
```

CI（`.github/workflows/ci.yml`，push/PR 到 main 触发）依次执行：`npm run check` → `check:i18n` → `lint` → `test:coverage` → `build`。

### 重要配置说明

- `tsconfig.json` 启用 `strict`、`noUnusedLocals`、`noUnusedParameters` 等严格规则，**未使用变量会报错**。
- `vite.config.ts` 中按依赖拆分为 `plotly`、`xlsx`、`export`、`vendor` 四个 manual chunks，避免单个 chunk 过大。
- `postcss.config.js` 顶部有 `/** WARNING: DON'T EDIT THIS FILE */` 标记，**不要修改该文件**（由构建/IDE 工具生成）。
- `index.html` 已配置收紧的 CSP（Content-Security-Policy）：`script-src 'self'`（无 `unsafe-inline` / `unsafe-eval`，主题预置脚本已外置为 `public/theme-init.js`）；`style-src 'self' 'unsafe-inline'`（React/Plotly 会写内联 style 属性，必须保留）；`worker-src 'self' blob:`（fitWorker 与导出下载）。`index.html` 顶部注释块记录了各条指令的理由。

## 5. 开发约定

### 5.1 类型定义

- `src/types.ts` 是唯一的领域模型来源，所有 store、组件、工具函数都引用这里定义的类型。
- 核心类型：
  - `DataColumn`：列，含 `id`、`name`、`type`（`'X'|'Y'|'Z'|'label'|'error'|...`）、`values`。
  - `Dataset`：数据集，由多个 `DataColumn` 组成。
  - `ChartConfig`：图表配置，含坐标轴、图例、图层、标注、导出设置等。
  - `LayerConfig`：图层，绑定 `datasetId` + `xColumn`/`yColumn`（可选 `zColumn`）。
  - `Annotation`：标注，坐标模式支持 `'percent'`（百分比定位）和 `'data'`（数据坐标定位）。
- 数值转换统一使用 `toNumber()` 和 `isValidNumber()`，不要直接 `Number(v)` 后忽略 `NaN`。

### 5.2 状态管理

- 使用 **Zustand** 管理状态，按领域拆分为多个 store。
- 外部组件统一从 `src/store/plotStore.ts` 导入：
  ```ts
  import { useUiStore, useDatasetStore, useChartStore, useHistoryStore } from '@/store/plotStore';
  ```
- 跨 store 调用时可直接通过 `useXxxStore.getState()` 访问，但需警惕循环依赖。
- `chartStore` 与 `datasetStore` 中的大多数变更操作会自动调用 `useHistoryStore.getState().pushSnapshot(description)` 记录历史。
- **历史栈上限**：`MAX_HISTORY = 50`；分支上限 `MAX_BRANCHES = 10`。
- 静默更新（不记录历史）的函数名以 `Silent` 结尾，例如 `updateCellValueSilent`、`updateAnnotationSilent`。

### 5.3 数据变更约定

- 数据表格单元格编辑：**聚焦（onFocus）时先 `pushSnapshot` 捕获编辑前状态**，打字过程中使用 `updateCellValueSilent` 写入，失焦（onBlur）时若值未变化则调用 `useHistoryStore.getState().popLastSnapshot(description)` 弹掉该次投机快照，避免每次按键或每次失焦都生成历史条目。批量 silent 写入（查找替换、批量填充）同样在写入前 `pushSnapshot` 一次。
- ConfigPanel 的文本/数字输入（标题、轴标签/单位、边距）遵循同一模式：onChange 走 `setXxxSilent`，快照由 `SnapshotInput` 组件在 focus/blur 时管理。
- 删除列、删除数据集等破坏性操作已通过 `ConfirmDialog` 增加确认流程。
- 新增数据集时会根据是否有 `Z` 列自动建议图表类型（`pendingChartTypeSuggestion`），不会直接切换。

### 5.4 图表渲染约定

- 图表区为 **figure/subplots 二级结构**：`ChartConfig` 描述单个子图，`FigureConfig`（`rows`/`cols`/`gap`/`subplots`）描述整图网格；`chartStore` 持有 `figure`。
- `ChartView.tsx` 只负责按 figure 网格排布 `SubplotView` 并处理整图右键导出；每个子图的 Plotly 渲染在 `SubplotView.tsx`。
- Plotly 懒加载封装在 `src/utils/plotlyLoader.ts`（从 ChartView 拆出），Plotly 组件通过 `react-plotly.js/factory` 动态创建。
- 具体 trace / layout 逻辑在 `tracesBuilder.ts` / `layoutBuilder.ts`；整图（多子图）PNG/SVG 导出在 `exportLayout.ts`。
- 2D 图表优先使用 Plotly 原生导出以获得矢量/高分辨率；3D 图表使用 `html-to-image` 对容器截图。
- 深色/浅色主题通过 `uiStore` 写入 `[data-theme]`，CSS 变量随之切换，Plotly layout 也会读取 `cssVars` 同步配色。

### 5.5 计算密集型任务

- 曲线拟合、多峰拟合等计算应放入 `src/workers/fitWorker.ts`，通过 `src/utils/fitWorkerClient.ts` 调用，避免阻塞主线程。
- `fitWorker.ts` 中已支持的拟合类型：`linear`、`poly2~6`、`exponential`、`logarithmic`、`power`、`gaussian`、`logistic`。

### 5.6 国际化

- 所有面向用户的字符串必须走 i18n，key 定义在 `src/i18n/zh.json` 和 `src/i18n/en.json`。
- 新增 UI 时，**必须同时添加中英文 key**，不能只加一种语言。
- 历史操作描述通过 `i18n.t('history.xxx', { defaultValue: '...' })` 生成，确保撤销面板有可读文本。

### 5.7 项目文件兼容性

- `.plot3d` 文件格式版本由 `src/utils/projectFile.ts` 中的 `PROJECT_VERSION` 控制，**当前为 `6`**。
- 修改持久化数据结构时，需要：
  1. 更新 `PROJECT_VERSION`；
  2. 在 `loadProjectFile` 中增加旧版本的迁移分支（现有 v1→v6 的逐级 bump 示例），并在 `sanitizeProjectFile` 中兼容旧字段。
- 已有迁移链：v1→v2 删除 `scene3D` 字段；v2→v3 新增图表类型与 `yAxisRight`（可选，直接 bump）；v3→v4 `scene3D` 变为可选；v4→v5 标注模型扩展；v5→v6 由 `chartConfig` 迁移为 `figure`（sanitizer 会把旧 `chartConfig` 包装成 1×1 figure）。v6 另见 `projectFileV6.ts`（稳定键序、内容哈希 ID）。
- 单个项目文件大小限制为 **50 MB**（`MAX_PROJECT_FILE_BYTES`），超过会被拒绝加载。

## 6. 代码风格规范

- TypeScript 严格模式，**不允许隐式 `any`**。
- 组件使用函数组件 + Hooks；类组件仅用于 `ErrorBoundary`。
- 导入路径使用 `@/` 别名指向 `src/`（由 `tsconfig.json` 的 `paths` 与 `vite-tsconfig-paths` 支持）。
- 工具函数优先写成纯函数，操作数组时避免直接修改原数组。
- UI 类名使用 Tailwind，主题相关颜色应使用 CSS 变量（如 `var(--bg-surface)`），不要硬编码颜色。
- Tailwind 配置中 `darkMode: ["class", '[data-theme="dark"]']`，与 `index.css` 中的 `[data-theme="dark"]` 保持一致。

### ESLint 规则

- 使用 `typescript-eslint` 的推荐规则。
- `react-hooks/exhaustive-deps` 等 Hooks 规则已启用。
- `react-refresh/only-export-components` 配置为 `warn`，并允许常量导出（`allowConstantExport: true`）。

## 7. 测试说明

项目使用 **Vitest 2**（jsdom 环境，配置在 `vitest.config.ts`，继承 `vite.config.ts`）。

- 测试文件与被测源码同目录（`src/**/*.test.ts`），另有少量集成测试在 `tests/`（`realXlsxDate.test.ts`、`svgFigureViewBox.test.ts`）。当前共 27 个测试文件、480+ 用例。
- 常用命令：
  - `npm test` — 单次跑全部测试（`vitest run`）。
  - `npm run test:watch` — 监听模式。
  - `npm run test:coverage` — v8 覆盖率 + 阈值校验。coverage 只统计 Tier A/B/C 指定的 8 个文件（见 §3 Tier A 表），各文件阈值按实测 branch 设置在 `vitest.config.ts` 中，**不要为通过 CI 而调低阈值**。
  - `npm run check:i18n` — 校验 `zh.json` / `en.json` key 一致性（`scripts/check-i18n.mjs`）。
- CI（`.github/workflows/ci.yml`）在 push/PR 到 main 时跑完整链路：typecheck → i18n → lint → test:coverage → build，并上传 coverage 报告 artifact。
- 其他验证方式：`npm run check`（类型检查）、`npm run lint`、`npm run build`、`npm run dev` + 浏览器手动验证。
- 统计算法（`statistics.ts`、`curveFitting.ts`、`dataProcessing.ts` 等）是纯函数，新增算法时应同步补同目录的 `*.test.ts`。

## 8. 安全注意事项

- **CSP**：`index.html` 已设置收紧的 `Content-Security-Policy`（`script-src 'self'`，无 `unsafe-inline`/`unsafe-eval`；内联脚本已外置到 `public/theme-init.js`）。新增外部脚本、字体、图片域名或 `eval` 类依赖时，需要同步更新 CSP——注意 CSP 已不允许内联脚本，新增启动期脚本应放到 `public/` 下外置引用。
- **LaTeX 渲染**：`latex.ts` 会对用户输入的 LaTeX 进行简单清洗，移除 `\input`、 `\include`、 `\write` 等危险命令，但不可完全依赖；避免把未过滤的用户输入直接传入 `dangerouslySetInnerHTML`。
- **项目文件加载**：`loadProjectFile` 会验证并清洗 JSON，拒绝超过 50 MB 的文件，防止大文件卡死。
- **DOM 操作**：导出时通过 `URL.createObjectURL` 创建临时下载链接，全部统一直接 `setTimeout(() => URL.revokeObjectURL(url), 1000)` 延迟 1 秒回收（保证浏览器已开始下载），避免内存泄漏；新增下载点请沿用同一写法。
- **XLSX 依赖**：使用 SheetJS 官方 CDN 版本 0.20.3（`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`，package.json 中直接钉住 tgz URL）。npm registry 的 0.18.5 含 CVE-2023-30533 / CVE-2024-22363 且官方不再向 npm 发布修复版，升级时需到 `https://docs.sheetjs.com` 查询最新 CDN 版号。
- **无后端交互**：所有计算在浏览器本地完成，不收集用户数据；但导出 / 下载功能依赖浏览器 API。

## 9. 已知限制与重要背景

项目根目录下有 `REVIEW-2026-06-21.md` 与 `REVIEW-2026-07-17.md` 两份评审报告，记录了大量问题与改进建议。当前代码已针对其中多项 P0 问题做了修复，但仍有一些限制需要了解：

- **导出格式**：
  - PDF 导出为 PNG 嵌入 PDF（光栅化），非矢量 PDF。
  - EPS 导出已整体移除（含 UI 入口与 i18n key），不要再添加相关代码路径。
  - 另有 `matplotlibExporter.ts` 可生成 matplotlib Python 复现脚本；其中 `isosurface3d` / `volume3d` 在脚本里降级为 scatter3d 占位。
- **DataTable 性能**：已实现虚拟滚动，行数超过 `VIRTUAL_THRESHOLD = 200`（`DataTable.tsx`）时启用；阈值以下仍渲染全部受控 `<input>`。
- **图表类型状态**：`isosurface3d` / `volume3d` 已在 `SubplotView.tsx` 中实现（Plotly `isosurface` / `volume` trace），但交互与导出支持不如主流图表类型完善。
- **主题/语言**：已通过 `localStorage` 持久化，键名为 `plot3d-theme` 和 `plot3d-lang`；主题预置脚本为 `public/theme-init.js`（CSP 不允许内联脚本，故外置）。
- **广告脚本**：早期版本 `index.html` 中嵌入了 Google AdSense，当前版本已移除。

## 10. 常用修改入口

| 想要修改的功能 | 先看这些文件 |
|---------------|-------------|
| 新增图表类型 | `src/types.ts`、`src/components/ribbon/chartTypes.tsx`、`src/utils/chart.ts`、`src/utils/tracesBuilder.ts`、`src/components/SubplotView.tsx` |
| 新增数据处理方法 | `src/utils/dataProcessing.ts`、`src/store/datasetStore.ts`、`src/components/ribbon/TransformTab.tsx` |
| 新增拟合类型 | `src/utils/curveFitting.ts`、`src/workers/fitWorker.ts`、`src/utils/fitWorkerClient.ts`、`src/store/fitStore.ts`、`src/components/ribbon/FitTab.tsx` |
| 新增统计功能 | `src/utils/statistics.ts`、`src/utils/hypothesisTests.ts`、`src/components/ribbon/StatsTab.tsx` |
| 修改 UI 文案 | `src/i18n/zh.json`、`src/i18n/en.json`（改完跑 `npm run check:i18n`） |
| 修改主题颜色 | `src/index.css`、`tailwind.config.js` |
| 修改导出行为 | `src/components/ExportModal.tsx`、`src/components/ChartView.tsx` / `SubplotView.tsx`（右键导出）、`src/utils/exportLayout.ts`、`src/utils/matplotlibExporter.ts`、`src/components/ribbon/FileTab.tsx` |
| 修改项目文件格式 | `src/utils/projectFile.ts`、`src/utils/projectFileV6.ts` |
| 修改右键菜单 | `src/utils/contextMenu.ts`、各组件中的 `showContextMenu` 调用 |

## 11. 许可

GPLv3（见 `README.md`）。
