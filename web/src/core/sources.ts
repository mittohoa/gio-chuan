import type { TimeSample, TimeSource } from './types'

/**
 * Các nguồn giờ dùng được mà KHÔNG cần API key.
 *
 * Lưu ý pháp lý: time.is chặn truy cập bằng script (trả 403 kèm yêu cầu xin API
 * riêng), nên không nguồn nào ở đây gọi tới time.is.
 */

const REQUEST_TIMEOUT_MS = 4000

async function timedFetch(
  url: string,
  outerSignal: AbortSignal,
  init: RequestInit = {},
): Promise<{ res: Response; perfAtReply: number; deviceAtReply: number; rttMs: number }> {
  const local = new AbortController()
  const timer = setTimeout(() => local.abort(), REQUEST_TIMEOUT_MS)
  const onOuterAbort = () => local.abort()
  outerSignal.addEventListener('abort', onOuterAbort, { once: true })

  const perfStart = performance.now()
  try {
    const res = await fetch(url, { ...init, cache: 'no-store', signal: local.signal })
    // Chốt mốc NGAY khi header về, trước khi đọc body — dấu thời gian của server
    // được sinh ra trước thời điểm này.
    const perfAtReply = performance.now()
    return {
      res,
      perfAtReply,
      deviceAtReply: Date.now(),
      rttMs: perfAtReply - perfStart,
    }
  } finally {
    clearTimeout(timer)
    outerSignal.removeEventListener('abort', onOuterAbort)
  }
}

/**
 * Cloudflare anycast trace endpoint.
 *
 * Trả về text kiểu `key=value` mỗi dòng, `ts` là epoch giây kèm 3 chữ số thập
 * phân. RTT rất thấp và rất ổn định nhờ anycast, nên đây là nguồn web tốt nhất
 * đo được — NHƯNG `ts` chỉ trông giống chính xác tới mili-giây thôi. Đo thực tế
 * với RTT ổn định 73 ms, offset vẫn tản ra gần 700 ms, vì đồng hồ ở tầng edge bị
 * đóng băng trong lúc xử lý request. Vì vậy `precise: false`.
 */
export const cloudflareTrace: TimeSource = {
  id: 'cloudflare',
  label: 'Cloudflare anycast',
  sourceErrorMs: 1,
  precise: false,
  isAvailable: () => true,
  async sample(signal) {
    const { res, perfAtReply, deviceAtReply, rttMs } = await timedFetch(
      'https://cloudflare.com/cdn-cgi/trace',
      signal,
    )
    if (!res.ok) throw new Error(`cloudflare HTTP ${res.status}`)
    const body = await res.text()
    const match = /(?:^|\n)ts=([0-9]+(?:\.[0-9]+)?)/.exec(body)
    if (!match?.[1]) throw new Error('cloudflare: không tìm thấy trường ts')
    return {
      serverMs: Number.parseFloat(match[1]) * 1000,
      rttMs,
      perfAtReply,
      deviceAtReply,
      sourceErrorMs: cloudflareTrace.sourceErrorMs,
      sourceId: cloudflareTrace.id,
    }
  },
}

/** timeapi.io — JSON công khai, có CORS, chậm hơn nhưng độc lập nhà cung cấp. */
export const timeApiIo: TimeSource = {
  id: 'timeapi',
  label: 'timeapi.io',
  sourceErrorMs: 5,
  precise: false,
  isAvailable: () => true,
  async sample(signal) {
    const { res, perfAtReply, deviceAtReply, rttMs } = await timedFetch(
      'https://timeapi.io/api/Time/current/zone?timeZone=UTC',
      signal,
    )
    if (!res.ok) throw new Error(`timeapi HTTP ${res.status}`)
    const data = (await res.json()) as { dateTime?: string }
    if (!data.dateTime) throw new Error('timeapi: thiếu dateTime')
    // dateTime không có hậu tố múi giờ nhưng đã là UTC vì ta hỏi zone=UTC.
    const serverMs = Date.parse(`${data.dateTime.replace(/(\.\d{3})\d+$/, '$1')}Z`)
    if (!Number.isFinite(serverMs)) throw new Error('timeapi: dateTime không hợp lệ')
    return {
      serverMs,
      rttMs,
      perfAtReply,
      deviceAtReply,
      sourceErrorMs: timeApiIo.sourceErrorMs,
      sourceId: timeApiIo.id,
    }
  },
}

/**
 * Phương án cuối: header `Date` của một response HTTP bất kì.
 * Chỉ có độ phân giải 1 giây nên sai số nội tại ±500ms, nhưng gần như luôn chạy.
 */
export const httpDateHeader: TimeSource = {
  id: 'http-date',
  label: 'HTTP Date header',
  sourceErrorMs: 500,
  precise: false,
  isAvailable: () => true,
  async sample(signal) {
    const { res, perfAtReply, deviceAtReply, rttMs } = await timedFetch(
      'https://cloudflare.com/cdn-cgi/trace',
      signal,
      { method: 'HEAD' },
    )
    const header = res.headers.get('date')
    if (!header) throw new Error('http-date: response không có header Date')
    const parsed = Date.parse(header)
    if (!Number.isFinite(parsed)) throw new Error('http-date: header Date không hợp lệ')
    // Header làm tròn xuống giây -> dịch nửa giây để kì vọng sai lệch bằng 0.
    return {
      serverMs: parsed + 500,
      rttMs,
      perfAtReply,
      deviceAtReply,
      sourceErrorMs: httpDateHeader.sourceErrorMs,
      sourceId: httpDateHeader.id,
    }
  },
}

/** Có đang chạy bên trong vỏ Tauri (Windows/Linux/Android) không. */
export function isNativeShell(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

interface SntpResult {
  /** Giờ thật trừ giờ máy (ms). */
  offset_ms: number
  /** Độ trễ khứ hồi đã trừ thời gian server xử lý (ms). */
  delay_ms: number
  server: string
  stratum: number
}

/**
 * SNTP thật qua UDP, chạy trong tiến trình Rust của Tauri.
 * Chính xác hơn hẳn mọi nguồn HTTP vì không phải gánh chi phí bắt tay TLS.
 *
 * Rust trả về offset/delay theo đúng công thức NTP. Ở đây ta dựng ngược lại
 * thành một `TimeSample` để engine dùng chung một đường tính:
 * engine sẽ cộng lại `rtt/2`, nên phải trừ đi đúng phần đó khi đặt `serverMs`.
 */
export const nativeSntp: TimeSource = {
  id: 'sntp',
  label: 'NTP (UDP)',
  sourceErrorMs: 1,
  precise: true,
  isAvailable: isNativeShell,
  async sample() {
    const { invoke } = await import('@tauri-apps/api/core')
    const raw = await invoke<SntpResult>('sntp_sample')
    const perfAtReply = performance.now()
    const deviceAtReply = Date.now()
    return {
      serverMs: deviceAtReply + raw.offset_ms - raw.delay_ms / 2,
      rttMs: raw.delay_ms,
      perfAtReply,
      deviceAtReply,
      sourceErrorMs: nativeSntp.sourceErrorMs,
      sourceId: nativeSntp.id,
    }
  },
}

/** Thứ tự ưu tiên: native NTP > Cloudflare > timeapi.io > header Date. */
export const ALL_SOURCES: TimeSource[] = [
  nativeSntp,
  cloudflareTrace,
  timeApiIo,
  httpDateHeader,
]

export type { TimeSample, TimeSource }
