import { ALL_SOURCES } from './sources'
import type { ClockState, TimeSample, TimeSource } from './types'

const STORAGE_KEY = 'timeis.sync.v1'
/** Nguồn chính xác (NTP): vài mẫu là đủ, mẫu nhanh nhất thắng. */
const SAMPLES_PRECISE = 3
/** Nguồn HTTP: cần nhiều mẫu hơn để đo được độ tản mát thật sự. */
const SAMPLES_IMPRECISE = 5
/** Nghỉ giữa hai mẫu để tránh bị coi là spam và để RTT đa dạng hơn. */
const SAMPLE_GAP_MS = 220
/** Tự đồng bộ lại định kì. */
const RESYNC_INTERVAL_MS = 5 * 60_000
/** Chênh lệch giữa đồng hồ đơn điệu và đồng hồ hệ thống đủ lớn để coi là OS đã nhảy giờ. */
const CLOCK_JUMP_THRESHOLD_MS = 750

interface Persisted {
  offsetMs: number
  accuracyMs: number
  sourceId: string
  savedAtDevice: number
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Đồng hồ được đồng bộ theo kiểu NTP rút gọn.
 *
 * Với mỗi mẫu, giả định độ trễ đi và về là đối xứng:
 *     trueTime(tại lúc nhận) ≈ serverMs + rtt/2
 *     offset                 = trueTime - deviceTime
 *
 * Cách chọn kết quả phụ thuộc vào nguồn, và đây là chỗ dễ tự lừa mình nhất:
 *
 *  - Nguồn CHÍNH XÁC (NTP): dấu thời gian của server là mốc thật. Giữ MẪU CÓ RTT
 *    NHỎ NHẤT chứ không lấy trung bình — độ trễ mạng chỉ cộng thêm chứ không bao
 *    giờ trừ bớt, nên mẫu nhanh nhất là mẫu gần sự thật nhất. Sai số = ±rtt/2.
 *
 *  - Nguồn HTTP: đồng hồ ở tầng edge bị làm tròn hoặc đóng băng trong lúc xử lý
 *    request, nên rtt/2 KHÔNG phải sai số thật. Đo thực tế: RTT ổn định 73 ms mà
 *    offset vẫn tản ra gần 700 ms. Vì vậy lấy TRUNG VỊ của nhiều mẫu và công bố
 *    sai số theo độ tản mát đo được. Thà nói ±300 ms cho đúng còn hơn khoe ±35 ms
 *    rồi sai gấp mười lần.
 *
 * Đồng hồ chạy trên `performance.now()` (đơn điệu) chứ không phải `Date.now()`,
 * nên giờ hiển thị không giật khi hệ điều hành tự sửa giờ giữa chừng.
 */
export class SyncedClock {
  private state: ClockState = {
    synced: false,
    restored: false,
    offsetMs: 0,
    accuracyMs: 0,
    sourceId: '',
    sourceLabel: '',
    lastSyncAt: 0,
    sampleCount: 0,
    status: 'idle',
  }

  /** Mốc neo: epoch thật và performance.now() tương ứng. */
  private epochAnchor = Date.now()
  private perfAnchor = performance.now()

  private listeners = new Set<(s: ClockState) => void>()
  private inFlight: AbortController | null = null
  private timer: number | null = null

  constructor(private readonly sources: TimeSource[] = ALL_SOURCES) {
    this.restore()
  }

  /** Epoch ms đã hiệu chỉnh. Trả về số thực để UI vẽ được phần mili-giây. */
  now(): number {
    return this.epochAnchor + (performance.now() - this.perfAnchor)
  }

  getState(): Readonly<ClockState> {
    return this.state
  }

  subscribe(fn: (s: ClockState) => void): () => void {
    this.listeners.add(fn)
    fn(this.state)
    return () => this.listeners.delete(fn)
  }

