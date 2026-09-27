# Giờ Chuẩn

Đồng hồ chính xác chạy trên **web (GitHub Pages), Android và Windows** từ một codebase.

> **Phạm vi hiện tại.** Linux và macOS để làm sau. Mã nguồn không có gì phụ thuộc hệ
> điều hành nên bật thêm chỉ là mở lại mục tương ứng trong `.github/workflows/desktop.yml`
> — chưa dựng ở đây vì chưa kiểm thử được.

Điểm khác biệt so với các trang xem giờ: app không chỉ hiển thị giờ, nó **đo và công bố
sai số thật của chính nó** — và ở bản native nó dùng NTP thật qua UDP, đo được **±28 ms**
trên Windows so với **±354 ms** của bản chạy trong trình duyệt, tức chính xác hơn khoảng
12 lần.

---

## Kiến trúc

```
web/            Giao diện + engine đồng bộ (TypeScript, Vite, không framework)
  src/core/     clock.ts (engine), sources.ts (nguồn giờ), tz.ts, i18n.ts
  src/ui/       app.ts, dial.ts (mặt đồng hồ), cityPicker.ts
  public/       manifest PWA, service worker, icon
src-tauri/      Vỏ native (Rust + Tauri v2) — Android, Windows
  src/ntp.rs    Client SNTP tự viết, chỉ dùng std
scripts/        gen-icons.mjs     sinh PNG icon, không cần thư viện ngoài
                android-env.sh    dò SDK/NDK/JDK/Rust, báo cái nào thiếu
                patch-android.mjs vá dự án Gradle sau khi tauri sinh ra
.github/        CI cho Pages, desktop, Android
```

Bản web build ra `web/dist/`. Tauri đóng gói **đúng thư mục đó**, nên mọi nền tảng luôn
chạy cùng một giao diện.

---

## Engine đồng bộ, và một cái bẫy

Cách làm kinh điển (time.is cũng dùng) là:

```
offset  = serverTime − (t_gửi + RTT/2)
sai số  = ±RTT/2
```

Phần `offset` thì đúng. Phần **sai số thì sai** với mọi nguồn HTTP.

Đo thực tế trong dự án này: gọi `cloudflare.com/cdn-cgi/trace` sáu lần với RTT ổn định
73 ms, kết quả offset trải từ −578 ms tới +113 ms — tản gần **700 ms**. Đồng hồ máy thì
hoàn toàn ổn định (lệch ±1 ms trong 3 giây), nên nhiễu đến từ server: các endpoint ở
tầng edge làm tròn hoặc đóng băng đồng hồ trong lúc xử lý request. Akamai và timeapi.io
cũng tản 450–750 ms. Vậy `±RTT/2 = ±36 ms` là một con số **đẹp nhưng bịa**.

Engine ở đây xử lý theo từng loại nguồn:

| Loại nguồn | Cách chọn | Sai số công bố |
|---|---|---|
| **Chính xác** (NTP/UDP) | mẫu có RTT nhỏ nhất | `±RTT/2` |
| **Nhiễu** (mọi endpoint HTTP) | **trung vị** của 5 mẫu | `max(RTT/2, độ tản mát/2)` |

Với nguồn chính xác, mẫu nhanh nhất luôn gần sự thật nhất — độ trễ mạng chỉ cộng thêm
chứ không bao giờ trừ bớt, nên lấy trung bình sẽ kéo kết quả về phía các mẫu bị nghẽn.
Với nguồn nhiễu, độ tản mát đo được **chính là** sai số, và không có cách nào biết tốt
hơn thế từ phía trình duyệt.

Kết quả đo thật (Bangkok, cùng một mạng):

| Bản | Nguồn | Sai số công bố | Đo ở đâu |
|---|---|---|---|
| Web | Cloudflare anycast, 5 mẫu | **±354 ms** | trình duyệt |
| Android | NTP/UDP, 3 mẫu | **±40 … ±94 ms** | emulator API 34, 4 lần chạy |
| Windows | NTP/UDP, 3 mẫu | **±28 ms** | máy thật |

Con số Android cao hơn Windows vì emulator đi qua NAT user-mode của QEMU, cộng thêm độ
trễ và nhiễu — ghi cả dải chứ không lấy mỗi lần đo đẹp nhất. Trên điện thoại thật nhiều
khả năng sát với Windows hơn, nhưng **chưa đo nên không khẳng định**.

Chênh lệch 12 lần trên máy thật mới là lý do để cài app thay vì mở trang web.

Vài chi tiết khác:

- Đồng hồ chạy trên `performance.now()` (đơn điệu), không phải `Date.now()` — giờ hiển
  thị không giật khi hệ điều hành tự sửa giờ giữa chừng.
- Khi quay lại tiền cảnh, nếu đồng hồ hệ thống đã nhảy so với đồng hồ đơn điệu thì đồng
  bộ lại ngay.
- Offset được lưu lại; mở app lúc mất mạng vẫn chính xác hơn nhiều so với tin vào đồng hồ
  máy. Sai số được nới theo tuổi dữ liệu (giả định trôi 50 ppm).

### Về time.is

Endpoint đồng bộ của họ (`time.is/t1/`) **chặn truy cập bằng script**, trả HTTP 403 kèm
yêu cầu liên hệ xin API riêng. Dự án này không gọi tới time.is ở bất cứ đâu.

