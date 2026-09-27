# Nội dung khai báo Play Console — Giờ Chuẩn

Mọi mục dưới đây đã viết sẵn để dán thẳng vào Play Console. Phần nào cần bạn tự quyết
thì có ghi rõ.

| | |
|---|---|
| Tên gói | `com.mittohoa.timeis` — **không đổi được sau lần phát hành đầu** |
| File nộp | `release/gio-chuan-0.1.0.aab` (7,47 MB) |
| versionCode | 1000 |
| versionName | 0.1.0 |
| Vân tay khoá kí | `EA:F8:1F:9F:52:71:D2:54:AB:28:8F:A7:37:B5:58:A1:98:01:5D:9F:05:B6:73:01:39:D8:C8:45:FA:C8:CC:CB` |

---

## 1. Thông tin trang ứng dụng (Store listing)

### Tên ứng dụng (tối đa 30 kí tự)

```
Giờ Chuẩn
```

### Mô tả ngắn (tối đa 80 kí tự)

```
Đồng hồ đồng bộ NTP, hiện rõ sai số thật. Xem giờ mọi múi giờ, chạy cả offline.
```
*(78 kí tự)*

### Mô tả đầy đủ (tối đa 4000 kí tự)

```
Giờ Chuẩn là đồng hồ chính xác không chỉ hiển thị giờ, mà còn cho bạn biết nó chính xác tới mức nào.

ĐO VÀ CÔNG BỐ SAI SỐ THẬT

Hầu hết ứng dụng xem giờ chỉ nói "đã đồng bộ" rồi thôi. Giờ Chuẩn cho bạn thấy hai con số mà bình thường không ai cho biết:

• Đồng hồ máy bạn đang nhanh hay chậm bao nhiêu mili-giây
• Lần đồng bộ vừa rồi có sai số bao nhiêu

Con số thứ hai mới là điều đáng nói. Nhiều ứng dụng lấy một nửa thời gian phản hồi mạng rồi gọi đó là độ chính xác — nghe rất đẹp nhưng không đúng. Giờ Chuẩn đo độ tản mát thật giữa nhiều lần lấy mẫu và báo đúng con số đó, kể cả khi con số ấy xấu.

ĐỒNG BỘ BẰNG NTP THẬT

Ứng dụng mở kết nối UDP tới máy chủ giờ nguyên tử (time.cloudflare.com, pool.ntp.org, time.google.com) theo đúng giao thức NTP — thứ mà trang web chạy trong trình duyệt không làm được. Nhờ vậy độ chính xác cao hơn nhiều lần so với xem giờ trên web.

TÍNH NĂNG

• Mặt đồng hồ dạng thiết bị đo: vòng 60 vạch giây, kim quét chuyển động mượt theo từng mili-giây
• Hai đồng hồ đo: độ lệch đồng hồ máy và độ chính xác đồng bộ
• Giờ thế giới: thêm bao nhiêu thành phố tuỳ thích, chọn từ toàn bộ múi giờ IANA
• Chạm vào một thành phố để đổi thành múi giờ chính
• Ngày tháng đầy đủ kèm số tuần ISO và thứ tự ngày trong năm
• Bật/tắt hiển thị mili-giây
• Giao diện tối và sáng
• Tiếng Việt và tiếng Anh

HOẠT ĐỘNG KHI MẤT MẠNG

Kết quả đồng bộ gần nhất được lưu lại. Mở ứng dụng lúc không có mạng vẫn chính xác hơn nhiều so với tin vào đồng hồ máy, và sai số hiển thị được nới rộng theo thời gian đã trôi qua để bạn biết mức tin cậy còn lại.

KHÔNG THU THẬP DỮ LIỆU

Không tài khoản. Không quảng cáo. Không phân tích hành vi. Không mã theo dõi. Ứng dụng chỉ xin duy nhất quyền Internet để hỏi giờ. Mọi tuỳ chọn nằm trên máy bạn.

NHẸ

Toàn bộ ứng dụng dưới 8 MB.
```

### Danh mục

- **Danh mục ứng dụng**: Công cụ (Tools)
- **Thẻ**: Đồng hồ, Múi giờ, Tiện ích

### Liên hệ

| Trường | Giá trị |
|---|---|
| Email | *(bạn điền — email công khai, Play bắt buộc)* |
| Trang web | `https://mittohoa.github.io/gio-chuan/` |
| Chính sách quyền riêng tư | `https://mittohoa.github.io/gio-chuan/privacy.html` |

---

## 2. Hình ảnh

| Loại | Yêu cầu | Trạng thái |
|---|---|---|
| Icon | 512×512 PNG, 32-bit | ✅ `web/public/icon-512.png` |
| Ảnh màn hình điện thoại | tối thiểu 2, từ 320px tới 3840px | ✅ `release/screenshots/` — 3 ảnh 1080×2340 |
| **Ảnh bìa (Feature graphic)** | 1024×500 PNG hoặc JPG | ✅ `release/feature-graphic-1024x500.png` |
| Ảnh tablet 7" và 10" | tuỳ chọn | ❌ chưa có |
| Video giới thiệu | tuỳ chọn | ❌ chưa có |

Ảnh màn hình hiện có, chụp từ bản AAB thật đã kí:

1. `01-man-hinh-chinh.png` — mặt đồng hồ và hai đồng hồ đo
2. `02-chon-mui-gio.png` — hộp thoại chọn múi giờ
3. `03-gio-the-gioi.png` — danh sách giờ thế giới

