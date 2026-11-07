import { createHash } from 'node:crypto'
import { parse, HTMLElement, CommentNode, type Node } from 'node-html-parser'

// 내 컴퓨터 전용 편집 모드 — 글에서 고칠 수 있는 글자 덩어리(문단·제목·항목·표 칸·그림 설명).
// 화면과 post.html이 같은 순서로 덩어리를 세므로, 화면의 n번째 덩어리가 파일의 n번째 덩어리다.
const BLOCK = new Set(['h1', 'h2', 'h3', 'h4', 'p', 'li', 'td', 'th', 'dt', 'dd', 'figcaption'])

const text = (s: string) => s.replace(/\s+/g, ' ').trim()
const tag = (el: HTMLElement) => el.rawTagName?.toLowerCase() ?? ''

function blocks(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = []
  // 돌려주는 값: 이 요소가 덩어리이거나 덩어리를 품었는가 / 도해를 품었는가
  const walk = (el: HTMLElement): [boolean, boolean] => {
    if (tag(el) === 'svg') return [false, true]
    let inner = false, svg = false
    for (const c of el.childNodes) if (c instanceof HTMLElement) { const [b, s] = walk(c); inner ||= b; svg ||= s }
    const mine = BLOCK.has(tag(el))
    // 안에 덩어리를 품은 덩어리(문단 든 항목 등)는 안쪽 것만, 도해를 품은 덩어리는 아예 세지 않는다
    if (mine && !inner && !svg) out.push(el)
    return [mine || inner, svg]
  }
  for (const c of root.childNodes) if (c instanceof HTMLElement) walk(c)
  return out.sort((a, b) => a.range[0] - b.range[0])
}

// 렌더 출력의 글 본문 덩어리에 번호를 단다(편집 모드에서만 쓴다).
export function markBlocks(articleHtml: string): string {
  const root = parse(articleHtml)
  blocks(root).forEach((el, i) => el.setAttribute('data-edit', String(i)))
  return root.toString()
}

// 파일 전체의 판 — 한 바이트라도 바뀌면 달라진다. 편집 화면은 이 판을 들고 저장한다.
export function fileVersion(postHtml: string): string {
  return createHash('sha256').update(postHtml).digest('hex').slice(0, 16)
}

// 여는 태그의 끝 — 따옴표 안의 >는 건너뛴다
function openTagEnd(html: string, start: number): number {
  let q = ''
  for (let i = start + 1; i < html.length; i++) {
    const ch = html[i]
    if (q) { if (ch === q) q = '' } else if (ch === '"' || ch === "'") q = ch
    else if (ch === '>') return i + 1
  }
  return -1
}

function locate(postHtml: string, index: number) {
  const article = parse(postHtml, { comment: true }).querySelector('article')
  if (!article) throw new Error('글 HTML에 <article>이 없다')
  const all = blocks(article)
  const el = all[index]
  if (!el) throw new Error(`${index}번 덩어리가 없다`)
  const [start, end] = el.range
  const closing = postHtml.slice(start, end).match(new RegExp(`</${tag(el)}\\s*>$`, 'i'))
  const open = openTagEnd(postHtml, start)
  // 닫는 태그를 생략한 칸(<li>a<li>b)은 경계가 불분명하니 고치지 않는다
  if (!closing || open < 0 || open > end - closing[0].length) throw new Error('닫는 태그가 없는 칸이라 고칠 수 없다 — 저에게 말로 시켜 주세요')
  return { el, all, open, close: end - closing[0].length }
}

// 꾸밈의 뼈대 — 요소 이름·속성·주석의 순서. 글자는 뺀다.
function skeleton(html: string): string {
  const walk = (n: Node): string => {
    if (n instanceof HTMLElement) {
      const attrs = Object.entries(n.attributes).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k.toLowerCase()}=${JSON.stringify(v)}`)
      return `<${tag(n)} ${attrs.join(' ')}>${n.childNodes.map(walk).join('')}</>`
    }
    return n instanceof CommentNode ? `<!--${n.rawText}-->` : ''
  }
  return parse(html, { comment: true }).childNodes.map(walk).join('')
}

// post.html의 n번째 덩어리 — 화면 글자와 대조할 글자, 원문 그대로의 안쪽 HTML
export function readBlock(postHtml: string, index: number): { text: string; inner: string } {
  const { el, open, close } = locate(postHtml, index)
  return { text: text(el.textContent), inner: postHtml.slice(open, close) }
}

// post.html의 n번째 덩어리 안쪽만 갈아 끼운다. 나머지 바이트는 그대로 두고, 바뀌는 것은 글자뿐이다.
export function applyEdit(postHtml: string, index: number, before: string, after: string): string {
  const { el, all, open, close } = locate(postHtml, index)
  if (text(el.textContent) !== text(before)) throw new Error('파일이 화면과 다르게 바뀌었다 — 새로고침한 뒤 다시 고쳐 주세요')
  const source = postHtml.slice(open, close)
  // 브라우저가 띄어쓰기를 &nbsp;로, 빈 칸 끝을 <br>로 바꿔 보내므로 원문에 없던 것이면 되돌린다
  let clean = /&nbsp;| /.test(source) ? after : after.replace(/&nbsp;| /g, ' ')
  if (!/<br\s*\/?>\s*$/i.test(source)) clean = clean.replace(/(\s*<br\s*\/?>)+\s*$/i, '')
  // 꾸밈(굵게·링크·각주)은 원래 그대로여야 한다 — 새 요소·빠진 요소·바뀐 속성은 받지 않는다.
  // 이 검사가 스크립트·이벤트 속성·javascript: 주소 같은 것이 글에 들어가는 길도 막는다.
  if (skeleton(clean) !== skeleton(source)) throw new Error('글자만 고칠 수 있다 — 꾸밈·문단·링크는 바꿀 수 없으니 저에게 말로 시켜 주세요')

  const out = postHtml.slice(0, open) + clean + postHtml.slice(close)
  // 저장 뒤 확인: 다른 덩어리는 글자 하나 안 바뀌고, 고친 덩어리는 보낸 글자가 됐는가
  const now = blocks(parse(out, { comment: true }).querySelector('article') as HTMLElement)
  const ok = now.length === all.length && now.every((b, i) => text(b.textContent) === (i === index ? text(parse(clean).textContent) : text(all[i].textContent)))
  if (!ok) throw new Error('저장 뒤 확인에 실패해 저장하지 않았다 — 저에게 알려 주세요')
  return out
}
