// 글마다 공유 카드(posts/<글>/card.png)를 이 맥의 크롬으로 그린다. 빌드 서버에는 한글 글꼴이 없어 미리 그려 둔다.
// 사용법: npm run cards  (글 제목이 바뀌면 다시 돌린다 — 그린 제목은 card.txt에 남아 테스트가 대조한다)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadPosts } from '../src/lib/posts'
import { cardStamp } from '../src/lib/card'

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const dir = process.env.POSTS_DIR ?? 'posts'
const template = pathToFileURL(resolve('tools/card/card.html')).href
const tmp = mkdtempSync(join(tmpdir(), 'cards-'))

const shoot = (hash: string, out: string) => {
  const raw = join(tmp, 'raw.png')
  // 크롬이 그리지 못하고 끝나도 앞 글의 그림이 이 글 카드가 되지 않게 매번 지운다
  rmSync(raw, { force: true })
  execFileSync(CHROME, ['--headless=new', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1200,630',
    '--allow-file-access-from-files', '--virtual-time-budget=6000', `--screenshot=${raw}`, `${template}${hash}`], { stdio: 'ignore' })
  if (!existsSync(raw)) throw new Error(`크롬이 카드를 그리지 못했다: ${out}`)
  execFileSync('python3', ['tools/strip_png_meta.py', raw, out])
}

const only = process.argv[2]
const posts = loadPosts(dir)
if (only && only !== 'site' && !posts.some((p) => p.slug === only)) throw new Error(`그런 글이 없다: ${only}`)
if (!only || only === 'site') shoot('', 'public/og-card.png')
for (const p of posts) {
  if (only && only !== 'site' && only !== p.slug) continue
  shoot('#' + encodeURIComponent(JSON.stringify({ title: p.title, category: p.category, color: p.color })), join(dir, p.slug, 'card.png'))
  writeFileSync(join(dir, p.slug, 'card.txt'), cardStamp(p) + '\n')
  console.log(`카드: ${p.slug}`)
}
rmSync(tmp, { recursive: true })
