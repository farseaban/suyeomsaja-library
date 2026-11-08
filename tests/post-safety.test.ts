import { describe, it, expect, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findUnsafe } from '../src/lib/post-safety'
import { extractPost } from '../src/lib/extract'
import { loadPosts } from '../src/lib/posts'

describe('post body: what must be refused', () => {
  const hostile: [string, string][] = [
    ['script tag', '<script>alert(1)</script>'],
    ['script tag in capitals', '<SCRIPT>alert(1)</SCRIPT>'],
    ['stray closing script tag', '</script>'],
    ['iframe', '<iframe src="https://evil.example"></iframe>'],
    ['object', '<object data="https://evil.example"></object>'],
    ['embed', '<embed src="https://evil.example">'],
    ['base', '<base href="https://evil.example/">'],
    ['link', '<link rel="stylesheet" href="https://evil.example/x.css">'],
    ['meta refresh', '<meta http-equiv="refresh" content="0;url=https://evil.example">'],
    ['form', '<form action="https://evil.example"><input name="pw"></form>'],
    ['style tag in the body', '<style>p{color:red}</style>'],
    ['image, which would call out to a third party', '<img src="https://evil.example/x.png">'],
    ['event handler', '<p onclick="alert(1)">x</p>'],
    ['event handler in capitals', '<p ONCLICK="alert(1)">x</p>'],
    ['event handler on svg', '<svg onload="alert(1)"></svg>'],
    ['event handler after a slash', '<p/onclick="alert(1)">x</p>'],
    ['event handler glued to a quote', '<p class="a"onclick="alert(1)">x</p>'],
    ['event handler without quotes', '<p onclick=alert(1)>x</p>'],
    ['event handler after a quoted >', '<p title=">" onclick="alert(1)">x</p>'],
    ['tag that never closes', '<p onclick="alert(1)'],
    ['tag hidden inside pre', '<pre><svg onload="alert(1)"></svg></pre>'],
    ['script behind a tricky comment', '<!--><script>alert(1)</script>-->'],
    ['processing instruction', '<?php echo 1 ?>'],
    ['javascript link', '<a href="javascript:alert(1)">x</a>'],
    ['javascript link in capitals', '<a href="JaVaScRiPt:alert(1)">x</a>'],
    ['javascript link with a tab inside', '<a href="java\tscript:alert(1)">x</a>'],
    ['javascript link with leading space', '<a href="  javascript:alert(1)">x</a>'],
    ['javascript link in decimal entities', '<a href="&#106;avascript:alert(1)">x</a>'],
    ['javascript link in hex entities', '<a href="&#x6A;avascript:alert(1)">x</a>'],
    ['javascript link with a named colon', '<a href="javascript&colon;alert(1)">x</a>'],
    ['javascript link in an unquoted value', '<a href=javascript:alert(1)>x</a>'],
    ['vbscript link', '<a href="vbscript:x">x</a>'],
    ['data link', '<a href="data:text/html,<script>alert(1)</script>">x</a>'],
    ['xlink javascript', '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>'],
    ['svg animate swapping a link', '<svg><a><animate attributeName="href" to="javascript:alert(1)"/></a></svg>'],
    ['svg set swapping a link', '<svg><a><set attributeName="href" to="javascript:alert(1)"/></a></svg>'],
    ['svg foreignObject', '<svg><foreignObject><div></div></foreignObject></svg>'],
    ['svg use pulling a remote file', '<svg><use href="https://evil.example/x.svg#a"/></svg>'],
    ['svg image', '<svg><image href="https://evil.example/x.png"/></svg>'],
    ['style attribute calling out', '<p style="background:url(https://evil.example/x)">x</p>'],
    ['style attribute with entities hiding url(', '<p style="background:&#117;rl(https://evil.example/x)">x</p>'],
    ['srcdoc attribute', '<div srcdoc="&lt;script&gt;"></div>'],
    ['formaction attribute', '<div formaction="https://evil.example"></div>'],
    ['image from a protocol-relative address', '<img src="//evil.example/x.png" alt="x">'],
    ['image climbing out of its folder', '<img src="img/../../x.png" alt="x">'],
    ['image outside the img folder', '<img src="x.png" alt="x">'],
    ['image from a data address', '<img src="data:image/png;base64,AAAA" alt="x">'],
    ['image with srcset, which can call out', '<img src="img/a.jpg" srcset="https://evil.example/x.png 2x" alt="x">'],
    ['image without alt text', '<img src="img/a.jpg">'],
    ['image with empty alt text', '<img src="img/a.jpg" alt="">'],
    ['image of an unknown type', '<img src="img/a.svg" alt="x">'],
  ]
  for (const [name, html] of hostile) {
    it(`refuses ${name}`, () => {
      expect(findUnsafe(html, '')).not.toEqual([])
    })
  }
})

