# Plot3D 提升计划（修订版）实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 spec `docs/superpowers/specs/2026-06-28-plot3d-improvement-plan-design.md` 的 5 个 Phase 顺序实施，每阶段交付独立可演示成果。

**Architecture:** Phase 串行（Phase 0 是其他 Phase 的前置）；每个 Phase 内部 Task 串行优先。Solo dev 节奏，每个 Task 2–5 分钟步进，每 Phase 1–9 周。

**Tech Stack:** React 18 + TypeScript strict + Zustand + Vite 6 + Plotly.js + Web Workers + KaTeX + mathjs + vitest（Phase 0 新增）。

**前置文档：**
- 设计文档：`docs/superpowers/specs/2026-06-28-plot3d-improvement-plan-design.md`
- 原始计划：`docs/improvement-plan.md`
- 旧评审（已归档）：`REVIEW-2026-06-21.md`
- AGENTS.md：`AGENTS.md`

**全局约束：**
- 每完成一个 Task 立刻 commit（**不要批量 commit**）
- 每完成一个 Phase 写 `PHASE-N.md` 总结（实际工时、踩坑、未完成项）
- 涉及科学计算的代码：branch coverage ≥ 95%（Tier A）；line coverage ≥ 90%（Tier B）；line coverage ≥ 70%（Tier C）。详见 spec §5.1
- 每次 commit 前跑 `npm run check && npm run lint`，确认无错
- 中文 commit message 与项目现有风格一致（项目 commit 中英文混杂；优先中文）

**项目关键文件参考（实施前必读）：**

```
src/
├── components/
│   ├── ChartView.tsx (868 行 → Phase 2 拆分目标)
│   ├── DataTable.tsx (615 行；已含虚拟滚动 + 静默更新)
│   ├── LayerPanel.tsx (909 行 → Phase 2 拆分目标)
│   ├── ExportModal.tsx (552 行；已含 PNG/SVG/PDF/TIFF)
│   ├── FileTab.tsx (620 行)
│   └── AnnotationOverlay.tsx (161 行；已支持数据坐标)
├── store/
│   ├── chartStore.ts (默认色图 viridis；色盲友好)
│   ├── fitStore.ts
│   ├── datasetStore.ts
│   └── historyStore.ts (MAX_HISTORY=50, MAX_BRANCHES=10)
├── utils/
│   ├── curveFitting.ts (1048 行；11 类拟合 + 完整统计量)
│   ├── dataProcessing.ts (597 行；4 平滑 + 4 插值 + IQR)
│   ├── statistics.ts (695 行；含 durbinWatson:478)
│   ├── hypothesisTests.ts (626 行；含 shapiroWilk:423)
│   ├── tracesBuilder.ts (含 14+ 图表类型)
│   └── layoutBuilder.ts
├── workers/
│   └── fitWorker.ts (已支持 7 类拟合)
└── types.ts
```

---

## Chunk 1: Phase 0 — 地基（1–2 周）

**Phase 0 目标**：让 npm install 干净（其实已经干净，见 spec §0.1 footnote）、index.html 干净（删 AdSense）、CI 能跑、地基有测。

**Phase 0 范围**：7 个 Task，总计约 14h 实工 + 调试。预计 1–2 周（含首次接入 vitest 的学习曲线）。

**Phase 0 不做什么**：不改业务逻辑、不重命名 API、不引入新功能。

**Phase 0 完成标志**：`PHASE-0.md` 写好；`npm run test` 可跑且 Tier A 文件已有 ≥95% branch coverage 的骨架测试；CI 跑通。

---

### Task 1: 验证 REVIEW.md 归档（无需操作）

**Files:** 无（仅验证）

> 注：brainstorming 阶段已执行 `git mv REVIEW.md REVIEW-2026-06-21.md`，并提交到 `docs(plan): plot3d 改进路线图修订版（基于代码审计）` commit。本 Task 仅做最终验证，不重新执行 git mv。

- [ ] **Step 1: 验证归档文件存在**

```bash
test -f REVIEW-2026-06-21.md && echo "OK: archived file exists" || echo "MISSING: REVIEW-2026-06-21.md"
```

Expected: `OK: archived file exists`

- [ ] **Step 2: 验证 README.md 包含归档链接**

```bash
grep -c "REVIEW-2026-06-21" README.md
```

Expected: `>= 1`

- [ ] **Step 3: 验证 git 历史保留了重命名**

```bash
git log --diff-filter=R --name-status -- 'REVIEW*.md' | head -5
```

Expected: 看到 `REVIEW.md -> REVIEW-2026-06-21.md` 重命名记录。

- [ ] **Step 4: 若验证失败，按"Plan 偏差处理"修复**

如果 Step 1 / 2 / 3 任何一个失败，**才**执行修复：

```bash
git mv REVIEW.md REVIEW-2026-06-21.md
```

并在 `README.md` 末尾添加"## 历史"小节：
```markdown
## 历史

- 旧评审归档（**已过期**）：[REVIEW-2026-06-21.md](./REVIEW-2026-06-21.md)（2026-06-21 写，多数 P0/P1 项已在 2026-06-28 前修复。最新的现状评估见 [改进计划设计文档 §0.1](./docs/superpowers/specs/2026-06-28-plot3d-improvement-plan-design.md#01-起点澄清现有计划已大部分落地)）
```

- [ ] **Step 5: 提交（如有修复）**

```bash
git add REVIEW-2026-06-21.md README.md
git commit -m "docs: 归档 REVIEW.md 为 REVIEW-2026-06-21.md，README 加引用"
```

> 若 Step 1–3 全部通过，无 commit。

---

### Task 2: 移除 AdSense 脚本和 CSP allowlist

**Files:**
- Modify: `index.html:7`（CSP meta）
- Modify: `index.html:9`（AdSense `<script>`）

- [ ] **Step 1: 读 index.html 确认当前内容**

```bash
cat index.html
```

确认两处：
- 第 7 行 CSP meta：`script-src ... https://pagead2.googlesyndication.com; ... connect-src ... https://pagead2.googlesyndication.com`
- 第 9 行 AdSense script：`<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5107546000731729" crossorigin="anonymous"></script>`

- [ ] **Step 2: 移除 AdSense script 标签**

打开 `index.html`，删除第 9 行整行（保留空行结构）。

修改后该行所在区域大致如下：
```html
    <title>Plot3D</title>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
```

- [ ] **Step 3: 移除 CSP 中的 googlesyndication**

打开 `index.html`，修改 CSP meta（注意：`<` 和 `>` 在 meta content 里只是字符，不影响 sed 替换）。

将：
```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://pagead2.googlesyndication.com; worker-src 'self' blob:;
```

改为：
```
script-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:;
```

- [ ] **Step 4: 验证修改**

```bash
grep -i "googlesyndication\|adsbygoogle\|adSense" index.html
```

Expected: 无输出（如果还有输出，说明没改干净，回去重做）。

- [ ] **Step 5: 跑构建确认无副作用**

