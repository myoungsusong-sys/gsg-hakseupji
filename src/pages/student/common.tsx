import { createContext, useContext } from 'react'
import type { Assignment, ExamOptions, Grading, Problem, Student, Worksheet } from '../../types'
import MathText from '../../components/MathText'

// ── 학생앱 공용 헬퍼 ────────────────────────────────────────────

// 본인(Student) 컨텍스트 — StudentShell(실사용)과 StudentAppPreview(선생님 미리보기)가 공급
export const StudentSelfCtx = createContext<Student | null>(null)

export function useStudentSelf(): Student {
  const s = useContext(StudentSelfCtx)
  if (!s) throw new Error('StudentShell missing')
  return s
}

// 선생님 미리보기 컨텍스트 — on=true면 보기 전용(제출·생성 버튼 비활성), go()로 미리보기 탭 전환
export type StudentMenu = 'home' | 'challenge' | 'workbooks' | 'worksheets' | 'lectures'
export interface PreviewNav { on: boolean; go: (menu: StudentMenu) => void }
export const PreviewCtx = createContext<PreviewNav>({ on: false, go: () => {} })
export function usePreview(): PreviewNav { return useContext(PreviewCtx) }

// 미리보기에서 액션 버튼에 붙일 공통 안내
export const PREVIEW_LOCK_TITLE = '미리보기는 보기 전용이에요 (실제 학생 데이터 보호)'

// 임시저장 (localStorage) — 문항 답이 바뀔 때마다 저장, 제출 시 삭제
export function draftKey(wsId: string): string {
  return `stu-draft-${wsId}`
}
export interface Draft { answers: Record<string, string>; at: string }
export function readDraft(wsId: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(wsId))
    if (!raw) return null
    const d = JSON.parse(raw) as Draft
    if (!d.answers || !Object.values(d.answers).some(v => v && v.trim())) return null
    return d
  } catch { return null }
}
export function writeDraft(wsId: string, answers: Record<string, string>): string {
  const at = new Date().toISOString()
  try { localStorage.setItem(draftKey(wsId), JSON.stringify({ answers, at } satisfies Draft)) } catch { /* 쿼터 초과 무시 */ }
  return at
}
export function clearDraft(wsId: string): void {
  localStorage.removeItem(draftKey(wsId))
}

// 이 학생의 학습지 최신 채점 (선생님 채점·학생 제출 모두 포함 — 최신 1건)
export function latestGradingFor(gradings: Grading[], studentId: string, wsId: string): Grading | undefined {
  let latest: Grading | undefined
  for (const g of gradings) {
    if (g.studentId !== studentId || g.source !== '학습지' || g.worksheetId !== wsId) continue
    if (!latest || g.date > latest.date) latest = g
  }
  return latest
}

export type StudentWsStatus = '학습가능' | '풀이중' | '학습완료'

export function statusOf(wsId: string, grading: Grading | undefined): StudentWsStatus {
  if (grading && grading.results.length > 0) return '학습완료'
  if (readDraft(wsId)) return '풀이중'
  return '학습가능'
}

export const STATUS_CLASS: Record<StudentWsStatus, string> = {
  학습가능: 'bg-pine-soft text-pine-dark',
  풀이중: 'bg-amber-soft text-amber',
  학습완료: 'bg-paper2 text-ink2',
}

// 배정 학습지 행 — 같은 학습지에 수업+숙제가 둘 다 있으면 1행으로 (첫 출제일 기준, kinds에 종류 집합)
export interface StudentWsRow { ws: Worksheet; date: string; kinds: Assignment['kind'][] }
export function myWorksheetRows(assignments: Assignment[], worksheets: Worksheet[], studentId: string): StudentWsRow[] {
  const byWs = new Map<string, { date: string; kinds: Set<Assignment['kind']> }>()   // wsId → 첫 출제일 + 종류
  for (const a of assignments) {
    if (a.studentId !== studentId) continue
    const cur = byWs.get(a.worksheetId)
    if (!cur) byWs.set(a.worksheetId, { date: a.date, kinds: new Set([a.kind]) })
    else { if (a.date < cur.date) cur.date = a.date; cur.kinds.add(a.kind) }
  }
  const rows: StudentWsRow[] = []
  for (const [wsId, v] of byWs) {
    const ws = worksheets.find(w => w.id === wsId)
    if (ws && !ws.deletedAt && !ws.studentHidden) rows.push({ ws, date: v.date, kinds: [...v.kinds] })   // 학생앱 비공개 학습지 제외
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date))
}

// ── ⏱ 시험 모드 ────────────────────────────────────────────────
// 「시험으로 출제」된 학습지는 응시 창(시작~마감)·제한시간·1회 응시 규칙을 받는다.
// 규칙은 학습지 단위로 같으므로 이 학생의 배정 중 exam 이 붙은 것 하나를 쓴다.
export function examOf(assignments: Assignment[], studentId: string, wsId: string): ExamOptions | undefined {
  return assignments.find(a => a.studentId === studentId && a.worksheetId === wsId && a.kind === '시험' && a.exam)?.exam
}

