# Plot3D 提升计划（修订版）

> 日期：2026-06-28
> 类型：路线图设计
> 状态：待用户审阅
> 前置文档：[docs/improvement-plan.md](./improvement-plan.md)（原始计划）、[docs/feature-analysis.md](./feature-analysis.md)（功能分析）、[docs/ui.md](./ui.md)（UI 问题清单）、[REVIEW-2026-06-21.md](../REVIEW-2026-06-21.md)（2026-06-21 旧评审，**已过期，详见 §0.1**）

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
- `curveFitting.ts` 实际提供 **11 类拟合**（linear + poly2-6 + exponential/logarithmic/power/gaussian/logistic）+ 全套 SE/CI/调整 R²，已超出"阶段一 1.1 描述"的能力范围

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
2. ❌ `xlsx` 来自第三方 CDN tarball（已知 CVE 风险 + CDN 不可控）

> 注：REVIEW.md 还提到"`i18next ^26.3.1`、`katex ^0.17.0`、`plotly ^3.6.0`、`react-plotly.js ^4.0.0` 依赖版本虚标"。**经 node_modules 验证（commit `80172cf`），这五个版本在 npm registry 上都是真实存在并已安装到 `node_modules`**。它们不再是 P0。

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
4. **个人节奏** —— Phase 之间串行；每个 Phase 1–9 周（绝大多数 4–8 周）+ 0.5–1 周缓冲
5. **不重复造轮子** —— 项目已有 `docs/improvement-plan.md`，本计划是其**接续与修订**

---

## 2. 现状基线（基于代码审计）

### 2.1 已具备的能力（高于常见 Web 工具）

| 能力 | 实现位置 | 评估 |
|------|---------|------|
| 11 类拟合 + 全套 SE/CI/调整 R² | `curveFitting.ts` 1048 行 + `fitWorker.ts` | **准专业级**（与 Origin 60% 对齐）|
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
| 11 → 16+ 拟合类型 | Origin 200+ | ⭐⭐⭐ |

---

## 3. 路线图（5 个 Phase，~32 周核心 + ~6 周缓冲）

### 总览

```
Phase 0 ── 地基         (1–2 周)    P0 + 测试基建
Phase 1 ── 拟合核心     (5–6 周)    残差图 / 置信带 / 加权 / 公式渲染
Phase 2 ── 工程瘦身     (3–4 周)    ChartView/LayerPanel 拆分 + 测试覆盖
Phase 3 ── 拟合宽度     (6–8 周)    自定义公式 + 新拟合类型 + 全局拟合
Phase 4 ── 轴与布局     (4–6 周)    日期轴 / 多面板 / 轴 break
Phase 5 ── 复现与协作   (6–9 周)    Matplotlib 脚本 + .plot3d v3 + 模板
```

> **工期说明**：Phase 范围取上限（2+6+4+8+6+9 = 35 周）。每个 Phase 末尾预留 0.5–1 周缓冲（合计 ~5 周）。合计约 35 + 5 = 40 周；按经验再叠加 0–10% 延期缓冲，**整体时间预算 ~38–44 周（约 9–10 个月）**。下文用 "~38 周" 作为中位估计；用户按 44 周做日历规划更稳妥。

每个 Phase 末尾产出：
- 该阶段所有"验收"全部满足
- `npm run check` + `npm run lint` + `npm run build` + `npm run test` 全绿
- 涉及科学计算的代码 ≥95% branch coverage（详见 §5.1）
- 一份 `PHASE-N.md` 记录实际工时、踩坑、未完成项

---

### Phase 0 — 地基（1–2 周）

**目标**：让 npm install 干净、index.html 干净、CI 能跑、地基有测。

