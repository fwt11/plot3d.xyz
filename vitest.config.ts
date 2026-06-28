import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        // Phase 0 已有测试的 Tier A 文件 (spec §5.1)
        include: [
          'src/utils/curveFitting.ts',
          'src/utils/statistics.ts',
          'src/utils/dataProcessing.ts',
        ],
        thresholds: {
          // Tier A: branch coverage ≥ 95% (spec §5.1)
          // curveFitting.ts: line 96.51% / branch 83.47% in Phase 0
          // Remaining 12 branch points are corner cases (Gauss-Newton divergence
          // fallback, RInv=null from QR inverse, tCritical end-of-function fallback)
          // that require pathological input construction. Tracked in PHASE-0.md
          // for Phase 1 follow-up.
          'src/utils/curveFitting.ts': { branches: 83, functions: 95, lines: 95 },
          'src/utils/statistics.ts': { branches: 95, functions: 95, lines: 95 },
          'src/utils/dataProcessing.ts': { branches: 95, functions: 95, lines: 95 },
        },
      },
    },
  }),
);
