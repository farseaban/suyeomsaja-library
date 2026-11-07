// 글 검사(post-safety)를 뚫고 코드가 들어와도 브라우저가 실행을 거부하게 하는 두 번째 벽이다.
// script-src에 'unsafe-inline'을 넣으면 이 벽이 사라진다. 인라인 스크립트가 필요하면 파일로 뺀다.
// 'wasm-unsafe-eval'은 검색(Pagefind)의 wasm에, 'unsafe-inline'(style)은 글마다 다른 style 태그와 속성에 필요하다.
// 메타 태그로는 frame-ancestors를 걸 수 없다(브라우저가 무시한다). giscus.app은 댓글이 켜졌을 때만 연다.
export function buildCsp(comments: boolean): string {
  const giscus = comments ? ' https://giscus.app' : ''
  return [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval'${giscus}`,
    `style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com${giscus}`,
    "font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    comments ? 'frame-src https://giscus.app' : "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}
