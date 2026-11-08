import { describe, it, expect } from 'vitest'
import { localImages, findCreditProblems } from '../src/lib/images'

// 글에 넣는 그림은 저작권이 끝났거나(퍼블릭 도메인·CC0) 출처를 밝히면 쓸 수 있는(CC BY·CC BY-SA) 것만 쓴다.
// 그래서 그림마다 figure 안 figcaption에 출처 줄(.credit)을 두고, 라이선스 이름과 원 출처 링크를 적는다.
const credited = (lic: string, href = 'https://www.metmuseum.org/art/collection/search/436105') =>
  `<figure><img src="img/a.jpg" alt="그림"><figcaption>설명 <span class="credit">자크루이 다비드, 「소크라테스의 죽음」, 1787, 메트로폴리탄 미술관 · ${lic} · <a href="${href}">출처</a></span></figcaption></figure>`

describe('localImages', () => {
  it('lists the image files a post uses', () => {
    expect(localImages('<p>x</p><figure><img src="img/a.jpg" alt="a"></figure><img src="img/b-2.webp" alt="b">')).toEqual(['a.jpg', 'b-2.webp'])
  })
  it('is empty for a post without images', () => expect(localImages('<p>x</p><svg></svg>')).toEqual([]))
})

describe('findCreditProblems', () => {
  for (const lic of ['퍼블릭 도메인', 'CC0', 'CC BY 4.0', 'CC BY-SA 4.0', 'CC BY-SA 3.0']) {
    it(`accepts a credit line with ${lic}`, () => expect(findCreditProblems(credited(lic))).toEqual([]))
  }
  it('refuses an image outside a figure', () => {
    expect(findCreditProblems('<p><img src="img/a.jpg" alt="a"></p>')).not.toEqual([])
  })
  it('refuses a figure without a credit line', () => {
    expect(findCreditProblems('<figure><img src="img/a.jpg" alt="a"><figcaption>설명만</figcaption></figure>')).not.toEqual([])
  })
  it('refuses a credit line without a licence', () => expect(findCreditProblems(credited('저작권자 허락'))).not.toEqual([]))
  it('refuses licences with non-commercial or no-derivatives terms', () => {
    expect(findCreditProblems(credited('CC BY-NC 4.0'))).not.toEqual([])
    expect(findCreditProblems(credited('CC BY-ND 4.0'))).not.toEqual([])
  })
  it('refuses a credit line without an https source link', () => {
    expect(findCreditProblems(credited('CC0', 'http://example.org'))).not.toEqual([])
  })
  it('leaves svg figures alone', () => expect(findCreditProblems('<figure><svg></svg><figcaption>x</figcaption></figure>')).toEqual([]))
})

import { afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadPosts } from '../src/lib/posts'

describe('a post with images', () => {
  const base = 'tests/fixtures/posts/sample-econ'
  const good = readFileSync(join(base, 'post.html'), 'utf8')
  const meta = readFileSync(join(base, 'meta.json'), 'utf8')
  const fig = credited('CC0')
  let dir = ''
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = '' })

  function postDir(html: string, files: Record<string, number> = {}): string {
    dir = mkdtempSync(join(tmpdir(), 'post-images-'))
    mkdirSync(join(dir, 'pic', 'img'), { recursive: true })
    writeFileSync(join(dir, 'pic', 'post.html'), html)
    writeFileSync(join(dir, 'pic', 'meta.json'), meta)
    for (const [name, size] of Object.entries(files)) writeFileSync(join(dir, 'pic', 'img', name), Buffer.alloc(size))
    return dir
  }

  it('loads when the image file is there and credited', () => {
    const d = postDir(good.replace('</article>', `${fig}</article>`), { 'a.jpg': 1000 })
    expect(loadPosts(d)[0].images).toEqual([join(d, 'pic', 'img', 'a.jpg')])
  })
  it('stops the build when the image file is missing', () => {
    const d = postDir(good.replace('</article>', `${fig}</article>`))
    expect(() => loadPosts(d)).toThrow(/글 "pic".*a\.jpg/)
  })
  it('stops the build when the image is too heavy for phones', () => {
    const d = postDir(good.replace('</article>', `${fig}</article>`), { 'a.jpg': 600 * 1024 })
    expect(() => loadPosts(d)).toThrow(/글 "pic".*a\.jpg/)
  })
  it('stops the build when the credit line is missing', () => {
    const d = postDir(good.replace('</article>', '<figure><img src="img/a.jpg" alt="a"><figcaption>x</figcaption></figure></article>'), { 'a.jpg': 1000 })
    expect(() => loadPosts(d)).toThrow(/글 "pic".*출처/)
  })
  it('makes the author-time check command fail on a missing credit', () => {
    const d = postDir(good.replace('</article>', '<figure><img src="img/a.jpg" alt="a"><figcaption>x</figcaption></figure></article>'), { 'a.jpg': 1000 })
    let code = 0, out = ''
    try {
      out = execFileSync('node_modules/.bin/vite-node', ['tools/check-post-safety.ts', join(d, 'pic', 'post.html')], { encoding: 'utf8', stdio: 'pipe' })
    } catch (e) {
      const err = e as { status: number; stdout: string }
      code = err.status; out = err.stdout
    }
    expect(code).toBe(1)
    expect(out).toContain('출처')
  })
})
