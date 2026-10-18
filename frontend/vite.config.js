import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Django dev server; another port can be set with API_URL=http://localhost:8001 npm run dev
const backend = process.env.API_URL || 'http://localhost:8000'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': backend,
      '/media': backend,
    },
  },
})
