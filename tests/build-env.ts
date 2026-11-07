import { execSync } from 'node:child_process'

// vitest는 Vite 환경변수(BASE_URL=/ 등)를 process.env에 심는다. 자식 astro 빌드가 이를 물려받으면
// astro.config의 base를 덮어써 모든 링크가 루트를 가리킨다. 테스트 빌드에서만 걷어 낸다.
export function buildTest() {
  const env = { ...process.env }
  for (const k of ['BASE_URL', 'MODE', 'DEV', 'PROD', 'SSR', 'NODE_ENV', 'VITEST', 'TEST'])
    delete env[k]
  for (const k of Object.keys(env)) if (k.startsWith('PUBLIC_GISCUS') || k === 'PUBLIC_ALLOW_INDEXING') delete env[k]
  execSync('npm run build:test', { stdio: 'pipe', env })
}
