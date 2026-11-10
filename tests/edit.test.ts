import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'node-html-parser'
import { markBlocks, applyEdit, readBlock, fileVersion, toggleQuote, insertParagraph } from '../src/lib/edit'
import { extractPost } from '../src/lib/extract'
import { addHeadingIds } from '../src/lib/toc'

const DOC = `<!doctype html>
<html><head><style>p{color:red}</style></head><body>
<!-- 스킬 주석 -->
<article>
<div class="kicker">코너</div>
<h1>제목</h1>
<p>첫 문단 <strong>굵게</strong>와 각주<sup><a href="#fn1">1</a></sup>.</p>
<ul><li>항목 하나</li><li><p>문단 든 항목</p></li></ul>
<figure><svg><text>도해 글자</text></svg><figcaption>그림 설명</figcaption></figure>
<h2>둘째 절</h2>
<p>마지막 문단</p>
</article>
</body></html>`
const article = DOC.slice(DOC.indexOf('<article>') + 9, DOC.indexOf('</article>'))

describe('markBlocks', () => {
  it('numbers text blocks in source order, innermost only, never inside svg', () => {
    const marked = markBlocks(article)
    const got = [...marked.matchAll(/<(\w+)[^>]*data-edit="(\d+)"[^>]*>([^<]*)/g)].map((m) => `${m[2]}:${m[1]}:${m[3]}`)
    expect(got).toEqual(['0:h1:제목', '1:p:첫 문단 ', '2:li:항목 하나', '3:p:문단 든 항목', '4:figcaption:그림 설명', '5:h2:둘째 절', '6:p:마지막 문단'])
  })
})

describe('applyEdit', () => {
  it('changes only the inside of that block and leaves every other byte alone', () => {
    const out = applyEdit(DOC, 6, '마지막 문단', '고친 마지막 문단')
    expect(out).toBe(DOC.replace('<p>마지막 문단</p>', '<p>고친 마지막 문단</p>'))
  })
  it('keeps inline markup the browser sends back', () => {
    const out = applyEdit(DOC, 1, '첫 문단 굵게와 각주1.', '첫 문단 <strong>굵게</strong>와 각주<sup><a href="#fn1">1</a></sup>!')
    expect(out).toContain('<p>첫 문단 <strong>굵게</strong>와 각주<sup><a href="#fn1">1</a></sup>!</p>')
    expect(out).toContain('<!-- 스킬 주석 -->')
  })
  it('refuses when the file no longer holds the text the page showed', () => {
    expect(() => applyEdit(DOC, 6, '다른 글자', '새 글자')).toThrow(/바뀌었/)
  })
  it('refuses an index past the last block', () => {
    expect(() => applyEdit(DOC, 99, '', 'x')).toThrow(/없/)
  })
  it('turns browser no-break spaces and a trailing <br> back into plain text', () => {
    const out = applyEdit(DOC, 6, '마지막 문단', '마지막&nbsp;문단 끝<br>')
    expect(out).toContain('<p>마지막 문단 끝</p>')
  })
  it('refuses anything that would run code on the published page', () => {
    for (const bad of ['<script>x()</script>', '<img src=x onerror="x()">', '<a href="javascript:x()">링크</a>', '<iframe src="//x"></iframe>'])
      expect(() => applyEdit(DOC, 6, '마지막 문단', `마지막 ${bad}`), bad).toThrow(/글자만/)
  })
  it('refuses to split a block into new paragraphs', () => {
    expect(() => applyEdit(DOC, 6, '마지막 문단', '하나<div>둘</div>')).toThrow(/글자만/)
  })
  it('refuses a block whose closing tag is left out, instead of spilling past it', () => {
    const doc = '<article><h1>t</h1><ul><li>a<li>b</ul></article>'
    expect(() => applyEdit(doc, 1, 'a', 'A')).toThrow(/닫는/)
    expect(() => applyEdit('<article><h1>t</h1><p>one<p>two</p></article>', 1, 'one', 'ONE')).toThrow(/닫는/)
  })
  it('finds the end of an opening tag even when an attribute holds >', () => {
    const doc = '<article><h1>t</h1><p title="a>b">hi</p></article>'
    expect(applyEdit(doc, 1, 'hi', 'HI')).toBe('<article><h1>t</h1><p title="a>b">HI</p></article>')
  })
  it('lets only the words change — no new, removed or re-attributed markup', () => {
    for (const bad of ['<a href="&#106;avascript:x()">각주</a>', '<form action="//x">a</form>', '<base href="//x">', '<svg><a href="x">a</a></svg>', '마지막 <font>문단</font>'])
      expect(() => applyEdit(DOC, 6, '마지막 문단', bad), bad).toThrow(/글자만/)
    expect(() => applyEdit(DOC, 1, '첫 문단 굵게와 각주1.', '첫 문단 <strong>굵게</strong>와 각주<sup><a href="javascript:x()">1</a></sup>.')).toThrow(/글자만/)
    // 굵게는 빼도 된다(11/10) — 각주·링크는 여전히 못 뺀다
    expect(applyEdit(DOC, 1, '첫 문단 굵게와 각주1.', '첫 문단 굵게와 각주<sup><a href="#fn1">1</a></sup>.')).toContain('<p>첫 문단 굵게와 각주<sup>')
    expect(() => applyEdit(DOC, 1, '첫 문단 굵게와 각주1.', '첫 문단 <strong>굵게</strong>와 각주1.')).toThrow(/글자만/)
  })
  it('accepts ordinary prose that merely looks like code', () => {
    expect(applyEdit(DOC, 6, '마지막 문단', 'javascript: 언어의 역사, onclick = 누름')).toContain('<p>javascript: 언어의 역사, onclick = 누름</p>')
  })
  it('leaves a block that holds a diagram out of editing', () => {
    const doc = '<article><h1>t</h1><p>글 <svg><text>도해</text></svg></p></article>'
    expect(markBlocks(doc)).not.toContain('data-edit="1"')
    expect(() => applyEdit(doc, 1, '글 도해', '글 도해')).toThrow(/없/)
  })
})


