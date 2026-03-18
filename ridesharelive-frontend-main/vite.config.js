import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }
          if (id.includes('react') || id.includes('motion')) {
            return 'react-vendor'
          }
          if (id.includes('three')) {
            return 'three-vendor'
          }
          if (
            id.includes('@stomp/stompjs') ||
            id.includes('locomotive-scroll') ||
            id.includes('velocity-animate')
          ) {
            return 'ui-vendor'
          }
          return 'vendor'
        },
      },
    },
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
