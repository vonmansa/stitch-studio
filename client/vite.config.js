import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxies /api and /uploads to the Express server during development, so
// the React app can call fetch('/api/projects') without dealing with CORS
// or hardcoding http://localhost:4000 everywhere.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
})
