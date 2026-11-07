import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { allowSave, saveEdit } from '../src/integrations/edit'
import { fileVersion } from '../src/lib/edit'

const T = 'tok'
const req = (host: string, origin: string | undefined, token: string | undefined, method = 'POST') =>
  ({ method, headers: { host, origin, 'x-edit-token': token } })

describe('save gate', () => {
  it('lets the edit page on this computer save', () => {
    expect(allowSave(req('localhost:4322', 'http://localhost:4322', T), T)).toBe(true)
    expect(allowSave(req('127.0.0.1:4322', 'http://127.0.0.1:4322', T), T)).toBe(true)
  })
  it('refuses a rebound outside name even when its origin matches its host', () => {
    expect(allowSave(req('evil.example:4322', 'http://evil.example:4322', T), T)).toBe(false)
  })
  it('refuses a missing or wrong session token', () => {
    expect(allowSave(req('localhost:4322', 'http://localhost:4322', undefined), T)).toBe(false)
    expect(allowSave(req('localhost:4322', 'http://localhost:4322', 'nope'), T)).toBe(false)
  })
  it('refuses another origin and anything but POST', () => {
    expect(allowSave(req('localhost:4322', 'https://evil.example', T), T)).toBe(false)
    expect(allowSave(req('localhost:4322', 'http://localhost:4322', T, 'GET'), T)).toBe(false)
  })
})

describe('saveEdit', () => {
  const setup = (html: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'edit-')), f = join(dir, 'a-post', 'post.html')
    mkdirSync(join(dir, 'a-post')); writeFileSync(f, html)
    return { dir, f }
  }
  const HTML = '<article><h1>제목</h1><p>하나 <a href="#x">링크</a></p></article>'
  it('saves when the page was rendered from this exact file, and hands back the new version', () => {
    const { dir, f } = setup(HTML)
    const r = saveEdit(dir, { slug: 'a-post', index: 1, before: '하나 링크', after: '둘 <a href="#x">링크</a>', version: fileVersion(HTML) })
    expect(readFileSync(f, 'utf8')).toBe('<article><h1>제목</h1><p>둘 <a href="#x">링크</a></p></article>')
    expect(r.version).toBe(fileVersion(readFileSync(f, 'utf8')))
  })
  it('refuses when the file changed elsewhere, even if the words did not', () => {
    const { dir, f } = setup(HTML)
    const old = fileVersion(HTML)
    writeFileSync(f, HTML.replace('#x', '#y'))
    expect(() => saveEdit(dir, { slug: 'a-post', index: 1, before: '하나 링크', after: '둘 <a href="#x">링크</a>', version: old })).toThrow(/바뀌었/)
    expect(readFileSync(f, 'utf8')).toBe(HTML.replace('#x', '#y'))
  })
  it('refuses a slug that climbs out of the posts folder', () => {
    const { dir } = setup(HTML)
    expect(() => saveEdit(dir, { slug: '../x', index: 0, before: '', after: '', version: '' })).toThrow(/이름/)
  })
})
