import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { StoreProvider } from './lib/store'
import { SUPABASE_ON } from './lib/supabase'
import { AuthProvider, useAuth } from './lib/auth'
import Login from './pages/Login'
import Layout from './components/Layout'
import PrepLayout from './components/PrepLayout'
import Placeholder from './components/Placeholder'
import WorksheetPage from './pages/WorksheetPage'
import MakeWizard from './pages/MakeWizard'
import WorksheetView from './pages/WorksheetView'
import Materials from './pages/Materials'
import NaesinPrep from './pages/NaesinPrep'
import TestPrep from './pages/TestPrep'
import Lesson from './pages/Lesson'
import Students from './pages/Students'
import CsatLibrary from './pages/CsatLibrary'
import GichulView from './pages/GichulView'
import GichulTag from './pages/GichulTag'

function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}

function Gate() {
  const { ready, session } = useAuth()
  if (!ready) return <div className="flex min-h-screen items-center justify-center text-ink2">불러오는 중…</div>
  if (SUPABASE_ON && !session) return <Login />
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/prep/worksheet" replace />} />

            {/* 수업 준비 (매쓰플랫 사이드바 구조 동일) */}
            <Route element={<PrepLayout />}>
              <Route path="/prep/worksheet" element={<WorksheetPage />} />
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
              <Route path="/prep/kmm" element={
                <Placeholder title="KMM수학경시대회"
                  original={['KMM 수학경시대회 기출·모의 문항 회차별 제공']}
                  plan="KMM 문항 데이터를 확보하면 회차/유형별로 탑재. (별도 라이선스·데이터 필요)" />
              } />
              <Route path="/prep/arithmetic" element={
                <Placeholder title="연산"
                  original={['연산 교재 라이브러리: 강 단위 학습지 + 실물 미리보기 + 추가 학습지']}
                  plan="연산 문제 자동 생성기(숫자 랜덤 템플릿)로 구현 — 저작권 부담 없는 영역이라 우선순위 높음." />
              } />
              <Route path="/prep/essay" element={
                <Placeholder title="서술형"
                  original={['단원별 서술형 세트(기본/일반/심화, 10문제 단위)']}
                  plan="서술형 문제를 유형 트리에 태그로 얹어 세트 생성." />
              } />
              <Route path="/prep/lecture" element={
                <Placeholder title="강의"
                  original={['개념 강의 영상 목록(강 단위) + 출제하기(영상 숙제) + 학생앱 공개 토글 + 시청 내역']}
                  plan="명수쌤 강의 영상(녹음 파이프라인 산출물)을 단원 트리에 연결." />
              } />
              <Route path="/prep/share" element={
                <Placeholder title="다른 기관 학습지"
                  original={['타 학원 공개 학습지 검색(난이도·문제 수 슬라이더) — 상호 공개 마켓']}
                  plan="단일 학원 운영이라 보류. 지점 확장 시 지점 간 공유로 구현." />
              } />
            </Route>

            {/* 수업: 채점 → 오답 → 드릴 루프 */}
            <Route path="/lesson" element={<Page><Lesson /></Page>} />
            <Route path="/manage" element={<Page><Students /></Page>} />

            <Route path="/make" element={<Page><MakeWizard /></Page>} />
            <Route path="/worksheet/:id" element={<Page><WorksheetView /></Page>} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  )
}
