import { useEffect } from 'react'
import { HashRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { StoreProvider, useStore } from './lib/store'
import { SUPABASE_ON } from './lib/supabase'
import { AuthProvider, useAuth } from './lib/auth'
import { getLocalStudentId, setLocalStudentId, isStudentEmail, MGMT_KEY } from './lib/role'
import Login from './pages/Login'
import StudentShell from './pages/student/StudentShell'
import StudentLocalLogin from './pages/student/StudentLocalLogin'
import ParentLogin from './pages/parent/ParentLogin'
import ParentHome from './pages/parent/ParentHome'
import StudentHome from './pages/student/StudentHome'
import StudentWorksheets from './pages/student/StudentWorksheets'
import StudentSolve from './pages/student/StudentSolve'
import StudentResult from './pages/student/StudentResult'
import StudentWorkbooks from './pages/student/StudentWorkbooks'
import StudentChallenge from './pages/student/StudentChallenge'
import StudentLectures from './pages/student/StudentLectures'
import Layout from './components/Layout'
import SaveGuard from './components/SaveGuard'
import PrepLayout from './components/PrepLayout'
import Placeholder from './components/Placeholder'
import WorksheetPage from './pages/WorksheetPage'
import MakeWizard from './pages/MakeWizard'
import WorksheetView from './pages/WorksheetView'
import DiagnosisReport from './pages/DiagnosisReport'
import TimetablePage from './pages/TimetablePage'
import PointsPage from './pages/PointsPage'
import FormsPage from './pages/FormsPage'
import Materials from './pages/Materials'
import NaesinPrep from './pages/NaesinPrep'
import TestPrep from './pages/TestPrep'
import Lesson from './pages/Lesson'
import TodayRoom from './pages/TodayRoom'
import Students from './pages/Students'
import MyPage from './pages/MyPage'
import CsatLibrary from './pages/CsatLibrary'
import GichulView from './pages/GichulView'
import GichulTag from './pages/GichulTag'
import ArithmeticGen from './pages/ArithmeticGen'
import LecturePage from './pages/LecturePage'
import EssayPage from './pages/EssayPage'
import WorksheetUpload from './pages/WorksheetUpload'

function Page({ children }: { children: React.ReactNode }) {
  return <div className="print-page-reset mx-auto w-full px-6 py-8">{children}</div>
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
      {/* 못 올린 저장이 남아 있으면 어느 화면에서든 보이게 — 로그인 화면 포함 */}
      <SaveGuard />
    </AuthProvider>
  )
}

// 관리앱 [채점하러 가기]로 넘어온 학생(?mgmt=<관리앱학생id>)을 찾아 학생앱으로 진입시킨다.
// 학생 명부(hj_students)가 로드되면 mgmtId가 일치하는 학생을 찾아 로컬 세션을 걸고 #/student로 보낸다.
// mgmt 파라미터가 없으면 아무 일도 하지 않는다.
function MgmtEntry() {
  const { allStudents: students, synced } = useStore()   // 지점 무관 — 관리앱 mgmtId 매칭은 전원 대상
  const nav = useNavigate()
  useEffect(() => {
    const mgmt = new URLSearchParams(window.location.search).get('mgmt')
    if (!mgmt) return
    // 누구로 들어왔는지 기억해 둔다 — 아래에서 파라미터를 지운 뒤에도 학생 화면에서 확인용으로 쓴다.
    try { sessionStorage.setItem(MGMT_KEY, mgmt) } catch { /* 무시 */ }
    if (!synced) return          // 명부가 올 때까지 기다린다 (세션이 있으면 곧 온다)
    /**
     * 누구인지 찾기 — ① 연결번호(mgmtId) ② 없으면 **이름**으로 (2026-08-19)
     *
     * 왜 이름까지 보나 — 실제로 학습지앱 학생 72명 **전원 mgmtId가 비어 있었다.**
     *   그래서 관리앱 [채점하러 가기]로 들어와도 본인을 못 찾아 채점 화면에 못 들어갔다.
     *   관리앱이 이름(?name=)도 같이 넘겨주므로, 이름이 **딱 한 명**일 때만 그 학생으로 본다.
     *   (동명이인이면 잘못 들어갈 수 있어 그때는 매칭하지 않는다.)
     */
    const name = (new URLSearchParams(window.location.search).get('name') ?? '').trim()
    const byName = name ? students.filter((s) => (s.name ?? '').trim() === name) : []
    const me = students.find((s) => s.mgmtId === mgmt) ?? (byName.length === 1 ? byName[0] : undefined)
    if (me) setLocalStudentId(me.id)
    // 파라미터를 지우고 학생앱으로. 명부에서 못 찾아도 학생 세션이면 학생앱이 알아서 본인을 찾는다.
    window.history.replaceState(null, '', window.location.pathname)
    nav('/student', { replace: true })
  }, [synced, students, nav])
  return null
}

