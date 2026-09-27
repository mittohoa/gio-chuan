export type Lang = 'vi' | 'en'

export interface Strings {
  locale: string
  appName: string

  // bảng đồng hồ
  timeIn: (place: string) => string
  week: string
  dayOfYear: string
  dstOn: string

  // đồng hồ đo
  driftLabel: string
  precisionLabel: string
  sourceLabel: string
  ahead: string
  behind: string
  inSync: string
  samples: (n: number) => string
  rtt: string
  waiting: string

  // trạng thái
  syncing: string
  offlineCached: string
  offlineNever: string
  syncFailed: string

  // giờ thế giới
  worldClock: string
  addCity: string
  searchPlaceholder: string
  noResults: string
  remove: string
  setHome: string

  // linh tinh
  copied: string
  showMs: string
  resync: string
  themeDark: string
  themeLight: string
}

const vi: Strings = {
  locale: 'vi-VN',
  appName: 'GIỜ CHUẨN',

  timeIn: (p) => `Giờ tại ${p}`,
  week: 'tuần',
  dayOfYear: 'ngày',
  dstOn: 'giờ mùa hè',

  driftLabel: 'Độ lệch đồng hồ máy',
  precisionLabel: 'Độ chính xác đồng bộ',
  sourceLabel: 'Nguồn',
  ahead: 'chạy nhanh',
  behind: 'chạy chậm',
  inSync: 'trùng khớp',
  samples: (n) => `${n} mẫu`,
  rtt: 'RTT',
  waiting: 'đang chờ',

  syncing: 'Đang đồng bộ…',
  offlineCached: 'Ngoại tuyến — dùng lần đồng bộ gần nhất',
  offlineNever: 'Ngoại tuyến — đang hiển thị giờ máy',
  syncFailed: 'Không đồng bộ được',

  worldClock: 'Giờ thế giới',
  addCity: 'Thêm',
  searchPlaceholder: 'Tìm thành phố hoặc múi giờ…',
  noResults: 'Không tìm thấy múi giờ nào',
  remove: 'Xoá',
  setHome: 'Đặt làm múi giờ chính',

  copied: 'Đã sao chép',
  showMs: 'Hiện mili-giây',
  resync: 'Đồng bộ lại',
  themeDark: 'TỐI',
  themeLight: 'SÁNG',
}

const en: Strings = {
  locale: 'en-GB',
  appName: 'EXACT TIME',

  timeIn: (p) => `Time in ${p}`,
  week: 'week',
  dayOfYear: 'day',
  dstOn: 'DST',

  driftLabel: 'Device clock drift',
  precisionLabel: 'Sync precision',
  sourceLabel: 'Source',
  ahead: 'ahead',
  behind: 'behind',
  inSync: 'in sync',
  samples: (n) => `${n} samples`,
  rtt: 'RTT',
  waiting: 'waiting',

  syncing: 'Syncing…',
  offlineCached: 'Offline — using last sync',
  offlineNever: 'Offline — showing device time',
  syncFailed: 'Sync failed',

  worldClock: 'World clock',
  addCity: 'Add',
  searchPlaceholder: 'Search city or time zone…',
  noResults: 'No time zone matches',
  remove: 'Remove',
  setHome: 'Set as main time zone',

  copied: 'Copied',
  showMs: 'Show milliseconds',
  resync: 'Re-sync',
  themeDark: 'DARK',
  themeLight: 'LIGHT',
}

export const STRINGS: Record<Lang, Strings> = { vi, en }

export function detectLang(): Lang {
  const stored = localStorage.getItem('timeis.lang')
  if (stored === 'vi' || stored === 'en') return stored
  return navigator.language?.toLowerCase().startsWith('vi') ? 'vi' : 'en'
}
