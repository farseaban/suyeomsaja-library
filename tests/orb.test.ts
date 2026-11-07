import { describe, it, expect } from 'vitest'
import { buildOrb, chooseLabels, orbFields, placeCenters, type Vec3 } from '../src/lib/orb'
import { ORB_WORDS } from '../src/config/orb-words'
import { CATEGORIES, type PaletteKey } from '../src/config/site'

const chord = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const fields = orbFields()

describe('orb words', () => {
  it('keys every word list by a real category slug', () => {
    for (const k of Object.keys(ORB_WORDS)) expect(CATEGORIES.map((c) => c.slug)).toContain(k)
  })
  it('flags categories without words without failing', () => {
    const missing = CATEGORIES.filter((c) => !ORB_WORDS[c.slug]?.length).map((c) => c.name)
    if (missing.length) console.warn(`구체 낱말이 없는 분야: ${missing.join(', ')}`)
    expect(fields.find((f) => f.slug === 'economy')!.words).toContain('공정가치')
  })
})

describe('placeCenters', () => {
  it('keeps fields that share a color far apart (current 9 fields)', () => {
    const c = placeCenters(fields.map((f) => f.color))
    for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++)
      if (fields[i].color === fields[j].color) expect(chord(c[i], c[j])).toBeGreaterThan(1.0)
  })
  it('still spreads same-color fields with 12 fields over 6 colors', () => {
    const colors: PaletteKey[] = ['lav', 'mint', 'peach', 'sky', 'butter', 'rose', 'lav', 'mint', 'peach', 'sky', 'butter', 'rose']
    const c = placeCenters(colors)
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++)
      if (colors[i] === colors[j]) expect(chord(c[i], c[j])).toBeGreaterThan(1.0)
  })
})

describe('buildOrb', () => {
  const orb = buildOrb(fields)
  it('covers the sphere with 168 unit points', () => {
    expect(orb.points).toHaveLength(168)
    for (const p of orb.points) expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 9)
  })
  it('gives every field a region of at least 6 points', () => {
    fields.forEach((_, f) => expect(orb.points.filter((p) => p.field === f).length).toBeGreaterThanOrEqual(6))
  })
  it('places each field word exactly once, on that field', () => {
    fields.forEach((fd, f) => fd.words.forEach((w) => {
      const hits = orb.points.filter((p) => p.word === w)
      expect(hits).toHaveLength(1)
      expect(hits[0].field).toBe(f)
    }))
  })
  it('leaves a field with no words as color only', () => {
    const o = buildOrb(fields.map((f, i) => (i === 0 ? { ...f, words: [] } : f)))
    expect(o.points.filter((p) => p.field === 0 && p.word)).toHaveLength(0)
  })
  it('links each point to at least 3 others, no self or duplicate edges, kind by field', () => {
    const keys = orb.edges.map((e) => [Math.min(e.a, e.b), Math.max(e.a, e.b)].join('-'))
    expect(new Set(keys).size).toBe(keys.length)
    for (const e of orb.edges) {
      expect(e.a).not.toBe(e.b)
      if (e.kind === 'same') expect(orb.points[e.a].field).toBe(orb.points[e.b].field)
      else expect(orb.points[e.a].field).not.toBe(orb.points[e.b].field)
    }
    orb.neighbors.forEach((n) => expect(n.length).toBeGreaterThanOrEqual(3))
  })
  it('is the same every time', () => expect(buildOrb(fields)).toEqual(orb))
})

describe('chooseLabels', () => {
  const c = [
    { i: 0, x: 100, y: 100, z: 0.9 }, { i: 1, x: 120, y: 110, z: 0.8 },
    { i: 2, x: 300, y: 100, z: 0.7 }, { i: 3, x: 100, y: 300, z: 0.6 },
    { i: 4, x: 400, y: 400, z: 0.5 }, { i: 5, x: 50, y: 50, z: 0.2 },
  ]
  it('picks front-most first, keeps spacing, caps at 3, ignores the back', () => {
    expect(chooseLabels(c)).toEqual([0, 2, 3])
  })
  it('skips candidates inside the avoid box', () => {
    expect(chooseLabels(c, 3, 90, { x0: 80, y0: 80, x1: 140, y1: 140 })).toEqual([2, 3, 4])
  })
})