| 任务 | 验收 | 工时 |
|------|------|------|
| 0.1 归档 `REVIEW.md` → `REVIEW-2026-06-21.md` | git 历史保留；README 顶部加超链接 | 0.5h |
| 0.2 移除 `index.html:9` AdSense `<script>` | `grep adsbygoogle` 无结果 | 0.5h |
| 0.3 移除 `index.html:7` CSP 中 `googlesyndication` allowlist | CSP 不含广告域名 | 0.5h |
| 0.4 `xlsx` 替换为 npm registry 上的稳定版本（如 `xlsx@^0.18.5`） | 移除 CDN tarball；`npm audit` 无 high/critical；CSV 导入测试通过 | 1h |
| 0.5 接入 `vitest` | `npm run test` 可跑；先给 `curveFitting.ts` / `statistics.ts` / `dataProcessing.ts` 跑 ≥95% branch coverage（详见 §5.1） | 8h |
| 0.6 写一份"代码地图"加到 `AGENTS.md` | `test -f AGENTS.md && grep -c 'src/' AGENTS.md ≥ 10`；含目录树 + >500 行文件清单 + >800 行"待拆"标记 | 2h |
| 0.7 CI 跑通 | `npm run check` + `npm run lint` + `npm run build` + `npm run test` 全绿 | 0.5h |

**风险与回滚**：
- 0.4 若 `xlsx` npm 版本功能不足，回退到 `exceljs` 或自实现最小子集
- 0.5 接入 vitest 时若发现现有 `curveFitting.ts` 有隐藏 bug（比如边界条件未处理），先记录 issue 再修，不在本阶段拖延

---

### Phase 1 — 拟合核心（5–6 周）

**目标**：让 Plot3D 的拟合从"够用"变成"论文可用"。这一组是科研 ROI 最高的功能。

| 任务 | 验收 | 工时 |
|------|------|------|
| 1.1 残差图（subchart：上图原数据 + 拟合，下图残差散点） | 见 §3.1.1 子设计 | 1 周 |
| 1.2 95% 置信带（半透明带状区域叠在原图） | 见 §3.1.2 子设计 | 1 周 |
| 1.3 加权最小二乘 | 已有 error 列时自动 `w = 1/σ²`；无 error 列退化为普通拟合；用户可手动指定列；前置依赖见 §3.1.3 | 1 周 |
| 1.4 拟合公式 LaTeX 渲染到图上（浮动、可拖拽、可关闭） | 复用 `AnnotationOverlay.tsx` 的标注基础设施；新增 `Annotation` 类型 `fitEquation`（见 §3.1.4） | 1 周 |
| 1.5 完整拟合报告页（点 fit 结果能展开） | 参数 SE/CI/调整 R²/F 检验/P 值/残差正态性 | 1 周 |
| 1.6 单元测试（解析解样本 + 种子可复现） | `curveFitting.ts` branch coverage ≥ 95%；CI 阈值见 §5.1 | 3 天 |

**用户场景**：做生物实验的研究者拿到 R² + 残差图 + 置信带 + 公式，符合任何期刊"图表必须可被验证"标准。

#### 3.1.1 Phase 1.1 子设计（残差图）

- **chartConfig schema**：扩展 `chartConfig.fitDisplay`，新增 `subplots?: { residual: boolean }`；不引入"面板"概念（与 Phase 4 隔离）
- **残差 trace 类型**：复用现有 layer 数据，新增 `layer.fitRole?: 'data' | 'residual'`；拟合时自动生成一个隐藏 layer 承载残差点
- **layout 构造**：`layoutBuilder.ts` 增加 `buildLayoutWithResidual()` 分支，输出 Plotly `subplots` 配置（rows=2, cols=1, shared_xaxes=true, vertical_spacing=0.05）
- **缩放同步**：依靠 Plotly 的 `xaxis: '.xaxis'` shared axis 机制（上层缩放下层自动跟随）；不需要事件总线
- **历史**：historyStore 增加 `subplot_toggle_residual` 描述
- **零引入新顶层组件**：改动集中于 `chartStore.ts` / `layoutBuilder.ts` / `tracesBuilder.ts`

#### 3.1.2 Phase 1.2 子设计（置信带）

- **v1 范围**：置信带支持 `linear` 与 `polynomial`（degree 2–6）
  - 线性：`SE(prediction) = s * sqrt(1/n + (x - x̄)² / Sxx)`（注：用户已看过绘图，不乘 `(1+)`，避免视觉过宽）
  - 多项式：用协方差矩阵传播 `SE(prediction) = sqrt(x_pᵀ (XᵀX)⁻¹ x_p) * s`，其中 `x_p = [1, x, x², ..., xᵈ]ᵀ`