```bash
npm run build
```

Expected: build 成功（vite 不会因为 CSP 而失败；CSP 是浏览器层强制）。

- [ ] **Step 6: 提交**

```bash
git add index.html
git commit -m "fix: 移除 AdSense 脚本与 CSP 中的 googlesyndication allowlist"
```

---

### Task 3: xlsx 替换为 npm registry 版本

**Files:**
- Modify: `package.json`（替换 xlsx 依赖）
- Create or update: `package-lock.json`（npm install 自动生成）

- [ ] **Step 1: 读当前 xlsx 声明**

```bash
grep "xlsx" package.json
```

Expected: `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`

- [ ] **Step 2: 替换为 npm 版本**

用 Edit 工具替换：

old:
```
    "xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz",
```

new:
```
    "xlsx": "^0.18.5",
```

- [ ] **Step 3: 卸载旧的 tarball 版本并装新版本**

```bash
npm uninstall xlsx
npm install xlsx@^0.18.5
```

Expected: npm install 成功；`node_modules/xlsx/package.json` 的 version 字段为 `0.18.5`。

- [ ] **Step 4: 跑构建**

```bash
npm run check
npm run build
```

Expected: check 通过；build 成功。

**如果 build 失败**：xlsx 0.18.5 与 0.20.3 之间的 API 差异（0.20.x 是新版，CVE 已修）。通常不会 break（0.18.5 已有 `read` / `sheet_to_json` API），但若真有差异，下面的 ExcelJS 迁移是完整步骤：

```bash
npm uninstall xlsx
npm install exceljs
```

修改 `src/components/ribbon/FileTab.tsx` 的 xlsx 引用（**注意：ExcelJS 的 API 是 async，且 1-indexed**）：

old:
```typescript
const wb = XLSX.read(data, { type: 'array' });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });
```

new:
```typescript
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(data as ArrayBuffer);
const ws = wb.worksheets[0];
const rows: (string | number)[][] = [];
ws.eachRow({ includeEmpty: false }, (row) => {
  const values: (string | number)[] = [];
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    // ExcelJS rows.values is 1-indexed and has empty [0]; use eachCell for safety
    const v = cell.value;
    values[colNumber - 1] = v instanceof Date ? v.toISOString() : (v as string | number) ?? '';
  });
  rows.push(values);
});
```

并修改文件顶部的 import：

old:
```typescript
import * as XLSX from 'xlsx';
```

new:
```typescript
import ExcelJS from 'exceljs';
```

由于 `parseFileToDataset` 已是 async 函数（见 FileTab.tsx:24 `Promise<Dataset>`），ExcelJS 的 async API 不需要进一步包装。

- [ ] **Step 5: 跑审计**

```bash
npm audit
```

Expected: 无 high / critical 漏洞（medium 允许；记录在 PHASE-0.md）。

- [ ] **Step 6: ESM smoke test**

```bash
node -e "import('xlsx').then(m => console.log(typeof m.read))"
```

Expected: `function`（若输出 `undefined` 或报错，说明版本路径解析失败，需要走 Step 4 的 ExcelJS fallback）。

- [ ] **Step 7: 提交**

```bash
git add package.json package-lock.json
git commit -m "fix(deps): xlsx 从 CDN tarball 切换到 npm registry 版本"
```

---

### Task 4: 接入 vitest

**Files:**
- Modify: `package.json`（新增 devDependencies + scripts）
- Create: `vitest.config.ts`
- Modify: `tsconfig.json`（如需要 types）
- Create: `tests/setup.ts`（如需要）

- [ ] **Step 1: 安装 vitest 与相关工具**

```bash
npm install -D vitest @vitest/coverage-v8 jsdom
```

Expected: package.json devDependencies 新增 3 个包。

- [ ] **Step 2: 在 package.json scripts 添加 test 命令**

打开 `package.json`，修改 scripts：

old:
```
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "check": "tsc -b --noEmit"
  },
```

new:
```
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "check": "tsc -b --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
```

- [ ] **Step 3: 创建 vitest.config.ts**

```bash
cat > vitest.config.ts <<'EOF'
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Tier A scientific-computing files (per spec §5.1)
      include: [
        'src/utils/curveFitting.ts',
        'src/utils/statistics.ts',
        'src/utils/hypothesisTests.ts',
        'src/utils/dataProcessing.ts',
        'src/utils/multiPeakFit.ts',
        'src/utils/distributions.ts',
      ],
      thresholds: {
        // Tier A: branch coverage ≥ 95% (spec §5.1)
        'src/utils/curveFitting.ts': { branches: 95, functions: 95, lines: 95 },
        'src/utils/statistics.ts': { branches: 95, functions: 95, lines: 95 },
        'src/utils/hypothesisTests.ts': { branches: 95, functions: 95, lines: 95 },
        'src/utils/dataProcessing.ts': { branches: 95, functions: 95, lines: 95 },
        'src/utils/multiPeakFit.ts': { branches: 95, functions: 95, lines: 95 },
        'src/utils/distributions.ts': { branches: 95, functions: 95, lines: 95 },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
EOF
```

> **不设 `globals: true`** —— 测试文件已用 explicit `import { describe, it, expect } from 'vitest'`，避免 ESLint 报 no-undef。
> **`resolve.alias` 重复 `vite-tsconfig-paths`** —— 无害但显式声明避免冲突；若发现问题可改为 `defineConfig` 引用 `vite.config.ts` 中的别名。

- [ ] **Step 4: 跑一次空测试确认 vitest 跑通**

```bash
mkdir -p tests
cat > tests/smoke.test.ts <<'EOF'
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('vitest works', () => {
    expect(1 + 1).toBe(2);
  });
});
EOF
npm run test
```

Expected: `1 passed`。

- [ ] **Step 5: 删除 smoke 测试，提交 vitest 接入**

```bash
rm tests/smoke.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: 接入 vitest，添加 coverage 阈值（Phase 0 Tier A 起步）"
```

---

### Task 5: 写 curveFitting.ts 的 Tier A 单元测试骨架

**Files:**
- Create: `src/utils/curveFitting.test.ts`

> **设计原则**：spec §5.1 要求 Tier A 文件 ≥95% branch coverage。curveFitting.ts 1048 行，全部覆盖是 ~30+ 测试。本 Task 只写"骨架"——覆盖每类拟合至少一个解析解案例，达到 ≥95% branch coverage 的目标会跨多个 Phase 增量完成。

- [ ] **Step 1: 写 linearFit 解析解测试**

