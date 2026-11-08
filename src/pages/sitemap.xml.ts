import type { APIContext } from 'astro'
import { activeCategories, loadPosts } from '../lib/posts'
import { url } from '../lib/url'

// 검색엔진에 내는 글 목록(사용자 11/08: Search Console·네이버 서치어드바이저).
// 검색·편집·404 쪽은 넣지 않는다. 검색 차단(noindex)이 걸려 있는 동안에는 목록만 있고 색인되지 않는다.
export function GET(context: APIContext) {
  const abs = (path: string) => new URL(url(path), context.site).toString()
  const posts = loadPosts()
  const latest = posts.map((p) => p.date).sort().at(-1)
  const entries: [string, string | undefined][] = [
    [abs('/'), latest],
    [abs('all'), latest],
    [abs('about'), undefined],
    ...activeCategories(posts).map((c): [string, string | undefined] => [abs(`category/${c.slug}`), posts.filter((p) => p.category === c.name).map((p) => p.date).sort().at(-1)]),
    ...posts.map((p): [string, string | undefined] => [abs(`posts/${p.slug}`), p.date]),
  ]
  const body = entries.map(([loc, mod]) => `<url><loc>${loc}</loc>${mod ? `<lastmod>${mod}</lastmod>` : ''}</url>`).join('')
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