function Gate() {
  const { ready, session } = useAuth()
  if (!ready) return <div className="flex min-h-screen items-center justify-center text-ink2">불러오는 중…</div>
  // 학부모앱(#/parent*)은 Supabase 세션 없이도 진입 — 서버리스가 이름+연락처로 검증
  if (SUPABASE_ON && !session) {
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#/parent')) return <ParentOnlyApp />
    // 🛑 세션이 없으면 **무조건 로그인 화면**이다.
    //    예전에는 관리앱 [채점하러 가기](?mgmt=…)나 로컬 학생세션이 있으면 그냥 통과시켰는데,
    //    익명으로는 명부(hj_students)가 RLS에 막혀 빈 배열로 온다 → 학생을 못 찾고
    //    첫 화면 '/'가 그대로 열려 **선생님 화면(#/prep/worksheet)이 학생에게 노출**됐다.
    //    (2026-07-29 실서버에서 재현·확인. 학생은 채점 화면에 영영 못 들어갔다.)
    return <Login />
  }
  return (
    <StoreProvider>
      <HashRouter>
        <MgmtEntry />
        <Routes>
          {/* ── 학부모앱 (#/parent) — 로컬 모드/선생님 미리보기용. 프로덕션 미인증 진입은 ParentOnlyApp ── */}
          <Route path="/parent-login" element={<ParentLogin />} />
          <Route path="/parent" element={<ParentHome />} />

          {/* ── 학생앱 (#/student/*) — 선생님 메뉴 없는 학생 전용 셸 ── */}
          <Route path="/student-login" element={<StudentLocalLogin />} />
          <Route path="/student" element={<StudentShell />}>
            <Route index element={<StudentHome />} />
            <Route path="worksheets" element={<StudentWorksheets />} />
            <Route path="solve/:wsId" element={<StudentSolve />} />
            <Route path="result/:wsId" element={<StudentResult />} />
            <Route path="workbooks" element={<StudentWorkbooks />} />
            <Route path="challenge" element={<StudentChallenge />} />
            <Route path="lectures" element={<StudentLectures />} />
            {/* 학생용 학습지 PDF — 선생님 화면을 열어 주지 않으려고 전용 경로를 둔다 */}
            <Route path="print/:id" element={<WorksheetView studentMode />} />
            <Route path="*" element={<Navigate to="/student" replace />} />
          </Route>

          {/* ── 선생님 라우트 — 학생 모드는 진입 불가(학생앱으로 리다이렉트) ── */}
          <Route element={<TeacherGate />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/prep/worksheet" replace />} />

            {/* 수업 준비 (매쓰플랫 사이드바 구조 동일) */}
            <Route element={<PrepLayout />}>
              <Route path="/prep/worksheet" element={<WorksheetPage />} />
              <Route path="/prep/worksheet-upload" element={<WorksheetUpload />} />
              <Route path="/prep/workbook" element={<Materials />} />
              <Route path="/prep/school-test" element={
                <Placeholder title="학교별 기출"
                  original={[
                    '필터: 학교급 / 학년·학기 / 지역·학교 / 연도 / 중간·기말',
                    '시험지별: 직접 등록(기출 업로드) / 미리보기 / 추천 학습지',
                  ]}
                  plan="보유 학교 기출 PDF를 업로드→디지털 문제로 변환(Claude)해 쌓이면 검색·출제 활성화." />
              } />
              <Route path="/prep/school-exam" element={<NaesinPrep />} />
              <Route path="/prep/csat" element={<CsatLibrary />} />
              <Route path="/gichul/:id" element={<GichulView />} />
              <Route path="/gichul-tag/:id" element={<GichulTag />} />
              <Route path="/prep/test" element={<TestPrep />} />
              <Route path="/prep/forms" element={<FormsPage />} />
              <Route path="/prep/kmm" element={
                <Placeholder title="KMM수학경시대회"
                  original={['KMM 수학경시대회 기출·모의 문항 회차별 제공']}
                  plan="KMM 문항 데이터를 확보하면 회차/유형별로 탑재. (별도 라이선스·데이터 필요)" />
              } />
              <Route path="/prep/arithmetic" element={<ArithmeticGen />} />
              <Route path="/prep/essay" element={<EssayPage />} />
              <Route path="/prep/lecture" element={<LecturePage />} />
              <Route path="/prep/share" element={
                <Placeholder title="다른 기관 학습지"
                  original={['타 학원 공개 학습지 검색(난이도·문제 수 슬라이더) — 상호 공개 마켓']}
                  plan="단일 학원 운영이라 보류. 지점 확장 시 지점 간 공유로 구현." />
              } />
            </Route>

            {/* 수업: 채점 → 오답 → 드릴 루프 */}
            <Route path="/lesson" element={<Page><Lesson /></Page>} />
            <Route path="/today" element={<Page><TodayRoom /></Page>} />
            <Route path="/manage" element={<Page><Students /></Page>} />
            <Route path="/mypage" element={<Page><MyPage /></Page>} />

            <Route path="/make" element={<Page><MakeWizard /></Page>} />
            <Route path="/worksheet/:id" element={<Page><WorksheetView /></Page>} />
            <Route path="/diagnosis/:studentId" element={<Page><DiagnosisReport /></Page>} />
            <Route path="/timetable/:studentId" element={<Page><TimetablePage /></Page>} />
            <Route path="/points" element={<Page><PointsPage /></Page>} />
          </Route>
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  )
}

// 학부모 전용 앱 — 프로덕션에서 Supabase 세션 없이 #/parent 진입 시 (서버리스로 자녀 데이터 검증)
function ParentOnlyApp() {
  return (
    <StoreProvider>
      <HashRouter>
        <MgmtEntry />
        <Routes>
          <Route path="/parent-login" element={<ParentLogin />} />
          <Route path="/parent" element={<ParentHome />} />
          <Route path="*" element={<Navigate to="/parent-login" replace />} />
        </Routes>
      </HashRouter>
    </StoreProvider>
  )
}

// 학생 모드(학생 계정 세션 또는 로컬 학생 세션)는 선생님 라우트에 못 들어간다
function TeacherGate() {
  const { email } = useAuth()
  const studentMode = SUPABASE_ON ? isStudentEmail(email) : !!getLocalStudentId()
  if (studentMode) return <Navigate to="/student" replace />
  return <Outlet />
}