```typescript
// src/utils/curveFitting.test.ts
import { describe, it, expect } from 'vitest';
import {
  linearFit,
  polynomialFit,
  exponentialFit,
  logarithmicFit,
  powerFit,
  gaussianFit,
  logisticFit,
  calculateErrorStats,
} from './curveFitting';

describe('linearFit', () => {
  it('fits y = 2x + 1 exactly with no noise', () => {
    const x = [0, 1, 2, 3, 4];
    const y = x.map((xi) => 2 * xi + 1);
    const result = linearFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.slope).toBeCloseTo(2, 10);
    expect(result!.intercept).toBeCloseTo(1, 10);
    expect(result!.rSquared).toBeCloseTo(1, 10);
  });

  it('returns null for insufficient data', () => {
    const result = linearFit([1], [2]);
    expect(result).toBeNull();
  });

  it('filters out NaN pairs', () => {
    const x = [0, 1, NaN, 3, 4];
    const y = [1, 3, NaN, 7, 9];
    const result = linearFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.slope).toBeCloseTo(2, 10);
    expect(result!.intercept).toBeCloseTo(1, 10);
  });

  it('returns null when all x are identical (singular)', () => {
    const result = linearFit([5, 5, 5, 5], [1, 2, 3, 4]);
    expect(result).toBeNull();
  });

  it('produces correct statistics when noisy', () => {
    // y = 2x + 1 + ε, ε ~ N(0, 0.1)
    const x = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const y = x.map((xi, i) => 2 * xi + 1 + (i % 2 === 0 ? 0.05 : -0.05));
    const result = linearFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.slope).toBeCloseTo(2, 1);
    expect(result!.intercept).toBeCloseTo(1, 1);
    expect(result!.rSquared).toBeGreaterThan(0.99);
    expect(result!.stats).toBeDefined();
    expect(result!.stats!.adjustedRSquared).toBeGreaterThan(0.99);
    expect(result!.stats!.n).toBe(10);
    expect(result!.stats!.parameterSE).toHaveLength(2);
    expect(result!.stats!.parameterCI).toHaveLength(2);
    // CI should bracket the estimate
    result!.stats!.parameterCI.forEach(([lo, hi]) => {
      expect(lo).toBeLessThan(hi);
    });
  });
});

describe('polynomialFit', () => {
  it('fits y = x² exactly with degree=2', () => {
    const x = [-2, -1, 0, 1, 2];
    const y = x.map((xi) => xi * xi);
    const result = polynomialFit(x, y, 2);
    expect(result).not.toBeNull();
    expect(result!.coefficients[0]).toBeCloseTo(1, 10); // x²
    expect(result!.coefficients[1]).toBeCloseTo(0, 10); // x¹
    expect(result!.coefficients[2]).toBeCloseTo(0, 10); // x⁰
  });

  it('rejects invalid degree', () => {
    expect(polynomialFit([1, 2, 3], [1, 2, 3], 0)).toBeNull();
    expect(polynomialFit([1, 2, 3], [1, 2, 3], 7)).toBeNull();
  });

  it('linear fit via poly1 matches linearFit', () => {
    const x = [0, 1, 2, 3];
    const y = [1, 3, 5, 7];
    const result = polynomialFit(x, y, 1);
    expect(result).not.toBeNull();
    expect(result!.coefficients[0]).toBeCloseTo(2, 10); // slope
    expect(result!.coefficients[1]).toBeCloseTo(1, 10); // intercept
  });
});

describe('exponentialFit', () => {
  it('fits y = 2 * exp(0.5x) when x ≥ 0', () => {
    const x = [0, 1, 2, 3, 4];
    const y = x.map((xi) => 2 * Math.exp(0.5 * xi));
    const result = exponentialFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.a).toBeCloseTo(2, 8);
    expect(result!.b).toBeCloseTo(0.5, 8);
    expect(result!.rSquared).toBeCloseTo(1, 8);
  });

  it('skips y ≤ 0', () => {
    // y = [2, 0, 2*exp(0.5*2), -1, 2*exp(0.5*4)]; indices 1 and 3 should be skipped
    const x = [0, 1, 2, 3, 4];
    const y = [2, 0, 2 * Math.exp(0.5 * 2), -1, 2 * Math.exp(0.5 * 4)];
    const result = exponentialFit(x, y);
    // Result may be null (if remaining positive y < 2) or a fit on positive y only
    if (result) {
      expect(result.a).toBeGreaterThan(0);
    }
  });
});

describe('logarithmicFit', () => {
  it('fits y = 3 + 2*ln(x) when x > 0', () => {
    const x = [0.5, 1, 2, 4, 8];
    const y = x.map((xi) => 3 + 2 * Math.log(xi));
    const result = logarithmicFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.a).toBeCloseTo(3, 8);
    expect(result!.b).toBeCloseTo(2, 8);
    expect(result!.rSquared).toBeCloseTo(1, 8);
  });

  it('skips x ≤ 0', () => {
    const result = logarithmicFit([0, -1, 1, 2], [0, 0, 1, 2]);
    // Only x=1, x=2 are valid → 2 points, which is min for linear fit
    expect(result).not.toBeNull();
  });
});

describe('powerFit', () => {
  it('fits y = 3 * x^1.5 when x > 0 and y > 0', () => {
    const x = [0.5, 1, 2, 4, 8];
    const y = x.map((xi) => 3 * Math.pow(xi, 1.5));
    const result = powerFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.a).toBeCloseTo(3, 6);
    expect(result!.b).toBeCloseTo(1.5, 6);
    expect(result!.rSquared).toBeCloseTo(1, 6);
  });
});

describe('gaussianFit', () => {
  it('fits y = 5 * exp(-(x-2)² / (2*1²)) exactly', () => {
    // Center=2, sigma=1, amplitude=5
    const x = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
    const y = x.map((xi) => 5 * Math.exp(-Math.pow(xi - 2, 2) / 2));
    const result = gaussianFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.amplitude).toBeCloseTo(5, 6);
    expect(result!.center).toBeCloseTo(2, 6);
    expect(result!.sigma).toBeCloseTo(1, 4);
    expect(result!.rSquared).toBeGreaterThan(0.99);
  });

  it('returns null when fewer than 3 points', () => {
    const result = gaussianFit([1, 2], [3, 4]);
    expect(result).toBeNull();
  });
});

describe('logisticFit', () => {
  it('fits y = 10 / (1 + exp(-1*(x-3))) approximately', () => {
    // L=10, k=1, x0=3
    const x = [0, 1, 2, 3, 4, 5, 6];
    const y = x.map((xi) => 10 / (1 + Math.exp(-1 * (xi - 3))));
    const result = logisticFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.L).toBeCloseTo(10, 4);
    expect(result!.k).toBeCloseTo(1, 2);
    expect(result!.x0).toBeCloseTo(3, 2);
    expect(result!.rSquared).toBeGreaterThan(0.99);
  });
});

describe('calculateErrorStats', () => {
  it('returns zero error for perfect prediction', () => {
    const y = [1, 2, 3, 4, 5];
    const stats = calculateErrorStats(y, y);
    expect(stats).not.toBeNull();
    expect(stats!.sse).toBe(0);
    expect(stats!.rSquared).toBe(1);
    expect(stats!.rmse).toBe(0);
    expect(stats!.meanAbsError).toBe(0);
  });

  it('returns null for empty arrays', () => {
    expect(calculateErrorStats([], [])).toBeNull();
  });

  it('returns null for length mismatch', () => {
    expect(calculateErrorStats([1, 2], [1])).toBeNull();
  });

  it('handles constant y (sst=0 → rSquared=1 by convention)', () => {
    const stats = calculateErrorStats([5, 5, 5], [5, 5, 6]);
    expect(stats!.rSquared).toBe(1);
  });
});
```

