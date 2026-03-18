import { defineConfig, transformWithEsbuild } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    // Pre-transform .js files as JSX before Vite's import analysis runs.
    // Needed because CRA processed all .js files as JSX; Vite does not by default.
    {
      name: 'treat-js-files-as-jsx',
      async transform(code, id) {
        if (!id.match(/src\/.*\.js$/) || id.includes('node_modules')) return null
        return transformWithEsbuild(code, id, { loader: 'jsx', target: 'esnext' })
      },
    },
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:11434',
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: false,
  },
  optimizeDeps: {
    force: true,
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
})
