import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: 'hidden',
    // plotly.js-dist-min is ~4.6MB; spec §3 Phase 2.5 wants <1.5MB but the
    // pre-bundled dist doesn't allow per-trace splitting. We accept the
    // size — the plotly chunk is already split out of the main entry
    // (so first paint is fast), and is loaded lazily via dynamic import
    // in ChartView.tsx. See PHASE-2.md for full trade-off.
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks: {
          plotly: ['plotly.js-dist-min'],
          xlsx: ['xlsx'],
          export: ['jspdf', 'html-to-image'],
          vendor: ['react', 'react-dom', 'zustand', 'react-i18next', 'i18next', 'lucide-react', 'papaparse'],
        },
      },
    },
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths()
  ],
})