describe('post css: what must be refused', () => {
  const hostile: [string, string][] = [
    ['closing the style tag', 'p{color:red}</style><script>alert(1)</script>'],
    ['remote import', '@import url(https://evil.example/x.css);'],
    ['import in capitals', '@IMPORT "https://evil.example/x.css";'],
    ['remote background', 'p{background:url(https://evil.example/x)}'],
    ['remote font', '@font-face{font-family:x;src:url(https://evil.example/x.woff)}'],
    ['css escape hiding url(', 'p{background:\\75rl(https://evil.example/x)}'],
    ['css escape hiding @import', '@\\69mport "https://evil.example/x.css";'],
    ['old IE expression', 'p{width:expression(alert(1))}'],
    ['javascript in css', 'p{background:javascript:alert(1)}'],
  ]
  for (const [name, css] of hostile) {
    it(`refuses ${name}`, () => {
      expect(findUnsafe('', css)).not.toEqual([])
    })
  }
})

describe('post body and css: what must pass', () => {
  const fine: [string, string][] = [
    ['plain paragraph', '<p class="x" id="y">글자</p>'],
    ['the word onclick= in the text', '<p>버튼에 onclick= 을 달면 됩니다</p>'],
    ['the word onclick= in an attribute value', '<p title="a onclick=b">x</p>'],
    ['escaped tags in the text', '<p>&lt;script&gt;는 위험합니다</p>'],
    ['a less-than sign in the text', '<p>a < b, 그리고 1<2</p>'],
    ['an attribute starting with on but not a handler', '<svg><path d="M0 0" orient="auto"/></svg>'],
    ['https link', '<a href="https://example.org/a?b=javascript:c">x</a>'],
    ['http link', '<a href="http://www.papert.org/a.html">x</a>'],
    ['footnote link', '<sup class="fn"><a id="cite-1" href="#ref-1">[1]</a></sup>'],
    ['relative link', '<a href="../other/">x</a>'],
    ['mail link', '<a href="mailto:a@example.org">x</a>'],
    ['svg figure', '<figure><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" role="img" aria-labelledby="a"><title id="a">t</title><desc>d</desc><defs><marker id="m" orient="auto"><path d="M0 0"/></marker></defs><g><rect width="1" height="1" fill="#FFF"/><text x="1" y="1">글<tspan>자</tspan></text></g></svg><figcaption>캡션</figcaption></figure>'],
    ['local image in the post folder', '<figure><img src="img/socrates-death.jpg" alt="그림" width="1200" height="800" loading="lazy" decoding="async"><figcaption>캡션</figcaption></figure>'],
    ['table', '<table><thead><tr><th>a</th></tr></thead><tbody><tr><td>b</td></tr></tbody></table>'],
  ]
  for (const [name, html] of fine) {
    it(`accepts ${name}`, () => {
      expect(findUnsafe(html, '')).toEqual([])
    })
  }
  it('accepts ordinary css', () => {
    expect(findUnsafe('', ':root{--ink:#33313F} p{margin:0} @media (max-width:520px){h1{font-size:25px}} .q::before{content:"—"}')).toEqual([])
  })
})

describe('every real post', () => {
  it('passes the check', () => {
    const hits = loadPosts('posts').flatMap((p) => findUnsafe(p.articleHtml, p.css).map((h) => `${p.slug}: ${h}`))
    expect(hits).toEqual([])
  })
})

describe('a hostile post cannot get through', () => {
  const base = 'tests/fixtures/posts/sample-econ'
  const good = readFileSync(join(base, 'post.html'), 'utf8')
  const meta = readFileSync(join(base, 'meta.json'), 'utf8')
  let dir = ''
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = '' })

  function postDir(html: string): string {
    dir = mkdtempSync(join(tmpdir(), 'post-safety-'))
    mkdirSync(join(dir, 'evil'))
    writeFileSync(join(dir, 'evil', 'post.html'), html)
    writeFileSync(join(dir, 'evil', 'meta.json'), meta)
    return dir
  }

  it('the fixture itself is clean, so the failures below prove the check', () => {
    const { articleHtml, css } = extractPost(good)
    expect(findUnsafe(articleHtml, css)).toEqual([])
  })
  it('stops the build when the body has a script', () => {
    const d = postDir(good.replace('</article>', '<script>alert(1)</script></article>'))
    expect(() => loadPosts(d)).toThrow(/글 "evil".*안전/)
  })
  it('stops the build when a handler hides inside pre, which the html parser reads as text', () => {
    const d = postDir(good.replace('</article>', '<pre><svg onload="alert(1)"></svg></pre></article>'))
    expect(() => loadPosts(d)).toThrow(/글 "evil".*안전/)
  })
  it('stops the build when the head css calls out', () => {
    const d = postDir(good.replace('<style>', '<style>@import url(https://evil.example/x.css);'))
    expect(() => loadPosts(d)).toThrow(/글 "evil".*안전/)
  })
  it('makes the author-time check command fail with the reason', () => {
    const d = postDir(good.replace('</article>', '<script>alert(1)</script></article>'))
    let out = '', code = 0
    try {
      out = execFileSync('node_modules/.bin/vite-node', ['tools/check-post-safety.ts', join(d, 'evil', 'post.html')], { encoding: 'utf8', stdio: 'pipe' })
    } catch (e) {
      const err = e as { status: number; stdout: string }
      code = err.status; out = err.stdout
    }
    expect(code).toBe(1)
    expect(out).toContain('script')
  })
  it('lets the author-time check command pass a clean post', () => {
    const out = execFileSync('node_modules/.bin/vite-node', ['tools/check-post-safety.ts', join(base, 'post.html')], { encoding: 'utf8' })
    expect(out).toContain('안전')
  })
})
