import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: false,
      },
    },
  },
  preview: { host: '0.0.0.0', allowedHosts: ['.vercel.app'] },
})
