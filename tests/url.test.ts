import { describe, it, expect } from 'vitest'
import { joinBase } from '../src/lib/url'
import { CATEGORIES } from '../src/config/site'

describe('joinBase', () => {
  it('prefixes a sub-path base and ensures trailing slash', () => {
    expect(joinBase('/suyeomsaja-library/', 'posts/a')).toBe('/suyeomsaja-library/posts/a/')
  })
  it('keeps root as root', () => expect(joinBase('/', '/')).toBe('/'))
  it('leaves in-page anchors alone', () => expect(joinBase('/x/', '#ref-1')).toBe('#ref-1'))
  it('leaves absolute urls alone', () => expect(joinBase('/x/', 'https://a.b/c')).toBe('https://a.b/c'))
  it('does not add a slash after a file name', () => expect(joinBase('/x/', 'rss.xml')).toBe('/x/rss.xml'))
})

describe('CATEGORIES', () => {
  it('gives the nature shelf its own pastel pair', () => expect(CATEGORIES.find((c) => c.slug === 'nature')!.color).toBe('mint'))
  it('has unique names and slugs', () => {
    expect(new Set(CATEGORIES.map((c) => c.name)).size).toBe(CATEGORIES.length)
    expect(new Set(CATEGORIES.map((c) => c.slug)).size).toBe(CATEGORIES.length)
  })
})