  /** Bắt đầu đồng bộ định kì + đồng bộ lại khi tab hiện lại hoặc có mạng trở lại. */
  start(): void {
    void this.sync()
    this.timer = window.setInterval(() => void this.sync(), RESYNC_INTERVAL_MS)

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.onResume()
    })
    window.addEventListener('online', () => void this.sync())
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.inFlight?.abort()
  }

  /**
   * Khi quay lại tiền cảnh: nếu đồng hồ hệ thống đã nhảy so với đồng hồ đơn điệu
   * thì offset cũ không còn ý nghĩa — đồng bộ lại ngay.
   */
  private onResume(): void {
    const monotonicNow = this.now()
    const systemNow = Date.now() + this.state.offsetMs
    if (Math.abs(monotonicNow - systemNow) > CLOCK_JUMP_THRESHOLD_MS) {
      this.epochAnchor = systemNow
      this.perfAnchor = performance.now()
    }
    void this.sync()
  }

  /** Chạy một vòng đồng bộ đầy đủ. An toàn khi gọi chồng nhau. */
  async sync(): Promise<Readonly<ClockState>> {
    this.inFlight?.abort()
    const ctrl = new AbortController()
    this.inFlight = ctrl

    this.patch({ status: 'syncing' })

    const errors: string[] = []
    for (const source of this.sources) {
      if (ctrl.signal.aborted) break
      if (!source.isAvailable()) continue

      const samples = await this.collect(source, ctrl.signal)
      if (samples.length === 0) {
        errors.push(source.label)
        continue
      }

      this.applySamples(samples, source)
      this.inFlight = null
      return this.state
    }

    this.inFlight = null
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    this.patch({
      status: offline ? 'offline' : 'error',
      error: offline ? undefined : `Không nguồn nào phản hồi (${errors.join(', ')})`,
    })
    return this.state
  }

  private async collect(source: TimeSource, signal: AbortSignal): Promise<TimeSample[]> {
    const wanted = source.precise ? SAMPLES_PRECISE : SAMPLES_IMPRECISE
    const out: TimeSample[] = []
    for (let i = 0; i < wanted; i++) {
      if (signal.aborted) break
      try {
        out.push(await source.sample(signal))
      } catch {
        // Một mẫu hỏng không sao; vòng lặp vẫn chạy tiếp.
      }
      if (i < wanted - 1) await sleep(SAMPLE_GAP_MS)
    }
    return out
  }

  private applySamples(samples: TimeSample[], source: TimeSource): void {
    // Mỗi mẫu cho ra một ước lượng offset độc lập.
    const offsets = samples.map((s) => s.serverMs + s.rttMs / 2 - s.deviceAtReply)
    const minRtt = Math.min(...samples.map((s) => s.rttMs))
    const sourceError = samples[0]?.sourceErrorMs ?? 0

    let offsetMs: number
    let accuracyMs: number
    let anchor: TimeSample

    if (source.precise) {
      // Dấu thời gian đáng tin: mẫu nhanh nhất là mẫu tốt nhất.
      const bestIndex = samples.reduce((bi, s, i) => (s.rttMs < samples[bi]!.rttMs ? i : bi), 0)
      anchor = samples[bestIndex]!
      offsetMs = offsets[bestIndex]!
      accuracyMs = minRtt / 2 + sourceError
    } else {
      // Dấu thời gian nhiễu: trung vị chống được mẫu lạc, và độ tản mát chính là
      // sai số thật — không có cách nào biết tốt hơn thế từ phía trình duyệt.
      const sorted = [...offsets].sort((a, b) => a - b)
      offsetMs = sorted[Math.floor(sorted.length / 2)]!
      const spread = sorted[sorted.length - 1]! - sorted[0]!
      accuracyMs = Math.max(minRtt / 2 + sourceError, spread / 2)
      anchor = samples[samples.length - 1]!
    }

    // Neo đồng hồ đơn điệu vào mẫu tham chiếu, dùng offset đã chọn.
    this.epochAnchor = anchor.deviceAtReply + offsetMs
    this.perfAnchor = anchor.perfAtReply
    const sampleCount = samples.length

    this.patch({
      synced: true,
      restored: false,
      offsetMs,
      accuracyMs,
      sourceId: source.id,
      sourceLabel: source.label,
      lastSyncAt: this.epochAnchor,
      sampleCount,
      status: 'ok',
      error: undefined,
    })
    this.persist()
  }

  /** Độ lệch của đồng hồ máy: dương nghĩa là máy đang CHẠY NHANH. */
  deviceDriftMs(): number {
    return -this.state.offsetMs
  }

  private persist(): void {
    try {
      const data: Persisted = {
        offsetMs: this.state.offsetMs,
        accuracyMs: this.state.accuracyMs,
        sourceId: this.state.sourceId,
        savedAtDevice: Date.now(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      /* chế độ riêng tư có thể chặn localStorage */
    }
  }

  /**
   * Khởi động nguội khi không có mạng: dùng lại offset của lần trước.
   * Offset của tinh thể thạch anh trôi rất chậm (cỡ vài ppm), nên trong nhiều giờ
   * giá trị cũ vẫn tốt hơn nhiều so với tin tuyệt đối vào đồng hồ máy.
   */
  private restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw) as Persisted
      if (!Number.isFinite(data.offsetMs)) return

      const ageMs = Math.max(0, Date.now() - data.savedAtDevice)
      // Nới sai số theo tuổi dữ liệu: giả định trôi tối đa 50 ppm.
      const driftAllowance = ageMs * 50e-6
      this.epochAnchor = Date.now() + data.offsetMs
      this.perfAnchor = performance.now()
      this.patch({
        restored: true,
        offsetMs: data.offsetMs,
        accuracyMs: data.accuracyMs + driftAllowance,
        sourceId: data.sourceId,
        sourceLabel: 'lần đồng bộ trước',
        lastSyncAt: data.savedAtDevice + data.offsetMs,
        status: 'offline',
      })
    } catch {
      /* dữ liệu hỏng thì bỏ qua */
    }
  }

  private patch(next: Partial<ClockState>): void {
    this.state = { ...this.state, ...next }
    for (const fn of this.listeners) fn(this.state)
  }
}
