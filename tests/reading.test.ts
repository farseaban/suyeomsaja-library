import { it, expect } from 'vitest'
import { readingProgress, currentSection, passedFirst, readbarOn } from '../src/lib/reading'

it('measures progress through the article', () => {
  expect(readingProgress(200, 2000, 800)).toBe(0)
  expect(readingProgress(-2000, 2000, 800)).toBe(1)
  expect(readingProgress(-500, 2000, 800)).toBeGreaterThan(0)
})
it('picks the last heading above the threshold', () => {
  expect(currentSection([500, 900])).toBe(0)
  expect(currentSection([-300, 100, 600])).toBe(1)
})
// 읽기 띠에 무엇을 적을지: 첫 절이 기준선을 지나기 전에는 글 제목, 지난 뒤에는 지금 절.
// currentSection은 아무 절도 안 지났을 때 0을 돌려주므로 이 판정에 쓸 수 없다
it('tells whether the first heading has passed the threshold', () => {
  expect(passedFirst([500, 900])).toBe(false)
  expect(passedFirst([-300, 100, 600])).toBe(true)
  expect(passedFirst([])).toBe(false)
  expect(passedFirst([140])).toBe(false)
  expect(passedFirst([139])).toBe(true)
  expect(passedFirst([300], 400)).toBe(true)
})
// 읽기 띠는 밤 구역이 화면 위로 다 지나가면 내려오고, 꼬리말 위 끝이 화면 높이의 60% 위로 올라오면 걷힌다
it('lowers the reading bar past the night zone and lifts it at the footer', () => {
  expect(readbarOn(120, 5000, 800), '밤 구역이 아직 보인다').toBe(false)
  expect(readbarOn(0, 5000, 800), '밤 구역 바닥이 화면 위 끝에 걸렸다').toBe(false)
  expect(readbarOn(-1, 5000, 800)).toBe(true)
  expect(readbarOn(-3000, 481, 800)).toBe(true)
  expect(readbarOn(-3000, 480, 800), '꼬리말이 화면 높이의 60%에 닿았다').toBe(false)
  expect(readbarOn(-3000, 100, 800)).toBe(false)
})
