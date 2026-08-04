// 자동 생성 — 오투(비상교육) 중등과학 교재 5권. 교재 채점용 매칭표는 /wb-match-<course>.json
// 인덱스(쪽·문항번호)+pool(유형·형태)를 zip해 생성. 정답은 학생용 답지 기준으로 입력 완료(자동 채점 가능).
export interface OtuBook { key: string; name: string; publisher: string; grade: string; course: string; count: number }
export const OTU_BOOKS: OtuBook[] = [
  { key: "오투 중등과학 1-1|비상교육", name: "오투 중등과학 1-1", publisher: "비상교육", grade: "중1-1", course: "m-sci1-1", count: 465 },
  { key: "오투 중등과학 1-2|비상교육", name: "오투 중등과학 1-2", publisher: "비상교육", grade: "중1-2", course: "m-sci1-2", count: 408 },
  { key: "오투 중등과학 2-1|비상교육", name: "오투 중등과학 2-1", publisher: "비상교육", grade: "중2-1", course: "m-sci2-1", count: 533 },
  { key: "오투 중등과학 2-2|비상교육", name: "오투 중등과학 2-2", publisher: "비상교육", grade: "중2-2", course: "m-sci2-2", count: 532 },
  { key: "오투 중등과학 3-2|비상교육", name: "오투 중등과학 3-2", publisher: "비상교육", grade: "중3-2", course: "m-sci3-2", count: 451 },
  { key: "오투 통합과학2|비상교육", name: "오투 통합과학2", publisher: "비상교육", grade: "통합과학2", course: "h-int2", count: 342 },
]
