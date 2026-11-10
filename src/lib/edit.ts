import { createHash } from 'node:crypto'
import { parse, HTMLElement, CommentNode, type Node } from 'node-html-parser'

// 내 컴퓨터 전용 편집 모드 — 글에서 고칠 수 있는 글자 덩어리(문단·제목·항목·표 칸·그림 설명).
// 화면과 post.html이 같은 순서로 덩어리를 세므로, 화면의 n번째 덩어리가 파일의 n번째 덩어리다.
const BLOCK = new Set(['h1', 'h2', 'h3', 'h4', 'p', 'li', 'td', 'th', 'dt', 'dd', 'figcaption'])
// 노란 상자(div.key)·주의 상자(div.caution)는 글자가 div에 바로 들어 있어서 따로 센다(사용자 11/10)
const BOX = /(^|\s)(key|caution)(\s|$)/
// 칸 안에서 새로 넣거나 뺄 수 있는 꾸밈 — 속성 없는 것만(사용자 11/10)
const FORMAT = new Set(['strong', 'b', 'em', 'i', 'u'])
// 글자를 다 지우면 칸째 빠지는 덩어리. 제목(h1)과 표 칸은 빠지면 틀이 깨지므로 남긴다
const REMOVABLE = new Set(['p', 'li', 'div', 'figcaption', 'h2', 'h3', 'h4', 'dt', 'dd'])

const text = (s: string) => s.replace(/\s+/g, ' ').trim()
const tag = (el: HTMLElement) => el.rawTagName?.toLowerCase() ?? ''
const isBlock = (el: HTMLElement) => BLOCK.has(tag(el)) || (tag(el) === 'div' && BOX.test(el.getAttribute('class') ?? ''))

