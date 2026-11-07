import { describe, it, expect } from 'vitest'
import {
  toPolar, toScreen, skipConstellation, spinRates, moonFit,
  bandView, bandWaves, bandPhase, bandR, FOG, fogProfile, boxDistance, pressFactor, textPress, dragAngle, coast, touchDrags,
} from '../src/lib/sky'

describe('sky geometry', () => {
  // 천구 북극은 화면 위 밖에 있다(1440px → R = 1152)
  const pole = { cx: 720, cy: -1152 }
  it('round-trips screen ↔ polar around the pole', () => {
    for (const [x, y] of [[1152, 150], [346, 127], [0, 0], [1440, 400], [720, 10], [-30, 260]]) {
      const { r, a } = toPolar(x, y, pole)
      const [bx, by] = toScreen(r, a, pole)
      expect(bx).toBeCloseTo(x, 6)
      expect(by).toBeCloseTo(y, 6)
    }
  })
  it('measures radius from the pole and angle from the x axis', () => {
    const { r, a } = toPolar(720, 0, pole)
    expect(r).toBeCloseTo(1152, 6)
    expect(a).toBeCloseTo(Math.PI / 2, 6)
  })
  it('turns a point about the pole by the layer angle', () => {
    const { r, a } = toPolar(720, 100, pole)
    const [x, y] = toScreen(r, a, pole, Math.PI / 2)
    expect(x).toBeCloseTo(720 - 1252, 6)
    expect(y).toBeCloseTo(-1152, 6)
  })
})

describe('constellation lines', () => {
  const w = 1440, top = 112
  it('draws a figure that sits clear of the masthead and both edges', () => {
    expect(skipConstellation([[200, 150], [260, 180], [300, 140]], w, top)).toBe(false)
    expect(skipConstellation([[24, 112], [1416, 200]], w, top)).toBe(false)
  })
  it('skips a figure with any point above the masthead line', () => {
    expect(skipConstellation([[200, 150], [260, 111.9], [300, 140]], w, top)).toBe(true)
  })
  it('skips a figure with any point within 24px of the left or right edge', () => {
    expect(skipConstellation([[23.9, 150], [260, 180]], w, top)).toBe(true)
    expect(skipConstellation([[200, 150], [1416.1, 180]], w, top)).toBe(true)
    expect(skipConstellation([[-40, 150], [260, 180]], w, top)).toBe(true)
  })
  it('follows the measured masthead line, not a fixed one', () => {
    expect(skipConstellation([[200, 105]], 390, 100 + 12)).toBe(true)
    expect(skipConstellation([[200, 105]], 390, 80 + 12)).toBe(false)
  })
})

describe('sky spin', () => {
  it('turns faster on the front page than elsewhere, and both barely', () => {
    expect(spinRates(true)).toEqual({ far: 0.0015, near: 0.003 })
    expect(spinRates(false)).toEqual({ far: 0.0006, near: 0.0012 })
  })
})

describe('moon', () => {
  it('shows fully when its halo fits above the canvas floor', () => {
    expect(moonFit(150, 17, 273)).toBe(1) // 안쪽 페이지 1440px — 달무리 바닥 235
    expect(moonFit(127, 13, 192)).toBe(1) // 달무리 바닥이 딱 닿는 높이
  })
  it('hides when the canvas is too short to hold it — an empty hero', () => {
    expect(moonFit(150, 17, 153)).toBe(0)
    expect(moonFit(127, 13, 137)).toBe(0)
  })
  it('fades in between, never jumping', () => {
    let prev = 0
    for (let h = 180; h <= 240; h += 5) {
      const v = moonFit(150, 17, h)
      expect(v).toBeGreaterThanOrEqual(prev)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
      prev = v
    }
    expect(prev).toBe(1)
  })
})