// 사용자 11/10: 노란 상자도 고치고, 굵게·밑줄을 넣고 빼고, 인용으로 바꾸고, 다 지운 문단은 칸째 뺀다
describe('editing beyond words (11/10)', () => {
  const D = `<article>
<h1>t</h1>
<p>하나</p>
<div class="key">노란 상자 <strong>굵게</strong></div>
<div class="meta">날짜</div>
<blockquote class="quote"><p>인용 문단</p></blockquote>
<blockquote class="quote"><p>출처 있는 인용</p><cite>누구</cite></blockquote>
<p>마지막</p>
</article>`
  it('counts the yellow and caution boxes as blocks, but not the meta line', () => {
    const got = [...markBlocks(D).matchAll(/<(\w+)[^>]*data-edit="(\d+)"/g)].map((m) => m[1])
    expect(got).toEqual(['h1', 'p', 'div', 'p', 'p', 'p'])
    expect(applyEdit(D, 2, '노란 상자 굵게', '고친 상자 <strong>굵게</strong>')).toContain('<div class="key">고친 상자 <strong>굵게</strong></div>')
  })
  it('lets bold, italic and underline come and go', () => {
    expect(applyEdit(D, 1, '하나', '<strong>하</strong>나')).toContain('<p><strong>하</strong>나</p>')
    expect(applyEdit(D, 1, '하나', '<em>하</em><u>나</u>')).toContain('<p><em>하</em><u>나</u></p>')
    expect(applyEdit(D, 2, '노란 상자 굵게', '노란 상자 굵게')).toContain('<div class="key">노란 상자 굵게</div>')
  })
  it('still refuses formatting that carries attributes', () => {
    for (const bad of ['<b style="x">하</b>나', '<u onclick="x()">하</u>나', '<strong class="x">하</strong>나'])
      expect(() => applyEdit(D, 1, '하나', bad), bad).toThrow(/글자만/)
  })
  it('removes an emptied paragraph outright, with the quote that held only it', () => {
    expect(applyEdit(D, 1, '하나', '')).toBe(D.replace('<p>하나</p>\n', ''))
    expect(applyEdit(D, 3, '인용 문단', '<br>')).toBe(D.replace('<blockquote class="quote"><p>인용 문단</p></blockquote>\n', ''))
    expect(applyEdit(D, 2, '노란 상자 굵게', '')).not.toContain('class="key"')
    expect(() => applyEdit(D, 0, 't', '')).toThrow(/제목/)
  })
  it('inserts a new paragraph after the chosen block, or after the box, quote or figure that holds it', () => {
    const a = insertParagraph(D, 1, '하나')
    expect(a.html).toContain('<p>하나</p>\n<p>(새 문단)</p>')
    expect(a.index).toBe(2)
    const b = insertParagraph(D, 3, '인용 문단')
    expect(b.html).toContain('<blockquote class="quote"><p>인용 문단</p></blockquote>\n<p>(새 문단)</p>')
    expect(b.index).toBe(4)
    expect(insertParagraph(D, 2, '노란 상자 굵게').html).toContain('</div>\n<p>(새 문단)</p>\n<div class="meta">')
  })
  it('refuses markup or an empty text in a new paragraph, and a spot after the title', () => {
    expect(() => insertParagraph(D, 1, '하나', '<a href="x">링크</a>')).toThrow(/글자만/)
    expect(() => insertParagraph(D, 1, '하나', '<br>')).toThrow(/글자만/)
    expect(() => insertParagraph(D, 0, 't')).toThrow(/제목/)
    expect(insertParagraph(D, 1, '하나', '새 <strong>굵은</strong> 문단').html).toContain('<p>새 <strong>굵은</strong> 문단</p>')
  })
  it('wraps a paragraph in a quote and unwraps a bare quote, but not one with a source line', () => {
    expect(toggleQuote(D, 1, '하나')).toContain('<blockquote class="quote"><p>하나</p></blockquote>')
    expect(toggleQuote(D, 3, '인용 문단')).toContain('\n<p>인용 문단</p>\n')
    expect(() => toggleQuote(D, 4, '출처 있는 인용')).toThrow(/출처/)
    expect(() => toggleQuote(D, 2, '노란 상자 굵게')).toThrow(/문단만/)
  })
})

