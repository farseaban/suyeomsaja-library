// CI에서 SITE_URL·BASE_PATH가 비면 루트 링크로 조용히 구워져 공개 첫날 CSS와 링크가 전부 404가 난다.
// 그래서 CI에서는 빈 값을 거부하고, 로컬에서는 미리보기용 기본값을 쓴다.
/** @param {Record<string, string | undefined>} env */
export function resolveDeployEnv(env) {
  if (env.CI === 'true') {
    if (!env.SITE_URL) throw new Error('CI 빌드에 SITE_URL 저장소 변수가 비어 있다 (docs/PUBLISHING.md 3단계)')
    if (!env.BASE_PATH) throw new Error('CI 빌드에 BASE_PATH 저장소 변수가 비어 있다 (docs/PUBLISHING.md 3단계)')
    return { site: env.SITE_URL, base: env.BASE_PATH }
  }
  return { site: env.SITE_URL || 'http://localhost:4321', base: env.BASE_PATH || '/' }
}