export type ExamGate =
  | { can: true; exam: ExamOptions }                       // 지금 응시할 수 있다
  | { can: false; why: '응시 완료' | '응시 전' | '마감'; msg: string; exam: ExamOptions }

// 지금 이 학생이 이 시험을 볼 수 있는지 — 볼 수 없으면 이유와 학생에게 보여줄 문장을 준다
export function examGate(exam: ExamOptions, graded: boolean, now = Date.now()): ExamGate {
  if (exam.once && graded)
    return { can: false, why: '응시 완료', msg: '이미 응시한 시험이에요. 결과만 볼 수 있어요.', exam }
  if (exam.openAt && now < Date.parse(exam.openAt))
    return { can: false, why: '응시 전', msg: `${fmtWhen(exam.openAt)}부터 응시할 수 있어요.`, exam }
  if (exam.closeAt && now > Date.parse(exam.closeAt))
    return { can: false, why: '마감', msg: `${fmtWhen(exam.closeAt)}에 마감된 시험이에요.`, exam }
  return { can: true, exam }
}

// 시험 시작 시각 — 기기에 남겨 새로고침해도 남은 시간이 이어진다(문항 임시저장과 같은 규약)
export const examStartKey = (wsId: string) => `stu-exam-start-${wsId}`
export function examStartedAt(wsId: string): number | null {
  const v = Number(localStorage.getItem(examStartKey(wsId)))
  return Number.isFinite(v) && v > 0 ? v : null
}
export function markExamStart(wsId: string): number {
  const cur = examStartedAt(wsId)
  if (cur) return cur
  const now = Date.now()
  localStorage.setItem(examStartKey(wsId), String(now))
  return now
}
export function clearExamStart(wsId: string): void {
  localStorage.removeItem(examStartKey(wsId))
}

// 남은 초 — 제한시간이 0(무제한)이면 null
export function examLeftSec(exam: ExamOptions, startedAt: number, now = Date.now()): number | null {
  if (!exam.minutes) return null
  const end = startedAt + exam.minutes * 60_000
  const hardEnd = exam.closeAt ? Math.min(end, Date.parse(exam.closeAt)) : end   // 마감이 더 이르면 마감이 끝이다
  return Math.max(0, Math.ceil((hardEnd - now) / 1000))
}

export function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function fmtWhen(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${p(d.getHours())}:${p(d.getMinutes())}`
}

// ── 학습 타이머 (매쓰플랫 "⏱ 접속 중 누적 학습시간" — 순공시간) ────────
// StudentShell이 접속(화면 표시) 중 1초 단위로 localStorage에 누적한다. 기기별 로컬 측정.
export function studyTimeKey(studentId: string, day: string): string {
  return `stu-time-${studentId}-${day}`
}
export function readStudySeconds(studentId: string, day: string): number {
  const n = Number(localStorage.getItem(studyTimeKey(studentId, day)))
  return Number.isFinite(n) && n > 0 ? n : 0
}
export function tickStudySecond(studentId: string, day: string): void {
  try { localStorage.setItem(studyTimeKey(studentId, day), String(readStudySeconds(studentId, day) + 1)) } catch { /* 쿼터 초과 무시 */ }
}
export function fmtHMS(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
export function fmtHM(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// 채점 결과 요약 — 총점은 학습지 전체 문항 기준 (미응답 = 오답 취급)
export function summaryOf(ws: Worksheet, g: Grading) {
  const total = ws.problemIds.length
  const correct = g.results.filter(r => r.correct).length
  const wrong = total - correct
  const score = total > 0 ? Math.round(correct / total * 100) : 0
  return { total, correct, wrong, score }
}

// ── 정답 표시 (WorksheetPanel SheetAnswer와 동일 규칙) ──────────
const CIRCLED = ['①', '②', '③', '④', '⑤']
export const isImgAnswer = (a: string) => /^https?:\/\/\S+\.(png|jpe?g|gif|webp)/i.test(a)

export function AnswerText({ p }: { p: Problem }) {
  const a = p.answer?.trim() ?? ''
  if (!a || ['.', '-'].includes(a)) return <span className="text-ink2/70">풀이참조</span>
  if (isImgAnswer(a)) return <img src={a} alt="정답" className="max-h-14 w-auto" />
  if (p.kind === '객관식') {
    const t = a.split(',').map(s => {
      const raw = s.trim()
      const idx = CIRCLED.indexOf(raw)
      const n = idx >= 0 ? idx + 1 : Number(raw)
      return n >= 1 && n <= 5 ? CIRCLED[n - 1] : raw
    }).join(', ')
    return <b>{t}</b>
  }
  if (a.includes('$')) return <MathText text={a} />
  if (/[\\{}^_]/.test(a)) return <MathText text={`$${a}$`} />
  return <b>{a}</b>
}