- **v2 范围（若时间允许）**：非线性拟合（exp/log/power/gaussian/logistic）通过 delta-method Jacobian 传播
- **若 v2 不在 1 周内完成**：降级到 Phase 3 与新拟合类型一起做（Gauss 拟合是科研最常用，置信带缺失会显著降低"论文可用"程度；建议 v1 至少包含 gaussian）
- **用户开关**：每条拟合曲线一个 toggle `showConfidenceBand: boolean`，默认 on

#### 3.1.3 Phase 1.3 前置依赖（加权最小二乘）

- 当前 `types.ts` 列类型只含 `X / Y / Z / label / error / errorPlus / errorMinus`；已有 `error` 等类型
- **前置补全**：在 `types.ts` 已有 `error` 类型上，明确每条 layer 可绑定一个 `errorColumn: string`
- **DataTable.tsx**：列类型选择器已包含 `error`（DataTable.tsx:339-347），无需 UI 改动
- **LayerPanel / ConfigPanel**：增加"误差列选择"下拉，列出来自同一 dataset 的 error 类型列
- **fitWorkerClient**：拟合请求增加 `weights?: number[]` 字段；缺失时权重全 1
- **curveFitting**：所有 11 类拟合增加可选 `weights` 参数，内部用 `Σ w_i (y_i - ŷ_i)²`

#### 3.1.4 Phase 1.4 子设计（LaTeX 公式渲染）

- **复用**：直接使用现有 `AnnotationOverlay.tsx` + `latex.ts` + KaTeX 路径，不写第二份 LaTeX 渲染
- **新增类型**：`Annotation` union 增加 `type: 'fitEquation'`，承载 `{ equation: string; r2?: number; n?: number; chi2?: number }`
- **位置**：默认渲染在图表右上方（`inside-top-right`），用户可拖拽（沿用现有标注拖拽逻辑）
- **样式**：与文本标注一致（KaTeX HTML + 主题色），不引入新 CSS

---

### Phase 2 — 工程瘦身（3–4 周）

**目标**：把"上帝组件"和"零测试"的债还掉，让后续 Phase 改动有底气。

| 任务 | 验收 | 工时 |
|------|------|------|
| 2.1 拆分 ChartView（868 → <300） | 拆出 `TracesOverlay3D.tsx` / `ChartContextMenu.tsx` / `useChartInteractions.ts` hook | 1 周 |
| 2.2 拆分 LayerPanel（909 → <500） | "图层样式编辑"独立成 `LayerStyleEditor.tsx`；图层排序拖拽抽到 hook | 1 周 |
| 2.3 GitHub Actions CI（lint + typecheck + test + build） | PR 必跑四项；状态检查为合并前置 | 1 天 |
| 2.4 给 `tracesBuilder` / `layoutBuilder` 补单测 | 按 §5.1 三档覆盖度（Tier B / C），不是统一 80% | 1 周 |
| 2.5 Plotly 包体优化（按图表类型懒加载） | 验收二选一（满足任一即可）：(a) dynamic-import per trace type 让首屏 Plotly chunk < 1.5MB（`vite build --report` 验证）；或 (b) 兜底：首屏只注册 Plotly basic-2D traces，3D traces 在用户首次打开 3D 图表时按需加载。两条路都 shippable，不指定具体减半数字。 | 3 天 |
| 2.6 写 `PHASE-2.md` 总结 | 工时、坑、未完成项 | 0.5 天 |

**风险**：
- 2.1 / 2.2 是大动作，可能踩到状态共享的坑。已有 `annotationToolStore` / `chartInteractionStore` 是参考模式，新 hook 沿用同款
- 2.5 Plotly 懒加载复杂度可能比预期高——若超过 3 天评估为不值得，**降级到"首屏不引入 3D module"**

---

### Phase 3 — 拟合宽度（6–8 周）

**目标**：从 11 类拟合扩到 16+，并支持用户自定义公式。这是"对标 Origin"的核心战役。

