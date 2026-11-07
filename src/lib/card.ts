import { createHash } from 'node:crypto'

// 공유 카드에 그려 넣은 것(분야 이름·알약 색·제목) — 이것이 바뀌면 카드를 다시 그려야 한다(npm run cards)
export function cardStamp(p: { title: string; category: string; color: string }): string {
  return `${p.category}(${p.color}) · ${p.title}`
}

// 카드 주소에 붙이는 판 — 제목이나 분야 색이 바뀌면 주소가 바뀌어 카카오톡 등이 옛 카드를 붙들지 않는다
export function cardVersion(p: { title: string; category: string; color: string }): string {
  return createHash('sha256').update(cardStamp(p)).digest('hex').slice(0, 8)
}
