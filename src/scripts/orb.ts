// 1면 지식 구체 — 분야별 색 지역을 이룬 구가 돌고, 앞으로 온 점에 개념어가 뜬다. 실제 노트와는 무관한 장식이다.
// 밤 바탕 위에 뜬다: 점·선은 밝은 라벤더, 낱말은 흰색. 아래쪽은 새벽 띠(밝은 면)에 걸치므로
// 밤 한계선(nightY) 아래로 내려갈수록 점·선을 어두운 색으로 섞고, 낱말은 한계선 위에만 띄운다.
import { buildOrb, chooseLabels, inBox, isTap, labelCovered, ORB_SPIN, type Box, type LabelCand, type OrbField } from '../lib/orb'

const PERSPECTIVE = 3.2
const DRAG = 0.006
const TILT_LIMIT = 1.1
const HOVER_ZOOM = 1.06
const MAX_SPIN = 6          // 끌다 놓았을 때 관성의 상한(라디안/초)
const NIGHT_LINE = 262      // 글자 한계선: 밤 구역 바닥에서 262px × --glow (site.css의 .s-hero와 같은 값)
const DAWN_BLEND = 102      // 한계선 아래 이만큼(× --glow) 내려가면 점·선이 완전히 어두운 색이 된다
const STEPS = 12            // 색 섞기 단계
const LABEL_GAP = 9         // 점에서 낱말까지
const MIN_DIST = 56         // 낱말 사이 최소 거리(px)

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

// 토큰은 캔버스 자신에서 읽는다
function token(name: string, el: Element): string {
  return getComputedStyle(el).getPropertyValue(name).trim()
}
function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
// 밤 색 → 새벽 띠 위의 색으로 가는 STEPS + 1단의 "r,g,b" 표
function ramp(night: string, dawn: string): string[] {
  const a = rgb(night), b = rgb(dawn)
  return Array.from({ length: STEPS + 1 }, (_, k) => a.map((v, j) => Math.round(v + ((b[j] - v) * k) / STEPS)).join(','))
}
const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v))