// ── 7단계: 은하수 · 하늘 끌기 ──
// 하늘 높이(캔버스 높이)는 dist-jump 실측(1면 · 글 · 모든 글 · 소개)의 안팎 값이다
const SKIES: [number, number[]][] = [
  [360, [227, 322, 650]],
  [390, [227, 380, 650]],
  [820, [274, 391, 624]],
  [1440, [274, 344, 614]],
  [1920, [274, 391, 614]],
]
const poleR = (w: number) => Math.max(700, 0.8 * w)

describe('milky way band', () => {
  it('keeps the centre line between R and R + h at every angle', () => {
    for (const [w, hs] of SKIES) for (const h of hs) {
      const R = poleR(w), n = bandWaves(w, R, h), a0 = bandPhase(w, R, h)
      for (let i = 0; i < 720; i++) {
        const r = bandR((i / 720) * Math.PI * 2, R, h, n, a0)
        expect(r).toBeGreaterThan(R)
        expect(r).toBeLessThan(R + h)
      }
    }
  })
  it('uses n = max(2, ceil(π/θw)) — ceil, not round', () => {
    for (const [w, hs] of SKIES) for (const h of hs) {
      const R = poleR(w), tw = bandView(w, R, h)
      expect(tw).toBeCloseTo(2 * Math.atan((w / 2) / (R + h / 2)), 12)
      expect(bandWaves(w, R, h)).toBe(Math.max(2, Math.ceil(Math.PI / tw)))
      expect(Math.PI / bandWaves(w, R, h)).toBeLessThanOrEqual(tw)
    }
    // 1440px: π/θw ≈ 3.1~3.4 → round면 3, ceil이면 4
    expect(bandWaves(1440, 1152, 344)).toBe(4)
  })
  it('crosses the middle of the sky inside the view at any spin angle', () => {
    for (const [w, hs] of SKIES) for (const h of hs) {
      const R = poleR(w), n = bandWaves(w, R, h), a0 = bandPhase(w, R, h), tw = bandView(w, R, h)
      const mid = R + h / 2
      for (let k = 0; k < 64; k++) {
        const a = (k / 64) * Math.PI * 2
        let lo = Infinity, hi = -Infinity
        for (let j = 0; j <= 400; j++) {
          const d = bandR(a + (tw * j) / 400, R, h, n, a0) - mid
          lo = Math.min(lo, d); hi = Math.max(hi, d)
        }
        // 부호가 바뀐다 — 가운데를 한 번 이상 지난다
        expect(lo, `w ${w} h ${h} a ${k}/64`).toBeLessThan(0)
        expect(hi, `w ${w} h ${h} a ${k}/64`).toBeGreaterThan(0)
      }
    }
  })
  it('starts through the sky middle at 62% across, rising to the upper right', () => {
    for (const [w, hs] of SKIES) for (const h of hs) {
      const R = poleR(w), n = bandWaves(w, R, h), a0 = bandPhase(w, R, h)
      const pole = { cx: w / 2, cy: -R }
      const [x, y] = toScreen(bandR(a0, R, h, n, a0), a0, pole)
      expect(x).toBeCloseTo(0.62 * w, 6)
      expect(Math.hypot(x - pole.cx, y - pole.cy)).toBeCloseTo(R + h / 2, 6)
      // 오른쪽(각도가 작아지는 쪽)으로 가면 위로(화면 y가 작게) 오른다
      const da = 0.02 / n
      const [xr, yr] = toScreen(bandR(a0 - da, R, h, n, a0), a0 - da, pole)
      const [xl, yl] = toScreen(bandR(a0 + da, R, h, n, a0), a0 + da, pole)
      expect(xr).toBeGreaterThan(x); expect(yr).toBeLessThan(y)
      expect(xl).toBeLessThan(x); expect(yl).toBeGreaterThan(y)
    }
  })
  it('keeps the fog thin — overlapping puffs never add up past 0.12', () => {
    for (const sigma of [46, 70]) {
      const step = FOG.spacing * sigma, rad = FOG.radius * sigma
      let peak = 0
      for (let x = 0; x <= step; x += step / 50) {
        let clear = 1 // 알파 합성: 1 − Π(1 − aᵢ)
        for (let i = -10; i <= 10; i++) clear *= 1 - FOG.opMax * fogProfile(Math.abs(x - i * step), rad)
        peak = Math.max(peak, 1 - clear)
      }
      expect(peak).toBeLessThanOrEqual(0.12)
      expect(peak).toBeGreaterThan(0.05) // 보이기는 한다
    }
    expect(fogProfile(0, 100)).toBeCloseTo(0.5, 12)
    expect(fogProfile(100, 100)).toBe(0)
    expect(fogProfile(150, 100)).toBe(0)
  })
})

