// `npm run views` — Cloudflare에서 최근 60일 글별 조회수를 받아 .superpowers/views.json에 쌓고 표로 보여 준다.
// 이 맥에서만 쓰는 도구다. 숫자는 공개 사이트에 실리지 않는다(사용자 11/10).
// 토큰: 키체인(서비스 suyeomsaja-cf-analytics, 계정 token) 또는 CF_ANALYTICS_TOKEN. 계정 ID: views.json의 account 또는 CF_ACCOUNT_ID.
import { loadPosts } from '../src/lib/posts'
import { loadViews, saveViews, mergeDays, summarize, fetchDays, readToken, postPath, todayUtc } from '../src/lib/views'

const store = loadViews()
const account = process.env.CF_ACCOUNT_ID ?? store.account
const token = readToken()
const today = todayUtc()

if (!account || !token) {
  console.error(!token ? '토큰이 없다 — 키체인(suyeomsaja-cf-analytics/token)이나 CF_ANALYTICS_TOKEN을 확인' : '계정 ID가 없다 — CF_ACCOUNT_ID를 주고 한 번 돌리면 views.json에 기억한다')
  process.exit(1)
}

let next = store
try {
  next = { ...mergeDays(store, await fetchDays(token, account, today)), account, updated: new Date().toISOString() }
  saveViews(next)
} catch (e) {
  console.error(`받아 오지 못해 저장된 숫자로 보인다 — ${(e as Error).message}`)
}

const sum = summarize(next, today)
const zero = { today: 0, d7: 0, d30: 0, total: 0 }
const rows = loadPosts()
  .map((p) => ({ slug: p.slug, title: p.title, ...(sum[postPath(p.slug)] ?? zero) }))
  .sort((a, b) => b.total - a.total || b.d7 - a.d7)

const pad = (s: string | number, n: number) => String(s).padStart(n)
console.log(`글별 조회수(페이지뷰) — 기준 ${today} UTC · 받은 시각 ${next.updated ?? '없음'}`)
console.log(`${pad('오늘', 4)} ${pad('7일', 5)} ${pad('30일', 5)} ${pad('누적', 5)}  글`)
for (const r of rows) console.log(`${pad(r.today, 5)} ${pad(r.d7, 6)} ${pad(r.d30, 6)} ${pad(r.total, 6)}  ${r.title.split(' — ')[0]}`)
const others = Object.entries(sum).filter(([path]) => !path.startsWith('/posts/')).sort((a, b) => b[1].total - a[1].total).slice(0, 8)
if (others.length) {
  console.log('\n글이 아닌 쪽')
  for (const [path, v] of others) console.log(`${pad(v.today, 5)} ${pad(v.d7, 6)} ${pad(v.d30, 6)} ${pad(v.total, 6)}  ${path}`)
}
