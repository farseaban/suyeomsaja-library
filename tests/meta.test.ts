import { describe, it, expect } from 'vitest'
import { parseMeta } from '../src/lib/meta'

describe('parseMeta', () => {
  it('accepts a valid meta', () => {
    expect(parseMeta({ category: '경제', date: '2026-11-01' }, 'a')).toEqual({ category: '경제', date: '2026-11-01', featured: false })
  })
  it('rejects an unknown category, naming slug and value', () => {
    expect(() => parseMeta({ category: '경재', date: '2026-11-01' }, 'a')).toThrow(/a.*category.*경재/)
  })
  it('rejects a non YYYY-MM-DD date', () => {
    expect(() => parseMeta({ category: '경제', date: '2026-11-1' }, 'a')).toThrow(/date/)
  })
  it('rejects an invalid slug', () => {
    expect(() => parseMeta({ category: '경제', date: '2026-11-01' }, 'Bad Slug')).toThrow(/slug/)
  })
})
