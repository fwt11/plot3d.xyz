# Plot3D 提升计划（修订版）

> 日期：2026-06-28
> 类型：路线图设计
> 状态：待用户审阅
> 前置文档：[docs/improvement-plan.md](./improvement-plan.md)（原始计划）、[docs/feature-analysis.md](./feature-analysis.md)（功能分析）、[docs/ui.md](./ui.md)（UI 问题清单）、[REVIEW.md](../REVIEW.md)（2026-06-21 旧评审，**已过期，详见 §0.1**）

---

## 0. 背景与定位

### 0.1 起点澄清：现有计划已大部分落地

代码审计（基于 commit `80172cf`，2026-06-28）确认：

- `docs/improvement-plan.md` 的**阶段一**（描述统计、箱线图/直方图、多峰拟合、拟合导出）—— **已落地**
  - `src/utils/statistics.ts`（695 行）、`hypothesisTests.ts`（626 行）、`distributions.ts`（277 行）
  - `tracesBuilder.ts` 已实现 `box` / `histogram` / `violin` / `heatmap` / `isosurface3d` / `volume3d`
  - `peakDetection.ts` / `multiPeakFit.ts` / `peakTypes.ts` / `MultiPeakFitModal` 均已存在
- **阶段二**（数据处理、误差棒增强、热力图）—— **已落地**
- **阶段三**（DataTable 双击编辑、查找替换、导出增强、图层排序）—— **已落地**
- **阶段四**（假设检验、相关性分析、回归诊断、期刊模板、批量处理、3D 增强）—— **已落地**（commit `41701d1`）
- `curveFitting.ts` 实际提供 **7 类拟合**（linear/poly2-6/exp/log/power/gaussian/logistic）+ 全套 SE/CI/调整 R²，已超出"阶段一 1.1 描述"的能力范围

**REVIEW.md（2026-06-21）的所有 P0/P1 问题**除 2 项外都已修复：
- ✅ DataTable 按键历史 → `onChange` 用 `updateCellValueSilent`，`onBlur` 才提交
- ✅ DataTable 虚拟化 → `VIRTUAL_THRESHOLD = 200`、`OVERSCAN = 5`
- ✅ 默认色图 jet → `chartStore.ts:28` 默认 `viridis`
- ✅ 标注数据坐标模式 → `AnnotationOverlay.tsx` 用 `_fullLayout` 读 axis range
- ✅ Tailwind darkMode → `tailwind.config.js:6` 数组配置
- ✅ 主题/语言持久化 → `uiStore.ts` localStorage
- ✅ ErrorBoundary → `ErrorBoundary.tsx`
- ✅ 轴 unit 字段 → `types.ts:30`
- ✅ EPS 造假 → 整个 UI 已移除
- ✅ PDF 非矢量 → `FileTab.tsx:282` 用 `addSvgAsImage` 嵌入 SVG

**仍未修复**（REVIEW.md 当时就列出的 P0）：
1. ❌ `index.html` 仍含 AdSense `<script>` + CSP allowlist `googlesyndication`
2. ❌ `package.json` 依赖版本虚标（`i18next ^26.3.1`、`katex ^0.17.0`、`plotly ^3.6.0`、`react-plotly.js ^4.0.0`、`xlsx` 来自第三方 CDN tarball）

### 0.2 战略定位（用户已确认）

- **目标定位**：科研绘图工具（纵深）—— 对标 Origin/Prism/Matplotlib
- **差异化基础**：Web 原生 + 3D 开箱即用 + 现代 UI + 开源 MIT
- **执行能力**：个人项目（每周约 20–30 小时）
- **整体节奏**：两者都要，渐进推进（拟合纵深 → 协作复现）

### 0.3 文档归档

- `REVIEW.md` → 重命名为 `REVIEW-2026-06-21.md`（保留历史决策记录）
- 本文档不替代 `docs/improvement-plan.md`，而是在其基础上**做现状盘点并指出后续阶段**

---

## 1. 设计原则

1. **P0 永远先做** —— AdSense + 依赖版本是地基，影响可信度与新机器可装性
2. **测试与功能并进** —— 涉及科学计算的 PR（拟合/统计/求解器）必带单测；这是 Phase 0 引入 vitest 的核心动机
3. **每阶段都有可演示成果** —— 不做"内部重构"型阶段；纯重构包裹在一个明确交付的功能里
4. **个人节奏** —— Phase 之间串行；每个 Phase 4–8 周 + 0.5 周缓冲
5. **不重复造轮子** —— 项目已有 `docs/improvement-plan.md`，本计划是其**接续与修订**

