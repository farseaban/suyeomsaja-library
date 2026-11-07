// 글 페이지: 도해(SVG)가 화면에 3분의 1쯤 들어오면 한 번, 선이 그어지고 면·글자가 나타난다.
// 끝나면 넣었던 인라인 스타일을 모두 지워 원래 도해로 되돌린다. 동작 줄이기·구형 브라우저에서는 손대지 않는다.
import { drawDelay, drawMode, shouldPlay } from '../lib/draw'

const SHAPES = 'path, line, polyline, polygon, rect, circle, ellipse, text'
const SKIP = 'defs, marker, clipPath, mask, pattern, symbol, title, desc'
type Item = { el: SVGGraphicsElement; mode: 'draw' | 'fade' }
const armed = new WeakMap<Element, Item[]>()

function arm(svg: SVGSVGElement) {
  const items = [...svg.querySelectorAll<SVGGraphicsElement>(SHAPES)]
    .filter((el) => !el.closest(SKIP))
    .map((el): Item => {
      const cs = getComputedStyle(el)
      let mode = el.tagName.toLowerCase() === 'text' ? 'fade' : drawMode({ stroke: cs.stroke, strokeWidth: cs.strokeWidth, dasharray: cs.strokeDasharray })
      let len = 0
      if (mode === 'draw') {
        try { len = (el as unknown as SVGGeometryElement).getTotalLength() } catch { len = 0 }
        if (!(len > 0)) mode = 'fade'
      }
      if (mode === 'draw') {
        el.style.strokeDasharray = `${len}`
        el.style.strokeDashoffset = `${len}`
        el.style.fillOpacity = '0'
      } else {
        el.style.opacity = '0'
      }
      return { el, mode }
    })
  svg.classList.add('s-draw')
  armed.set(svg, items)
}

function play(svg: Element) {
  const items = armed.get(svg) ?? []
  items.forEach(({ el, mode }, i) => {
    const d = drawDelay(i)
    el.style.transition = mode === 'draw'
      ? `stroke-dashoffset .8s cubic-bezier(.5,0,.2,1) ${d}ms, fill-opacity .5s ease ${d + 450}ms`
      : `opacity .5s ease ${d + 200}ms`
    if (mode === 'draw') {
      el.style.strokeDashoffset = '0'
      el.style.removeProperty('fill-opacity')
    } else {
      el.style.removeProperty('opacity')
    }
  })
  const last = drawDelay(items.length - 1) + 1400
  window.setTimeout(() => {
    for (const { el } of items) for (const p of ['transition', 'stroke-dasharray', 'stroke-dashoffset']) el.style.removeProperty(p)
  }, last)
}

// 아직 재생하지 않은 도해를 움직임 없이 곧바로 원래 모습으로 되돌린다(인쇄 전 등).
function reveal(svg: Element) {
  for (const { el } of armed.get(svg) ?? []) for (const p of ['transition', 'stroke-dasharray', 'stroke-dashoffset', 'fill-opacity', 'opacity']) el.style.removeProperty(p)
  armed.delete(svg)
}

if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  const svgs = [...document.querySelectorAll<SVGSVGElement>('.post-body svg[role="img"]')]
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!armed.has(e.target) || !shouldPlay(e.intersectionRatio, e.intersectionRect.height, innerHeight)) continue
      io.unobserve(e.target)
      play(e.target)
      armed.delete(e.target)
    }
  }, { threshold: Array.from({ length: 21 }, (_, i) => i / 20) })
  svgs.forEach((svg) => { arm(svg); io.observe(svg) })
  addEventListener('beforeprint', () => svgs.forEach((svg) => { if (armed.has(svg)) { io.unobserve(svg); reveal(svg) } }))
}
