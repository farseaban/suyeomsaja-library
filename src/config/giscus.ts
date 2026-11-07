// 공개 날(docs/PUBLISHING.md) 저장소 변수 셋이 모두 들어오기 전에는 댓글이 꺼져 있다.
export const GISCUS = {
  repo: import.meta.env.PUBLIC_GISCUS_REPO,
  repoId: import.meta.env.PUBLIC_GISCUS_REPO_ID,
  categoryId: import.meta.env.PUBLIC_GISCUS_CATEGORY_ID,
}
export const giscusOn = Boolean(GISCUS.repo && GISCUS.repoId && GISCUS.categoryId)
// 댓글을 페이지 주소가 아니라 글 이름에 묶는다. 도메인을 옮겨 주소가 바뀌어도 그 글의 댓글로 남는다.
export const giscusThread = (slug: string): Record<string, string> => ({ 'data-mapping': 'specific', 'data-term': slug, 'data-strict': '1' })
