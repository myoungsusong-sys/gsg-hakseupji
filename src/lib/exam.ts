import type { Assignment, SchoolExam, SchoolExamDay, Student, Worksheet } from '../types'
import { dateKey, weekdayOf } from './dates'
import { groupOf } from './schoolReview'

// ── 🏫 학교 시험 일정 → D-day → 대비 계획 (2026-09-17) ───────────────────────
//
// 명수쌤: "시험대비를 해야 해. 학생들 시험일정을 올리면 거기에 맞게 준비할 수 있도록 앱에 만들어줘.
//          학생들이 입력하게 해줘."
//
//   · 학생이 학생앱(학습 홈 › 🏫 학교 시험)에서 시험 이름 · 날짜별 과목 · 과목별 범위를 넣는다.
//   · 이 파일이 D-day 와 **시기별 대비 계획**을 정한다. 화면(학생 홈 카드 · 선생님 내신 대비 표 · 오늘 할 일)은 이것만 그린다.
//   · 시기: D-15 이전 개념 정리 → D-14~8 문제 풀이 → D-7~4 기출·변형 → D-3~1 오답·암기 → 시험 기간.
//     과목 계열(국·수·영·과·사)마다 그 시기에 할 일이 다르다 — 앱의 실제 화면 이름으로 적는다.

export const EXAM_NAMES = ['1학기 중간고사', '1학기 기말고사', '2학기 중간고사', '2학기 기말고사', '모의고사', '수행평가'] as const

/** "국어, 수학 · 영어/과학" → ['국어','수학','영어','과학'] */
export function parseSubjects(text: string): string[] {
  const out: string[] = []
  for (const raw of text.split(/[,，·、/;\n]+/)) {
    const s = raw.replace(/\s+/g, ' ').trim()
    if (s && !out.includes(s)) out.push(s)
  }
  return out
}
export function normalizeExam(e: SchoolExam): SchoolExam {
  const days = e.days
    .map(d => ({ date: d.date.trim(), subjects: d.subjects.map(s => s.trim()).filter(Boolean) }))
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date))
    .sort((a, b) => a.date.localeCompare(b.date))
  const subjects = new Set(days.flatMap(d => d.subjects))
  const ranges: Record<string, string> = {}
  for (const [k, v] of Object.entries(e.ranges ?? {})) if (subjects.has(k) && v.trim()) ranges[k] = v.trim()
  return { ...e, name: e.name.trim(), days, ranges, memo: e.memo?.trim() || undefined }
}
export const examSubjects = (e: SchoolExam) => [...new Set(e.days.flatMap(d => d.subjects))]
export const examStart = (e: SchoolExam) => e.days[0]?.date ?? ''
export const examEnd = (e: SchoolExam) => e.days[e.days.length - 1]?.date ?? ''

