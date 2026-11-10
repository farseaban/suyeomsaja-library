import { parse } from 'node-html-parser'
import type { Post } from './posts'

// '함께 읽을 글'(사용자 11/10) — 글 끝에서 다음으로 읽을 글 몇 편을 고른다.
// meta.json의 related로 직접 고른 글을 먼저 세우고, 남는 자리는 본문이 가장 비슷한 글로 채운다.
// 비슷함은 제목·소개·본문의 글자 2-gram TF-IDF 코사인이다(한국어는 낱말 경계보다 글자 묶음이 잘 맞는다). 같은 분야면 조금 더 쳐 준다.

const SAME_CATEGORY_BONUS = 0.04

function textOf(post: Post): string {
  const root = parse(post.articleHtml)
  // 참고문헌·도해·각주 번호는 주제와 무관한 글자가 많아 뺀다
  root.querySelectorAll('section.refs, svg, sup, style, script, figure').forEach((el) => el.remove())
  // 제목은 두 번 넣어 무게를 조금 더 준다
  return `${post.title} ${post.title} ${post.description} ${root.textContent}`
}

function grams(text: string): Map<string, number> {
  const s = text.replace(/[^0-9a-z가-힣]+/gi, ' ').toLowerCase()
  const out = new Map<string, number>()
  for (const word of s.split(' ')) {
    if (word.length < 2) continue
    for (let i = 0; i + 1 < word.length; i++) {
      const g = word.slice(i, i + 2)
      out.set(g, (out.get(g) ?? 0) + 1)
    }
  }
  return out
}

type Vec = Map<string, number>
const cache = new WeakMap<Post[], Map<string, Vec>>()

function vectors(all: Post[]): Map<string, Vec> {
  const hit = cache.get(all)
  if (hit) return hit
  const tf = new Map(all.map((p) => [p.slug, grams(textOf(p))]))
  const df = new Map<string, number>()
  for (const g of tf.values()) for (const k of g.keys()) df.set(k, (df.get(k) ?? 0) + 1)
  const n = all.length
  const out = new Map<string, Vec>()
  for (const [slug, g] of tf) {
    const v: Vec = new Map()
    let norm = 0
    for (const [k, c] of g) {
      const w = (1 + Math.log(c)) * Math.log((n + 1) / ((df.get(k) ?? 0) + 1))
      if (w <= 0) continue
      v.set(k, w)
      norm += w * w
    }
    norm = Math.sqrt(norm) || 1
    for (const [k, w] of v) v.set(k, w / norm)
    out.set(slug, v)
  }
  cache.set(all, out)
  return out
}

function cosine(a: Vec, b: Vec): number {
  const [small, big] = a.size < b.size ? [a, b] : [b, a]
  let s = 0
  for (const [k, w] of small) s += w * (big.get(k) ?? 0)
  return s
}

export function relatedScores(all: Post[], post: Post): { post: Post; score: number }[] {
  const vs = vectors(all)
  const me = vs.get(post.slug)!
  return all
    .filter((p) => p.slug !== post.slug)
    .map((p) => ({ post: p, score: cosine(me, vs.get(p.slug)!) + (p.category === post.category ? SAME_CATEGORY_BONUS : 0) }))
    .sort((a, b) => b.score - a.score || b.post.date.localeCompare(a.post.date))
}

export function relatedPosts(all: Post[], post: Post, n = 3): Post[] {
  const picked: Post[] = []
  for (const slug of post.related ?? []) {
    const p = all.find((x) => x.slug === slug)
    if (p && p.slug !== post.slug && !picked.includes(p)) picked.push(p)
  }
  for (const { post: p } of relatedScores(all, post)) {
    if (picked.length >= n) break
    if (!picked.includes(p)) picked.push(p)
  }
  return picked.slice(0, n)
}
