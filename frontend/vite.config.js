import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Django dev server. API_URL wins; otherwise the port that `python manage.py runserver` wrote to
// backend/.port (it picks a free one), otherwise 8000. Start the backend first.
function backendUrl() {
  if (process.env.API_URL) return process.env.API_URL
  try {
    const port = readFileSync(new URL('../backend/.port', import.meta.url), 'utf8').trim()
    if (/^\d+$/.test(port)) return `http://localhost:${port}`
  } catch {
    /* backend not started yet or not using the port file */
  }
  return 'http://localhost:8000'
}
const backend = backendUrl()

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': backend,
      '/media': backend,
    },
  },
})
