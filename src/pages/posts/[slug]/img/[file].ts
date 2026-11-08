import type { APIRoute } from 'astro'
import { readFileSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { loadPosts } from '../../../../lib/posts'

// 글에 넣은 그림을 글 주소 아래에 내놓는다(posts/<글>/img/<파일>). 본문은 상대 주소 img/<파일>로 부른다
const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

export function getStaticPaths() {
  return loadPosts().flatMap((post) => post.images.map((path) => ({ params: { slug: post.slug, file: basename(path) }, props: { path } })))
}

export const GET: APIRoute = ({ props }) => {
  const path = (props as { path: string }).path
  return new Response(readFileSync(path), { headers: { 'content-type': TYPES[extname(path).toLowerCase()] } })
}
