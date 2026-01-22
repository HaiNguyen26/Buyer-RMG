import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    open: true,
    port: 5173,
    hmr: {
      overlay: true, // Hiển thị lỗi overlay
    },
    watch: {
      usePolling: false, // Tắt polling (mặc định)
    },
  },
})
