// 자동 생성 — 올쏘(비상교육) 중학 사회·역사 8권. 교재 채점표는 /wb-match-<course>.json
// 22개정 정답과해설 PDF에서 정답 블록을 추출해 만들었다(개념 확인·대표 문제·주관식 서술형).
// 대표 문제처럼 쪽 범위로만 표기된 섹션은 문항 수로 균등 배분해 쪽을 매겼다.
export interface OlsoBook { key: string; name: string; publisher: string; grade: string; course: string; count: number; subject: "사회" | "역사" }
export const OLSO_BOOKS: OlsoBook[] = [
  { key: "올쏘 중학 사회①-1|비상교육", name: "올쏘 중학 사회①-1", publisher: "비상교육", grade: "중1-1", course: "m-soc1-1", count: 309, subject: "사회" },
  { key: "올쏘 중학 사회①-2|비상교육", name: "올쏘 중학 사회①-2", publisher: "비상교육", grade: "중1-2", course: "m-soc1-2", count: 286, subject: "사회" },
  { key: "올쏘 중학 사회②-1|비상교육", name: "올쏘 중학 사회②-1", publisher: "비상교육", grade: "중2-1", course: "m-soc2-1", count: 282, subject: "사회" },
  { key: "올쏘 중학 사회②-2|비상교육", name: "올쏘 중학 사회②-2", publisher: "비상교육", grade: "중2-2", course: "m-soc2-2", count: 270, subject: "사회" },
  { key: "올쏘 중학 역사①-1|비상교육", name: "올쏘 중학 역사①-1", publisher: "비상교육", grade: "중2-1", course: "m-his1-1", count: 289, subject: "역사" },
  { key: "올쏘 중학 역사①-2|비상교육", name: "올쏘 중학 역사①-2", publisher: "비상교육", grade: "중2-2", course: "m-his1-2", count: 245, subject: "역사" },
  { key: "올쏘 중학 역사②-1|비상교육", name: "올쏘 중학 역사②-1", publisher: "비상교육", grade: "중3-1", course: "m-his2-1", count: 232, subject: "역사" },
  { key: "올쏘 중학 역사②-2|비상교육", name: "올쏘 중학 역사②-2", publisher: "비상교육", grade: "중3-2", course: "m-his2-2", count: 214, subject: "역사" },
]