---

## 2. 现状基线（基于代码审计）

### 2.1 已具备的能力（高于常见 Web 工具）

| 能力 | 实现位置 | 评估 |
|------|---------|------|
| 7 类拟合 + 全套 SE/CI/调整 R² | `curveFitting.ts` 1048 行 + `fitWorker.ts` | **准专业级**（与 Origin 60% 对齐）|
| 4 种平滑（Savitzy-Golay / Whittaker / 滑动平均 / 一阶低通） | `dataProcessing.ts` | **专业级** |
| 4 种插值（线性 / Cubic / Akima / PCHIP） | `dataProcessing.ts` | **专业级** |
| IQR 异常值 + 多种缺失值策略 + 行过滤 | `dataProcessing.ts` | **专业级** |
| SD/SE/CI95 误差棒（按 X 分组统计） | `tracesBuilder.ts:90-106` | **专业级**（甚至优于 Origin 的 UI）|
| 14+ 种图表（line/scatter/bar/area/pie/polar/box/histogram/violin/heatmap + 6 种 3D） | `tracesBuilder.ts` | **充分** |
| Web Worker 拟合隔离 | `fitWorker.ts` + `fitWorkerClient.ts` | **正确** |
| 矢量 PDF/SVG 导出（`addSvgAsImage`） | `FileTab.tsx:282` | **正确**（优于多数 Web 工具）|
| 数据坐标标注（随缩放跟随） | `AnnotationOverlay.tsx` | **正确** |
| 双 Y 轴 | `chartConfig.yAxisRight` + `tracesBuilder` | **已实现** |
| LaTeX 标注 | `latex.ts` + KaTeX | **正确** |
| 深/浅色主题 + 中英双语 | `uiStore.ts` + i18next | **正确** |
| 撤销/重做（分支历史） | `historyStore.ts` | **正确**（MAX_HISTORY=50, MAX_BRANCHES=10）|

### 2.2 仍存在的缺陷

**P0（阻断性，影响可信度/可用性）**

| 缺陷 | 位置 | 风险 |
|------|------|------|
| AdSense 嵌入 | `index.html:9` | 隐私、性能、专业性质疑 |
| CSP allowlist 含 `googlesyndication` | `index.html:7` | 配合 AdSense |
| 依赖版本虚标 | `package.json` | `npm install` 在新机器失败 |
| `xlsx` 来自第三方 CDN tarball | `package.json` | 已知 CVE 风险 + CDN 不可控 |

**P1（影响工程质量和扩展性）**

| 缺陷 | 位置 | 影响 |
|------|------|------|
| `ChartView.tsx` 868 行 | `src/components/` | 改动一处牵动全身 |
| `LayerPanel.tsx` 909 行 | `src/components/` | 同上 |
| 零单元测试 | `src/` | 改公式可能算错统计量 |
| `REVIEW.md` 未更新 | 根目录 | 误导新贡献者 |

**P2（功能性差距，对标 Origin）**

| 缺失 | 对标工具 | 优先级 |
|------|---------|--------|
| 残差图（独立 subchart） | Origin/Prism 必备 | ⭐⭐⭐⭐⭐ |
| 95% 置信带 | Origin 标配 | ⭐⭐⭐⭐⭐ |
| 加权最小二乘（用 error 列） | Origin 标配 | ⭐⭐⭐⭐⭐ |
| 自定义公式拟合 | Prism 杀手锏 | ⭐⭐⭐⭐⭐ |
| 拟合公式 LaTeX 直接渲染到图上 | Origin 有 | ⭐⭐⭐⭐ |
| 多面板布局（subplot grid） | Origin 必备 | ⭐⭐⭐⭐ |
| 日期/时间轴 | 通用必备 | ⭐⭐⭐⭐ |
| 全局拟合（多 dataset 共享参数） | Origin 高级功能 | ⭐⭐⭐ |
| Matplotlib 脚本导出 | 复现性必备 | ⭐⭐⭐ |
| 论文模板内置 | Prism 必备 | ⭐⭐⭐ |
| 残差正态性 / Durbin-Watson 诊断 | Origin 标配 | ⭐⭐ |

---

## 3. 路线图（5 个 Phase，约 28 周）

