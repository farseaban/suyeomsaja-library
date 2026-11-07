import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadPosts, pickFeatured, activeCategories, seriesNames, neighbors, minutesLabel } from '../src/lib/posts'
import { CATEGORIES, PALETTE } from '../src/config/site'

const posts = loadPosts('tests/fixtures/posts')

describe('loadPosts', () => {
  it('sorts by date, newest first', () => {
    expect(posts.map((p) => p.slug)).toEqual(['sample-econ', 'sample-philo', 'sample-nodesc'])
  })
  it('attaches category slug, color and scoped css', () => {
    const econ = posts[0]
    expect(econ.categorySlug).toBe('economy')
    expect(econ.color).toBe('sky')
    expect(econ.scopedCss).toMatch(/\.post-body h2/)
  })
  it('names the slug when post.html is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'posts-'))
    mkdirSync(join(dir, 'broken-one'))
    writeFileSync(join(dir, 'broken-one', 'meta.json'), '{"category":"경제","date":"2026-01-01"}')
    expect(() => loadPosts(dir)).toThrow(/broken-one/)
  })
  it('returns [] for a missing folder', () => expect(loadPosts('no/such/dir')).toEqual([]))
})

describe('field colours', () => {
  // 설계서 §4.4 — 순번이 아니라 분야마다 명시한다. 뜻이 가까운 분야끼리 한 색.
  const TABLE: [slug: string, name: string, color: string][] = [
    ['philosophy', '철학', 'lav'],
    ['history', '역사', 'butter'],
    ['literature', '문학', 'peach'],
    ['economy', '경제', 'sky'],
    ['education', '교육', 'butter'],
    ['nature', '생물·자연', 'mint'],
    ['psychology', '심리', 'lav'],
    ['tech', '기술·AI', 'sky'],
    ['art', '예술', 'rose'],
  ]
  it('assigns each of the nine fields its colour, in the same menu order', () => {
    expect(CATEGORIES.map((c) => [c.slug, c.name, c.color])).toEqual(TABLE)
  })
  it('uses palette colours only', () => {
    for (const c of CATEGORIES) expect(PALETTE as readonly string[], c.slug).toContain(c.color)
  })
})

describe('pickFeatured', () => {
  it('prefers a featured post', () => expect(pickFeatured(posts)?.slug).toBe('sample-nodesc'))
  it('falls back to the newest post', () => {
    expect(pickFeatured(posts.map((p) => ({ ...p, featured: false })))?.slug).toBe('sample-econ')
  })
  it('is undefined for no posts', () => expect(pickFeatured([])).toBeUndefined())
})

describe('lists', () => {
  it('shows only categories with posts, in config order', () => {
    expect(activeCategories(posts).map((c) => c.name)).toEqual(['철학', '경제', '생물·자연'])
  })
  it('collects series names', () => expect(seriesNames(posts)).toEqual(['숫자 읽기 · 사례로 읽기', '자연 읽기']))
  it('finds date neighbors', () => {
    const n = neighbors(posts, 'sample-philo')
    expect(n.prev?.slug).toBe('sample-nodesc')
    expect(n.next?.slug).toBe('sample-econ')
  })
})

import { seriesPosition, seriesLabel } from '../src/lib/posts'
describe('seriesPosition', () => {
  it('numbers posts in a corner oldest first', () => {
    expect(seriesPosition(posts, 'sample-econ')).toEqual({ name: '숫자 읽기 · 사례로 읽기', index: 1, total: 1 })
  })
  it('is null for a post without a corner', () => expect(seriesPosition(posts, 'sample-philo')).toBeNull())
})

describe('seriesLabel', () => {
  it('names a one-post corner without a count', () => {
    expect(seriesLabel({ name: '가', index: 1, total: 1 })).toBe('가')
  })
  it('adds the position once the corner has two posts or more', () => {
    expect(seriesLabel({ name: '가', index: 2, total: 3 })).toBe('가 2/3')
    expect(seriesLabel({ name: '숫자 읽기 · 사례로 읽기', index: 1, total: 2 })).toBe('숫자 읽기 · 사례로 읽기 1/2')
  })
})

describe('minutesLabel', () => {
  it('words the reading time, and says nothing when there is none', () => {
    expect(minutesLabel(7)).toBe('약 7분')
    expect(minutesLabel(12)).toBe('약 12분')
    expect(minutesLabel(null)).toBeNull()
    expect(minutesLabel(0)).toBeNull()
  })
})
