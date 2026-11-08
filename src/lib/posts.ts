import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { CATEGORIES, categoryByName, type Category, type PaletteKey } from '../config/site'
import { parseMeta, type PostMeta } from './meta'
import { extractPost, type ExtractedPost } from './extract'
import { scopeCss } from './scope-css'
import { findUnsafe } from './post-safety'
import { checkImages } from './images'

export type Post = PostMeta & ExtractedPost & { slug: string; categorySlug: string; color: PaletteKey; scopedCss: string; cardPath: string | null; images: string[] }

export function loadPosts(dir = process.env.POSTS_DIR ?? 'posts'): Post[] {
  if (!existsSync(dir)) return []
  const posts = readdirSync(dir)
    .filter((slug) => !slug.startsWith('.') && statSync(join(dir, slug)).isDirectory())
    .map((slug): Post => {
      const htmlPath = join(dir, slug, 'post.html')
      const metaPath = join(dir, slug, 'meta.json')
      if (!existsSync(htmlPath)) throw new Error(`글 "${slug}": post.html이 없다`)
      if (!existsSync(metaPath)) throw new Error(`글 "${slug}": meta.json이 없다`)
      let raw: unknown
      try {
        raw = JSON.parse(readFileSync(metaPath, 'utf8'))
      } catch (e) {
        throw new Error(`글 "${slug}": meta.json을 읽을 수 없다 (${(e as Error).message})`)
      }
      const meta = parseMeta(raw, slug)
      let parts: ExtractedPost
      try {
        parts = extractPost(readFileSync(htmlPath, 'utf8'))
      } catch (e) {
        throw new Error(`글 "${slug}": ${(e as Error).message}`)
      }
      const unsafe = findUnsafe(parts.articleHtml, parts.css)
      if (unsafe.length) throw new Error(`글 "${slug}": 안전하지 않은 내용 — ${unsafe.join(', ')}`)
      const images = checkImages(join(dir, slug), parts.articleHtml)
      if (images.problems.length) throw new Error(`글 "${slug}": 그림 — ${images.problems.join(', ')}`)
      const cat = categoryByName(meta.category) as Category
      // 공유 카드는 npm run cards로 미리 그려 둔 것 — 없으면 사이트 카드를 쓴다
      const card = join(dir, slug, 'card.png')
      // 날짜는 meta.json 한 곳에서 정한다 — 글 머리 메타 줄의 날짜는 meta.json 날짜로 바꿔 보인다
      const metaLine = parts.metaLine?.replace(/^\d{4}-\d{2}-\d{2}/, meta.date) ?? null
      return { ...meta, ...parts, metaLine, slug, categorySlug: cat.slug, color: cat.color, scopedCss: scopeCss(parts.css), cardPath: existsSync(card) ? card : null, images: images.paths }
    })
  return posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
}

export function pickFeatured(posts: Post[]): Post | undefined {
  return posts.find((p) => p.featured) ?? posts[0]
}

export function activeCategories(posts: Post[]): Category[] {
  const used = new Set(posts.map((p) => p.category))
  return CATEGORIES.filter((c) => used.has(c.name))
}

export function seriesNames(posts: Post[]): string[] {
  return [...new Set(posts.map((p) => p.kicker).filter((k): k is string => k !== null))]
}

// prev = 바로 이전(더 오래된) 글, next = 바로 다음(더 새) 글
export function neighbors(posts: Post[], slug: string): { prev?: Post; next?: Post } {
  const i = posts.findIndex((p) => p.slug === slug)
  if (i < 0) return {}
  return { prev: posts[i + 1], next: posts[i - 1] }
}

// 코너 안에서의 순번 — 먼저 쓴 글이 1번이다.
export function seriesPosition(posts: Post[], slug: string): { name: string; index: number; total: number } | null {
  const post = posts.find((p) => p.slug === slug)
  if (!post?.kicker) return null
  const inSeries = posts.filter((p) => p.kicker === post.kicker).reverse()
  return { name: post.kicker, index: inSeries.findIndex((p) => p.slug === slug) + 1, total: inSeries.length }
}

// 글 끝 꼬리표 줄의 코너 글자 — 한 편뿐인 코너는 이름만, 두 편 이상이면 순번을 붙인다.
export function seriesLabel(pos: { name: string; index: number; total: number }): string {
  return pos.total > 1 ? `${pos.name} ${pos.index}/${pos.total}` : pos.name
}

// 읽기 시간 표기 — 띠와 1면 머리기사에 쓴다. 시간이 없는 글은 아무것도 그리지 않는다.
export function minutesLabel(minutes: number | null): string | null {
  return minutes ? `약 ${minutes}분` : null
}