### 总览

```
Phase 0 ── 地基         (1–2 周)    P0 + 测试基建
Phase 1 ── 拟合核心     (5–6 周)    残差图 / 置信带 / 加权 / 公式渲染
Phase 2 ── 工程瘦身     (3–4 周)    ChartView/LayerPanel 拆分 + 测试覆盖
Phase 3 ── 拟合宽度     (6–8 周)    自定义公式 + 新拟合类型 + 全局拟合
Phase 4 ── 轴与布局     (4–6 周)    日期轴 / 多面板 / 轴 break
Phase 5 ── 复现与协作   (4–6 周)    Matplotlib 脚本 + .plot3d v3 + 模板
```

每个 Phase 末尾产出：
- 该阶段所有"验收"全部满足
- `npm run check` + `npm run lint` + `npm run build` + `npm run test` 全绿
- 涉及科学计算的代码 ≥80% 单测覆盖（拟合/统计 100%）
- 一份 `PHASE-N.md` 记录实际工时、踩坑、未完成项

---

### Phase 0 — 地基（1–2 周）

**目标**：让 npm install 干净、index.html 干净、CI 能跑、地基有测。

| 任务 | 验收 | 工时 |
|------|------|------|
| 0.1 归档 `REVIEW.md` → `REVIEW-2026-06-21.md` | git 历史保留；README 顶部加超链接 | 0.5h |
| 0.2 移除 `index.html:9` AdSense `<script>` | `grep adsbygoogle` 无结果 | 0.5h |
| 0.3 移除 `index.html:7` CSP 中 `googlesyndication` allowlist | CSP 不含广告域名 | 0.5h |
| 0.4 修正 `package.json` 依赖版本到实际可用版本 | `npm install` 在新机器成功；`npm run build` 通过 | 4h |
| 0.5 `xlsx` 替换为 npm registry 上的稳定版本（如 `xlsx@0.18.5` + 后续 audit） | 移除 CDN tarball | 1h |
| 0.6 接入 `vitest` | `npm run test` 可跑；先给 `curveFitting.ts` / `statistics.ts` / `dataProcessing.ts` 跑 80% 覆盖率 | 8h |
| 0.7 写一份"代码地图"加到 `AGENTS.md`（标注哪些文件 >500 行、需拆） | 文档清晰 | 2h |

**风险与回滚**：
- 0.4 依赖修正可能触发连锁问题（API breaking）—— 建议先在 `package.json` 加注释 "Phase 0 实测"，再用 `npm ls` 验证依赖树
- 0.5 若 `xlsx` npm 版本功能不足，回退到 `exceljs` 或自实现最小子集

---

### Phase 1 — 拟合核心（5–6 周）

**目标**：让 Plot3D 的拟合从"够用"变成"论文可用"。这一组是科研 ROI 最高的功能。

| 任务 | 验收 | 工时 |
|------|------|------|
| 1.1 残差图（subchart：上图原数据 + 拟合，下图残差散点） | 拟合后弹 2 行 1 列 subchart；可分别开关；零线可见 | 1 周 |
| 1.2 95% 置信带（半透明带状区域叠在原图） | 带宽 = `t * SE(prediction)`；可关闭 | 1 周 |
| 1.3 加权最小二乘 | 已有 error 列时自动 `w = 1/σ²`；无 error 列退化为普通拟合；用户可手动指定列 | 1 周 |
| 1.4 拟合公式 LaTeX 渲染到图上（浮动、可拖拽、可关闭） | 用 KaTeX 渲染方程 + R² + n + p；右下角标注框 | 1 周 |
| 1.5 完整拟合报告页（点 fit 结果能展开） | 参数 SE/CI/调整 R²/F 检验/P 值/残差正态性 | 1 周 |
| 1.6 单元测试（解析解样本 + 种子可复现） | `curveFitting.ts` 100% 覆盖；CI 卡阈值 | 3 天 |

**用户场景**：做生物实验的研究者拿到 R² + 残差图 + 置信带 + 公式，符合任何期刊"图表必须可被验证"标准。

**关键设计决策**：
- 残差图用 Plotly 的 `subplots` API 实现 2 行 1 列，**不引入新组件**
- 置信带的实现：`SE(prediction) = s * sqrt(1 + 1/n + (x - x̄)²/Sxx)`，对线性；对多项式用 Jacobian 传播
- 加权拟合：复用现有 `linearFit` / `polynomialFit`，传入权重向量 `w`，最小化 `Σ w_i (y_i - ŷ_i)²`