| 任务 | 验收 | 工时 |
|------|------|------|
| 3.1 **自定义公式拟合**（用 `mathjs`，已在 `package.json:^15.2.0`） | 见 §3.3.1 子设计 | 2 周 |
| 3.2 新增拟合类型：Lorentzian、Weibull、4PL/5PL Logistic、Hill、Bi-exponential | 11 → 16+ 类型；详见 §3.3.2 计数说明 | 1.5 周 |
| 3.3 参数上下界 + 初始猜测 | 自定义公式可设 `a ∈ [0, 10]`；预设类型可改初值；非法值拦截 | 1 周 |
| 3.4 拟合残差诊断接入（**复用现有实现**） | 把 `hypothesisTests.ts` 已有的 `shapiroWilk` / `durbinWatson` 接入 `FitResult.stats` 与报告页（§3.3.3） | 3 天 |
| 3.5 全局拟合（多 dataset 共享参数） | 见 §3.3.4 子设计 | 1.5 周 |
| 3.6 单元测试（每个新拟合类型至少 5 个解析解 case） | 新拟合类型 ≥95% branch coverage；命名解析解 fixture（不靠随机 property test） | 1 周 |

#### 3.3.1 Phase 3.1 子设计（自定义公式）

- **公式解析**：用 `mathjs.parse(formula).compile()` 编译为闭包；求值 `compiled.evaluate({ x, ...params })`
- **参数自动发现**：正则 `/\b[a-zA-Z_]\w*\b/g` 提取所有标识符；排除 `x`、`e`、`pi`、`PI`、`inf`、`Inf`、`nan`、`NaN`、`sin`、`cos`、`tan`、`exp`、`log`、`ln`、`sqrt`、`abs`、`pow`、`min`、`max` 等内置常量与函数
- **导数策略**：v1 用中心差分 `df/dθ ≈ (f(θ+h) - f(θ-h)) / (2h)`，h = 1e-5；不依赖 `mathjs.derivative()`（符号导数会暴露 AST 大小失控）
- **优化器**：从 `multiPeakFit.ts:189` 的 Gauss-Newton + Levenberg-Marquardt 阻尼抽离为 `src/utils/levenbergMarquardt.ts`，签名 `lm(residualFn, initialGuess, options): { params, residuals, cov }`
- **协方差矩阵**：`(Jᵀ J)⁻¹ * s²`，复用 `curveFitting.ts` 现有的 `qrDecompose` / `inverseUpperTriangular`
- **安全沙箱**：
  - 拒绝表达式：AST depth > 50、字符数 > 500
  - 拒绝关键字：`import`、`require`、`Function`、`globalThis`、`process`、`window`、`document`、`eval`、`fetch`、`XMLHttpRequest`
  - 单次求值超时 5 秒（web worker 超时即终止）
  - 不做"每分钟限 N 次"——mathjs evaluate 在小表达式下 ~1µs，限速数字会给人虚假安全感
- **失败模式**：解析失败、参数推断失败、优化不收敛——三种失败都返回结构化错误（带原因 + 建议），不抛异常

#### 3.3.2 Phase 3.2 计数说明

- 现有 11 类：`linear`、`poly2`、`poly3`、`poly4`、`poly5`、`poly6`、`exponential`、`logarithmic`、`power`、`gaussian`、`logistic`
- 现有 `logistic` 是 3 参数简化形式 `L/(1+exp(-k(x-x0)))`
- Phase 3.2 新增 5 类：
  - `lorentzian`：`y = A * σ² / ((x - x₀)² + σ²)`
  - `weibull`：`y = A * (1 - exp(-(x/λ)^k))`
  - `logistic4pl`：`y = d + (a - d) / (1 + (x/c)^b)`（4 参数，保留旧 `logistic` 作为别名）
  - `logistic5pl`：4PL 加不对称参数 g
  - `hill`：`y = Vmax * x^n / (K^n + x^n)`
- Phase 3.2 还新增 `biexponential`：`y = a*exp(-b*x) + c*exp(-d*x)`（4 参数），独立于已有单 `exponential`
- 总计：11 → 16，匹配 "11 → 16+ types"

#### 3.3.3 Phase 3.4 复用说明

- `src/utils/hypothesisTests.ts` 已实现 Shapiro-Wilk 与 Durbin-Watson（grep 验证）
- Phase 3.4 不写新算法，只扩展 `FitStatistics` 接口加 `residualNormality?: TestResult` 与 `residualAutocorrelation?: { dw: number }`
- 在拟合工作流中调用现成函数并填充字段
- 报告页（Phase 1.5 已落地）显示这两项

#### 3.3.4 Phase 3.5 子设计（全局拟合）

