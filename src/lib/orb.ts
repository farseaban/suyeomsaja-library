import { CATEGORIES, type PaletteKey } from '../config/site'
import { ORB_WORDS } from '../config/orb-words'

export type Vec3 = { x: number; y: number; z: number }
export type OrbField = { slug: string; name: string; color: PaletteKey; words: string[] }
export type OrbPoint = Vec3 & { field: number; size: number; word: string | null }
export type OrbEdge = { a: number; b: number; kind: 'same' | 'cross' | 'chord' }
export type Orb = { centers: Vec3[]; points: OrbPoint[]; edges: OrbEdge[]; neighbors: number[][] }

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

export function orbFields(): OrbField[] {
  return CATEGORIES.map((c) => ({ slug: c.slug, name: c.name, color: c.color, words: ORB_WORDS[c.slug] ?? [] }))
}

function fibonacci(n: number, k: number): Vec3 {
  const y = 1 - ((k + 0.5) / n) * 2
  const r = Math.sqrt(1 - y * y)
  return { x: Math.cos(GOLDEN * k) * r, y, z: Math.sin(GOLDEN * k) * r }
}

function dist2(a: Vec3, b: Vec3): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2
}

function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 같은 색을 쓰는 분야끼리 멀어지게: 분야를 차례로 놓되, 이미 놓인 같은 색 분야와의
// 최소 거리가 가장 큰 빈 슬롯을 고른다(같은 색이 아직 없으면 가장 앞 슬롯).
export function placeCenters(colors: PaletteKey[]): Vec3[] {
  const n = colors.length
  const slots = Array.from({ length: n }, (_, k) => fibonacci(n, k))
  const free = new Set(slots.keys())
  const placed: number[] = []
  colors.forEach((color, i) => {
    const mates = placed.filter((_, j) => colors[j] === color)
    let best = -1
    let bestScore = -1
    for (const k of free) {
      const score = mates.length ? Math.min(...mates.map((m) => dist2(slots[k], slots[m]))) : 0
      if (score > bestScore) { best = k; bestScore = score }
    }
    free.delete(best)
    placed[i] = best
  })
  return placed.map((k) => slots[k])
}

export function buildOrb(fields: OrbField[], opts: { points?: number; seed?: number; chords?: number } = {}): Orb {
  const { points: n = 168, seed = 11, chords = 7 } = opts
  const rnd = mulberry32(seed)
  const centers = placeCenters(fields.map((f) => f.color))
  const points: OrbPoint[] = Array.from({ length: n }, (_, k) => {
    const p = fibonacci(n, k)
    let field = 0
    centers.forEach((c, f) => { if (dist2(p, c) < dist2(p, centers[field])) field = f })
    return { ...p, field, size: rnd() * 0.45, word: null }
  })
  fields.forEach((fd, f) => {
    const mine = points.map((p, i) => (p.field === f ? i : -1)).filter((i) => i >= 0)
    for (let i = mine.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[mine[i], mine[j]] = [mine[j], mine[i]]
    }
    fd.words.slice(0, mine.length).forEach((w, k) => {
      points[mine[k]].word = w
      points[mine[k]].size = 0.6 + rnd() * 0.4
    })
  })

  const edges: OrbEdge[] = []
  const neighbors: number[][] = points.map(() => [])
  const linked = new Set<string>()
  const link = (a: number, b: number, kind: OrbEdge['kind']) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    if (a === b || linked.has(key)) return false
    linked.add(key)
    edges.push({ a, b, kind })
    neighbors[a].push(b)
    neighbors[b].push(a)
    return true
  }
  points.forEach((p, i) => {
    points
      .map((q, j) => [j, j === i ? Infinity : dist2(p, q)] as const)
      .sort((x, y) => x[1] - y[1])
      .slice(0, 3)
      .forEach(([j]) => link(i, j, points[j].field === p.field ? 'same' : 'cross'))
  })
  for (let made = 0, tries = 0; made < chords && tries < 200; tries++) {
    const a = Math.floor(rnd() * n)
    const b = Math.floor(rnd() * n)
    if (points[a].field !== points[b].field && link(a, b, 'chord')) made++
  }
  return { centers, points, edges, neighbors }
}

