import { createContext, useContext } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import type { Student } from '../../types'
import { useAuth } from '../../lib/auth'
import { SUPABASE_ON } from '../../lib/supabase'
import { useStore } from '../../lib/store'
import { clearLocalStudentId, getLocalStudentId, isStudentEmail, matchStudentByEmail } from '../../lib/role'

// ── 학생 셸 — #/student/* 공통 프레임 + 본인(Student) 컨텍스트 ──
// 매쓰플랫 학생앱 헤더 구조: 로고 | 학습 홈 · 챌린지 · 교재 · 학습지 · 강의 | 우측 학생명
// 1단계는 학습 홈·학습지만 활성, 챌린지·교재·강의는 자리만(준비 중 뱃지).

const Ctx = createContext<Student | null>(null)

export function useStudentSelf(): Student {
  const s = useContext(Ctx)
  if (!s) throw new Error('StudentShell missing')
  return s
}

const tab = ({ isActive }: { isActive: boolean }) =>
  `px-3.5 py-2 rounded-full text-[15px] font-bold transition ${
    isActive ? 'bg-pine-soft text-pine-dark' : 'text-ink2 hover:text-ink'
  }`

export default function StudentShell() {
  const { email, signOut } = useAuth()
  const { students, synced } = useStore()
  const nav = useNavigate()

  // 본인 판별: supabase 모드 = 세션 이메일 → 학생 레코드 / 로컬 모드 = 로컬 학생 세션
  let me: Student | undefined
  if (SUPABASE_ON) {
    if (!isStudentEmail(email)) return <Navigate to="/" replace />   // 선생님 계정 → 선생님 화면
    me = email ? matchStudentByEmail(students, email) : undefined
    if (!me) {
      if (!synced) return <div className="flex min-h-screen items-center justify-center text-ink2">불러오는 중…</div>
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="text-lg font-black">등록된 학생 정보를 찾을 수 없어요</div>
          <p className="max-w-sm text-sm text-ink2">
            계정({email})에 연결된 학생이 없습니다. 선생님께 문의해주세요.
          </p>
          <button onClick={() => signOut()}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-paper2">로그아웃</button>
        </div>
      )
    }
  } else {
    const sid = getLocalStudentId()
    me = sid ? students.find(s => s.id === sid) : undefined
    if (!me) return <Navigate to="/student-login" replace />
  }

  async function logout() {
    if (SUPABASE_ON) { await signOut() }
    else { clearLocalStudentId(); nav('/student-login', { replace: true }) }
  }

  return (
    <Ctx.Provider value={me}>
      <div className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-5 px-6 py-3">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black tracking-tight text-pine-dark">깊은생각</span>
              <span className="text-xl font-light text-ink">학습지</span>
            </div>
            <nav className="flex items-center gap-1">
              <NavLink to="/student" end className={tab}>학습 홈</NavLink>
              <NavLink to="/student/worksheets" className={tab}>학습지</NavLink>
              {['챌린지', '교재', '강의'].map(m => (
                <span key={m} title="2단계에서 열릴 예정이에요"
                  className="flex cursor-default items-center gap-1 px-3.5 py-2 text-[15px] font-bold text-ink2/40">
                  {m}
                  <span className="rounded bg-paper2 px-1 py-0.5 text-[9px] font-bold text-ink2/60">준비 중</span>
                </span>
              ))}
            </nav>
            <div className="grow" />
            <span className="text-sm font-bold">{me.name}<span className="ml-1 font-normal text-ink2">학생</span></span>
            <button onClick={logout}
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink2 hover:border-clay hover:text-clay">
              로그아웃
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </main>
      </div>
    </Ctx.Provider>
  )
}
