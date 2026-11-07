import { describe, it, expect } from 'vitest'
import { buildCsp } from '../src/config/csp'

describe('content security policy text', () => {
  it('allows nothing from giscus while comments are off', () => {
    const csp = buildCsp(false)
    expect(csp).not.toContain('giscus')
    expect(csp).toContain("frame-src 'none'")
  })
  it('allows giscus scripts, styles and frames once comments are on', () => {
    const csp = buildCsp(true)
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval' https://giscus.app")
    expect(csp).toMatch(/style-src [^;]*https:\/\/giscus\.app/)
    expect(csp).toContain('frame-src https://giscus.app')
  })
  it('never allows inline scripts, with or without comments', () => {
    for (const on of [false, true]) {
      const script = buildCsp(on).split('; ').find((d) => d.startsWith('script-src ')) ?? ''
      expect(script).not.toContain("'unsafe-inline'")
      expect(script).not.toContain("'unsafe-eval'")
    }
  })
})
