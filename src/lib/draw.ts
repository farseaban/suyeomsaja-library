export type StrokeInfo = { stroke: string | null; strokeWidth: string | null; dasharray: string | null }

// 실선으로 보이는 테두리만 '그리기'로, 나머지(채움·글자·점선)는 '나타나기'로 처리한다.
// 점선을 그리기로 돌리면 dasharray를 덮어써 실선이 되어 버린다.
export function drawMode(s: StrokeInfo): 'draw' | 'fade' {
  if (!s.stroke || s.stroke === 'none' || s.stroke === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(s.stroke)) return 'fade'
  if (!(parseFloat(s.strokeWidth ?? '') > 0)) return 'fade'
  if (s.dasharray && s.dasharray !== 'none') return 'fade'
  return 'draw'
}

export function drawDelay(index: number): number {
  return Math.min(index * 60, 1500)
}

// 도해의 3분의 1이 보이거나, 화면의 3분의 1을 채우면 재생한다(화면보다 긴 도해도 반드시 나타나게).
export function shouldPlay(ratio: number, visibleHeight: number, viewport: number): boolean {
  return ratio >= 0.35 || visibleHeight >= viewport * 0.35
}
