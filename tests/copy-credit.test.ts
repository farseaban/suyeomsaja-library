import { it, expect } from 'vitest'
import { copyCredit } from '../src/lib/copy-credit'

// 사용자 11/08 ㉡안: 복사는 막지 않는다. 긴 글(공백 뺀 100자 이상)을 복사하면 끝에 출처가 붙는다.
const title = '소크라테스는 왜 독배를 마셨을까?'
const url = 'https://suyeomsaja.com/posts/socrates-trial/'

it('leaves short copies alone', () => {
  expect(copyCredit('가'.repeat(99), title, url)).toBeNull()
  // 공백·줄바꿈은 글자 수에 넣지 않는다
  expect(copyCredit(('가 '.repeat(99)) + '\n\n', title, url)).toBeNull()
})

it('adds the source to long copies', () => {
  const text = '가'.repeat(100)
  expect(copyCredit(text, title, url)).toBe(`${text}\n\n출처: 수염사자의 서재 — ${title}\n${url}`)
})

it('trims trailing blank space before the source line', () => {
  const text = '나'.repeat(120)
  expect(copyCredit(`${text}\n\n  `, title, url)).toBe(`${text}\n\n출처: 수염사자의 서재 — ${title}\n${url}`)
})
