import { listTimeZones, utcOffsetMinutes, formatOffset, zoneCityName } from '../core/tz'
import type { Strings } from '../core/i18n'

/**
 * Hộp thoại chọn múi giờ. Dùng <dialog> gốc của trình duyệt để có sẵn focus trap,
 * phím Esc và backdrop — trên Android nó cũng ăn đúng nút Back của hệ thống.
 */
export function createCityPicker(
  strings: () => Strings,
  onPick: (tz: string) => void,
): { element: HTMLDialogElement; open: () => void } {
  const dialog = document.createElement('dialog')
  dialog.className = 'picker'
  dialog.innerHTML = `
    <form method="dialog" class="picker__head">
      <input type="search" class="picker__input" autocomplete="off" spellcheck="false" />
      <button class="picker__close" value="cancel" aria-label="close">&times;</button>
    </form>
    <ul class="picker__list" role="listbox"></ul>
  `
  const input = dialog.querySelector('.picker__input') as HTMLInputElement
  const list = dialog.querySelector('.picker__list') as HTMLUListElement

  const zones = listTimeZones()

  function render(query: string): void {
    const q = query.trim().toLowerCase()
    const now = new Date()
    const matches = (q ? zones.filter((z) => z.toLowerCase().includes(q)) : zones).slice(0, 200)

    if (matches.length === 0) {
      list.innerHTML = `<li class="picker__empty">${strings().noResults}</li>`
      return
    }

    list.replaceChildren(
      ...matches.map((tz) => {
        const li = document.createElement('li')
        li.className = 'picker__item'
        li.tabIndex = 0
        li.setAttribute('role', 'option')
        li.innerHTML = `
          <span class="picker__city">${zoneCityName(tz)}</span>
          <span class="picker__zone">${tz}</span>
          <span class="picker__off">${formatOffset(utcOffsetMinutes(tz, now))}</span>
        `
        const choose = () => {
          onPick(tz)
          dialog.close()
        }
        li.addEventListener('click', choose)
        li.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            choose()
          }
        })
        return li
      }),
    )
  }

  input.addEventListener('input', () => render(input.value))

  return {
    element: dialog,
    open() {
      input.placeholder = strings().searchPlaceholder
      input.value = ''
      render('')
      dialog.showModal()
      input.focus()
    },
  }
}
