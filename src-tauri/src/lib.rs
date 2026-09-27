mod ntp;

/// Lấy một mẫu NTP qua UDP.
///
/// Chạy trên luồng blocking vì socket UDP của std là đồng bộ; nếu gọi thẳng trên
/// luồng async sẽ chặn cả runtime trong lúc chờ timeout.
#[tauri::command]
async fn sntp_sample() -> Result<ntp::SntpResult, String> {
    tauri::async_runtime::spawn_blocking(|| ntp::sample(&ntp::DEFAULT_SERVERS))
        .await
        .map_err(|e| format!("luồng đo NTP hỏng: {e}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![sntp_sample])
        .run(tauri::generate_context!())
        .expect("không khởi động được ứng dụng Tauri");
}
