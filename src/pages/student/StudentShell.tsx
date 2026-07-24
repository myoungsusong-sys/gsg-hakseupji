import { useEffect } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import type { Student } from '../../types'
import { useAuth } from '../../lib/auth'
import { SUPABASE_ON } from '../../lib/supabase'
import { useStore } from '../../lib/store'
import { clearLocalStudentId, getLocalStudentId, isStudentEmail, matchStudentByEmail } from '../../lib/role'
import StudentHeaderExtras from '../../components/student/StudentHeaderExtras'
import { useChangelog, UpdateBanner } from '../../components/UpdateLog'
import { StudentSelfCtx, tickStudySecond } from './common'
import { todayKey } from '../../lib/dates'

// ── 학생 셸 — #/student/* 공통 프레임 + 본인(Student) 컨텍스트 ──
// 매쓰플랫 학생앱 헤더 구조: 로고 | 학습 홈 · 챌린지 · 교재 · 학습지 · 강의 | 우측 학생명
// 컨텍스트는 common.tsx의 StudentSelfCtx — 선생님 미리보기(StudentAppPreview)와 공유.

export { useStudentSelf } from './common'

const tab = ({ isActive }: { isActive: boolean }) =>
  `px-3.5 py-2 rounded-full text-[15px] font-bold transition ${
    isActive ? 'bg-pine-soft text-pine-dark' : 'text-ink2 hover:text-ink'
  }`

export default function StudentShell() {
  const { email, signOut } = useAuth()
  const { students, synced } = useStore()
  const nav = useNavigate()
  // 새 배포 감지 → 상단 업데이트 배너(선생님앱과 동일). 훅은 조건 반환 전에 호출.
  const { entries: changelog, stale, unseen } = useChangelog()

  // 본인 판별: supabase 모드 = 세션 이메일 → 학생 레코드 / 로컬 모드 = 로컬 학생 세션
  // 관리앱 [채점하러 가기]로 넘어온 학생은 세션 없이 로컬 학생 세션으로 진입하므로, 로컬 세션을 먼저 본다.
  let me: Student | undefined
  const localSid = getLocalStudentId()
  const localMe = localSid ? students.find(s => s.id === localSid) : undefined
  if (localMe) {
    me = localMe
  } else if (SUPABASE_ON) {
    me = email && isStudentEmail(email) ? matchStudentByEmail(students, email) : undefined
  }

  // 학습 타이머 — 접속(화면 표시) 중 1초 단위 누적 (매쓰플랫 ⏱ 순공시간)
  const meId = me?.id
  useEffect(() => {
    if (!meId) return
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') tickStudySecond(meId, todayKey())
    }, 1000)
    return () => clearInterval(t)
  }, [meId])

  if (SUPABASE_ON && !localMe) {
    // 로컬 학생 세션(관리앱 연동 진입)이 아니면 이메일 기반으로 본인을 검증한다.
    if (!isStudentEmail(email)) return <Navigate to="/" replace />   // 선생님 계정 → 선생님 화면
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
  } else if (!me) {
    if (!synced) return <div className="flex min-h-screen items-center justify-center text-ink2">불러오는 중…</div>
    return <Navigate to="/student-login" replace />
  }

  async function logout() {
    clearLocalStudentId()   // 관리앱 연동 진입 학생도 세션 정리
    if (SUPABASE_ON && email) { await signOut() }
    else nav('/student-login', { replace: true })
  }

  return (
    <StudentSelfCtx.Provider value={me}>
      <div className="min-h-screen">
        {stale && <UpdateBanner items={unseen.length ? unseen : changelog.slice(0, 1)} />}
        <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-5 px-6 py-3">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black tracking-tight text-pine-dark">깊은생각</span>
              <span className="text-xl font-light text-ink">학습지</span>
            </div>
            <nav className="flex items-center gap-1">
              <NavLink to="/student" end className={tab}>학습 홈</NavLink>
              <NavLink to="/student/challenge" className={tab}>챌린지</NavLink>
              <NavLink to="/student/workbooks" className={tab}>교재</NavLink>
              <NavLink to="/student/worksheets" className={tab}>학습지</NavLink>
              <NavLink to="/student/lectures" className={tab}>강의</NavLink>
            </nav>
            <div className="grow" />
            <StudentHeaderExtras me={me} onLogout={logout} />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </main>
      </div>
    </StudentSelfCtx.Provider>
  )
}