- **入口**：FitTab 加 "Global Fit" 按钮 → 弹窗选多个 dataset、选共享参数子集
- **数学**：参数向量拼接 `[p_local1, p_local2, ..., p_shared]`，残差向量拼接 `[r1, r2, ...]`，复用 §3.3.1 抽离的 LM 求解器
- **风险与降级**：若 LM 在多 dataset 上不收敛、或者共享参数识别 UI 复杂度过高，把全局拟合降级为 P3，挪到 Phase 5 之后；不在 Phase 3 内拖延
- **验收**：2 个 dataset 共享 1 个参数（如 `k`），拟合结果与 scipy `scipy.optimize.least_squares` 对比误差 < 1e-6

---

### Phase 4 — 轴与布局（4–6 周）

**目标**：让图表能描述"时间序列"和"复杂版面"。

| 任务 | 验收 | 工时 |
|------|------|------|
| 4.1 日期/时间轴 | ISO 字符串、Unix 时间戳；自动选刻度（秒/分/时/日/月/年）；时区存储在 `chartConfig.xAxis.timezone`，默认 `UTC`，非 UTC 时在轴标题标注；拟合报告的"轴信息"区显示当前时区 | 1.5 周 |
| 4.2 轴 break（断轴） | 双斜线 break；两侧独立缩放 | 1 周 |
| 4.3 双 X 轴 / 镜像轴 | 一张图两条 X 轴（顶部 + 底部），独立标签 | 1 周 |
| 4.4 多面板布局（subplot grid） | 选 2×2 / 3×1 等；每个 panel 独立 dataset；panel 共享/独立坐标轴；**前置条件**：Phase 4 开头做半天 spike（原型验证 chartConfig migration cost < 1 周），spike 失败则**本任务降级为 P3 移出 Phase 4** | 2 周（条件性） |
| 4.5 Inset 图（小图嵌入大图） | v1 范围：矩形、固定四角位置（TL/TR/BL/BR），不实现拖拽与碰撞检测 | 1 周 |

**风险**：
- 4.4 多面板会和 Plotly 的 `subplots` 概念强耦合；可能需要把"图层"概念升级为"面板"，`chartConfig` schema 改动较大——**先做 4.1–4.3**，4.4 评估后再决定是否本阶段实施

---

### Phase 5 — 复现与协作（6–9 周）

**目标**：从"个人工具"升级为"可分享、可复现的工具"。

**前置审计（Phase 5 开头）**：
- `src/utils/journalTemplates.ts` 已存在 5+ 期刊模板（Nature / ACS / Elsevier / Angewandte 等）
- `src/components/TemplatePanel.tsx` 已实现"保存自定义模板"流程
- 5.3 不重写现有模板系统；只审计、补缺、扩展

| 任务 | 验收 | 工时 |
|------|------|------|
| 5.1 Matplotlib 脚本导出（**保守 scope**） | 一键导出 `.py`，生成与当前图等价的 matplotlib 代码；**v1 范围**：仅 `line` + `scatter` + `line+fit overlay` 三种；不含 heatmap / 3D / surface / colorscale / log 轴 / 双 Y；自包含（仅依赖 numpy + matplotlib ≥ 3.8）；含拟合结果 LaTeX 注释（用 matplotlib mathtext，不用 usetex）；目标 matplotlib 版本 3.8（CI 验证） | 4 周 |
| 5.2 `.plot3d` 文件 v3 格式（Git 友好 diff） | 改为稳定键顺序 + 行化 JSON；dataset/图层 ID 用内容哈希而非随机 uid；前向兼容旧 v1/v2 格式（通过 `sanitizeProjectFile`） | 1.5 周 |
| 5.3 论文模板扩展 | 审计 `journalTemplates.ts` 当前模板清单；补缺到覆盖 Nature / Science / Cell / PRL / ACS 五大刊；其余保持 | 1 周 |
| 5.4 共享链接（**纯前端，无服务器**） | base64url 编码当前 chartConfig 到 URL fragment（`#d=...`）；不经过服务器；URL 长度上限 8KB；超出 8KB 时弹提示"请改用 .plot3d 文件分享"；附带二维码（用 `qrcode` npm 包，本地渲染） | 1 周 |

**不在范围内**：
- ❌ 模板市场（需要后端 + 审核 + 法务，纯前端项目不实施）
- ❌ Matplotlib 全图表类型导出（5.1 限定 3 种；扩到 heatmap/3D 需独立 phase）

