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

// 서가 이름이 무엇을 얻는 글인지 말해 준다. '몸 읽기 · 통념 깨기' 같은 연재 표시는 그 위에 추상어를 다시 얹어
// 뺐다(11/07 사용자 결정). 기능은 진짜 연재를 시작할 때를 위해 남긴다 — 그때 이 시험을 고친다.
describe('published posts', () => {
  it('carry no series kicker', () => {
    expect(loadPosts().filter((p) => p.kicker !== null).map((p) => `${p.slug}: ${p.kicker}`)).toEqual([])
  })
})

describe('field colours', () => {
  // 분야는 학문 이름이 아니라 독자가 얻으러 오는 것으로 묶는다(11/07 사용자 결정). 색은 분야마다 명시한다.
  const TABLE: [slug: string, name: string, color: string][] = [
    ['fact-check', '진실 혹은 거짓', 'peach'],
    ['learning', '일과 학습의 기술', 'butter'],
    ['philosophy', '철학의 아름다움', 'lav'],
    ['classics', '다시 보는 고전과 예술', 'rose'],
    ['economy', '돈과 세상의 원리', 'sky'],
    ['tech', 'AI와 기술의 현재', 'sky'],
    ['nature', '인류와 생명의 수수께끼', 'mint'],
  ]
  it('assigns each of the seven shelves its colour, in the same menu order', () => {
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
    expect(activeCategories(posts).map((c) => c.name)).toEqual(['철학의 아름다움', '돈과 세상의 원리', '인류와 생명의 수수께끼'])
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
