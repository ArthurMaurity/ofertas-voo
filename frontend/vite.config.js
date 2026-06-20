import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// O `base` precisa casar com o nome do repositório no GitHub Pages
// (https://<user>.github.io/<repo>/). Sobrescreva via VITE_BASE se o
// repositório tiver outro nome. Para domínio próprio, use "/".
const base = process.env.VITE_BASE || '/ofertas-voo/'

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1600,
  },
})
