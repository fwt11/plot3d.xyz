# plot3d.xyz — 项目开发指南（AI Agent 版）

本文件面向需要在该项目中编写、修改或调试代码的 AI coding agent。阅读者被假设**完全不了解本项目**。

## 1. 项目概述

**plot3d.xyz** 是一款面向科研工作者的浏览器端交互式数据可视化应用，主打 2D/3D 科研图表绘制、数据编辑、曲线拟合与导出。目标用户为材料科学、统计学和实验科学研究人员，应用场景包括论文配图与数据探索。

- **产品定位**：单页 Web 应用（SPA），纯前端运行，无后端服务。
- **核心能力**：
  - 2D 图表：折线图、散点图、柱状图、面积图、饼图、极坐标图、箱线图、直方图、热力图。
  - 3D 图表：曲面图、3D 散点、3D 等高线、3D 柱状图、等值面、体积渲染（后两者受 Plotly 能力限制）。
  - 数据处理：CSV / Excel 导入，单元格编辑，列变换，平滑，插值，缺失值/异常值处理。
  - 曲线拟合：线性、多项式、指数、对数、幂律、高斯、Logistic，以及多峰拟合。
  - 标注与导出：文本 / LaTeX / 箭头 / 矩形标注；导出 PNG / SVG / PDF / TIFF / EPS（部分格式有实现限制）。
- **项目文件格式**：`.plot3d`，保存完整应用状态（数据集、图表配置、主题、语言），当前版本号为 `2`。

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

## 3. 项目结构

```
src/
├── App.tsx                    # 应用根组件，挂载 ErrorBoundary、Workspace
├── main.tsx                   # React 渲染入口
├── types.ts                   # 核心 TypeScript 类型定义（DataColumn、Dataset、ChartConfig 等）
├── index.css                  # Tailwind 入口 + 深浅色主题 CSS 变量
├── pages/
│   └── Workspace.tsx          # 主工作区，整合 Ribbon、数据表、图层面板、配置面板、状态栏
├── components/
│   ├── ChartView.tsx          # 统一 2D/3D 图表渲染（懒加载 Plotly）
│   ├── DataTable.tsx          # 数据表格编辑
│   ├── LayerPanel.tsx         # 图层管理
│   ├── ConfigPanel.tsx        # 右侧图表配置面板
│   ├── Ribbon.tsx             # 顶部 Ribbon 工具栏容器
│   ├── ContextMenu.tsx        # 自定义右键菜单
│   ├── AnnotationOverlay.tsx  # 图表上方标注层（可拖拽）
│   ├── AnnotationPanel.tsx    # 标注配置面板
│   ├── ExportModal.tsx        # 导出配置弹窗
│   ├── HistoryPanel.tsx       # 撤销/重做历史面板
│   ├── ConfirmDialog.tsx      # 确认对话框
│   ├── Toast.tsx              # Toast 提示
│   └── ribbon/                # Ribbon 各标签页
│       ├── FileTab.tsx        # 文件导入/导出/项目保存
│       ├── ChartTab.tsx       # 图表类型与标题
│       ├── TransformTab.tsx   # 数据变换
│       ├── FitTab.tsx         # 曲线拟合
│       ├── StatsTab.tsx       # 描述性统计
│       ├── GenerateTab.tsx    # 示例数据生成
│       ├── AnnotationTab.tsx  # 标注管理
│       └── chartTypes.tsx     # 图表类型定义与选择器
├── store/
│   ├── datasetStore.ts        # 数据集 CRUD、数据处理方法
│   ├── chartStore.ts          # 图表配置、图层、标注
│   ├── historyStore.ts        # 撤销/重做/分支历史
│   ├── uiStore.ts             # 主题、语言、localStorage 持久化
│   ├── chartInteractionStore.ts # 鼠标悬停、缩放状态
│   ├── toastStore.ts          # Toast 状态
│   ├── confirmStore.ts        # 确认对话框状态
│   └── plotStore.ts           # store 聚合导出（推荐外部使用）
├── utils/
│   ├── chart.ts               # 图表类型判断（is3DChart 等）
│   ├── tracesBuilder.ts       # Plotly trace 构建、误差棒、网格数据提取
│   ├── layoutBuilder.ts       # Plotly layout 构建
│   ├── colormaps.ts           # 颜色映射数据
│   ├── curveFitting.ts        # 曲线拟合算法（含 QR、Gauss-Newton）
│   ├── dataProcessing.ts      # 平滑、插值、筛选、缺失值、异常值
│   ├── statistics.ts          # 描述性统计、相关系数、分布函数
│   ├── hypothesisTests.ts     # 假设检验
│   ├── peakDetection.ts       # 峰值检测
│   ├── multiPeakFit.ts        # 多峰拟合
│   ├── projectFile.ts         # .plot3d 项目文件序列化/反序列化/版本迁移
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

### Tier A 测试覆盖（spec §5.1，branch coverage ≥ 95% 目标）

| 文件 | 行数 | Phase 0 实测 branch | 阻塞原因 |
|------|------|---------------------|---------|
| `src/utils/curveFitting.ts` | 1048 | 84% | 12 个 Gauss-Newton 收敛失败 / QR 逆 / tCritical 边界分支，需病态输入；Phase 1 跟进 |
| `src/utils/statistics.ts` | 695 | 78% | 32 个导出 + 大量边界 case（相关系数 NaN、描述统计 1 元素等），Phase 0 仅覆盖主要 case；Phase 1+ 跟进 |
| `src/utils/hypothesisTests.ts` | 626 | 88% | `shapiroWilk` Royston 近似在 n ≥ 4 时 `eps < 0` → NaN（**已存在 bug**，Phase 1 修复） |
| `src/utils/dataProcessing.ts` | 597 | 78% | pchipInterp 内部 corner case + fillMissingValues fallback 路径难确定性触发 |
| `src/utils/multiPeakFit.ts` | 393 | 93% | gaussianElim NaN 发散路径需病态输入 |
| `src/utils/distributions.ts` | 277 | 91% | `tCritical005` 末尾 `return 1.96` 是死代码（前面分支已覆盖所有 df） |

> **临时措施**：Phase 0 的 vitest 阈值按上述实测 branch 设置（≤ 100），未达 spec §5.1 的 95% 目标。**不允许"假装调高"——每个文件都在 PHASE-0.md 记录了具体阻塞原因**。

### 大文件清单（>500 行）— Phase 2 拆分目标

| 文件 | 行数 | 拆分计划 |
|------|------|---------|
| `src/components/ChartView.tsx` | 924 | Phase 2: 拆出 `TracesOverlay3D.tsx` / `ChartContextMenu.tsx` / `useChartInteractions.ts` hook |
| `src/components/LayerPanel.tsx` | 909 | Phase 2: 拆出 `LayerStyleEditor.tsx`；排序拖拽抽到 `useLayerDragSort.ts` |
| `src/components/DataTable.tsx` | 615 | 暂不拆（虚拟化已做） |
| `src/components/ribbon/FileTab.tsx` | 620 | 暂不拆 |
| `src/components/ExportModal.tsx` | 552 | 暂不拆 |

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

# 构建生产版本（tsc + vite build）
npm run build

# 预览生产版本
npm run preview
```

