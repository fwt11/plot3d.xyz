# Plot3D 专业评审报告

> 评审日期：2026-06-21
> 评审视角：专业科研绘图软件设计师（对标 Origin、SigmaPlot、GraphPad Prism、Matplotlib）
> 评审范围：全项目代码、UI 设计、功能完整性、科学准确性、导出质量、性能、安全

---

## 一、最严重的问题（性质性错误）

### 1. index.html 嵌入 Google AdSense — 完全不可接受

`index.html:8-9` 包含广告脚本：

```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5107546000731729" crossorigin="anonymous"></script>
```

**科研工具嵌入广告**会带来：隐私泄露（向 Google 上报用户数据）、性能拖累、专业性质疑。这是定位性错误，必须立即移除。

### 2. EPS 导出仍是假的

`FileTab.tsx` 的 `handleExportEPS` 对 2D 导出 SVG、对 3D 导出 PNG，仅改扩展名为 `.eps`。上一轮仅加了"实验性"标签，但**内容本身不是 PostScript**，期刊投稿仍会被拒。应从 UI 彻底移除，或实现真正的 PS 转换。

### 3. PDF 导出非矢量

PDF 导出实际是 PNG 嵌入 PDF（光栅化），2D/3D 均如此。科研出版需要**矢量 PDF**（文字可选、缩放无损）。

### 4. 标注数据坐标模式未实现

`AnnotationPanel.tsx` 中：

```tsx
<button disabled title={t('annotation.dataModeNotImplemented')}>XY</button>
```

科研标注的**核心需求**是锚定到数据坐标（缩放/平移时跟随），目前仅支持百分比定位，等于无法精确标注数据点。

### 5. 依赖版本号疑似虚标

`package.json` 中多个版本号不存在：

- `katex: ^0.17.0` — KaTeX 最新是 0.16.x
- `plotly.js-dist-min: ^3.6.0` — Plotly 最新是 2.x
- `react-plotly.js: ^4.0.0` — 最新是 2.6.0
- `i18next: ^26.3.1` / `react-i18next: ^17.0.8` — 远超实际版本

这些版本号是虚构的，`npm install` 会失败。此外 `xlsx: ^0.18.5` 有已知安全漏洞（CVE-2023-30533）。

---

## 二、科学准确性问题

### 6. 默认 jet 色图 — 科学界已弃用

`chartStore.ts` 默认 `colorMap: 'jet'`。jet 在色盲者眼中不可分辨，且产生亮度假象，Nature/Science 已建议弃用。**应默认 viridis**。

### 7. 拟合统计严重不完整

`FitTab.tsx` 仅显示 R²/RMSE/MAE，缺失：

| 缺失项 | 重要性 | 说明 |
|--------|--------|------|
| **调整 R²** | 必须 | 多项式拟合用 R² 会随阶数虚高 |
| **参数标准误** | 必须 | 无标准误则参数无意义 |
| **95% 置信区间** | 必须 | Origin/Prism 标配 |
| **残差图** | 必须 | 验证模型假设的核心手段 |
| **ANOVA 表** | 重要 | 拟合优度检验 |
| **加权拟合** | 重要 | 有误差列却不支持 1/σ² 加权 |
| **拟合方程显示在图上** | 重要 | 当前仅显示在 Ribbon |

### 8. 拟合类型极少

仅 3 类（线性、多项式、指数），对比 Origin 200+、Prism 110+。缺失：对数、幂律、高斯、洛伦兹、Sigmoid/Logistic、Weibull、Hill、双指数、**自定义公式**。

### 9. 误差棒功能不完整

- 无 X 方向误差棒
- 仅支持数据列，无百分比/标准差/置信区间类型
- 无对称/非对称的 UI 提示

### 10. 轴无单位字段

`types.ts` 的 `AxisConfig` 无 `unit` 字段。科研轴标签通常是 "Time (s)"、"Concentration (mol/L)"，当前需手动在 label 中拼单位。

---

## 三、性能与交互硬伤

### 11. DataTable 每次按键记录历史

`DataTable.tsx` 的 `updateCellValue` 每次按键都 `pushSnapshot()`。输入 50 个字符 = 50 条历史，迅速填满 50 步上限，用户无法 undo 到更早状态。应 **debounce 或仅在失焦时记录**。

### 12. DataTable 无虚拟化

渲染所有行的受控 `<input>`，>1000 行 DOM 爆炸、严重卡顿。专业工具应支持 10 万行（虚拟滚动 + canvas 渲染）。

### 13. ChartView 仍 968 行

虽已加 `useMemo`，但仍是"上帝组件"，应拆分为：

- `tracesBuilder.ts` — trace 构建逻辑
- `layoutBuilder.ts` — layout 构建
- `AnnotationOverlay.tsx` — 独立组件
- `ChartView.tsx` — 仅协调渲染

### 14. 无 Web Worker

拟合、变换、大文件解析均阻塞 UI 主线程。

---

