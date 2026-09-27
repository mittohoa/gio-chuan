# Checklist nộp Google Play (chính sách 2026)

Tài liệu này ghi lại những yêu cầu **đang có hiệu lực tại tháng 9/2026** và trạng thái
của dự án với từng yêu cầu. Nguồn ở cuối trang.

---

## 1. Hạn target API level — ĐÃ QUA HẠN, bắt buộc API 36

| | |
|---|---|
| Từ **31/08/2026** | Bản nộp mới và bản cập nhật phải target **Android 16 (API 36)** |
| App đã có trên store | Phải target tối thiểu Android 15 (API 35) để còn hiển thị với người dùng mới |
| Gia hạn | Có thể xin tới **01/11/2026** trong Play Console |

Hôm nay đã qua 31/08/2026, nên **không còn đường vòng**: phải là API 36.

**Trạng thái dự án:** đã đạt. Tauri 2.9 sinh thẳng ra `compileSdk = 36` và
`targetSdk = 36` (đã kiểm chứng trên dự án này), nên không phải sửa tay. Bước vá trong
`android.yml` giữ lại làm lưới an toàn phòng khi đổi phiên bản Tauri.

---

## 2. Trang bộ nhớ 16 KB — điểm chết người với app có mã native

Từ **01/11/2025**, mọi bản nộp mới target Android 15+ phải hỗ trợ trang bộ nhớ 16 KB.
App chỉ viết bằng Java/Kotlin thì mặc định đã đạt. **App này thì không** — Tauri biên
dịch Rust ra các file `.so`, nên nằm đúng vào diện bị kiểm tra. Không đạt là Play Console
chặn phát hành ngay, không phải cảnh báo.

Điều kiện: **NDK r28 trở lên** và **AGP 8.5.1 trở lên**.

**Trạng thái dự án: ĐÃ ĐẠT, có kiểm chứng.** Build thật với NDK r28 rồi giải nén APK và
chạy `llvm-readelf` trên thư viện native cho kết quả:

```
libmittohoa_timeis_lib.so  ->  align=0x4000   (16384 byte = 16 KB)
```

CI cài NDK `28.2.13676358` và lặp lại đúng phép kiểm này trên file `.aab`; không đạt thì
CI fail chứ không im lặng cho qua.

---

## 3. Điều 4.3 — Minimum Functionality (rủi ro lớn nhất của app này)

App bọc WebView là nguồn bị từ chối nhiều nhất, và năm 2026 hệ thống tự động đã siết
chặt hơn. Bị đánh trượt là những app: chỉ là một website trong khung, không có màn hình
chờ, nút Back thoát app ngay, mất mạng thì trắng trang, không có gì mà một tab trình
duyệt không làm được.

App này **không phải WebView wrapper** theo nghĩa đó, và đây là các luận điểm cụ thể để
bảo vệ nếu bị hỏi:

| Yêu cầu | Dự án đáp ứng thế nào |
|---|---|
| Không nạp website từ xa | Toàn bộ asset nằm trong APK; Tauri phục vụ từ máy |
| Có năng lực mà trình duyệt không có | **SNTP thật qua UDP cổng 123** — trình duyệt không mở được socket UDP. Đã đo trên emulator API 34: web ±354 ms, bản Android ±40–94 ms qua 4 lần chạy. Đây là khác biệt đo được, không phải lời quảng cáo |
| Màn hình chờ | `.splash` nằm sẵn trong HTML, hiện trước cả khi JS chạy |
| Hoạt động khi mất mạng | Offset lưu trong `localStorage`, app vẫn chạy và vẫn báo đúng độ tin cậy còn lại |
| Nút Back hoạt động đúng | Hộp thoại chọn thành phố dùng `<dialog>` gốc nên nút Back đóng hộp thoại thay vì thoát app |
| Có trạng thái, có tương tác | Chọn múi giờ chính, thêm/xoá thành phố, đổi ngôn ngữ, đổi giao diện, bật/tắt mili-giây — đều lưu lại |
| Giao diện riêng | Mặt đồng hồ dạng thiết bị đo: vòng 60 vạch giây, kim quét mượt theo mili-giây, hai đồng hồ đo độ lệch và độ chính xác |

**Nên làm thêm trước khi nộp:** quay một video ngắn cho phần "App preview" thể hiện kim
quét và hai đồng hồ đo — đây là thứ chứng minh ngay app không phải cái khung trống.

---

## 4. Tài khoản cá nhân: 12 người thử nghiệm trong 14 ngày

Áp dụng cho **tài khoản cá nhân tạo từ 13/11/2023 trở đi**. Phải chạy closed test với ít
nhất **12 người thử nghiệm đã opt-in liên tục 14 ngày** thì mới mở được kênh Production.
Tài khoản tổ chức (doanh nghiệp) và tài khoản cá nhân tạo trước mốc đó được miễn.

Tính tới 08/2026 chưa có thay đổi nào về con số 12 hay mốc 14 ngày.

Lưu ý: 14 ngày tính **liên tục** — có người rời nhóm giữa chừng là đồng hồ đếm lại. Nên
mời dư 15–18 người.

> Nếu bạn dự định làm nghiêm túc, cân nhắc mở **tài khoản tổ chức** ngay từ đầu để bỏ qua
> toàn bộ phần này. Đổi lại phải có giấy tờ doanh nghiệp và mã D-U-N-S.

---

## 5. Những mục còn lại phải hoàn thành trong Play Console

