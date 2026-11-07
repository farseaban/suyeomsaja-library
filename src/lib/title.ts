// 글 제목은 '질문 — 개념(원어)' 꼴이다. 첫 ' — '에서만 두 줄로 가른다(글자는 바꾸지 않는다).
export function splitTitle(title: string): { q: string; c: string | null } {
  const at = title.indexOf(' — ')
  if (at < 0) return { q: title, c: null }
  return { q: title.slice(0, at), c: title.slice(at + 3) }
}
