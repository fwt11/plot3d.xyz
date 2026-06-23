# Plot3D 改进计划

> 基于 [feature-analysis.md](./feature-analysis.md) 的功能分析与优化建议，结合项目实际结构（React + Zustand + Plotly + Web Worker）制定的可执行改进路线图。

---

## 改进计划总览

按"价值密度（科研刚需 / 实现成本）"重排优先级，分四个阶段推进，每阶段产出可独立验证。

| 阶段 | 主题 | 优先级 | 核心目标 |
|------|------|--------|---------|
| 一 | 科研核心能力补齐 | P0 | 统计分析 + 多峰拟合 + 拟合导出 |
| 二 | 数据预处理与图表扩展 | P1 | 平滑插值 + 热力图 + 误差棒增强 |
| 三 | 交互效率提升 | P1-P2 | 数据编辑 + 快捷键 + 历史面板 |
| 四 | 高级统计与专业化 | P2-P3 | 假设检验 + 期刊模板 + 3D增强 |

---

## 阶段一：科研核心能力补齐（P0）

### 1.1 描述性统计模块

**目标**：提供科研数据分析基础的描述性统计功能。

**涉及文件**：
- 新增 `src/utils/statistics.ts` —— 统计计算纯函数
- 新增 `src/components/ribbon/StatsTab.tsx` —— 统计分析面板
- 新增 `src/components/StatsResultPanel.tsx` —— 结果展示

**功能清单**：
- 均值 (Mean)
- 标准差 (Standard Deviation, SD)
- 方差 (Variance)
- 中位数 (Median)
- 四分位数 (Quartiles, Q1/Q2/Q3)
- 偏度 (Skewness)
- 峰度 (Kurtosis)
- 范围 (Range, Min/Max)

**验收标准**：选择数据列后一键输出完整描述性统计表，支持导出 CSV。

---

### 1.2 箱线图 + 直方图

**目标**：补齐统计可视化必备图表类型。

**涉及文件**：
- [src/components/ribbon/chartTypes.tsx](../src/components/ribbon/chartTypes.tsx) —— 新增图表类型入口
- `src/utils/tracesBuilder.ts` —— 新增 trace 构建逻辑

**功能清单**：
- `box` —— 箱线图，支持分组、离群点显示
- `histogram` —— 直方图，支持分箱数量配置、归一化模式

**验收标准**：能从数据表直接生成箱线图与直方图，样式可配置。

---

### 1.3 多峰拟合

**目标**：满足材料科学核心需求（XRD / Raman / IR / XPS / PL 光谱分析）。

**涉及文件**：
- 新增 `src/utils/peakDetection.ts` —— 峰识别算法
- 新增 `src/utils/multiPeakFit.ts` —— 多峰拟合
- 新增 `src/utils/peakTypes.ts` —— 峰型定义与类型
- 新增 `src/components/MultiPeakFitModal.tsx` —— 多峰拟合对话框
- 扩展 `src/workers/fitWorker.ts` —— 后台计算

**功能清单**：
- 峰自动识别与定位
- 峰型拟合：Gaussian、Lorentzian、Pseudo-Voigt、Voigt
- 背景扣除：线性 / 多项式背景拟合
- 峰参数导出：位置、高度、宽度、面积
- 峰面积积分

**验收标准**：对 XRD/光谱样例数据完成"导入 → 多峰拟合 → 参数导出"全流程。

**实施策略**：先实现单峰 Gaussian + 手动添加峰，再迭代自动识别与多峰型支持。

---

### 1.4 拟合结果导出

**目标**：解决拟合参数仅界面显示、无法导出的痛点。

**涉及文件**：
- [src/components/ribbon/FitTab.tsx](../src/components/ribbon/FitTab.tsx)

**功能清单**：
- 导出拟合参数到 CSV/Excel
- 生成拟合报告（含方程、参数表、统计量）
- 拟合结果复制到剪贴板
- LaTeX 格式方程导出

**验收标准**：拟合完成后可一键导出完整报告，支持论文撰写直接使用。

---

## 阶段二：数据预处理与图表扩展（P1）

### 2.1 数据平滑 / 插值

**目标**：补齐数据预处理必备工具。