function mount(cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d')
  if (!ctx) return
  const fields: OrbField[] = JSON.parse(cv.dataset.fields ?? '[]')
  const orb = buildOrb(fields)
  const P = orb.points
  // 점과 선은 한 빛깔, 분야 색은 누르거나 올린 점과 그 이웃에만. 밤 위에서는 파스텔(밝게), 새벽 띠 위에서는 -d(어둡게)
  const dots = ramp(token('--s-orb-dot', cv), token('--lav-d', cv))
  const tints = fields.map((f) => ramp(token(`--${f.color}`, cv), token(`--${f.color}-d`, cv)))
  const word = token('--s-orb-word', cv)
  const top = cv.closest('.s-top')
  const WORD = '500 12px "Pretendard Variable", Pretendard, "Noto Sans KR", sans-serif'
  const TAG = '600 10px "Pretendard Variable", Pretendard, "Noto Sans KR", sans-serif'
  // 글꼴 CSS가 글자 조각별로 나뉘어 있어, 그릴 낱말을 전부 알려 줘야 그 조각들을 받아 온다
  const glyphs = fields.map((f) => f.name + f.words.join('')).join('')
  // data-avoid="x0,y0,x1,y1"(캔버스 폭·높이 비율) — 낱말을 띄우지 않을 자리
  const avoid = (cv.dataset.avoid ?? '').split(',').map(Number)
  const avoidBox = (w: number, h: number): Box | undefined =>
    avoid.length === 4 && avoid.every(Number.isFinite)
      ? { x0: avoid[0] * w, y0: avoid[1] * h, x1: avoid[2] * w, y1: avoid[3] * h }
      : undefined

  let ay = 0.9, ax = -0.3, vy = 0, vx = 0
  let dragging = false, lx = 0, ly = 0, moved = 0, hover = -1
  let zoom = 1, zoomTarget = 1, dpr = 1, visible = true, running = false, prev = 0, lt = 0
  let nightY = Infinity, blend = 1 // 밤 한계선(캔버스 좌표)과 그 아래 색 섞기 구간
  let Q: { x: number; y: number; z: number; f: number }[] = []
  const fade = P.map(() => 0)
  const widths = new Map<number, number>() // 낱말 폭은 한 번 재서 기억한다(글꼴이 오면 다시 잰다)

  function rot(p: { x: number; y: number; z: number }) {
    const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax)
    const x = p.x * cy + p.z * sy
    let z = -p.x * sy + p.z * cy
    const y = p.y * cx - z * sx
    z = p.y * sx + z * cx
    return { x, y, z }
  }

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2)
    cv.width = Math.round(cv.clientWidth * dpr)
    cv.height = Math.round(cv.clientHeight * dpr)
    // 밤 한계선 = 밤 구역 아래 끝 − 262px × --glow. 밤 구역 밖에 놓인 구체에는 한계선이 없다
    if (top) {
      const glow = parseFloat(token('--glow', cv)) || 1
      nightY = top.getBoundingClientRect().bottom - NIGHT_LINE * glow - cv.getBoundingClientRect().top
      blend = DAWN_BLEND * glow
    }
    draw()
  }
  // 그 높이에서 쓸 색 단계: 한계선 위 0, 한계선 아래로 내려갈수록 STEPS까지
  const step = (y: number) => (y <= nightY ? 0 : Math.min(STEPS, Math.round(((y - nightY) / blend) * STEPS)))

  function textWidth(i: number): number {
    let tw = widths.get(i)
    if (tw === undefined) {
      ctx!.font = WORD
      tw = ctx!.measureText(P[i].word ?? fields[P[i].field].name).width
      widths.set(i, tw)
    }
    return tw
  }
  // 낱말은 점 오른쪽에, 캔버스 오른쪽 끝에 닿으면 왼쪽에 놓는다
  const labelDx = (i: number, w: number) => (Q[i].x + LABEL_GAP + textWidth(i) > w - 10 ? -LABEL_GAP - textWidth(i) : LABEL_GAP)

  function label(i: number, w: number, a: number) {
    const q = Q[i], p = P[i], text = p.word ?? fields[p.field].name
    const x = q.x + labelDx(i, w), y = q.y + 4
    ctx!.font = WORD
    ctx!.globalAlpha = a
    ctx!.fillStyle = word
    ctx!.fillText(text, x, y)
    if (i === hover) {
      const tag = fields[p.field].name
      ctx!.font = TAG
      ctx!.fillStyle = `rgb(${tints[p.field][0]})`
      ctx!.fillText(tag, x, y - 15)
    }
  }

  function draw(dt = 1 / 60) {
    ;(globalThis as { __orbYaw?: number }).__orbYaw = ay // 시험판: 하늘 레이어가 구체를 따라 돈다
    const w = cv.clientWidth, h = cv.clientHeight
    if (!w) return
    const R = Math.min(w, h) * 0.37 * zoom, ox = w / 2, oy = h / 2
    const c = ctx!
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    c.clearRect(0, 0, w, h)
    Q = P.map((p) => {
      const q = rot(p), f = PERSPECTIVE / (PERSPECTIVE - q.z)
      return { x: ox + q.x * R * f, y: oy + q.y * R * f, z: q.z, f }
    })
    const near = hover >= 0 ? orb.neighbors[hover] : []
    for (const e of orb.edges) {
      const a = Q[e.a], b = Q[e.b], d = ((a.z + b.z) / 2 + 1) / 2
      const lit = hover >= 0 && (e.a === hover || e.b === hover)
      const base = e.kind === 'same' ? 0.16 + d * 0.44 : e.kind === 'cross' ? 0.08 + d * 0.22 : 0.08 + d * 0.18
      c.strokeStyle = `rgba(${dots[step((a.y + b.y) / 2)]},${(lit ? 0.7 : base).toFixed(3)})`
      c.lineWidth = lit ? 1.4 : 0.9
      c.beginPath()
      c.moveTo(a.x, a.y)
      c.lineTo(b.x, b.y)
      c.stroke()
    }
    const order = Q.map((_, i) => i).sort((i, j) => Q[i].z - Q[j].z)
    for (const i of order) {
      const q = Q[i], p = P[i], d = (q.z + 1) / 2
      const rad = (1 + 1.9 * p.size) * q.f * (R / 150)
      const on = i === hover || near.includes(i)
      const tone = `rgb(${(on ? tints[p.field] : dots)[step(q.y)]})`
      c.globalAlpha = on ? 1 : 0.42 + 0.58 * d
      c.fillStyle = tone
      c.beginPath()
      c.arc(q.x, q.y, on ? rad * 1.4 : rad, 0, Math.PI * 2)
      c.fill()
      if (i === hover) {
        c.globalAlpha = 1
        c.strokeStyle = tone
        c.lineWidth = 1.4
        c.beginPath()
        c.arc(q.x, q.y, rad * 1.4 + 5, 0, Math.PI * 2)
        c.stroke()
      }
    }
    // 낱말 여러 개: 좁은 캔버스 7개, 그 밖 9개까지. 앞쪽부터, 그림이 덮는 자리와 새벽 띠를 피하고, 낱말 상자끼리 겹치지 않게
    let shown: number[]
    if (hover >= 0) shown = [hover]
    else {
      const cands: LabelCand[] = []
      P.forEach((p, i) => { if (p.word && Q[i].z > 0.3) cands.push({ i, x: Q[i].x, y: Q[i].y, z: Q[i].z, w: textWidth(i), dx: labelDx(i, w) }) })
      shown = chooseLabels(cands, w < 360 ? 7 : 9, MIN_DIST, avoidBox(w, h), nightY)
    }
    P.forEach((_, i) => {
      const target = shown.includes(i) ? 1 : 0
      fade[i] = reduce ? target : fade[i] + (target - fade[i]) * (1 - Math.exp(-(target ? 3.7 : 6.3) * dt))
      if (fade[i] > 0.02) label(i, w, fade[i] * (Q[i].z > 0 ? 1 : 0.4))
    })
    c.globalAlpha = 1
  }

  // 시간 기준으로 돈다(vy·vx는 라디안/초) — 화면 주사율이 달라도 같은 빠르기다
  function tick(now: number) {
    if (!running) return
    if (!visible || document.hidden) { running = false; return }
    const dt = prev ? Math.min(0.05, (now - prev) / 1000) : 1 / 60
    prev = now
    if (!dragging) {
      vy += (ORB_SPIN - vy) * (1 - Math.exp(-1.2 * dt))
      vx *= Math.exp(-3.7 * dt)
      ay += vy * dt
      ax = clamp(ax + vx * dt, TILT_LIMIT)
    }
    zoom += (zoomTarget - zoom) * (1 - Math.exp(-7.7 * dt))
    draw(dt)
    requestAnimationFrame(tick)
  }
  function start() {
    if (reduce || running || !visible || document.hidden) return
    running = true
    prev = 0
    requestAnimationFrame(tick)
  }
  // 동작 줄이기에서는 루프 없이, 바뀔 때마다 한 번씩 그린다
  function still() { if (reduce) { zoom = zoomTarget; draw() } }

  function pick(px: number, py: number) {
    let best = -1, bd = 18 * 18
    // 그림에 덮인 점, 낱말이 그림 뒤로 들어갈 점은 고르지 않는다 — 고르면 그 낱말이 그림 뒤에 그려지고 다른 낱말은 사라진다.
    // 새벽 띠에 걸친 점도 고르지 않는다 — 밝은 면 위에는 낱말을 띄우지 않는다.
    const w = cv.clientWidth
    const box = avoidBox(w, cv.clientHeight)
    Q.forEach((q, i) => {
      if (q.z < -0.1 || inBox(q, box) || q.y >= nightY - 12) return
      if (labelCovered({ i, x: q.x, y: q.y, z: q.z, w: textWidth(i), dx: labelDx(i, w) }, box)) return
      const d = (q.x - px) ** 2 + (q.y - py) ** 2
      if (d < bd) { bd = d; best = i }
    })
    return best
  }
  function local(e: PointerEvent): [number, number] {
    const b = cv.getBoundingClientRect()
    return [e.clientX - b.left, e.clientY - b.top]
  }

  cv.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { zoomTarget = HOVER_ZOOM; still() } })
  cv.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse' || dragging) return
    zoomTarget = 1
    hover = -1
    still()
  })
  cv.addEventListener('pointerdown', (e) => {
    dragging = true
    moved = 0
    lx = e.clientX
    ly = e.clientY
    lt = e.timeStamp
    vx = vy = 0
    cv.setPointerCapture(e.pointerId)
    cv.classList.add('s-orb-drag')
  })
  cv.addEventListener('pointermove', (e) => {
    if (dragging) {
      const dx = e.clientX - lx, dy = e.clientY - ly
      // 놓았을 때 이어질 관성은 마지막 움직임의 빠르기(라디안/초)다
      const dtE = Math.max(1 / 240, (e.timeStamp - lt) / 1000)
      lx = e.clientX
      ly = e.clientY
      lt = e.timeStamp
      moved += Math.abs(dx) + Math.abs(dy)
      if (moved > 6) hover = -1
      ay += dx * DRAG
      vy = clamp((dx * DRAG) / dtE, MAX_SPIN)
      if (e.pointerType === 'mouse') {
        ax = clamp(ax - dy * DRAG, TILT_LIMIT)
        vx = clamp((-dy * DRAG) / dtE, MAX_SPIN)
      }
      still()
    } else if (e.pointerType === 'mouse') {
      const [x, y] = local(e)
      const h = pick(x, y)
      if (h !== hover) { hover = h; still() }
    }
  })
  const end = (e: PointerEvent) => {
    if (!dragging) return
    dragging = false
    cv.classList.remove('s-orb-drag')
    if (isTap(e.type === 'pointerup' ? 'up' : 'cancel', moved)) {
      const [x, y] = local(e)
      const h = pick(x, y)
      hover = h === hover ? -1 : h
      draw()
    }
  }
  cv.addEventListener('pointerup', end)
  cv.addEventListener('pointercancel', end)

  // 캔버스 크기와 함께, 밤 구역 높이가 바뀌어도(글꼴 도착·줄 바뀜) 한계선을 다시 잰다
  const ro = new ResizeObserver(() => size())
  ro.observe(cv)
  if (top) ro.observe(top)
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; start() }).observe(cv)
  document.addEventListener('visibilitychange', start)
  document.fonts?.load(WORD, glyphs).then(() => { widths.clear(); draw() }, () => {})
  size()
  start()
}

document.querySelectorAll<HTMLCanvasElement>('canvas.s-orb-canvas').forEach(mount)
