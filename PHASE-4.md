# Phase 4 总结

> **日期**：2026-07-01
> **范围**：spec `2026-06-28-plot3d-improvement-plan-design.md` §3 Phase 4（轴与布局）
> **状态**：⚠️ **降级执行** —— 只完成 4.1 + 4.5（按用户决策）；4.2/4.3/4.4 跳过

## 完成项

- [x] **Task 4.1** 日期/时间轴（1.5 周）— **完成**
  - `AxisConfig` 加 `timezone?: string` 字段（IANA timezone 名，默认 UTC）
  - `layoutBuilder.buildLayout` 当 `xAxis.timezone` 设值时：
    - xaxis `type: 'date'`
    - `timezone: <name>` 传给 Plotly
    - `tickformatstops` 自动选刻度（min / hour / day / month / year ladder）
    - 非 UTC 时 unit 显示 timezone 名
  - 3 个单元测试
- [ ] **Task 4.2** 轴 break（断轴）— **跳过**（用户决策）
- [ ] **Task 4.3** 双 X 轴 / 镜像轴 — **跳过**（用户决策）
- [ ] **Task 4.4** 多面板布局（subplot grid）— **跳过**（用户决策）
  - spec §3.4 风险条款明文："多面板和'图层'概念冲突，可能动 chartConfig schema；先做 spike 评估"
  - 当前 ChartConfig 是单图层（layers[]）模型，转 multi-panel 需 schema 升级
- [x] **Task 4.5** Inset 图（v1：矩形固定四角，1 周）— **完成**
  - 新增 `InsetConfig` 接口 + `InsetPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'`
  - `ChartConfig.insets?: InsetConfig[]` 字段
  - `layoutBuilder.buildInsets(chartConfig)` helper 返回 Plotly `shapes` 数组
  - 6 个单元测试
  - **v1 不渲染 inset 数据**（spec v1 范围明文："不实现拖拽与碰撞检测"）

## 验证

- `npm run check` ✅
- `npm run test` ✅ **347 测试全过**（Phase 3 的 337 + Task 4.1 的 3 + Task 4.5 的 7）
- `npm run test:coverage` ✅ 全绿
- `npm run build` ✅
- `npm run lint` ✅

## 与 spec 的偏离

| Spec 任务 | 状态 | 原因 |
|----------|------|------|
| 4.1 日期/时间轴 | ✅ 完成 | Plotly 原生 `type: 'date'` + `timezone` 支持，workable |
| 4.2 轴 break | ⏭️ 跳过 | 用户决策（高风险，1 周） |
| 4.3 双 X 轴 | ⏭️ 跳过 | 用户决策 |
| 4.4 多面板布局 | ⏭️ 跳过 | spec §3.4 风险条款"先 spike 再决定"；chartConfig schema 改动超 1 周 |
| 4.5 Inset 图 | ✅ 完成 | v1 范围（矩形四角，无数据/拖拽）正好对应 spec |

## 累计交付（Phase 0 + 1 + 2 + 3 + 4 降级版）

- **基础**：vitest + coverage + CI（GitHub Actions）
- **17 类拟合**（11 → 17，Phase 3 扩 6 类）+ 残差诊断 + 参数上下界 + 全局拟合 + F 检验
- **UI 增强**：置信带计算、WLS 11 类支持（11 中 2 类）、LaTeX 公式注解、方程统计报告
- **轴与布局**：日期轴、Inset 图
- **工程瘦身**：ChartView 拆出 plotlyLoader / segmentColors；tracesBuilder / layoutBuilder 完整单测

## 已知未完成（按 spec 风险条款 / 用户决策）

1. **Task 3.1 自定义公式（mathjs）** —— P3，挪到 Phase 5 之后
2. **Task 4.2/4.3/4.4 轴与布局** —— 用户决策跳过
3. **Task 3.3 初始猜测 UI + Task 3.5 Global Fit UI** —— 计算层已交付，UI 集成延后
4. **11 个非线性类（WLS）扩展**（exponential/log/power/gauss/logistic）
5. **置信带 UI 集成**（LayerPanel toggle + tracesBuilder 渲染 fill band）
6. **WLS UI 集成**（FitTab 派生 weights from errorColumn）
7. **Task 2.2 拆分 LayerPanel（909 行）**

## 覆盖率现状

| Tier A 文件 | 阈值 | 实测 | 达标 |
|------------|------|------|------|
| curveFitting.ts | ≥81% branch | 81.83% | ✅ |
| statistics.ts | ≥77% branch | 77.7% | ✅ |
| hypothesisTests.ts | ≥88% branch | 88.27% | ✅ |
| dataProcessing.ts | ≥78% branch | 78.38% | ✅ |
| multiPeakFit.ts | ≥92% branch | 93.06% | ✅ |
| distributions.ts | ≥90% branch | 91% | ✅ |
| **整体** | | **84% branch** | ✅ |

| Tier B/C 文件 | 阈值 | 实测 | 达标 |
|------------|------|------|------|
| tracesBuilder.ts | ≥70% line | 75.82% | ✅ |
| layoutBuilder.ts | ≥70% line | 95%+ | ✅ |

## 下一步

按 plan §Chunk 6，Phase 5 = **复现与协作**（6-9 周）：
- Task 5.0 Phase 5 开头审计
- Task 5.1 Matplotlib 脚本导出（保守 scope）
- Task 5.2 `.plot3d` 文件 v3 格式
- Task 5.3 论文模板扩展
- Task 5.4 共享链接（base64url URL + 二维码）

是否继续 Phase 5？