function blocks(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = []
  // 돌려주는 값: 이 요소가 덩어리이거나 덩어리를 품었는가 / 도해를 품었는가
  const walk = (el: HTMLElement): [boolean, boolean] => {
    if (tag(el) === 'svg') return [false, true]
    let inner = false, svg = false
    for (const c of el.childNodes) if (c instanceof HTMLElement) { const [b, s] = walk(c); inner ||= b; svg ||= s }
    const mine = isBlock(el)
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
// 속성 없는 굵게·기울임·밑줄은 뼈대에서 투명하다 — 새로 넣거나 빼도 같은 뼈대로 본다
function skeleton(html: string): string {
  const walk = (n: Node): string => {
    if (n instanceof HTMLElement) {
      if (FORMAT.has(tag(n)) && Object.keys(n.attributes).length === 0) return n.childNodes.map(walk).join('')
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
// 칸을 통째로 들어낸다. 그 칸만 감싸던 인용(blockquote)은 함께 들어낸다. 뒤따르는 줄바꿈도 하나 지운다
function removeBlock(postHtml: string, el: HTMLElement): string {
  let target = el
  const parent = el.parentNode as HTMLElement | null
  if (parent && tag(parent) === 'blockquote' && parent.childNodes.every((c) => c === el || (!(c instanceof HTMLElement) && text(c.text) === '')))
    target = parent
  const [start, end] = target.range
  const tail = postHtml.slice(end).match(/^[ \t]*\r?\n/)
  return postHtml.slice(0, start) + postHtml.slice(end + (tail ? tail[0].length : 0))
}

export function applyEdit(postHtml: string, index: number, before: string, after: string): string {
  const { el, all, open, close } = locate(postHtml, index)
  if (text(el.textContent) !== text(before)) throw new Error('파일이 화면과 다르게 바뀌었다 — 새로고침한 뒤 다시 고쳐 주세요')
  const source = postHtml.slice(open, close)
  // 글자를 다 지운 칸은 빈 <p></p>로 남기지 않고 칸째 들어낸다(사용자 11/10)
  // 빈 칸으로 치는 것은 띄어쓰기·줄바꿈·빈 꾸밈뿐이다 — 글자 없는 다른 태그(<base> 등)는 아래 꾸밈 검사로 막는다
  const emptied = after.replace(/<br\s*\/?>|&nbsp;|\u00a0|\s|<\/?(strong|b|em|i|u)>/gi, '') === ''
  if (emptied && REMOVABLE.has(tag(el))) {
    const out = removeBlock(postHtml, el)
    const now = blocks(parse(out, { comment: true }).querySelector('article') as HTMLElement)
    const rest = all.filter((_, i) => i !== index)
    if (now.length !== rest.length || !now.every((b, i) => text(b.textContent) === text(rest[i].textContent)))
      throw new Error('저장 뒤 확인에 실패해 저장하지 않았다 — 저에게 알려 주세요')
    return out
  }
  if (tag(el) === 'h1' && emptied) throw new Error('제목은 비울 수 없다')
  // 브라우저가 띄어쓰기를 &nbsp;로, 빈 칸 끝을 <br>로 바꿔 보내므로 원문에 없던 것이면 되돌린다
  let clean = /&nbsp;| /.test(source) ? after : after.replace(/&nbsp;| /g, ' ')
  if (!/<br\s*\/?>\s*$/i.test(source)) clean = clean.replace(/(\s*<br\s*\/?>)+\s*$/i, '')
  // 글자 없는 꾸밈 껍데기는 지운다(원문의 b·i는 그대로 둔다 — 편집 화면은 strong·em·u만 새로 만든다)
  for (let prev = ''; prev !== clean; ) { prev = clean; clean = clean.replace(/<(strong|em|u)><\/\1>/g, '') }
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

// 문단 하나를 인용 상자(blockquote.quote)로 감싸거나, 그 문단만 감싼 인용을 푼다(사용자 11/10)
export function toggleQuote(postHtml: string, index: number, before: string): string {
  const { el, all } = locate(postHtml, index)
  if (text(el.textContent) !== text(before)) throw new Error('파일이 화면과 다르게 바뀌었다 — 새로고침한 뒤 다시 고쳐 주세요')
  if (tag(el) !== 'p') throw new Error('문단만 인용으로 바꿀 수 있다')
  const parent = el.parentNode as HTMLElement
  const [start, end] = el.range
  let out: string
  if (tag(parent) === 'blockquote') {
    const others = parent.childNodes.filter((c) => c !== el && (c instanceof HTMLElement || text(c.text) !== ''))
    if (others.length) throw new Error('출처 줄이 붙은 인용은 풀 수 없다 — 저에게 말로 시켜 주세요')
    const [ps, pe] = parent.range
    out = postHtml.slice(0, ps) + postHtml.slice(start, end) + postHtml.slice(pe)
  } else if (['article', 'section'].includes(tag(parent))) {
    out = postHtml.slice(0, start) + '<blockquote class="quote">' + postHtml.slice(start, end) + '</blockquote>' + postHtml.slice(end)
  } else throw new Error('상자나 목록 안의 문단은 인용으로 바꿀 수 없다')
  const now = blocks(parse(out, { comment: true }).querySelector('article') as HTMLElement)
  if (now.length !== all.length || !now.every((b, i) => text(b.textContent) === text(all[i].textContent)))
    throw new Error('저장 뒤 확인에 실패해 저장하지 않았다 — 저에게 알려 주세요')
  return out
}

// 고르던 칸 바로 뒤에 새 문단을 넣는다(사용자 11/10). 칸이 상자·인용·그림·목록 안에 있으면 그 덩어리 뒤에 넣는다.
// 새 문단은 글자와 속성 없는 꾸밈만 받는다. 돌려주는 index는 새 문단의 덩어리 번호다
export const NEW_PARAGRAPH = '(새 문단)'
export function insertParagraph(postHtml: string, index: number, before: string, content = NEW_PARAGRAPH): { html: string; index: number } {
  const { el, all } = locate(postHtml, index)
  if (text(el.textContent) !== text(before)) throw new Error('파일이 화면과 다르게 바뀌었다 — 새로고침한 뒤 다시 고쳐 주세요')
  if (skeleton(content) !== '' || text(parse(content).textContent) === '') throw new Error('새 문단에는 글자만 넣을 수 있다')
  if (tag(el) === 'h1') throw new Error('제목 뒤에는 문단을 넣을 수 없다 — 본문 문단을 고른 뒤 누르세요')
  let anchor: HTMLElement = el
  while (anchor.parentNode && !['article', 'section'].includes(tag(anchor.parentNode as HTMLElement))) anchor = anchor.parentNode as HTMLElement
  if (!anchor.parentNode) throw new Error('넣을 자리를 찾지 못했다')
  // 참고문헌·필자 한마디 같은 꼬리 묶음 안에는 넣지 않는다
  const holder = anchor.parentNode as HTMLElement
  if (tag(holder) === 'section' && /(^|\s)refs(\s|$)/.test(holder.getAttribute('class') ?? '')) throw new Error('참고문헌 안에는 문단을 넣을 수 없다')
  const end = anchor.range[1]
  const html = postHtml.slice(0, end) + `\n<p>${content}</p>` + postHtml.slice(end)
  const now = blocks(parse(html, { comment: true }).querySelector('article') as HTMLElement)
  const added = now.findIndex((b, i) => i >= all.length || text(b.textContent) !== text(all[i].textContent))
  const ok = now.length === all.length + 1 && added >= 0 && text(now[added].textContent) === text(parse(content).textContent) &&
    now.every((b, i) => i === added || text(b.textContent) === text(all[i < added ? i : i - 1].textContent))
  if (!ok) throw new Error('저장 뒤 확인에 실패해 저장하지 않았다 — 저에게 알려 주세요')
  return { html, index: added }
}