export type Box = { x0: number; y0: number; x1: number; y1: number }

// 점이 덮인 상자 안에 있는가 — 상자가 없으면 어디도 덮이지 않았다.
export function inBox(p: { x: number; y: number }, box?: Box): boolean {
  return !!box && p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1
}

// 구체가 저절로 도는 빠르기(라디안/초) — 한 바퀴 약 75초. 프레임 수가 아니라 시간에 맞춘다.
// 구체 스크립트와 주인공 기울기(LeadScene)가 이 값을 함께 쓴다.
export const ORB_SPIN = 0.084

// 낱말 후보 — w는 잰 글자 폭(px), dx는 점에서 낱말 왼쪽 끝까지의 거리(기본 9px, 오른쪽 끝에서 뒤집히면 음수).
export type LabelCand = { i: number; x: number; y: number; z: number; w?: number; dx?: number }

// 낱말 상자: 글자 폭 × 14px에 사방 6px 여유. 글줄은 점과 같은 높이에 놓인다.
export function labelBox(c: LabelCand): Box {
  const left = c.x + (c.dx ?? 9)
  return { x0: left - 6, y0: c.y - 7 - 6, x1: left + (c.w ?? 0) + 6, y1: c.y + 7 + 6 }
}

function boxesMeet(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
}

// 낱말 상자가 덮인 자리(avoid)에 닿는가 — 그림은 캔버스 위에 그려지므로, 점이 상자 바로 위에 있으면 낱말 아래쪽이 그림 뒤로 들어간다.
// 글자 폭을 모르면 판단하지 않는다.
export function labelCovered(c: LabelCand, avoid?: Box): boolean {
  return !!avoid && c.w !== undefined && boxesMeet(labelBox(c), avoid)
}

// 앞쪽(z > .3)에서 가까운 것부터, 이미 고른 낱말과 겹치지 않게 최대 max개.
// avoid 상자(캔버스 픽셀) 안의 점은 고르지 않는다 — 1면에서 주인공 그림이 덮는 자리. 글자 폭 w를 알면 낱말 상자가 그 자리에 닿는 점도 고르지 않는다.
// nightY(밤 한계선, 캔버스 픽셀)를 주면 그보다 12px 넘게 위에 있는 점만 고른다 — 밝은 새벽 띠 위에는 낱말을 띄우지 않는다.
// 후보에 글자 폭 w가 있으면 거리 기준에 더해 낱말 상자끼리도 겹치지 않게 한다. w도 nightY도 없으면 예전과 같은 결과다.
export function chooseLabels(cands: LabelCand[], max = 3, minDist = 90, avoid?: Box, nightY?: number): number[] {
  const picked: LabelCand[] = []
  const free = cands.filter((c) => c.z > 0.3 && !inBox(c, avoid) && !labelCovered(c, avoid) && (nightY === undefined || c.y < nightY - 12))
  for (const c of free.sort((a, b) => b.z - a.z)) {
    if (picked.length >= max) break
    if (!picked.every((p) => Math.hypot(p.x - c.x, (p.y - c.y) * 2.2) > minDist)) continue
    if (c.w !== undefined && picked.some((p) => p.w !== undefined && boxesMeet(labelBox(p), labelBox(c)))) continue
    picked.push(c)
  }
  return picked.map((c) => c.i)
}

// 누르기가 끝났고 거의 움직이지 않았을 때만 탭이다. 취소(세로 스크롤 시작 등)는 탭이 아니다.
export function isTap(kind: 'up' | 'cancel', moved: number): boolean {
  return kind === 'up' && moved < 6
}
