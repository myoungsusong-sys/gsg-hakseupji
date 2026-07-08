import { createContext, useContext } from 'react'
import type { Assignment, Grading, Problem, Student, Worksheet } from '../../types'
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

// 배정 학습지 행 — 같은 학습지에 수업+숙제가 둘 다 있으면 1행으로 (첫 출제일 기준)
export interface StudentWsRow { ws: Worksheet; date: string }
export function myWorksheetRows(assignments: Assignment[], worksheets: Worksheet[], studentId: string): StudentWsRow[] {
  const byWs = new Map<string, string>()   // wsId → 첫 출제일
  for (const a of assignments) {
    if (a.studentId !== studentId) continue
    const cur = byWs.get(a.worksheetId)
    if (!cur || a.date < cur) byWs.set(a.worksheetId, a.date)
  }
  const rows: StudentWsRow[] = []
  for (const [wsId, date] of byWs) {
    const ws = worksheets.find(w => w.id === wsId)
    if (ws && !ws.deletedAt) rows.push({ ws, date })
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date))
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
