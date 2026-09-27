/**
 * Vá dự án Android mà `tauri android init` sinh ra.
 *
 * Thư mục `src-tauri/gen/android` bị gitignore và CI sinh lại từ đầu mỗi lần
 * build, nên mọi chỉnh sửa trong đó phải nằm ở script này mới sống sót.
 *
 * Chạy tự động sau `npm run android:init`. An toàn khi chạy lại nhiều lần.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ANDROID = join(ROOT, 'src-tauri', 'gen', 'android')

if (!existsSync(ANDROID)) {
  console.error('Chưa có src-tauri/gen/android — chạy `npm run android:init` trước.')
  process.exit(1)
}

let changed = 0
const log = (msg) => console.log(`  ${msg}`)

// ---------------------------------------------------------------- SDK level
// Play chỉ nhận bản nộp mới nếu target Android 16 (API 36) kể từ 31/08/2026.
// Tauri hiện sinh sẵn đúng 36; bước này là lưới an toàn phòng khi đổi phiên bản.
{
  const gradle = join(ANDROID, 'app', 'build.gradle.kts')
  const before = readFileSync(gradle, 'utf8')
  const after = before
    .replace(/(compileSdk\s*=\s*)(\d+)/, (_m, p, v) => `${p}${Math.max(36, Number(v))}`)
    .replace(/(targetSdk\s*=\s*)(\d+)/, (_m, p, v) => `${p}${Math.max(36, Number(v))}`)
  if (after !== before) {
    writeFileSync(gradle, after)
    changed++
    log('build.gradle.kts: nâng compileSdk/targetSdk lên 36')
  } else {
    log(`build.gradle.kts: ${/targetSdk\s*=\s*36/.test(before) ? 'targetSdk đã là 36' : 'KHÔNG tìm thấy targetSdk — kiểm tra lại!'}`)
  }
}

// ------------------------------------------------------------- thanh hệ thống
// Giao diện app luôn tối theo mặc định, nhưng theme sinh ra là DayNight không
// tuỳ chỉnh. Khi hệ thống ở chế độ sáng, Android tô icon thanh trạng thái màu
// đen — đè lên nền tối của app thì gần như không nhìn thấy gì.
//
// Ép icon sang màu sáng ở cả hai biến thể. Cách này chưa hoàn hảo: nếu người
// dùng bật giao diện SÁNG trong app thì icon sáng lại chìm vào nền sáng. Đồng bộ
// tuyệt đối cần một plugin gọi sang tầng Android, để sau; hiện tại ưu tiên đúng
// cho trạng thái mặc định mà đa số người dùng nhìn thấy.
{
  const bars = [
    '        <item name="android:windowLightStatusBar">false</item>',
    '        <item name="android:windowLightNavigationBar">false</item>',
  ].join('\n')

  for (const variant of ['values', 'values-night']) {
    const file = join(ANDROID, 'app', 'src', 'main', 'res', variant, 'themes.xml')
    if (!existsSync(file)) continue
    const before = readFileSync(file, 'utf8')
    if (before.includes('windowLightStatusBar')) {
      log(`${variant}/themes.xml: đã vá từ trước`)
      continue
    }
    const after = before.replace(
      /(<style name="Theme\.[^"]+"[^>]*>)/,
      (m) => `${m}\n${bars}`,
    )
    if (after === before) {
      log(`${variant}/themes.xml: KHÔNG khớp được <style> — bỏ qua`)
      continue
    }
    writeFileSync(file, after)
    changed++
    log(`${variant}/themes.xml: ép icon thanh hệ thống sang màu sáng`)
  }
}

console.log(changed > 0 ? `Đã vá ${changed} chỗ.` : 'Không có gì phải vá.')