import { ORB_SPIN, labelBox } from '../src/lib/orb'
describe('chooseLabels on the night ground', () => {
  // 3열 × 5행, 가로 120px · 세로 40px 간격 — 앞쪽 순서는 i 순서와 같다
  const many = Array.from({ length: 15 }, (_, i) => ({ i, x: 60 + (i % 3) * 120, y: 40 + Math.floor(i / 3) * 40, z: 0.95 - i * 0.02 }))
  const hit = (a: ReturnType<typeof labelBox>, b: ReturnType<typeof labelBox>) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
  it('takes up to nine words when asked for nine at 56px', () => {
    expect(chooseLabels(many, 9, 56)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(chooseLabels(many, 7, 56)).toHaveLength(7)
    expect(chooseLabels(many)).toHaveLength(3) // 기본값은 그대로 3개 · 90px
  })
  it('shows no word at or below 12px above the night line', () => {
    // nightY = 132 → y < 120인 것만: 첫 두 행(y 40, 80)
    const got = chooseLabels(many, 9, 56, undefined, 132)
    expect(got).toEqual([0, 1, 2, 3, 4, 5])
    for (const i of got) expect(many[i].y).toBeLessThan(132 - 12)
    expect(chooseLabels(many, 9, 56, undefined, 52)).toEqual([]) // 한계선이 맨 윗줄보다 높으면 하나도 없다
    expect(chooseLabels(many, 9, 56, undefined, undefined)).toHaveLength(9) // 한계선이 없으면 조건도 없다
  })
  it('measures a word box as its width by 14px with 6px to spare on every side', () => {
    const b = labelBox({ i: 0, x: 100, y: 50, z: 1, w: 40 })
    expect(b.x1 - b.x0).toBe(40 + 12)
    expect(b.y1 - b.y0).toBe(14 + 12)
    expect(b.x0).toBeGreaterThanOrEqual(100) // 낱말은 점 오른쪽에 놓인다
    expect(b.y0).toBeLessThan(50)
    expect(b.y1).toBeGreaterThan(50)
    // 오른쪽 끝에서 뒤집힌 낱말(dx < 0)은 점 왼쪽에 놓인다
    expect(labelBox({ i: 0, x: 100, y: 50, z: 1, w: 40, dx: -49 }).x1).toBeLessThanOrEqual(100)
  })
  it('keeps word boxes apart once it knows how wide the words are', () => {
    // 거리 기준(56px)은 넘지만 긴 낱말끼리는 상자가 겹친다
    const wide = many.slice(0, 9).map((c) => ({ ...c, w: 130 }))
    expect(chooseLabels(many.slice(0, 9), 9, 56)).toHaveLength(9)
    const got = chooseLabels(wide, 9, 56)
    expect(got).toEqual([0, 2, 3, 5, 6, 8]) // 한 줄에 셋은 못 서고 둘만 선다
    for (const a of got) for (const b of got)
      if (a < b) expect(hit(labelBox(wide[a]), labelBox(wide[b])), `${a}·${b}`).toBe(false)
    // 좁은 낱말이면 아홉 개가 다 선다
    expect(chooseLabels(many.map((c) => ({ ...c, w: 24 })), 9, 56)).toHaveLength(9)
  })
  it('chooses exactly as before when no width is given', () => {
    const c = [
      { i: 0, x: 100, y: 100, z: 0.9 }, { i: 1, x: 120, y: 110, z: 0.8 },
      { i: 2, x: 300, y: 100, z: 0.7 }, { i: 3, x: 100, y: 300, z: 0.6 },
      { i: 4, x: 400, y: 400, z: 0.5 }, { i: 5, x: 50, y: 50, z: 0.2 },
    ]
    expect(chooseLabels(c)).toEqual([0, 2, 3])
    expect(chooseLabels(c, 3, 90, { x0: 80, y0: 80, x1: 140, y1: 140 })).toEqual([2, 3, 4])
    expect(chooseLabels(c, 9, 56)).toEqual([0, 2, 3, 4])
  })
})

import { labelCovered } from '../src/lib/orb'
describe('words beside the covered place', () => {
  // 그림이 덮는 자리: 왼쪽 아래. 그림은 캔버스 위에 그려지므로, 점이 상자 바로 위에 있으면 낱말 아래쪽이 그림 뒤로 들어간다
  const avoid = { x0: 0, y0: 200, x1: 200, y1: 420 }
  const c = [
    { i: 0, x: 60, y: 195, z: 0.9, w: 40 },  // 점은 상자 5px 위 — 낱말 상자(위아래 13px)가 그림 자리에 닿는다
    { i: 1, x: 60, y: 180, z: 0.8, w: 40 },  // 20px 위 — 닿지 않는다
    { i: 2, x: 230, y: 300, z: 0.7, w: 40 }, // 그림 오른쪽 — 낱말은 점 오른쪽에 놓인다
    { i: 3, x: 190, y: 100, z: 0.6, w: 40 },
  ]
  it('keeps the whole word off the covered place, not only its dot', () => {
    expect(chooseLabels(c, 9, 56, avoid)).toEqual([1, 2, 3])
    for (const i of chooseLabels(c, 9, 56, avoid)) {
      const b = labelBox(c[i])
      expect(b.x0 < avoid.x1 && avoid.x0 < b.x1 && b.y0 < avoid.y1 && avoid.y0 < b.y1, String(i)).toBe(false)
    }
  })
  it('looks at the dot alone when it does not know the width', () => {
    expect(chooseLabels(c.map(({ w: _w, ...rest }) => rest), 9, 56, avoid)).toEqual([0, 2, 3])
  })
  it('tells whether a word would run under the covered place', () => {
    expect(labelCovered(c[0], avoid)).toBe(true)
    expect(labelCovered(c[1], avoid)).toBe(false)
    expect(labelCovered(c[2], avoid)).toBe(false)
    // 오른쪽 끝에서 뒤집혀 점 왼쪽에 놓이는 낱말은 그림 쪽으로 뻗는다
    expect(labelCovered({ i: 9, x: 230, y: 300, z: 1, w: 40, dx: -49 }, avoid)).toBe(true)
    expect(labelCovered(c[0])).toBe(false) // 덮인 자리가 없으면 어디도 덮이지 않았다
    expect(labelCovered({ i: 0, x: 60, y: 195, z: 0.9 }, avoid)).toBe(false) // 폭을 모르면 판단하지 않는다
  })
})

describe('ORB_SPIN', () => {
  it('turns the sphere once in about 75 seconds, by the clock', () => {
    expect(ORB_SPIN).toBe(0.084)
    expect((Math.PI * 2) / ORB_SPIN).toBeCloseTo(74.8, 1)
  })
})

import { isTap } from '../src/lib/orb'
describe('isTap', () => {
  it('counts only a finished, nearly still press as a tap', () => {
    expect(isTap('up', 3)).toBe(true)
    expect(isTap('up', 12)).toBe(false)
    expect(isTap('cancel', 0)).toBe(false) // 세로 스크롤이 시작되면 브라우저가 포인터를 취소한다
  })
})

import { inBox } from '../src/lib/orb'
describe('inBox', () => {
  const box = { x0: 10, y0: 20, x1: 50, y1: 60 }
  it('tells points under the covered box from free ones, and treats no box as free', () => {
    expect(inBox({ x: 30, y: 40 }, box)).toBe(true)
    expect(inBox({ x: 5, y: 40 }, box)).toBe(false)
    expect(inBox({ x: 30, y: 70 }, box)).toBe(false)
    expect(inBox({ x: 30, y: 40 }, undefined)).toBe(false)
  })
})
