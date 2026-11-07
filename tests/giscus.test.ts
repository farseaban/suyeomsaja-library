import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { giscusThread } from '../src/config/giscus'

// 도메인을 옮기면 페이지 주소가 바뀐다. 댓글을 글 이름에 묶어 두어야 옮긴 뒤에도 그 글에 남는다.
describe('comment thread of a post', () => {
  it('is tied to the post name, not the page address', () => {
    expect(giscusThread('habit-21-days')).toEqual({ 'data-mapping': 'specific', 'data-term': 'habit-21-days', 'data-strict': '1' })
  })
  it('is used by the comment box, which no longer maps by address', () => {
    const box = readFileSync('src/components/Comments.astro', 'utf8')
    expect(box).toContain('giscusThread(slug)')
    expect(box).not.toContain('pathname')
  })
  it('gets the post name from the post page', () => {
    expect(readFileSync('src/pages/posts/[slug].astro', 'utf8')).toContain('<Comments slug={post.slug} />')
  })
})
