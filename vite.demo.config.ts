import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1800,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": __dirname,
    },
  },
})