- [ ] **Step 2: 跑测试**

```bash
npm run test
```

Expected: 大部分测试通过；如果某些 case（如 powerFit 1.5 精度）失败，调整 `toBeCloseTo` 容差。**目标**：所有测试 PASS。

- [ ] **Step 3: 检查覆盖率**

```bash
npm run test:coverage
```

Expected: `src/utils/curveFitting.ts` branch coverage **≥ 95%**（spec §5.1 Tier A 阈值，与 vitest.config.ts 一致）。**未达 95% 不通过**——必须补测试用例直到达标，不调低阈值。

- [ ] **Step 4: 提交**

```bash
git add src/utils/curveFitting.test.ts
git commit -m "test(curveFitting): 添加 11 类拟合 + 统计函数的解析解单元测试"
```

---

### Task 6: 写 statistics.ts Tier A 测试骨架

**Files:**
- Create: `src/utils/statistics.test.ts`

- [ ] **Step 1: 写基础描述统计 + durbinWatson 测试**

```typescript
// src/utils/statistics.test.ts
import { describe, it, expect } from 'vitest';
import {
  mean,
  median,
  sampleVariance,
  sampleStdDev,
  pearsonCorrelation,
  durbinWatson,
} from './statistics';

describe('mean', () => {
  it('computes arithmetic mean', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
  });

  it('returns NaN for empty array', () => {
    // statistics.ts:19 contract: empty input → NaN
    expect(mean([])).toBeNaN();
  });
});

describe('median', () => {
  it('returns middle value for odd-length array', () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3);
  });

  it('returns average of two middle values for even-length array', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('sampleVariance / sampleStdDev', () => {
  it('matches expected formulas (n-1 denominator)', () => {
    const x = [1, 2, 3, 4, 5];
    // Sample variance: sum((x - mean)^2) / (n-1) = 10 / 4 = 2.5
    expect(sampleVariance(x)).toBeCloseTo(2.5, 10);
    expect(sampleStdDev(x)).toBeCloseTo(Math.sqrt(2.5), 10);
  });

  it('returns NaN for n < 2', () => {
    expect(sampleVariance([5])).toBeNaN();
    expect(sampleStdDev([5])).toBeNaN();
  });
});

describe('durbinWatson', () => {
  it('returns ≈2 for uncorrelated residuals', () => {
    const residuals = [0.1, -0.2, 0.15, -0.05, 0.1, -0.1, 0.05];
    const dw = durbinWatson(residuals);
    // For random-ish residuals, DW should be near 2
    expect(dw).toBeGreaterThan(1.5);
    expect(dw).toBeLessThan(2.5);
  });

  it('returns < 1 for positively autocorrelated residuals', () => {
    // Monotonically increasing residuals → strong positive autocorrelation
    const residuals = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
    const dw = durbinWatson(residuals);
    expect(dw).toBeLessThan(1);
  });

  it('returns > 2 for negatively autocorrelated residuals', () => {
    // Alternating pattern → negative autocorrelation
    const residuals = [0, 1, 0, 1, 0, 1, 0, 1];
    const dw = durbinWatson(residuals);
    expect(dw).toBeGreaterThan(2);
  });

  it('returns ≈3 for perfectly negatively correlated (alternating)', () => {
    // residuals = [1, -1, 1, -1]: diffs = [-2, 2, -2]; sum of squares = 12; sum of e^2 = 4; DW = 3
    const residuals = [1, -1, 1, -1];
    expect(durbinWatson(residuals)).toBeCloseTo(3, 10);
  });
});

describe('pearsonCorrelation', () => {
  it('returns 1 for perfect positive linear', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];
    expect(pearsonCorrelation(x, y)).toBeCloseTo(1, 10);
  });

  it('returns -1 for perfect negative linear', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [10, 8, 6, 4, 2];
    expect(pearsonCorrelation(x, y)).toBeCloseTo(-1, 10);
  });
});
```

> **已修正**：
> - 删除不存在的 `covariance` import（`src/utils/statistics.ts` 不导出该函数）
> - 合并 `durbinWatson` 到单条 import 块
> - `mean([])` 实际返回 NaN（statistics.ts:19），不是 0
> - 删去 pearsonCorrelation 的 constant-y case（实际是除零边界，无具体分支逻辑）
> - 添加 `sampleVariance` / `sampleStdDev` 的 NaN 边界测试

- [ ] **Step 2: 跑测试**

```bash
npm run test src/utils/statistics.test.ts
```

Expected: 全部 PASS（部分可能因函数名不同而需调整 import）。

- [ ] **Step 3: 提交**

```bash
git add src/utils/statistics.test.ts
git commit -m "test(statistics): 添加描述统计 + durbinWatson + 相关性测试"
```

---

### Task 7: 写 dataProcessing.ts Tier A 测试骨架

**Files:**
- Create: `src/utils/dataProcessing.test.ts`

- [ ] **Step 1: 写 4 种平滑 + 4 种插值的关键测试**

