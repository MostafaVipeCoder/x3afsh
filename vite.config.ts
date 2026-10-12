import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// On GitHub Pages the site lives under /<repo-name>/ — the deploy workflow passes --base.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
})
