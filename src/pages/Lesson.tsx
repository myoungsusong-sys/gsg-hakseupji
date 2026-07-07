import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import type { Student } from '../types'
import GradePanel from '../components/lesson/GradePanel'
import WorksheetPanel from '../components/lesson/WorksheetPanel'
import HistoryPanel from '../components/lesson/HistoryPanel'
import TodayPanel from '../components/lesson/TodayPanel'
import AnalysisPanel from '../components/lesson/AnalysisPanel'
import ReportPanel from '../components/lesson/ReportPanel'

// 매쓰플랫과 동일한 6탭. 각 탭 구현은 components/lesson/* 모듈 (리마운트로 state 유실 방지)
type Tab = 'history' | 'today' | 'analysis' | 'worksheet' | 'material' | 'report'
const TABS: { key: Tab; label: string }[] = [
  { key: 'history', label: '학습내역' },
  { key: 'today', label: '오늘의 학습' },
  { key: 'analysis', label: '유형분석' },
  { key: 'worksheet', label: '학습지' },
  { key: 'material', label: '교재' },
  { key: 'report', label: '보고서' },
]

export default function Lesson() {
  const { students } = useStore()
  const active = students.filter(s => s.active)
  const [studentId, setStudentId] = useState<string | null>(active[0]?.id ?? null)
  const [tab, setTab] = useState<Tab>('history')
  const [groupBy, setGroupBy] = useState<'학년' | '반'>('학년')
  const [q, setQ] = useState('')
  const [closed, setClosed] = useState<Set<string>>(new Set())

  const student = active.find(s => s.id === studentId) ?? null

  // 좌측 학생 패널: 학년/반 그룹 아코디언 + 이름 검색 (매쓰플랫 동일)
  const groups = useMemo(() => {
    const kw = q.trim()
    const filtered = active.filter(s => !kw || s.name.includes(kw))
    const m = new Map<string, Student[]>()
    for (const s of filtered) {
      const key = groupBy === '학년' ? s.grade : (s.klass?.trim() || '미배정')
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(s)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko'))
  }, [active, groupBy, q])

  function toggleGroup(name: string) {
    setClosed(prev => { const n = new Set(prev); if (n.has(name)) n.delete(name); else n.add(name); return n })
  }

  if (active.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white/60 p-16 text-center text-ink2">
        먼저 <b className="text-pine">관리 → 학생 관리</b>에서 학생을 등록하세요.
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
      <aside className="no-print h-fit rounded-2xl border border-line bg-white p-3">
        <div className="mb-2 flex rounded-lg border border-line p-0.5 text-xs font-semibold">
          {(['학년', '반'] as const).map(g => (
            <button key={g} onClick={() => setGroupBy(g)}
              className={`grow rounded-md px-2 py-1 ${groupBy === g ? 'bg-pine text-paper' : 'text-ink2 hover:text-ink'}`}>{g}</button>
          ))}
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="학생 이름 검색"
          className="mb-2 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm" />
        <div className="mb-1 px-1 text-xs font-bold text-ink2">학생 {active.length}명</div>
        {groups.map(([name, list]) => (
          <div key={name} className="mb-1">
            <button onClick={() => toggleGroup(name)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-bold text-ink2 hover:bg-paper2">
              <span>{name} ({list.length})</span><span>{closed.has(name) ? '▸' : '▾'}</span>
            </button>
            {!closed.has(name) && list.map(s => (
              <button key={s.id} onClick={() => setStudentId(s.id)}
                className={`mb-0.5 block w-full rounded-lg px-3 py-2 text-left text-sm ${studentId === s.id ? 'bg-pine-soft font-bold text-pine-dark' : 'hover:bg-paper2'}`}>
                {s.name} {s.klass && <span className="text-xs text-ink2">· {s.klass}</span>}
              </button>
            ))}
          </div>
        ))}
        {groups.length === 0 && <p className="px-2 py-3 text-center text-xs text-ink2">검색 결과 없음</p>}
      </aside>

      <main>
        {student && (
          <>
            <div className="no-print mb-5 flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line px-1">
              <h1 className="pb-3 text-lg font-black">{student.name}</h1>
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-[15px] font-bold ${tab === t.key ? 'border-pine text-ink' : 'border-transparent text-ink2 hover:text-ink'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'history' && <HistoryPanel key={student.id} student={student} />}
            {tab === 'today' && <TodayPanel key={student.id} student={student} />}
            {tab === 'analysis' && <AnalysisPanel key={student.id} student={student} />}
            {tab === 'worksheet' && <WorksheetPanel key={student.id} student={student} />}
            {tab === 'material' && <GradePanel key={student.id} student={student} />}
            {tab === 'report' && <ReportPanel key={student.id} student={student} />}
          </>
        )}
        {!student && <p className="p-10 text-center text-sm text-ink2">왼쪽에서 학생을 선택하세요.</p>}
      </main>
    </div>
  )
}
