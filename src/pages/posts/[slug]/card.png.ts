import type { APIRoute } from 'astro'
import { readFileSync } from 'node:fs'
import { loadPosts, type Post } from '../../../lib/posts'

// 글마다 미리 그려 둔 공유 카드를 글 주소 아래에 내놓는다(posts/<글>/card.png)
export function getStaticPaths() {
  return loadPosts().filter((post) => post.cardPath).map((post) => ({ params: { slug: post.slug }, props: { post } }))
}

export const GET: APIRoute = ({ props }) =>
  new Response(readFileSync((props.post as Post).cardPath as string), { headers: { 'content-type': 'image/png' } })
