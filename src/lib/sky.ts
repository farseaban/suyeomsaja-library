// 밤하늘 계산 — 캔버스 없이 시험할 수 있는 순수 함수만 둔다. 그리기는 src/scripts/sky.ts.
// 모든 별·달은 화면 위쪽 바깥의 천구 북극(pole)을 중심으로 한 극좌표(r, a)로 기억된다.

export type Pole = { cx: number; cy: number }

// 화면 좌표 → 북극 기준 극좌표
export function toPolar(x: number, y: number, pole: Pole): { r: number; a: number } {
  return { r: Math.hypot(x - pole.cx, y - pole.cy), a: Math.atan2(y - pole.cy, x - pole.cx) }
}

// 극좌표 → 화면 좌표. ang은 그 레이어가 지금까지 돈 각도
export function toScreen(r: number, a: number, pole: Pole, ang = 0): [number, number] {
  return [pole.cx + r * Math.cos(a + ang), pole.cy + r * Math.sin(a + ang)]
}

// 별자리 선을 긋지 않을 것인가 — 꼭짓점 하나라도 머리띠 경계(top) 위이거나 좌우 edge px 가장자리에 걸치면 긋지 않는다
export function skipConstellation(points: readonly (readonly [number, number])[], w: number, top: number, edge = 24): boolean {
  return points.some(([x, y]) => y < top || x < edge || x > w - edge)
}

// 저절로 도는 빠르기(초당 라디안). 1면(하늘을 끌 수 있는 페이지)만 조금 더 돈다 — 그래도 '돌고 있나?' 싶은 정도다
export function spinRates(front: boolean): { far: number; near: number } {
  return front ? { far: 0.0015, near: 0.003 } : { far: 0.0006, near: 0.0012 }
}

// 달을 얼마나 보일 것인가(0~1). 달무리(반지름 = 달 반지름 × 5)가 캔버스 바닥에 잘리면 직선 자국이 남는다.
// 달무리가 다 들어가면 1, 캔버스가 달 반지름의 두 배만큼 더 낮아지는 동안 0까지 줄인다(히어로가 빈 페이지에서는 달이 없다).
export function moonFit(y: number, radius: number, h: number): number {
  return Math.max(0, Math.min(1, (h - (y + radius * 3)) / (radius * 2)))
}

// ── 은하수 띠 ──
// 띠의 중심선은 천구 북극 기준 극좌표 곡선 r(a) = R + h·(0.5 + 0.42·sin(n·(a − a0))). 먼 별 층에 붙어 함께 돈다.

// 화면이 보는 각도 θw — 하늘 높이 가운데(R + h/2)에서 화면 폭이 북극을 향해 벌리는 각
export function bandView(w: number, R: number, h: number): number {
  return 2 * Math.atan(w / 2 / (R + h / 2))
}
// 파의 수 n = max(2, ceil(π/θw)). round가 아니라 ceil이라 반주기 π/n ≤ θw — 하늘이 어느 각도로 돌아도
// 화면이 보는 각도 안에서 중심선이 하늘 높이의 가운데를 한 번 이상 지난다
export function bandWaves(w: number, R: number, h: number): number {
  return Math.max(2, Math.ceil(Math.PI / bandView(w, R, h)))
}
// a0: 처음에 띠가 화면 가로 62% 지점에서 하늘 높이의 가운데를 지나고, 왼쪽 아래에서 오른쪽 위로 오르게.
// 화면 오른쪽은 각도가 작아지는 쪽이므로 그 점에서 r이 각도와 함께 커지면(sin의 오르막) 오른쪽으로 갈수록 오른다
export function bandPhase(w: number, R: number, h: number): number {
  return Math.acos((0.12 * w) / (R + h / 2))
}
export function bandR(a: number, R: number, h: number, n: number, a0: number): number {
  return R + h * (0.5 + 0.42 * Math.sin(n * (a - a0)))
}

// 안개: 번짐 점 한 장(가운데 알파 .5 → 가장자리 0)을 중심선을 따라 σ·1.2 간격, 반지름 σ·2.2로 놓는다.
// 점 하나의 불투명도 0.05~0.10 — 겹친 곳의 합이 0.12를 넘지 않는다(시험이 본다)
export const FOG = { spacing: 1.2, radius: 2.2, opMin: 0.05, opMax: 0.1 } as const
export function fogProfile(d: number, radius: number): number {
  return d >= radius ? 0 : 0.5 * (1 - d / radius)
}

// ── 글자 자리 누르기 ── 히어로 글자 상자(넓힌 것) 안에서는 띠를 floor배로 눌러 준다(안개 .3 · 잔별 .4), 48px에 걸쳐 1로
export type Box = { l: number; t: number; r: number; b: number }
export function boxDistance(x: number, y: number, b: Box): number {
  const dx = Math.max(b.l - x, 0, x - b.r), dy = Math.max(b.t - y, 0, y - b.b)
  return Math.hypot(dx, dy)
}
export function pressFactor(d: number, floor: number, edge = 48): number {
  if (d <= 0) return floor
  if (d >= edge) return 1
  const k = d / edge, s = k * k * (3 - 2 * k) // 부드럽게(단조)
  return floor + (1 - floor) * s
}
export function textPress(x: number, y: number, boxes: readonly Box[], floor: number, edge = 48): number {
  let d = Infinity
  for (const b of boxes) d = Math.min(d, boxDistance(x, y, b))
  return pressFactor(d, floor, edge)
}

// ── 하늘 끌기(1면만) ──
// 가로로 dx px 끌면 하늘이 −dx/(R + h/2) 라디안 돈다 — 하늘 높이 가운데의 별이 손가락을 따라간다
export function dragAngle(dx: number, R: number, h: number): number {
  return dx === 0 ? 0 : -dx / (R + h / 2)
}
// 놓은 뒤의 관성: 속도 × exp(−3·dt). 2초면 1% 아래로 준다
export function coast(v: number, dt: number): number {
  return v * Math.exp(-3 * dt)
}
// 터치는 가로 이동이 세로보다 크고 8px를 넘었을 때만 하늘 끌기로 본다(그 전에는 세로 스크롤일 수 있다)
export function touchDrags(dx: number, dy: number): boolean {
  return Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)
}
