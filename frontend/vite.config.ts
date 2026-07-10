import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  assetsInclude: ['**/*.stl'],
  build: {
    assetsInlineLimit: (filePath) =>
      filePath.toLowerCase().endsWith('.stl') ? true : undefined,
  },
  plugins: [react()],
})