### 重要配置说明

- `tsconfig.json` 启用 `strict`、`noUnusedLocals`、`noUnusedParameters` 等严格规则，**未使用变量会报错**。
- `vite.config.ts` 中按依赖拆分为 `plotly`、`xlsx`、`export`、`vendor` 四个 manual chunks，避免单个 chunk 过大。
- `postcss.config.js` 顶部有 `/** WARNING: DON'T EDIT THIS FILE */` 标记，**不要修改该文件**（由构建/IDE 工具生成）。
- `index.html` 已配置 CSP（Content-Security-Policy），默认仅允许同源脚本、`blob:` worker 与内联样式/脚本。

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

- 数据表格单元格编辑：打字过程中使用 `updateCellValueSilent`，**失焦（onBlur）时调用 `updateCellValue` 提交一条历史记录**，避免每次按键都生成快照。
- 删除列、删除数据集等破坏性操作已通过 `ConfirmDialog` 增加确认流程。
- 新增数据集时会根据是否有 `Z` 列自动建议图表类型（`pendingChartTypeSuggestion`），不会直接切换。

### 5.4 图表渲染约定

- `ChartView.tsx` 负责懒加载 Plotly 并协调渲染；具体 trace / layout 逻辑拆到 `tracesBuilder.ts` / `layoutBuilder.ts`。
- Plotly 组件通过 `react-plotly.js/factory` 动态创建。
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

