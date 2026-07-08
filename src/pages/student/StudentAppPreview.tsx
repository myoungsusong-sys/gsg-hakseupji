import { useState } from 'react'
import type { Student } from '../../types'
import { StudentSelfCtx, PreviewCtx, type StudentMenu } from './common'
import StudentHome from './StudentHome'
import StudentWorksheets from './StudentWorksheets'
import StudentWorkbooks from './StudentWorkbooks'
import StudentChallenge from './StudentChallenge'
import StudentLectures from './StudentLectures'

// ── 선생님용 학생앱 미리보기 오버레이 (관리 > 학생 관리 > [학생앱으로 이동]) ──
// 매쓰플랫 동일 동선 — 단, 우리는 **보기 전용**: 제출·생성 버튼은 PreviewCtx로 비활성,
// 라우터 <a> 이동은 캡처 단계에서 차단해 실데이터 오염과 화면 이탈을 막는다.
// (풀기/결과 화면은 라우트 전용이라 미리보기에선 열리지 않음 — 목록·결과 요약까지 열람)

const MENUS: { key: StudentMenu; label: string }[] = [
  { key: 'home', label: '학습 홈' },
  { key: 'challenge', label: '챌린지' },
  { key: 'workbooks', label: '교재' },
  { key: 'worksheets', label: '학습지' },
  { key: 'lectures', label: '강의' },
]

export default function StudentAppPreview({ s, onClose }: { s: Student; onClose: () => void }) {
  const [menu, setMenu] = useState<StudentMenu>('home')

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper"
      // 보기 전용: 페이지 안 <a>(react-router Link 포함) 클릭을 캡처 단계에서 무력화
      onClickCapture={e => {
        const a = (e.target as HTMLElement).closest('a')
        if (a) { e.preventDefault(); e.stopPropagation() }
      }}>
      {/* 상단 미리보기 바 */}
      <div className="flex items-center gap-3 bg-ink px-5 py-2.5 text-sm text-paper">
        <span className="rounded bg-paper/20 px-2 py-0.5 text-[11px] font-bold">미리보기</span>
        <span><b>{s.name}</b> 학생앱 미리보기 — 보기 전용 (제출·생성 불가)</span>
        <div className="grow" />
        <button onClick={onClose}
          className="rounded-lg border border-paper/40 px-3 py-1.5 text-sm font-bold hover:bg-paper/10">✕ 닫기</button>
      </div>

      <div className="min-h-0 grow overflow-y-auto">
        {/* 학생 셸 헤더 복제 — 메뉴는 내부 상태 전환(라우팅 없음) */}
        <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-5 px-6 py-3">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black tracking-tight text-pine-dark">깊은생각</span>
              <span className="text-xl font-light text-ink">학습지</span>
            </div>
            <nav className="flex items-center gap-1">
              {MENUS.map(m => (
                <button key={m.key} onClick={() => setMenu(m.key)}
                  className={`px-3.5 py-2 rounded-full text-[15px] font-bold transition ${
                    menu === m.key ? 'bg-pine-soft text-pine-dark' : 'text-ink2 hover:text-ink'}`}>
                  {m.label}
                </button>
              ))}
            </nav>
            <div className="grow" />
            <span className="text-sm font-bold">{s.name}<span className="ml-1 font-normal text-ink2">학생</span></span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">
          <StudentSelfCtx.Provider value={s}>
            <PreviewCtx.Provider value={{ on: true, go: setMenu }}>
              {menu === 'home' && <StudentHome />}
              {menu === 'challenge' && <StudentChallenge />}
              {menu === 'workbooks' && <StudentWorkbooks />}
              {menu === 'worksheets' && <StudentWorksheets />}
              {menu === 'lectures' && <StudentLectures />}
            </PreviewCtx.Provider>
          </StudentSelfCtx.Provider>
        </main>
      </div>
    </div>
  )
}
