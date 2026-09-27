/** Một mẫu đo thời gian lấy được từ một nguồn. */
export interface TimeSample {
  /** Thời gian thật (epoch ms) tại thời điểm server sinh ra câu trả lời. */
  serverMs: number
  /** Thời gian khứ hồi của request (ms). Càng nhỏ mẫu càng đáng tin. */
  rttMs: number
  /** Giá trị performance.now() ngay khi nhận được câu trả lời. */
  perfAtReply: number
  /** Date.now() ngay khi nhận được câu trả lời. */
  deviceAtReply: number
  /** Sai số nội tại của nguồn, cộng thêm vào ±rtt/2. */
  sourceErrorMs: number
  sourceId: string
}

export interface TimeSource {
  id: string
  label: string
  /** Sai số nội tại: NTP trả mốc thật -> ~1ms; header Date chỉ có giây -> 500ms. */
  sourceErrorMs: number
  /**
   * Dấu thời gian của nguồn có thật sự chính xác tới mili-giây không.
   *
   * Chỉ NTP mới đạt điều đó. Các endpoint HTTP ở biên mạng (Cloudflare, Akamai,
   * timeapi.io) đóng băng hoặc làm tròn đồng hồ trong lúc xử lý request, nên dù
   * RTT rất ổn định thì offset đo được vẫn dao động hàng trăm mili-giây. Với các
   * nguồn này phải lấy trung vị nhiều mẫu và công bố sai số theo độ tản mát thật
   * sự đo được, chứ không được lấy rtt/2 rồi coi là xong.
   */
  precise: boolean
  /** Nguồn có dùng được trong môi trường hiện tại không. */
  isAvailable(): boolean
  sample(signal: AbortSignal): Promise<TimeSample>
}

export interface ClockState {
  /** Đã đồng bộ được với một nguồn ngoài trong phiên này chưa. */
  synced: boolean
  /** Khôi phục từ lần đồng bộ trước (đang offline). */
  restored: boolean
  /** trueTime - deviceTime, tính bằng ms. Dương = đồng hồ máy đang chậm. */
  offsetMs: number
  /** Khoảng sai số ± tính bằng ms. */
  accuracyMs: number
  sourceId: string
  sourceLabel: string
  /** Thời điểm đồng bộ gần nhất (epoch thật, ms). 0 nếu chưa bao giờ. */
  lastSyncAt: number
  /** Số mẫu đã lấy trong lần đồng bộ gần nhất. */
  sampleCount: number
  status: 'idle' | 'syncing' | 'ok' | 'offline' | 'error'
  error?: string
}
