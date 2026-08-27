import type { SchoolTimetable, Student } from '../types'

// ── 🏫 학교 수업 복습 ────────────────────────────────────────────────────────
//
// 명수쌤 2026-08-26:
//   "학생들의 시간표를 등록할게. 그럼 그날그날 학교수업한 내용을 (수학 제외) 복습하도록 할 거야.
//    만약 당일 내용이 많으면 주말에 완료해서 그 주에 마무리 짓는 걸로.
//    복습은 문제풀이 후 오답작성까지이니 맞게 체크리스트 만들어줘. 수학은 매일 할 거라서 제외!"
//
// 규칙 (이 파일이 정본):
//  ① 학교 시간표(월~금 · 과목명 목록)를 학생마다 등록한다. 같은 과목이 하루 2교시면 한 줄로 친다.
//  ② 그날 배운 과목이 그날의 복습 과제가 된다. **수학은 뺀다** — 매일 따로 하기 때문.
//  ③ 한 과목은 **두 칸**이다: 「문제풀이」 → 「오답작성」. 둘 다 체크해야 그 과목이 끝난 것이다.
//  ④ 못 끝낸 것은 사라지지 않고 **그 주 토·일로 넘어간다**(밀린 것). 일요일까지가 그 주 마감.
//  ⑤ 주가 바뀌면 지난 주 미완료는 「지난주 못 끝냄」으로 남는다 — 다음 주로는 끌고 가지 않는다.
//     (끌고 가면 밀린 것이 눈덩이가 되어 학생이 포기한다)

/** 복습에서 빼는 과목 — 수학은 매일 따로 한다 */
export const REVIEW_SKIP = ['수학'] as const
export const isSkipped = (subject: string) =>
  (REVIEW_SKIP as readonly string[]).includes(subject.replace(/\s/g, ''))

/** 학교 시간표에 넣기 좋은 과목 후보 (직접 입력도 된다) */
export const SCHOOL_SUBJECTS = [
  '국어', '영어', '과학', '사회', '역사', '도덕', '기술가정', '정보',
  '음악', '미술', '체육', '한문', '제2외국어', '진로',
] as const

export const WEEKDAYS = ['월', '화', '수', '목', '금'] as const
export const WEEK_ALL = ['월', '화', '수', '목', '금', '토', '일'] as const

export type Step = 'solve' | 'wrong'
export const STEP_LABEL: Record<Step, string> = { solve: '문제풀이', wrong: '오답작성' }

/** 체크 키 — `학생|날짜|과목|단계`. ttChecks 와 같은 꼴이라 저장 방식을 새로 만들지 않는다. */
export function reviewKey(studentId: string, date: string, subject: string, step: Step): string {
  return `${studentId}|${date}|${subject}|${step}`
}

/** YYYY-MM-DD → Date (로컬 자정) */
function toDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}
function keyOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 그 날짜가 속한 주의 월요일 */
export function mondayOf(dateKey: string): string {
  const d = toDate(dateKey)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return keyOf(d)
}

/** 그 주 월~일 날짜 7개 */
export function weekDays(dateKey: string): { key: string; label: typeof WEEK_ALL[number] }[] {
  const mon = toDate(mondayOf(dateKey))
  return WEEK_ALL.map((label, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return { key: keyOf(d), label }
  })
}

export interface ReviewItem {
  date: string                 // 배운 날 (그 과목이 있던 평일)
  day: typeof WEEK_ALL[number]
  subject: string
  solve: boolean
  wrong: boolean
  done: boolean                // 둘 다 끝남
  late: boolean                // 그날이 지났는데 안 끝남 = 밀린 것
}

/**
 * 그 주의 복습 목록을 만든다.
 * - 평일 시간표에서 과목을 뽑아 날짜별 항목으로 편다(수학 제외·중복 제거).
 * - `today` 기준으로 지난 날인데 안 끝난 것은 late=true (주말에 몰아서 하라고 띄운다).
 */
export function weekReview(
  student: Student,
  anyDateInWeek: string,
  checks: Record<string, true>,
  today: string,
): ReviewItem[] {
  const tt = student.schoolTimetable
  if (!tt) return []
  const out: ReviewItem[] = []
  for (const { key, label } of weekDays(anyDateInWeek)) {
    if (label === '토' || label === '일') continue      // 학교 수업이 없는 날
    const subs = (tt.days[label] ?? [])
      .map(s => s.trim())
      .filter(s => s && !isSkipped(s))
    const seen = new Set<string>()
    for (const subject of subs) {
      if (seen.has(subject)) continue                   // 하루 2교시여도 복습은 한 번
      seen.add(subject)
      const solve = !!checks[reviewKey(student.id, key, subject, 'solve')]
      const wrong = !!checks[reviewKey(student.id, key, subject, 'wrong')]
      const done = solve && wrong
      out.push({ date: key, day: label, subject, solve, wrong, done, late: !done && key < today })
    }
  }
  return out
}

/** 그 주 진행률 — 칸(과목×2) 기준 */
export function weekProgress(items: ReviewItem[]): { done: number; total: number; pct: number } {
  const total = items.length * 2
  const done = items.reduce((n, i) => n + (i.solve ? 1 : 0) + (i.wrong ? 1 : 0), 0)
  return { done, total, pct: total ? Math.round(done / total * 100) : 0 }
}

/** 시간표에 등록된 과목이 하나라도 있나 (수학 뺀 기준) */
export function hasSchoolTimetable(tt: SchoolTimetable | undefined): boolean {
  if (!tt) return false
  return WEEKDAYS.some(d => (tt.days[d] ?? []).some(s => s.trim() && !isSkipped(s)))
}

export const EMPTY_SCHOOL_TT: SchoolTimetable = {
  days: { 월: [], 화: [], 수: [], 목: [], 금: [] },
  updatedAt: '',
}
