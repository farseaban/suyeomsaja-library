import { describe, it, expect } from 'vitest'
import { resolveDeployEnv } from '../deploy-env.mjs'

describe('resolveDeployEnv', () => {
  it('defaults to local values outside CI', () => {
    expect(resolveDeployEnv({})).toEqual({ site: 'http://localhost:4321', base: '/' })
  })
  it('treats an empty BASE_PATH outside CI as root', () => {
    expect(resolveDeployEnv({ BASE_PATH: '' }).base).toBe('/')
  })
  it('refuses an empty BASE_PATH in CI', () => {
    expect(() => resolveDeployEnv({ CI: 'true', SITE_URL: 'https://farseaban.github.io', BASE_PATH: '' })).toThrow(/BASE_PATH/)
  })
  it('refuses an empty SITE_URL in CI', () => {
    expect(() => resolveDeployEnv({ CI: 'true', SITE_URL: '', BASE_PATH: '/x/' })).toThrow(/SITE_URL/)
  })
  it('passes CI values through', () => {
    expect(resolveDeployEnv({ CI: 'true', SITE_URL: 'https://a.b', BASE_PATH: '/x/' })).toEqual({ site: 'https://a.b', base: '/x/' })
  })
})