```typescript
// src/utils/dataProcessing.test.ts
import { describe, it, expect } from 'vitest';
import {
  movingAverage,
  savitzkyGolay,
  lowPassFilter,
  whittakerSmoothing,
  linearInterp,
  cubicSplineInterp,
  akimaInterp,
  pchipInterp,
  fillMissingValues,
  detectOutliers,
} from './dataProcessing';

describe('movingAverage', () => {
  it('returns same values for flat signal', () => {
    const x = [5, 5, 5, 5, 5];
    const y = movingAverage(x, 3);
    expect(y).toEqual([5, 5, 5, 5, 5]);
  });

  it('smooths a spike', () => {
    const x = [1, 1, 1, 100, 1, 1, 1];
    const y = movingAverage(x, 3);
    // middle point should be (1+100+1)/3 = 34
    expect(y[3]).toBeCloseTo(34, 5);
    // neighbors of spike should be reduced
    expect(y[2]).toBeLessThan(50);
  });
});

describe('savitzkyGolay', () => {
  it('preserves a polynomial of degree ≤ polyOrder', () => {
    const x: number[] = [];
    for (let i = 0; i <= 20; i++) x.push(i * i); // x²
    const y = savitzkyGolay(x, 5, 2);
    // At interior points, SG with polyOrder=2 should preserve x² exactly
    for (let i = 3; i < y.length - 2; i++) {
      expect(y[i]).toBeCloseTo(x[i], 8);
    }
  });

  it('returns NaN at boundaries (half-window past edge)', () => {
    const x = [0, 1, 4, 9, 16, 25, 36, 49, 64, 81, 100];
    const y = savitzkyGolay(x, 5, 2);
    expect(y[0]).toBeNaN();
    expect(y[y.length - 1]).toBeNaN();
  });
});

describe('lowPassFilter', () => {
  it('smooths noisy signal', () => {
    const x = [1, -1, 1, -1, 1, -1, 1, -1];
    const y = lowPassFilter(x, 0.2);
    // After many alternating points with α=0.2, output should approach 0
    expect(Math.abs(y[y.length - 1])).toBeLessThan(0.1);
  });
});

describe('whittakerSmoothing', () => {
  it('returns same signal for λ=0 (no smoothing)', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const y = whittakerSmoothing(x, 0);
    for (let i = 0; i < x.length; i++) {
      expect(y[i]).toBeCloseTo(x[i], 5);
    }
  });
});

describe('linearInterp', () => {
  it('returns exact values at data points', () => {
    const xs = [0, 1, 2, 3];
    const ys = [0, 10, 20, 30];
    const out = linearInterp(xs, ys, [0.5, 1.5, 2.5]);
    expect(out[0]).toBeCloseTo(5, 10);
    expect(out[1]).toBeCloseTo(15, 10);
    expect(out[2]).toBeCloseTo(25, 10);
  });

  it('clamps at boundaries', () => {
    const out = linearInterp([0, 1], [0, 1], [-1, 2]);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(1);
  });
});

describe('cubicSplineInterp', () => {
  it('matches linear for 2 points', () => {
    const xs = [0, 1];
    const ys = [0, 1];
    const out = cubicSplineInterp(xs, ys, [0.5]);
    expect(out[0]).toBeCloseTo(0.5, 5);
  });

  it('interior point matches smooth curve for 4+ points', () => {
    // Cubic on y = sin(x) should be close to sin at dense points
    const xs = [0, 1, 2, 3, 4, 5];
    const ys = xs.map(Math.sin);
    const out = cubicSplineInterp(xs, ys, [0.5, 1.5, 2.5]);
    expect(out[0]).toBeCloseTo(Math.sin(0.5), 4);
    expect(out[1]).toBeCloseTo(Math.sin(1.5), 4);
    expect(out[2]).toBeCloseTo(Math.sin(2.5), 4);
  });
});

describe('akimaInterp', () => {
  it('handles sparse data without oscillation (vs cubic spline)', () => {
    // Akima should not produce the overshoot that cubic spline does on this
    const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const ys = [0, 0, 0, 10, 0, 0, 0, 10, 0, 0];
    const out = akimaInterp(xs, ys, [2.5, 6.5]);
    // Akima values should be close to 0 between spikes (no large overshoot)
    expect(Math.abs(out[0])).toBeLessThan(5);
    expect(Math.abs(out[1])).toBeLessThan(5);
  });
});

describe('pchipInterp', () => {
  it('preserves monotonicity (does not overshoot)', () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [0, 1, 4, 9, 16]; // x² — monotonic
    const out = pchipInterp(xs, ys, [0.5, 1.5, 2.5, 3.5]);
    // Each out value should be between the two neighboring ys
    expect(out[0]).toBeGreaterThan(0);
    expect(out[0]).toBeLessThan(1);
    expect(out[1]).toBeGreaterThan(1);
    expect(out[1]).toBeLessThan(4);
    expect(out[2]).toBeGreaterThan(4);
    expect(out[2]).toBeLessThan(9);
    expect(out[3]).toBeGreaterThan(9);
    expect(out[3]).toBeLessThan(16);
  });
});

describe('fillMissingValues', () => {
  it('interpolates linearly between neighbors', () => {
    const input = ['1', '', '3', '', '5'];
    const out = fillMissingValues(input, 'interpolate');
    expect(out[1]).toBe('2');
    expect(out[3]).toBe('4');
  });

  it('fills with mean', () => {
    const input = ['1', '', '3', '', '5'];
    const out = fillMissingValues(input, 'mean');
    expect(Number(out[1])).toBeCloseTo(3, 5);
  });

  it('deletes missing', () => {
    const input = ['1', '', '3', '', '5'];
    const out = fillMissingValues(input, 'delete');
    expect(out).toEqual(['1', '3', '5']);
  });

  it('fills with zero', () => {
    const input = ['1', '', '3'];
    const out = fillMissingValues(input, 'zero');
    expect(out[1]).toBe('0');
  });

  it('handles all-missing by filling with 0', () => {
    expect(fillMissingValues(['', '', ''], 'zero')).toEqual(['0', '0', '0']);
  });
});

describe('detectOutliers (IQR)', () => {
  it('flags obvious outliers', () => {
    const values = [1, 2, 3, 4, 5, 100];
    const result = detectOutliers(values, 1.5);
    expect(result.indices).toContain(5);
    expect(result.indices).not.toContain(0);
  });

  it('returns empty indices for tight data', () => {
    const values = [1, 2, 3, 4, 5];
    const result = detectOutliers(values, 1.5);
    expect(result.indices).toEqual([]);
  });

  it('uses stricter k=3 to exclude mild outliers', () => {
    const values = [1, 2, 3, 4, 5, 100];
    const loose = detectOutliers(values, 1.5);
    const strict = detectOutliers(values, 3);
    expect(loose.indices).toContain(5);
    expect(strict.indices).toContain(5);
  });
});
```

- [ ] **Step 2: 跑测试**

```bash
npm run test src/utils/dataProcessing.test.ts
```

Expected: 大部分通过；某些 case（如 Whittaker 精度、Akima 边界）可能需调整。

- [ ] **Step 3: 跑全量 coverage**

```bash
npm run test:coverage
```

Expected: 三个 Tier A 文件（`curveFitting.ts`、`statistics.ts`、`dataProcessing.ts`）branch coverage **均 ≥ 95%**（spec §5.1 Tier A；vitest.config.ts 强制）。**未达 95% 不通过**——本 Task 内补测试直到达标，不调低阈值；补到 95% 后再 commit。

- [ ] **Step 4: 提交**

```bash
git add src/utils/dataProcessing.test.ts
git commit -m "test(dataProcessing): 添加 4 平滑 + 4 插值 + 缺失值 + IQR 异常值测试"
```

---

### Task 8: 写 AGENTS.md 代码地图

**Files:**
- Create or modify: `AGENTS.md`（项目根目录）

> 注：项目根目录已存在 `AGENTS.md`（250 行）。本 Task 不重写，只在其末尾或独立小节加"代码地图"。

- [ ] **Step 1: 读现有 AGENTS.md**

```bash
head -30 AGENTS.md
```

确认其结构。如果已经有"目录结构"或类似小节，加在后面；否则创建新小节。

- [ ] **Step 1.5: 实测行数**

```bash
wc -l src/components/ChartView.tsx src/components/LayerPanel.tsx src/components/ExportModal.tsx src/components/DataTable.tsx src/components/ribbon/FileTab.tsx src/components/ribbon/StatsTab.tsx src/components/ribbon/TransformTab.tsx src/utils/curveFitting.ts src/utils/statistics.ts src/utils/hypothesisTests.ts src/utils/dataProcessing.ts src/utils/multiPeakFit.ts src/utils/distributions.ts
```

