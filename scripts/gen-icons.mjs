/**
 * Sinh bộ icon PNG từ cùng một bản vẽ với icon.svg.
 *
 * Tự rasterize và tự đóng gói PNG bằng zlib có sẵn của Node, nên không cần cài
 * thêm gói nào (sharp/canvas) — CI cũng chạy được ngay.
 *
 *   node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// ------------------------------------------------------------------ bảng màu
const BG = [0x0b, 0x0f, 0x17]
const RING = [0x1f, 0x6f, 0xeb]
const HAND = [0xe8, 0xed, 0xf7]
const HUB = [0x66, 0xa3, 0xff]
const TICK = [0x93, 0xa0, 0xb8]

// --------------------------------------------------------------- vẽ ảnh nền
/**
 * Vẽ icon ở kích thước `size`, lấy mẫu 3x3 mỗi pixel để cạnh không bị răng cưa.
 * @param {number} size
 * @param {boolean} maskable nền phủ kín toàn khung (Android sẽ tự bo góc)
 */
function draw(size, maskable) {
  const px = Buffer.alloc(size * size * 4)
  const u = size / 512 // hệ số quy đổi từ hệ toạ độ 512 của bản vẽ gốc
  const SS = 3
  // Icon maskable phải chịu được vùng an toàn 80% -> thu nhỏ hình vẽ lại.
  const scale = maskable ? 0.78 : 1
  const cx = 256
  const cy = 256

  /** Toạ độ trong hệ 512 -> màu, hoặc null nếu trong suốt. */
  const shade = (x, y) => {
    // đưa về hệ toạ độ đã co lại quanh tâm
    const sx = (x - cx) / scale + cx
    const sy = (y - cy) / scale + cy

    const inCard = maskable ? true : roundedSquare(x, y, 0, 0, 512, 512, 112)
    if (!inCard) return null

    const r = Math.hypot(sx - cx, sy - cy)

    // vòng tròn mặt đồng hồ
    if (Math.abs(r - 156) <= 10) return RING
    // trục giữa
    if (r <= 18) return HUB
    // kim giờ và kim phút
    if (onSegment(sx, sy, 256, 256, 256, 142, 11)) return HAND
    if (onSegment(sx, sy, 256, 256, 338, 296, 11)) return HAND
    // 4 vạch chỉ hướng
    if (roundedSquare(sx, sy, 248, 72, 16, 30, 8)) return TICK
    if (roundedSquare(sx, sy, 248, 410, 16, 30, 8)) return TICK
    if (roundedSquare(sx, sy, 72, 248, 30, 16, 8)) return TICK
    if (roundedSquare(sx, sy, 410, 248, 30, 16, 8)) return TICK

    return BG
  }

  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (pxi + (sx + 0.5) / SS) / u
          const y = (py + (sy + 0.5) / SS) / u
          const c = shade(x, y)
          if (c) {
            r += c[0]
            g += c[1]
            b += c[2]
            a += 255
          }
        }
      }
      const n = SS * SS
      const i = (py * size + pxi) * 4
      const cover = a / (255 * n)
      // Nhân sẵn alpha để biên không bị viền tối.
      px[i] = cover ? Math.round(r / (n * cover)) : 0
      px[i + 1] = cover ? Math.round(g / (n * cover)) : 0
      px[i + 2] = cover ? Math.round(b / (n * cover)) : 0
      px[i + 3] = Math.round(a / n)
    }
  }
  return px
}

function roundedSquare(x, y, left, top, w, h, radius) {
  const rx = Math.min(radius, w / 2)
  const ry = Math.min(radius, h / 2)
  const right = left + w
  const bottom = top + h
  if (x < left || x > right || y < top || y > bottom) return false
  const dx = x < left + rx ? left + rx - x : x > right - rx ? x - (right - rx) : 0
  const dy = y < top + ry ? top + ry - y : y > bottom - ry ? y - (bottom - ry) : 0
  if (dx === 0 || dy === 0) return true
  return (dx / rx) ** 2 + (dy / ry) ** 2 <= 1
}

/** Khoảng cách từ điểm tới đoạn thẳng có bo đầu, so với nửa độ dày. */
function onSegment(x, y, x1, y1, x2, y2, half) {
  const vx = x2 - x1
  const vy = y2 - y1
  const len2 = vx * vx + vy * vy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * vx + (y - y1) * vy) / len2))
  return Math.hypot(x - (x1 + t * vx), y - (y1 + t * vy)) <= half
}

// ------------------------------------------------------------- đóng gói PNG
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // truecolour + alpha
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ------------------------------------------------------------------- xuất ra
/** @type {Array<[string, number, boolean]>} */
const TARGETS = [
  // PWA
  ['web/public/icon-192.png', 192, false],
  ['web/public/icon-512.png', 512, false],
  ['web/public/icon-maskable-512.png', 512, true],
  // Tauri desktop
  ['src-tauri/icons/32x32.png', 32, false],
  ['src-tauri/icons/128x128.png', 128, false],
  ['src-tauri/icons/128x128@2x.png', 256, false],
  ['src-tauri/icons/icon.png', 512, false],
]

for (const [rel, size, maskable] of TARGETS) {
  const out = join(ROOT, rel)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, encodePng(size, draw(size, maskable)))
  console.log(`${rel}  ${size}x${size}${maskable ? ' (maskable)' : ''}`)
}

// ----------------------------------------------------------------- icon.ico
/**
 * `tauri-build` BẮT BUỘC phải có file này khi build cho Windows — thiếu là build
 * hỏng ngay từ khâu tạo Windows Resource. Thiếu nó từng làm cả lần build
 * `npm run desktop:build` chết, mà npm vẫn trả exit code 0 nên rất dễ bỏ sót.
 *
 * Từ Windows Vista trở đi, ICO cho phép nhúng thẳng dữ liệu PNG vào từng mục,
 * nên tái dùng luôn bộ mã hoá PNG ở trên thay vì phải viết thêm phần bitmap thô.
 */
function encodeIco(sizes) {
  const images = sizes.map((size) => ({ size, data: encodePng(size, draw(size, false)) }))

  const HEADER = 6
  const ENTRY = 16
  const header = Buffer.alloc(HEADER)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // 1 = icon
  header.writeUInt16LE(images.length, 4)

  let offset = HEADER + ENTRY * images.length
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(ENTRY)
    // 256 được ghi bằng 0 — ICO chỉ dành một byte cho mỗi chiều.
    e.writeUInt8(size >= 256 ? 0 : size, 0)
    e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt8(0, 2) // số màu trong bảng màu (0 = không dùng bảng màu)
    e.writeUInt8(0, 3) // reserved
    e.writeUInt16LE(1, 4) // color planes
    e.writeUInt16LE(32, 6) // bits per pixel
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += data.length
    return e
  })

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)])
}

{
  const rel = 'src-tauri/icons/icon.ico'
  const sizes = [16, 32, 48, 64, 128, 256]
  const out = join(ROOT, rel)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, encodeIco(sizes))
  console.log(`${rel}  ${sizes.join(', ')}`)
}

console.log('\nXong.')
