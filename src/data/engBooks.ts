/**
 * 📗 영어 교과서(출판사·저자) — 학생별로 "우리 학교가 쓰는 교과서"를 지정하는 데 쓴다.
 *
 * 🔴 왜 필요한가 (2026-09-12 명수쌤 지시: "학생 정보에 영어 교과서 추가해서 출판사별로 갈라줘")
 *    영어 내신 문항은 **그 교과서 본문이 지문**이다. 중1 동아(윤정미)를 쓰는 학생에게
 *    YBM(박준언) 본문 문제를 내면 처음 보는 지문이라 내신 대비가 되지 않는다.
 *    그래서 학생마다 교과서를 정해 두고, 영어 문항은 그 교과서 것만 나가게 한다.
 *
 * 목록은 exam4you 보유 자료(교사용=정답 포함)에서 실제로 확인된 것만 넣었다.
 * 교과서가 없거나 모르면 **미지정** 으로 두면 되고, 그때는 전부 나간다(유형 훈련용).
 */
export const ENG_BOOKS: Record<string, readonly string[]> = {
  'eng-m1': ['NE능률(김기택)', 'YBM(김은형)', 'YBM(박준언)', '동아(윤정미)', '동아(이병민)',
             '미래엔(문영인)', '비상(황종배)', '지학사(송미정)', '천재(소영순)', '천재(이상기)'],
  'eng-m2': ['NE능률(김기택)', 'YBM(김은형)', 'YBM(박준언)', '동아(윤정미)', '동아(이병민)',
             '미래엔(문영인)', '비상(황종배)', '지학사(송미정)', '천재(소영순)', '천재(이상기)'],
  'eng-m3': ['NE능률(김성곤)', 'NE능률(양현권)', 'YBM(박준언)', 'YBM(송미정)', '금성(최인철)',
             '동아(윤정미)', '동아(이병민)', '미래엔(최연희)', '비상(김진완)', '지학사(민찬규)',
             '천재(이재영)', '천재(정사열)'],
  'eng-h1': ['NE능률(민병천)', 'NE능률(오선영)', 'YBM(김은형)', 'YBM(박준언)', '동아(이병민)',
             '미래엔(김성연)', '비상(홍민표)', '지학사(신상근)', '천재(강상구)', '천재(조수경)'],
  'eng-h2': ['NE능률(오선영)', 'YBM(박준언)', '동아(박용예)', '미래엔(김성연)',
             '비상(홍민표)', '지학사(신상근)', '천재(강상구)', '천재(조수경)'],
  'eng-h3': ['NE능률(오선영)', 'YBM(박준언)', '동아(박용예)', '미래엔(김성연)',
             '비상(홍민표)', '지학사(신상근)', '천재(강상구)', '천재(조수경)'],
}

/** 화면에서 고를 수 있는 교과서 전부 (중복 제거) — 학생 정보 입력칸이 쓴다 */
export const ENG_BOOK_OPTIONS: { grade: string; books: readonly string[] }[] = [
  { grade: '중1', books: ENG_BOOKS['eng-m1'] },
  { grade: '중2', books: ENG_BOOKS['eng-m2'] },
  { grade: '중3', books: ENG_BOOKS['eng-m3'] },
  { grade: '고1 (공통영어1·2)', books: ENG_BOOKS['eng-h1'] },
  { grade: '고2 (영어I)', books: ENG_BOOKS['eng-h2'] },
  { grade: '고3 (영어II)', books: ENG_BOOKS['eng-h3'] },
]

/**
 * 학생의 교과서에 맞는 문항만 남긴다.
 *
 * · 학생이 교과서를 안 정했으면 **거르지 않는다** (전부 보여 준다 — 유형 훈련용)
 * · 교과서 표시가 없는 문항(`book` 없음)은 **본문에 매이지 않는 문항**이라 항상 남긴다
 *   (어휘·어법 문항, 우리가 만든 씨앗 문항 등)
 */
