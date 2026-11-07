export const SITE = {
  name: '수염사자의 서재',
  author: '반창모',
  description: '책은 얼어붙은 바다를 깨뜨리는 도끼여야 한다 — 아이디어를 연결하고 사고 실험을 즐깁니다.',
  // 글 끝 글쓴이 상자의 한 줄 소개(사용자 노션 Vision 원문 그대로)와 그림 표기
  bio: '창의적인 개인이 넘쳐나는 세상을 꿈꿉니다.',
  artCredit: 'richa 그림',
}

export const PALETTE = ['lav', 'mint', 'peach', 'sky', 'butter', 'rose'] as const
export type PaletteKey = (typeof PALETTE)[number]
export type Category = { slug: string; name: string; color: PaletteKey }

// 분야 추가·수정은 이 목록 한 곳에서 한다. 순서는 머리띠·꼬리말·서가에 나오는 순서다.
// 색은 분야마다 명시한다 — 뜻이 가까운 분야끼리 한 색(철학·심리 / 경제·기술·AI / 역사·교육).
const CATEGORY_LIST: [slug: string, name: string, color: PaletteKey][] = [
  ['philosophy', '철학', 'lav'],
  ['history', '역사', 'butter'],
  ['literature', '문학', 'peach'],
  ['economy', '경제', 'sky'],
  ['education', '교육', 'butter'],
  ['nature', '생물·자연', 'mint'],
  ['psychology', '심리', 'lav'],
  ['tech', '기술·AI', 'sky'],
  ['art', '예술', 'rose'],
]

export const CATEGORIES: Category[] = CATEGORY_LIST.map(([slug, name, color]) => ({ slug, name, color }))

export function categoryByName(name: string): Category | undefined {
  return CATEGORIES.find((c) => c.name === name)
}
