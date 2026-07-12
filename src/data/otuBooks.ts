// 자동 생성 — 오투(비상교육) 중등과학 교재 5권. 교재 채점용 매칭표는 /wb-match-<course>.json
// 인덱스(쪽·문항번호)+pool(유형·형태)를 zip해 생성. 답은 OX채점(공란) — 선생님이 실물 교재로 채점.
export interface OtuBook { key: string; name: string; publisher: string; grade: string; course: string; count: number }
export const OTU_BOOKS: OtuBook[] = [
  { key: "오투 중등과학 1-1|비상교육", name: "오투 중등과학 1-1", publisher: "비상교육", grade: "중1-1", course: "m-sci1-1", count: 379 },
  { key: "오투 중등과학 1-2|비상교육", name: "오투 중등과학 1-2", publisher: "비상교육", grade: "중1-2", course: "m-sci1-2", count: 336 },
  { key: "오투 중등과학 2-1|비상교육", name: "오투 중등과학 2-1", publisher: "비상교육", grade: "중2-1", course: "m-sci2-1", count: 432 },
  { key: "오투 중등과학 2-2|비상교육", name: "오투 중등과학 2-2", publisher: "비상교육", grade: "중2-2", course: "m-sci2-2", count: 419 },
  { key: "오투 중등과학 3-2|비상교육", name: "오투 중등과학 3-2", publisher: "비상교육", grade: "중3-2", course: "m-sci3-2", count: 359 },
]