export function filterByEngBook<T extends { book?: string }>(items: T[], book?: string): T[] {
  if (!book) return items
  return items.filter((p) => !p.book || p.book === book)
}

/**
 * 📗 과(Lesson) — 시험범위 글자에서 과 번호를 읽는다 (2026-09-29 명수쌤 「영어가 출판사별로 문제가 되어 있지 않아」)
 *   「1~3과」「1과~3과」「Lesson 1-3」「L1~L3」「1, 2, 4과」「3과까지」 → [1,2,3] …
 *   못 읽으면 빈 배열(= 과로 거르지 않는다).
 */
export function parseLessons(text?: string): number[] {
  if (!text) return []
  const t = text.replace(/\s+/g, ' ').replace(/[Ll]esson\s*|L(?=\d)/g, '').replace(/단원|과/g, '과')
  const out = new Set<number>()
  // 구간: 1~3 · 1-3 · 1부터 3
  for (const m of t.matchAll(/(\d{1,2})\s*과?\s*(?:~|∼|-|–|부터)\s*(\d{1,2})\s*과?/g)) {
    const a = Number(m[1]), b = Number(m[2])
    if (a >= 1 && b >= a && b <= 20) for (let k = a; k <= b; k++) out.add(k)
  }
  // 낱개: 「2과」 또는 과 앞의 나열 「1, 2, 4과」
  for (const m of t.matchAll(/((?:\d{1,2}\s*[,·]\s*)*\d{1,2})\s*과/g)) m[1].split(/[,·]/).forEach(x => { const k = Number(x.trim()); if (k >= 1 && k <= 20) out.add(k) })
  // 「Lesson 5, 6」 처럼 과 글자 없이 나열 — Lesson/L 표기가 있었으면 숫자를 모두 과로
  if (/[Ll]esson|L\d/.test(text)) for (const m of t.matchAll(/\d{1,2}/g)) { const k = Number(m[0]); if (k >= 1 && k <= 20) out.add(k) }
  // 「까지」만 있으면 1과부터
  const upto = t.match(/(\d{1,2})\s*과?\s*까지/)
  if (upto && out.size <= 1) for (let k = 1; k <= Number(upto[1]); k++) out.add(k)
  return [...out].sort((a, b) => a - b)
}
/** 「6과」「공통영어2 1과」 → 과 번호 (Project 단원은 0 — 과 범위로 거를 때 빠진다) */
export const unitNum = (u?: string) => { const m = u?.match(/(\d+)\s*과/); return m ? Number(m[1]) : 0 }
/** 고1 공통영어는 한 과정에 1·2권이 같이 있다 — 「공통영어2 1과」 → '공통영어2' */
export const unitVol = (u?: string) => u?.match(/(공통영어[12])/)?.[1] ?? ''

/** 과 번호로 거른다 — 과를 안 골랐으면 그대로. vol 을 주면(고1: 1학기 '공통영어1' · 2학기 '공통영어2') 그 권만 */
export function filterByEngUnits<T extends { unit?: string }>(items: T[], lessons: number[], vol = ''): T[] {
  if (!lessons.length) return items
  const want = new Set(lessons)
  return items.filter(p => want.has(unitNum(p.unit)) && (!vol || !unitVol(p.unit) || unitVol(p.unit) === vol))
}

/** 과 이름으로 거른다(화면 칩에서 고른 것) */
export function filterByUnitNames<T extends { unit?: string }>(items: T[], names: string[]): T[] {
  if (!names.length) return items
  const want = new Set(names)
  return items.filter(p => !!p.unit && want.has(p.unit))
}

/** 문항 묶음에 있는 과 이름 목록 (화면 칩) — 권 → 과 번호 → Project 순 */
export function unitsIn<T extends { unit?: string }>(items: T[]): string[] {
  const key = (u: string) => `${unitVol(u)}|${unitNum(u) ? String(unitNum(u)).padStart(2, '0') : 'P' + u}`
  return [...new Set(items.map(p => p.unit).filter((u): u is string => !!u))].sort((a, b) => key(a).localeCompare(key(b)))
}
