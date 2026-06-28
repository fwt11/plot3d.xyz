import { defineConfig } from 'vitest/config';

export default defineConfig({
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
        'src/utils/curveFitting.ts': { branches: 95, functions: 95, lines: 95 },
        'src/utils/statistics.ts': { branches: 95, functions: 95, lines: 95 },
        'src/utils/dataProcessing.ts': { branches: 95, functions: 95, lines: 95 },
      },
    },
  },
  // 不写 resolve.alias —— vite-tsconfig-paths 插件（vite.config.ts:29）
  // 已处理 '@/*' 路径，vitest 通过 vite 配置自动继承。
});
