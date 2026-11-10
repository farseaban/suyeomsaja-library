import { describe, it, expect } from 'vitest'
import { loadPosts } from '../src/lib/posts'
import { relatedPosts } from '../src/lib/related'
import { parseMeta } from '../src/lib/meta'

describe('함께 읽을 글 (11/10)', () => {
  const all = loadPosts()
  it('gives every post three other, distinct posts', () => {
    for (const p of all) {
      const r = relatedPosts(all, p, 3)
      expect(r, p.slug).toHaveLength(3)
      expect(new Set(r.map((x) => x.slug)).size, p.slug).toBe(3)
      expect(r.map((x) => x.slug), p.slug).not.toContain(p.slug)
    }
  })
  it('puts hand-picked posts first, skipping unknown or self slugs', () => {
    const p = { ...all[0], related: ['no-such-post', all[0].slug, all[5].slug] }
    const r = relatedPosts(all, p, 3)
    expect(r[0].slug).toBe(all[5].slug)
    expect(r).toHaveLength(3)
  })
  it('pairs the two game essays with each other', () => {
    const a = all.find((p) => p.slug === 'last-of-us-tragedy')!
    expect(relatedPosts(all, a, 1)[0].slug).toBe('death-stranding-absence')
  })
  it('accepts related only as a list of slugs', () => {
    expect(parseMeta({ category: '진실 혹은 거짓', date: '2026-11-10', related: ['stoic-death'] }, 'x').related).toEqual(['stoic-death'])
    expect(() => parseMeta({ category: '진실 혹은 거짓', date: '2026-11-10', related: 'stoic-death' }, 'x')).toThrow(/related/)
  })
})
