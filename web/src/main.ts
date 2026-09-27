import './style.css'
import { mountApp } from './ui/app'
import { isNativeShell } from './core/sources'

const root = document.getElementById('app')
if (!root) throw new Error('#app không tồn tại')

mountApp(root)

// Màn hình chờ chỉ biến mất khi UI đã vẽ xong khung đầu tiên — Play yêu cầu app
// không được hiện trang trắng lúc khởi động (chính sách Minimum Functionality).
requestAnimationFrame(() => {
  document.body.classList.add('ready')
})

// Service worker chỉ dùng cho bản web (GitHub Pages). Bên trong vỏ Tauri asset
// đã nằm sẵn trên máy nên đăng kí thêm là thừa.
if (!isNativeShell() && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* không có SW vẫn chạy bình thường */
    })
  })
}
