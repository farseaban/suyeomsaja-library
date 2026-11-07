import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import postcss from 'postcss'

// :root에 선언된 토큰을 이름 → 값으로 읽는다(공백은 걷어 낸다)
function rootTokens(file: string): Map<string, string> {
  const out = new Map<string, string>()
  postcss.parse(readFileSync(file, 'utf8')).walkRules(':root', (rule) => {
    rule.walkDecls((d) => { out.set(d.prop, d.value.replace(/\s+/g, ' ').trim()) })
  })
  return out
}

// 선언 값에 박힌 6자리 hex — 투명도를 붙인 8자리도 같은 색이라 함께 잡는다(선택자 안의 것은 보지 않는다)
function hexInCss(css: string): string[] {
  const bad: string[] = []
  postcss.parse(css).walkDecls((d) => {
    if (/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/.test(d.value)) bad.push(`${d.prop}:${d.value}`)
  })
  return bad
}
const hexInValues = (file: string) => hexInCss(readFileSync(file, 'utf8'))

const t = rootTokens('src/styles/tokens.css')

describe('design tokens', () => {
  it('adds the night colour and keeps the paper palette', () => {
    expect(t.get('--night')).toBe('#212029')
    expect(t.get('--ink')).toBe('#33313F')
    expect(t.get('--line')).toBe('#E4E0DA')
    expect(t.get('--line-strong')).toBe('#8C877F')
    expect(t.get('--paper')).toBe('#FFFFFF')
    expect(t.get('--card')).toBe('#FBF9F6')
    expect(t.get('--butter-tint')).toBe('#FFF8E0')
  })
  it('darkens the secondary text and aliases it for the post body', () => {
    expect(t.get('--sub')).toBe('#5C5969')
    expect(t.get('--sub-2')).toBe('#6E6B7B')
    // 값이 아니라 참조여야 한다 — hex를 두 번 적지 않는다
    expect(t.get('--s-sub')).toBe('var(--sub)')
  })
  it('keeps the six pastel faces and their line colours as they were', () => {
    const face = { lav: '#D9D3F7', mint: '#CDEBDD', peach: '#FBD9C6', sky: '#CFE3F6', butter: '#F8E8B0', rose: '#F6CCD8' }
    const line = { lav: '#7466C2', mint: '#3F8F6E', peach: '#C06A45', sky: '#3E7DB0', butter: '#A9861F', rose: '#B24E6E' }
    for (const [k, v] of Object.entries(face)) expect(t.get(`--${k}`), k).toBe(v)
    for (const [k, v] of Object.entries(line)) expect(t.get(`--${k}-d`), k).toBe(v)
  })
  it('gives every field colour an ink for text on paper', () => {
    const ink = { lav: '#5F50A9', mint: '#1D7253', peach: '#9D4B25', sky: '#28689A', butter: '#846200', rose: '#9C3A5C' }
    for (const [k, v] of Object.entries(ink)) expect(t.get(`--${k}-ink`), k).toBe(v)
  })
  it('has three steps of text on night', () => {
    expect(t.get('--on-night')).toBe('#FFFFFF')
    expect(t.get('--on-night-2')).toBe('#D9D3F7')
    expect(t.get('--on-night-3')).toBe('#B9B4D0')
  })
  it('names the sphere colours for the night ground', () => {
    expect(t.get('--s-orb-dot')).toBe('#DCD6FF')
    expect(t.get('--s-orb-word')).toBe('#FFFFFF')
  })
  it('sets the dawn and accent defaults, and the glow scale', () => {
    expect(t.get('--s-dawn')).toBe('var(--peach)')
    expect(t.get('--s-accent')).toBe('var(--lav-d)')
    expect(t.get('--s-accent-ink')).toBe('var(--lav-ink)')
    expect(t.get('--s-accent-tint')).toBe('var(--lav)')
    expect(t.get('--glow')).toBe('.64')
    expect(t.get('color-scheme')).toBe('only light')
  })
  it('has the nine type sizes, nine spacings, the gutter and two radii', () => {
    for (const n of [12, 13, 14, 16, 18, 21, 24, 36, 46]) expect(t.get(`--t-${n}`), `--t-${n}`).toBe(`${n}px`)
    const sp = [4, 8, 12, 16, 24, 32, 48, 64, 96]
    sp.forEach((v, i) => expect(t.get(`--sp-${i + 1}`), `--sp-${i + 1}`).toBe(`${v}px`))
    expect(t.get('--gutter')).toBe('32px')
    expect(t.get('--radius')).toBe('12px')
    expect(t.get('--radius-s')).toBe('4px')
  })
  it('leads the sans stack with the variable face and keeps the serif', () => {
    expect(t.get('--sans')).toMatch(/^'Pretendard Variable'\s*,\s*'Pretendard'\s*,/)
    expect(t.get('--serif')).toBe("'Noto Serif KR', Georgia, serif")
  })
  it('does not carry over the unused mock tokens', () => {
    for (const k of ['--peach-tint', '--sky-tint', '--mist', '--mist-d', '--card-2']) expect(t.has(k), k).toBe(false)
  })
})

