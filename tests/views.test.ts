import { describe, it, expect } from 'vitest'
import { mergeDays, summarize, type ViewsStore } from '../src/lib/views'

describe('views store (11/10 — 조회수는 이 맥에만)', () => {
  const store: ViewsStore = {
    days: {
      '2026-09-01': { '/posts/a/': { views: 5, visits: 4 } },
      '2026-11-04': { '/posts/a/': { views: 2, visits: 2 } },
      '2026-11-10': { '/posts/a/': { views: 1, visits: 1 }, '/': { views: 3, visits: 3 } },
    },
  }
  it('sums today, the last 7 and 30 days, and everything kept', () => {
    expect(summarize(store, '2026-11-10')['/posts/a/']).toEqual({ today: 1, d7: 3, d30: 3, total: 8 })
    expect(summarize(store, '2026-11-10')['/']).toEqual({ today: 3, d7: 3, d30: 3, total: 3 })
  })
  it('replaces fetched days wholesale but keeps older days Cloudflare no longer returns', () => {
    const next = mergeDays(store, { '2026-11-10': { '/posts/a/': { views: 4, visits: 2 } } })
    expect(next.days['2026-11-10']).toEqual({ '/posts/a/': { views: 4, visits: 2 } })
    expect(next.days['2026-09-01']).toEqual(store.days['2026-09-01'])
  })
})

// 공개 빌드가 조회수를 실을 길이 없어야 한다 — 편집 화면 밖에서는 views를 읽지 않는다
describe('views never reach the public site', () => {
  it('only the edit page, the edit server and the CLI import the views module', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
    const users = walk('src').filter((f) => /lib\/views/.test(readFileSync(f, 'utf8')))
    expect(users.sort()).toEqual(['src/integrations/edit.ts', 'src/pages/edit/[slug].astro'])
  })
})
