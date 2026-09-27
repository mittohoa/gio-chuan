import { defineConfig } from 'vite'

// BASE cho GitHub Pages: đặt biến môi trường BASE_PATH='/<tên-repo>/' khi build Pages.
// Khi build cho Tauri (desktop/Android) luôn dùng './' vì asset nạp từ file cục bộ.
const base = process.env.BASE_PATH ?? './'

export default defineConfig({
  base,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    // Tauri tự bundle asset -> không cần sourcemap trong bản phát hành
    sourcemap: false,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || 'localhost',
  },
  clearScreen: false,
})