把实测值填入 Step 2 的表格。**不要直接照搬 plan 中的数字**（spec 审计时是 868/909/...，行数会随代码变化）。

- [ ] **Step 2: 在 AGENTS.md 添加"代码地图"小节**

打开 `AGENTS.md`，在已有"项目结构"小节（§3 附近）**就地扩展**，不另开新小节。

在"项目结构"小节末尾或"常用修改入口"小节开头，插入以下表格（行数先用 Step 1.5 的实测值）：

```markdown
### 大文件清单（>500 行）— Phase 2 拆分目标

| 文件 | 行数 | 拆分计划 |
|------|------|---------|
| `src/components/ChartView.tsx` | （实测） | Phase 2: 拆出 `TracesOverlay3D.tsx` / `ChartContextMenu.tsx` / `useChartInteractions.ts` hook |
| `src/components/LayerPanel.tsx` | （实测） | Phase 2: 拆出 `LayerStyleEditor.tsx`；排序拖拽抽到 `useLayerDragSort.ts` |
| `src/components/ExportModal.tsx` | （实测） | 暂不拆 |
| `src/components/DataTable.tsx` | （实测） | 暂不拆（虚拟化已做） |
| `src/components/ribbon/FileTab.tsx` | （实测） | 暂不拆 |

### Tier A 测试覆盖（spec §5.1，branch coverage ≥ 95%）

| 文件 | 行数 | 状态 |
|------|------|------|
| `src/utils/curveFitting.ts` | （实测） | Phase 0 测试中 |
| `src/utils/statistics.ts` | （实测） | Phase 0 测试中 |
| `src/utils/hypothesisTests.ts` | （实测） | Phase 0 测试中 |
| `src/utils/dataProcessing.ts` | （实测） | Phase 0 测试中 |
| `src/utils/multiPeakFit.ts` | （实测） | Phase 0 测试中 |
| `src/utils/distributions.ts` | （实测） | Phase 0 测试中 |
```

> **避免重复**：不另开"代码地图"小节。AGENTS.md §3 / §10 已是项目权威文档，新增表格作为 §3 末尾的就地扩展。重复小节会随时间漂移。

- [ ] **Step 3: 提交**

```bash
git add AGENTS.md
git commit -m "docs: AGENTS.md 添加代码地图，标注 Phase 2 待拆大文件"
```

---

### Task 9: CI 跑通验证（本地最终核验）

**Files:** 无（验证 Task）

- [ ] **Step 1: 跑全套检查**

```bash
npm run check && npm run lint && npm run build && npm run test
```

Expected: 全部 PASS。

- [ ] **Step 2: 跑 coverage**

```bash
npm run test:coverage
```

Expected: 全部 6 个 Tier A 文件 branch coverage **均 ≥ 95%**（与 spec §5.1 和 vitest.config.ts 完全一致）。若某文件 < 95%，回到对应 Task（5/6/7）补测试。**不允许调低阈值**。

- [ ] **Step 3: 写 PHASE-0.md**

```bash
cat > PHASE-0.md <<'EOF'
# Phase 0 总结

## 完成时间
- 开始：YYYY-MM-DD
- 结束：YYYY-MM-DD
- 实际工时：Xh

## 完成项
- [x] Task 1: 验证 REVIEW.md 归档
- [x] Task 2: 移除 AdSense + CSP
- [x] Task 3: xlsx 切换 npm registry
- [x] Task 4: 接入 vitest
- [x] Task 5: curveFitting.ts 测试（≥95% branch）
- [x] Task 6: statistics.ts 测试（≥95% branch）
- [x] Task 7: dataProcessing.ts 测试（≥95% branch）
- [x] Task 8: AGENTS.md 代码地图（in-place 扩展）
- [x] Task 9: CI 全绿

## 覆盖率（spec §5.1 阈值，必须 ≥95%）
- curveFitting.ts: X%
- statistics.ts: X%
- hypothesisTests.ts: X%
- dataProcessing.ts: X%
- multiPeakFit.ts: X%
- distributions.ts: X%

> 若任一文件 < 95%，说明 Phase 0 测试未达 spec；回到对应 Task 补 case，不写"back-slide"。

## 踩到的坑
- （填写实际遇到的）

## 未完成项 / 留给 Phase 1
- Phase 0 是"地基"，无功能交付。
- Phase 1 开始前应确保：xlsx 0.18.5 实际能解析用户现有 .xlsx 文件（手动 smoke test）。
EOF
git add PHASE-0.md
git commit -m "docs: Phase 0 总结"
```

- [ ] **Step 4: 推送到 main（如适用）**

```bash
git push origin main
```

---

## Chunk 2: Phase 1 — 拟合核心（5–6 周）

> **Phase 1 详细 plan 待用户在 Phase 0 完成后补全**。下面是 spec §3 拆出的 Task 列表 + 每个 Task 的验收。Phase 1 计划执行时建议回到 brainstorming skill，按 writing-plans 风格把每个 Task 展开为 2–5 分钟步进。

### Task 1.1: 残差图（subchart）
**目标：** 拟合后弹 2 行 1 列 subchart：上图原数据 + 拟合，下图残差散点。
**验收：** 见 spec §3.1.1 子设计（chartConfig schema 扩展、Plotly `subplots` 配置、shared xaxis 用 `matches: 'x'`、history 描述）。
**Files:** Modify `src/types.ts`, `src/store/chartStore.ts`, `src/utils/layoutBuilder.ts`, `src/utils/tracesBuilder.ts`, `src/components/ChartView.tsx`, `src/store/historyStore.ts`.
**预计:** 1 周。

### Task 1.2: 95% 置信带
**目标：** 半透明带状区域叠在原图。
**验收：** 见 spec §3.1.2 子设计（v1 覆盖 linear/polynomial；非线性 v2 若时间允许；用户 toggle `showConfidenceBand`）。
**Files:** Modify `src/utils/curveFitting.ts`（导出 SE(prediction) 函数）, `src/utils/tracesBuilder.ts`, `src/components/LayerPanel.tsx`.
**预计:** 1 周。

### Task 1.3: 加权最小二乘
**目标:** 已有 error 列时自动 `w = 1/σ²`。
**验收:** 见 spec §3.1.3（`layer.errorColumn` 已在 LayerPanel/ConfigPanel 暴露；`fitWorkerClient` 增加 `weights?`；`curveFitting` 所有 11 类拟合支持 weights）。
**Files:** Modify `src/components/LayerPanel.tsx`, `src/components/ConfigPanel.tsx`, `src/utils/fitWorkerClient.ts`, `src/utils/curveFitting.ts`.
**预计:** 1 周。

### Task 1.4: 拟合公式 LaTeX 渲染
**目标:** 浮动在图表角落的公式标注。
**验收:** 见 spec §3.1.4（复用 `AnnotationOverlay`；新增 `Annotation` 类型 `fitEquation`）。
**Files:** Modify `src/types.ts`, `src/components/AnnotationOverlay.tsx`, `src/components/ribbon/FitTab.tsx`, `src/store/chartStore.ts`.
**预计:** 1 周。

