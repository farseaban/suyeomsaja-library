import { defineConfig } from 'astro/config'
import { resolveDeployEnv } from './deploy-env.mjs'
import editMode from './src/integrations/edit.ts'

const { site, base } = resolveDeployEnv(process.env)

export default defineConfig({
  site,
  base,
  outDir: process.env.OUT_DIR ?? 'dist',
  trailingSlash: 'always',
  integrations: [editMode()],
  // 편집 화면 아래쪽을 가리지 않게 개발용 도구 막대는 끈다
  devToolbar: { enabled: false },
  build: { inlineStylesheets: 'never' },
  // 작은 스크립트도 html에 박지 않고 파일로 낸다 — 콘텐츠 보안 정책이 인라인 스크립트를 막는다
  vite: { build: { assetsInlineLimit: 0 } },
})
