export const SITE = {
  name: '수염사자의 서재',
  author: '수염사자',
  description: '책은 얼어붙은 바다를 깨뜨리는 도끼여야 한다 — 아이디어를 연결하고 사고 실험을 즐깁니다.',
  // 글 끝 글쓴이 상자의 한 줄 소개(사용자 노션 Vision 원문 그대로)와 그림 표기
  bio: '창의적인 개인이 넘쳐나는 세상을 꿈꿉니다.',
  artCredit: 'richa 그림',
}

export const PALETTE = ['lav', 'mint', 'peach', 'sky', 'butter', 'rose'] as const
export type PaletteKey = (typeof PALETTE)[number]
export type Category = { slug: string; name: string; color: PaletteKey }

// 분야 추가·수정은 이 목록 한 곳에서 한다. 순서는 머리띠·꼬리말·서가에 나오는 순서다.
// 분야는 학문 이름이 아니라 독자가 얻으러 오는 것으로 묶는다(서점의 생활 제안형 진열).
// 이름만 보고 안에 무엇이 있을지 맞힐 수 있어야 한다 — 맞지 않는 글은 다른 서가로 보낸다.
// 색은 분야마다 명시한다 — 뜻이 가까운 분야끼리 한 색(돈·AI 동향, 일과 학습·AI 생산성).
const CATEGORY_LIST: [slug: string, name: string, color: PaletteKey][] = [
  ['fact-check', '진실 혹은 거짓', 'peach'],
  ['learning', '일과 학습의 기술', 'butter'],
  ['philosophy', '철학의 아름다움', 'lav'],
  ['classics', '다시 보는 고전과 예술', 'rose'],
  ['economy', '돈과 세상의 원리', 'sky'],
  ['ai-work', '진짜 생산성을 늘리는 AI의 모든 것', 'butter'],
  ['tech', 'AI와 기술의 현재', 'sky'],
  ['nature', '인류와 생명의 수수께끼', 'mint'],
]

export const CATEGORIES: Category[] = CATEGORY_LIST.map(([slug, name, color]) => ({ slug, name, color }))

export function categoryByName(name: string): Category | undefined {
  return CATEGORIES.find((c) => c.name === name)
}
