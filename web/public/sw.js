/* Service worker cho bản GitHub Pages.
 *
 * Chiến lược tách đôi, rất quan trọng với app dùng asset có hash:
 *
 *  - Điều hướng trang (index.html): NETWORK-FIRST. File HTML trỏ tới tên bundle
 *    có hash; nếu phục vụ HTML cũ từ cache sau khi đã deploy bản mới thì nó sẽ
 *    trỏ tới file JS không còn tồn tại và người dùng nhận một trang trắng.
 *    Mạng hỏng mới rơi về bản cache.
 *  - Asset có hash (/assets/...): CACHE-FIRST. Tên đã chứa hash nên không bao
 *    giờ đụng độ phiên bản.
 *  - Mọi thứ khác (nhất là endpoint lấy giờ): KHÔNG đụng vào. Một dấu thời gian
 *    cũ còn tệ hơn là không có dấu thời gian nào.
 */

const VERSION = 'v2'
const CACHE = `mittohoa-timeis-${VERSION}`
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './icon.svg']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => {})))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(request) {
  try {
    const res = await fetch(request)
    if (res.ok) {
      const copy = res.clone()
      void caches.open(CACHE).then((c) => c.put('./index.html', copy))
    }
    return res
  } catch {
    const cached = (await caches.match(request)) ?? (await caches.match('./index.html'))
    return cached ?? Response.error()
  }
}

async function cacheFirst(request) {
  const hit = await caches.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok && res.type === 'basic') {
    const copy = res.clone()
    void caches.open(CACHE).then((c) => c.put(request, copy))
  }
  return res
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  // Chỉ can thiệp vào asset cùng origin; request lấy giờ luôn đi thẳng ra mạng.
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req))
    return
  }

  event.respondWith(cacheFirst(req))
})
