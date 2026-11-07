import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { extractPost } from '../src/lib/extract'

const read = (s: string) => readFileSync(`tests/fixtures/posts/${s}/post.html`, 'utf8')

describe('extractPost', () => {
  const econ = extractPost(read('sample-econ'))
  it('takes the h1 text as title', () => expect(econ.title).toBe('장부의 손실을 읽는 법 — 평가손과 현금'))
  it('takes the meta description', () => expect(econ.description).toMatch(/^장부에 적힌 손실/))
  it('reads kicker and minutes', () => {
    expect(econ.kicker).toBe('숫자 읽기 · 사례로 읽기')
    expect(econ.minutes).toBe(15)
  })
  it('keeps article inner html with footnote ids and svg untouched', () => {
    expect(econ.articleHtml).toContain('id="cite-1" href="#ref-1"')
    expect(econ.articleHtml).toContain('<svg')
    expect(econ.articleHtml).not.toContain('<article')
  })
  it('collects head styles', () => expect(econ.css).toContain('font-size:17px'))

  it('falls back to the first non-lead paragraph, cut near 120 chars', () => {
    const p = extractPost(read('sample-nodesc'))
    expect(p.description).toMatch(/^국화과 식물의 꽃 한 송이는/)
    expect(p.description.length).toBeLessThanOrEqual(121)
    expect(p.description.endsWith('…')).toBe(true)
  })
  it('reads the meta line as one clean string, and null when the post has none', () => {
    expect(econ.metaLine).toBe('2026-11-01 · 약 15분 분량 · 글 반창모')
    expect(extractPost(read('sample-philo')).metaLine).toBe('2026-10-20 · 약 9분 분량 · 글 반창모')
    expect(extractPost(read('sample-nodesc')).metaLine).toBeNull()
    expect(extractPost('<article><h1>t</h1><div class="meta">\n  2026-01-02 ·\n  약 3분 </div></article>').metaLine).toBe('2026-01-02 · 약 3분')
  })
  it('returns null kicker and minutes when absent', () => {
    const p = extractPost(read('sample-nodesc'))
    expect(p.minutes).toBeNull()
    expect(extractPost(read('sample-philo')).kicker).toBeNull()
  })
  it('throws without an h1', () => {
    expect(() => extractPost('<html><body><article><p>x</p></article></body></html>')).toThrow(/h1/)
  })
})
