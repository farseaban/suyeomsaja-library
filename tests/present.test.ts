import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'node-html-parser'
import { presentPost } from '../src/lib/present'
import { extractPost } from '../src/lib/extract'
import { addHeadingIds } from '../src/lib/toc'
import { markBlocks } from '../src/lib/edit'

// 공개 글 페이지의 표현 변환 — 글머리를 본문에서 떼고, 도해·문장형 표에 휴대폰용 표시를 단다. 글 원문은 고치지 않는다.
const article = (slug: string) => extractPost(readFileSync(`tests/fixtures/posts/${slug}/post.html`, 'utf8')).articleHtml
const text = (s: string) => s.replace(/\s+/g, ' ').trim()

describe('presentPost — fixtures as they are', () => {
  const cases = [
    ['sample-econ', '코너·제목·메타가 다 있는 글'],
    ['sample-philo', '코너가 없는 글'],
    ['sample-nodesc', '메타가 없는 글'],
  ] as const
  it.each(cases)('%s (%s) — 글머리가 본문에서 빠지고 나머지 글자는 그대로다', (slug) => {
    const src = article(slug)
    const { body, titleHtml } = presentPost(src)
    const root = parse(body)
    expect(root.querySelector('h1')).toBeNull()
    expect(root.querySelector('.kicker')).toBeNull()
    expect(root.querySelector('.meta')).toBeNull()
    expect(titleHtml).toBeNull()
    // 빠진 것은 글머리뿐이다 — 남은 글자는 원문에서 글머리 글자를 뺀 것과 같다
    const before = parse(src)
    for (const sel of ['.kicker', 'h1', '.meta']) before.querySelector(sel)?.remove()
    expect(text(root.textContent)).toBe(text(before.textContent))
  })
  it.each(cases)('%s — h2 id와 목차가 addHeadingIds와 같다', (slug) => {
    const src = article(slug)
    const { body, toc } = presentPost(src)
    const ref = addHeadingIds(src)
    expect(toc).toEqual(ref.toc)
    expect(parse(body).querySelectorAll('h2').map((h) => h.getAttribute('id'))).toEqual(ref.toc.map((t) => t.id))
  })
  it('keeps an id a heading already has', () => {
    const { body, toc } = presentPost('<h1>t</h1><h2 id="mine">가</h2><h2>나</h2>')
    expect(toc).toEqual([{ id: 'mine', text: '가' }, { id: 's-2', text: '나' }])
    expect(body).toContain('<h2 id="mine">가</h2>')
  })
  it('leaves the 10×10 fixture diagram unwrapped', () => {
    const { body } = presentPost(article('sample-econ'))
    expect(body).toContain('<svg')
    expect(body).not.toContain('s-fig-scroll')
  })
  it('keeps footnote anchors and the references as they were', () => {
    const { body } = presentPost(article('sample-econ'))
    expect(body).toContain('id="cite-1" href="#ref-1"')
    expect(body).toContain('<li id="ref-1">')
  })
})

describe('presentPost — post head', () => {
  it('takes out only what is there, and only from the front of the article', () => {
    const { body } = presentPost('<h1>제목</h1><p>본문</p><div class="meta">뒤쪽 메타</div>')
    expect(body).not.toContain('<h1>')
    expect(body).toContain('<p>본문</p>')
    // 앞머리가 아닌 자리의 것은 본문의 일부다
    expect(body).toContain('뒤쪽 메타')
  })
  it('hands back the inside of an h1 that carries markup, and null for a plain one', () => {
    expect(presentPost('<h1>가 <em>나</em> 다</h1><p>x</p>').titleHtml).toBe('가 <em>나</em> 다')
    expect(presentPost('<h1>가 — 나</h1><p>x</p>').titleHtml).toBeNull()
  })
})

describe('presentPost — diagrams', () => {
  const fig = (w: number) => `<h1>t</h1><figure><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 300" role="img"><title>도해</title><rect width="10" height="5"/></svg><figcaption>설명</figcaption></figure>`
  it('wraps a diagram 600 or wider, right under figure, in a scroller', () => {
    for (const w of [680, 600]) {
      const root = parse(presentPost(fig(w)).body)
      const wrap = root.querySelector('figure > .s-fig-scroll')
      expect(wrap, String(w)).not.toBeNull()
      expect(wrap!.querySelector('svg')!.getAttribute('viewBox')).toBe(`0 0 ${w} 300`)
      // 설명은 감싸개 밖에 남는다
      expect(root.querySelector('figure > figcaption')!.textContent).toBe('설명')
      expect(root.querySelectorAll('svg')).toHaveLength(1)
    }
  })
  it('leaves a narrower diagram alone', () => {
    expect(presentPost(fig(599)).body).not.toContain('s-fig-scroll')
  })
  it('leaves a diagram that is not directly under figure alone', () => {
    const { body } = presentPost('<h1>t</h1><p><svg viewBox="0 0 680 300"><rect/></svg></p><figure><div><svg viewBox="0 0 680 300"><rect/></svg></div></figure>')
    expect(body).not.toContain('s-fig-scroll')
  })
  it('adds nothing but the wrapper — the diagram inside reads as it does without it', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 360" width="100%" role="img" aria-labelledby="t-1 d-1" font-family="\'Pretendard\',sans-serif"><title id="t-1">가</title><linearGradient id="g"><stop offset="0"/></linearGradient><text x="1" fill="#7466C2">글자</text></svg>'
    // 파서가 한 번 읽고 다시 쓴 꼴(addHeadingIds가 이미 그렇게 낸다)과 같다 — 속성·대소문자·순서가 그대로다
    const asParsed = parse(svg).toString()
    expect(asParsed).toContain('viewBox="0 0 680 360"')
    expect(asParsed).toContain('<linearGradient id="g">')
    expect(presentPost(`<h1>t</h1><figure>${svg}</figure>`).body).toBe(`<figure><div class="s-fig-scroll">${asParsed}</div></figure>`)
  })
})

