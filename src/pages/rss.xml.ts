import rss from '@astrojs/rss'
import type { APIContext } from 'astro'
import { SITE } from '../config/site'
import { loadPosts } from '../lib/posts'
import { url } from '../lib/url'

export function GET(context: APIContext) {
  return rss({
    title: SITE.name,
    description: SITE.description,
    site: new URL(url('/'), context.site).toString(),
    items: loadPosts().map((p) => ({ title: p.title, link: url(`posts/${p.slug}`), pubDate: new Date(p.date), description: p.description })),
  })
}
