import type { APIRoute } from 'astro'
import { readFileSync } from 'node:fs'
import { basename, dirname, extname } from 'node:path'
import { loadPosts } from '../../../../lib/posts'
import { insideImgDir } from '../../../../lib/images'

// 글에 넣은 그림을 글 주소 아래에 내놓는다(posts/<글>/img/<파일>). 본문은 상대 주소 img/<파일>로 부른다
const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

// 내보내기 직전에 한 번 더 확인한다 — 그 글의 img/ 바로 아래 그림 파일이 아니면 빌드를 멈춘다
function checked(path: string): string {
  if (!insideImgDir(dirname(dirname(path)), path) || !TYPES[extname(path).toLowerCase()]) throw new Error(`그림 경로를 내보낼 수 없다: ${path}`)
  return path
}

export function getStaticPaths() {
  return loadPosts().flatMap((post) => post.images.map((path) => ({ params: { slug: post.slug, file: basename(checked(path)) }, props: { path } })))
}

export const GET: APIRoute = ({ props }) => {
  const path = checked((props as { path: string }).path)
  return new Response(readFileSync(path), { headers: { 'content-type': TYPES[extname(path).toLowerCase()] } })
}
