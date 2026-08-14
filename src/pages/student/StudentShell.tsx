import { useEffect } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import type { Student } from '../../types'
import { useAuth } from '../../lib/auth'
import { SUPABASE_ON } from '../../lib/supabase'
import { useStore } from '../../lib/store'
import { clearLocalStudentId, getLocalStudentId, isStudentEmail, matchStudentByEmail, MGMT_KEY } from '../../lib/role'
import StudentHeaderExtras from '../../components/student/StudentHeaderExtras'
import FixItButton from '../../components/FixItButton'
import { useChangelog, UpdateBanner } from '../../components/UpdateLog'
import { StudentSelfCtx, tickStudySecond } from './common'
import { todayKey } from '../../lib/dates'
import TeacherCallOverlay from '../../components/student/TeacherCallOverlay'
import { BrandLogo } from '../../components/BrandMark'

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
  const { allStudents: students, synced } = useStore()   // 지점 무관 — 학생 본인 매칭은 전원 대상
  const nav = useNavigate()
  // 새 배포 감지 → 상단 업데이트 배너(선생님앱과 동일). 훅은 조건 반환 전에 호출.
  const { entries: changelog, stale, unseen } = useChangelog()

  // 본인 판별: supabase 모드 = **세션 이메일이 유일한 기준** / 로컬 모드 = 로컬 학생 세션
  // ⚠️ 예전에는 로컬 학생 세션(localStorage)을 세션보다 먼저 봤다 → 앞 학생이 남긴 값 때문에
  //    좌석 태블릿에 **엉뚱한 학생**이 뜰 수 있었다. 계정이 있는 실서버에서는 계정이 진실이다. (2026-07-29)
  let me: Student | undefined
  const localSid = getLocalStudentId()
  if (SUPABASE_ON) {
    me = email && isStudentEmail(email) ? matchStudentByEmail(students, email) : undefined
  } else {
    me = localSid ? students.find(s => s.id === localSid) : undefined
  }
  // 관리앱 [채점하러 가기]로 들어온 자리 주인 — 로그인된 계정과 다르면 알려준다
  const seatMgmtId = (() => { try { return sessionStorage.getItem(MGMT_KEY) } catch { return null } })()
  const wrongSeat = !!(seatMgmtId && me?.mgmtId && me.mgmtId !== seatMgmtId)

  // 학습 타이머 — 접속(화면 표시) 중 1초 단위 누적 (매쓰플랫 ⏱ 순공시간)
  const meId = me?.id
  useEffect(() => {
    if (!meId) return
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') tickStudySecond(meId, todayKey())
    }, 1000)
    return () => clearInterval(t)
  }, [meId])

  if (SUPABASE_ON) {
    // 이메일 기반으로 본인을 검증한다.
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
        {/* 🚨 이 태블릿 자리 주인과 로그인된 계정이 다르다 — 앞 학생 계정으로 채점되는 사고를 막는다 */}
        {wrongSeat && (
          <div className="flex flex-wrap items-center gap-3 bg-clay px-5 py-2.5 text-sm font-bold text-white">
            <span>⚠️ 이 자리의 학생이 아니라 <b>{me.name}</b> 계정으로 로그인돼 있어요. 내 계정이 맞나요?</span>
            <button onClick={logout} className="ml-auto rounded-full bg-white/20 px-3 py-1 font-extrabold hover:bg-white/30">
              내 계정으로 바꾸기
            </button>
          </div>
        )}
        {/* 📢 선생님 호출 — 어느 화면에 있든 보이게 헤더 위에 둔다 */}
        <TeacherCallOverlay studentId={me.id} name={me.name} />
        <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-5 px-6 py-3">
            <div className="flex items-baseline gap-2">
              <BrandLogo />
            </div>
            {/* 🏫 관리앱(대치스파르타 프리미엄) 학생앱에서 [채점하러 가기]로 넘어온 경우 돌아가는 길.
                (2026-07-27 명수쌤 "학습지앱으로 갔다가 원래 앱으로 어떻게 돌아가?")
                새 탭으로 열렸으면 그 탭을 닫아 원래 화면으로 돌아가고, 안 닫히면 관리앱 학생 화면으로 이동한다. */}
            {me.mgmtId && (
              <button
                onClick={() => {
                  window.close()
                  window.setTimeout(() => { window.location.href = 'https://daechisparta.vercel.app/student' }, 250)
                }}
                className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm font-bold text-ink2 hover:bg-paper2"
                title="대치스파르타 프리미엄 학생 화면으로 돌아갑니다"
              >← 프리미엄앱</button>
            )}
            <nav className="flex items-center gap-1">
              <NavLink to="/student" end className={tab}>학습 홈</NavLink>
              <NavLink to="/student/challenge" className={tab}>챌린지</NavLink>
              <NavLink to="/student/workbooks" className={tab}>교재</NavLink>
              <NavLink to="/student/worksheets" className={tab}>학습지</NavLink>
              <NavLink to="/student/lectures" className={tab}>강의</NavLink>
            </nav>
            <div className="grow" />
            <FixItButton app="student" synced={synced} who={me.name} />
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
