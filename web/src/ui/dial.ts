/**
 * Mặt đồng hồ dạng thiết bị đo — phần nhận diện riêng của app.
 *
 * Gồm ba lớp:
 *  1. 60 vạch giây xếp thành vòng. Các vạch đã đi qua trong phút hiện tại được
 *     thắp sáng, nên mỗi phút vòng tròn lại "nạp" đầy rồi xoá sạch.
 *  2. Kim quét chạy mượt theo phần mili-giây — đây là thứ chứng minh app thật
 *     sự biết giờ tới từng mili-giây chứ không chỉ nhảy từng giây.
 *  3. Quầng sai số quanh kim, rộng đúng bằng khoảng ±accuracy quy ra góc, có
 *     mức tối thiểu để mắt vẫn thấy khi đã đồng bộ rất tốt.
 *
 * Tất cả vẽ bằng SVG, mỗi khung hình chỉ ghi một thuộc tính transform.
 */

const SIZE = 400
const C = SIZE / 2
const TICK_R = 178
const TICK_LEN = 9
const TICK_LEN_MAJOR = 16
const HAND_TAIL = 16
const HAND_TIP = 150

const SVG_NS = 'http://www.w3.org/2000/svg'

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
  return node
}

/** Điểm trên vòng tròn; góc 0 ở đỉnh, tăng theo chiều kim đồng hồ. */
function polar(radius: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180
  return [C + radius * Math.cos(rad), C + radius * Math.sin(rad)]
}

export interface Dial {
  element: SVGSVGElement
  /** Gọi mỗi khung hình. `second` là giây kèm phần thập phân (0..60). */
  update(second: number): void
  /** Sai số ± của lần đồng bộ gần nhất, tính bằng mili-giây. */
  setAccuracy(ms: number): void
  /** Chưa đồng bộ thì mặt đồng hồ chuyển sang trạng thái mờ. */
  setLive(live: boolean): void
}

export function createDial(): Dial {
  const root = svg('svg', {
    viewBox: `0 0 ${SIZE} ${SIZE}`,
    class: 'dial__svg',
    'aria-hidden': 'true',
  })

  // vòng nền mảnh
  root.append(
    svg('circle', {
      cx: C, cy: C, r: TICK_R - TICK_LEN_MAJOR - 10,
      class: 'dial__ring',
      fill: 'none',
    }),
  )

  // 60 vạch giây
  const ticks: SVGLineElement[] = []
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0
    const len = major ? TICK_LEN_MAJOR : TICK_LEN
    const [x1, y1] = polar(TICK_R - len, i * 6)
    const [x2, y2] = polar(TICK_R, i * 6)
    const line = svg('line', {
      x1, y1, x2, y2,
      class: major ? 'dial__tick dial__tick--major' : 'dial__tick',
    })
    ticks.push(line)
    root.append(line)
  }

  // quầng sai số (vẽ trước kim để nằm dưới)
  const halo = svg('path', { class: 'dial__halo', d: '' })
  root.append(halo)

  // kim quét
  const hand = svg('g', { class: 'dial__hand' })
  hand.append(
    svg('line', { x1: C, y1: C + HAND_TAIL, x2: C, y2: C - HAND_TIP, class: 'dial__hand-line' }),
  )
  hand.append(svg('circle', { cx: C, cy: C, r: 5, class: 'dial__hand-hub' }))
  root.append(hand)

  let accuracyMs = 0
  let live = false
  let lastLitIndex = -1
  let lastHaloKey = ''

  /** Vẽ quầng sai số thành một cung quanh vị trí kim. */
  function paintHalo(second: number): void {
    // ±accuracy quy ra góc: một giây là 6°. Giữ mức sàn để còn nhìn thấy.
    const spread = Math.max(1.1, (accuracyMs / 1000) * 6)
    const key = `${Math.round(second * 4)}|${spread.toFixed(2)}|${live}`
    if (key === lastHaloKey) return
    lastHaloKey = key

    if (!live) {
      halo.setAttribute('d', '')
      return
    }
    const centre = second * 6
    const inner = C - HAND_TIP < 0 ? 0 : 60
    const outer = TICK_R - TICK_LEN_MAJOR - 14
    const [ax, ay] = polar(inner, centre - spread)
    const [bx, by] = polar(outer, centre - spread)
    const [cx2, cy2] = polar(outer, centre + spread)
    const [dx, dy] = polar(inner, centre + spread)
    const large = spread * 2 > 180 ? 1 : 0
    halo.setAttribute(
      'd',
      `M ${ax} ${ay} L ${bx} ${by} A ${outer} ${outer} 0 ${large} 1 ${cx2} ${cy2} ` +
        `L ${dx} ${dy} A ${inner} ${inner} 0 ${large} 0 ${ax} ${ay} Z`,
    )
  }

  return {
    element: root,

    update(second) {
      const angle = second * 6
      hand.setAttribute('transform', `rotate(${angle.toFixed(3)} ${C} ${C})`)

      const lit = Math.floor(second) % 60
      if (lit !== lastLitIndex) {
        // Chỉ chạm vào những vạch thật sự đổi trạng thái: khi sang phút mới thì
        // xoá cả vòng, còn lại chỉ thắp thêm một vạch.
        if (lit < lastLitIndex) {
          for (const t of ticks) t.classList.remove('is-lit')
        }
        for (let i = Math.max(0, lastLitIndex + 1); i <= lit; i++) {
          ticks[i]?.classList.add('is-lit')
        }
        lastLitIndex = lit
      }

      paintHalo(second)
    },

    setAccuracy(ms) {
      accuracyMs = ms
      lastHaloKey = ''
    },

    setLive(next) {
      if (next === live) return
      live = next
      lastHaloKey = ''
      root.classList.toggle('is-live', live)
    },
  }
}
