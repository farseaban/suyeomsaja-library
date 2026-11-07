import postcss from 'postcss'
import prefixer from 'postcss-prefix-selector'

const SELF = /^(:root|html|body|article)$/

// 글의 <style>을 사이트 틀에 번지지 않게 scope 아래로 가둔다.
export function scopeCss(css: string, scope = '.post-body'): string {
  return postcss([
    prefixer({
      prefix: scope,
      transform: (_prefix: string, selector: string, prefixed: string) =>
        SELF.test(selector.trim()) ? scope : prefixed,
    }),
  ]).process(css, { from: undefined }).css
}
