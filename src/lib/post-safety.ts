// 글 HTML은 에이전트가 웹 자료를 읽고 쓴다. 자료에 섞인 코드가 글로 옮겨 오면 방문자 브라우저에서 돈다.
// 그래서 허용한 태그만 통과시킨다 — 이름을 모르는 태그는 막는다. 새 태그가 필요한 글이 생기면 여기에 넣는다.
const ALLOWED_TAGS = new Set([
  // 글
  'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'cite', 'code', 'col', 'colgroup', 'dd', 'del', 'div', 'dl', 'dt',
  'em', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'ins', 'kbd', 'li', 'mark', 'ol', 'p',
  'pre', 'q', 's', 'section', 'small', 'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
  'tr', 'u', 'ul',
  // 그림 — 글 폴더의 img/ 안에 내려받아 둔 파일만(아래 IMG 규칙). 바깥 주소를 부르면 방문자 정보가 새고, 원 사이트가 그림을 바꿀 수 있다
  'img',
  // 도해(SVG) — animate·set·use·image·foreignObject는 링크를 바꾸거나 바깥 파일을 부를 수 있어 넣지 않는다
  'circle', 'clippath', 'defs', 'desc', 'ellipse', 'g', 'line', 'lineargradient', 'marker', 'mask', 'path', 'pattern',
  'polygon', 'polyline', 'radialgradient', 'rect', 'stop', 'svg', 'text', 'textpath', 'title', 'tspan',
])
const BLOCKED_ATTRS = new Set(['srcdoc', 'formaction'])
const URL_ATTRS = new Set(['href', 'xlink:href', 'src', 'action', 'data', 'poster', 'background', 'ping', 'manifest'])
const ALLOWED_SCHEMES = new Set(['http', 'https', 'mailto'])
// 그림은 이 속성만 쓴다 — srcset·sizes는 바깥 주소를 부를 수 있어 받지 않는다
const IMG_ATTRS = new Set(['src', 'alt', 'width', 'height', 'loading', 'decoding', 'class'])
const IMG_SRC = /^img\/[a-z0-9][a-z0-9-]*\.(jpg|jpeg|png|webp)$/
const NAMED_ENTITIES: Record<string, string> = { colon: ':', tab: '\t', newline: '\n', lpar: '(', rpar: ')', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

type Attr = { name: string; value: string }
type Tag = { name: string; attrs: Attr[]; closed: boolean }

const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f'

// HTML 표준의 토큰화 규칙을 그대로 따른다. html 파서의 결과를 쓰지 않는 까닭은 node-html-parser가
// pre 안의 태그를 글자로 읽어서, 파서로 찾으면 브라우저가 실행할 태그를 놓치기 때문이다.
function readAttrs(html: string, start: number, attrs: Attr[]): { end: number; closed: boolean } {
  let i = start
  while (i < html.length) {
    while (i < html.length && (isSpace(html[i]) || html[i] === '/')) i++
    if (i >= html.length) break
    if (html[i] === '>') return { end: i + 1, closed: true }
    const nameStart = i
    i++ // 표준상 맨 앞의 = 도 이름의 일부다
    while (i < html.length && !isSpace(html[i]) && !'/>='.includes(html[i])) i++
    const name = html.slice(nameStart, i)
    while (i < html.length && isSpace(html[i])) i++
    let value = ''
    if (html[i] === '=') {
      i++
      while (i < html.length && isSpace(html[i])) i++
      const quote = html[i]
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, i + 1)
        if (close < 0) return { end: html.length, closed: false }
        value = html.slice(i + 1, close)
        i = close + 1
      } else {
        const valueStart = i
        while (i < html.length && !isSpace(html[i]) && html[i] !== '>') i++
        value = html.slice(valueStart, i)
      }
    }
    attrs.push({ name, value })
  }
  return { end: html.length, closed: false }
}