**涉及文件**：
- 新增 `src/utils/dataProcessing.ts`
- 接入 [src/components/ribbon/TransformTab.tsx](../src/components/ribbon/TransformTab.tsx)

**功能清单**：
- Savitzky-Golay 滤波
- 移动平均 (Moving Average)
- 低通滤波
- Whittaker 平滑
- 线性插值 / Cubic Spline / Akima / PCHIP 插值

---

### 2.2 数据筛选 / 缺失值 / 异常值

**目标**：提供数据清洗能力。

**涉及文件**：
- `src/utils/dataProcessing.ts`
- [src/components/DataTable.tsx](../src/components/DataTable.tsx) 右键菜单扩展

**功能清单**：
- 条件筛选（大于 / 小于 / 范围）
- 缺失值处理（删除 / 插值 / 均值填充）
- 异常值检测与处理（IQR 法）

---

### 2.3 热力图

**目标**：补齐相图 / 相关性矩阵 / 温度分布可视化。

**涉及文件**：
- [src/components/ribbon/chartTypes.tsx](../src/components/ribbon/chartTypes.tsx)
- `src/utils/tracesBuilder.ts`

**功能清单**：
- 新增 `heatmap` 图表类型
- 支持颜色映射配置
- 支持坐标轴标签

---

### 2.4 误差棒增强

**目标**：完善误差棒功能，区分 SD/SE/CI。

**涉及文件**：
- [src/components/LayerPanel.tsx](../src/components/LayerPanel.tsx)
- `src/utils/tracesBuilder.ts`

**功能清单**：
- 置信区间误差棒（95% CI 自动计算）
- 标准误差棒（SE vs SD 区分显示）
- 不对称误差棒
- 误差棒统计计算（从原始数据自动计算 SE/SD/CI）
- 误差棒样式（caps 样式、宽度配置）

**类型定义建议**：
```typescript
interface ErrorBarConfig {
  type: 'sd' | 'se' | 'ci95' | 'custom';
  capWidth: number;
  capStyle: 'line' | 'bracket';
  showCap: boolean;
  asymmetric: boolean;
}
```

---

### 2.5 变换预览 + 目标列选择

**目标**：提升数据变换的灵活性与安全性。

**涉及文件**：
- [src/components/ribbon/TransformTab.tsx](../src/components/ribbon/TransformTab.tsx)

**功能清单**：
- 变换前预览曲线
- 选择变换作用列
- 多种归一化方法（Min-Max、Z-score、Log）
- 逆变换按钮（如 exp → ln）

---

## 阶段三：交互效率提升（P1-P2）

### 3.1 DataTable 双击编辑 + 验证

**涉及文件**：[src/components/DataTable.tsx](../src/components/DataTable.tsx)

**功能清单**：
- 双击单元格直接编辑，Enter 确认
- 数值列验证输入，非法值高亮提示
- Tab/Shift+Tab 切换列，↑↓ 切换行
- 可拖拽列宽调整

---

### 3.2 查找替换 + 批量填充

**涉及文件**：[src/components/DataTable.tsx](../src/components/DataTable.tsx)

**功能清单**：
- Ctrl+F 打开查找对话框，支持替换
- 多选功能（Ctrl/Shift 多选），批量删除/填充
- 条件格式化

---

### 3.3 导出增强

**涉及文件**：[src/components/ribbon/FileTab.tsx](../src/components/ribbon/FileTab.tsx)

**功能清单**：
- 自定义文件名（默认使用图表标题）
- 自定义尺寸（宽度 × 高度）
- 自定义 DPI 输入（如 600/1200 DPI）
- 批量导出多图表
- 导出预览
- PDF 页面尺寸自定义

---

### 3.4 图层排序 + 样式预设

**涉及文件**：[src/components/LayerPanel.tsx](../src/components/LayerPanel.tsx)

**功能清单**：
- 拖拽排序，控制绘制顺序
- displayName 编辑
- 样式模板快速应用
- 右键菜单扩展（移至顶层/底层、锁定图层）
- 图层搜索/筛选

---

### 3.5 快捷工具栏 + 快捷键

**涉及文件**：
- [src/components/Ribbon.tsx](../src/components/Ribbon.tsx)
- `src/App.tsx`

