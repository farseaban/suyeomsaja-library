import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// 사용자 지시: 글과 사이트에 이모지·그림 문자를 쓰지 않는다('⭐ 핵심', '💬 필자 한마디' 같은 것).
const PICTO = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? files(p) : /\.(html|astro|ts|css|json|md)$/.test(n) ? [p] : []
  })
}

describe('no emoji', () => {
  it.each(['posts', 'src', 'tests/fixtures/posts'])('%s has no emoji or pictographs', (dir) => {
    const bad = files(dir).filter((f) => PICTO.test(readFileSync(f, 'utf8')))
    expect(bad).toEqual([])
  })
})
