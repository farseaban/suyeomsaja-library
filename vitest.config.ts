import { defineConfig } from 'vitest/config'

export default defineConfig({
  // 빌드 결과를 읽는 두 테스트가 같은 dist-test를 동시에 쓰지 않도록 파일 단위 병렬을 끈다.
  test: { include: ['tests/**/*.test.ts', '.superpowers/*.test.ts'], testTimeout: 120_000, hookTimeout: 180_000, fileParallelism: false },
})
