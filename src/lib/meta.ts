import { categoryByName } from '../config/site'

// related: '함께 읽을 글'로 먼저 세울 글의 slug(사용자가 직접 고를 때만, 나머지는 자동으로 채운다)
export type PostMeta = { category: string; date: string; featured?: boolean; related?: string[] }

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function parseMeta(raw: unknown, slug: string): PostMeta {
  const fail = (what: string) => {
    throw new Error(`글 "${slug}": ${what}`)
  }
  if (!SLUG_RE.test(slug)) fail(`slug는 영문 소문자·숫자·하이픈만 쓴다`)
  const m = (raw ?? {}) as Record<string, unknown>
  if (typeof m.category !== 'string' || !categoryByName(m.category))
    fail(`category "${String(m.category)}"가 분야 목록(src/config/site.ts)에 없다`)
  if (typeof m.date !== 'string' || !DATE_RE.test(m.date) || Number.isNaN(Date.parse(m.date)))
    fail(`date "${String(m.date)}"는 YYYY-MM-DD 형식이어야 한다`)
  if (m.featured !== undefined && typeof m.featured !== 'boolean') fail(`featured는 true/false다`)
  if (m.related !== undefined && (!Array.isArray(m.related) || !m.related.every((r) => typeof r === 'string' && SLUG_RE.test(r))))
    fail(`related는 글 slug의 목록이다(예: ["stoic-death"])`)
  return { category: m.category as string, date: m.date as string, featured: m.featured === true, ...(m.related ? { related: m.related as string[] } : {}) }
}