## 四、UI/UX 设计问题

### 15. CSS 变量与 Tailwind 双系统冲突

`tailwind.config.js` 设 `darkMode: "class"`，但 `index.css` 用 `[data-theme="dark"]`。**Tailwind 的 `dark:` 变体完全失效**，两套颜色系统并存且不同步。

### 16. 主题/语言不持久化

`uiStore.ts` 未写入 localStorage，刷新丢失用户偏好。

### 17. 浅色主题对比度不足

`--text-faint: #52525b` 在 `--bg-base: #1a1a2e` 上对比度约 3.3:1，**不满足 WCAG AA（4.5:1）**。浅色主题下 `--bg-input: #ffffff` 与 `--bg-surface: #ffffff` 相同，输入框无视觉区分。

### 18. Google Fonts CDN 外部依赖

`index.css:5` 从 Google CDN 加载字体，存在：隐私问题、FOUT（无样式文本闪烁）、离线不可用。应本地化字体。

### 19. 图层面板空间局促

`LayerPanel.tsx` `max-h-48 overflow-y-auto`（最大 192px），图层多时难以管理，应作为独立面板或可调整高度。

### 20. 状态栏信息过少

仅显示图表类型、数据集名、行数。科研用户需要：**鼠标坐标、选中范围、缩放级别、数据点数、内存占用**。

### 21. 无确认对话框

删除列、删除图层等破坏性操作无确认，误操作后虽可 undo，但 UX 不专业。

---

## 五、功能缺失（对比专业软件）

### 图表类型（10 种 vs 专业 50-100+）

缺失：箱线图、直方图（带分箱）、小提琴图、2D 热力图、三元图、瀑布图、QC 控制图、生存曲线、Bland-Altman、森林图、雷达图、3D 体素、矢量场等。

### 数据处理

缺失：FFT、平滑/滤波、峰值检测、基线扣除、去趋势、插值、重采样。

### 布局与模板

缺失：多面板布局、inset 图、图表模板保存/应用、脚本/批处理。

### 轴系统

缺失：日期/时间轴、轴 break（断轴）、镜像轴、双 X 轴、概率轴（Weibull/正态）、自定义刻度位置。

### 导入导出

缺失：TXT/DAT/JSON/MAT/HDF5 导入、拖拽导入、剪贴板粘贴、多 sheet、Excel 导出、EMF/WMF、动画导出、导出预览。

---

## 六、安全问题

| 问题 | 位置 | 风险 |
|------|------|------|
| Google AdSense | index.html | 隐私泄露、供应链风险 |
| `dangerouslySetInnerHTML` | ChartView.tsx | LaTeX sanitize 不完整则 XSS |
| SheetJS 已知漏洞 | package.json | CVE-2023-30533 |
| 无 CSP | index.html | 缺少内容安全策略 |
| 无 ErrorBoundary | App.tsx | 任何渲染错误白屏 |
| 项目文件无大小限制 | projectFile.ts | 大文件可卡死 |

---

## 七、改进优先级

### P0（阻断性 — 必须立即修复）

1. **移除 Google AdSense**
2. **修复依赖版本号**（当前 npm install 会失败）
3. **DataTable 按键历史问题**（debounce 或失焦记录）
4. **默认色图改 viridis**
5. **实现标注数据坐标模式**
6. **修复 Tailwind darkMode 配置**

### P1（重要 — 影响科研可用性）

7. 拟合增加调整 R²、参数标准误、残差图
8. PDF 导出改矢量（至少 2D）
9. EPS 从 UI 移除或实现真正 PS
10. DataTable 虚拟化
11. 主题/语言持久化
12. 添加 ErrorBoundary
13. 轴增加 unit 字段
14. 拆分 ChartView.tsx
15. 本地化字体

### P2（增强 — 提升竞争力）

16. 增加箱线图、直方图、热力图
17. 增加高斯/Logistic/自定义拟合
18. 增加数据处理（FFT/平滑/峰值检测）
19. 增加多面板布局
20. 增加 Web Worker
21. 增加日期/时间轴
22. 增加 X 误差棒

---

## 八、总体评价

Plot3D 架构清晰、UI 现代化，作为**轻量级 Web 数据可视化原型工具**是合格的。但作为**专业科研出版工具**，存在以下根本性差距：

1. **科学严谨性不足**：jet 默认色图、无调整 R²、无参数 CI、无残差图、轴无单位
2. **出版流程受阻**：EPS 造假、PDF 非矢量、TIFF 无压缩
3. **核心功能缺失**：标注数据坐标未实现、拟合类型极少、数据处理空白
4. **性能瓶颈**：DataTable 无虚拟化、每次按键记录历史、无 Worker
5. **工程隐患**：依赖版本虚标、AdSense 嵌入、无 ErrorBoundary、Tailwind 配置失效

建议先修复 P0 阻断性问题，再逐步补齐 P1 科研可用性，最后考虑 P2 竞争力增强。
