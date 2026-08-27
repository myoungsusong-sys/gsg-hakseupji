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

// ── 어떤 과목을 복습시키나 ──────────────────────────────────────────────
// 명수쌤 2026-08-26: "국어, 수학, 과학, 사회, 영어만 복습하게 해줘."
// → 체육·음악·정보·과탐실·원어민회화·자율처럼 **문제풀이가 없는 과목은 뺀다.**
//
// 🔴 수학은 그 다섯에 들어가지만 **복습 목록에서는 계속 뺀다** — 바로 앞 지시가
//    "수학은 매일 할 거라서 제외!" 였고, 기본과제로 매일 따로 나가기 때문이다.
//    (수학도 넣기로 하면 MATH_IS_REVIEWED 만 true 로 바꾸면 된다)
const MATH_IS_REVIEWED = false

// 학교 시간표에는 「국어」라고 안 적혀 있다 — 「공통국어2」·「독서」·「문학」처럼 적힌다.
// 그래서 이름 조각으로 계열을 가른다.
const SUBJECT_GROUPS: { group: string; hints: readonly string[] }[] = [
  { group: '수학', hints: ['수학', '미적', '대수', '확통', '확률과통계', '기하'] },
  { group: '국어', hints: ['국어', '독서', '문학', '화작', '화법', '작문', '언매', '언어와매체', '고전'] },
  { group: '영어', hints: ['영어', '영독', '영작', '영문'] },
  { group: '과학', hints: ['과학', '물리', '화학', '생명', '생물', '지구', '과탐'] },
  { group: '사회', hints: ['사회', '한국사', '역사', '지리', '정치', '경제', '윤리', '법과', '사탐'] },
]
const MATH_EXACT = ['수Ⅰ', '수Ⅱ', '수1', '수2', '수I', '수II'] as const

// 🔴 계열에는 걸리지만 **문제풀이가 없는 수업**은 뺀다 (2026-08-26 실측:
//    「과탐실」이 과학으로, 「영어 원어민」이 영어로 잡혔다). 실험·회화·자습은 복습 과제가 아니다.
// ('과탐실' 은 「실험」을 포함하지 않는다 — 실측에서 과학으로 잡혀 목록에 남았다.
//  '실' 한 글자로 거르면 「실용국어」·「실용영어」까지 죽으므로 줄임말을 직접 적는다)
const NOT_REVIEW = [
  '실험', '탐구실', '과탐실', '사탐실', '원어민', '회화', '자율', '자습', '창체', '진로', '안전', '보충',
] as const

/** 그 과목이 어느 계열인가 — 못 찾으면 null (복습 대상 아님) */
export function groupOf(subject: string): string | null {
  const n = subject.replace(/\s/g, '')
  if ((NOT_REVIEW as readonly string[]).some(h => n.includes(h))) return null
  if ((MATH_EXACT as readonly string[]).includes(n)) return '수학'
  for (const g of SUBJECT_GROUPS) if (g.hints.some(h => n.includes(h))) return g.group
  return null
}

/** 복습 목록에서 빼는가 — ①다섯 계열이 아니거나 ②수학이면 뺀다 */
export function isSkipped(subject: string): boolean {
  const g = groupOf(subject)
  if (!g) return true
  if (g === '수학') return !MATH_IS_REVIEWED
  return false
}

/** 학교 시간표에 넣기 좋은 과목 후보 (직접 입력도 된다) */
export const SCHOOL_SUBJECTS = [
  '국어', '영어', '과학', '사회', '역사', '도덕', '기술가정', '정보',
  '음악', '미술', '체육', '한문', '제2외국어', '진로',
] as const

/** 복습 다섯 계열 — 화면 안내용 */
export const REVIEW_GROUPS = ['국어', '수학', '과학', '사회', '영어'] as const

export const WEEKDAYS = ['월', '화', '수', '목', '금'] as const
export const WEEK_ALL = ['월', '화', '수', '목', '금', '토', '일'] as const

// 🔴 명수쌤 2026-08-26: "문제풀이 전에 복습노트정리 넣어줘." → 세 칸이 순서대로다.
//    노트로 한 번 정리하고 → 문제를 풀고 → 틀린 것을 오답노트에 쓴다. 셋 다 해야 그 과목이 끝난다.
export const STEPS = ['note', 'solve', 'wrong'] as const
export type Step = typeof STEPS[number]
export const STEP_LABEL: Record<Step, string> = {
  note: '복습노트정리', solve: '문제풀이', wrong: '오답작성',
}

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
  group: string                // 국어·영어·과학·사회 (수학은 지금 안 나온다)
  note: boolean                // 복습노트정리
  solve: boolean               // 문제풀이
  wrong: boolean               // 오답작성
  done: boolean                // 셋 다 끝남
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
  // 🔴 시간표를 넣기 **전날들**은 복습 과제가 아니다. 안 그러면 등록하자마자
  //    「밀린 것 16과목」이 뜬다(2026-08-26 실측). 등록한 날부터 센다.
  const from = (tt.updatedAt || '').slice(0, 10)
  const out: ReviewItem[] = []
  for (const { key, label } of weekDays(anyDateInWeek)) {
    if (label === '토' || label === '일') continue      // 학교 수업이 없는 날
    if (from && key < from) continue
    const subs = (tt.days[label] ?? [])
      .map(s => s.trim())
      .filter(s => s && !isSkipped(s))
    const seen = new Set<string>()
    for (const subject of subs) {
      if (seen.has(subject)) continue                   // 하루 2교시여도 복습은 한 번
      seen.add(subject)
      const note = !!checks[reviewKey(student.id, key, subject, 'note')]
      const solve = !!checks[reviewKey(student.id, key, subject, 'solve')]
      const wrong = !!checks[reviewKey(student.id, key, subject, 'wrong')]
      const done = note && solve && wrong
      out.push({
        date: key, day: label, subject, group: groupOf(subject) ?? '',
        note, solve, wrong, done, late: !done && key < today,
      })
    }
  }
  return out
}

/** 그 주 진행률 — 칸(과목 × 3단계) 기준 */
export function weekProgress(items: ReviewItem[]): { done: number; total: number; pct: number } {
  const total = items.length * STEPS.length
  const done = items.reduce((n, i) => n + (i.note ? 1 : 0) + (i.solve ? 1 : 0) + (i.wrong ? 1 : 0), 0)
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
