import { SyncedClock } from '../core/clock'
import type { ClockState } from '../core/types'
import { STRINGS, detectLang, type Lang, type Strings } from '../core/i18n'
import {
  DEFAULT_CITIES, dayOfYear, formatOffset, isDst, isoWeek, localTimeZone,
  utcOffsetMinutes, zoneAbbreviation, zoneCityName, zonedParts,
} from '../core/tz'
import { createCityPicker } from './cityPicker'
import { createDial } from './dial'

const SETTINGS_KEY = 'timeis.settings.v1'

/** Thang đo độ chính xác: 1 ms = đầy vạch, 10 s = cạn. */
const PRECISION_BEST_MS = 1
const PRECISION_WORST_MS = 10_000
/** Kim đo độ lệch chạy hết thang ở ±1 giây. */
const DRIFT_FULL_SCALE_MS = 1000

interface Settings {
  lang: Lang
  theme: 'dark' | 'light'
  showMs: boolean
  homeZone: string
  cities: string[]
}

function loadSettings(): Settings {
  const base: Settings = {
    lang: detectLang(),
    theme: 'dark',
    showMs: true,
    homeZone: localTimeZone(),
    cities: [...DEFAULT_CITIES],
  }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...base, ...(JSON.parse(raw) as Partial<Settings>) } : base
  } catch {
    return base
  }
}

function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
    localStorage.setItem('timeis.lang', s.lang)
  } catch {
    /* bỏ qua */
  }
}

const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, '0')

/** Hiển thị khoảng thời gian ngắn ở đơn vị đọc được nhất. */
function humanMs(ms: number, decimalMark: string): string {
  const abs = Math.abs(ms)
  if (abs < 1000) return `${abs.toFixed(abs < 10 ? 1 : 0).replace('.', decimalMark)} ms`
  return `${(abs / 1000).toFixed(abs < 10_000 ? 2 : 1).replace('.', decimalMark)} s`
}

