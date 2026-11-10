import type { AstroIntegration } from 'astro'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { applyEdit, toggleQuote, fileVersion } from '../lib/edit'
import { loadViews, saveViews, mergeDays, fetchDays, readToken, todayUtc } from '../lib/views'

type Req = { method?: string; headers: Record<string, string | string[] | undefined> }

// 이 컴퓨터 이름으로 들어온 요청만 — 바깥 도메인을 이 컴퓨터로 돌려 대는 수법(DNS 리바인딩)을 막는다
export function isLoopback(host: unknown): boolean {
  return typeof host === 'string' && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)
}

// 저장은 이 컴퓨터의 편집 화면이, 이번 서버가 켜질 때 만든 비밀값을 들고 보낼 때만 받는다
export function allowSave(req: Req, token: string): boolean {
  const { host, origin } = req.headers
  const sent = req.headers['x-edit-token']
  if (req.method !== 'POST' || !isLoopback(host) || origin !== `http://${host}` || typeof sent !== 'string') return false
  const a = Buffer.from(sent), b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

type SaveBody = { slug: unknown; index: unknown; before: unknown; after: unknown; version: unknown; op?: unknown }

// 편집 화면이 그려질 때의 파일 판과 지금 파일이 같을 때만 저장한다(다른 데서 꾸밈만 고친 경우까지 지킨다)
export function saveEdit(dir: string, { slug, index, before, after, version, op }: SaveBody): { version: string } {
  if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) throw new Error('글 이름이 이상하다')
  const file = join(dir, slug, 'post.html')
  if (!existsSync(file)) throw new Error('그 글이 없다')
  const html = readFileSync(file, 'utf8')
  if (version !== fileVersion(html)) throw new Error('파일이 화면과 다르게 바뀌었다 — 새로고침한 뒤 다시 고쳐 주세요')
  // op 'quote': 문단을 인용 상자로 감싸거나 푼다. 그 밖에는 칸 안의 글자를 고친다(다 지우면 칸째 빠진다)
  const out = op === 'quote' ? toggleQuote(html, Number(index), String(before)) : applyEdit(html, Number(index), String(before), String(after))
  writeFileSync(file, out)
  return { version: fileVersion(out) }
}

// 내 컴퓨터 전용 편집 모드의 저장 창구. `npm run edit`(SUYEOMSAJA_EDIT=1)으로 켠 `astro dev`에만 붙고, 빌드 결과에는 아무것도 남기지 않는다.
export default function editMode(): AstroIntegration {
  const on = process.env.SUYEOMSAJA_EDIT === '1'
  return {
    name: 'suyeomsaja-edit',
    hooks: {
      'astro:config:setup': ({ command, updateConfig }) => {
        // 다른 로컬 페이지가 편집 화면(비밀값)을 읽어 가지 못하게 개발 서버의 CORS 허용을 끈다
        if (on && command === 'dev') updateConfig({ vite: { server: { cors: false } } })
      },
      'astro:server:setup': ({ server }) => {
        if (!on) return
        // 편집 서버를 켤 때 조회수를 한 번 새로 받아 둔다(실패해도 편집에는 지장 없다)
        void (async () => {
          const store = loadViews(), cf = readToken()
          if (!store.account || !cf) return
          try { saveViews({ ...mergeDays(store, await fetchDays(cf, store.account, todayUtc())), updated: new Date().toISOString() }) } catch {}
        })()
        const token = randomBytes(32).toString('hex')
        // 편집 화면이 같은 프로세스에서 읽어 페이지에 심는다
        process.env.SUYEOMSAJA_EDIT_TOKEN = token
        server.middlewares.use((req, res, next) => {
          if (!/\/(edit|__edit)\//.test(req.url ?? '') || isLoopback(req.headers.host)) return next()
          res.statusCode = 403
          res.end()
        })
        server.middlewares.use('/__edit/save', (req, res) => {
          const reply = (code: number, body: object) => {
            res.statusCode = code
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(JSON.stringify(body))
          }
          if (!allowSave(req, token)) return reply(403, { error: '받지 않는 요청' })
          let raw = ''
          req.on('data', (c) => (raw += c))
          req.on('end', () => {
            try {
              reply(200, { ok: true, ...saveEdit(process.env.POSTS_DIR ?? 'posts', JSON.parse(raw)) })
            } catch (e) {
              reply(409, { error: (e as Error).message })
            }
          })
        })
      },
    },
  }
}
