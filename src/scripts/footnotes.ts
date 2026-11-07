// 글 페이지: 각주 번호를 누르면(넓은 화면은 올리면) 그 자리에 말풍선으로 각주를 보여 준다.
// 터치 기기에서는 읽던 줄을 가리지 않게 화면 바닥 시트로 뜬다 — 자리는 CSS(@media (hover:none))가 정한다.
// 스크립트가 없으면 링크는 원래대로 본문 끝 각주 목록으로 간다.
import { noteBodyHtml, noteTransition, refIdFromHref, type NoteEvent, type NoteState } from '../lib/footnote'

const canHover = matchMedia('(hover: hover)')
const touch = matchMedia('(hover: none)')
const note = document.createElement('div')
note.className = 's-note'
note.id = 's-note'
note.setAttribute('role', 'dialog')
note.hidden = true
document.body.append(note)

const CLOSED: NoteState = { open: false, by: null, focus: false }
let open: HTMLAnchorElement | null = null
let state: NoteState = CLOSED
let hideTimer = 0

function place(a: HTMLAnchorElement) {
  // 바닥 시트는 CSS가 붙인다 — 말풍선 자리를 인라인으로 넣지 않는다(넣었던 것이 있으면 지운다)
  if (touch.matches) { note.style.removeProperty('left'); note.style.removeProperty('top'); return }
  const r = a.getBoundingClientRect()
  const w = note.offsetWidth
  const vw = document.documentElement.clientWidth
  const left = Math.max(16, Math.min(r.left + r.width / 2 - w / 2, vw - 16 - w))
  note.style.left = `${left + scrollX}px`
  note.style.top = `${r.bottom + scrollY + 10}px`
}
function apply(a: HTMLAnchorElement, li: HTMLElement, n: string, e: NoteEvent) {
  clearTimeout(hideTimer)
  const next = noteTransition(open === a ? state : CLOSED, e)
  if (open && open !== a) open.setAttribute('aria-expanded', 'false')
  if (!next.open) { if (open === a) hide(); return }
  if (open !== a) {
    note.innerHTML = `<b>각주 ${n}</b>${noteBodyHtml(li.innerHTML)}`
    note.setAttribute('aria-label', `각주 ${n}`)
  }
  note.hidden = false
  place(a)
  a.setAttribute('aria-expanded', 'true')
  open = a
  state = next
  if (next.focus) { note.tabIndex = -1; note.focus() }
}
function hide() {
  note.hidden = true
  open?.setAttribute('aria-expanded', 'false')
  open = null
  state = CLOSED
}
function leaveSoon() {
  hideTimer = window.setTimeout(() => { if (open) { state = noteTransition(state, 'leave'); if (!state.open) hide() } }, 250)
}

document.querySelectorAll<HTMLAnchorElement>('.post-body sup.fn a').forEach((a) => {
  const id = refIdFromHref(a.getAttribute('href') ?? '')
  const li = id ? document.getElementById(id) : null
  if (!id || !li) return
  const n = id.slice('ref-'.length)
  a.setAttribute('aria-expanded', 'false')
  a.setAttribute('aria-controls', 's-note')
  a.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    apply(a, li, n, e.detail === 0 ? 'key' : 'click')
  })
  a.addEventListener('mouseenter', () => { if (canHover.matches) apply(a, li, n, 'hover') })
  a.addEventListener('mouseleave', () => { if (canHover.matches && open === a) leaveSoon() })
})
note.addEventListener('mouseenter', () => clearTimeout(hideTimer))
note.addEventListener('mouseleave', () => { if (canHover.matches) leaveSoon() })
document.addEventListener('click', (e) => { if (open && !note.contains(e.target as Node)) hide() })
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !open) return
  const a = open
  hide()
  a.focus()
})
addEventListener('resize', () => { if (open) place(open) })