export function mountApp(root: HTMLElement): void {
  let settings = loadSettings()
  const clock = new SyncedClock()
  const dial = createDial()
  const s = (): Strings => STRINGS[settings.lang]
  const decimalMark = () => (settings.lang === 'vi' ? ',' : '.')

  root.innerHTML = `
    <header class="bar">
      <div class="bar__id">
        <span class="led" id="led"></span>
        <span class="bar__name" id="brand"></span>
      </div>
      <div class="bar__actions">
        <button class="chip" id="btnMs" type="button">.000</button>
        <button class="chip" id="btnLang" type="button">VI</button>
        <button class="chip" id="btnTheme" type="button" aria-label="theme">◐</button>
        <button class="chip chip--go" id="btnSync" type="button"></button>
      </div>
    </header>

    <section class="stage">
      <div class="dial" id="dial">
        <div class="dial__center">
          <div class="dial__place" id="place"></div>
          <div class="dial__time">
            <span id="clockMain">--:--:--</span><span class="dial__ms" id="clockMs"></span>
          </div>
          <div class="dial__zone" id="zoneinfo"></div>
        </div>
      </div>
      <p class="stage__date" id="date"></p>
      <p class="stage__note" id="note"></p>
    </section>

    <section class="gauges">
      <div class="gauge">
        <div class="gauge__label" id="driftLabel"></div>
        <div class="drift">
          <div class="drift__track">
            <span class="drift__zero"></span>
            <span class="drift__needle" id="needle"></span>
          </div>
          <div class="drift__scale"><span>−1 s</span><span>0</span><span>+1 s</span></div>
        </div>
        <div class="gauge__value" id="driftValue">—</div>
      </div>

      <div class="gauge">
        <div class="gauge__label" id="precLabel"></div>
        <div class="prec"><div class="prec__fill" id="precFill"></div></div>
        <div class="gauge__value" id="precValue">—</div>
      </div>
    </section>

    <section class="readout" id="readout"></section>

    <section class="world">
      <div class="world__head">
        <h2 id="worldTitle"></h2>
        <button class="chip" id="btnAdd" type="button"></button>
      </div>
      <ul class="cities" id="cities"></ul>
    </section>

    <div class="toast" id="toast" role="status" aria-live="polite"></div>
  `

  const q = <T extends Element>(sel: string) => root.querySelector(sel) as T
  const el = {
    led: q<HTMLElement>('#led'),
    brand: q<HTMLElement>('#brand'),
    btnMs: q<HTMLButtonElement>('#btnMs'),
    btnLang: q<HTMLButtonElement>('#btnLang'),
    btnTheme: q<HTMLButtonElement>('#btnTheme'),
    btnSync: q<HTMLButtonElement>('#btnSync'),
    btnAdd: q<HTMLButtonElement>('#btnAdd'),
    dial: q<HTMLElement>('#dial'),
    place: q<HTMLElement>('#place'),
    clockMain: q<HTMLElement>('#clockMain'),
    clockMs: q<HTMLElement>('#clockMs'),
    zoneinfo: q<HTMLElement>('#zoneinfo'),
    date: q<HTMLElement>('#date'),
    note: q<HTMLElement>('#note'),
    driftLabel: q<HTMLElement>('#driftLabel'),
    needle: q<HTMLElement>('#needle'),
    driftValue: q<HTMLElement>('#driftValue'),
    precLabel: q<HTMLElement>('#precLabel'),
    precFill: q<HTMLElement>('#precFill'),
    precValue: q<HTMLElement>('#precValue'),
    readout: q<HTMLElement>('#readout'),
    worldTitle: q<HTMLElement>('#worldTitle'),
    cities: q<HTMLUListElement>('#cities'),
    toast: q<HTMLElement>('#toast'),
  }

  el.dial.prepend(dial.element)

  const picker = createCityPicker(s, (tz) => {
    if (!settings.cities.includes(tz)) {
      settings = { ...settings, cities: [...settings.cities, tz] }
      saveSettings(settings)
      renderCities()
    }
  })
  root.appendChild(picker.element)

  // ---- hành động ----------------------------------------------------------
  el.btnAdd.addEventListener('click', () => picker.open())
  el.btnSync.addEventListener('click', () => void clock.sync())

  el.btnMs.addEventListener('click', () => {
    settings = { ...settings, showMs: !settings.showMs }
    saveSettings(settings)
    renderChrome()
  })

  el.btnLang.addEventListener('click', () => {
    settings = { ...settings, lang: settings.lang === 'vi' ? 'en' : 'vi' }
    saveSettings(settings)
    renderChrome()
    renderState(clock.getState())
    renderCities()
    lastDate = ''
  })

  el.btnTheme.addEventListener('click', () => {
    settings = { ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' }
    saveSettings(settings)
    applyTheme()
    renderChrome()
  })

  const copyNow = () => {
    const p = zonedParts(clock.now(), settings.homeZone)
    navigator.clipboard
      ?.writeText(`${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`)
      .then(() => toast(s().copied))
      .catch(() => {})
  }
  el.dial.addEventListener('click', copyNow)

  let toastTimer = 0
  function toast(msg: string): void {
    el.toast.textContent = msg
    el.toast.classList.add('toast--on')
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => el.toast.classList.remove('toast--on'), 1600)
  }

  function applyTheme(): void {
    document.documentElement.dataset.theme = settings.theme
  }

  // ---- render -------------------------------------------------------------
  function renderChrome(): void {
    const t = s()
    el.brand.textContent = t.appName
    el.btnLang.textContent = settings.lang === 'vi' ? 'VI' : 'EN'
    el.btnMs.classList.toggle('is-on', settings.showMs)
    el.btnMs.title = t.showMs
    el.btnTheme.textContent = settings.theme === 'dark' ? t.themeDark : t.themeLight
    el.btnSync.textContent = t.resync
    el.btnAdd.textContent = `+ ${t.addCity}`
    el.driftLabel.textContent = t.driftLabel
    el.precLabel.textContent = t.precisionLabel
    el.worldTitle.textContent = t.worldClock
    document.documentElement.lang = settings.lang
    document.title = `${t.appName} · ${t.timeIn(zoneCityName(settings.homeZone))}`
  }

  function renderState(st: ClockState): void {
    const t = s()
    const dp = decimalMark()
    const usable = st.synced || st.restored

    dial.setLive(usable)
    dial.setAccuracy(st.accuracyMs)

    // đèn báo trạng thái
    el.led.dataset.state =
      st.status === 'syncing' ? 'busy' : st.synced ? 'ok' : usable ? 'stale' : 'down'

    // ghi chú dưới ngày tháng
    if (st.status === 'syncing' && !usable) el.note.textContent = t.syncing
    else if (st.status === 'offline') el.note.textContent = usable ? t.offlineCached : t.offlineNever
    else if (st.status === 'error') el.note.textContent = st.error ?? t.syncFailed
    else el.note.textContent = ''

    // đồng hồ đo độ lệch
    if (usable) {
      const drift = clock.deviceDriftMs()
      const clamped = Math.max(-DRIFT_FULL_SCALE_MS, Math.min(DRIFT_FULL_SCALE_MS, drift))
      el.needle.style.left = `${50 + (clamped / DRIFT_FULL_SCALE_MS) * 50}%`
      el.needle.dataset.pegged = String(Math.abs(drift) > DRIFT_FULL_SCALE_MS)
      const word = Math.abs(drift) < 50 ? t.inSync : drift > 0 ? t.ahead : t.behind
      const sign = Math.abs(drift) < 50 ? '' : drift > 0 ? '+' : '−'
      el.driftValue.textContent =
        Math.abs(drift) < 50 ? word : `${sign}${humanMs(drift, dp)} · ${word}`
      el.driftValue.dataset.tone = Math.abs(drift) > 2000 ? 'warn' : 'ok'
    } else {
      el.needle.style.left = '50%'
      el.driftValue.textContent = '—'
      el.driftValue.dataset.tone = 'muted'
    }

    // đồng hồ đo độ chính xác — thang log vì sai số trải từ ms tới giây
    if (usable && st.accuracyMs > 0) {
      const span = Math.log10(PRECISION_WORST_MS / PRECISION_BEST_MS)
      const level = 1 - Math.log10(st.accuracyMs / PRECISION_BEST_MS) / span
      el.precFill.style.width = `${Math.max(2, Math.min(100, level * 100))}%`
      el.precValue.textContent = `±${humanMs(st.accuracyMs, dp)}`
      el.precValue.dataset.tone = st.accuracyMs < 250 ? 'ok' : 'warn'
    } else {
      el.precFill.style.width = '0%'
      el.precValue.textContent = '—'
      el.precValue.dataset.tone = 'muted'
    }

    // dòng đọc thông số
    const bits = usable
      ? [st.sourceLabel, t.samples(st.sampleCount)].filter(Boolean)
      : [t.waiting]
    el.readout.textContent = `${t.sourceLabel.toUpperCase()}  ${bits.join('  ·  ')}`
  }

  function renderCities(): void {
    const t = s()
    const now = clock.now()
    const asDate = new Date(now)
    const home = zonedParts(now, settings.homeZone)
    const homeOffset = utcOffsetMinutes(settings.homeZone, asDate)

    el.cities.replaceChildren(
      ...settings.cities.map((tz) => {
        const p = zonedParts(now, tz)
        const offset = utcOffsetMinutes(tz, asDate)
        const diffH = (offset - homeOffset) / 60

        const li = document.createElement('li')
        li.className = 'city'
        if (tz === settings.homeZone) li.classList.add('is-home')

        const name = document.createElement('span')
        name.className = 'city__name'
        name.textContent = zoneCityName(tz)

        const meta = document.createElement('span')
        meta.className = 'city__meta'
        meta.textContent =
          formatOffset(offset) + (diffH === 0 ? '' : `  ${diffH > 0 ? '+' : '−'}${Math.abs(diffH)}h`)

        const time = document.createElement('span')
        time.className = 'city__time'
        time.textContent = `${pad(p.hour)}:${pad(p.minute)}`

        const tag = document.createElement('span')
        tag.className = 'city__day'
        tag.textContent = dayTagFor(p, home)

        const rm = document.createElement('button')
        rm.className = 'city__rm'
        rm.type = 'button'
        rm.setAttribute('aria-label', t.remove)
        rm.textContent = '×'
        rm.addEventListener('click', (e) => {
          e.stopPropagation()
          settings = { ...settings, cities: settings.cities.filter((z) => z !== tz) }
          saveSettings(settings)
          renderCities()
        })

        // Bấm vào một thành phố là chuyển nó thành múi giờ chính của mặt đồng hồ.
        li.title = t.setHome
        li.addEventListener('click', () => {
          settings = { ...settings, homeZone: tz }
          saveSettings(settings)
          lastDate = ''
          renderChrome()
          renderCities()
        })

        li.append(name, meta, time, tag, rm)
        return li
      }),
    )
  }

  // ---- vòng lặp vẽ ---------------------------------------------------------
  let lastMain = ''
  let lastMs = ''
  let lastDate = ''
  let lastMinute = -1

  function tick(): void {
    const now = clock.now()
    const p = zonedParts(now, settings.homeZone)
    const t = s()

    // Kim quét chạy theo giây thật kèm phần lẻ, nên chuyển động mượt liên tục.
    dial.update(p.second + (now % 1000) / 1000)

    const main = `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`
    if (main !== lastMain) {
      el.clockMain.textContent = main
      lastMain = main
    }

    if (settings.showMs) {
      const ms = `.${pad(now % 1000, 3)}`
      if (ms !== lastMs) {
        el.clockMs.textContent = ms
        lastMs = ms
      }
    } else if (lastMs !== '') {
      el.clockMs.textContent = ''
      lastMs = ''
    }

    const dateStr = new Intl.DateTimeFormat(t.locale, {
      timeZone: settings.homeZone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(now))
    const { week } = isoWeek(p)
    const full = `${dateStr}  ·  ${t.week} ${week}  ·  ${t.dayOfYear} ${dayOfYear(p)}`

    if (full !== lastDate) {
      el.date.textContent = full
      el.place.textContent = zoneCityName(settings.homeZone)
      const abbr = zoneAbbreviation(settings.homeZone, new Date(now), t.locale)
      const off = formatOffset(utcOffsetMinutes(settings.homeZone, new Date(now)))
      const dst = isDst(settings.homeZone, new Date(now)) ? ` · ${t.dstOn}` : ''
      el.zoneinfo.textContent = `${abbr} · ${off}${dst}`
      lastDate = full
    }

    if (p.minute !== lastMinute) {
      lastMinute = p.minute
      renderCities()
    }

    requestAnimationFrame(tick)
  }

  // ---- khởi động -----------------------------------------------------------
  applyTheme()
  renderChrome()
  renderCities()
  clock.subscribe(renderState)
  clock.start()
  requestAnimationFrame(tick)
}

/** "+1" / "−1" khi thành phố đó đã sang ngày khác so với múi giờ chính. */
function dayTagFor(
  there: { year: number; month: number; day: number },
  home: { year: number; month: number; day: number },
): string {
  const diff = Math.round(
    (Date.UTC(there.year, there.month - 1, there.day) -
      Date.UTC(home.year, home.month - 1, home.day)) /
      86_400_000,
  )
  if (diff === 0) return ''
  return diff > 0 ? `+${diff}` : `−${Math.abs(diff)}`
}
