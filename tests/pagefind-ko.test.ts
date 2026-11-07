import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { buildTest } from './build-env'

// 한국어는 조사가 낱말에 붙는다. "적자는"만 있는 글이 "적자"로 찾아져야 검색이 쓸모 있다.
// 브라우저용 pagefind.js를 Node에서 돌리려고 dist-test를 작은 서버로 띄우고 window·document·fetch를 흉내 낸다.
const ROOT = resolve('dist-test')
const BASE = '/suyeomsaja-library/'
let srv: http.Server
let search: (q: string) => Promise<string[]>

beforeAll(async () => {
  if (!existsSync(join(ROOT, 'pagefind/pagefind.js'))) buildTest()
  srv = http.createServer(async (req, res) => {
    try {
      res.end(await readFile(join(ROOT, decodeURIComponent(req.url!.split('?')[0]).replace(BASE, '/'))))
    } catch {
      res.statusCode = 404
      res.end()
    }
  }).listen(0)
  await new Promise((r) => srv.on('listening', r))
  const origin = `http://localhost:${(srv.address() as { port: number }).port}`
  const g = globalThis as Record<string, unknown>
  g.window = { location: { origin, href: `${origin}/` } }
  g.document = { currentScript: null, querySelector: () => null, querySelectorAll: () => [] }
  const realFetch = globalThis.fetch
  g.fetch = (u: string, o?: RequestInit) => realFetch(String(u).startsWith('/') ? origin + u : u, o)
  const pf = await import(/* @vite-ignore */ join(ROOT, 'pagefind/pagefind.js'))
  await pf.options({ basePath: `${origin}${BASE}pagefind/` })
  search = async (q) => {
    const r = await pf.search(q)
    return Promise.all(r.results.map(async (x: { data: () => Promise<{ url: string }> }) => (await x.data()).url))
  }
})
afterAll(() => srv?.close())

describe('pagefind korean search', () => {
  it('finds 적자 inside 적자는', async () => expect(await search('적자')).toContain(`${BASE}posts/sample-econ/`))
  // (지킴이) '만물'은 sample-philo의 제목에만 있다 — 제목(h1)이 본문 칸 밖 밤 구역으로 나간 뒤에도 색인에 남아야 한다
  it('finds a word that is only in a post title', async () => expect(await search('만물')).toContain(`${BASE}posts/sample-philo/`))
  it('finds nothing for a word absent from every post', async () => expect(await search('양자역학')).toEqual([]))
})
