// 글 페이지에서 긴 복사에 출처를 붙인다. 판정은 src/lib/copy-credit.ts.
import { copyCredit, creditLine } from '../lib/copy-credit'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

document.addEventListener('copy', (e) => {
  // 검색칸 같은 입력란 복사는 건드리지 않는다
  const t = e.target as HTMLElement | null
  if (t?.closest?.('input, textarea')) return
  const sel = getSelection()
  if (!sel || sel.isCollapsed || !e.clipboardData) return
  const text = sel.toString()
  const title = (document.querySelector('.s-post-head .s-tq') ?? document.querySelector('.s-post-head h1'))?.textContent?.trim() ?? document.title
  // 주소창의 #절·?검색어는 떼고 글 주소만
  const url = location.origin + location.pathname
  const plain = copyCredit(text, title, url)
  if (!plain) return
  // 서식 있는 붙여넣기(문서·메일)에서도 글 모양이 살게 HTML도 함께 넣는다
  const box = document.createElement('div')
  for (let i = 0; i < sel.rangeCount; i++) box.append(sel.getRangeAt(i).cloneContents())
  const [line] = creditLine(title, url).split('\n')
  const html = `${box.innerHTML}<p>${esc(line)}<br><a href="${esc(url)}">${esc(url)}</a></p>`
  e.clipboardData.setData('text/plain', plain)
  e.clipboardData.setData('text/html', html)
  e.preventDefault()
})
