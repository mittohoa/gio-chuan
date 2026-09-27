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

// ------------------------------------------------------------------ kí bản release
// Tauri 2.9 KHÔNG sinh signingConfigs. Nếu không chèn, `tauri android build`
// vẫn chạy trơn tru và xuất ra .aab — nhưng file đó CHƯA ĐƯỢC KÍ, và Play từ
// chối. Không có cảnh báo nào trong log; chỉ `jarsigner -verify` mới lộ ra.
// Ghi keystore.properties thôi là vô nghĩa nếu Gradle không đọc nó.
{
  const gradle = join(ANDROID, 'app', 'build.gradle.kts')
  const before = readFileSync(gradle, 'utf8')

  if (before.includes('signingConfigs')) {
    log('build.gradle.kts: cấu hình kí đã có từ trước')
  } else {
    const loader = `
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.exists()) {
        keystorePropertiesFile.inputStream().use { load(it) }
    }
}
`
    const signing = `    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                keystoreProperties.getProperty("storeFile")?.let { storeFile = file(it) }
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                // Chấp nhận cả hai tên khoá cho mật khẩu key.
                keyPassword = keystoreProperties.getProperty("keyPassword")
                    ?: keystoreProperties.getProperty("password")
            }
        }
    }
`
    // Không có keystore thì vẫn build được (bản chưa kí, để thử nghiệm cục bộ).
    const applySigning = `            if (keystorePropertiesFile.exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
`
    // Mọi mẫu đều phải chịu được CRLF: trên Windows file này xuống dòng bằng
    // \r\n, nên `\n\n` sẽ không khớp trong khi `\n` đơn lẻ vẫn khớp — vá được
    // một nửa, Gradle lỗi biến không tồn tại.
    let after = before
    after = after.replace(/\r?\n\r?\nandroid \{/, `\n${loader}\nandroid {`)
    after = after.replace(/\r?\n    buildTypes \{/, `\n${signing}    buildTypes {`)
    after = after.replace(/(getByName\("release"\) \{\r?\n)/, `$1${applySigning}`)

    // Kiểm TỪNG mảnh. Chỉ hỏi "có signingConfigs không" là không đủ: lần trước
    // đúng vì thế mà một bản vá hụt lọt qua.
    const missing = [
      ['khai báo keystoreProperties', after.includes('val keystorePropertiesFile')],
      ['khối signingConfigs', after.includes('signingConfigs {')],
      ['gán signingConfig cho release', after.includes('signingConfigs.getByName("release")')],
    ].filter(([, ok]) => !ok).map(([name]) => name)

    if (missing.length > 0) {
      console.error(`  build.gradle.kts: CHÈN HỤT — thiếu ${missing.join(', ')}`)
      console.error('  Mẫu file do Tauri sinh ra có thể đã đổi. Dừng để khỏi build ra bản chưa kí.')
      process.exit(1)
    }
    writeFileSync(gradle, after)
    changed++
    log('build.gradle.kts: chèn signingConfigs cho bản release')
  }
}

console.log(changed > 0 ? `Đã vá ${changed} chỗ.` : 'Không có gì phải vá.')