Ảnh bìa dựng từ `design/feature-graphic.html` — mở bằng `node design/serve.mjs` rồi vào
`http://localhost:4600/` là trang tự vẽ và ghi đè file PNG. Sửa chữ hay bố cục thì sửa
trong file HTML đó rồi tải lại trang.

---

## 3. Nội dung ứng dụng (App content)

Trả lời cho từng mục trong phần "App content" của Play Console:

| Mục | Trả lời |
|---|---|
| **Chính sách quyền riêng tư** | `https://mittohoa.github.io/gio-chuan/privacy.html` |
| **Quảng cáo** | Không, ứng dụng không chứa quảng cáo |
| **Quyền truy cập ứng dụng** | Mọi chức năng đều dùng được, không cần đăng nhập hay quyền đặc biệt |
| **Xếp hạng nội dung** | Làm bảng câu hỏi — xem mục 4 |
| **Đối tượng mục tiêu** | Chọn **13 tuổi trở lên** hoặc **18 tuổi trở lên**. **Đừng** chọn nhóm dưới 13 tuổi: sẽ kích hoạt chính sách Families với hàng loạt yêu cầu bổ sung mà ứng dụng tiện ích này không cần |
| **Ứng dụng có hướng tới trẻ em không** | Không |
| **Ứng dụng tin tức** | Không |
| **Ứng dụng COVID-19** | Không |
| **Tính năng tài chính** | Không có tính năng tài chính nào |
| **Ứng dụng sức khoẻ** | Không |
| **Ứng dụng của chính phủ** | Không |
| **Quản lý dữ liệu sức khoẻ** | Không |
| **Khai báo trader cho EU** | *(bạn tự khai — bắt buộc từ 17/02/2025 nếu phát hành tại EU. Cá nhân không kinh doanh thì chọn "không phải trader")* |

---

## 4. Xếp hạng nội dung (IARC)

Chọn danh mục **Tiện ích, Năng suất, Giao tiếp hoặc Khác**, rồi trả lời:

| Câu hỏi | Trả lời |
|---|---|
| Bạo lực | Không |
| Nội dung tình dục | Không |
| Ngôn từ thô tục | Không |
| Ma tuý, rượu, thuốc lá | Không |
| Cờ bạc mô phỏng | Không |
| Cờ bạc ăn tiền thật | Không |
| Người dùng tương tác với nhau | Không |
| Chia sẻ vị trí với người dùng khác | Không |
| Chia sẻ thông tin cá nhân với bên thứ ba | Không |
| Mua hàng trong ứng dụng | Không |
| Nội dung do người dùng tạo | Không |

Kết quả dự kiến: mức thấp nhất ở mọi khu vực (PEGI 3, ESRB Everyone, v.v.).

---

## 5. An toàn dữ liệu (Data safety)

Đây là phần khai báo pháp lý — sai là có thể bị gỡ ứng dụng. Với ứng dụng này mọi câu
trả lời đều đơn giản vì nó thật sự không thu thập gì:

| Câu hỏi | Trả lời |
|---|---|
| Ứng dụng có thu thập hoặc chia sẻ dữ liệu người dùng không? | **Không** |
| Toàn bộ dữ liệu có được mã hoá khi truyền không? | *(không áp dụng)* |
| Có cho người dùng yêu cầu xoá dữ liệu không? | *(không áp dụng)* |

Khai như vậy là đúng sự thật, căn cứ:

- Ứng dụng chỉ xin quyền `INTERNET`, không xin thêm quyền nào
- Không có SDK quảng cáo, không có công cụ phân tích, không có mã theo dõi
- Tuỳ chọn lưu trong `localStorage` trên máy, không gửi đi đâu
- Kết nối mạng duy nhất là hỏi dấu thời gian từ máy chủ NTP công cộng

> Máy chủ NTP nhận được địa chỉ IP của thiết bị, như mọi kết nối Internet khác. Đây là
> đặc tính của giao thức mạng, **không** tính là dữ liệu do ứng dụng thu thập, nên không
> phải khai trong biểu mẫu này.

---

## 6. Việc còn phải làm trước khi đăng được

1. **Điền email liên hệ công khai** — Play bắt buộc, mình không tự điền thay bạn được
2. **Xác minh danh tính** người phát hành trong Play Console
3. **Chạy closed test 12 người thử nghiệm trong 14 ngày liên tục** — bắt buộc với tài
   khoản cá nhân tạo từ 13/11/2023. Đây là mốc chặn lâu nhất, nên bắt đầu càng sớm càng tốt
4. **Bật Play App Signing** — Google giữ khoá phát hành, bạn chỉ giữ khoá upload
5. **Khai báo trader status** nếu phát hành tại EU

---

## 7. Thứ tự thao tác trong Play Console

1. Tạo ứng dụng mới → tên `Giờ Chuẩn`, ngôn ngữ mặc định Tiếng Việt, loại Ứng dụng, miễn phí
2. Hoàn thành mục **App content** (mục 3 và 4 ở trên)
3. Điền **Data safety** (mục 5)
4. Điền **Store listing** (mục 1) và tải ảnh lên (mục 2)
5. Tạo bản **Closed testing**, tải `release/gio-chuan-0.1.0.aab` lên
6. Mời tối thiểu 12 người thử nghiệm, chờ đủ 14 ngày liên tục
7. Sau khi đủ điều kiện mới mở được kênh **Production**

> Lưu ý chọn **miễn phí**: ứng dụng đã đặt miễn phí thì **không bao giờ** chuyển sang trả
> phí được nữa. Chiều ngược lại thì được.
