/**
 * Server tạm để xuất ảnh bìa Play Store.
 *
 * Chrome không cho mở file:// qua công cụ tự động, và ảnh chụp màn hình trả về
 * JPEG kích thước theo khung nhìn chứ không phải 1024x500. Nên trang tự vẽ bằng
 * Canvas rồi POST file PNG về đây, server ghi thẳng ra đĩa — đúng tới từng pixel.
 *
 *   node design/serve.mjs      rồi mở http://localhost:4600/
 */
import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PORT = 4600
const OUT = 'feature-graphic.png'

createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/save') {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const buf = Buffer.concat(chunks)
    await writeFile(join(HERE, OUT), buf)
    console.log(`đã ghi ${OUT}: ${buf.length} bytes`)
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(OUT)
    return
  }

  const name = req.url === '/' ? 'feature-graphic.html' : decodeURIComponent(req.url.slice(1))
  try {
    const data = await readFile(join(HERE, name))
    const type = name.endsWith('.html')
      ? 'text/html; charset=utf-8'
      : name.endsWith('.png')
        ? 'image/png'
        : 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': type })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end('404')
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}/`))
