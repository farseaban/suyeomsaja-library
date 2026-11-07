import { parse } from 'node-html-parser'

export type TocItem = { id: string; text: string }

// 글 본문의 h2에 목차용 id를 붙인다(렌더 출력만 바뀌고 post.html 원본은 그대로). 이미 id가 있으면 그것을 쓴다.
export function addHeadingIds(articleHtml: string): { html: string; toc: TocItem[] } {
  const root = parse(articleHtml)
  const toc = root.querySelectorAll('h2').map((h, i) => {
    const id = h.getAttribute('id') || `s-${i + 1}`
    h.setAttribute('id', id)
    return { id, text: h.textContent.replace(/\s+/g, ' ').trim() }
  })
  return { html: toc.length ? root.toString() : articleHtml, toc }
}
