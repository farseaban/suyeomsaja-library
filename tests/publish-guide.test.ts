import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const guide = readFileSync('docs/PUBLISHING.md', 'utf8')

describe('publishing guide', () => {
  it('publishes on a fresh history, so old commits stay private', () => {
    expect(guide).toMatch(/git switch --orphan publish/)
    expect(guide).toMatch(/git checkout main -- \./)
  })
  it('says how to lift the search block on the real launch', () => {
    expect(guide).toContain('PUBLIC_ALLOW_INDEXING=true')
  })
  it('does not point at a branch that no longer exists', () => {
    expect(guide).not.toContain('feat/site')
  })
  // 파일이 없으면 npm test는 그 검사를 조용히 건너뛴다. 그래서 파일을 직접 지목해 돌린다(없으면 vitest가 실패한다).
  const SCAN = 'node_modules/.bin/vitest run .superpowers/publish-scope.test.ts'
  const firstPublish = guide.slice(guide.indexOf('git switch --orphan publish'), guide.indexOf('git push -u origin publish:main') + 'git push -u origin publish:main'.length)

  it('runs the local-only scope check by name before anything is pushed', () => {
    expect(firstPublish.indexOf(SCAN)).toBeGreaterThan(0)
    expect(firstPublish.indexOf(SCAN)).toBeLessThan(firstPublish.indexOf('gh repo create'))
  })
  it('chains the first publish so a failed step stops everything after it', () => {
    const lines = firstPublish.split('\n').map((l) => l.replace(/\s+#.*$/, '').trim()).filter(Boolean)
    expect(lines.slice(0, -1).filter((l) => !l.endsWith('&&'))).toEqual([])
  })
  it('runs the same check before pushing later posts', () => {
    expect(guide).toContain(`${SCAN} && git push`)
  })
  // gh의 --push는 현재 브랜치 이름 그대로 올려 publish가 기본 브랜치가 되고, Pages는 기본 브랜치의 배포만 받는다.
  it('makes main the first and only branch on the remote', () => {
    expect(guide).toContain('gh repo create farseaban/suyeomsaja-library --public --source . --remote origin &&')
    expect(guide).not.toContain('--push')
  })
  // 로컬 publish와 원격 main은 이름이 달라 그냥 git push는 거부된다.
  it('names both branches when pushing later posts', () => {
    expect(guide).toContain(`${SCAN} && git push origin publish:main`)
  })
})

// 공개 범위 검사는 금칙어 목록을 담고 있어 그 자체가 공개되면 안 된다 — 깃이 무시하는 폴더에만 둔다.
describe('local-only scope check', () => {
  // 파일이 사라지면 vitest는 조용히 건너뛰어 보호가 없어진 줄도 모른다. 자동 빌드에는 원래 없으므로 거기서만 면제한다.
  it('is present on this computer', () => {
    if (process.env.CI) return
    expect(existsSync('.superpowers/publish-scope.test.ts')).toBe(true)
    expect(existsSync('.superpowers/banned-terms.txt')).toBe(true)
  })
  it('is not tracked by git', () => {
    expect(execFileSync('git', ['ls-files', 'tests/publish-scope.test.ts', '.superpowers'], { encoding: 'utf8' })).toBe('')
  })
})
