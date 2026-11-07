import { parse, HTMLElement } from 'node-html-parser'
import type { TocItem } from './toc'

// 공개 글 페이지의 표현 변환 — 글 원문(post.html, articleHtml)은 그대로 두고 화면에 내는 모양만 바꾼다.
// 편집 화면은 이 함수를 쓰지 않는다(덩어리 번호는 원문 순서 그대로여야 한다).
const text = (s: string) => s.replace(/\s+/g, ' ').trim()
const tag = (el: HTMLElement) => el.rawTagName?.toLowerCase() ?? ''
const elements = (el: HTMLElement) => el.childNodes.filter((n): n is HTMLElement => n instanceof HTMLElement)
const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// 도해를 가로로 밀어 볼 만큼 넓은가 — viewBox 폭 600 이상(실제 글의 도해는 전부 680)
const WIDE = 600
function viewBoxWidth(svg: HTMLElement): number {
  const box = (svg.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number)
  return box.length === 4 && Number.isFinite(box[2]) ? box[2] : 0
}

// 문장형 표: 머리가 있고, 합친 칸이 없고, 칸의 글자 수 평균이 30을 넘는다
const PROSE = 30
function isProse(table: HTMLElement): boolean {
  if (!table.querySelector('thead') || table.querySelector('[colspan], [rowspan]')) return false
  const cells = table.querySelectorAll('td')
  if (!cells.length) return false
  return cells.reduce((n, td) => n + text(td.textContent).length, 0) / cells.length > PROSE
}

export function presentPost(articleHtml: string): { body: string; toc: TocItem[]; titleHtml: string | null } {
  const root = parse(articleHtml)

  // 1. 글머리 떼기 — 앞머리에 있는 코너·제목·메타만, 있는 것만. 밤 구역(히어로)이 따로 그린다
  let titleHtml: string | null = null
  for (const el of elements(root)) {
    const isTitle = tag(el) === 'h1'
    if (!isTitle && !el.classList.contains('kicker') && !el.classList.contains('meta')) break
    if (isTitle && elements(el).length) titleHtml = el.innerHTML
    el.remove()
  }

  // 2. h2에 목차용 id — addHeadingIds와 같은 규칙
  const toc = root.querySelectorAll('h2').map((h, i) => {
    const id = h.getAttribute('id') || `s-${i + 1}`
    h.setAttribute('id', id)
    return { id, text: text(h.textContent) }
  })

  // 3. 넓은 도해는 휴대폰에서 가로로 밀어 보는 칸으로 감싼다 — figure 바로 아래의 것만
  for (const figure of root.querySelectorAll('figure')) {
    for (const svg of elements(figure)) {
      if (tag(svg) === 'svg' && viewBoxWidth(svg) >= WIDE) svg.replaceWith(`<div class="s-fig-scroll">${svg.outerHTML}</div>`)
    }
  }

  // 4. 문장형 표는 휴대폰에서 카드로 쌓는다 — 칸마다 그 열의 머리글을 달아 둔다
  for (const table of root.querySelectorAll('table')) {
    if (!isProse(table)) continue
    const heads = table.querySelectorAll('thead th').map((th) => text(th.textContent))
    table.setAttribute('data-prose', '')
    for (const tr of table.querySelectorAll('tr')) {
      elements(tr).forEach((cell, i) => {
        if (tag(cell) === 'td' && heads[i]) cell.setAttribute('data-label', escapeAttr(heads[i]))
      })
    }
  }

  return { body: root.toString(), toc, titleHtml }
}
