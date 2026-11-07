// 밤하늘 천체 레이어. 모든 별·천체가 화면 위쪽 바깥의 천구 북극을 중심으로 돈다.
// 레이어마다 도는 빠르기가 달라(먼 별 < 가까운 별) 겹이 진다. 계산은 src/lib/sky.ts.
// 먼 별 층에는 은하수(잔별이 빽빽한 비스듬한 띠 + 옅은 라벤더빛 안개)가 붙어 함께 돈다. 히어로 글자 뒤에서는 띠를 눌러 준다.
// 1면(.s-sky[data-drag])에서만 히어로를 가로로 끌면 하늘이 따라 돌고, 놓으면 관성으로 서서히 멈춘다.
// 1면에서는 지식 구체를 끈 만큼(globalThis.__orbYaw에서 구체가 저절로 도는 몫을 뺀 것) 하늘도 레이어별 비율로 따라 돈다.
import {
  bandPhase, bandR, bandWaves, coast, dragAngle, FOG, moonFit, skipConstellation, spinRates,
  textPress, toPolar, toScreen, touchDrags, type Box, type Pole,
} from '../lib/sky'
import { ORB_SPIN } from '../lib/orb'

// x, y: 북극 기준 직교 좌표(극좌표 r·a를 미리 풀어 둔 것) — 프레임마다 층의 cos·sin 한 번씩으로 돌린다
type Star = { r: number; a: number; x: number; y: number; s: number; p: number; tw: number }
type Dust = { a: number; x: number; y: number; s: number; o: number }
type Layer = { k: number; auto: number; px: number; ang: number; stars: Star[] }

