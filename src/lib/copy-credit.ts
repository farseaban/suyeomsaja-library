// 글을 길게 복사하면 끝에 출처를 붙인다(사용자 11/08 ㉡안). 복사 자체는 막지 않는다 —
// 원문은 공개 저장소에도 있어 막아도 퍼 가기를 못 막고, 인용·번역 같은 독자의 쓰임만 막는다.
export const COPY_CREDIT_MIN = 100

export function creditLine(title: string, url: string): string {
  return `출처: 수염사자의 서재 — ${title}\n${url}`
}

// 공백을 뺀 글자 수가 기준 미만이면 null(그대로 복사), 이상이면 출처를 붙인 글을 돌려준다.
export function copyCredit(text: string, title: string, url: string, min = COPY_CREDIT_MIN): string | null {
  if (text.replace(/\s/g, '').length < min) return null
  return `${text.trimEnd()}\n\n${creditLine(title, url)}`
}
