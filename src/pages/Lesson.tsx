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

const LEVEL_ORDER: Record<string, number> = { 초: 0, 중: 1, 고: 2 }
// '중1-1' 과정형 → '중1' 짧은 표기 (학년 그룹 라벨)
function shortGrade(g: string): string {
  const m = g.match(/^(초|중|고)\s*(\d)/)
  return m ? `${m[1]}${m[2]}` : g
}
// 초1→고3 정렬키 (초·중·고 우선, 그 안에서 학년 오름차순)
function gradeSortKey(g: string): number {
  const m = g.match(/^(초|중|고)\s*(\d)/)
  if (!m) return 9999
  return LEVEL_ORDER[m[1]] * 10 + Number(m[2])
}

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
      const key = groupBy === '학년' ? shortGrade(s.grade) : (s.klass?.trim() || '미배정')
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(s)
    }
    for (const arr of m.values()) arr.sort((x, y) => x.name.localeCompare(y.name, 'ko'))  // 그룹 내 이름순
    return [...m.entries()].sort((a, b) => {
      if (groupBy === '학년') {                     // 초1→고3 (초·중·고 순 + 학년 오름차순)
        const d = gradeSortKey(a[0]) - gradeSortKey(b[0])
        if (d !== 0) return d
      }
      if (a[0] === '미배정') return 1               // 반: 미배정은 맨 아래
      if (b[0] === '미배정') return -1
      return a[0].localeCompare(b[0], 'ko')
    })
  }, [active, groupBy, q])

  function toggleGroup(name: string) {
    setClosed(prev => { const n = new Set(prev); if (n.has(name)) n.delete(name); else n.add(name); return n })
  }

  const allOpen = groups.every(([name]) => !closed.has(name))

  if (active.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white/60 p-16 text-center text-ink2">
        먼저 <b className="text-pine">관리 → 학생 관리</b>에서 학생을 등록하세요.
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
      <aside className="no-print h-fit overflow-hidden rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-4 py-3">
          <div className="mb-2.5 flex items-center gap-2 text-sm font-black text-ink">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-pine-soft text-pine-dark">👤</span>
            {student ? `${student.name} 학생 수업` : '수업'}
          </div>
          <div className="flex rounded-lg bg-paper2 p-0.5 text-xs font-bold">
            {(['학년', '반'] as const).map(g => (
              <button key={g} onClick={() => setGroupBy(g)}
                className={`grow rounded-md px-2 py-1.5 transition ${groupBy === g ? 'bg-white text-pine shadow-sm' : 'text-ink2 hover:text-ink'}`}>{g}</button>
            ))}
          </div>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink2">🔍</span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="학생 이름 검색"
              className="w-full rounded-lg border border-line py-1.5 pl-8 pr-2.5 text-sm" />
          </div>
        </div>

        <div className="flex items-center px-4 py-2">
          <span className="text-xs font-bold text-ink2">학생 <b className="text-ink">{active.length}</b>명</span>
          <div className="grow" />
          <button onClick={() => setClosed(allOpen ? new Set(groups.map(g => g[0])) : new Set())}
            className="text-xs font-semibold text-pine hover:underline">{allOpen ? '전체 닫기' : '전체 열기'}</button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-2 pb-2">
          {groups.map(([name, list]) => {
            const open = !closed.has(name)
            return (
              <div key={name} className="mb-0.5">
                <button onClick={() => toggleGroup(name)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-paper2">
                  <span className="text-[10px] text-ink2">{open ? '▾' : '▸'}</span>
                  <span className="text-sm font-black text-ink">{name}</span>
                  <span className="rounded-full bg-paper2 px-1.5 py-0.5 text-[11px] font-bold text-ink2">{list.length}</span>
                </button>
                {open && (
                  <div className="ml-3 border-l border-line/70 pl-1.5">
                    {list.map(s => (
                      <button key={s.id} onClick={() => setStudentId(s.id)}
                        className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${studentId === s.id
                          ? 'bg-pine-soft font-bold text-pine-dark'
                          : 'text-ink hover:bg-paper2'}`}>
                        {s.name}{s.klass && groupBy === '학년' && <span className="ml-1 text-xs font-normal text-ink2">· {s.klass}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {groups.length === 0 && <p className="px-2 py-6 text-center text-xs text-ink2">검색 결과 없음</p>}
        </div>
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
