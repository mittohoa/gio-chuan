//! Client SNTP (RFC 4330) tối giản, chỉ dùng std.
//!
//! Đây là lý do bản native tồn tại: trong trình duyệt ta chỉ ước lượng được giờ
//! qua HTTP, phải gánh cả chi phí bắt tay TLS. Ở đây là một gói UDP 48 byte đi
//! và về, nên sai số thường chỉ cỡ vài mili-giây.

use std::io;
use std::net::{ToSocketAddrs, UdpSocket};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// Khoảng cách giữa mốc thời gian NTP (1900-01-01) và mốc Unix (1970-01-01).
const NTP_TO_UNIX_SECS: u64 = 2_208_988_800;
const TIMEOUT: Duration = Duration::from_millis(1500);

/// Các máy chủ thử lần lượt cho tới khi có một cái trả lời.
pub const DEFAULT_SERVERS: [&str; 3] = [
    "time.cloudflare.com:123",
    "pool.ntp.org:123",
    "time.google.com:123",
];

#[derive(Debug, Clone, serde::Serialize)]
pub struct SntpResult {
    /// Giờ thật trừ đi giờ máy, tính bằng mili-giây. Dương nghĩa là máy đang chậm.
    pub offset_ms: f64,
    /// Độ trễ khứ hồi đã trừ thời gian server xử lý, tính bằng mili-giây.
    pub delay_ms: f64,
    /// Máy chủ đã trả lời.
    pub server: String,
    /// Stratum của máy chủ (1 = đồng hồ tham chiếu, 2..15 = tầng dưới).
    pub stratum: u8,
}

/// Đọc mốc thời gian NTP 64-bit (32 bit giây + 32 bit phân số) thành giây thực Unix.
fn read_timestamp(buf: &[u8], at: usize) -> f64 {
    let secs = u32::from_be_bytes([buf[at], buf[at + 1], buf[at + 2], buf[at + 3]]) as u64;
    let frac = u32::from_be_bytes([buf[at + 4], buf[at + 5], buf[at + 6], buf[at + 7]]) as f64;
    // Mốc NTP tràn vào năm 2036; bit cao bằng 0 nghĩa là đã sang kỉ nguyên sau.
    let secs = if secs == 0 {
        0
    } else if buf[at] & 0x80 == 0 {
        secs + (1u64 << 32) - NTP_TO_UNIX_SECS
    } else {
        secs - NTP_TO_UNIX_SECS
    };
    secs as f64 + frac / 4_294_967_296.0
}

fn unix_now_secs() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0)
}

/// Một lần trao đổi với một máy chủ cụ thể.
fn query(server: &str) -> io::Result<SntpResult> {
    let addr = server
        .to_socket_addrs()?
        .next()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "không phân giải được tên máy chủ"))?;

    let socket = UdpSocket::bind(if addr.is_ipv4() { "0.0.0.0:0" } else { "[::]:0" })?;
    socket.set_read_timeout(Some(TIMEOUT))?;
    socket.set_write_timeout(Some(TIMEOUT))?;

    let mut packet = [0u8; 48];
    // LI = 0 (không cảnh báo), VN = 4, Mode = 3 (client).
    packet[0] = 0b00_100_011;

    // Ghi transmit timestamp của client để server phản chiếu lại — cũng là cách
    // nhận biết câu trả lời có đúng là của gói mình gửi không.
    let t1 = unix_now_secs();
    let t1_ntp = t1 + NTP_TO_UNIX_SECS as f64;
    let t1_secs = t1_ntp as u32;
    let t1_frac = ((t1_ntp - t1_secs as f64) * 4_294_967_296.0) as u32;
    packet[40..44].copy_from_slice(&t1_secs.to_be_bytes());
    packet[44..48].copy_from_slice(&t1_frac.to_be_bytes());

    socket.send_to(&packet, addr)?;

    let mut reply = [0u8; 48];
    let (read, from) = socket.recv_from(&mut reply)?;
    let t4 = unix_now_secs();

    if read < 48 {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "gói trả lời quá ngắn"));
    }
    if from.ip() != addr.ip() {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "trả lời từ địa chỉ lạ"));
    }
    let mode = reply[0] & 0b111;
    if mode != 4 {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "không phải câu trả lời của server"));
    }
    let stratum = reply[1];
    if stratum == 0 || stratum > 15 {
        // stratum 0 mang gói KoD ("kiss of death") — phải đổi máy chủ khác.
        return Err(io::Error::new(io::ErrorKind::InvalidData, "stratum không dùng được"));
    }
    // originate timestamp phải khớp với transmit timestamp ta đã gửi.
    if reply[24..32] != packet[40..48] {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "originate timestamp không khớp"));
    }

    let t2 = read_timestamp(&reply, 32); // server nhận
    let t3 = read_timestamp(&reply, 40); // server gửi đi

    // Công thức chuẩn của NTP.
    let offset = ((t2 - t1) + (t3 - t4)) / 2.0;
    let delay = ((t4 - t1) - (t3 - t2)).max(0.0);

    Ok(SntpResult {
        offset_ms: offset * 1000.0,
        delay_ms: delay * 1000.0,
        server: server.to_string(),
        stratum,
    })
}

/// Thử lần lượt các máy chủ, trả về kết quả đầu tiên thành công.
pub fn sample(servers: &[&str]) -> Result<SntpResult, String> {
    let mut last = String::from("chưa thử máy chủ nào");
    for server in servers {
        match query(server) {
            Ok(result) => return Ok(result),
            Err(err) => last = format!("{server}: {err}"),
        }
    }
    Err(last)
}
