import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadPosts } from '../src/lib/posts'
import { cardStamp } from '../src/lib/card'
import { metaChunks } from './image-meta'

describe('share cards', () => {
  it.each(['posts', 'tests/fixtures/posts'])('%s — every post has a clean card drawn from its current title (else: npm run cards)', (dir) => {
    for (const p of loadPosts(dir)) {
      const png = join(dir, p.slug, 'card.png'), stamp = join(dir, p.slug, 'card.txt')
      expect(existsSync(png), `${p.slug}: card.png 없음`).toBe(true)
      expect(metaChunks(readFileSync(png)), p.slug).toEqual([])
      expect(readFileSync(stamp, 'utf8').trim(), `${p.slug}: 카드가 지금 제목과 다르다`).toBe(cardStamp(p))
    }
  })
})
