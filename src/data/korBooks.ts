// 📘 국어 교과서(출판사·대표 저자)별 과정 (2026-09-30 명수쌤 「국어랑 영어는 출판사별로 해야돼」)
//   학교 국어 내신은 그 학교 교과서의 단원·작품에서 나온다 → 교과서 한 권(학기) = 과정 하나(curriculum-korbook.ts).
//   학생마다 Student.korBook 에 교과서를 적어 두면 유형 마스터·시험 범위 출제가 그 교과서 과정을 연다.
import { KORBOOK_COURSES, type KorBookCourse } from './curriculum-korbook'

/** 학생 정보 선택지 — 과정이 아직 없는 교과서도 고를 수 있게 고정 목록 */
export const KOR_BOOK_OPTIONS: { grade: string; books: string[] }[] = [
  { grade: '중1·중2 (22개정)', books: ['미래엔(민병곤)', '미래엔(신유식)', '비상(박영민)', '비상(박현숙)'] },
  { grade: '중3 (15개정)', books: ['미래엔(15개정)', '비상(15개정)'] },
  { grade: '고1 공통국어 (22개정)', books: ['비상(강호영)', '비상(박영민)'] },
  { grade: '고2·고3 선택 과목', books: ['비상'] },
]

const pub = (b: string) => b.replace(/\(.*$/, '').trim()

/** 교과서 과정이 학생 교과서와 맞나 — 고2·고3 선택 과목은 출판사만 맞으면 된다(과목마다 저자가 하나뿐) */
export function korBookMatch(c: KorBookCourse, korBook?: string): boolean {
  if (!korBook) return false
  if (c.book === korBook) return true
  return (c.grade === '고2' || c.grade === '고3') && pub(c.book) === pub(korBook)
}

/** 공통 과정(kor-m1 …)·학기·시험 과목 이름 → 학생 교과서 과정 id (없으면 undefined) */
export function korCourseFor(base: string, korBook?: string, sem?: 1 | 2, subject?: string): string | undefined {
  const cands = KORBOOK_COURSES.filter(c => c.base === base && korBookMatch(c, korBook))
  if (!cands.length) return undefined
  const n = (x: string) => x.replace(/\s/g, '')
  const s = n(subject ?? '')
  const byTitle = s ? cands.filter(c => n(c.title).includes(s) || s.includes(n(c.title))) : []
  // 고2·고3(과목별 과정, sem 0): 시험 과목을 알려 줬는데 그 과목 교과서 과정이 없으면 다른 과목으로 새지 않는다
  if (s && !byTitle.length && cands.every(c => !c.sem)) return undefined
  const pool = byTitle.length ? byTitle : cands
  const bySem = pool.find(c => c.sem === sem)
  if (bySem) return bySem.id
  // 한 출판사에 과목(문학·독서와 작문·화법과 언어 …)이 여럿인데 과목을 모르면 짐작하지 않는다(첫 과목으로 새지 않게)
  return pool.length === 1 ? pool[0].id : undefined
}

/** 지금 학기 — 8월부터 2학기 */
export const currentSem = (d = new Date()): 1 | 2 => (d.getMonth() + 1 >= 8 ? 2 : 1)
