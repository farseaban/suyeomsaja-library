// 본문을 읽은 비율(0..1). top·height는 본문 상자의 화면 기준 위치와 높이.
export function readingProgress(top: number, height: number, viewport: number): number {
  const span = height - viewport * 0.6
  if (span <= 0) return top < viewport * 0.2 ? 1 : 0
  return Math.max(0, Math.min(1, (-top + viewport * 0.2) / span))
}

// 화면 위쪽 threshold 선을 지난 마지막 제목의 번호. 아직 아무것도 안 지났으면 0.
export function currentSection(tops: number[], threshold = 140): number {
  let cur = 0
  tops.forEach((t, i) => { if (t < threshold) cur = i })
  return cur
}

// 첫 제목이 threshold 선을 지났는가. currentSection은 아무것도 안 지났을 때도 0을 돌려주므로,
// 읽기 띠에 글 제목을 적을지 절 제목을 적을지는 이것으로 따로 가른다.
export function passedFirst(tops: number[], threshold = 140): boolean {
  return tops.length > 0 && tops[0] < threshold
}

// 읽기 띠를 내릴 때인가: 밤 구역(.s-top)이 화면 위로 다 지나갔고, 꼬리말 위 끝이 아직 화면 높이의 60% 아래에 있다.
export function readbarOn(topBottom: number, footerTop: number, viewport: number): boolean {
  return topBottom < 0 && footerTop > viewport * 0.6
}