---

## Chạy thử

```bash
npm run install:all         # cài phụ thuộc cho cả root và web
node scripts/gen-icons.mjs  # sinh icon PNG
npm run dev                 # web, http://localhost:5173
```

### Android

Cần thêm: JDK 17, Android SDK (platform 36, build-tools 36), **NDK r28 trở lên**, và
biến môi trường `ANDROID_HOME` + `NDK_HOME`.

```bash
npm run android:init        # tạo dự án Gradle tại src-tauri/gen/android (chỉ lần đầu)
npm run android:dev         # chạy trên máy/emulator
npm run android:build       # xuất .aab để nộp Play
```

Tauri 2.9 đã sinh sẵn `compileSdk = 36`, `targetSdk = 36`, `minSdk = 24` nên không phải
sửa gì. Bước vá trong `android.yml` chỉ là lưới an toàn cho trường hợp nâng/hạ Tauri về
bản sinh ra API level thấp hơn — nếu để lọt, Play sẽ từ chối bản nộp.

Chưa chắc máy đã đủ toolchain thì chạy trước:

```bash
source scripts/android-env.sh   # dò SDK, NDK r28+, JDK 17+, target Rust
```

Script chỉ dò và báo cái nào thiếu, không tự cài gì.

### Windows

Cần [Rust](https://rustup.rs) và
[phụ thuộc hệ thống của Tauri](https://tauri.app/start/prerequisites/).

```bash
npm run desktop:dev         # chạy thử
npm run desktop:build       # đóng gói installer NSIS (.exe)
```

Kết quả đo được trên máy thật (Windows 10, đã cài rồi chạy):

| | |
|---|---|
| Installer NSIS | **1,06 MB** |
| Sau khi cài | 2,92 MB (exe) + 0,08 MB (uninstall) |
| RAM lúc chạy | 23 MB |
| Độ chính xác đồng bộ | **±28 ms** |

Nhỏ như vậy vì Tauri dùng WebView2 có sẵn trong Windows thay vì nhúng cả Chromium.
Installer cài theo người dùng vào `%LOCALAPPDATA%`, không cần quyền admin.

#### Vì sao bỏ MSI, chỉ đóng gói NSIS

`bundle.targets` cố tình **không** để `"all"`. WiX 3 — bộ đóng gói MSI mà Tauri dùng —
không mã hoá nổi tiếng Việt có dấu trong các trường của cơ sở dữ liệu MSI. Đã thử hết
đường và đều tắc:

| Code page | Kết quả |
|---|---|
| `1252` (mặc định) | `LGHT0311` — Tây Âu, không có ký tự tiếng Việt |
| `1258` (Việt) | `LGHT0311`, còn **nhiều lỗi hơn** — 1258 mã hoá bằng dấu tổ hợp, không có ký tự dựng sẵn như `ờ` (U+1EDD) |
| `65001` (UTF-8) | `LGHT0349` — WiX 3 từ chối UTF-8 ở phần summary information |

Đây là giới hạn của công cụ, không phải lỗi cấu hình. NSIS thì Unicode gốc nên tiếng
Việt đi trọn vẹn qua mọi tầng: tên file installer, đường dẫn cài đặt, shortcut, tên
trong Apps & features, tiêu đề cửa sổ.

**Đánh đổi:** mất khả năng triển khai hàng loạt qua Group Policy trong môi trường doanh
nghiệp — thứ chỉ MSI làm được. Với app tiện ích cá nhân thì không đáng kể. Cần MSI thì
phải đổi `productName` sang chuỗi không dấu và bù lại nhãn tiếng Việt trên Android bằng
`scripts/patch-android.mjs`.

> `mainBinaryName` được đặt riêng thành `mittohoa-timeis` (ASCII) để tên binary và tên
> gói Debian hợp lệ, trong khi `productName` giữ nguyên dấu cho phần người dùng nhìn
> thấy. Định dạng `.deb` chỉ chấp nhận chữ thường, số và `-.+`.

Cùng lệnh trên cũng ra `.deb` / `.AppImage` trên Linux khi nào cần — chỉ là CI đang chưa
dựng nền tảng đó, và cũng **chưa build thử lần nào**.

### GitHub Pages

Push lên `main` là workflow `pages.yml` tự build và deploy. Workflow tự đặt
`BASE_PATH=/<tên-repo>/` nên không cần sửa gì.

---

## Nộp Play Store

Xem [PLAY_STORE.md](PLAY_STORE.md) — checklist đầy đủ theo chính sách 2026, gồm hạn
target API 36, yêu cầu trang bộ nhớ 16 KB, và cách tránh bị từ chối theo điều 4.3.

---

## Ghi chú kĩ thuật

- **Không phụ thuộc runtime nào** ngoài `@tauri-apps/api` (chỉ nạp khi chạy native).
  Bản web nặng ~9 kB gzip.
- **Múi giờ** lấy từ `Intl.supportedValuesOf('timeZone')` — không nhúng bảng dữ liệu, tự
  cập nhật theo hệ điều hành.
- **Quyền**: app chỉ xin `INTERNET`. Không vị trí, không lưu trữ, không thông báo.
- **Không thu thập dữ liệu**: không analytics, không tài khoản, không gửi gì đi ngoài
  request lấy giờ. Cài đặt nằm trong `localStorage`.
