import { describe, it, expect, beforeAll } from 'vitest'
import { buildTest } from './build-env'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'node-html-parser'
import postcss from 'postcss'
import { metaChunks } from './image-meta'
import { cardVersion } from '../src/lib/card'
import { activeCategories, loadPosts } from '../src/lib/posts'
import { SITE } from '../src/config/site'

const OUT = 'dist-test'
const BASE = '/suyeomsaja-library/'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}
let files: string[] = []
const html = (rel: string) => readFileSync(join(OUT, rel), 'utf8')
const siteCss = () => files.filter((f) => f.endsWith('.css') && f.includes('/_astro/')).map((f) => readFileSync(f, 'utf8')).join('\n')

beforeAll(() => {
  buildTest()
  files = walk(OUT).filter((f) => !f.includes(`${OUT}/pagefind/`))
})

describe('build output', () => {
  it('prefixes every root-relative link with the base path', () => {
    const bad: string[] = []
    for (const f of files.filter((f) => f.endsWith('.html'))) {
      const root = parse(readFileSync(f, 'utf8'))
      for (const el of root.querySelectorAll('a[href], link[href], script[src]')) {
        const v = el.getAttribute('href') ?? el.getAttribute('src') ?? ''
        if (v.startsWith('/') && !v.startsWith(BASE)) bad.push(`${f}: ${v}`)
      }
    }
    expect(bad).toEqual([])
  })
  it('points rss links under the base path', () => {
    const links = [...html('rss.xml').matchAll(/<link>([^<]+)<\/link>/g)].map((m) => m[1])
    expect(links.length).toBeGreaterThan(1)
    for (const l of links) expect(new URL(l).pathname.startsWith(BASE)).toBe(true)
  })
  it('keeps post css scoped — no bare body/h1/h2/:root/article rule in <style>', () => {
    const root = parse(html('posts/sample-econ/index.html'))
    const css = root.querySelectorAll('style').map((s) => s.textContent).join('\n')
    expect(css).toContain('.post-body')
    expect(css).not.toMatch(/(^|})\s*(body|h1|h2|:root|article)\s*\{/)
  })
  it('keeps footnote round-trip anchors and adds no <base>', () => {
    const s = html('posts/sample-econ/index.html')
    expect(s).toContain('id="cite-1"')
    expect(s).toContain('href="#ref-1"')
    expect(s).toContain('id="ref-1"')
    expect(s).not.toMatch(/<base[\s>]/)
  })
  it('wraps posts in the site frame and marks only posts for search', () => {
    const post = html('posts/sample-econ/index.html')
    expect(post).toContain('수염사자의 서재')
    expect(post).toContain(`© ${new Date().getFullYear()} 반창모`)
    expect(post).toContain('data-pagefind-body')
    expect(html('index.html')).not.toContain('data-pagefind-body')
  })
  it('labels the front-page lead as 새 글', () => {
    // 대표 글 위 줄 = 그 분야의 칩 + '새 글' 라벨
    const eye = parse(html('index.html')).querySelector('.s-hero .lead .s-eyebrow')!
    const chip = eye.querySelector('a.s-chip')!
    expect(chip.text).toBe('인류와 생명의 수수께끼')
    expect(chip.getAttribute('class')).toBe('s-chip s-cat-mint')
    expect(chip.getAttribute('href')).toBe(`${BASE}category/nature/`)
    expect(eye.querySelector('.s-label')!.text).toBe('새 글')
    expect(eye.text.replace(/\s+/g, ' ').trim()).toBe('인류와 생명의 수수께끼 새 글')
  })
  it('leaks no personal email, ads or trackers, and no comments without config', () => {
    const all = files.filter((f) => /\.(html|xml|js|css)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n')
    for (const bad of ['@gmail.com', 'googlesyndication', 'doubleclick', 'gtag(', 'google-analytics', 'giscus.app'])
      expect(all, bad).not.toContain(bad)
  })
})

describe('page head', () => {
  const FONT = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css'
  const pages = () => files.filter((f) => f.endsWith('.html'))
  it('keeps every page out of search engines unless the launch variable says otherwise', () => {
    expect(pages().length).toBeGreaterThan(5)
    for (const f of pages()) {
      expect(parse(readFileSync(f, 'utf8')).querySelector('meta[name="robots"]')?.getAttribute('content'), f).toBe('noindex, nofollow')
    }
  })
  it('loads the variable sans face on every page, and no longer the static one', () => {
    expect(pages().length).toBeGreaterThan(5)
    for (const f of pages()) {
      const sheets = parse(readFileSync(f, 'utf8')).querySelectorAll('link[rel="stylesheet"]').map((l) => l.getAttribute('href') ?? '')
      expect(sheets, f).toContain(FONT)
      expect(sheets.filter((h) => h.includes('/static/pretendard.css')), f).toEqual([])
    }
  })
  it('paints the browser frame night, stays light-only and fills the notch area', () => {
    for (const f of pages()) {
      const root = parse(readFileSync(f, 'utf8'))
      expect(root.querySelector('meta[name="theme-color"]')?.getAttribute('content'), f).toBe('#212029')
      expect(root.querySelector('meta[name="color-scheme"]')?.getAttribute('content'), f).toBe('only light')
      expect(root.querySelector('meta[name="viewport"]')?.getAttribute('content'), f).toMatch(/(^|,\s*)viewport-fit=cover(\s*,|$)/)
    }
  })
  it('links the svg favicon under the base path and emits it', () => {
    for (const f of pages()) {
      const icon = parse(readFileSync(f, 'utf8')).querySelector('link[rel="icon"]')
      expect(icon?.getAttribute('type'), f).toBe('image/svg+xml')
      expect(icon?.getAttribute('href'), f).toBe(`${BASE}favicon.svg`)
    }
    const svg = readFileSync(join(OUT, 'favicon.svg'), 'utf8')
    expect(svg).toContain('#212029')
    expect(svg).toContain('#F8E8B0')
  })
  it('puts the post body and its diagrams back on the site sans stack', () => {
    // 글 템플릿이 .post-body와 도해 <svg font-family="'Pretendard',…">에 옛 글꼴 이름을 박아 둔다.
    // 틀이 되돌리지 않으면 그 글꼴이 깔려 있지 않은 기기(휴대폰)에서 본문·도해가 대체 글꼴로 나온다.
    const sans = new Set<string>()
    postcss.parse(siteCss()).walkRules((rule) => {
      rule.walkDecls('font-family', (d) => {
        if (d.value.replace(/\s+/g, '') === 'var(--sans)') for (const sel of rule.selectors) sans.add(sel.replace(/\s+/g, ' ').trim())
      })
    })
    expect([...sans]).toContain('.s-post .post-body')
    expect([...sans]).toContain('.s-post .post-body svg')
    // 실제 글의 도해가 여전히 옛 이름을 속성으로 달고 있는지(글 원문은 고치지 않는다) — 이 전제가 사라지면 위 규칙도 필요 없다
    expect(readFileSync('posts/gobekli-tepe/post.html', 'utf8')).toMatch(/<svg[^>]*font-family="'Pretendard',/)
  })
})

// 글 템플릿의 클래스 이름은 사이트 CSS에서 본문 덮어쓰기(.s-post .post-body …)로만 쓴다 — 틀의 규칙이 글 클래스에 번지지 않게
describe('site css stays out of posts', () => {
  const tpl = readFileSync('posts/anthropic-fair-value-loss/post.html', 'utf8')
  // kicker(연재 표시)는 공개 글에서 뺐지만 글 템플릿과 테스트용 글에는 남아 있어 함께 지킨다
  const postClasses = [...new Set([...tpl.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)).concat('kicker'))].sort()
  // 낱말 단위로 대조한다 — 부분 문자열로 보면 .s-post-meta·.s-label·.s-about-quote가 meta·label·quote에 걸린다
  const named = new RegExp(`\\.(${postClasses.join('|')})(?![\\w-])`)
  it('knows the thirteen class names of the post template', () => {
    expect(postClasses).toEqual(['back', 'caution', 'disclaimer', 'expert-note', 'fn', 'hl', 'key', 'kicker', 'label', 'lead-quote', 'meta', 'quote', 'refs'])
  })
  it('matches whole class names only', () => {
    for (const sel of ['.s-post-meta', '.s-label', '.s-about-quote', '.s-post-kicker', '.lead', '.lead h1 .s-tq', '.keyline', '.s-readbar', '.backdrop', '.meta-row'])
      expect(named.test(sel), sel).toBe(false)
    for (const sel of ['.meta', '.s-post .post-body .meta', '.refs a.back', 'blockquote.quote p', '.lead-quote', '.key .label', 'tr.hl td', 'sup.fn+sup.fn', '.kicker::before', '.caution', '.expert-note blockquote', '.disclaimer', '.refs li:target'])
      expect(named.test(sel), sel).toBe(true)
  })
  it('starts every selector that names a post-template class with .s-post .post-body', () => {
    const bad: string[] = []
    let seen = 0
    postcss.parse(siteCss()).walkRules((rule) => {
      for (const sel of rule.selectors) {
        const one = sel.replace(/\s+/g, ' ').trim()
        if (!named.test(one)) continue
        seen++
        if (!one.startsWith('.s-post .post-body')) bad.push(one)
      }
    })
    expect(bad).toEqual([])
    // 본문 덮어쓰기(post.css)가 빌드에 실려 있다
    expect(seen).toBeGreaterThan(20)
  })
})

describe('series numbering', () => {
  it('names the corner at the foot of the post, without a count while the corner has one post', () => {
    const root = parse(html('posts/sample-econ/index.html'))
    const corner = root.querySelector(`.post-after .tags a[href="${BASE}series/${encodeURIComponent('숫자 읽기 · 사례로 읽기')}/"]`)!
    expect(corner.text.trim()).toBe('숫자 읽기 · 사례로 읽기')
    expect(html('posts/sample-econ/index.html')).not.toContain(' 1/1')
    // 코너가 없는 글에는 코너 링크가 없다
    expect(parse(html('posts/sample-philo/index.html')).querySelectorAll('.post-after .tags a')).toHaveLength(1)
  })
})

describe('masthead on narrow screens', () => {
  it('keeps the search link outside the horizontally scrolling menu', () => {
    const mast = parse(html('index.html')).querySelector('.masthead')!
    expect(mast.querySelectorAll('.shelfbar .links .cats a').length).toBeGreaterThan(0)
    expect(mast.querySelector('.links .search')).toBeNull()
    expect(mast.querySelector('.util > .search')).not.toBeNull()
    const mobile = readFileSync('src/styles/site.css', 'utf8').match(/@media \(max-width:760px\)\{([\s\S]*?)\n\}/)![1]
    expect(mobile).toMatch(/\.masthead \.links\{[^}]*overflow-x:auto/)
    expect(mobile).not.toMatch(/\.masthead nav\{[^}]*overflow-x/)
  })
  it('fades the right edge of the scrolling menu and lets the last item scroll clear of it', () => {
    const mobile = readFileSync('src/styles/site.css', 'utf8').match(/@media \(max-width:760px\)\{([\s\S]*?)\n\}/)![1]
    const rule = mobile.match(/\.masthead \.links\{([^}]*)\}/)![1]
    expect(rule).toMatch(/-webkit-mask-image:linear-gradient\(to right/)
    expect(rule).toMatch(/(^|;)mask-image:linear-gradient\(to right/)
    expect(rule).toMatch(/padding-right:20px/)
  })
  it('fades the left edge only once scrolled, and drops the right fade at the end', () => {
    const css = readFileSync('src/styles/site.css', 'utf8')
    const mobile = css.match(/@media \(max-width:760px\)\{([\s\S]*?)\n\}/)![1]
    const rule = mobile.match(/\.masthead \.links\{([^}]*)\}/)![1]
    expect(rule).toMatch(/mask-image:linear-gradient\(to right,transparent 0,#000 var\(--fl\),#000 calc\(100% - var\(--fr\)\),transparent 100%\)/)
    expect(css).toMatch(/\.masthead \.links\{--fl:0px;--fr:28px\}/)
    expect(mobile).toMatch(/\.masthead \.links\.scrolled\{--fl:28px\}/)
    expect(mobile).toMatch(/\.masthead \.links\.at-end\{--fr:0px\}/)
    const js = files.filter((f) => /\.(js|html)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n')
    expect(js).toMatch(/scrolled/)
    expect(js).toMatch(/at-end/)
  })
})

describe('site frame', () => {
  const pages = () => files.filter((f) => f.endsWith('.html'))
  const page = (f: string) => parse(readFileSync(f, 'utf8'))
  const posts = () => loadPosts('tests/fixtures/posts')
  it('opens every page with one night zone — sky, masthead and hero — and a skip link to main', () => {
    expect(pages().length).toBeGreaterThan(5)
    for (const f of pages()) {
      const root = page(f)
      const tops = root.querySelectorAll('.s-top')
      expect(tops, f).toHaveLength(1)
      for (const sel of ['.s-sky', '.masthead', '.s-hero']) expect(tops[0].querySelectorAll(sel), `${f} ${sel}`).toHaveLength(1)
      expect(tops[0].querySelector('.s-sky canvas.s-sky-stars'), f).not.toBeNull()
      expect(tops[0].querySelector('.s-sky .s-sky-moon'), f).not.toBeNull()
      expect(tops[0].querySelector('.s-sky')!.getAttribute('aria-hidden'), f).toBe('true')
      expect(root.querySelector('a.s-skip')?.getAttribute('href'), f).toBe('#main')
      expect(root.querySelector('body > a.s-skip')?.text, f).toBe('본문으로')
      expect(root.querySelectorAll('main'), f).toHaveLength(1)
      expect(root.querySelector('main')!.getAttribute('id'), f).toBe('main')
      // 하늘·머리띠·꼬리말은 main 밖이다
      expect(root.querySelector('main .s-top, main .masthead, main .footer'), f).toBeNull()
    }
  })
  it('lifts the page title of every inner page into the hero, inside the frame width', () => {
    const inner = ['all/index.html', 'category/economy/index.html', 'series/자연 읽기/index.html', 'search/index.html', '404.html', 'about/index.html']
    for (const rel of inner) {
      const root = parse(html(rel))
      expect(root.querySelectorAll('h1'), rel).toHaveLength(1)
      expect(root.querySelector('.s-top .s-hero > .wrap header.page-head h1'), rel).not.toBeNull()
      expect(root.querySelector('main .page-head'), rel).toBeNull()
    }
  })
  it('names the page kind on body', () => {
    const kind: Record<string, string> = {
      'index.html': 'p-front', 'all/index.html': 'p-list', 'category/economy/index.html': 'p-list', 'series/자연 읽기/index.html': 'p-list',
      'posts/sample-econ/index.html': 'p-post', 'about/index.html': 'p-about', 'search/index.html': 'p-search', '404.html': 'p-404',
    }
    for (const [rel, cls] of Object.entries(kind)) expect(parse(html(rel)).querySelector('body')!.getAttribute('class'), rel).toBe(cls)
  })
  it('tints the horizon with the field colour on field and post pages only', () => {
    const style = (rel: string) => parse(html(rel)).querySelector('body')!.getAttribute('style') ?? ''
    const full = (c: string) => `--s-dawn:var(--${c});--s-accent:var(--${c}-d);--s-accent-ink:var(--${c}-ink);--s-accent-tint:var(--${c})`
    for (const c of activeCategories(posts())) expect(style(`category/${c.slug}/index.html`), c.slug).toBe(full(c.color))
    for (const p of posts()) expect(style(`posts/${p.slug}/index.html`), p.slug).toBe(full(p.color))
    expect(style('category/economy/index.html')).toContain('--s-dawn:var(--sky)')
    for (const rel of ['index.html', 'all/index.html', 'about/index.html', 'search/index.html', '404.html', 'series/자연 읽기/index.html'])
      expect(style(rel), rel).not.toContain('--s-dawn')
  })
  it('marks where the reader is in the masthead', () => {
    const cur = (rel: string, sel: string) => parse(html(rel)).querySelectorAll(`.masthead ${sel}[aria-current="page"]`).map((a) => a.text.trim())
    expect(cur('all/index.html', '.util a')).toEqual(['모든 글'])
    expect(cur('about/index.html', '.util a')).toEqual(['소개'])
    expect(parse(html('search/index.html')).querySelector('.masthead .util a.search')!.getAttribute('aria-current')).toBe('page')
    expect(cur('category/economy/index.html', '.cats a')).toEqual(['돈과 세상의 원리'])
    expect(cur('category/economy/index.html', '.util a')).toEqual([])
    expect(cur('index.html', 'a')).toEqual([])
    expect(cur('posts/sample-econ/index.html', 'a')).toEqual([])
  })
  it('splits the masthead into a utility bar and a field shelf, each a labelled nav', () => {
    const mast = parse(html('index.html')).querySelector('.masthead')!
    expect(mast.querySelector('.bar > a.name')!.text).toBe(SITE.name)
    expect(mast.querySelector('.bar > nav.util')!.getAttribute('aria-label')).toBe('사이트 메뉴')
    expect(mast.querySelector('nav.shelfbar')!.getAttribute('aria-label')).toBe('분야')
    expect(mast.querySelectorAll('.util a').map((a) => a.text.trim())).toEqual(['모든 글', '소개', ''])
    expect(mast.querySelectorAll('.shelfbar .cats a').map((a) => a.text)).toEqual(activeCategories(posts()).map((c) => c.name))
  })
  it('lets the sky be dragged on the front page only', () => {
    for (const f of pages()) {
      const sky = page(f).querySelector('.s-sky')!
      expect(sky.hasAttribute('data-drag'), f).toBe(f === join(OUT, 'index.html'))
    }
  })
  it('keeps the 분야 label in a field hero free of the field colour class', () => {
    for (const c of activeCategories(posts())) {
      const label = parse(html(`category/${c.slug}/index.html`)).querySelector('.s-hero .page-head .s-label')!
      expect(label.text, c.slug).toBe('분야')
      expect(label.getAttribute('class'), c.slug).not.toContain('s-cat-')
    }
  })
  it('closes every page with the evening footer — fields with counts, the site line, year and credit', () => {
    const cats = activeCategories(posts())
    for (const f of pages()) {
      const foot = page(f).querySelector('footer.footer')!
      const links = foot.querySelectorAll('.f-cats a')
      expect(links, f).toHaveLength(cats.length)
      cats.forEach((c, i) => {
        const n = posts().filter((p) => p.category === c.name).length
        expect(links[i].getAttribute('href'), f).toBe(`${BASE}category/${c.slug}/`)
        expect(links[i].querySelector('.f-n')!.text, f).toBe(`${n}편`)
        expect(links[i].text.replace(/\s+/g, ' ').trim(), f).toBe(`${c.name} ${n}편`)
      })
      expect(foot.querySelector('.f-brand a.name')!.text, f).toBe(SITE.name)
      expect(foot.querySelector('.f-brand p')!.text, f).toBe(SITE.description)
      expect(foot.querySelectorAll('.f-brand p span'), f).toHaveLength(2)
      expect(foot.querySelector('nav.f-cats')!.getAttribute('aria-label'), f).toBe('분야')
      expect(foot.querySelector('nav.f-util')!.getAttribute('aria-label'), f).toBe('꼬리말 메뉴')
      expect(foot.querySelectorAll('.f-util a').map((a) => a.text), f).toEqual(['모든 글', '소개', '검색', 'RSS'])
      const base = foot.querySelector('.f-base')!.text
      expect(base, f).toContain(`© ${new Date().getFullYear()} 반창모`)
      expect(base, f).toContain('richa 그림')
    }
  })
  it('keeps the user wording in one place — the footer reads it from the site config', () => {
    const src = readFileSync('src/components/Footer.astro', 'utf8')
    expect(src).not.toContain('얼어붙은')
    expect(src).not.toContain(SITE.name)
    expect(src).not.toContain(SITE.author)
  })
  it('drops the fixed 320px sky strip and clips sideways overflow without breaking sticky', () => {
    const src = readFileSync('src/styles/site.css', 'utf8')
    expect(src).not.toMatch(/\.s-sky\{[^}]*height:320px/)
    expect(src).not.toMatch(/body > main\{padding-top:96px\}/)
    expect(src).toMatch(/body\{[^}]*overflow-x:clip/)
    expect(src).not.toMatch(/body\{[^}]*overflow-x:hidden/)
    // .wrap의 데스크톱 값은 761px 블록에 — 머리띠보다 앞에 760px 블록을 두지 않는다
    const first = src.indexOf('@media (max-width:760px){')
    expect(src.slice(0, first)).toMatch(/@media \(min-width:761px\)\{\s*\.wrap\{max-width:1104px/)
    expect(src.slice(first)).toMatch(/^@media \(max-width:760px\)\{\n\s*\.masthead /)
  })
  it('ties the dawn gradient and the text limit to the same glow scale', () => {
    const css = siteCss()
    expect(css).toMatch(/\.s-hero\{padding-bottom:calc\(262px\s*\*\s*var\(--glow\)\)\}/)
    expect(css).toMatch(/\.s-sky-stars\{[^}]*height:calc\(100% - 180px\s*\*\s*var\(--glow\)\)/)
    expect(css).toMatch(/@supports \(background:linear-gradient\(in oklab,\s*red,\s*blue\)\)/)
    expect(css).toMatch(/@media\s*\(max-width:760px\)\{[^{}]*:root\{--glow:\.46\}/)
  })
  it('places the moon in CSS and keeps a long inner-page title out from under it on phones', () => {
    const src = readFileSync('src/styles/site.css', 'utf8')
    // 데스크톱: 본문 틀 오른쪽 끝에서 88px 안쪽(1440px → 1152, 1920px → 1392)
    expect(src).toMatch(/\.s-sky-moon\{[^}]*left:min\(80%,calc\(50% \+ 432px\)\);top:150px/)
    const phone = [...src.matchAll(/@media \(max-width:760px\)\{([\s\S]*?)\n\}/g)].map((m) => m[1]).find((b) => b.includes('.s-sky-moon'))!
    const moon = phone.match(/\.s-sky-moon\{left:calc\(100% - (\d+)px\);top:127px\}/)!
    expect(Number(moon[1])).toBe(44)
    // 휴대폰의 달(반지름 13px)은 틀 내용 오른쪽 끝(화면 끝 − 20px)에서 44 + 13 − 20 = 37px 안쪽까지 온다.
    // 제목 줄이 그 밑으로 들어가면 긴 코너 이름의 끝 글자가 달에 닿는다(360·375px) — 달 왼쪽에 8px 넘는 틈을 두고 줄을 바꾼다
    const pad = Number(phone.match(/\.s-hero \.page-head h1\{[^}]*padding-right:(\d+)px/)?.[1])
    expect(pad).toBeGreaterThanOrEqual(Number(moon[1]) + 13 - 20 + 8)
    expect(pad).toBeLessThanOrEqual(56)
  })
})

describe('field marks and lists', () => {
  const posts = () => loadPosts('tests/fixtures/posts')
  const rules = (css: string) => {
    const out: { sel: string; body: string; media: string }[] = []
    postcss.parse(css).walkRules((rule) => {
      const at = rule.parent?.type === 'atrule' ? `${(rule.parent as postcss.AtRule).name} ${(rule.parent as postcss.AtRule).params}` : ''
      // 최소화가 ::before·::after를 한 점으로 줄인다 — 두 점 꼴로 맞춰 읽는다
      for (const sel of rule.selectors) out.push({ sel: sel.replace(/\s+/g, ' ').trim().replace(/(^|[^:]):(before|after)\b/g, '$1::$2'), body: rule.nodes.map((n) => n.toString().replace(/\s+/g, '')).join(';'), media: at.replace(/\s+/g, '') })
    })
    return out
  }
  it('sets a list title in two lines without changing a character of it', () => {
    const root = parse(html('all/index.html'))
    const t = root.querySelector(`.row a.t[href="${BASE}posts/sample-econ/"]`)!
    expect(t.text).toBe('장부의 손실을 읽는 법 — 평가손과 현금')
    expect(t.querySelector('.s-tq')!.text).toBe('장부의 손실을 읽는 법')
    expect(t.querySelector('.s-tc')!.text).toBe('— 평가손과 현금')
    // 모든 행에서 화면의 글자 = 원제목
    for (const p of posts()) expect(root.querySelector(`.row a.t[href="${BASE}posts/${p.slug}/"]`)!.text, p.slug).toBe(p.title)
    // 줄표가 없는 제목은 개념 줄을 그리지 않는다
    const plain = posts().find((p) => !p.title.includes(' — '))
    if (plain) expect(root.querySelector(`.row a.t[href="${BASE}posts/${plain.slug}/"] .s-tc`)).toBeNull()
  })
  it('marks the field with a chip on every row of 모든 글 and of a corner', () => {
    for (const rel of ['all/index.html', 'series/자연 읽기/index.html']) {
      const rows = parse(html(rel)).querySelectorAll('.rows > li.row')
      expect(rows.length, rel).toBeGreaterThan(0)
      for (const row of rows) {
        const slug = row.querySelector('a.t')!.getAttribute('href')!.split('/').filter(Boolean).pop()!
        const p = posts().find((x) => x.slug === slug)!
        const chips = row.querySelectorAll('.row-m .s-chip')
        expect(chips, `${rel} ${slug}`).toHaveLength(1)
        expect(chips[0].text, slug).toBe(p.category)
        expect(chips[0].getAttribute('class'), slug).toBe(`s-chip s-cat-${p.color}`)
        expect(chips[0].getAttribute('href'), slug).toBe(`${BASE}category/${p.categorySlug}/`)
        expect(row.getAttribute('class'), slug).toBe('row')
        // 메타 칸 · 제목 칸 · 날짜 — 이 순서의 세 자식(휴대폰은 마크업을 두고 grid 자리로 푼다)
        expect(row.childNodes.filter((n) => n.nodeType === 1).map((n) => (n as unknown as { getAttribute(a: string): string }).getAttribute('class')), slug).toEqual(['row-m', 'row-b', 'when'])
      }
    }
    expect(parse(html('series/자연 읽기/index.html')).querySelector('ol.rows.numbered')).not.toBeNull()
  })
  it('drops the chip on a field page — every row there is the same field', () => {
    for (const c of activeCategories(posts())) {
      const root = parse(html(`category/${c.slug}/index.html`))
      const rows = root.querySelectorAll('main .rows > li')
      expect(rows.length, c.slug).toBe(posts().filter((p) => p.category === c.name).length)
      for (const row of rows) {
        expect(row.getAttribute('class'), c.slug).toBe('row row-plain')
        expect(row.querySelector('.s-chip, .row-m'), c.slug).toBeNull()
        expect(row.querySelector('.row-b a.t'), c.slug).not.toBeNull()
        expect(row.querySelector('.when'), c.slug).not.toBeNull()
      }
    }
  })
  it('shows the other fields as a shelf under a field page, and every field on 404', () => {
    const cats = activeCategories(posts())
    const shelves = (rel: string) => {
      const root = parse(html(rel))
      const sec = root.querySelectorAll('main section.s-sec')
      expect(sec, rel).toHaveLength(1)
      return { head: sec[0].querySelector('.s-sec-head h2.s-label')!.text, shelves: sec[0].querySelectorAll('.shelf-grid > section.shelf') }
    }
    for (const c of cats) {
      const { head, shelves: sh } = shelves(`category/${c.slug}/index.html`)
      expect(head, c.slug).toBe('다른 분야')
      const others = cats.filter((x) => x.slug !== c.slug)
      expect(sh.map((s) => s.querySelector('.shelf-h .s-chip')!.text), c.slug).toEqual(others.map((x) => x.name))
      expect(sh.map((s) => s.querySelector('.shelf-h .s-chip')!.getAttribute('href')), c.slug).not.toContain(`${BASE}category/${c.slug}/`)
    }
    const { head, shelves: sh } = shelves('404.html')
    expect(head).toBe('분야별')
    expect(sh).toHaveLength(cats.length)
    sh.forEach((s, i) => {
      const mine = posts().filter((p) => p.category === cats[i].name)
      const chip = s.querySelector('.shelf-h > a.s-chip')!
      expect(chip.text).toBe(cats[i].name)
      expect(chip.getAttribute('class')).toBe(`s-chip s-cat-${cats[i].color}`)
      expect(chip.getAttribute('href')).toBe(`${BASE}category/${cats[i].slug}/`)
      expect(s.querySelector('.shelf-h > .shelf-n')!.text).toBe(`${mine.length}편`)
      // 서가는 글 제목 색인이다 — 가르지 않은 원제목, 최대 3편, 화면 전환 이름 없음
      const links = s.querySelectorAll('ul > li > a')
      expect(links.map((a) => a.text)).toEqual(mine.slice(0, 3).map((p) => p.title))
      expect(links.map((a) => a.getAttribute('href'))).toEqual(mine.slice(0, 3).map((p) => `${BASE}posts/${p.slug}/`))
      for (const a of links) expect(a.getAttribute('style') ?? '').not.toContain('view-transition-name')
    })
    // 모든 글·코너·검색에는 서가가 없다
    for (const rel of ['all/index.html', 'series/자연 읽기/index.html', 'search/index.html']) expect(parse(html(rel)).querySelector('.shelf'), rel).toBeNull()
  })
  it('writes field names in ink on a pastel chip — the colour is a surface, never the letters', () => {
    const all = rules(siteCss())
    const chip = all.filter((r) => r.sel === '.s-chip')
    expect(chip.length).toBeGreaterThan(0)
    const body = chip.map((r) => r.body).join(';')
    expect(body).toMatch(/(^|;)color:var\(--ink\)/)
    expect(body).toMatch(/(^|;)background:var\(--c\)/)
    expect(body).toMatch(/(^|;)min-height:22px/)
    expect(body).toMatch(/(^|;)border-radius:var\(--radius-s\)/)
    // 터치 영역 44px
    expect(all.find((r) => r.sel === '.s-chip::after')?.body).toMatch(/inset:-11px-6px/)
    // 휴대폰 행에서는 이 영역의 아래 3px가 제목 링크와 겹친다. 제목 링크는 화면 전환 이름 때문에 쌓임 맥락을 이뤄
    // 뒤에 오는 제목이 칩을 덮는다 — 칩을 한 층 올려 44px를 온전히 칩의 것으로 둔다
    expect(body).toMatch(/(^|;)position:relative/)
    expect(body).toMatch(/(^|;)z-index:1(;|$)/)
    // .s-cat-{색}은 색 변수만 정의한다
    for (const c of ['lav', 'mint', 'peach', 'sky', 'butter', 'rose']) {
      const cat = all.filter((r) => r.sel === `.s-cat-${c}`)
      expect(cat, c).toHaveLength(1)
      expect(cat[0].body, c).toBe(`--c:var(--${c});--c-d:var(--${c}-d);--c-ink:var(--${c}-ink)`)
    }
    // 밤 위에서도 칩 글자색을 바꾸지 않는다(인쇄는 따로)
    expect(all.filter((r) => !r.media.startsWith('mediaprint') && /\.s-chip/.test(r.sel) && /(^|;)color:/.test(r.body)).map((r) => r.sel)).toEqual(['.s-chip'])
  })
  it('has no colour-dot label — a chip and a band are the only two field marks', () => {
    const css = siteCss()
    expect(css).not.toMatch(/s-cat-"?\]::before/)
    expect(css).not.toMatch(/\[class\*="?s-cat-/)
  })
  it('lays a row out in three columns, and on phones puts chip and date on one line by grid area', () => {
    const all = rules(siteCss())
    const of = (sel: string, media: string) => all.filter((r) => r.sel === sel && r.media === media).map((r) => r.body).join(';')
    expect(of('.row', '')).toMatch(/grid-template-columns:150pxminmax\(0,1fr\)132px/)
    expect(of('.row-plain', '')).toMatch(/grid-template-columns:minmax\(0,1fr\)132px/)
    const phone = 'media(max-width:760px)'
    expect(of('.row', phone)).toMatch(/grid-template-areas:"mwhen""bb"/)
    expect(of('.row-plain', phone)).toMatch(/grid-template-areas:"when""b"/)
    expect(of('.row-m', phone)).toMatch(/grid-area:m/)
    expect(of('.row-b', phone)).toMatch(/grid-area:b/)
    expect(of('.row .when', phone)).toMatch(/grid-area:when/)
    // 옛 휴대폰 규칙(날짜를 order로 끌어올림)과 옛 '1. ' 순번은 남지 않는다
    expect(siteCss()).not.toMatch(/\.row \.when\{[^}]*order:/)
    expect(siteCss()).not.toMatch(/counter\(n\)\s*"\. "/)
    // 코너 순번: 데스크톱은 제목 위, 휴대폰은 메타 줄 맨 앞
    expect(of('.numbered .row .row-b::before', '')).toMatch(/content:counter\(n,decimal-leading-zero\)/)
    expect(of('.numbered .row .row-m::before', phone)).toMatch(/content:counter\(n,decimal-leading-zero\)/)
    expect(of('.numbered .row .row-b::before', phone)).toMatch(/content:none/)
  })
  it('stands search and 404 on the masthead line, and styles the search box in css', () => {
    for (const rel of ['search/index.html', '404.html']) {
      const root = parse(html(rel))
      expect(root.querySelector('main > .wrap.s-narrow-left'), rel).not.toBeNull()
      expect(root.querySelector('main .wrap-narrow'), rel).toBeNull()
    }
    const box = parse(html('search/index.html')).querySelector('#search')!
    expect(box.getAttribute('style')).toBeUndefined()
    const all = rules(siteCss())
    const one = (sel: string) => all.filter((r) => r.sel === sel && r.media === '').map((r) => r.body).join(';')
    expect(one('.p-search .pagefind-ui .pagefind-ui__search-input')).toMatch(/font-weight:500/)
    const ph = one('.p-search .pagefind-ui .pagefind-ui__search-input::placeholder')
    expect(ph).toMatch(/font-weight:400/)
    expect(ph).toMatch(/color:var\(--sub\)/)
    expect(ph).toMatch(/opacity:1/)
    expect(siteCss()).toMatch(/--pagefind-ui-border:var\(--line-strong\)/)
    // 404의 길 안내 문구는 그대로
    expect(parse(html('404.html')).querySelectorAll('main .s-narrow-left a').map((a) => a.text)).toEqual(['1면으로', '검색하기'])
  })
})

describe('front page', () => {
  const posts = () => loadPosts('tests/fixtures/posts')
  const front = () => parse(html('index.html'))
  const rules = (css: string) => {
    const out: { sel: string; body: string; media: string }[] = []
    postcss.parse(css).walkRules((rule) => {
      const at = rule.parent?.type === 'atrule' ? `${(rule.parent as postcss.AtRule).name} ${(rule.parent as postcss.AtRule).params}` : ''
      for (const sel of rule.selectors) out.push({ sel: sel.replace(/\s+/g, ' ').trim().replace(/(^|[^:]):(before|after)\b/g, '$1::$2'), body: rule.nodes.map((n) => n.toString().replace(/\s+/g, '')).join(';'), media: at.replace(/\s+/g, '') })
    })
    return out
  }
  const of = (sel: string, media = '') => rules(siteCss()).filter((r) => r.sel === sel && r.media === media).map((r) => r.body).join(';')
  const phone = 'media(max-width:760px)'

  it('opens the hero with the site description on two lines, read from the site config', () => {
    const stand = front().querySelector('.s-top .s-hero > .wrap > p.s-standfirst')!
    const spans = stand.querySelectorAll('span')
    expect(spans).toHaveLength(2)
    expect(spans.map((s) => s.text).join(' ')).toBe(SITE.description)
    expect(stand.text).toBe(SITE.description)
    expect(spans[1].text.startsWith('— ')).toBe(true)
    // 사용자 문구의 사본을 만들지 않는다
    const src = readFileSync('src/pages/index.astro', 'utf8')
    expect(src).not.toContain('얼어붙은')
    expect(src).not.toContain('사고 실험')
  })
  it('sets the lead in the hero — one h1, title in two lines, summary, date and reading time', () => {
    const root = front()
    expect(root.querySelectorAll('h1')).toHaveLength(1)
    expect(root.querySelector('main .lead')).toBeNull()
    const lead = root.querySelector('.s-top .s-hero > .wrap > section.lead')!
    const p = posts().find((x) => x.featured)!
    const a = lead.querySelector('.s-lead-text h1 a')!
    expect(a.getAttribute('href')).toBe(`${BASE}posts/${p.slug}/`)
    expect(a.text).toBe(p.title)
    expect(a.querySelector('.s-tq')).not.toBeNull()
    expect(lead.querySelector('.s-lead-text h1')!.getAttribute('style')).toContain(`view-transition-name:t-${p.slug}`)
    expect(lead.querySelector('.s-lead-text .when')!.text).toBe(p.date.replaceAll('-', '.') + (p.minutes ? ` · 약 ${p.minutes}분` : ''))
    expect(lead.querySelector('.s-scene canvas.s-orb-canvas')).not.toBeNull()
  })
  it('heads every 최근 글 cell with a field band — field name in ink on the pastel face, reading time on the right', () => {
    const root = front()
    const sec = root.querySelector('main > .wrap.front > section.s-sec')!
    expect(sec.querySelector('.s-sec-head h2')!.text).toBe('최근 글')
    const more = sec.querySelector('.s-sec-head a.s-more')!
    expect(more.text).toBe('모든 글 보기 →')
    expect(more.getAttribute('href')).toBe(`${BASE}all/`)
    const rest = posts().filter((x) => !x.featured).slice(0, 6)
    const cells = sec.querySelectorAll('.grid > article.cell')
    expect(cells).toHaveLength(rest.length)
    cells.forEach((cell, i) => {
      const p = rest[i]
      const band = cell.querySelector('p.s-band')!
      expect(band.getAttribute('class'), p.slug).toBe(`s-band s-cat-${p.color}`)
      const cat = band.querySelector('a.s-band-cat')!
      expect(cat.text, p.slug).toBe(p.category)
      expect(cat.getAttribute('href'), p.slug).toBe(`${BASE}category/${p.categorySlug}/`)
      expect(band.querySelector('.s-band-min')!.text, p.slug).toBe(`약 ${p.minutes}분`)
      // 칸 제목은 h3(구역 머리가 h2), 두 줄로 가르되 글자는 원제목 그대로
      const t = cell.querySelector('h3 a')!
      expect(t.text, p.slug).toBe(p.title)
      expect(t.getAttribute('href'), p.slug).toBe(`${BASE}posts/${p.slug}/`)
      expect(cell.querySelector('h3')!.getAttribute('style'), p.slug).toContain(`view-transition-name:t-${p.slug}`)
      expect(cell.querySelector('.sum')!.text, p.slug).toBe(p.description)
      // 날짜는 칸에 넣지 않는다 · 띠 · 제목 · 요약 세 줄(subgrid span 3)
      expect(cell.querySelector('.when'), p.slug).toBeNull()
      expect(cell.childNodes.filter((n) => n.nodeType === 1), p.slug).toHaveLength(3)
    })
    expect(root.querySelector('.cell h2')).toBeNull()
    expect(root.querySelector('main p.all')).toBeNull()
  })
  it('never prints a reading time it does not have', () => {
    const s = html('index.html')
    expect(s).not.toContain('null분')
    expect(s).not.toMatch(/약\s*분/)
    expect(s).not.toContain('undefined')
    // 읽기 시간이 없는 글(픽스처의 대표 글)은 날짜만
    const p = posts().find((x) => x.featured)!
    expect(p.minutes).toBeNull()
    expect(front().querySelector('.lead .when')!.text).toBe(p.date.replaceAll('-', '.'))
  })
  it('indexes the fields under 분야별 with the shared shelf', () => {
    const secs = front().querySelectorAll('main > .wrap.front > section.s-sec')
    expect(secs).toHaveLength(2)
    expect(secs[1].querySelector('.s-sec-head h2')!.text).toBe('분야별')
    expect(secs[1].querySelectorAll('.shelf-grid .shelf')).toHaveLength(activeCategories(posts()).length)
  })
  it('sizes the band as a 32px bar and gives its field name a 44px touch height', () => {
    const band = of('.s-band')
    for (const d of ['display:flex', 'align-items:center', 'justify-content:space-between', 'gap:12px', 'height:32px', 'padding:012px', 'margin:0', 'border-radius:var(--radius-s)', 'background:var(--c)'])
      expect(band, d).toContain(d)
    expect(band).not.toMatch(/border(-top|-bottom)?:|box-shadow/)
    const cat = of('.s-band-cat')
    expect(cat).toMatch(/(^|;)color:var\(--ink\)/)
    expect(cat).toMatch(/padding:13px12px13px0/)
    expect(cat).toMatch(/margin:-13px0/)
    expect(cat).toMatch(/font-weight:700/)
    expect(cat).toMatch(/letter-spacing:\.06em/)
    expect(cat).toMatch(/text-decoration:none/)
    const min = of('.s-band-min')
    expect(min).toMatch(/color:color-mix\(insrgb,var\(--ink\)82%,var\(--c\)\)/)
    expect(min).toMatch(/font-weight:500/)
    expect(min).toMatch(/font-variant-numeric:tabular-nums/)
    // 분야 -ink 색 글자는 띠 안에 쓰지 않는다
    expect(band + cat + min).not.toContain('--c-ink')
  })
  it('lines the cells up on a subgrid with no rule under them, three across, then two, then one', () => {
    const grid = of('.grid')
    expect(grid).toMatch(/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/)
    expect(grid).toMatch(/gap:40pxvar\(--gutter\)/)
    const cell = of('.cell')
    expect(cell).toMatch(/grid-template-rows:subgrid/)
    expect(cell).toMatch(/grid-row:span3/)
    expect(cell).toMatch(/row-gap:0/)
    expect(cell).toMatch(/(^|;)padding:0(;|$)/)
    expect(cell).not.toMatch(/border/)
    expect(rules(siteCss()).filter((r) => /\.cell.*::after/.test(r.sel))).toEqual([])
    expect(of('.grid', 'media(max-width:1023px)')).toMatch(/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
    expect(of('.grid', phone)).toMatch(/grid-template-columns:1fr/)
    expect(of('.cell', phone)).toMatch(/display:block/)
    // 띠 → 제목 16px(휴대폰 14px)은 칸 제목의 위 여백으로
    expect(of('.cell h3')).toMatch(/margin:16px010px/)
    expect(of('.cell h3', phone)).toMatch(/margin:14px08px/)
  })
  it('gives the front page the full dawn, lets the lead carry the text limit, and moves the phone moon down', () => {
    expect(of('.p-front')).toBe('--glow:1')
    expect(of('.p-front', phone)).toBe('--glow:.6')
    expect(of('.p-front .s-hero')).toMatch(/(^|;)padding-bottom:0(;|$)/)
    expect(of('.lead')).toMatch(/padding:var\(--sp-7\)0calc\(262px\*var\(--glow\)\)/)
    expect(of('.lead', phone)).toMatch(/padding:var\(--sp-4\)0calc\(262px\*var\(--glow\)\)/)
    expect(of('.p-front .s-sky-moon', phone)).toBe('top:189px')
    // 휴대폰의 달(반지름 13px)은 틀 내용 오른쪽 끝에서 37px 안쪽까지 온다. 머리기사 제목의 첫 줄이 바로 그 아래라,
    // 한 줄로 꽉 차는 폭(430px)에서는 끝 글자가 달 밑에 붙는다 — 안쪽 페이지 제목처럼 달 앞에서 줄을 바꾼다
    const pad = Number(of('.lead h1 .s-tq', phone).match(/padding-right:(\d+)px/)?.[1])
    expect(pad).toBeGreaterThanOrEqual(44 + 13 - 20 + 8)
    expect(pad).toBeLessThanOrEqual(56)
    // 글이 한 편도 없으면 히어로가 여백을 되찾는다
    expect(of('.p-front .s-hero.s-hero-plain')).toBe('padding-bottom:calc(262px*var(--glow))')
  })
  it('lets the front-page hero take a sideways drag of the sky but leaves vertical scroll and pinch zoom to the browser', () => {
    expect(of('.p-front .s-hero')).toMatch(/(^|;)touch-action:pan-ypinch-zoom(;|$)/)
    // 끌 수 있는 하늘은 1면 히어로뿐 — 다른 히어로·페이지에는 touch-action이 없다(구체 캔버스는 지금 그대로)
    const touch = rules(siteCss()).filter((r) => /touch-action:/.test(r.body)).map((r) => r.sel).sort()
    expect(touch).toEqual(['.p-front .s-hero', '.s-orb-canvas'])
    // 끌기 손잡이는 하늘 스크립트가 data-drag를 보고 붙인다 — 각도·관성·터치 판정은 lib/sky의 시험된 함수로
    const src = readFileSync('src/scripts/sky.ts', 'utf8')
    for (const fn of ['dragAngle', 'coast', 'touchDrags', 'bandR', 'textPress']) expect(src, fn).toContain(fn)
    expect(src).not.toMatch(/classList\.contains\('p-front'\)|body\.className/)
  })
  it('sets the sphere after the text on phones — no reordering, no sun behind', () => {
    const css = siteCss()
    expect(css).not.toMatch(/\.s-scene\{[^}]*order:/)
    expect(rules(css).filter((r) => r.sel.startsWith('.s-scene::before'))).toEqual([])
    expect(of('.s-scene')).toMatch(/margin:00calc\(-196px\*var\(--glow\)\)auto/)
    expect(of('.s-scene', phone)).toMatch(/width:min\(300px,84%\)/)
    expect(of('.s-scene', phone)).toMatch(/margin:-32px-6pxcalc\(-200px\*var\(--glow\)\)auto/)
    // 휴대폰 첫 화면: 요약은 3줄에서 자른다
    expect(of('.lead .sum', phone)).toMatch(/-webkit-line-clamp:3/)
  })
  it('lights the sphere for the night ground', () => {
    expect(of('.s-orb-canvas')).toMatch(/background:radial-gradient\(closest-side,rgba\(200,192,244,\.2\d?\),rgba\(200,192,244,\.07\)62%,transparent74%\)/)
    const src = readFileSync('src/scripts/orb.ts', 'utf8')
    expect(src).toContain("'--s-orb-dot'")
    expect(src).toContain("'--s-orb-word'")
    expect(src).toContain('ORB_SPIN')
    expect(src).not.toMatch(/AUTO_SPIN\s*=\s*0\.0022/)
  })
})

describe('knowledge sphere', () => {
  it('sits in the front-page lead only, hidden from screen readers, with every field', () => {
    const root = parse(html('index.html'))
    const cv = root.querySelectorAll('.lead canvas.s-orb-canvas')
    expect(cv).toHaveLength(1)
    expect(cv[0].getAttribute('aria-hidden')).toBe('true')
    const fields = JSON.parse(cv[0].getAttribute('data-fields')!)
    expect(fields).toHaveLength(7)
    expect(fields.find((f: { slug: string }) => f.slug === 'economy').words).toContain('공정가치')
    for (const f of files.filter((f) => f.endsWith('.html') && !f.endsWith(`${OUT}/index.html`)))
      expect(readFileSync(f, 'utf8')).not.toContain('s-orb')
  })
})

describe('view transitions', () => {
  const css = () => files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(f, 'utf8')).join('\n')
  it('opts in to cross-document transitions and turns them off for reduced motion', () => {
    expect(css()).toMatch(/@view-transition\s*\{\s*navigation:\s*auto/)
    expect(css()).toMatch(/prefers-reduced-motion:\s*reduce\)\s*\{[^}]*@view-transition\s*\{\s*navigation:\s*none/)
  })
  it('names the lead title and the post title alike', () => {
    expect(html('index.html')).toMatch(/view-transition-name:\s*t-sample-econ/)
    // 글 제목은 밤 구역의 h1이고, 이름을 인라인으로 단다(본문 안 h1에 변수로 넘기던 길은 없앴다)
    const h1 = parse(html('posts/sample-econ/index.html')).querySelectorAll('h1')
    expect(h1).toHaveLength(1)
    expect(h1[0].getAttribute('style')).toMatch(/view-transition-name:\s*t-sample-econ/)
    expect(html('posts/sample-econ/index.html')).not.toContain('--s-vt')
    expect(css()).not.toContain('--s-vt')
  })
  it('never repeats a transition name on one page', () => {
    for (const f of files.filter((f) => f.endsWith('.html'))) {
      const names = [...readFileSync(f, 'utf8').matchAll(/(?:view-transition-name|--s-vt):\s*(t-[a-z0-9-]+)/g)].map((m) => m[1])
      expect(new Set(names).size, f).toBe(names.length)
    }
  })
})

describe('reading aids', () => {
  it('builds both tables of contents from the post headings', () => {
    const root = parse(html('posts/sample-econ/index.html'))
    const ids = root.querySelectorAll('.post-body h2').map((h) => h.getAttribute('id'))
    expect(ids).toEqual(['s-1', 's-2'])
    for (const sel of ['nav.s-toc a', '.s-toc-fold nav a'])
      expect(root.querySelectorAll(sel).map((a) => a.getAttribute('href'))).toEqual(['#s-1', '#s-2'])
    expect(root.querySelector('.s-progress')!.getAttribute('style')).toContain('var(--sky-d)')
  })
  it('shows no table of contents for a post with fewer than two headings', () => {
    const root = parse(html('posts/sample-philo/index.html'))
    expect(root.querySelectorAll('.s-toc, .s-toc-fold')).toHaveLength(0)
  })
})

describe('front-page scene', () => {
  // 1면의 캐릭터는 전문성을 해친다는 지적(11/07) — 그림은 소개에만 둔다. 구체는 낱말을 피할 자리 없이 온전히 쓴다.
  it('shows the sphere alone, with no character drawing on the front page', () => {
    const root = parse(html('index.html'))
    expect(root.querySelector('.lead .s-scene canvas.s-orb-canvas')).not.toBeNull()
    expect(root.querySelector('.s-scene canvas.s-orb-canvas')!.getAttribute('data-avoid')).toBeUndefined()
    expect(root.querySelector('.lead img')).toBeNull()
    expect(html('index.html')).not.toMatch(/full-night|full-lead|s-scene-fig|s-fig-live/)
  })
  it('keeps the glow from widening the page on phones', () => {
    expect(siteCss()).toMatch(/\.lead\{[^}]*overflow-x:clip/)
  })
  it('carries no leftover rules or script for the figure', () => {
    expect(siteCss()).not.toMatch(/\.s-scene-fig|\.s-fig-live|\.s-lid|\.s-nodes|\.s-wires|s-breathe|s-blink/)
    expect(readFileSync('src/components/LeadScene.astro', 'utf8')).not.toMatch(/<script|full-night/)
  })
})

describe('post page', () => {
  const posts = () => loadPosts('tests/fixtures/posts')
  const post = (slug: string) => parse(html(`posts/${slug}/index.html`))
  const rules = (css: string) => {
    const out: { sel: string; body: string; media: string }[] = []
    postcss.parse(css).walkRules((rule) => {
      const at = rule.parent?.type === 'atrule' ? `${(rule.parent as postcss.AtRule).name} ${(rule.parent as postcss.AtRule).params}` : ''
      for (const sel of rule.selectors) out.push({ sel: sel.replace(/\s+/g, ' ').trim().replace(/(^|[^:]):(before|after)\b/g, '$1::$2'), body: rule.nodes.map((n) => n.toString().replace(/\s+/g, '')).join(';'), media: at.replace(/\s+/g, '') })
    })
    return out
  }
  const SLUGS = ['sample-econ', 'sample-nodesc', 'sample-philo']

  it('builds all three fixture posts — with and without a corner, with and without a meta line', () => {
    expect(posts().map((p) => p.slug).sort()).toEqual(SLUGS)
    for (const slug of SLUGS) expect(files).toContain(join(OUT, 'posts', slug, 'index.html'))
  })
  it('lifts the title into the night zone as the only h1, and keeps it in the search index', () => {
    for (const p of posts()) {
      const root = post(p.slug)
      const h1 = root.querySelectorAll('h1')
      expect(h1, p.slug).toHaveLength(1)
      expect(root.querySelector('.s-top .s-hero > header.s-post-head > h1'), p.slug).toBe(h1[0])
      expect(h1[0].hasAttribute('data-pagefind-body'), p.slug).toBe(true)
      // 화면에서 두 줄로 갈라도 글자는 원제목 그대로다
      expect(h1[0].textContent.replace(/\s+/g, ' ').trim(), p.slug).toBe(p.title)
      expect(root.querySelector('main h1'), p.slug).toBeNull()
      // 글머리는 652px 글 칸에 맞춘다 — 히어로 안에서 .wrap으로 감싸지 않는다
      expect(root.querySelector('.s-hero .wrap'), p.slug).toBeNull()
    }
    const econ = post('sample-econ').querySelector('h1')!
    expect(econ.querySelector('.s-tq')!.text).toBe('장부의 손실을 읽는 법')
    expect(econ.querySelector('.s-tc')!.text).toBe('— 평가손과 현금')
    expect(econ.classList.contains('s-serif')).toBe(true)
    // ' — '가 없는 제목은 한 줄
    expect(post('sample-philo').querySelector('h1 .s-tc')).toBeNull()
  })
  it('keeps the post head, the body and the post foot on one left edge — safe areas included', () => {
    const all = rules(siteCss())
    // 눕힌 노치 휴대폰에서는 글머리·본문이 안전 영역만큼 들여 선다. 글 끝(글쓴이 · 꼬리표 줄 · 같은 분야 글 · 이전·다음)도 같은 값을 써야 왼쪽 선이 맞는다
    const pad = 'padding-inline:max(20px,env(safe-area-inset-left))max(20px,env(safe-area-inset-right))'
    expect(all.find((r) => r.sel === '.s-post-head' && r.media === '')?.body).toContain(pad)
    expect(all.find((r) => r.sel === '.p-post .wrap-narrow' && r.media === '')?.body).toContain(pad)
    expect(all.find((r) => r.sel === '.s-post .post-body' && r.media === '')?.body).toMatch(/(^|;)padding:36pxmax\(20px,env\(safe-area-inset-right\)\)var\(--sp-6\)max\(20px,env\(safe-area-inset-left\)\)/)
    // 761px 이상에서는 셋 다 652px 칸
    const wide = all.filter((r) => r.media === 'media(min-width:761px)')
    for (const sel of ['.s-post-head', '.p-post .wrap-narrow', '.s-post .post-body']) expect(wide.find((r) => r.sel === sel)?.body, sel).toMatch(/(^|;)max-width:652px/)
  })
  it('keeps the frame clear of a landscape notch at desktop widths too — masthead, hero and footer line', () => {
    // 눕힌 노치 휴대폰(844·932px)은 761px 이상 배치를 쓴다. 틀의 좌우 32px가 안전 영역(47px)보다 좁으면 머리띠·히어로가 노치 밑에 서고,
    // 안전 영역을 따르는 글머리(max(20px, 안전 영역))와 왼쪽 선이 어긋난다
    const wide = rules(siteCss()).filter((r) => r.media === 'media(min-width:761px)')
    expect(wide.find((r) => r.sel === '.wrap')?.body).toMatch(/(^|;)padding-inline:max\(32px,env\(safe-area-inset-left\)\)max\(32px,env\(safe-area-inset-right\)\)(;|$)/)
    expect(wide.find((r) => r.sel === '.footer .f-base')?.body).toMatch(/(^|;)margin-inline:max\(32px,calc\(50%-520px\),env\(safe-area-inset-left\)\)max\(32px,calc\(50%-520px\),env\(safe-area-inset-right\)\)(;|$)/)
  })
  it('breaks the title before the moon instead of running under it', () => {
    const all = rules(siteCss())
    // 휴대폰: 달은 틀 오른쪽 끝에서 37px 안쪽까지 온다(안쪽 페이지 제목·1면 머리기사와 같은 여백)
    expect(all.find((r) => r.sel === '.s-post-head h1' && r.media === 'media(max-width:760px)')?.body).toMatch(/(^|;)padding-right:48px/)
    // 761~1076px: 달(하늘 폭의 80%)이 652px 글 칸의 오른쪽 끝 위에 온다 — 달 왼쪽 10px 앞에서 줄을 바꾸고, 넓어지면 0이 된다
    expect(all.find((r) => r.sel === '.s-post-head h1' && r.media === 'media(min-width:761px)')?.body).toMatch(/(^|;)padding-right:max\(0px,calc\(333px-30vw\)\)/)
    for (const [w, want] of [[761, true], [1024, true], [1109, true], [1110, false], [1440, false]] as const) expect(333 - 0.3 * w > 0, String(w)).toBe(want)
  })
  it('heads the post with the field chip, the corner and the meta line — each only when the post has it', () => {
    for (const p of posts()) {
      const head = post(p.slug).querySelector('header.s-post-head')!
      const chip = head.querySelector('.s-post-k > a.s-chip')!
      expect(chip.text, p.slug).toBe(p.category)
      expect(chip.classList.contains(`s-cat-${p.color}`), p.slug).toBe(true)
      expect(chip.getAttribute('href'), p.slug).toBe(`${BASE}category/${p.categorySlug}/`)
      expect(head.querySelector('.s-post-k > .s-post-kicker')?.text ?? null, p.slug).toBe(p.kicker)
      expect(head.querySelector('.s-post-meta')?.text ?? null, p.slug).toBe(p.metaLine)
      // 글 템플릿의 클래스 이름을 밤 구역에서 다시 쓰지 않는다
      expect(head.querySelector('.kicker, .meta'), p.slug).toBeNull()
    }
    expect(post('sample-econ').querySelector('.s-post-meta')!.text).toBe('2026-11-01 · 약 15분 분량 · 글 반창모')
    expect(post('sample-philo').querySelector('.s-post-kicker')).toBeNull()
    expect(post('sample-nodesc').querySelector('.s-post-meta')).toBeNull()
  })
  it('leaves no title, corner or meta line behind in the body', () => {
    for (const slug of SLUGS) {
      const body = post(slug).querySelector('.post-body')!
      expect(body.querySelector('h1, .kicker, .meta'), slug).toBeNull()
      expect(body.hasAttribute('data-pagefind-body'), slug).toBe(true)
      expect(body.getAttribute('style') ?? '', slug).not.toContain('--s-vt')
    }
    expect(post('sample-econ').querySelector('.post-body')!.text).toContain('이 회사의 적자는 대부분 평가손입니다')
  })
  it('closes the post with the field chip and the corner, then the neighbours with split titles', () => {
    const root = post('sample-philo')
    const tags = root.querySelector('.post-after .tags')!
    expect(tags.querySelector('a.s-chip.s-cat-lav')!.text).toBe('철학의 아름다움')
    const pn = root.querySelectorAll('.post-after nav.pn a')
    expect(pn).toHaveLength(2)
    expect(pn.map((a) => a.querySelector('.s-tq')!.text)).toEqual(['꽃은 번식을 어떻게 설계하는가', '장부의 손실을 읽는 법'])
    expect(pn[1].querySelector('.s-tc')!.text).toBe('— 평가손과 현금')
    // 이전·다음에는 칩도 화면 전환 이름도 주지 않는다
    expect(root.querySelector('.pn .s-chip')).toBeNull()
    expect(root.querySelector('.pn [style*="view-transition-name"]')).toBeNull()
    // 꼬리표 줄 → 이전·다음 순서
    const after = root.querySelector('.post-after')!.toString()
    expect(after.indexOf('class="tags"')).toBeLessThan(after.indexOf('class="pn"'))
  })
  it('lists other posts of the field without chips, under a section head that links to the field', () => {
    const src = readFileSync('src/pages/posts/[slug].astro', 'utf8')
    expect(src).toMatch(/<SecHead title=\{`\$\{post\.category\}의 다른 글`\}/)
    expect(src).toContain('모두 보기 →')
    expect(src).toMatch(/<PostRow post=\{p\} showCat=\{false\} \/>/)
    expect(siteCss()).not.toMatch(/\.more\{/)
  })
  it('hangs the folding contents on a reading bar, with a slot for the section being read', () => {
    const root = post('sample-econ')
    const bar = root.querySelectorAll('.s-readbar')
    expect(bar).toHaveLength(1)
    expect(bar[0].querySelector(':scope > .s-readbar-title')!.getAttribute('aria-hidden')).toBe('true')
    expect(bar[0].querySelector(':scope > details.s-toc-fold > summary')!.text).toBe('목차')
    expect(bar[0].querySelector('details.s-toc-fold > nav')!.getAttribute('aria-label')).toBe('목차')
    // 절이 둘 미만인 글에는 읽기 띠도 없다
    for (const slug of ['sample-philo', 'sample-nodesc']) expect(post(slug).querySelector('.s-readbar'), slug).toBeNull()
  })
  it('shows the side contents from 1320px and the reading bar below it', () => {
    const all = rules(siteCss())
    const wide = all.filter((r) => r.media === 'media(min-width:1320px)')
    expect(wide.find((r) => r.sel === '.s-toc')?.body).toMatch(/(^|;)display:block/)
    expect(wide.find((r) => r.sel === '.s-readbar')?.body).toMatch(/(^|;)display:none/)
    expect(wide.find((r) => r.sel === '.s-post')?.body).toMatch(/grid-template-columns:1frmin\(720px,100%\)1fr/)
    expect(all.filter((r) => /1240px/.test(r.media))).toEqual([])
    const bar = all.filter((r) => r.sel === '.s-readbar' && r.media === '').map((r) => r.body).join(';')
    expect(bar).toMatch(/(^|;)position:fixed/)
    expect(bar).toMatch(/(^|;)height:46px/)
    expect(bar).toMatch(/(^|;)z-index:15/)
    expect(bar).toMatch(/backdrop-filter:blur\(8px\)/)
    // 떠 있던 알약은 없다
    const fold = all.filter((r) => r.sel === '.s-toc-fold' || r.sel === '.s-toc-fold summary').map((r) => r.body).join(';')
    expect(fold).not.toMatch(/border-radius:999px/)
    expect(fold).not.toMatch(/bottom:/)
    // 동작 줄이기에서는 띠가 전환 없이 뜬다
    expect(all.find((r) => r.sel === '.s-readbar' && r.media === 'media(prefers-reduced-motion:reduce)')?.body).toMatch(/transition:none/)
  })
  it('keeps a jumped-to heading clear of the reading bar', () => {
    const all = rules(siteCss())
    expect(all.find((r) => r.sel === '.s-post .post-body [id]' && r.media === 'mediascreenand(max-width:1319px)')?.body).toMatch(/(^|;)scroll-margin-top:64px/)
    expect(all.find((r) => r.sel === '.post-body h2[id]' && r.media === '')?.body).toMatch(/(^|;)scroll-margin-top:24px/)
  })
  it('keeps a footnote number with the word before it', () => {
    const joiner = rules(siteCss()).find((r) => r.sel === '.s-post .post-body sup.fn::before')
    // 폭 없는 붙임표(U+2060) — 최소화가 이스케이프를 글자로 바꿔도 같은 것으로 본다
    expect(joiner?.body).toMatch(/^content:"(\\2060|\u2060)"$/)
  })
  it('lets a phone push a wide diagram sideways on screen only — never in print', () => {
    const all = rules(siteCss())
    const scroll = all.filter((r) => r.sel === '.s-post .post-body .s-fig-scroll' && /overflow-x:auto/.test(r.body))
    expect(scroll).toHaveLength(1)
    expect(scroll[0].media).toBe('mediascreenand(max-width:760px)')
    // 도해 왼쪽 끝이 본문 글줄(20px)에 맞는다
    expect(scroll[0].body).toMatch(/scroll-padding-inline:20px/)
    expect(all.find((r) => r.sel === '.s-post .post-body .s-fig-scroll svg' && r.media === 'mediascreenand(max-width:760px)')?.body).toMatch(/(^|;)width:600px/)
    // 가로 밀기·표 카드는 화면에만: A4 세로 폭(약 673px)이 760px 아래라 인쇄에도 걸린다
    const narrow = all.filter((r) => /\.s-fig-scroll|\[data-prose\]/.test(r.sel) && !r.media.startsWith('mediaprint'))
    expect(narrow.length).toBeGreaterThan(3)
    for (const r of narrow) expect(r.media, r.sel).toBe('mediascreenand(max-width:760px)')
    // 맨 선택자로 쓰지 않는다
    expect(all.filter((r) => /\.s-fig-scroll/.test(r.sel) && !r.sel.startsWith('.s-post .post-body')).map((r) => r.sel)).toEqual([])
  })
  it('turns the footnote into a bottom sheet on touch screens, without forcing a value', () => {
    const all = rules(siteCss())
    const sheet = all.find((r) => r.sel === '.s-note' && r.media === 'media(hover:none)')!
    expect(sheet.body).toMatch(/(^|;)position:fixed/)
    // 바닥에 붙는다(떠 있지 않는다) — 최소화가 left·right·bottom:0, top:auto를 inset 한 줄로 줄인다
    expect(sheet.body).toMatch(/(^|;)inset:auto00(;|$)|(^|;)bottom:0(;|$)/)
    expect(readFileSync('src/styles/site.css', 'utf8')).toMatch(/\.s-note\{position:fixed;left:0;right:0;bottom:0;top:auto;/)
    expect(sheet.body).toMatch(/border-radius:16px16px00/)
    expect(sheet.body).not.toContain('!important')
    // 자리는 CSS가 정한다 — 스크립트는 터치 기기에서 left·top을 넣지 않는다
    const js = readFileSync('src/scripts/footnotes.ts', 'utf8')
    expect(js).toMatch(/hover: none/)
    const note = all.filter((r) => r.sel === '.s-note' && r.media === '').map((r) => r.body).join(';')
    expect(note).toMatch(/(^|;)background:var\(--paper\)/)
    expect(note).toMatch(/(^|;)color:var\(--ink\)/)
  })
  it('prints the post without the sky, the reading bar or the site chrome', () => {
    const all = rules(siteCss()).filter((r) => r.media === 'mediaprint')
    const hidden = all.filter((r) => /display:none/.test(r.body)).map((r) => r.sel)
    for (const sel of ['.s-sky', '.s-readbar', '.s-progress', '.s-toc', '.s-toc-fold', '.pn', '.comments', '.s-note', '.footer', '.s-skip', '.masthead nav']) expect(hidden, sel).toContain(sel)
    expect(all.find((r) => r.sel === '.s-hero')?.body).toMatch(/padding-bottom:16px/)
    // 본문의 인쇄 규칙은 본문 접두를 지킨다
    const body = all.filter((r) => r.sel.startsWith('.s-post .post-body'))
    expect(body.find((r) => r.sel === '.s-post .post-body')?.body).toMatch(/font-size:11pt/)
    expect(body.some((r) => /break-inside:avoid/.test(r.body) && r.sel === '.s-post .post-body figure')).toBe(true)
    expect(siteCss()).toMatch(/@page\s*\{\s*margin:18mm 16mm/)
  })
})

describe('author box', () => {
  it('closes every post with the author, the Notion vision line, credit and a link to 소개', () => {
    for (const slug of ['sample-econ', 'sample-nodesc', 'sample-philo']) {
      const box = parse(html(`posts/${slug}/index.html`)).querySelector('aside.s-author')!
      expect(box.querySelector(`a[href="${BASE}about/"]`)!.text).toBe('반창모')
      expect(box.querySelector('.s-author-bio')!.text).toBe('창의적인 개인이 넘쳐나는 세상을 꿈꿉니다.')
      expect(box.text).toContain('richa 그림')
      expect(box.querySelector('img')!.getAttribute('width')).toBeTruthy()
    }
  })
  it('follows the body, ahead of the tag line and the neighbours, with the comments last', () => {
    const src = readFileSync('src/pages/posts/[slug].astro', 'utf8')
    const at = ['<AuthorBox />', 'post-after', '<Comments '].map((x) => src.indexOf(x))
    expect(at.every((i) => i > -1)).toBe(true)
    expect(at).toEqual([...at].sort((a, b) => a - b))
    // 빌드된 글에서도 본문 → 글쓴이 → 꼬리표 줄 순서다
    const out = html('posts/sample-econ/index.html')
    const order = ['class="post-body"', 'class="s-author"', 'post-after'].map((x) => out.indexOf(x))
    expect(order.every((i) => i > -1)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })
  it('draws the face at 56px', () => {
    const img = parse(html('posts/sample-econ/index.html')).querySelector('.s-author-face img')!
    expect(img.getAttribute('sizes')).toBe('56px')
    expect(img.getAttribute('srcset')).toMatch(/ 56w/)
    expect(img.getAttribute('srcset')).toMatch(/ 112w/)
    expect(img.getAttribute('srcset')).not.toMatch(/ 72w| 144w/)
  })
  it('appears on posts only', () => {
    expect(html('index.html')).not.toContain('s-author')
  })
})

describe('edit mode', () => {
  it('never reaches the published site', () => {
    const leaks = files.filter((f) => /\.(html|js|css)$/.test(f)).filter((f) => /data-edit|__edit|contenteditable|s-edit/.test(readFileSync(f, 'utf8')))
    expect(leaks).toEqual([])
    expect(files.filter((f) => f.startsWith(join(OUT, 'edit')))).toEqual([])
  })
})

describe('share preview', () => {
  const ogImage = (f: string) => parse(readFileSync(f, 'utf8')).querySelector('meta[property="og:image"]')?.getAttribute('content') ?? ''
  it('gives every page an absolute share card with alt text and the large-card hint', () => {
    for (const f of files.filter((f) => f.endsWith('.html'))) {
      const root = parse(readFileSync(f, 'utf8'))
      expect(ogImage(f), f).toMatch(new RegExp(`^https?://[^/]+${BASE}`))
      expect(root.querySelector('meta[property="og:image:alt"]')?.getAttribute('content'), f).toBeTruthy()
      expect(root.querySelector('meta[name="twitter:card"]')?.getAttribute('content'), f).toBe('summary_large_image')
    }
  })
  it('uses the post\'s own card on a post and the site card elsewhere, and emits both', () => {
    expect(ogImage(join(OUT, 'posts/sample-econ/index.html'))).toMatch(new RegExp(`${BASE}posts/sample-econ/card\\.png\\?v=[0-9a-f]{8}$`))
    expect(ogImage(join(OUT, 'index.html'))).toMatch(new RegExp(`${BASE}og-card\\.png$`))
    expect(files).toContain(join(OUT, 'og-card.png'))
    expect(files).toContain(join(OUT, 'posts/sample-econ/card.png'))
  })
  it('changes the post card address when its title changes, so share previews are not stuck on the old card', () => {
    const v = (t: string) => cardVersion({ title: t, category: '경제', color: 'sky' })
    expect(v('가')).not.toBe(v('나'))
    expect(ogImage(join(OUT, 'posts/sample-econ/index.html'))).toContain(`?v=${cardVersion(loadPosts('tests/fixtures/posts').find((p) => p.slug === 'sample-econ')!)}`)
  })
  it('describes the post card by the post title', () => {
    const root = parse(html('posts/sample-econ/index.html'))
    const title = root.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? ''
    expect(root.querySelector('meta[property="og:image:alt"]')?.getAttribute('content')).toContain(title)
  })
})


describe('about page', () => {
  const about = () => parse(html('about/index.html'))
  const rules = (css: string) => {
    const out: { sel: string; body: string; media: string }[] = []
    postcss.parse(css).walkRules((rule) => {
      const at = rule.parent?.type === 'atrule' ? `${(rule.parent as postcss.AtRule).name} ${(rule.parent as postcss.AtRule).params}` : ''
      for (const sel of rule.selectors) out.push({ sel: sel.replace(/\s+/g, ' ').trim(), body: rule.nodes.map((n) => n.toString().replace(/\s+/g, '')).join(';'), media: at.replace(/\s+/g, '') })
    })
    return out
  }
  const of = (sel: string, media = '') => rules(siteCss()).filter((r) => r.sel === sel && r.media === media).map((r) => r.body).join(';')
  const phone = 'media(max-width:760px)'

  it('lifts who the author is onto the night, beside the page title, in place of the Kafka line', () => {
    const root = about()
    const quote = root.querySelector('.s-top .s-hero > .wrap > .about-hero .s-about-quote')!
    expect(quote).not.toBeNull()
    expect(quote.querySelectorAll('p').map((p) => p.text)).toEqual(['교육자, 메이커, 프로그래머, 탐구자, 철학하는 사람'])
    // 밤 위의 글자는 종이용 보조 색(.s-muted)을 달지 않는다
    expect(quote.querySelector('.s-muted')).toBeNull()
    expect(root.querySelectorAll('blockquote')).toHaveLength(0)
    expect(root.text).not.toContain('카프카')
    // 제목과 인용이 한 칸, 그림이 옆 칸
    const cols = root.querySelector('.about-hero')!.childNodes.filter((n) => n.nodeType === 1) as unknown as ReturnType<typeof parse>[]
    expect(cols).toHaveLength(2)
    expect(cols[0].querySelector('header.page-head h1')!.text).toBe('소개')
    expect(cols[0].querySelector('.s-about-quote')).not.toBeNull()
    expect(root.querySelectorAll('h1')).toHaveLength(1)
  })
  it('leaves the sentences on the paper, word for word', () => {
    const text = about().querySelector('main#main > .wrap.about > .about-text')!
    expect(text).not.toBeNull()
    expect(text.querySelectorAll('p').map((p) => p.text)).toEqual([
      '창의적 개인에서 널리 세상을 이롭게 하는 시민으로',
      '창의적인 개인이 넘쳐나는 세상을 꿈꿉니다. 누구나 창작자가 되어 서로 존중하고 소통하는 세상을 만들고자 합니다. 궁극적으로 창작자, 예술가가 가득한 시민 사회는 현대의 많은 사회 문제를 해결하는 교두보가 될 것임을 확신합니다.',
    ])
    // 본문 칸은 머리띠와 같은 왼쪽 선(.wrap) — 가운데 720px 칸이 아니다
    expect(about().querySelector('main .wrap-narrow')).toBeNull()
  })
  it('stands the disc-less figure on the horizon, inside the night', () => {
    const root = about()
    const fig = root.querySelector('.s-top .about-hero > figure.s-about-fig')!
    expect(fig).not.toBeNull()
    expect(root.querySelector('main figure')).toBeNull()
    const img = fig.querySelector('img')!
    expect(img.getAttribute('src')).toContain('full-night')
    expect(img.getAttribute('srcset')).toMatch(/264w/)
    expect(img.getAttribute('srcset')).toMatch(/528w/)
    expect(img.getAttribute('sizes')).toBe('(max-width:760px) 200px, 264px')
    expect(img.getAttribute('alt')).toBe(`${SITE.author} 캐릭터 그림`)
    expect(fig.querySelector('figcaption')!.text).toBe(SITE.artCredit)
    // 종이용 보조 색 클래스가 아니라 이 페이지의 규칙이 색을 정한다
    expect(fig.querySelector('figcaption')!.classNames).not.toContain('s-muted')
  })
  it('keeps the rules that reach into the layout in site.css — glow, hero padding, moon', () => {
    expect(of('.p-about')).toBe('--glow:.9')
    expect(of('.p-about', phone)).toBe('--glow:.6')
    expect(of('.p-about .s-hero')).toBe('padding-bottom:0')
    // 달은 그림 왼쪽 끝에서 88px 왼쪽(1440px → 888, 820px → 436). 휴대폰은 안쪽 페이지 기본 자리 그대로
    expect(of('.p-about .s-sky-moon', 'media(min-width:761px)')).toBe('left:calc(min(100% - 32px,50% + 520px) - 352px);top:160px'.replace(/\s+/g, ''))
    expect(of('.p-about .s-sky-moon')).toBe('')
    expect(of('.p-about .s-sky-moon', phone)).toBe('')
    const src = readFileSync('src/styles/site.css', 'utf8')
    for (const sel of ['.p-about{--glow:.9}', '.p-about .s-hero{padding-bottom:0}', '.p-about .s-sky-moon{']) expect(src, sel).toContain(sel)
    // 이 페이지가 그리는 요소의 규칙은 site.css에 두지 않는다
    expect(src.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/\.about-hero|\.s-about-|\.about-text/)
  })
  it('scopes its own rules to elements it draws — a layout class with the page cid never matches', () => {
    const root = about()
    const cid = Object.keys(root.querySelector('.s-about-quote')!.attributes).find((a) => a.startsWith('data-astro-cid-'))!
    expect(cid).toBeTruthy()
    const mine = rules(siteCss()).filter((r) => r.sel.includes(`[${cid}]`))
    expect(mine.length).toBeGreaterThan(8)
    // Base·NightSky의 요소에는 이 페이지의 cid가 붙지 않는다 — cid가 붙은 채 선택자에 나오면 조용히 안 먹는다
    const layout = /\.(p-about|s-top|s-hero|s-sky|s-sky-moon)\[data-astro-cid-/
    expect(mine.filter((r) => layout.test(r.sel)).map((r) => r.sel)).toEqual([])
    for (const el of root.querySelectorAll('body, .s-top, .s-hero, .s-sky, .s-sky-moon')) expect(el.getAttribute(cid), el.classNames).toBeUndefined()
    // 선택자에 나오는 이 페이지의 클래스는 모두 실제 요소에 있고, 그 요소는 cid를 갖는다
    for (const cls of ['about-hero', 's-about-quote', 's-about-fig', 'about', 'about-text']) {
      expect(mine.some((r) => r.sel.includes(`.${cls}[${cid}]`)), cls).toBe(true)
      expect(root.querySelector(`.${cls}`)!.getAttribute(cid), cls).toBeDefined()
    }
    expect(root.querySelector('.s-about-fig img')!.getAttribute(cid)).toBeDefined()
    const pick = (re: RegExp, media = '') => mine.filter((r) => re.test(r.sel) && r.media === media).map((r) => r.body).join(';')
    // 인용 첫 줄: 명조 500 26px(휴대폰 21px) 흰 글자 / 출처: 고딕 14px 라벤더
    const q = pick(/\.s-about-quote\[[^\]]+\] p\[[^\]]+\]$/)
    expect(q).toMatch(/font-family:var\(--serif\)/)
    expect(q).toMatch(/font-weight:500/)
    expect(q).toMatch(/font-size:26px/)
    expect(q).toMatch(/line-height:1\.5/)
    expect(q).toMatch(/letter-spacing:-\.02em/)
    expect(q).toMatch(/color:var\(--on-night\)/)
    const by = pick(/\.s-about-quote\[[^\]]+\] p\[[^\]]+\]\s*\+\s*p\[[^\]]+\]$/)
    expect(by).toMatch(/font-family:var\(--sans\)/)
    expect(by).toMatch(/font-size:var\(--t-14\)/)
    expect(by).toMatch(/color:var\(--on-night-2\)/)
    expect(pick(/\.s-about-quote\[[^\]]+\] p\[[^\]]+\]:first-child$/, phone)).toMatch(/font-size:21px/)
    const box = pick(/^\.s-about-quote\[[^\]]+\]$/)
    expect(box).toMatch(/max-width:22em/)
    expect(box).toMatch(/margin:var\(--sp-6\)00/)
    expect(box).not.toMatch(/border-left/)
    expect(pick(/^\.s-about-quote\[[^\]]+\]$/, phone)).toMatch(/margin-top:var\(--sp-4\)/)
    // 2열 7fr / 5fr, 아래 맞춤, 글자 한계선 여백은 이 격자가 진다
    const hero = pick(/^\.about-hero\[[^\]]+\]$/)
    expect(hero).toMatch(/grid-template-columns:minmax\(0,7fr\)minmax\(0,5fr\)/)
    expect(hero).toMatch(/gap:var\(--gutter\)/)
    expect(hero).toMatch(/align-items:end/)
    expect(hero).toMatch(/padding-bottom:calc\(262px\*var\(--glow\)\)/)
    expect(pick(/^\.about-hero\[[^\]]+\]$/, phone)).toMatch(/grid-template-columns:1fr/)
    // 그림: 264px(휴대폰 200px), 발이 새벽 띠 위에
    const fig = pick(/^\.s-about-fig\[[^\]]+\]$/)
    expect(fig).toMatch(/width:min\(264px,100%\)/)
    expect(fig).toMatch(/margin:var\(--sp-7\)0calc\(-236px\*var\(--glow\)\)auto/)
    const figPhone = pick(/^\.s-about-fig\[[^\]]+\]$/, phone)
    expect(figPhone).toMatch(/width:200px/)
    expect(figPhone).toMatch(/margin:var\(--sp-4\)0calc\(-236px\*var\(--glow\)\)auto/)
    const cap = pick(/\.s-about-fig\[[^\]]+\] figcaption\[[^\]]+\]$/)
    expect(cap).toMatch(/font-size:var\(--t-12\)/)
    expect(cap).toMatch(/color:var\(--sub\)/)
    // 본문: 글줄 612px, 18px / 1.85(휴대폰 17px), 첫 문장 명조 24px(휴대폰 21px), 마지막 줄 14px 보조 색 + 위 선
    expect(pick(/^\.about-text\[[^\]]+\]$/)).toMatch(/max-width:612px/)
    const para = pick(/\.about-text\[[^\]]+\] p\[[^\]]+\]$/)
    expect(para).toMatch(/font-size:var\(--t-18\)/)
    expect(para).toMatch(/line-height:1\.85/)
    expect(para).toMatch(/margin:20px00/)
    expect(pick(/\.about-text\[[^\]]+\] p\[[^\]]+\]$/, phone)).toMatch(/font-size:17px/)
    const first = pick(/\.about-text\[[^\]]+\]\s*>\s*p\[[^\]]+\]:first-child$/)
    expect(first).toMatch(/font-size:var\(--t-24\)/)
    expect(first).toMatch(/line-height:1\.45/)
    expect(pick(/\.about-text\[[^\]]+\]\s*>\s*p\[[^\]]+\]:first-child$/, phone)).toMatch(/font-size:21px/)
    const last = pick(/\.about-text\[[^\]]+\]\s*>\s*p\[[^\]]+\]:last-child$/)
    expect(last).toMatch(/font-size:var\(--t-14\)/)
    expect(last).toMatch(/color:var\(--sub\)/)
    expect(last).toMatch(/border-top:1pxsolidvar\(--line\)/)
    expect(last).toMatch(/padding-top:16px/)
    expect(last).toMatch(/margin-top:32px/)
    // !important로 누르지 않는다
    expect(mine.filter((r) => r.body.includes('!important'))).toEqual([])
  })
})

