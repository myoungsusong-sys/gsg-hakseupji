import type { Student } from '../types'

// ── 학생앱 역할 판별 ─────────────────────────────────────────────
// 학생별 Supabase 계정 이메일 규약: s-<loginId>@student.gsg.app
//   loginId = 학생 레코드의 loginId(있으면) 또는 출결번호(attendNo)
// 세션 이메일이 이 도메인이면 학생 모드 → #/student/* 만 접근 가능.

export const STUDENT_EMAIL_DOMAIN = 'student.gsg.app'
export const TEACHER_EMAIL_DOMAIN = 'teacher.gsg.app'

// 강사 계정 이메일 규약: t-<loginId>@teacher.gsg.app (원장 계정은 별개 — 실제 이메일)
export function teacherEmailOf(loginId: string): string {
  return `t-${loginId.trim().toLowerCase()}@${TEACHER_EMAIL_DOMAIN}`
}
export function isTeacherAccountEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith(`@${TEACHER_EMAIL_DOMAIN}`)
}

export function studentEmailOf(loginId: string): string {
  return `s-${loginId.trim().toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`
}

export function isStudentEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith(`@${STUDENT_EMAIL_DOMAIN}`)
}

// 이메일에서 loginId 부분 추출 — 's-1234@student.gsg.app' → '1234'
export function loginIdOfEmail(email: string): string {
  const m = email.trim().toLowerCase().match(/^s-(.+)@/)
  return m ? m[1] : ''
}

// 세션 이메일 → 학생 레코드 매칭: ①authEmail 직접 지정 ②loginId ③출결번호
export function matchStudentByEmail(students: Student[], email: string): Student | undefined {
  const e = email.trim().toLowerCase()
  const byAuth = students.find(s => (s.authEmail ?? '').trim().toLowerCase() === e)
  if (byAuth) return byAuth
  const lid = loginIdOfEmail(e)
  if (!lid) return undefined
  return students.find(s =>
    (s.loginId ?? '').trim().toLowerCase() === lid || (s.attendNo ?? '').trim() === lid)
}

// ── 로컬 모드(supabase 없음) 학생 세션 — 개발·검증용 ──────────────
// 학생 이름+출결번호 일치 시 입장. localStorage에 학생 id만 기록.
const LOCAL_KEY = 'gsg-student-session'

export function getLocalStudentId(): string | null {
  try { return localStorage.getItem(LOCAL_KEY) } catch { return null }
}
export function setLocalStudentId(id: string): void {
  localStorage.setItem(LOCAL_KEY, id)
}
export function clearLocalStudentId(): void {
  localStorage.removeItem(LOCAL_KEY)
}
