import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // pdfjs-dist is large; keep the warning quiet without hiding real regressions.
    chunkSizeWarningLimit: 1600,
  },
})