---

### Phase 2 — 工程瘦身（3–4 周）

**目标**：把"上帝组件"和"零测试"的债还掉，让后续 Phase 改动有底气。

| 任务 | 验收 | 工时 |
|------|------|------|
| 2.1 拆分 ChartView（868 → <300） | 拆出 `TracesOverlay3D.tsx` / `ChartContextMenu.tsx` / `useChartInteractions.ts` hook | 1 周 |
| 2.2 拆分 LayerPanel（909 → <500） | "图层样式编辑"独立成 `LayerStyleEditor.tsx`；图层排序拖拽抽到 hook | 1 周 |
| 2.3 GitHub Actions CI（lint + typecheck + test + build） | PR 必跑四项；状态检查为合并前置 | 1 天 |
| 2.4 给 `tracesBuilder` / `layoutBuilder` / `dataProcessing` 补单测到 80% | 覆盖率报告 | 1 周 |
| 2.5 Plotly 包体优化（按图表类型懒加载） | 首屏 Plotly chunk 减半（具体数值看结果） | 3 天 |
| 2.6 写 `PHASE-2.md` 总结 | 工时、坑、未完成项 | 0.5 天 |

**风险**：
- 2.1 / 2.2 是大动作，可能踩到状态共享的坑。已有 `annotationToolStore` / `chartInteractionStore` 是参考模式，新 hook 沿用同款
- 2.5 Plotly 懒加载复杂度可能比预期高——若超过 3 天评估为不值得，**降级到"首屏不引入 3D module"**

---

### Phase 3 — 拟合宽度（6–8 周）

**目标**：从 7 类拟合扩到 12+，并支持用户自定义公式。这是"对标 Origin"的核心战役。

| 任务 | 验收 | 工时 |
|------|------|------|
| 3.1 **自定义公式拟合**（用 `mathjs`，已在 `package.json:^15.2.0`） | 用户输入 `a * exp(-b*x) + c`，自动识别参数；Levenberg-Marquardt 拟合；沙箱安全（拒绝 `import`/`fs`/`globalThis`） | 2 周 |
| 3.2 新增拟合类型：Lorentzian、Weibull、4PL/5PL Logistic、Hill、Doble-exponential | 7 → 12+ 类型 | 1.5 周 |
| 3.3 参数上下界 + 初始猜测 | 自定义公式可设 `a ∈ [0, 10]`；预设类型可改初值；非法值拦截 | 1 周 |
| 3.4 拟合残差正态性（Shapiro-Wilk）+ Durbin-Watson 自相关 | `FitStatistics` 加字段 + 报告展示 | 1 周 |
| 3.5 全局拟合（多 dataset 共享参数） | 选 2 个 dataset 共用 `k`，同时拟合；用 LM 统一求解 | 1 周 |
| 3.6 单元测试（每个新拟合类型至少 5 个解析解 case） | `curveFitting.ts` 100% 覆盖 | 1 周 |

**关键设计决策**：
- 3.1 安全沙箱：`mathjs.parse(expr).compile()` 拿到 AST 后，**白名单允许的函数**（`sin`、`cos`、`exp`、`log`、`sqrt`、`pow` 等），黑名单 `import` / `fs` / `globalThis` / `Function`
- 3.1 性能：单次拟合 evaluate 调用可能百万级，需避免 `mathjs.evaluate()` 的 parse 开销；用 `compiled.evaluate({ a, b, c, x })`
- 3.5 全局拟合：复用现有 LM 框架，参数向量拼接为 `[p_dataset1, p_dataset2, ...]`，残差拼接为 `[r1, r2, ...]`

**降级选项**：若 3.5 工期超 1 周，降级为 P3，移到 Phase 5 之后

---

### Phase 4 — 轴与布局（4–6 周）

**目标**：让图表能描述"时间序列"和"复杂版面"。

| 任务 | 验收 | 工时 |
|------|------|------|
| 4.1 日期/时间轴 | ISO 字符串、Unix 时间戳；自动选刻度（秒/分/时/日/月/年）；时区可选 | 1.5 周 |
| 4.2 轴 break（断轴） | 双斜线 break；两侧独立缩放 | 1 周 |
| 4.3 双 X 轴 / 镜像轴 | 一张图两条 X 轴（顶部 + 底部），独立标签 | 1 周 |
| 4.4 多面板布局（subplot grid） | 选 2×2 / 3×1 等；每个 panel 独立 dataset；panel 共享/独立坐标轴 | 2 周 |
| 4.5 Inset 图（小图嵌入大图） | 大图角落放放大区域；可拖动位置 | 0.5 周 |

