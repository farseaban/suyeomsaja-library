// 글 HTML의 안전 검사. 빌드에서도 같은 검사가 돌지만(loadPosts), 집필 단계에서 이유를 먼저 보여 준다.
import { readFileSync } from 'node:fs'
import { extractPost } from '../src/lib/extract'
import { findUnsafe } from '../src/lib/post-safety'
import { checkImages } from '../src/lib/images'
import { dirname } from 'node:path'

const { articleHtml, css } = extractPost(readFileSync(process.argv[2], 'utf8'))
const hits = [...findUnsafe(articleHtml, css), ...checkImages(dirname(process.argv[2]), articleHtml).problems.map((p) => `그림 ${p}`)]
if (hits.length) {
  for (const hit of hits) console.log('  ✗ 안전:', hit)
  process.exit(1)
}
console.log('  ✓ 안전 검사 통과')