/** today → date 까지 며칠 (같은 날 0, 지났으면 음수) */
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86400000)
}
export type ExamState = 'upcoming' | 'during' | 'past'
export function examState(e: SchoolExam, today: string): { state: ExamState; dDay: number } {
  if (!e.days.length) return { state: 'past', dDay: 0 }
  const dDay = daysUntil(examStart(e), today)
  if (dDay > 0) return { state: 'upcoming', dDay }
  if (daysUntil(examEnd(e), today) >= 0) return { state: 'during', dDay }
  return { state: 'past', dDay }
}
export const examsOfStudent = (exams: SchoolExam[], studentId: string) => exams.filter(e => e.studentId === studentId)
/** 아직 안 끝난 시험 중 가장 가까운 것 */
export function upcomingExamOf(exams: SchoolExam[], studentId: string, today: string): SchoolExam | undefined {
  return examsOfStudent(exams, studentId)
    .filter(e => e.days.length && examState(e, today).state !== 'past')
    .sort((a, b) => examStart(a).localeCompare(examStart(b)))[0]
}
export const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}(${weekdayOf(date)})`
export const dayLabel = (d: SchoolExamDay) => `${md(d.date)} ${d.subjects.join('·') || '(과목 없음)'}`
export const dDayLabel = (dDay: number) => (dDay > 0 ? `D-${dDay}` : dDay === 0 ? 'D-DAY' : `D+${-dDay}`)

// ── 시기별 대비 계획 ───────────────────────────────────────────────────────────
export interface ExamPhase { key: 'concept' | 'practice' | 'past' | 'review' | 'during'; label: string; hint: string }
export function examPhase(e: SchoolExam, today: string): ExamPhase {
  const { state, dDay } = examState(e, today)
  if (state === 'during') return { key: 'during', label: '시험 기간', hint: '오늘 볼 과목을 확인하고, 내일 과목의 오답만 봅니다. 새것은 안 합니다.' }
  if (dDay >= 15) return { key: 'concept', label: '개념 정리', hint: '범위를 처음부터 훑습니다. 교과서·노트를 정리하고 빈칸으로 외웠는지 확인합니다.' }
  if (dDay >= 8) return { key: 'practice', label: '문제 풀이', hint: '범위의 교재 문제를 풀고 채점합니다. 틀린 유형은 그 자리에서 다시.' }
  if (dDay >= 4) return { key: 'past', label: '기출·변형', hint: '학교 기출과 내신 대비 학습지를 시간 재고 풉니다. 서술형 답을 손으로 씁니다.' }
  return { key: 'review', label: '오답·암기', hint: '새 문제 대신 틀린 것만 다시. 외울 것(단어·공식·용어)을 마지막으로 점검합니다.' }
}
export interface ExamTask { subject: string; text: string; link?: string; linkLabel?: string }
/** 그 시기에 과목별로 할 일 — 학생앱 화면 이름으로 */
export function examTasks(e: SchoolExam, today: string): ExamTask[] {
  const phase = examPhase(e, today).key
  const { state } = examState(e, today)
  const out: ExamTask[] = []
  const subs = state === 'during'
    ? [...new Set(e.days.filter(d => daysUntil(d.date, today) >= 0).slice(0, 2).flatMap(d => d.subjects))]
    : examSubjects(e)
  for (const sub of subs) {
    const g = groupOf(sub) ?? '기타'
    const r = e.ranges?.[sub] ? ` (${e.ranges[sub]})` : ''
    if (g === '수학') {
      if (phase === 'concept') out.push({ subject: sub, text: `범위 교재 개념·예제 풀고 채점${r}`, link: '/student/workbooks', linkLabel: '교재' })
      else if (phase === 'practice') out.push({ subject: sub, text: `범위 유형 문제 풀기 → 틀린 유형은 챌린지${r}`, link: '/student/challenge', linkLabel: '챌린지' })
      else if (phase === 'past') out.push({ subject: sub, text: '내신 대비 학습지·학교 기출 시간 재고 풀기', link: '/student/worksheets', linkLabel: '학습지' })
      else out.push({ subject: sub, text: '틀린 문제만 다시 풀기 · 서술형 풀이 손으로 쓰기', link: '/student/worksheets', linkLabel: '학습지' })
    } else if (g === '영어') {
      if (phase === 'concept') out.push({ subject: sub, text: `교과서 본문 해석·단어 정리${r} · 오늘 영단어`, link: '/student/voca', linkLabel: '영단어' })
      else if (phase === 'practice') out.push({ subject: sub, text: '본문 빈칸·어법 문제 풀기 · 영어 테스트 학습지', link: '/student/worksheets', linkLabel: '학습지' })
      else if (phase === 'past') out.push({ subject: sub, text: '학교 기출·변형 문제 시간 재고 풀기', link: '/student/worksheets', linkLabel: '학습지' })
      else out.push({ subject: sub, text: '틀린 문장·단어 다시 외우기 · 서술형 영작 손으로 쓰기', link: '/student/voca', linkLabel: '영단어' })
    } else {
      // 국어 · 과학 · 사회 · 기타 — 학교 복습 3단계(노트 정리 → 문제 풀기 → 오답 쓰기)와 같은 규칙
      if (phase === 'concept') out.push({ subject: sub, text: `범위 노트 정리 → 빈칸으로 외웠는지 확인${r}`, link: '/student', linkLabel: '학교 복습' })
      else if (phase === 'practice') out.push({ subject: sub, text: '범위 문제 풀기 → 오답 쓰기', link: '/student', linkLabel: '학교 복습' })
      else if (phase === 'past') out.push({ subject: sub, text: '학교 기출·내신 대비 학습지 풀기', link: '/student/worksheets', linkLabel: '학습지' })
      else out.push({ subject: sub, text: '오답 노트 다시 보기 · 용어·연도·공식 외우기', link: '/student', linkLabel: '학교 복습' })
    }
  }
  return out
}

// ── 선생님용 집계 ─────────────────────────────────────────────────────────────
/** 그 학생에게 최근 3주 안에 나간 내신 대비 학습지 수 (내신 대비 화면 [출제하기] = 제목 '내신대비 |') */
export function naesinSheetsFor(studentId: string, worksheets: Worksheet[], assignments: Assignment[], today: string): number {
  const ids = new Set(assignments.filter(a => a.studentId === studentId).map(a => a.worksheetId))
  return worksheets.filter(w => ids.has(w.id) && !w.deletedAt
    && (w.title.startsWith('내신대비') || (w.tags ?? []).includes('내신대비'))
    && daysUntil(dateKey(w.createdAt), today) >= -21).length
}
export interface ExamRow { st: Student; exam?: SchoolExam; dDay?: number; state?: ExamState; sheets: number }
export function examRows(students: Student[], exams: SchoolExam[], worksheets: Worksheet[], assignments: Assignment[], today: string): ExamRow[] {
  return students.map(st => {
    const exam = upcomingExamOf(exams, st.id, today)
    const es = exam ? examState(exam, today) : undefined
    return { st, exam, dDay: es?.dDay, state: es?.state, sheets: naesinSheetsFor(st.id, worksheets, assignments, today) }
  }).sort((a, b) => {
    if (!a.exam || !b.exam) return a.exam ? -1 : b.exam ? 1 : a.st.name.localeCompare(b.st.name, 'ko')
    return examStart(a.exam).localeCompare(examStart(b.exam)) || a.st.name.localeCompare(b.st.name, 'ko')
  })
}