- [ ] Nộp **AAB** (không phải APK) — `npm run android:build` đã xuất đúng định dạng
- [ ] **Chính sách quyền riêng tư** có URL công khai — bắt buộc kể cả khi không thu thập gì.
      Có thể đặt luôn tại `https://<user>.github.io/<repo>/privacy.html`
- [ ] **Data safety form**: khai không thu thập, không chia sẻ dữ liệu (đúng với app này)
- [ ] **Content rating**: làm bảng câu hỏi, app tiện ích sẽ ra mức thấp nhất
- [ ] **Khai báo trader status cho EU** — bắt buộc từ 17/02/2025 nếu phát hành ở EU
- [ ] **Xác minh danh tính** người phát hành
- [ ] Ảnh chụp màn hình: tối thiểu 2 ảnh điện thoại, thêm ảnh tablet 7" và 10" nếu muốn
      phủ mọi thiết bị
- [ ] Icon 512×512 và ảnh bìa 1024×500
- [x] `identifier` trong `src-tauri/tauri.conf.json` — đã đặt **`com.mittohoa.timeis`**.
      Sau khi phát hành lần đầu lên Play là **không đổi được nữa**: muốn đổi thì phải tạo
      app mới, mất sạch lượt cài, đánh giá và người thử nghiệm. Kiểm tra kĩ trước khi nộp

---

## 6. Quản lý khoá kí

Khoá của dự án này **đã tạo rồi**, nằm ngoài repo:

| | |
|---|---|
| Keystore | `C:\Users\hoadu\keys\gio-chuan-upload.jks` |
| Mật khẩu | `C:\Users\hoadu\keys\gio-chuan-upload-README.txt` |
| Alias | `upload` — RSA 4096, hạn tới 12/02/2054 |
| Vân tay SHA-256 | `EA:F8:1F:9F:52:71:D2:54:AB:28:8F:A7:37:B5:58:A1:98:01:5D:9F:05:B6:73:01:39:D8:C8:45:FA:C8:CC:CB` |

**Sao lưu cả hai file ra nơi khác.** Mất khoá là không bao giờ cập nhật được app nữa.
Bật **Play App Signing** khi nộp để Google giữ khoá phát hành, bạn chỉ giữ khoá upload —
mất khoá upload thì còn xin cấp lại được.

Tạo lại từ đầu (nếu cần cho dự án khác):

```bash
keytool -genkeypair -keystore upload.jks -alias upload \
  -keyalg RSA -keysize 4096 -validity 10000
```

### Tauri KHÔNG tự kí — đây là cái bẫy lớn nhất

`tauri android build` **không** sinh `signingConfigs` trong `app/build.gradle.kts`. Tạo
file `keystore.properties` thôi là vô nghĩa: Gradle không biết file đó tồn tại. Build vẫn
chạy trơn tru, vẫn xuất ra `.aab` trông bình thường — **nhưng chưa được kí**, và không có
một dòng cảnh báo nào trong log. Chỉ tới lúc Play từ chối mới biết.

`scripts/patch-android.mjs` chèn khối `signingConfigs` đó vào sau mỗi lần
`tauri android init`. Không có bước này thì mọi bản release đều vô dụng.

### Nạp secret cho CI

| Secret | Nội dung |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 upload.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | mật khẩu kho khoá |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | mật khẩu khoá |

Nạp bằng **bash**, đừng dùng PowerShell: PowerShell thêm CRLF khi pipe sang chương trình
ngoài nên secret dính `\r`. Với chuỗi base64 thì `base64 -d` báo lỗi ngay, nhưng với mật
khẩu thì **không báo gì cả** — chỉ âm thầm sai mật khẩu lúc kí.

```bash
base64 -w0 upload.jks | gh secret set ANDROID_KEYSTORE_BASE64 --repo <owner>/<repo>
printf '%s' "$PW"     | gh secret set ANDROID_KEYSTORE_PASSWORD --repo <owner>/<repo>
```

`.gitignore` đã chặn `*.jks`, `*.keystore` và `keystore.properties`.

### Kiểm chữ kí — dùng đúng công cụ cho đúng định dạng

Đây là chỗ rất dễ kết luận nhầm theo cả hai chiều:

| Định dạng | Công cụ đúng | Vì sao |
|---|---|---|
| `.apk` | `apksigner verify --print-certs` | APK hiện đại kí theo scheme v2/v3 |
| `.aab` | `jarsigner -verify` | AAB kí theo chuẩn JAR v1; `apksigner` không đọc được AAB |

Dùng `jarsigner` để kiểm một APK **đã kí đúng** vẫn ra `jar is unsigned`, vì nó chỉ hiểu
v1. Báo động nhầm rất dễ xảy ra ở đây.

Phép kiểm quyết định không phải "có chữ kí không" mà là **vân tay có trùng khoá upload
không** — nếu không, rất có thể Gradle đã kí bằng khoá debug tự sinh:

```bash
apksigner verify --print-certs app.apk | grep "SHA-256"
keytool -list -v -keystore upload.jks -alias upload | grep SHA256
```

---

## Nguồn

- [Target API level requirements for Google Play apps — Play Console Help](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Meet Google Play's target API level requirement — Android Developers](https://developer.android.com/google/play/requirements/target-sdk)
- [Prepare your apps for Google Play's 16 KB page size compatibility requirement — Android Developers Blog](https://android-developers.googleblog.com/2025/05/prepare-play-apps-for-devices-with-16kb-page-size.html)
- [Support 16 KB page sizes — Android Developers](https://developer.android.com/guide/practices/page-sizes)
- [App testing requirements for new personal developer accounts — Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465)