function readTags(html: string): { tags: Tag[]; bogus: string[] } {
  const tags: Tag[] = []
  const bogus: string[] = []
  let i = html.indexOf('<')
  while (i >= 0) {
    const next = html[i + 1] ?? ''
    const nameAt = next === '/' ? i + 2 : i + 1
    if (next === '!' || next === '?' || (next === '/' && !/[a-zA-Z]/.test(html[i + 2] ?? ''))) {
      bogus.push(html.slice(i, i + 12))
      i = html.indexOf('<', i + 2)
    } else if (/[a-zA-Z]/.test(html[nameAt] ?? '')) {
      let j = nameAt
      while (j < html.length && !isSpace(html[j]) && html[j] !== '/' && html[j] !== '>') j++
      const attrs: Attr[] = []
      const { end, closed } = readAttrs(html, j, attrs)
      tags.push({ name: html.slice(nameAt, j).toLowerCase(), attrs, closed })
      i = html.indexOf('<', end)
    } else {
      i = html.indexOf('<', i + 1) // a < b 같은 글자
    }
  }
  return { tags, bogus }
}

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);?/gi, (whole, body: string) => {
    const lower = body.toLowerCase()
    if (lower.startsWith('#x')) return String.fromCodePoint(parseInt(lower.slice(2), 16))
    if (lower.startsWith('#')) return String.fromCodePoint(parseInt(lower.slice(1), 10))
    return NAMED_ENTITIES[lower] ?? whole
  })
}

function badScheme(value: string): string | null {
  // 브라우저는 주소의 공백·제어 문자를 지우고 읽는다 — java\tscript: 도 실행된다
  // eslint-disable-next-line no-control-regex
  const url = decodeEntities(value).replace(/[\u0000- \u007f-\u009f]/g, '').toLowerCase()
  const scheme = url.match(/^([a-z][a-z0-9+.-]*):/)?.[1]
  return scheme && !ALLOWED_SCHEMES.has(scheme) ? scheme : null
}

function unsafeCss(css: string): string[] {
  const c = css.replace(/\/\*[\s\S]*?\*\//g, '').toLowerCase()
  const hits: string[] = []
  if (c.includes('<')) hits.push('CSS 안의 < (style 태그를 닫고 코드를 넣을 수 있다)')
  if (c.includes('\\')) hits.push('CSS 이스케이프(금지 낱말을 숨길 수 있다)')
  for (const word of ['@import', 'url(', 'expression(', 'javascript:', 'behavior:', '-moz-binding']) {
    if (c.includes(word)) hits.push(`CSS의 ${word}`)
  }
  return hits
}

function unsafeImg(tag: Tag): string[] {
  const hits: string[] = []
  const get = (n: string) => tag.attrs.find((a) => a.name.toLowerCase() === n)?.value
  for (const { name } of tag.attrs) {
    const attr = name.toLowerCase()
    if (!IMG_ATTRS.has(attr) && !attr.startsWith('on')) hits.push(`<img>의 ${attr} 속성(허용 목록 밖)`)
  }
  const src = decodeEntities(get('src') ?? '')
  if (!IMG_SRC.test(src)) hits.push(`<img> 주소 "${src.slice(0, 40)}" — 글 폴더의 img/ 안 jpg·png·webp만 쓴다`)
  if (!(get('alt') ?? '').trim()) hits.push('<img>에 대체 글(alt)이 없다')
  return hits
}

/** 글 본문과 머리 CSS에서 막아야 할 것을 찾아 이유 목록으로 돌려준다. 빈 목록이면 통과. */
export function findUnsafe(articleHtml: string, css: string): string[] {
  const { tags, bogus } = readTags(articleHtml)
  const hits = bogus.map((b) => `주석·선언 태그 ${b}`)
  for (const tag of tags) {
    if (!ALLOWED_TAGS.has(tag.name)) hits.push(`허용하지 않은 태그 <${tag.name}>`)
    if (!tag.closed) hits.push(`닫히지 않은 태그 <${tag.name}>`)
    if (tag.name === 'img') hits.push(...unsafeImg(tag))
    for (const { name, value } of tag.attrs) {
      const attr = name.toLowerCase()
      if (attr.startsWith('on') || BLOCKED_ATTRS.has(attr)) hits.push(`<${tag.name}>의 ${attr} 속성`)
      if (URL_ATTRS.has(attr)) {
        const scheme = badScheme(value)
        if (scheme) hits.push(`<${tag.name}>의 ${scheme}: 주소`)
      }
      if (attr === 'style') hits.push(...unsafeCss(decodeEntities(value)).map((h) => `<${tag.name}> style 속성: ${h}`))
    }
  }
  return [...hits, ...unsafeCss(css)]
}
