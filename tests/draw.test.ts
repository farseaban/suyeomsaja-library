import { it, expect } from 'vitest'
import { drawMode, drawDelay } from '../src/lib/draw'

it('draws only solid visible strokes', () => {
  expect(drawMode({ stroke: '#C06A45', strokeWidth: '1.5', dasharray: 'none' })).toBe('draw')
  expect(drawMode({ stroke: 'rgb(192, 106, 69)', strokeWidth: '1.5px', dasharray: null })).toBe('draw')
  expect(drawMode({ stroke: 'none', strokeWidth: '1.5', dasharray: null })).toBe('fade')
  expect(drawMode({ stroke: null, strokeWidth: null, dasharray: null })).toBe('fade')
  expect(drawMode({ stroke: '#000', strokeWidth: '0', dasharray: null })).toBe('fade')
  expect(drawMode({ stroke: '#000', strokeWidth: '1', dasharray: '4 3' })).toBe('fade')
})
it('staggers by order and caps the wait', () => {
  expect(drawDelay(0)).toBe(0)
  expect(drawDelay(5)).toBe(300)
  expect(drawDelay(100)).toBe(1500)
})

import { shouldPlay } from '../src/lib/draw'
it('plays once a third of the diagram or a third of the screen is showing', () => {
  expect(shouldPlay(0.4, 120, 800)).toBe(true)
  expect(shouldPlay(0.1, 100, 800)).toBe(false)
  // 화면보다 훨씬 긴 도해는 비율이 0.35에 닿지 않아도 화면을 충분히 채우면 재생한다
  expect(shouldPlay(0.2, 600, 800)).toBe(true)
})