describe('colours live in tokens.css only', () => {
  // 검사기 자체를 먼저 시험한다 — 잡아야 할 것을 못 잡으면 아래 검사는 늘 통과한다
  it('the detector flags a hex colour in a value (with or without alpha) and nothing else', () => {
    expect(hexInCss('a{color:#33313F}')).toEqual(['color:#33313F'])
    expect(hexInCss('a{background:linear-gradient(#fbd9c6,transparent)}')).toHaveLength(1)
    expect(hexInCss('a{color:#33313F24}'), '투명도를 붙인 8자리').toHaveLength(1)
    expect(hexInCss('#abcdef{color:var(--ink)}'), '선택자 안의 hex').toEqual([])
    expect(hexInCss('a{mask-image:linear-gradient(to right,transparent 0,#000 28px)}'), '마스크의 3자리').toEqual([])
    expect(hexInCss('a{color:var(--ink);box-shadow:0 8px 24px rgba(51,49,63,.14)}')).toEqual([])
  })
  it.each(['src/styles/site.css', 'src/styles/post.css'])('%s has no 6-digit hex in a declaration value', (file) => {
    expect(hexInValues(file)).toEqual([])
  })
  // 소개 페이지의 scoped 블록도 토큰만 쓴다
  it('src/pages/about.astro keeps hex out of its scoped style block too', () => {
    const blocks = [...readFileSync('src/pages/about.astro', 'utf8').matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1])
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toContain('.about-hero')
    expect(hexInCss(blocks[0])).toEqual([])
  })
})

describe('post body overrides', () => {
  const css = () => postcss.parse(readFileSync('src/styles/post.css', 'utf8'))
  it('puts the secondary text colour back through the alias — never a self reference, never a hex', () => {
    const subs: string[] = []
    css().walkDecls('--sub', (d) => { subs.push(`${(d.parent as postcss.Rule).selector}{${d.value.replace(/\s+/g, '')}}`) })
    expect(subs).toEqual(['.s-post .post-body{var(--s-sub)}'])
  })
  it('sets the body on the site sans stack without redefining the stack', () => {
    const decls: string[] = []
    css().walkRules((r) => { if (r.selector === '.s-post .post-body') r.walkDecls((d) => { decls.push(d.prop) }) })
    expect(decls).toContain('font-family')
    expect(decls).not.toContain('--sans')
  })
  it('starts every rule with .s-post .post-body and never forces a value', () => {
    const bad: string[] = []
    css().walkRules((r) => {
      if (r.parent?.type === 'atrule' && /keyframes$/.test((r.parent as postcss.AtRule).name)) return
      for (const sel of r.selectors) if (!sel.trim().startsWith('.s-post .post-body')) bad.push(sel.trim())
    })
    expect(bad).toEqual([])
    const forced: string[] = []
    css().walkDecls((d) => { if (d.important) forced.push(`${d.prop}:${d.value}`) })
    expect(forced).toEqual([])
  })
})

describe('sphere canvas font', () => {
  const src = readFileSync('src/scripts/orb.ts', 'utf8')
  it('draws with the variable face first', () => {
    const fonts = [...src.matchAll(/const (WORD|TAG) = '([^']+)'/g)]
    expect(fonts.map((m) => m[1])).toEqual(['WORD', 'TAG'])
    for (const m of fonts) expect(m[2], m[1]).toMatch(/px "Pretendard Variable", Pretendard, "Noto Sans KR", sans-serif$/)
  })
  it('asks the dynamic subset for every word it draws, not a two-letter sample', () => {
    expect(src).not.toMatch(/fonts\?\.load\(WORD, '개념'\)/)
    expect(src).toMatch(/fonts\?\.load\(WORD, [A-Za-z_]\w*\)/)
  })
})
