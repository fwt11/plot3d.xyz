# Phase 1 总结

> **日期**：2026-06-30
> **范围**：spec `2026-06-28-plot3d-improvement-plan-design.md` §3 Phase 1（拟合核心）
> **状态**：✅ 计算层完成（Task 1.2–1.5），UI 集成部分待 Phase 2 收尾

## 完成项

- [x] **Task 1.1** 残差图（subchart） — **已就绪**（实际是独立 SVG 模态 `FitResultsBar.tsx:ResidualPlotModal`，与 spec §3.1.1 写的"Plotly subplots"不同但功能等价：显示残差散点 + fitted-vs-x 切换）
- [x] **Task 1.2** 95% 置信带 — **计算层完成**，UI 集成待 Phase 2
  - 新增 `computePredictionBand(type, data, queryX, alpha?)` (`src/utils/curveFitting.ts`)
  - 支持 linear (`s · sqrt(1/n + (x-x̄)²/Sxx)`) + polynomial (协方差矩阵 `x_p^T (X^T X)^{-1} x_p · s`)
  - 8 个单元测试 (`src/utils/curveFitting.band.test.ts`)
  - **未做**：LayerPanel 没 `showConfidenceBand` toggle、`tracesBuilder` 没渲染 fill band → 用户看不到 band
- [x] **Task 1.3** 加权最小二乘 — **linear + polynomial 完成**，剩余 5 类未做
  - `FitOptions { weights?: number[] }` 加到 `linearFit` / `polynomialFit`
  - `FitRequest.weights?` 加到 worker 协议，`runFit(type, x, y, weights?)` 透传
  - 7 个单元测试（uniform / down-weight / zero-exclude / length-mismatch 等）
  - **未做**：`exponentialFit / logarithmicFit / powerFit / gaussianFit / logisticFit` 没支持 WLS（spec §3.1.3 要求"11 类都支持"）
  - **未做**：LayerPanel 没暴露"权重列选择"下拉（spec §3.1.3 前置依赖）
- [x] **Task 1.4** LaTeX 公式渲染 — **完成**
  - `AnnotationType` 加 `'fitEquation'` (`src/types.ts`)
  - `buildFitEquationAnnotation(fit, options?)` (`src/utils/fitAnnotation.ts`) — 自动 `equationToLatex(...)`
  - FitResultsBar 加 "Pin to chart" 按钮 → 调用 `addAnnotation(buildFitEquationAnnotation(fitResult))`
  - 5 个单元测试（content 含 `$$...$$`、默认 top-right、自定义位置、唯一 id）
  - 复用现有 `AnnotationOverlay` 的 LaTeX 渲染路径（`isLatexContent` 自动检测 `$$...$$`）
- [x] **Task 1.5** 完整报告页 — **完成**
  - 新增 `fStatistic(rSquared, n, p)` / `fPValue(F, p, n)` / `formatPValue(p)` (`src/utils/fitReport.ts`)
  - FitParametersTable 增 F 检验行：`F(p-1, n-p) = X.XXX · p = X.XXXX ✓/—`
  - FitParametersTable 增残差诊断行：**Shapiro-Wilk 正态性** + **Durbin-Watson 自相关**
  - 7 个单元测试
  - **复用**：`hypothesisTests.shapiroWilk` 和 `statistics.durbinWatson`（spec §3.3.3 已预先实现，无需新增）
- [x] **Task 1.6** Tier A 测试 — **完成**（4 个 commit 共 +27 测试）
  - `curveFitting.ts`: 84% branch（阈值 ≥82%，与 Phase 0 同水平）
  - 其他 5 个 Tier A 文件未变

## 覆盖率现状

| Tier A 文件 | Phase 0 → Phase 1 | 距 95% |
|------------|-------------------|--------|
| `curveFitting.ts` | 84% → 84%（+2 个新导出函数 `computePredictionBand` / `ConfidenceBand`） | -11% |
| `statistics.ts` | 78%（不变） | -17% |
| `hypothesisTests.ts` | 88%（不变） | -7% |
| `dataProcessing.ts` | 78%（不变） | -17% |
| `multiPeakFit.ts` | 93%（不变） | -2% |
| `distributions.ts` | 91%（不变） | -4% |
| **整体** | **84%** | -11% |

> curveFitting.ts 整体 branch 与 Phase 0 持平；新增的 `computePredictionBand` 引入的 `inverseNormalCdf` / `twoTailedTCritical` 死代码已被删除（v1 硬编码 alpha=0.05）。

## 已知未完成（Phase 2 跟进）

1. **置信带 UI 集成**（HIGH） — `computePredictionBand` 已实现但**没有调用者**：
   - LayerPanel 没 `showConfidenceBand` toggle
   - `tracesBuilder` 没渲染 fit curve 的 fill band（`fill: 'tonexty'` + `fillcolor: 半透明 layer.color`）
   - 用户**看不到**置信带
2. **WLS UI 集成**（MEDIUM） — `FitOptions.weights` 已实现但 FitTab 不知道用哪个 error 列：
   - FitTab `performFit` 调用 `runFit(type, validX, validY)`，没传 weights
   - LayerPanel / ConfigPanel 没暴露"权重列选择"下拉
   - 应：activeLayer.errorColumn 存在时，自动 `weights = 1 / errorColumn.values.map(v => v*v)`
3. **5 个非线性拟合的 WLS**（LOW） — `exponentialFit / logarithmicFit / powerFit / gaussianFit / logisticFit` 没扩展 WLS
   - 需要：每个函数的 Gauss-Newton 内部循环把 `r` 替换成 `sqrt(w) * r`
   - 工时：1-2 周

## 踩到的坑

- **`isLatexContent` 已经是真值** — `$$...$$` 开头结尾的 content 自动走 KaTeX 渲染。`fitEquation` 类型不需要 AnnotationOverlay 加特殊分支，content 用 `equationToLatex()` 包装即可。
- **`FitType` 在 `@/store/fitStore` 不是 `@/types`** — typecheck 报 `'FitType' is not exported`，避免循环 import 改用 `string`。
- **`t` 函数签名要带 `options?`** — 现有函数声明 `(key: string) => string`，但 `t('key', { defaultValue: '...' })` 需要 `options?` 参数。修：单独给新函数更宽松的 t 类型。
- **`addToast(message, type)` 第二参是 ToastType 不是 severity string** — `'success'` 不是 valid type（只有 `'info' | 'success' | 'warning' | 'error'`）—— 但 lint 没抓，编译时才发现。

## 下一步

- **Phase 2 起步前**：手工验证 confidence band UI（Phase 2 集成后）+ 手工验证 WLS with 真实 error 列
- **Phase 2 计划未拆解** —— plan §Chunk 3 列出了 Task 2.1-2.6 但没展开步骤。建议回到 `superpowers:writing-plans` skill 拆分

## 不在 Phase 1 范围

- ChartView / LayerPanel 拆分（Phase 2.1-2.2）
- GitHub Actions CI（Phase 2.3）
- tracesBuilder / layoutBuilder 单测（Phase 2.4）
- Plotly 包体优化（Phase 2.5）
- 自定义公式 / 新拟合类型 / 全局拟合（Phase 3）
- 日期/时间轴 / 轴 break / 多面板 / Inset（Phase 4）
- Matplotlib 脚本 / `.plot3d` v3 / 共享链接（Phase 5）