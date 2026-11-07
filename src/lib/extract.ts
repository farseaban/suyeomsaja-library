import { parse } from 'node-html-parser'

export type ExtractedPost = {
  title: string
  description: string
  kicker: string | null
  minutes: number | null
  metaLine: string | null
  articleHtml: string
  css: string
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

function cutAt(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const sp = cut.lastIndexOf(' ')
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`
}

// 스킬이 만든 완성 HTML에서 사이트가 쓸 조각만 읽는다. 본문(articleHtml)은 한 글자도 고치지 않는다.
export function extractPost(html: string): ExtractedPost {
  const root = parse(html, { comment: false })
  const article = root.querySelector('article')
  const h1 = article?.querySelector('h1')
  if (!article || !h1) throw new Error('글 HTML에 <article> 안의 <h1>이 없다')

  const metaDesc = root.querySelector('meta[name="description"]')?.getAttribute('content')
  const firstP = article.querySelectorAll('p').find((p) => !p.classList.contains('lead-quote'))
  const description = metaDesc ? clean(metaDesc) : cutAt(clean(firstP?.textContent ?? ''), 120)

  const kicker = article.querySelector('.kicker')
  const meta = article.querySelector('.meta')
  const minutes = meta?.textContent.match(/약\s*(\d+)\s*분/)

  return {
    title: clean(h1.textContent),
    description,
    kicker: kicker ? clean(kicker.textContent) : null,
    minutes: minutes ? Number(minutes[1]) : null,
    // 글머리의 메타 줄(날짜 · 읽기 시간 · 글쓴이) — 공개 글 페이지가 밤 구역에 그대로 적는다
    metaLine: meta ? clean(meta.textContent) || null : null,
    articleHtml: article.innerHTML,
    css: root.querySelectorAll('head style').map((s) => s.textContent).join('\n'),
  }
}