**功能清单**：
- 顶部快捷工具栏（导出、拟合、变换等常用功能）
- 智能记忆用户最后使用的 Tab
- Ribbon 双击 Tab 标题折叠/展开
- 所有按钮添加图标

**快捷键映射**：

| 功能 | 快捷键 |
|------|--------|
| 导入数据 | Ctrl+O |
| 导出 PNG | Ctrl+E |
| 新建图层 | Ctrl+L |
| 查找替换 | Ctrl+F |
| 放大图表 | Ctrl++ |
| 缩小图表 | Ctrl+- |
| 重置视图 | Ctrl+0 |
| 切换图表类型 | Ctrl+1~9 |
| 快速拟合 | Ctrl+F1~F11 |
| 全选数据 | Ctrl+A |
| 删除选中 | Delete |

---

### 3.6 历史面板

**涉及文件**：
- [src/store/historyStore.ts](../src/store/historyStore.ts)
- 新增 `src/components/HistoryPanel.tsx`

**功能清单**：
- 操作列表显示
- 操作描述（如"修改标题"、"添加图层"）
- 分支概念，支持非线性历史
- 细化撤销粒度

---

## 阶段四：高级统计与专业化（P2-P3）

### 4.1 假设检验模块

**涉及文件**：
- 新增 `src/utils/hypothesisTests.ts`
- 新增 `src/utils/distributions.ts`
- 扩展 `src/components/ribbon/StatsTab.tsx`

**功能清单**：
- t 检验：单样本、双样本、配对样本
- ANOVA：单因素、多因素
- 非参数检验：Mann-Whitney U、Wilcoxon signed-rank、Kruskal-Wallis
- 正态性检验：Shapiro-Wilk、Kolmogorov-Smirnov
- Q-Q 图绘制

**实施建议**：参考 `scipy.stats` 实现，补充单元测试确保统计正确性。

---

### 4.2 相关性分析

**涉及文件**：
- `src/utils/statistics.ts`
- `src/components/ribbon/StatsTab.tsx`

**功能清单**：
- Pearson 相关系数
- Spearman 秩相关
- Kendall 相关
- p 值计算
- 相关性矩阵热力图可视化

---

### 4.3 回归诊断

**涉及文件**：
- `src/utils/statistics.ts`
- [src/components/ribbon/FitTab.tsx](../src/components/ribbon/FitTab.tsx)

**功能清单**：
- Durbin-Watson 检验（自相关）
- Breusch-Pagan 检验（异方差）
- VIF 计算（多重共线性）
- 残差正态性检验

---

### 4.4 期刊模板系统

**涉及文件**：
- 新增 `src/utils/journalTemplates.ts`
- 新增 `src/components/TemplatePanel.tsx`

**功能清单**：
- 期刊风格预设：Nature、Science、Angewandte Chemie、ACS、Elsevier
- 图表尺寸预设（单栏 3.5 英寸、双栏 7 英寸等）
- 自定义模板保存
- 批量应用图表样式

---

### 4.5 双 Y 轴完整实现

**涉及文件**：
- [src/store/plotStore.ts](../src/store/plotStore.ts)
- `src/utils/layoutBuilder.ts`
- [src/components/LayerPanel.tsx](../src/components/LayerPanel.tsx)

**功能清单**：
- `yAxisSide` 字段可视化生效
- 双 Y 轴图表渲染
- 轴标签位置调整

---

### 4.6 批量处理

**涉及文件**：
- [src/components/ribbon/FileTab.tsx](../src/components/ribbon/FileTab.tsx)
- `src/components/ribbon/StatsTab.tsx`

**功能清单**：
- 多文件同时导入 / 文件夹批量导入
- 批量拟合：对多组数据自动执行相同拟合
- 批量统计：多数据集统计汇总
- 批量变换：统一数据变换操作
- 数据合并：多数据集拼接（行/列）、数据对齐

---

### 4.7 3D 增强

**涉及文件**：
- `src/utils/tracesBuilder.ts`
- [src/components/ribbon/chartTypes.tsx](../src/components/ribbon/chartTypes.tsx)

**功能清单**：
- 等值面绘制 (Isosurface)
- 3D 切片视图 (Slice view)
- 体积渲染 (Volume rendering)
- 3D 等高线标签
- 3D 光照效果

