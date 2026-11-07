import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const HOOK = resolve('tools/git-hooks/pre-push')

// 임시 저장소에서 실제로 푸시해 본다. 검사 도구(vitest)만 결과를 정할 수 있는 가짜로 둔다.
describe('pre-push hook', () => {
  let dir = '', repo = '', remote = ''
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.org', ...args], { cwd: repo, encoding: 'utf8', stdio: 'pipe' })
  const push = (...args: string[]): boolean => {
    try { git('push', remote, ...args); return true } catch { return false }
  }
  const remoteHas = (branch: string) => execFileSync('git', ['--git-dir', remote, 'branch', '--list', branch], { encoding: 'utf8' }).trim() !== ''
  const commit = (file: string, text: string, message = 'post', ...flags: string[]) => {
    mkdirSync(join(repo, dirname(file)), { recursive: true })
    writeFileSync(join(repo, file), text)
    git('add', '-A'); git('commit', '-q', '-m', message, ...flags)
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'pre-push-'))
    repo = join(dir, 'repo'); remote = join(dir, 'remote.git')
    mkdirSync(repo)
    execFileSync('git', ['init', '-q', '--bare', remote])
    git('init', '-q', '-b', 'main')
    writeFileSync(join(repo, '.gitignore'), 'node_modules/\n')
    writeFileSync(join(repo, 'a.txt'), 'private history\n')
    git('add', '-A'); git('commit', '-q', '-m', 'old history')
    git('switch', '-q', '--orphan', 'publish')
    writeFileSync(join(repo, 'a.txt'), 'public\n')
    git('add', '-A'); git('commit', '-q', '-m', 'first publish')
    copyFileSync(HOOK, join(repo, '.git/hooks/pre-push'))
    chmodSync(join(repo, '.git/hooks/pre-push'), 0o755)
    mkdirSync(join(repo, '.superpowers'))
    writeFileSync(join(repo, '.superpowers/banned-terms.txt'), 'FORBIDDENWORD\n/Secret/Path/\n')
    writeFileSync(join(repo, '.git/info/exclude'), '.superpowers/\n')
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('lets the publish branch through when the scan passes', () => {
    expect(push('publish')).toBe(true)
    expect(remoteHas('publish')).toBe(true)
  })
  it('accepts the publish branch going to the remote main', () => {
    expect(push('publish:main')).toBe(true)
    expect(remoteHas('main')).toBe(true)
  })
  it('accepts HEAD on the publish branch, which is how gh repo create pushes', () => {
    expect(push('HEAD')).toBe(true)
  })
  it('lets a clean follow-up post through', () => {
    expect(push('publish')).toBe(true)
    commit('b.txt', 'clean\n')
    expect(push('publish')).toBe(true)
  })
  it('refuses a banned word in the commit being pushed', () => {
    commit('b.txt', 'a FORBIDDENWORD here\n')
    expect(push('publish')).toBe(false)
    expect(remoteHas('publish')).toBe(false)
  })
  it('refuses a banned path in the commit being pushed', () => {
    commit('b.txt', 'see /Secret/Path/x\n')
    expect(push('publish')).toBe(false)
  })
  it('refuses a banned word that a later commit removed, because the history still carries it', () => {
    commit('b.txt', 'FORBIDDENWORD\n')
    commit('b.txt', 'clean\n')
    expect(push('publish')).toBe(false)
  })
  it('refuses a banned word in a commit message', () => {
    commit('b.txt', 'clean\n', 'about FORBIDDENWORD')
    expect(push('publish')).toBe(false)
  })
  it('refuses a banned word in the author field', () => {
    commit('b.txt', 'clean\n', 'post', '--author=FORBIDDENWORD <a@example.org>')
    expect(push('publish')).toBe(false)
  })
  it('refuses a banned word in a file name', () => {
    commit('FORBIDDENWORD.txt', 'clean\n')
    expect(push('publish')).toBe(false)
  })
  it('refuses design documents at the tip, which the working-tree scan leaves out on purpose', () => {
    commit('docs/superpowers/spec.md', 'design\n')
    expect(push('publish')).toBe(false)
  })
  it('refuses design documents that a later commit removed', () => {
    commit('docs/superpowers/spec.md', 'design\n')
    git('rm', '-q', 'docs/superpowers/spec.md'); git('commit', '-q', '-m', 'gone')
    expect(push('publish')).toBe(false)
  })
  it('refuses when the list of banned words is missing', () => {
    rmSync(join(repo, '.superpowers/banned-terms.txt'))
    expect(push('publish')).toBe(false)
  })
  it('refuses when the list of banned words is empty', () => {
    writeFileSync(join(repo, '.superpowers/banned-terms.txt'), '')
    expect(push('publish')).toBe(false)
  })
  it('refuses when the local main is gone, because the private history can no longer be told apart', () => {
    git('branch', '-q', '-D', 'main')
    expect(push('publish')).toBe(false)
  })
  it('refuses the local main, which holds the private history', () => {
    expect(push('main')).toBe(false)
    expect(remoteHas('main')).toBe(false)
  })
  it('refuses the local main even under the publish name', () => {
    expect(push('main:publish')).toBe(false)
    expect(remoteHas('publish')).toBe(false)
  })
  it('refuses a publish branch that has taken in the private history', () => {
    git('merge', '-q', '--allow-unrelated-histories', '-X', 'ours', '-m', 'oops', 'main')
    expect(push('publish')).toBe(false)
  })
  it('checks the commits themselves, so another checked-out branch changes nothing', () => {
    git('switch', '-q', 'main')
    expect(push('publish')).toBe(true)
  })
  it('refuses deleting a remote branch', () => {
    push('publish')
    expect(push('--delete', 'publish')).toBe(false)
    expect(remoteHas('publish')).toBe(true)
  })
})

describe('pre-push hook on this computer', () => {
  it('is installed as an exact copy, not a link that a branch switch could leave dangling', () => {
    if (process.env.CI) return
    const installed = '.git/hooks/pre-push'
    expect(existsSync(installed)).toBe(true)
    expect(readFileSync(installed, 'utf8')).toBe(readFileSync(HOOK, 'utf8'))
    expect(execFileSync('stat', ['-f', '%Sp', installed], { encoding: 'utf8' })).toMatch(/^-rwx/)
  })
})