**风险**：
- 4.4 多面板会和 Plotly 的 `subplots` 概念强耦合；可能需要把"图层"概念升级为"面板"，`chartConfig` schema 改动较大——**先做 4.1–4.3**，4.4 评估后再决定是否本阶段实施

---

### Phase 5 — 复现与协作（4–6 周，可选）

**目标**：从"个人工具"升级为"可分享、可复现的工具"。

| 任务 | 验收 | 工时 |
|------|------|------|
| 5.1 Matplotlib 脚本导出 | 一键导出 `.py`，生成与当前图等价的 matplotlib 代码（含拟合结果注释）；覆盖 5 种基础类型（line/scatter/bar/heatmap/surface） | 2 周 |
| 5.2 `.plot3d` 文件 v3 格式（Git 友好 diff） | 改为稳定排序 + 行化 JSON；dataset/图层 ID 稳定 | 1 周 |
| 5.3 论文模板内置（Nature / Science / Cell / PRL / ACS） | 选模板自动套用字号、配色、字体、线宽；预览即时更新 | 1 周 |
| 5.4 共享链接（URL 编码当前状态） | 短链 + 二维码；接收端打开即恢复（URL 长度上限 8KB，超出给提示） | 1 周 |

**不在范围内**：
- ❌ 模板市场（需要后端 + 审核 + 法务，纯前端项目不实施）

---

## 4. 风险与依赖

### 4.1 技术风险

| 风险 | 影响 | 应对 |
|------|------|------|
| Phase 3.1 `mathjs` 安全沙箱 | 任意表达式可能 XSS / DoS | AST 白名单 + evaluate 限速（每分钟 < 1000 次）+ 拒绝超长表达式 |
| Phase 4.4 多面板与"图层"概念冲突 | chartConfig schema 改动大 | 先做 spike（半天原型），再决定是否进 Phase 4 |
| Phase 5.1 Matplotlib 反向映射 | colorscale / annotation 映射坑多 | 仅支持 5 种基础类型；其他类型给提示"暂不支持导出脚本" |
| Phase 0.4 依赖修正 | API breaking | 在 package.json 注释标"待实测"；用 `npm ls` 验证依赖树；准备回滚 |

### 4.2 产品风险

- **Phase 3.1 自定义公式的实际使用率**：若 80% 用户只用 7 类内置，自定义公式可降级为 P3。**建议 Phase 3 开头先用一周收集遥测或调研**
- **Phase 5.3 期刊模板准确性**：模板参数（字号、边距）应来自各期刊的 Author Guidelines；建议先收集 3–5 个真实模板，其他用"通用论文模板"占位

---

## 5. 验收 / 节奏 / 下一步

### 5.1 每个 Phase 结束的固定标准

- 该 Phase 列出的"验收"全部满足
- 整体 `npm run check` + `npm run lint` + `npm run build` + `npm run test` 全绿
- 涉及科学计算的代码 ≥80% 单测覆盖（拟合 / 统计 100%）
- 一份 `PHASE-N.md` 记录：实际工时 vs 估计、踩到的坑、未完成项

### 5.2 节奏建议

- 每周固定 1 天做"代码卫生"（处理 TODO、依赖更新、issue 清理）
- 每个 Phase 末尾预留 0.5–1 周缓冲（经验上估计总会有 20% 延期）
- 大变更前先在 GitHub issue / discussion 写清动机和方案——避免 PR 阶段来回

### 5.3 立即可执行（不需等评审）

- 归档 `REVIEW.md` → `REVIEW-2026-06-21.md`
- 移除 AdSense + 修正 CSP

---

## 6. 下一步流程

按 superpowers 工作流，本设计文档完成后：

1. **Spec 评审循环**：派 `spec-document-reviewer` subagent 评审本文档 → 修复发现的问题 → 最多 5 轮
2. **用户评审**：将文档交给用户审阅，确认无修改后进入 writing-plans 阶段
3. **实现计划**：用 `superpowers:writing-plans` skill 把每个 Phase 拆为可执行步骤