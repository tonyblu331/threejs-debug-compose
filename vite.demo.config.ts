import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1800,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": __dirname,
      "threejs-debug-view/r3f": resolve(__dirname, "components/debug-views/r3f.ts"),
      "threejs-debug-view": resolve(__dirname, "components/debug-views/index.ts"),
    },
  },
})