describe('text press — the band dims behind the hero words', () => {
  const box = { l: 100, t: 100, r: 300, b: 160 }
  it('measures distance to the box, zero inside', () => {
    expect(boxDistance(200, 130, box)).toBe(0)
    expect(boxDistance(100, 100, box)).toBe(0)
    expect(boxDistance(340, 130, box)).toBe(40)
    expect(boxDistance(200, 60, box)).toBe(40)
    expect(boxDistance(330, 200, box)).toBe(50)
  })
  it('is 0.3 for fog and 0.4 for faint stars inside a box, 1 from 48px out, monotone between', () => {
    expect(textPress(200, 130, [box], 0.3)).toBe(0.3)
    expect(textPress(200, 130, [box], 0.4)).toBe(0.4)
    expect(textPress(348, 130, [box], 0.3)).toBe(1)
    expect(textPress(500, 130, [box], 0.4)).toBe(1)
    expect(textPress(500, 500, [], 0.3)).toBe(1)
    for (const floor of [0.3, 0.4]) {
      let prev = floor
      for (let d = 0; d <= 60; d += 0.5) {
        const v = textPress(300 + d, 130, [box], floor)
        expect(v).toBeGreaterThanOrEqual(prev)
        expect(v).toBeLessThanOrEqual(1)
        prev = v
      }
      expect(prev).toBe(1)
    }
  })
  it('takes the nearest box when there are several', () => {
    const b2 = { l: 400, t: 100, r: 500, b: 160 }
    expect(textPress(450, 130, [box, b2], 0.3)).toBe(0.3)
    expect(textPress(350, 130, [box, b2], 0.3)).toBe(pressFactor(50, 0.3))
    expect(pressFactor(0, 0.3)).toBe(0.3)
    expect(pressFactor(48, 0.3)).toBe(1)
    expect(pressFactor(24, 0.3)).toBeGreaterThan(0.3)
    expect(pressFactor(24, 0.3)).toBeLessThan(1)
  })
})

describe('dragging the sky (front page only)', () => {
  it('turns by −dx / (R + h/2)', () => {
    expect(dragAngle(120, 1152, 614)).toBeCloseTo(-120 / (1152 + 307), 12)
    expect(dragAngle(-60, 700, 650)).toBeCloseTo(60 / (700 + 325), 12)
    expect(dragAngle(0, 700, 300)).toBe(0)
  })
  it('coasts to under 1% within 2 seconds, frame by frame or at once', () => {
    expect(coast(1, 2)).toBeLessThan(0.01)
    let v = 1
    for (let t = 0; t < 2; t += 1 / 60) v = coast(v, 1 / 60)
    expect(v).toBeLessThan(0.01)
    expect(coast(1, 0.5)).toBeGreaterThan(0.2) // 바로 서지는 않는다 — 관성이 보인다
    expect(coast(-2, 1)).toBeCloseTo(-2 * Math.exp(-3), 12)
  })
  it('starts a touch drag only when the move is sideways and past 8px', () => {
    expect(touchDrags(9, 2)).toBe(true)
    expect(touchDrags(-9, 2)).toBe(true)
    expect(touchDrags(8, 0)).toBe(false)
    expect(touchDrags(12, 12)).toBe(false)
    expect(touchDrags(5, 30)).toBe(false)
  })
})
