// 내부 링크는 모두 이 함수를 거친다 — GitHub Pages 하위 경로에서 도메인 루트로 옮겨도 깨지지 않게.
export function joinBase(base: string, path: string): string {
  if (path.startsWith('#') || /^[a-z]+:/i.test(path)) return path
  const joined = `/${base}/${path}`.replace(/\/{2,}/g, '/')
  const isFile = /\.[a-z0-9]+$/i.test(joined)
  return isFile || joined.endsWith('/') ? joined : `${joined}/`
}

export function url(path: string): string {
  return joinBase(import.meta.env.BASE_URL, path)
}
