// 글 페이지: 읽기 진행 막대, 두 목차(넓은 화면 옆 목차, 좁은 화면 접는 목차)의 현재 절 표시,
// 그리고 좁은 화면의 읽기 띠(글머리를 지나면 위에 붙는다 — 지금 읽는 절 + 접는 목차).
import { currentSection, passedFirst, readbarOn, readingProgress } from '../lib/reading'

const body = document.querySelector<HTMLElement>('.post-body')
const bar = document.querySelector<HTMLElement>('.s-progress i')
const heads = [...document.querySelectorAll<HTMLElement>('.post-body h2[id]')]
const links = [...document.querySelectorAll<HTMLAnchorElement>('.s-toc a, .s-toc-fold a')]
const fold = document.querySelector<HTMLDetailsElement>('.s-toc-fold')
const readbar = document.querySelector<HTMLElement>('.s-readbar')
const readbarTitle = readbar?.querySelector<HTMLElement>('.s-readbar-title')
const top = document.querySelector<HTMLElement>('.s-top')
const footer = document.querySelector<HTMLElement>('.footer')
// 첫 절에 닿기 전에 띠에 적을 글자 — 글 제목의 질문 줄(가르지 않은 제목이면 h1 전체)
const postTitle = (document.querySelector('.s-post-head .s-tq') ?? document.querySelector('.s-post-head h1'))?.textContent?.trim() ?? ''

let queued = false
function update() {
  queued = false
  if (body && bar) {
    const r = body.getBoundingClientRect()
    bar.style.transform = `scaleX(${readingProgress(r.top, r.height, innerHeight).toFixed(4)})`
  }
  const tops = heads.map((h) => h.getBoundingClientRect().top)
  const cur = heads.length ? heads[currentSection(tops)] : null
  if (cur && links.length) {
    for (const a of links) {
      if (a.getAttribute('href') === `#${cur.id}`) a.setAttribute('aria-current', 'true')
      else a.removeAttribute('aria-current')
    }
  }
  if (readbar && top && footer) {
    const on = readbarOn(top.getBoundingClientRect().bottom, footer.getBoundingClientRect().top, innerHeight)
    readbar.classList.toggle('on', on)
    // 걷힌 띠에 목차가 펼쳐진 채 남지 않게
    if (!on && fold?.open) fold.open = false
    if (readbarTitle) {
      const label = cur && passedFirst(tops) ? cur.textContent?.trim() ?? '' : postTitle
      if (readbarTitle.textContent !== label) readbarTitle.textContent = label
    }
  }
}
addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update) } }, { passive: true })
addEventListener('resize', update)
update()

fold?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => { fold.open = false }))
// 띠 밖을 누르면 목차가 닫힌다
document.addEventListener('pointerdown', (e) => { if (fold?.open && !fold.contains(e.target as Node)) fold.open = false })
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && fold?.open) {
    fold.open = false
    fold.querySelector('summary')?.focus()
  }
})
