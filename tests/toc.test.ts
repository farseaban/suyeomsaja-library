import { it, expect } from 'vitest'
import { addHeadingIds } from '../src/lib/toc'

it('ids every h2 in order and lists them', () => {
  const r = addHeadingIds('<p>a</p><h2>하나</h2><p>b</p><h2 id="keep">둘 <b>굵게</b></h2>')
  expect(r.toc).toEqual([{ id: 's-1', text: '하나' }, { id: 'keep', text: '둘 굵게' }])
  expect(r.html).toContain('<h2 id="s-1">하나</h2>')
})
it('returns no items when there is no h2', () => expect(addHeadingIds('<p>x</p>').toc).toEqual([]))