**5.1 降级触发**：若 4 周内做不到"line+fit overlay 等价"，降级为只导出 line + scatter（去拟合注释），不做 Matplotlib 脚本子集

---

## 4. 风险与依赖

### 4.1 技术风险

| 风险 | 影响 | 应对 |
|------|------|------|
| Phase 3.1 `mathjs` 安全沙箱 | 任意表达式可能 XSS / DoS | AST 白名单（拒绝关键字见 §3.3.1）+ 单次求值 5s 超时 + 拒绝 AST depth > 50 / 字符 > 500；**不做"每分钟限 N 次"**——mathjs evaluate 在小表达式下 ~1µs，限速数字会给人虚假安全感 |
| Phase 4.4 多面板与"图层"概念冲突 | chartConfig schema 改动大 | 先做 spike（半天原型），再决定是否进 Phase 4 |
| Phase 5.1 Matplotlib 反向映射 | colorscale / annotation 映射坑多 | **v1 仅 3 种基础类型**（line / scatter / line+fit overlay；见 §5.1）；其他类型给提示"暂不支持导出脚本" |
| ~~Phase 0.4 依赖修正~~ | ~~API breaking~~ | **取消**（已验证：依赖版本真实存在，`npm install` 成功） |

### 4.2 产品风险

- **Phase 3.1 自定义公式的实际使用率**：若 80% 用户只用 7 类内置，自定义公式可降级为 P3。**建议 Phase 3 开头先用一周收集遥测或调研**
- **Phase 5.3 期刊模板准确性**：模板参数（字号、边距）应来自各期刊的 Author Guidelines；建议先收集 3–5 个真实模板，其他用"通用论文模板"占位

---

## 5. 验收 / 节奏 / 下一步

### 5.1 每个 Phase 结束的固定标准

- 该 Phase 列出的"验收"全部满足
- 整体 `npm run check` + `npm run lint` + `npm run build` + `npm run test` 全绿
- **覆盖率分三档**（用 vitest --coverage，CI 强制）：

  | 层级 | 文件 | 阈值 | 测试方法 |
  |------|------|------|---------|
  | A. 科学计算核心 | `src/utils/curveFitting.ts`、`src/utils/multiPeakFit.ts`、`src/utils/statistics.ts`、`src/utils/hypothesisTests.ts`、`src/utils/distributions.ts`、`src/utils/dataProcessing.ts` | **branch coverage ≥ 95%** | 命名解析解 fixture（`y=2x+1+ε` → 斜率 ≈ 2；高斯 σ=2 中点 0；指数 λ=1）|
  | B. 科研辅助 | `src/utils/peakDetection.ts`、`src/utils/annotationCoords.ts`、`src/utils/levenbergMarquardt.ts`（Phase 3 新增） | line coverage ≥ 90% | 单元测试 + 边界 case |
  | C. 其他 utils | `src/utils/latex.ts` 等 | line coverage ≥ 70% | 单元测试 |

  不用绝对 100%（单条防御性 `if (!input) return null` 就能破坏严格覆盖，且不是 bug）
- 一份 `PHASE-N.md` 记录：实际工时 vs 估计、踩到的坑、未完成项

### 5.2 节奏建议

- 每周固定 **半天（约 2–3h）** 做"代码卫生"（处理 TODO、依赖更新、issue 清理），不是一整天
- 总计卫生日预算：~38 周 × 2.5h ≈ 95h ≈ **2.4 周**，已含在 ~38–44 周总预算内
- 每个 Phase 末尾预留 0.5–1 周缓冲（已含在总预算内）
- 大变更前先在 GitHub issue / discussion 写清动机和方案——避免 PR 阶段来回

### 5.3 立即可执行（不需等评审）

- 归档 `REVIEW.md` → `REVIEW-2026-06-21.md`
- 移除 AdSense + 修正 CSP

---

## 6. 下一步流程

按 superpowers 工作流，本设计文档完成后：

1. **Spec 评审循环**：派 `spec-document-reviewer` subagent 评审本文档 → 修复发现的问题 → 最多 3 轮（已部分完成：第 1 轮完成并修复了 3 BLOCKER / 13 MAJOR 中的大部分）
2. **用户评审**：将文档交给用户审阅，确认无修改后进入 writing-plans 阶段
3. **实现计划**：用 `superpowers:writing-plans` skill 把每个 Phase 拆为可执行步骤