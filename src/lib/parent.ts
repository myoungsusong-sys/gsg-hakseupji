// 학부모앱 — 세션(로컬) + 자녀 데이터 조회.
// 프로덕션(supabase): RLS 때문에 익명 읽기 불가 → 서버리스 /api/parent-data가 이름+연락처 검증 후 자녀 데이터만 반환.
// 로컬 모드: store 데이터에서 직접 매칭.
import type { Assignment, DailyNote, Grading, LecturePlan, ParentNotice, PointEntry, SavedReport, Student, Worksheet } from '../types'

export interface ParentSession { name: string; phone: string }
export interface ChildBundle {
  student: Pick<Student, 'id' | 'name' | 'grade' | 'klass' | 'classDays' | 'timetable'>
  academyName: string
  dailyNotes: DailyNote[]
  gradings: Grading[]
  ttChecks?: Record<string, true>   // 시간표 블록 완료 체크 (자녀 것만)
  lecturePlans?: LecturePlan[]      // 진도표 (자녀 것만) — 오늘 시간표의 쪽수 표시용
  pointEntries?: PointEntry[]       // 포인트 항목 (자녀 것만) — 용돈 내역 표시용
  homework?: ParentHomework[]       // 자녀가 받은 학습지·숙제(최근 60일) — 채점 상태는 gradings 로 판단
  reports?: SavedReport[]           // 선생님이 저장한 보고서(자녀 것만)
  notices?: ParentNotice[]          // 학원 공지(노출 켠 것만)
}
export interface ParentHomework { id: string; worksheetId: string; title: string; kind: Assignment['kind']; date: string; count: number }

/** 출제 기록 + 학습지 → 학부모에게 보여 줄 숙제 줄(예약 전·비공개·지운 학습지는 뺀다, 최근 60일) */
export function homeworkOf(assignments: Assignment[], worksheets: Pick<Worksheet, 'id' | 'title' | 'problemIds' | 'deletedAt' | 'studentHidden'>[], studentId: string, now = Date.now()): ParentHomework[] {
  const ws = new Map(worksheets.map(w => [w.id, w]))
  const cut = new Date(now - 60 * 864e5).toISOString()
  const out: ParentHomework[] = []
  for (const a of assignments) {
    if (a.studentId !== studentId || a.date < cut) continue
    if (a.scheduledAt && new Date(a.scheduledAt).getTime() > now) continue
    const w = ws.get(a.worksheetId)
    if (!w || w.deletedAt || w.studentHidden) continue
    out.push({ id: a.id, worksheetId: w.id, title: w.title, kind: a.kind, date: a.date, count: w.problemIds.length })
  }
  return out.sort((x, y) => y.date.localeCompare(x.date))
}

const KEY = 'gsg-parent-session'

export function getParentSession(): ParentSession | null {
  try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null } catch { return null }
}
export function setParentSession(s: ParentSession) { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* 무시 */ } }
export function clearParentSession() { try { localStorage.removeItem(KEY) } catch { /* 무시 */ } }

const digits = (s?: string) => (s || '').replace(/\D/g, '')

// 로컬 모드: store의 students/dailyNotes/gradings에서 자녀 매칭
export function matchChildLocal(
  students: Student[], dailyNotes: DailyNote[], gradings: Grading[], academyName: string,
  name: string, phone: string,
  ttChecks: Record<string, true> = {}, lecturePlans: LecturePlan[] = [], pointEntries: PointEntry[] = [],
  more: { assignments?: Assignment[]; worksheets?: Worksheet[]; savedReports?: SavedReport[]; notices?: ParentNotice[] } = {},
): ChildBundle | null {
  const n = name.trim(); const p = digits(phone)
  if (!n || p.length < 4) return null
  const me = students.find(s => s.active !== false && s.name.trim() === n && (() => {
    const pp = digits(s.parentPhone); return pp.length >= 4 && (pp === p || pp.endsWith(p) || p.endsWith(pp))
  })())
  if (!me) return null
  const mine: Record<string, true> = {}
  for (const k of Object.keys(ttChecks)) if (k.startsWith(`${me.id}|`)) mine[k] = true
  return {
    student: { id: me.id, name: me.name, grade: me.grade, klass: me.klass ?? '', classDays: me.classDays ?? [], timetable: me.timetable },
    academyName,
    dailyNotes: dailyNotes.filter(d => d.studentId === me.id),
    gradings: gradings.filter(g => g.studentId === me.id),
    ttChecks: mine,
    lecturePlans: lecturePlans.filter(p => p.studentId === me.id),
    pointEntries: pointEntries.filter(e => e.studentId === me.id),
    homework: homeworkOf(more.assignments ?? [], more.worksheets ?? [], me.id),
    reports: (more.savedReports ?? []).filter(r => r.studentId === me.id),
    notices: (more.notices ?? []).filter(x => !x.hidden),
  }
}

// 프로덕션: 서버리스로 검증 + 자녀 데이터
export async function fetchChildRemote(name: string, phone: string): Promise<ChildBundle> {
  const r = await fetch('/api/parent-data', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone }),
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    throw new Error(e.error || (r.status === 503 ? '학부모앱이 아직 설정되지 않았습니다.' : '조회에 실패했습니다.'))
  }
  return r.json()
}
