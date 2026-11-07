import { describe, it, expect } from 'vitest'
import { blocksIndexing } from '../src/config/indexing'

// 시험 공개 중에는 검색에 나오지 않아야 한다. 값을 빠뜨리거나 잘못 적어도 차단 쪽으로 기운다.
describe('search engine indexing', () => {
  it.each([undefined, '', 'false', '0', '1', 'TRUE', 'yes'])('stays blocked when the variable is %s', (value) => {
    expect(blocksIndexing(value)).toBe(true)
  })
  it('opens only on the exact word true', () => {
    expect(blocksIndexing('true')).toBe(false)
  })
})
