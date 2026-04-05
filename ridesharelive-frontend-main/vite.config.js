import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      external: ['leaflet-routing-machine'],
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
        }
      },
    },
  },
  optimizeDeps: {
    include: ['leaflet-routing-machine'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: true,
    include: ['src/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['e2e/**', 'playwright.config.js', 'node_modules/**'],
  },
})
