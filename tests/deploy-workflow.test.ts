import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const yml = readFileSync('.github/workflows/deploy.yml', 'utf8')
const buildJob = yml.slice(yml.indexOf('\n  build:'), yml.indexOf('\n  deploy:'))
const deployJob = yml.slice(yml.indexOf('\n  deploy:'))
const topLevel = yml.slice(0, yml.indexOf('\njobs:'))

// 빌드는 바깥 패키지를 설치하고 실행한다. 오염된 패키지가 배포 권한을 쥐지 못하게 배포 단계에만 권한을 준다.
describe('deploy workflow', () => {
  it('gives the workflow as a whole read access only', () => {
    expect(topLevel).toMatch(/permissions:\n\s+contents: read/)
    expect(topLevel).not.toMatch(/pages: write|id-token: write/)
  })
  it('keeps deploy rights out of the job that installs packages', () => {
    expect(buildJob).toContain('npm ci')
    expect(buildJob).not.toMatch(/pages: write|id-token: write/)
  })
  it('gives deploy rights to the deploy job', () => {
    expect(deployJob).toMatch(/pages: write/)
    expect(deployJob).toMatch(/id-token: write/)
  })
  it('does not run any install step in the deploy job', () => {
    expect(deployJob).not.toMatch(/\brun:/)
  })
  it('pins every action to a full commit hash, because a tag can be moved', () => {
    const uses = [...yml.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1])
    expect(uses.length).toBeGreaterThan(0)
    expect(uses.filter((u) => !/@[0-9a-f]{40}$/.test(u))).toEqual([])
  })
  it('does not leave the git credential behind for the build steps', () => {
    expect(buildJob).toMatch(/persist-credentials: false/)
  })
  it('passes the launch variable to the build, so the search block can be lifted without a code change', () => {
    expect(buildJob).toContain('PUBLIC_ALLOW_INDEXING: ${{ vars.PUBLIC_ALLOW_INDEXING }}')
  })
  it('runs by hand only until the publishing guide says otherwise', () => {
    expect(topLevel).toMatch(/workflow_dispatch/)
    expect(topLevel).not.toMatch(/pull_request/)
  })
})
