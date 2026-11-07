import { describe, it, expect } from 'vitest'
import { scopeCss } from '../src/lib/scope-css'

describe('scopeCss', () => {
  const out = scopeCss(':root{--ink:#000} body{font-size:17px} h2{color:red} @media (max-width:520px){h1{font-size:25px}}')
  const flat = out.replace(/\s+/g, ' ')
  it('maps :root and body onto the scope itself', () => {
    expect(flat).toContain('.post-body{--ink:#000}'.replace(/\s+/g, ' '))
    expect(flat).toMatch(/\.post-body\s*\{\s*font-size:\s*17px/)
  })
  it('nests other selectors under the scope, inside media too', () => {
    expect(flat).toMatch(/\.post-body h2\s*\{/)
    expect(flat).toMatch(/@media[^{]*\{\s*\.post-body h1\s*\{/)
  })
  it('leaves no unscoped body or h2 rule', () => {
    expect(out).not.toMatch(/(^|})\s*(h2|body|:root)\s*\{/)
  })
  it('keeps keyframes intact', () => {
    expect(scopeCss('@keyframes f{from{opacity:0}to{opacity:1}}')).toMatch(/@keyframes f\s*\{\s*from/)
  })
})