describe('presentPost — prose tables', () => {
  const long = '이 문장은 서른 글자를 넉넉히 넘기도록 길게 쓴 표 칸의 문장입니다. 휴대폰에서는 카드로 쌓입니다.'
  const table = (head: string, rows: string) => `<h1>t</h1><table>${head}<tbody>${rows}</tbody></table>`
  const HEAD = '<thead><tr><th>말</th><th>알려진 출처</th><th>실제</th></tr></thead>'
  it('marks a table of sentences and copies each column head onto its cells', () => {
    const root = parse(presentPost(table(HEAD, `<tr><td>${long}</td><td>${long}</td><td>${long}</td></tr><tr class="hl"><td>${long}</td><td>${long}</td><td>${long}</td></tr>`)).body)
    const t = root.querySelector('table')!
    expect(t.hasAttribute('data-prose')).toBe(true)
    for (const tr of t.querySelectorAll('tbody tr')) expect(tr.querySelectorAll('td').map((td) => td.getAttribute('data-label'))).toEqual(['말', '알려진 출처', '실제'])
    expect(t.querySelector('tr.hl')).not.toBeNull()
    // 머리 칸은 건드리지 않는다
    expect(t.querySelectorAll('th').every((th) => !th.hasAttribute('data-label'))).toBe(true)
  })
  it('leaves a table of short cells alone', () => {
    const { body } = presentPost(table(HEAD, '<tr><td>짧다</td><td>12%</td><td>3조 원</td></tr>'))
    expect(body).not.toContain('data-prose')
    expect(body).not.toContain('data-label')
  })
  it('counts the average, not the longest cell — exactly 30 is still short', () => {
    const thirty = '가'.repeat(30)
    expect(presentPost(table(HEAD, `<tr><td>${thirty}</td><td>${thirty}</td><td>${thirty}</td></tr>`)).body).not.toContain('data-prose')
    expect(presentPost(table(HEAD, `<tr><td>${thirty}가</td><td>${thirty}가</td><td>${thirty}가</td></tr>`)).body).toContain('data-prose')
  })
  it('leaves a table without thead alone', () => {
    expect(presentPost(table('', `<tr><th>말</th><th>출처</th></tr><tr><td>${long}</td><td>${long}</td></tr>`)).body).not.toContain('data-prose')
  })
  it('leaves a table with merged cells alone', () => {
    expect(presentPost(table(HEAD, `<tr><td colspan="2">${long}</td><td>${long}</td></tr>`)).body).not.toContain('data-prose')
    expect(presentPost(table(HEAD, `<tr><td rowspan="2">${long}</td><td>${long}</td><td>${long}</td></tr>`)).body).not.toContain('data-prose')
    expect(presentPost(table('<thead><tr><th colspan="2">말</th><th>실제</th></tr></thead>', `<tr><td>${long}</td><td>${long}</td><td>${long}</td></tr>`)).body).not.toContain('data-prose')
  })
  it('escapes quotes and angle brackets in the copied label', () => {
    const head = '<thead><tr><th>"인용" &lt;말&gt; &amp; 뜻</th><th>둘째 <b>굵게</b></th></tr></thead>'
    const { body } = presentPost(table(head, `<tr><td>${long}</td><td>${long}</td></tr>`))
    expect(body).toContain('data-label="&quot;인용&quot; &lt;말&gt; &amp; 뜻"')
    expect(body).not.toMatch(/data-label="[^"]*[<>]/)
    const tds = parse(body).querySelectorAll('td')
    expect(tds[0].getAttribute('data-label')).toBe('"인용" <말> & 뜻')
    // 머리 칸의 꾸밈은 빼고 글자만
    expect(tds[1].getAttribute('data-label')).toBe('둘째 굵게')
  })
})

// 감싸개·data-label·글머리 떼기가 편집 덩어리의 순서를 흩트리지 않는다 — 편집 화면은 이 변환을 쓰지 않지만,
// 공개 화면과 편집 화면이 같은 글을 같은 순서로 보여 준다는 것을 여기서 못박아 둔다
describe('presentPost — block order', () => {
  const dirs = ['posts', 'tests/fixtures/posts']
  const files = dirs.flatMap((d) => readdirSync(d).filter((s) => !s.startsWith('.')).map((s) => join(d, s, 'post.html')))
  const blockTexts = (html: string) => parse(markBlocks(html)).querySelectorAll('[data-edit]').map((el) => `${el.rawTagName}:${text(el.textContent)}`)
  it('covers the three fixtures and every real post', () => expect(files.length).toBeGreaterThanOrEqual(18))
  it.each(files)('%s — markBlocks(presentPost(x).body) = markBlocks(x)에서 h1을 뺀 것', (f) => {
    const src = extractPost(readFileSync(f, 'utf8')).articleHtml
    const want = blockTexts(src).filter((b) => !b.startsWith('h1:'))
    expect(want.length).toBeGreaterThan(0)
    expect(blockTexts(presentPost(src).body)).toEqual(want)
  })
  it('real posts do carry 680-wide diagrams and one table of sentences', () => {
    const real = files.filter((f) => f.startsWith('posts/')).map((f) => [f, presentPost(extractPost(readFileSync(f, 'utf8')).articleHtml).body] as const)
    expect(real.filter(([, b]) => b.includes('s-fig-scroll')).length).toBe(real.length)
    expect(real.filter(([, b]) => b.includes('data-prose')).map(([f]) => f)).toEqual(['posts/misattributed-quotes/post.html'])
  })
})
