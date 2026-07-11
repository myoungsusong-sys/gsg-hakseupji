// 학부모앱 — 세션(로컬) + 자녀 데이터 조회.
// 프로덕션(supabase): RLS 때문에 익명 읽기 불가 → 서버리스 /api/parent-data가 이름+연락처 검증 후 자녀 데이터만 반환.
// 로컬 모드: store 데이터에서 직접 매칭.
import type { DailyNote, Grading, Student } from '../types'

export interface ParentSession { name: string; phone: string }
export interface ChildBundle {
  student: Pick<Student, 'id' | 'name' | 'grade' | 'klass' | 'classDays'>
  academyName: string
  dailyNotes: DailyNote[]
  gradings: Grading[]
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
): ChildBundle | null {
  const n = name.trim(); const p = digits(phone)
  if (!n || p.length < 4) return null
  const me = students.find(s => s.active !== false && s.name.trim() === n && (() => {
    const pp = digits(s.parentPhone); return pp.length >= 4 && (pp === p || pp.endsWith(p) || p.endsWith(pp))
  })())
  if (!me) return null
  return {
    student: { id: me.id, name: me.name, grade: me.grade, klass: me.klass ?? '', classDays: me.classDays ?? [] },
    academyName,
    dailyNotes: dailyNotes.filter(d => d.studentId === me.id),
    gradings: gradings.filter(g => g.studentId === me.id),
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
