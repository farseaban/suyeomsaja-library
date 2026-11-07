import { describe, it, expect } from 'vitest'
import { splitTitle } from '../src/lib/title'

describe('splitTitle', () => {
  it('cuts a title at the dash into the question and the concept', () => {
    expect(splitTitle('가 — 나')).toEqual({ q: '가', c: '나' })
  })
  it('leaves a title without the dash whole', () => {
    expect(splitTitle('가나다')).toEqual({ q: '가나다', c: null })
    // 줄표 양옆에 빈칸이 없으면 가르는 자리가 아니다
    expect(splitTitle('가—나')).toEqual({ q: '가—나', c: null })
    expect(splitTitle('가 - 나')).toEqual({ q: '가 - 나', c: null })
  })
  it('cuts at the first dash only', () => {
    expect(splitTitle('가 — 나 — 다')).toEqual({ q: '가', c: '나 — 다' })
  })
  it('puts the same characters back when the two parts are joined with the dash', () => {
    for (const t of ['장부의 손실을 읽는 법 — 평가손과 현금', '가 — 나 — 다', '줄표 없는 제목']) {
      const { q, c } = splitTitle(t)
      expect(c === null ? q : `${q} — ${c}`).toBe(t)
    }
  })
})