describe('fileVersion', () => {
  it('changes whenever any byte of the file changes', () => {
    expect(fileVersion(DOC)).toBe(fileVersion(DOC))
    expect(fileVersion(DOC)).not.toBe(fileVersion(DOC.replace('<strong>', '<em>').replace('</strong>', '</em>')))
  })
})

describe('real posts', () => {
  const dirs = ['posts', 'tests/fixtures/posts']
  const files = dirs.flatMap((d) => readdirSync(d).filter((s) => !s.startsWith('.')).map((s) => join(d, s, 'post.html')))
  it.each(files)('%s — 화면의 n번째 덩어리가 파일의 n번째이고, 그대로 저장하면 한 바이트도 안 바뀐다', (f) => {
    const doc = readFileSync(f, 'utf8')
    const shown = parse(markBlocks(addHeadingIds(extractPost(doc).articleHtml).html)).querySelectorAll('[data-edit]')
    expect(shown.length).toBeGreaterThan(0)
    shown.forEach((el, i) => {
      expect(el.getAttribute('data-edit')).toBe(String(i))
      const src = readBlock(doc, i)
      expect(src.text).toBe(el.textContent.replace(/\s+/g, ' ').trim())
      expect(applyEdit(doc, i, el.textContent, src.inner)).toBe(doc)
    })
  })
})

// (지킴이) 편집 화면은 지금 파이프라인 그대로다 — 공개 글 페이지의 표현 변환(글머리 떼기·도해 감싸개·표 표시)을 쓰지 않는다.
// 쓰면 화면의 n번째 덩어리와 파일의 n번째 덩어리가 어긋난다
describe('edit page pipeline', () => {
  it('never runs the presentation transform', () => {
    const src = readFileSync('src/pages/edit/[slug].astro', 'utf8')
    expect(src).not.toMatch(/present/i)
    expect(src).toContain('markBlocks(addHeadingIds(post.articleHtml).html)')
  })
})