describe('drawings in the build', () => {
  it('puts the full drawing and its credit on 소개 without touching the text', () => {
    const root = parse(html('about/index.html'))
    expect(root.querySelector('figure.s-about-fig img')!.getAttribute('alt')).toBe('반창모 캐릭터 그림')
    expect(root.querySelector('figure.s-about-fig figcaption')!.text).toBe('richa 그림')
    expect(root.text).toContain('누구나 창작자가 되어 서로 존중하고 소통하는 세상을 만들고자 합니다.')
    expect(root.text).toContain('교육자, 메이커, 프로그래머, 탐구자, 철학하는 사람')
    expect(root.querySelector('.about-hero')!.text).not.toContain('얼어붙은 바다를 깨뜨리는 도끼')
    expect(root.text).not.toContain('원 자료로 확인한')
  })
  it('emits only the approved drawings, with no metadata', () => {
    const imgs = files.filter((f) => /\.(png|webp|jpe?g|avif)$/.test(f))
    expect(imgs.length).toBeGreaterThan(0)
    for (const f of imgs) {
      expect(f.split('/').pop()).toMatch(/^(face|full|full-lead|full-night|og-card|card)\./)
      expect(metaChunks(readFileSync(f)), f).toEqual([])
    }
  })
})

// 글 검사(post-safety)를 뚫고 코드가 들어와도 브라우저가 실행을 거부하게 하는 두 번째 벽이다.
// GitHub Pages는 응답 헤더를 설정할 수 없어 메타 태그로 건다.
describe('content security policy', () => {
  const pages = () => files.filter((f) => f.endsWith('.html'))
  const policy = (f: string) => parse(readFileSync(f, 'utf8')).querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? ''
  const directive = (csp: string, name: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? ''

  it('is on every page', () => {
    expect(pages().length).toBeGreaterThan(0)
    expect(pages().filter((f) => !policy(f))).toEqual([])
  })
  it('comes before anything the page loads, because it only covers what follows it', () => {
    const late = pages().filter((f) => {
      const head = readFileSync(f, 'utf8')
      const at = head.indexOf('Content-Security-Policy')
      return [/<link\b/, /<script\b/, /<style\b/].some((re) => { const m = head.search(re); return m >= 0 && m < at })
    })
    expect(late).toEqual([])
  })
  it('does not let inline scripts or eval run', () => {
    const script = directive(policy(pages()[0]), 'script-src')
    expect(script).toContain("'self'")
    expect(script).not.toContain("'unsafe-inline'")
    expect(script).not.toMatch(/'unsafe-eval'/)
  })
  it('names only the outside hosts the site really uses', () => {
    const csp = policy(pages()[0])
    // 이 빌드는 댓글 설정이 없다 — 댓글이 켜졌을 때의 허용은 csp.test.ts가 본다
    expect(directive(csp, 'script-src').match(/https:\/\/\S+/g)).toBeNull()
    expect(directive(csp, 'frame-src')).toBe("frame-src 'none'")
    expect(directive(csp, 'connect-src')).toBe("connect-src 'self'")
    expect(csp).not.toMatch(/https:(?!\/\/)|\*/)
  })
  it('shuts the doors that do not need to be open', () => {
    const csp = policy(pages()[0])
    expect(directive(csp, 'default-src')).toBe("default-src 'self'")
    expect(directive(csp, 'object-src')).toBe("object-src 'none'")
    expect(directive(csp, 'base-uri')).toBe("base-uri 'self'")
    expect(directive(csp, 'form-action')).toBe("form-action 'self'")
  })
  it('leaves no inline script for the policy to break', () => {
    const inline = pages().flatMap((f) => parse(readFileSync(f, 'utf8')).querySelectorAll('script').filter((s) => !s.getAttribute('src')).map((s) => `${f}: ${s.innerHTML.slice(0, 50)}`))
    expect(inline).toEqual([])
  })
  it('leaves no inline event handler for the policy to break', () => {
    const handlers = pages().filter((f) => parse(readFileSync(f, 'utf8')).querySelectorAll('*').some((el) => Object.keys(el.attributes).some((a) => a.toLowerCase().startsWith('on'))))
    expect(handlers).toEqual([])
  })
})