- `.plot3d` 文件格式版本由 `src/utils/projectFile.ts` 中的 `PROJECT_VERSION` 控制。
- 修改持久化数据结构时，需要：
  1. 更新 `PROJECT_VERSION`；
  2. 在 `sanitizeProjectFile` 中兼容旧字段；
  3. 已有示例：v1 → v2 时删除了 `scene3D` 字段。
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

**当前项目没有配置测试框架**，也没有 `.test.*` / `.spec.*` 文件。

- 可用验证方式：
  - `npm run check` — TypeScript 类型检查。
  - `npm run lint` — 静态代码检查。
  - `npm run build` — 完整构建，验证打包产物。
  - `npm run dev` + 浏览器手动验证。
- 统计算法（`statistics.ts`、`curveFitting.ts`、`dataProcessing.ts`）是纯函数，未来如需测试可优先补充单元测试。
- 建议引入 `vitest` 作为测试框架（与 Vite 生态一致）。

## 8. 安全注意事项

- **CSP**：`index.html` 已设置 `Content-Security-Policy`。新增外部脚本、字体、图片域名或 `eval` 类依赖时，需要同步更新 CSP。
- **LaTeX 渲染**：`latex.ts` 会对用户输入的 LaTeX 进行简单清洗，移除 `\input`、 `\include`、 `\write` 等危险命令，但不可完全依赖；避免把未过滤的用户输入直接传入 `dangerouslySetInnerHTML`。
- **项目文件加载**：`loadProjectFile` 会验证并清洗 JSON，拒绝超过 50 MB 的文件，防止大文件卡死。
- **DOM 操作**：导出时通过 `URL.createObjectURL` 创建临时下载链接，并在延迟后 `revokeObjectURL`，避免内存泄漏。
- **XLSX 依赖**：使用 SheetJS 官方 CDN 版本（`https://cdn.sheetjs.com/...`），注意该依赖历史上存在安全漏洞，建议跟踪版本更新。
- **无后端交互**：所有计算在浏览器本地完成，不收集用户数据；但导出 / 下载功能依赖浏览器 API。

## 9. 已知限制与重要背景

项目根目录下有一份 `REVIEW.md`，是 2026-06-21 的专业评审报告，记录了大量问题与改进建议。当前代码已针对其中多项 P0 问题做了修复，但仍有一些限制需要了解：

- **导出格式**：
  - EPS 导出在 2D 场景下实际是 SVG 改扩展名，3D 场景下是 PNG 改扩展名，并非真正的 PostScript；UI 中已标记为实验性。
  - PDF 导出现为 PNG 嵌入 PDF（光栅化），非矢量 PDF。
- **DataTable 性能**：当前渲染所有行为受控 `<input>`，超过数千行会明显卡顿；尚未引入虚拟滚动。
- **图表类型状态**：`isosurface3d` / `volume3d` 已在类型中声明，但 Plotly 实现与 UI 支持可能不完整。
- **主题/语言**：已通过 `localStorage` 持久化，键名为 `plot3d-theme` 和 `plot3d-lang`。
- **广告脚本**：早期版本 `index.html` 中嵌入了 Google AdSense，当前版本已移除。

## 10. 常用修改入口

| 想要修改的功能 | 先看这些文件 |
|---------------|-------------|
| 新增图表类型 | `src/types.ts`、`src/components/ribbon/chartTypes.tsx`、`src/utils/chart.ts`、`src/utils/tracesBuilder.ts` |
| 新增数据处理方法 | `src/utils/dataProcessing.ts`、`src/store/datasetStore.ts`、`src/components/ribbon/TransformTab.tsx` |
| 新增拟合类型 | `src/utils/curveFitting.ts`、`src/workers/fitWorker.ts`、`src/utils/fitWorkerClient.ts`、`src/components/ribbon/FitTab.tsx` |
| 新增统计功能 | `src/utils/statistics.ts`、`src/utils/hypothesisTests.ts`、`src/components/ribbon/StatsTab.tsx` |
| 修改 UI 文案 | `src/i18n/zh.json`、`src/i18n/en.json` |
| 修改主题颜色 | `src/index.css`、`tailwind.config.js` |
| 修改导出行为 | `src/components/ChartView.tsx`（右键导出）、`src/components/ribbon/FileTab.tsx`、`src/components/ExportModal.tsx` |
| 修改项目文件格式 | `src/utils/projectFile.ts` |
| 修改右键菜单 | `src/utils/contextMenu.ts`、各组件中的 `showContextMenu` 调用 |

## 11. 许可

GPLv3（见 `README.md`）。