const cv = document.querySelector<HTMLCanvasElement>('.s-sky-stars')
if (cv) {
  const ctx = cv.getContext('2d')!
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches
  const TAU = Math.PI * 2
  const rand = (a: number, b: number) => a + Math.random() * (b - a)
  const gauss = () => { // 표준정규(Box–Muller), ±3에서 자른다
    const g = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(TAU * Math.random())
    return Math.max(-3, Math.min(3, g))
  }
  // 반짝임은 별마다 sin을 부르지 않고 표를 읽는다(곱셈과 표 읽기만)
  const SINS = 1024, SIN = new Float32Array(SINS)
  for (let i = 0; i < SINS; i++) SIN[i] = Math.sin((i / SINS) * TAU)
  const sinT = (x: number) => SIN[((x * (SINS / TAU)) | 0) & (SINS - 1)]
  // 1면인지는 .s-sky의 data-drag로만 안다(body 클래스를 보지 않는다)
  const sky = cv.closest<HTMLElement>('.s-sky')
  const front = sky?.hasAttribute('data-drag') ?? false
  const spin = spinRates(front)
  // k: 구체가 1라디안 돌 때 이 레이어가 도는 양 · auto: 초당 저절로 도는 양 · px: 마우스 시차(px)
  const far: Layer = { k: 0.04, auto: spin.far, px: 3, ang: 0, stars: [] }
  const near: Layer = { k: 0.09, auto: spin.near, px: 9, ang: 0, stars: [] }
  // 달은 끌면 밀려났다가 천천히 제자리로 돌아온다 — 몇 분 지나 화면 밖으로 사라지지 않게
  const moon = { k: 0.05, auto: 0, px: 2, ang: 0, r: 0, a: 0 }
  // 은하수 — 먼 별 층에 붙는다. dust: 잔별, fog: 안개 번짐 점(o = 점 하나의 불투명도)
  let dust: Dust[] = [], fog: { a: number; x: number; y: number; o: number }[] = [], fogR = 0
  let constel: number[][] = []
  // 달 자리는 CSS(.s-sky-moon)가 정하고 여기서는 읽기만 한다. 별자리 선은 머리띠 아래 끝 + 12px(mastLine) 위로는 긋지 않는다
  const moonEl = cv.parentElement?.querySelector<HTMLElement>('.s-sky-moon')
  const mast = document.querySelector<HTMLElement>('.masthead')
  const hero = cv.closest('.s-top')?.querySelector<HTMLElement>('.s-hero') ?? null
  const wide = matchMedia('(min-width:761px)')
  let w = 0, h = 0, R = 0, sownH = 0, mastLine = 0, moonR = 17, lastT = 0
  const pole: Pole = { cx: 0, cy: 0 }
  let mx = 0, my = 0, tmx = 0, tmy = 0, lastYaw: number | null = null, last = 0, running = false, visible = true
  let shoot: { x: number; y: number; t: number } | null = null, nextShoot = 8000

  const moonImg = document.createElement('canvas'); moonImg.width = moonImg.height = 96
  { const m = moonImg.getContext('2d')!
    m.scale(2, 2)
    m.fillStyle = '#F8E8B0'; m.beginPath(); m.arc(24, 24, 22, 0, TAU); m.fill()
    m.globalCompositeOperation = 'destination-out'; m.beginPath(); m.arc(34, 18, 20, 0, TAU); m.fill() }

  // 안개 번짐 점 한 장 — 256px에 --lav 색 원형 그러데이션(가운데 알파 .5 → 가장자리 0, lib/sky의 fogProfile과 같은 꼴)
  const puff = document.createElement('canvas'); puff.width = puff.height = 256
  { const p = puff.getContext('2d')!
    const hex = getComputedStyle(document.documentElement).getPropertyValue('--lav').trim()
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
    const rgb = m ? m.slice(1).map((v) => parseInt(v, 16)).join(',') : '217,211,247'
    const g = p.createRadialGradient(128, 128, 0, 128, 128, 128)
    g.addColorStop(0, `rgba(${rgb},.5)`); g.addColorStop(1, `rgba(${rgb},0)`)
    p.fillStyle = g; p.fillRect(0, 0, 256, 256) }

  // 글자 자리 누르기 — 히어로의 h1·p·blockquote 상자(좌우 24px·상하 12px 넓힌 것)를 8px 칸 표로 미리 풀어 둔다.
  // 안개는 × .3, 잔별은 × .4, 상자에서 48px에 걸쳐 1로 돌아온다
  const CELL = 8
  let gw = 0, gh = 0, pressFog = new Float32Array(0), pressDust = new Float32Array(0)
  function readBoxes() {
    if (!w || !h) return
    const c = cv!.getBoundingClientRect()
    const boxes: Box[] = []
    hero?.querySelectorAll<HTMLElement>('h1, p, blockquote').forEach((el) => {
      const b = el.getBoundingClientRect()
      if (!b.width || !b.height) return
      boxes.push({ l: b.left - c.left - 24, r: b.right - c.left + 24, t: b.top - c.top - 12, b: b.bottom - c.top + 12 })
    })
    gw = Math.ceil(w / CELL) + 1; gh = Math.ceil(h / CELL) + 1
    pressFog = new Float32Array(gw * gh); pressDust = new Float32Array(gw * gh)
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const x = i * CELL + CELL / 2, y = j * CELL + CELL / 2
      pressFog[j * gw + i] = textPress(x, y, boxes, 0.3); pressDust[j * gw + i] = textPress(x, y, boxes, 0.4)
    }
  }
  const pressAt = (g: Float32Array, x: number, y: number) => {
    const i = (x / CELL) | 0, j = (y / CELL) | 0
    return i < 0 || j < 0 || i >= gw || j >= gh ? 1 : g[j * gw + i]
  }

  // 화면 띠를 덮는 고리(반지름 r0~r1) 위에 별을 고르게 뿌린다 — 어느 쪽으로 돌아도 하늘이 비지 않게
  function scatter(n: number, big: boolean): Star[] {
    const r0 = R, r1 = Math.hypot(w / 2, R + h)
    return Array.from({ length: n }, () => {
      const r = Math.sqrt(rand(r0 * r0, r1 * r1)), a = rand(0, TAU)
      return { r, a, x: r * Math.cos(a), y: r * Math.sin(a), s: big ? rand(1, 1.7) : rand(0.35, 0.9), p: rand(0, TAU), tw: rand(0.6, 1.8) }
    })
  }
  // 은하수: 중심선 r(a)를 한 바퀴 따라가며 안개 점(호 길이 σ·1.2 간격)과 잔별 자리(호 길이로 고르게, 법선 방향 정규분포)를 만든다.
  // 지금 먼 별 층이 돈 각도(far.ang)를 빼 두어, 뿌린 순간 띠가 화면 가로 62%에서 하늘 가운데를 지나 오른쪽 위로 오른다
  const DUST = 3.2 // 잔별 수 = 먼 별 수 × DUST
  function sowBand() {
    const sigma = wide.matches ? 70 : 46, n = bandWaves(w, R, h), a0 = bandPhase(w, R, h) - far.ang
    const pts: number[] = [] // 약 2px 간격의 중심선 점과 단위 법선: x, y, nx, ny
    const step = 2 / (R + h), gap = FOG.spacing * sigma
    let px = 0, py = 0, acc = gap, first = true
    fog = []; fogR = FOG.radius * sigma
    for (let a = 0; a < TAU; a += step) {
      const r = bandR(a, R, h, n, a0), x = r * Math.cos(a), y = r * Math.sin(a)
      if (!first) {
        const dx = x - px, dy = y - py, len = Math.hypot(dx, dy) || 1
        pts.push(x, y, -dy / len, dx / len)
        acc += len
        if (acc >= gap) { acc = 0; fog.push({ a, x, y, o: rand(FOG.opMin, FOG.opMax) }) }
      }
      px = x; py = y; first = false
    }
    const count = Math.round(far.stars.length * DUST), m = pts.length / 4
    dust = Array.from({ length: count }, () => {
      const i = ((Math.random() * m) | 0) * 4, off = gauss() * sigma
      const x = pts[i] + pts[i + 2] * off, y = pts[i + 1] + pts[i + 3] * off
      return { a: norm(Math.atan2(y, x)), x, y, s: rand(0.25, 0.6), o: rand(0.3, 0.7) }
    }).sort((p, q) => p.a - q.a)
  }
  // 별과 별자리를 새로 뿌린다 — 폭이 바뀌었거나, 하늘이 뿌릴 때보다 80px 넘게 길어져 아래쪽이 빌 때만
  function sow() {
    sownH = h
    const ring = Math.PI * (Math.hypot(w / 2, R + h) ** 2 - R * R)
    far.stars = scatter(Math.round(ring / 1300), false).sort((p, q) => p.a - q.a)
    near.stars = scatter(Math.round(ring / 15000), true)
    sowBand()
    // 별자리: 가까운 별 가운데 서로 가까운 것끼리 4~5개씩 잇는다
    constel = []
    const S = near.stars
    for (let c = 0; c < Math.min(9, S.length); c++) {
      const seed = Math.floor(Math.random() * S.length), group = [seed]
      while (group.length < 5) {
        const g = S[group[group.length - 1]]
        let best = -1, bd = 120 * 120
        S.forEach((s, i) => { if (group.includes(i)) return
          const d = (s.x - g.x) ** 2 + (s.y - g.y) ** 2
          if (d < bd) { bd = d; best = i } })
        if (best < 0) break
        group.push(best)
      }
      if (group.length >= 4) constel.push(group)
    }
  }
  // 캔버스 높이는 히어로 높이를 따른다 — 글꼴이 늦게 뜨거나 줄이 바뀌면 로드 뒤에도 변한다.
  // 높이만 바뀌면 비트맵·달 자리·머리띠 경계·글자 상자만 다시 잡고 별은 그대로 둔다(극좌표라 찌그러지지 않는다).
  function measure() {
    const nw = cv!.clientWidth, nh = cv!.clientHeight
    if (!nw || !nh || (nw === w && nh === h)) return
    const resow = nw !== w || nh > sownH + 80
    const dpr = Math.min(devicePixelRatio || 1, 2)
    w = nw; h = nh; px1 = 1 / dpr
    cv!.width = Math.round(w * dpr); cv!.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    R = Math.max(700, w * 0.8); pole.cx = w / 2; pole.cy = -R
    if (resow) sow()
    moonR = wide.matches ? 17 : 13
    const m = toPolar(moonEl?.offsetLeft ?? w * 0.8, moonEl?.offsetTop ?? 150, pole)
    moon.r = m.r; moon.a = m.a
    mastLine = mast ? mast.offsetTop + mast.offsetHeight + 12 : 0
    readBoxes()
    sizeBand(dpr)
    draw(lastT) // 비트맵 크기를 바꾸면 그림이 지워진다 — 멈춰 있을 때(동작 줄이기·화면 밖)도 바로 다시 그린다
  }
  const inView = (x: number, y: number, m = 40) => x > -m && x < w + m && y > -m && y < h + m
  const fadeAt = (y: number) => Math.max(0, Math.min(1, 1 - y / h))
  // 화면에 들어올 수 있는 것만 돈다 — 별·안개는 각도(a, 0~2π) 순으로 정렬해 두고, 층이 돈 각도를 빼 화면이 보는 각 범위만 고른다.
  // 화면 위 모서리가 가장 넓은 각을 본다(atan((w/2)/R)), 여유 .15라디안은 안개 반지름·마우스 시차 몫
  const norm = (a: number) => ((a % TAU) + TAU) % TAU
  const lower = (arr: { a: number }[], v: number) => {
    let lo = 0, hi = arr.length
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].a < v) lo = m + 1; else hi = m }
    return lo
  }
  function inSight<T extends { a: number }>(arr: T[], ang: number, f: (o: T) => void) {
    const hw = Math.atan(w / 2 / R) + 0.15, lo = norm(Math.PI / 2 - hw - ang), hi = lo + 2 * hw
    for (let i = lower(arr, lo), e = lower(arr, Math.min(hi, TAU)); i < e; i++) f(arr[i])
    if (hi > TAU) for (let i = 0, e = lower(arr, hi - TAU); i < e; i++) f(arr[i])
  }

  // 은하수는 별 캔버스 뒤의 두 캔버스에 따로 그린다(z-index −1이라 .s-sky의 새벽 그러데이션 위, 별 아래 — 안개 < 잔별 < 별).
  // 안개도 잔별도 반짝이지 않고 먼 별 층과 함께만 움직이므로, 반 화소 넘게 움직였을 때만 다시 그린다.
  // 안개는 부드러운 빛이라 CSS 화소의 1/4로 그려 늘여 보인다 — 큰 번짐 점을 매 프레임 겹쳐 그리면 휴대폰에서 프레임이 무너진다
  const FS = 0.25
  const layer = () => {
    const c = document.createElement('canvas')
    c.style.cssText = 'position:absolute;left:0;top:0;width:100%;z-index:-1;pointer-events:none'
    cv!.before(c)
    return [c, c.getContext('2d')!] as const
  }
  const [fogCv, fctx] = layer(), [dustCv, dctx] = layer()
  const bandAt = { ang: 0, mx: 0, my: 0, dirty: true }
  function sizeBand(dpr: number) {
    fogCv.width = Math.ceil(w * FS); fogCv.height = Math.ceil(h * FS); fogCv.style.height = `${h}px`
    fctx.setTransform(FS, 0, 0, FS, 0, 0)
    dustCv.width = Math.round(w * dpr); dustCv.height = Math.round(h * dpr); dustCv.style.height = `${h}px`
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    bandAt.dirty = true
  }
  function drawBand() {
    bandAt.ang = far.ang; bandAt.mx = mx; bandAt.my = my; bandAt.dirty = false
    fctx.clearRect(0, 0, w, h); dctx.clearRect(0, 0, w, h)
    const fc = Math.cos(far.ang), fs = Math.sin(far.ang)
    const fx = pole.cx + mx * far.px, fy = pole.cy + my * far.px
    // 안개 — 화면 안의 점만. 글자 자리에서는 × .3
    inSight(fog, far.ang, (f) => {
      const x = fx + f.x * fc - f.y * fs, y = fy + f.x * fs + f.y * fc
      if (!inView(x, y, fogR)) return
      const a = f.o * fadeAt(y) * pressAt(pressFog, x, y)
      if (a < 0.003) return
      fctx.globalAlpha = a
      fctx.drawImage(puff, x - fogR, y - fogR, fogR * 2, fogR * 2)
    })
    // 잔별 — 글자 자리에서는 × .4
    dctx.fillStyle = '#FFFFFF'
    inSight(dust, far.ang, (d) => {
      const x = fx + d.x * fc - d.y * fs, y = fy + d.x * fs + d.y * fc
      if (!inView(x, y, 2)) return
      dctx.globalAlpha = d.o * fadeAt(y) * pressAt(pressDust, x, y)
      const z = Math.max(d.s * 2, px1) // 한 기기 화소보다 작게 그리면 번져서 사라진다
      dctx.fillRect(x - z / 2, y - z / 2, z, z)
    })
  }

  let px1 = 1 // 기기 화소 하나의 CSS 크기
  function draw(t: number) {
    lastT = t
    ctx.clearRect(0, 0, w, h)
    const ts = t / 1000
    // 먼 별 층(은하수 포함)의 회전 — 층마다 cos·sin 한 번, 별마다는 곱셈으로
    const fc = Math.cos(far.ang), fs = Math.sin(far.ang)
    const fx = pole.cx + mx * far.px, fy = pole.cy + my * far.px
    // 은하수(안개·잔별)는 뒤 캔버스에 있다 — 반 화소 넘게 움직였을 때만 다시 그린다
    if (bandAt.dirty || Math.abs(far.ang - bandAt.ang) * (R + h) > 0.5 ||
      Math.abs(mx - bandAt.mx) * far.px > 0.5 || Math.abs(my - bandAt.my) * far.px > 0.5) drawBand()
    ctx.fillStyle = '#FFFFFF'
    // 먼 별
    inSight(far.stars, far.ang, (s) => {
      const x = fx + s.x * fc - s.y * fs, y = fy + s.x * fs + s.y * fc
      if (!inView(x, y, 2)) return
      ctx.globalAlpha = fadeAt(y) * (still ? 0.7 : 0.62 + 0.16 * sinT(s.p + ts * s.tw * 0.4))
      ctx.beginPath(); ctx.arc(x, y, s.s, 0, TAU); ctx.fill()
    })
    // 달 — 달무리 반지름은 달 반지름의 다섯 배. 하늘이 낮아 달무리가 바닥에 잘릴 페이지에서는 그리지 않는다
    { const [bx, by] = toScreen(moon.r, moon.a, pole, moon.ang)
      const x = bx + mx * moon.px, y = by + my * moon.px, halo = moonR * 5, fit = moonFit(y, moonR, h)
      if (fit > 0 && inView(x, y, halo)) {
        ctx.globalAlpha = fit
        const g = ctx.createRadialGradient(x, y, 0, x, y, halo)
        g.addColorStop(0, 'rgba(248,232,176,.26)'); g.addColorStop(1, 'rgba(248,232,176,0)')
        ctx.fillStyle = g; ctx.fillRect(x - halo, y - halo, halo * 2, halo * 2)
        ctx.drawImage(moonImg, x - moonR, y - moonR, moonR * 2, moonR * 2)
      } }
    // 가까운 별과 별자리 선
    const nc = Math.cos(near.ang), ns = Math.sin(near.ang)
    const nx = pole.cx + mx * near.px, ny = pole.cy + my * near.px
    const P = near.stars.map((s): [number, number] => [nx + s.x * nc - s.y * ns, ny + s.x * ns + s.y * nc])
    ctx.strokeStyle = 'rgba(217,211,247,.26)'; ctx.lineWidth = 0.8
    for (const g of constel) {
      // 머리띠나 화면 가장자리에 걸치는 별자리는 선을 긋지 않는다
      if (skipConstellation(g.map((i) => P[i]), w, mastLine)) continue
      ctx.beginPath()
      g.forEach((i, j) => { const [x, y] = P[i]; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y) })
      ctx.globalAlpha = fadeAt(P[g[0]][1]); ctx.stroke()
    }
    ctx.fillStyle = '#FFFFFF'
    near.stars.forEach((s, i) => {
      const [x, y] = P[i]
      if (!inView(x, y, 4)) return
      ctx.globalAlpha = fadeAt(y) * (still ? 0.9 : 0.78 + 0.2 * sinT(s.p + ts * s.tw * 0.4))
      ctx.beginPath(); ctx.arc(x, y, s.s, 0, TAU); ctx.fill()
    })
    ctx.globalAlpha = 1
    // 별똥별
    if (!still) {
      if (!shoot && t > nextShoot) shoot = { x: rand(w * 0.15, w * 0.7), y: rand(10, h * 0.3), t }
      if (shoot) {
        const k = (t - shoot.t) / 900
        if (k >= 1) { shoot = null; nextShoot = t + rand(40000, 90000) }
        else {
          const x = shoot.x + k * 160, y = shoot.y + k * 60
          const lg = ctx.createLinearGradient(x - 70, y - 26, x, y)
          lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(1, `rgba(255,255,255,${0.9 * (1 - k)})`)
          ctx.strokeStyle = lg; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - 70, y - 26); ctx.lineTo(x, y); ctx.stroke()
        }
      }
    }
  }

  // ── 하늘 끌기(1면만) ── 먼 별 1배, 가까운 별 1.6배, 달 .5배(달은 제자리로 돌아온다)
  let grab: { id: number; x0: number; y0: number; x: number; t: number; on: boolean } | null = null
  let spinV = 0 // 놓은 뒤 이어지는 먼 별 층의 빠르기(라디안/초)
  const turn = (da: number) => { far.ang += da; near.ang += 1.6 * da; moon.ang += 0.5 * da }

  function tick(t: number) {
    if (!visible || document.hidden) { running = false; return }
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0
    last = t
    const yaw = (globalThis as { __orbYaw?: number }).__orbYaw
    // 구체가 저절로 도는 몫(ORB_SPIN)은 따라 돌지 않는다 — 따라 돌면 1면 하늘이 초당 약 7px로 흘러 '돌고 있나?'를 넘는다.
    // 끌기와 그 관성만 따라 돈다. 구체가 멈춰 있으면(화면 밖) 움직임이 0이라 빼지 않는다
    const moved = yaw === undefined || lastYaw === null ? 0 : yaw - lastYaw
    const d = moved === 0 ? 0 : moved - ORB_SPIN * dt
    if (yaw !== undefined) lastYaw = yaw
    for (const L of [far, near, moon]) L.ang += L.auto * dt + L.k * d
    // 놓은 뒤의 관성: 속도 × exp(−3·dt) — 2초면 1% 아래
    if (spinV && !grab?.on) { turn(spinV * dt); spinV = coast(spinV, dt); if (Math.abs(spinV) < 1e-4) spinV = 0 }
    moon.ang -= moon.ang * Math.min(1, 0.25 * dt)
    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05
    draw(t)
    requestAnimationFrame(tick)
  }
  function start() { if (still || running) return; running = true; last = 0; requestAnimationFrame(tick) }

  // 시작 조건: 마우스는 누른 곳이 a·button·canvas·h1·p가 아닐 때(글자 선택을 막지 않으려고),
  // 터치는 a·button·canvas가 아니고 가로 이동이 세로보다 크며 8px를 넘었을 때. 세로 스크롤은 브라우저 몫(touch-action:pan-y).
  // 구체 캔버스 위에서는 구체가 돈다(하늘은 k 비율로 따라 돈다). 동작 줄이기에서는 끌기가 없다
  if (front && hero && !still) {
    hero.addEventListener('pointerdown', (e) => {
      if (grab || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return
      const mouse = e.pointerType === 'mouse'
      if ((e.target as Element).closest(mouse ? 'a, button, canvas, h1, p' : 'a, button, canvas')) return
      grab = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, t: e.timeStamp, on: mouse }
      if (mouse) { spinV = 0; hero.setPointerCapture(e.pointerId) }
    })
    hero.addEventListener('pointermove', (e) => {
      if (!grab || e.pointerId !== grab.id) return
      if (!grab.on) {
        const dx = e.clientX - grab.x0, dy = e.clientY - grab.y0
        // 터치는 누른 요소가 이미 포인터를 붙잡고 있어(암묵적 캡처) 이벤트가 히어로까지 올라온다 — 따로 붙잡지 않는다
        if (touchDrags(dx, dy)) { grab.on = true; grab.x = e.clientX; grab.t = e.timeStamp; spinV = 0 }
        else if (Math.abs(dy) > 8) grab = null // 세로로 먼저 움직였다 — 스크롤이다
        return
      }
      const da = dragAngle(e.clientX - grab.x, R, h)
      const dtE = Math.max(1 / 240, (e.timeStamp - grab.t) / 1000)
      turn(da)
      spinV = Math.max(-2, Math.min(2, da / dtE))
      grab.x = e.clientX; grab.t = e.timeStamp
      if (!running) draw(lastT)
    })
    const release = (e: PointerEvent) => {
      // 안쪽 요소의 캡처가 풀린 것(올라온 lostpointercapture)은 놓은 것이 아니다
      if (!grab || e.pointerId !== grab.id || (e.type === 'lostpointercapture' && e.target !== hero)) return
      // 멈춰 쥐고 있다가 놓으면 관성도 그만큼 줄어 있다
      if (grab.on) spinV = coast(spinV, 4 * Math.max(0, (e.timeStamp - grab.t) / 1000))
      grab = null
    }
    hero.addEventListener('pointerup', release)
    hero.addEventListener('pointercancel', release)
    hero.addEventListener('lostpointercapture', release)
    // 끄는 동안에는 글자가 선택되지 않게
    document.addEventListener('selectstart', (e) => { if (grab?.on) e.preventDefault() })
  }

  measure()
  // 캔버스 크기가 바뀔 때만 다시 잰다(폰에서 주소 막대가 접히는 것은 캔버스 크기를 바꾸지 않는다)
  new ResizeObserver(measure).observe(cv)
  // 글꼴이 늦게 떠 줄이 바뀌어도 하늘 높이는 그대로일 수 있다 — 글자 상자는 글꼴이 뜬 뒤 한 번 더 읽는다
  document.fonts?.ready.then(() => { readBoxes(); bandAt.dirty = true; draw(lastT) })
  // 마우스를 따라 레이어가 조금씩 어긋난다(먼 것은 덜, 가까운 것은 더)
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { tmx = e.clientX / innerWidth - 0.5; tmy = e.clientY / innerHeight - 0.5 } }, { passive: true })
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start() }).observe(cv)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start() })
  start()
}