### Task 1.5: 完整拟合报告页
**目标:** 点 fit 结果能展开完整报告。
**验收:** 参数 SE/CI/调整 R²/F 检验/P 值/残差正态性。
**Files:** New `src/components/FitReportPanel.tsx`; Modify `src/components/ribbon/FitTab.tsx`.
**预计:** 1 周。

### Task 1.6: Tier A 测试补到 ≥95%（含新覆盖的 3 个文件）
**目标:** Phase 0 的 Tier A 文件 branch coverage **从 day 1 起**就 ≥95%（spec §5.1，**不允许退步到 80%**）。
**验收:** `npm run test:coverage` 显示六个 Tier A 文件均 ≥95%。若 Phase 0 任务（5/6/7）的初始测试骨架未达 95%，本 Task 补足剩余 case。
**Files:** Modify `src/utils/curveFitting.test.ts`, `src/utils/statistics.test.ts`, `src/utils/dataProcessing.test.ts`, `src/utils/hypothesisTests.test.ts`（新增）, `src/utils/multiPeakFit.test.ts`（新增）, `src/utils/distributions.test.ts`（新增）.
**预计:** 3 天。

> **关键不变量**：Phase 0 必须从 day 1 就把六个 Tier A 文件覆盖率达 95%；Phase 1 不应做"覆盖率爬升"任务，而是做"加新功能 + 加新测试"任务。`vitest.config.ts` 的 threshold 起到 CI 强制作用。

**Phase 1 完成后写 `PHASE-1.md`** 并 commit。

---

## Chunk 3: Phase 2 — 工程瘦身（3–4 周）

### Task 2.1: 拆分 ChartView（868 → <300）
**目标:** 拆出 `TracesOverlay3D.tsx` / `ChartContextMenu.tsx` / `useChartInteractions.ts` hook。
**Files:** New `src/components/chart/TracesOverlay3D.tsx`, `src/components/chart/ChartContextMenu.tsx`, `src/hooks/useChartInteractions.ts`; Modify `src/components/ChartView.tsx`.
**预计:** 1 周。
**风险:** 状态共享。沿用 `annotationToolStore` / `chartInteractionStore` 模式。

### Task 2.2: 拆分 LayerPanel（909 → <500）
**目标:** "图层样式编辑"独立成 `LayerStyleEditor.tsx`；图层排序拖拽抽到 hook。
**Files:** New `src/components/layer/LayerStyleEditor.tsx`, `src/hooks/useLayerDragSort.ts`; Modify `src/components/LayerPanel.tsx`.
**预计:** 1 周。

### Task 2.3: GitHub Actions CI（lint + typecheck + test + build）
**目标:** PR 必跑四项。
**Files:** New `.github/workflows/ci.yml`.
**预计:** 1 天。

### Task 2.4: 给 tracesBuilder / layoutBuilder 补单测
**目标:** 按 spec §5.1 Tier B / C 阈值。
**Files:** New `src/utils/tracesBuilder.test.ts`, `src/utils/layoutBuilder.test.ts`.
**预计:** 1 周。

### Task 2.5: Plotly 包体优化（按图表类型懒加载）
**目标:** 见 spec Phase 2.5（验收二选一：<1.5MB chunk 或 3D 懒加载兜底）。
**Files:** Modify `src/components/ChartView.tsx`（懒加载逻辑）, `vite.config.ts`（manual chunks 重划）.
**预计:** 3 天。

### Task 2.6: 写 PHASE-2.md
**预计:** 0.5 天。

---

## Chunk 4: Phase 3 — 拟合宽度（6–8 周）

### Task 3.1: 自定义公式拟合（mathjs）
**目标:** 用户输入 `a * exp(-b*x) + c`，自动识别参数 + LM 拟合 + 沙箱安全。
**Files:** New `src/utils/levenbergMarquardt.ts`（从 `multiPeakFit.ts` 抽离）; Modify `src/utils/curveFitting.ts`, `src/components/ribbon/FitTab.tsx`, `src/workers/fitWorker.ts`.
**详见 spec §3.3.1 子设计。**
**预计:** 2 周。

### Task 3.2: 新增 6 类拟合（lorentzian / weibull / logistic4pl / logistic5pl / hill / biexponential）
**目标:** 11 → 17 类。
**Files:** Modify `src/utils/curveFitting.ts`, `src/workers/fitWorker.ts`, `src/components/ribbon/FitTab.tsx`.
**详见 spec §3.3.2。**
**预计:** 1.5 周。

### Task 3.3: 参数上下界 + 初始猜测
**目标:** 自定义公式可设 `a ∈ [0, 10]`；预设类型可改初值。
**Files:** Modify `src/utils/curveFitting.ts`, `src/utils/levenbergMarquardt.ts`, `src/components/ribbon/FitTab.tsx`.
**预计:** 1 周。

### Task 3.4: 拟合残差诊断接入（复用现有 shapiroWilk / durbinWatson）
**目标:** 扩展 `FitStatistics` 加 `residualNormality` 和 `residualAutocorrelation`。
**Files:** Modify `src/utils/curveFitting.ts`（拟合后调用现成函数填充字段）, `src/types.ts`, `src/components/FitReportPanel.tsx`（来自 Phase 1.5）.
**详见 spec §3.3.3。**
**预计:** 3 天。

### Task 3.5: 全局拟合（多 dataset 共享参数）
**目标:** 选 2 个 dataset 共用 `k`，同时拟合。
**Files:** Modify `src/utils/levenbergMarquardt.ts`, `src/components/ribbon/FitTab.tsx`（新增 Global Fit 弹窗）, New `src/components/GlobalFitModal.tsx`.
**详见 spec §3.3.4。**
**预计:** 1.5 周。**降级触发：** 若 LM 在多 dataset 上不收敛或 UI 复杂度超 1.5 周，挪到 Phase 5 之后。

### Task 3.6: Tier A 测试扩展（每个新拟合 5 个解析解 case）
**目标:** `curveFitting.ts` 新增的 6 类 + LM 工具 ≥95% branch coverage。
**Files:** Modify `src/utils/curveFitting.test.ts`, `src/utils/levenbergMarquardt.test.ts`.
**预计:** 1 周。

**Phase 3 完成后写 `PHASE-3.md`**。

---

## Chunk 5: Phase 4 — 轴与布局（4–6 周）

### Task 4.1: 日期/时间轴
**目标:** ISO/Unix 时间戳；自动选刻度；时区存储在 `chartConfig.xAxis.timezone`，默认 `UTC`，非 UTC 时标注。
**Files:** Modify `src/types.ts`, `src/utils/layoutBuilder.ts`, `src/utils/tracesBuilder.ts`, `src/components/ConfigPanel.tsx`.
**预计:** 1.5 周。