**风险提示**：受 Plotly 能力限制，可能需引入 Three.js 或接受性能折中，建议最后评估。

---

## 其他缺失图表类型（按需补充）

| 图表类型 | 用途 | 阶段建议 |
|----------|------|---------|
| 小提琴图 (Violin Plot) | 分布密度 + 统计信息 | 阶段四 |
| 瀑布图 (Waterfall) | 光谱对比分析 | 阶段二 |
| 向量场图 (Vector Field) | 晶体取向、应力分布 | 阶段四 |
| 误差带图 (Error Band) | 不确定性可视化 | 阶段二 |
| 阶梯图 (Step Plot) | 离散数据 | 阶段三 |
| 茎叶图 (Stem Plot) | 离散信号 | 阶段三 |

---

## 架构与工程约定

### 1. 计算与 UI 分离
所有统计算法放 `src/utils/`，纯函数 + 可单测；UI 仅负责调用与展示。

### 2. Web Worker 扩展
多峰拟合、批量拟合、FFT 等耗时计算复用 [fitWorker.ts](../src/workers/fitWorker.ts) 模式，避免阻塞主线程。

### 3. 类型先行
在 [src/types.ts](../src/types.ts) 扩展 `ChartType`、`ErrorBarConfig`、`PeakFitResult`、`StatsResult` 等类型，再改 store 与 builder。

### 4. Store 扩展
- [datasetStore.ts](../src/store/datasetStore.ts) 增加数据预处理方法
- [plotStore.ts](../src/store/plotStore.ts) 增加多峰拟合结果图层
- [historyStore.ts](../src/store/historyStore.ts) 增加操作描述字段

### 5. i18n 同步
每个新功能的中英文案同步加入 [zh.json](../src/i18n/zh.json) / [en.json](../src/i18n/en.json)。

### 6. 依赖增量策略
- 统计分析建议引入 `simple-statistics`（轻量纯函数）或自实现关键算法
- FFT 可用 `fft.js`
- 避免引入完整科学计算栈

### 7. 项目文件兼容
[projectFile.ts](../src/utils/projectFile.ts) 版本号递增，向后兼容旧 `.plot3d` 文件。

---

## 建议执行顺序

```
阶段一（1.1 → 1.2 → 1.4 → 1.3）
   统计/箱线图/导出先行，多峰拟合最重放最后
   ↓
阶段二（2.1 → 2.2 → 2.5 → 2.4 → 2.3）
   ↓
阶段三（3.1 → 3.5 → 3.3 → 3.2 → 3.4 → 3.6）
   交互改进可并行
   ↓
阶段四（4.1 → 4.2 → 4.3 → 4.5 → 4.4 → 4.6 → 4.7）
```

---

## 风险与权衡

| 风险项 | 影响 | 应对策略 |
|--------|------|---------|
| 多峰拟合技术难度高 | 峰识别 + 非线性最小二乘 + 背景拟合 | 先单峰 Gaussian + 手动添加峰，再迭代自动识别 |
| 3D 体积渲染/等值面 | Plotly 能力受限 | 评估 Three.js 引入或接受性能折中，放最后 |
| 假设检验统计正确性 | 计算结果需可信 | 参考 `scipy.stats` 实现，补充单元测试 |
| 项目文件向后兼容 | 旧文件无法加载 | 版本号递增 + 兼容层处理 |
| 依赖体积膨胀 | 影响加载性能 | 优先纯函数自实现，按需引入轻量库 |

---

## 界面设计原则

1. **一致性原则**：按钮样式、颜色（主色/强调色/警告色）、图标风格统一
2. **可发现性原则**：重要功能不应隐藏超过 2 层，添加 Tooltip 与新功能引导
3. **效率原则**：常用功能支持快捷键、批量操作、模板/预设
4. **容错原则**：危险操作前确认，操作可撤销，输入验证
5. **反馈原则**：操作即时反馈，进度显示，错误提示清晰

---

## 总结

本计划以科研用户刚需为驱动，优先补齐统计分析、多峰拟合、数据预处理等核心能力，再逐步提升交互效率与专业化程度。每阶段产出可独立验证，建议从 **阶段一的 1.1（描述性统计模块）+ 1.2（箱线图/直方图）** 起步，快速验证整体架构后推进多峰拟合等重型功能。
