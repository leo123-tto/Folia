import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const nodeModule = String.raw`node_modules[\\/]`

// https://vite.dev/config/
export default defineConfig({
  root: projectRoot,
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: new RegExp(`${nodeModule}(react|react-dom)[\\/]`),
              priority: 50,
            },
            {
              name: 'editor-vendor',
              test: new RegExp(`${nodeModule}(@codemirror|@uiw|style-mod|w3c-keyname|crelt)[\\/]`),
              priority: 45,
              maxSize: 450_000,
            },
            {
              name: 'tauri-vendor',
              test: new RegExp(`${nodeModule}@tauri-apps[\\/]`),
              priority: 40,
            },
            {
              name: 'docx-vendor',
              test: new RegExp(`${nodeModule}(docx|mammoth|jszip|pako|saxes|xmlbuilder2|@xmldom)[\\/]`),
              priority: 35,
              maxSize: 450_000,
            },
            {
              name: 'vditor-vendor',
              test: new RegExp(`${nodeModule}vditor[\\/]`),
              priority: 30,
              maxSize: 450_000,
            },
            {
              name: 'ui-vendor',
              test: new RegExp(`${nodeModule}lucide-react[\\/]`),
              priority: 25,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./src/test/setupVitest.ts'],
  },
})
