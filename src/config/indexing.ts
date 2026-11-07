// 시험 공개 중에는 검색에 나오지 않게 한다. 정식 공개 날 저장소 변수를 'true'로 넣을 때만 열린다.
// 변수를 빠뜨리거나 잘못 적으면 검색에 안 나올 뿐이라, 모르는 값은 모두 차단으로 읽는다.
export const blocksIndexing = (allow: string | undefined): boolean => allow !== 'true'
