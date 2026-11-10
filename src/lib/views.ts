import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { execFileSync } from 'node:child_process'

// 글별 조회수 — 사용자 11/10: "조회수는 내장하고 유저한테 노출만 시키지 않도록".
// Cloudflare Web Analytics에서 날짜·주소별 페이지뷰를 받아 이 맥의 .superpowers/views.json(저장소에 안 올라감)에 날짜별로 쌓는다.
// 공개 빌드는 이 파일을 읽지 않는다 — 숫자는 `npm run views`와 편집 화면(localhost)에만 보인다.

export const VIEWS_FILE = '.superpowers/views.json'
const HOST = 'suyeomsaja.com'

// days[날짜][주소] = { views: 페이지뷰, visits: 방문 }
export type Day = Record<string, { views: number; visits: number }>
export type ViewsStore = { account?: string; updated?: string; days: Record<string, Day> }

export function loadViews(file = VIEWS_FILE): ViewsStore {
  if (!existsSync(file)) return { days: {} }
  try {
    const s = JSON.parse(readFileSync(file, 'utf8'))
    return { ...s, days: s.days ?? {} }
  } catch {
    return { days: {} }
  }
}

export function saveViews(store: ViewsStore, file = VIEWS_FILE): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(store, null, 1) + '\n')
}

// 받아 온 날짜는 통째로 갈아 끼운다(오늘처럼 아직 쌓이는 날도 최신 값으로). 받지 않은 옛 날짜는 그대로 둔다 — Cloudflare가 지운 기록도 누적에 남는다
export function mergeDays(store: ViewsStore, fetched: Record<string, Day>): ViewsStore {
  return { ...store, days: { ...store.days, ...fetched } }
}

const shift = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export type PathViews = { today: number; d7: number; d30: number; total: number }

// 주소별 합계. today는 기준일 하루, d7·d30은 기준일을 포함한 최근 7·30일
export function summarize(store: ViewsStore, today: string): Record<string, PathViews> {
  const out: Record<string, PathViews> = Object.create(null)
  for (const [date, day] of Object.entries(store.days)) {
    for (const [path, { views }] of Object.entries(day)) {
      if (!SAFE_PATH.test(path)) continue
      const p = (out[path] ??= { today: 0, d7: 0, d30: 0, total: 0 })
      p.total += views
      if (date === today) p.today += views
      if (date > shift(today, -7) && date <= today) p.d7 += views
      if (date > shift(today, -30) && date <= today) p.d30 += views
    }
  }
  return out
}

export const postPath = (slug: string) => `/posts/${slug}/`
// 받아 들이는 주소 — '/'로 시작하고 보이는 ASCII만(한글 주소는 %로 인코딩돼 온다). 제어 문자·__proto__ 같은 키는 막는다
export const SAFE_PATH = /^\/(?!.*(__proto__|constructor|prototype))[\x21-\x7e]{0,300}$/

// 키체인(서비스 suyeomsaja-cf-analytics, 계정 token)에서 읽는다. 없으면 환경변수 CF_ANALYTICS_TOKEN
export function readToken(): string | undefined {
  if (process.env.CF_ANALYTICS_TOKEN) return process.env.CF_ANALYTICS_TOKEN
  try {
    return execFileSync('security', ['find-generic-password', '-s', 'suyeomsaja-cf-analytics', '-a', 'token', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || undefined
  } catch {
    return undefined
  }
}

const QUERY = `query($a:String!,$s:Date!,$e:Date!){viewer{accounts(filter:{accountTag:$a}){rumPageloadEventsAdaptiveGroups(filter:{date_geq:$s,date_leq:$e,requestHost:"${HOST}"},limit:5000,orderBy:[date_ASC]){count sum{visits} dimensions{requestPath date}}}}}`

// 최근 days일을 받아 온다(Cloudflare Web Analytics, GraphQL rumPageloadEventsAdaptiveGroups)
export async function fetchDays(token: string, account: string, today: string, days = 60): Promise<Record<string, Day>> {
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { a: account, s: shift(today, -(days - 1)), e: today } }),
  })
  const body = (await res.json()) as { data?: any; errors?: { message: string }[] | null }
  if (!res.ok || body.errors?.length) throw new Error(`Cloudflare 응답 오류: ${body.errors?.map((e) => e.message).join('; ') ?? res.status}`)
  const rows: { count: number; sum: { visits: number }; dimensions: { requestPath: string; date: string } }[] =
    body.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups ?? []
  const out: Record<string, Day> = Object.create(null)
  for (let i = 0; i < days; i++) out[shift(today, -i)] = Object.create(null)
  for (const r of rows) {
    // 주소는 방문자 쪽에서 꾸며 보낼 수 있다(분석 토큰은 공개값) — 날짜 꼴, 보이는 ASCII 주소만 받는다
    const { date, requestPath: path } = r.dimensions
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !SAFE_PATH.test(path) || !(date in out)) continue
    const day = out[date]
    const p = (day[path] ??= { views: 0, visits: 0 })
    p.views += r.count
    p.visits += r.sum.visits
  }
  return out
}

// 기준일은 UTC 날짜다 — Cloudflare의 date가 UTC 기준이라 맞춘다(한국 오전 9시 전에는 하루 앞 날짜로 센다)
export const todayUtc = () => new Date().toISOString().slice(0, 10)