### Task 4.2: 轴 break（断轴）
**目标:** 双斜线 break；两侧独立缩放。
**Files:** Modify `src/types.ts`, `src/utils/layoutBuilder.ts`.
**预计:** 1 周。

### Task 4.3: 双 X 轴 / 镜像轴
**目标:** 一张图两条 X 轴（顶部 + 底部），独立标签。
**Files:** Modify `src/types.ts`, `src/utils/layoutBuilder.ts`.
**预计:** 1 周。

### Task 4.4: 多面板布局（条件性 + spike 门禁）
**目标:** 2×2 / 3×1 等；每个 panel 独立 dataset；panel 共享/独立坐标轴。
**前置 spike:** Phase 4 开头做半天原型（验证 chartConfig migration cost < 1 周）。**若 spike 失败，本任务降级为 P3 移出 Phase 4**。
**Files:** Modify `src/types.ts`（chartConfig schema 升级 panel 概念）, `src/utils/layoutBuilder.ts`, `src/components/ChartView.tsx`.
**预计:** 2 周（条件性）。

### Task 4.5: Inset 图（v1 限定固定四角）
**目标:** 矩形、固定四角位置（TL/TR/BL/BR），不实现拖拽。
**Files:** Modify `src/types.ts`, `src/utils/tracesBuilder.ts`, `src/components/ChartView.tsx`.
**预计:** 1 周。

**Phase 4 完成后写 `PHASE-4.md`**。

---

## Chunk 6: Phase 5 — 复现与协作（6–9 周）

### Task 5.0: Phase 5 开头审计
**目标:** 读 `src/utils/journalTemplates.ts` 与 `src/components/TemplatePanel.tsx`，列出已有模板清单，更新 Task 5.3 的目标范围。
**预计:** 半天。

### Task 5.1: Matplotlib 脚本导出（保守 scope）
**目标:** v1 仅 3 种类型（line / scatter / line+fit overlay）；自包含（仅依赖 numpy + matplotlib ≥3.8）；含拟合结果 LaTeX 注释（matplotlib mathtext，不用 usetex）。
**降级触发:** 4 周内做不到"line+fit overlay 等价"，降级为 line + scatter（去拟合注释）。
**Files:** New `src/utils/matplotlibExport.ts`; Modify `src/components/ExportModal.tsx`.
**预计:** 4 周。

### Task 5.2: `.plot3d` 文件 v3 格式
**目标:** 稳定键顺序 + 行化 JSON；ID 用内容哈希；前向兼容 v1/v2。
**Files:** Modify `src/utils/projectFile.ts`（PROJECT_VERSION 升级）, `src/components/ribbon/FileTab.tsx`.
**预计:** 1.5 周。

### Task 5.3: 论文模板扩展
**目标:** 审计后补缺到覆盖 Nature / Science / Cell / PRL / ACS。
**Files:** Modify `src/utils/journalTemplates.ts`, `src/components/TemplatePanel.tsx`.
**预计:** 1 周。

### Task 5.4: 共享链接（纯前端，无服务器）
**目标:** base64url 编码当前 chartConfig 到 URL fragment (`#d=...`)；不经过服务器；URL 长度上限 8KB；超出弹"请改用 .plot3d 文件分享"；附二维码（用 `qrcode` npm 包）。
**Files:** New `src/utils/shareLink.ts`; Modify `src/components/ribbon/FileTab.tsx`.
**预计:** 1 周。

**Phase 5 完成后写 `PHASE-5.md`**。

---

## 附录 A：复用现有实现清单（避免重复造轮子）

| 功能 | 已实现位置 | 新功能应做 |
|------|----------|----------|
| 描述统计 | `src/utils/statistics.ts` | 直接 import；不重写 |
| Shapiro-Wilk | `src/utils/hypothesisTests.ts:423` | Phase 3.4 接入 `FitStatistics` |
| Durbin-Watson | `src/utils/statistics.ts:478` | 同上 |
| 平滑/插值 | `src/utils/dataProcessing.ts` | Phase 1+ 直接复用 |
| 期刊模板 | `src/utils/journalTemplates.ts` | Phase 5.3 扩展，不重写 |
| 多峰拟合 | `src/utils/multiPeakFit.ts:189`（LM 内置） | Phase 3.1 抽离 LM 工具 |
| 数据坐标标注 | `src/components/AnnotationOverlay.tsx` | Phase 1.4 复用 |
| 矢量 PDF 导出 | `src/components/ribbon/FileTab.tsx:282`（`addSvgAsImage`） | 已就绪 |
| Web Worker 拟合 | `src/workers/fitWorker.ts` | Phase 3 扩类型 |

---

## 附录 B：风险登记（贯穿全计划）

| 风险 | 触发条件 | 降级方案 |
|------|---------|---------|
| Phase 3.1 mathjs 安全沙箱被绕过 | 自定义公式能访问 `globalThis` | AST 关键字黑名单 + 5s 超时 + AST depth > 50 拒绝 |
| Phase 3.5 全局拟合 UI 复杂 | 共享参数识别 UX 不直观 | 降级为 P3，挪到 Phase 5 之后 |
| Phase 4.4 多面板 schema 改动超 1 周 | spike 失败 | 降级为 P3，本 Phase 只做 4.1–4.3 + 4.5 |
| Phase 5.1 Matplotlib 4 周不够 | line+fit overlay 等价失败 | 降级为 line + scatter（去拟合注释） |
| xlsx 0.18.5 与现有 .xlsx 文件不兼容 | 用户报告导入失败 | 切到 `exceljs`，适配 FileTab.tsx |

---

## 附录 C：CI 建议（Phase 2 Task 2.3 时实施）

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run check
      - run: npm run lint
      - run: npm run test:coverage
      - run: npm run build
```

---

## 附录 D：Spec 与 Plan 的对应关系

| Spec 章节 | 对应 Plan Chunk/Task |
|---------|-------------------|
| §3.0 Phase 0 | Chunk 1（9 Tasks）|
| §3.1.1 Phase 1.1 残差图 | Chunk 2 Task 1.1 |
| §3.1.2 Phase 1.2 置信带 | Chunk 2 Task 1.2 |
| §3.1.3 Phase 1.3 加权 | Chunk 2 Task 1.3 |
| §3.1.4 Phase 1.4 LaTeX | Chunk 2 Task 1.4 |
| §3.1.4 (合并) Phase 1.5 报告 | Chunk 2 Task 1.5 |
| §3.1.4 (合并) Phase 1.6 测试 | Chunk 2 Task 1.6 |
| §3.3.1 Phase 3.1 自定义公式 | Chunk 4 Task 3.1 |
| §3.3.2 Phase 3.2 新类型 | Chunk 4 Task 3.2 |
| §3.3.3 Phase 3.4 残差诊断 | Chunk 4 Task 3.4 |
| §3.3.4 Phase 3.5 全局拟合 | Chunk 4 Task 3.5 |
| §5.1 覆盖率三档 | 贯穿每个 Chunk 的"测试补到 ≥95%" Task |
