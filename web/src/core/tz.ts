/** Tiện ích múi giờ — dựa hoàn toàn vào Intl, không cần tải bảng dữ liệu nào. */

/**
 * Bộ nhớ đệm cho `Intl.DateTimeFormat`.
 *
 * Khởi tạo một formatter rất đắt — nó phải nạp dữ liệu ICU cho locale và múi giờ.
 * Vòng lặp vẽ chạy 60 khung/giây, mỗi khung lại gọi `zonedParts`, nên nếu tạo mới
 * mỗi lần thì riêng việc dựng formatter đã ngốn hết luồng chính. Trên emulator
 * điều này đủ để Android bật hộp thoại "ứng dụng không phản hồi"; trên máy thật
 * thì biểu hiện nhẹ hơn nhưng vẫn hao pin và giật hình.
 *
 * Số tổ hợp (locale, múi giờ, tuỳ chọn) rất ít nên bộ đệm không bao giờ phình to.
 */
const DTF_CACHE = new Map<string, Intl.DateTimeFormat>()

function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = locale + '|' + JSON.stringify(options)
  let dtf = DTF_CACHE.get(key)
  if (!dtf) {
    dtf = new Intl.DateTimeFormat(locale, options)
    DTF_CACHE.set(key, dtf)
  }
  return dtf
}

/** Danh sách IANA timezone của runtime; có phương án dự phòng cho engine cũ. */
export function listTimeZones(): string[] {
  const supported = (
    Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
  ).supportedValuesOf
  if (typeof supported === 'function') {
    try {
      return supported.call(Intl, 'timeZone')
    } catch {
      /* rơi xuống danh sách rút gọn */
    }
  }
  return FALLBACK_ZONES.slice()
}

/** Dùng chung bộ đệm formatter cho các module khác. */
export function cachedFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  return formatter(locale, options)
}

export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

/** Độ lệch UTC của một múi giờ tại một thời điểm, tính bằng phút. */
export function utcOffsetMinutes(tz: string, at: Date): number {
  // Diễn giải cùng một mốc theo tz rồi so với cách đọc theo UTC.
  const dtf = formatter('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = Object.fromEntries(
    dtf.formatToParts(at).map((p) => [p.type, p.value]),
  ) as Record<string, string>
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) === 24 ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000)
}

export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  const h = String(Math.floor(abs / 60)).padStart(2, '0')
  const m = String(abs % 60).padStart(2, '0')
  return `UTC${sign}${h}:${m}`
}

/** Tên viết tắt của múi giờ tại thời điểm đó, ví dụ "GMT+7", "CEST". */
export function zoneAbbreviation(tz: string, at: Date, locale: string): string {
  const parts = formatter(locale, {
    timeZone: tz,
    timeZoneName: 'short',
  }).formatToParts(at)
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
}

/** Múi giờ này có đang ở trong giai đoạn DST không (so với tháng 1 và tháng 7). */
export function isDst(tz: string, at: Date): boolean {
  const year = at.getUTCFullYear()
  const jan = utcOffsetMinutes(tz, new Date(Date.UTC(year, 0, 1)))
  const jul = utcOffsetMinutes(tz, new Date(Date.UTC(year, 6, 1)))
  return utcOffsetMinutes(tz, at) > Math.min(jan, jul)
}

/** Các thành phần lịch của một mốc thời gian, đọc theo múi giờ chỉ định. */
export interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: number // 1 = thứ Hai … 7 = Chủ Nhật (ISO)
}

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
}

export function zonedParts(epochMs: number, tz: string): ZonedParts {
  const dtf = formatter('en-US', {
    timeZone: tz,
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const p = Object.fromEntries(
    dtf.formatToParts(new Date(epochMs)).map((x) => [x.type, x.value]),
  ) as Record<string, string>
  const hour = Number(p.hour)
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: hour === 24 ? 0 : hour,
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: WEEKDAY_INDEX[p.weekday ?? 'Mon'] ?? 1,
  }
}

/** Số tuần theo ISO-8601 (tuần chứa thứ Năm quyết định năm của tuần đó). */
export function isoWeek(parts: ZonedParts): { week: number; year: number } {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day)
  // Dời về thứ Năm cùng tuần.
  const thursday = target + (4 - parts.weekday) * 86_400_000
  const thursdayDate = new Date(thursday)
  const jan1 = Date.UTC(thursdayDate.getUTCFullYear(), 0, 1)
  const week = Math.floor((thursday - jan1) / 86_400_000 / 7) + 1
  return { week, year: thursdayDate.getUTCFullYear() }
}

/** Thứ tự ngày trong năm, 1..366. */
export function dayOfYear(parts: ZonedParts): number {
  const start = Date.UTC(parts.year, 0, 1)
  const current = Date.UTC(parts.year, parts.month - 1, parts.day)
  return Math.round((current - start) / 86_400_000) + 1
}

/** Tên hiển thị gọn của một múi giờ: lấy phần cuối và thay gạch dưới. */
export function zoneCityName(tz: string): string {
  const last = tz.split('/').pop() ?? tz
  return last.replace(/_/g, ' ')
}

/** Danh sách mặc định khi người dùng mở lần đầu. */
export const DEFAULT_CITIES = [
  'Asia/Ho_Chi_Minh',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
] as const

const FALLBACK_ZONES = [
  'UTC',
  'Asia/Ho_Chi_Minh', 'Asia/Bangkok', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai',
  'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Jakarta', 'Asia/Kolkata', 'Asia/Dubai',
  'Australia/Sydney', 'Pacific/Auckland',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome',
  'Europe/Moscow', 'Europe/Istanbul',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'America/Mexico_City', 'America/Toronto',
  'Africa/Cairo', 'Africa/Lagos', 'Africa/Johannesburg',
]
