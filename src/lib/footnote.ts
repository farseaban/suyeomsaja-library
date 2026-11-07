// 글 템플릿의 각주: <sup class="fn"><a id="cite-N" href="#ref-N">[N]</a></sup> → <li id="ref-N">… <a class="back" href="#cite-N">↩</a></li>

export function refIdFromHref(href: string): string | null {
  const m = /^#(ref-[\w-]+)$/.exec(href)
  return m ? m[1] : null
}

export function noteBodyHtml(liInnerHtml: string): string {
  return liInnerHtml.replace(/\s*<a\b[^>]*\bclass="back"[^>]*>[\s\S]*?<\/a>/g, '').trim()
}

// 말풍선 상태: 올리기로 연 것은 내리면 닫히고, 누르기(또는 키보드)로 연 것은 고정된다.
// 마우스는 누르기 전에 반드시 올리기가 먼저 일어나므로, 올려서 열린 것을 누르면 닫지 않고 고정한다.
export type NoteState = { open: boolean; by: 'hover' | 'click' | null; focus: boolean }
export type NoteEvent = 'hover' | 'leave' | 'click' | 'key'

export function noteTransition(s: NoteState, e: NoteEvent): NoteState {
  const closed: NoteState = { open: false, by: null, focus: false }
  switch (e) {
    case 'hover':
      return s.open ? s : { open: true, by: 'hover', focus: false }
    case 'leave':
      return s.by === 'hover' ? closed : s
    case 'click':
    case 'key':
      if (s.open && s.by === 'click') return closed
      return { open: true, by: 'click', focus: e === 'key' }
  }
}
