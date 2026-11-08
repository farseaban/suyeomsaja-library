import type { APIContext } from 'astro'
import { url } from '../lib/url'

// 막는 곳 없이 사이트맵만 알린다. 검색 차단은 쪽마다 붙는 noindex가 맡는다 —
// 여기서 막으면 검색엔진이 그 noindex를 읽지 못해 오히려 주소만 검색에 남을 수 있다.
export function GET(context: APIContext) {
  const sitemap = new URL(url('sitemap.xml'), context.site).toString()
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
