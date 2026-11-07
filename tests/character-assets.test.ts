import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { metaChunks } from './image-meta'
import { SITE } from '../src/config/site'

describe('character drawings', () => {
  it('ships exactly the approved drawings', () =>
    expect(readdirSync('src/assets/character').sort()).toEqual(['desk.png', 'face.png', 'full-lead.png', 'full-night.png', 'full.png']))
  it('strips text, time and exif chunks from the drawings', () => {
    for (const f of ['desk', 'face', 'full', 'full-lead', 'full-night'])
      expect(metaChunks(readFileSync(`src/assets/character/${f}.png`)), f).toEqual([])
  })
  it('keeps the night drawing the same size as the one it was cut from, so the overlay still fits', () => {
    const size = (f: string) => { const b = readFileSync(`src/assets/character/${f}.png`); return [b.readUInt32BE(16), b.readUInt32BE(20)] }
    expect(size('full-night')).toEqual([723, 928])
    expect(size('full-night')).toEqual(size('full-lead'))
  })
  it('keeps the bio (the user\'s own Notion vision line) and the illustrator credit in site config', () => {
    expect(SITE.bio).toBe('창의적인 개인이 넘쳐나는 세상을 꿈꿉니다.')
    expect(SITE.artCredit).toBe('richa 그림')
    expect(SITE.description).toContain('얼어붙은 바다를 깨뜨리는 도끼')
    expect(SITE.description).not.toContain('지식 창고')
    expect(SITE.description).toContain('아이디어를 연결하고 사고 실험을 즐깁니다.')
  })
})
