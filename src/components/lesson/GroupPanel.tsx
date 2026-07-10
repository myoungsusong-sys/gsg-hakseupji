import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DailyConfig, Diff, Grading, Student, Worksheet } from '../../types'
import { DIFFS, DIFF_LABEL } from '../../types'
import { useStore } from '../../lib/store'
import { dateKey, todayKey } from '../../lib/dates'
import { resultTypeId } from '../../lib/drill'
import { ACHIEVEMENT_GRADES, achievementOf } from '../../lib/achievement'
import { CURRICULA, curriculumFor, typeName } from '../../data/curriculum'
import { ConfigModal } from './TodayPanel'

// ── 학년(그룹) 단위 수업 화면 (매쓰플랫 /lesson/*/grade/<학년> 변형) ─────────────
// 좌측 패널에서 학년/반 그룹을 선택하면 학생 대신 이 화면이 뜬다.
// 탭: 학습내역(진도/숙제/학습통계/강의) · 오늘의 학습(전체학생) · 유형분석 · 학습지(목록/현황보드) · 보고서(저장 목록)
// 실시간 모니터링([모니터링] 컬럼)은 별도 인프라 과제로 보류.

type Tab = 'history' | 'today' | 'analysis' | 'worksheet' | 'solvefb' | 'report'
const TABS: { key: Tab; label: string }[] = [
  { key: 'history', label: '학습내역' },
  { key: 'today', label: '오늘의 학습' },
  { key: 'analysis', label: '유형분석' },
  { key: 'worksheet', label: '학습지' },
  { key: 'solvefb', label: '풀이피드백' },
  { key: 'report', label: '보고서' },
]

// 정답률 컬러 (매쓰플랫 현황보드·학습통계 범례): 미흡(<60)·보통·우수(≥85)·채점 전
function rateColor(score: number | null): string {
  if (score === null) return 'border-line bg-white text-ink2'          // 채점 전
  if (score >= 85) return 'border-lime-400 bg-lime-100 text-lime-900'  // 우수
  if (score >= 60) return 'border-amber bg-amber-soft text-amber'      // 보통
  return 'border-red-300 bg-red-100 text-red-800'                      // 미흡
}
const RATE_LEGEND = [
  ['미흡', 'bg-red-100 border border-red-300'],
  ['보통', 'bg-amber-soft border border-amber'],
  ['우수', 'bg-lime-100 border border-lime-400'],
  ['채점 전', 'bg-white border border-line'],
] as const

// CSV 다운로드 (Excel 다운로드 등가 — BOM 포함해 엑셀에서 한글 정상)
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`
  const csv = '﻿' + rows.map(r => r.map(esc).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function scoreOf(g: Grading | undefined): number | null {
  if (!g || g.results.length === 0) return null
  return Math.round(g.results.filter(r => r.correct).length / g.results.length * 100)
}

export default function GroupPanel({ label, students }: { label: string; students: Student[] }) {
  const [tab, setTab] = useState<Tab>('history')
  return (
    <div>
      <div className="no-print mb-5 flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line px-1">
        <h1 className="pb-3 text-lg font-black">{label} <span className="text-sm font-bold text-ink2">전체 {students.length}명</span></h1>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-[15px] font-bold ${tab === t.key ? 'border-pine text-ink' : 'border-transparent text-ink2 hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'history' && <GroupHistory label={label} students={students} />}
      {tab === 'today' && <GroupToday label={label} students={students} />}
      {tab === 'analysis' && <GroupAnalysis students={students} />}
      {tab === 'worksheet' && <GroupWorksheets label={label} students={students} />}
      {tab === 'solvefb' && <GroupSolveFeedback students={students} />}
      {tab === 'report' && <GroupReports students={students} />}
    </div>
  )
}

/* ═══════════ 학습내역 (서브탭 4종: 진도/숙제/학습통계/강의) ═══════════ */

function GroupHistory({ label, students }: { label: string; students: Student[] }) {
  const { gradings, assignments, worksheets, workbooks, wbItems, problems } = useStore()
  const [sub, setSub] = useState<'진도' | '숙제' | '학습통계' | '강의'>('진도')
  const [date, setDate] = useState(todayKey())
  const [selTarget, setSelTarget] = useState<string | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [openStat, setOpenStat] = useState<string | null>(null)

  const ids = useMemo(() => new Set(students.map(s => s.id)), [students])
  const nameOf = useMemo(() => new Map(students.map(s => [s.id, s.name])), [students])
  const wsMap = useMemo(() => new Map(worksheets.map(w => [w.id, w])), [worksheets])
  const wbMap = useMemo(() => new Map(workbooks.map(w => [w.id, w])), [workbooks])

  // ── 진도: 그날 그룹 채점을 대상(학습지/교재)별로 묶는다
  const dayTargets = useMemo(() => {
    const m = new Map<string, { key: string; badge: '학습지' | '교재'; name: string; gs: Grading[] }>()
    for (const g of gradings) {
      if (!ids.has(g.studentId) || dateKey(g.date) !== date) continue
      const key = g.worksheetId ?? g.workbookId ?? g.title ?? g.id
      const badge: '학습지' | '교재' = (g.source ?? '교재') === '학습지' ? '학습지' : '교재'
      const name = (g.worksheetId ? wsMap.get(g.worksheetId)?.title : g.workbookId ? wbMap.get(g.workbookId)?.name : g.title) ?? badge
      const cur = m.get(key) ?? { key, badge, name, gs: [] }
      cur.gs.push(g)
      m.set(key, cur)
    }
    return [...m.values()]
  }, [gradings, ids, date, wsMap, wbMap])
  const selected = dayTargets.find(t => t.key === selTarget) ?? dayTargets[0]

  // ── 숙제: 그룹 학생 미채점 숙제
  const pendingHomework = useMemo(() =>
    assignments.filter(a => a.kind === '숙제' && ids.has(a.studentId)
      && !gradings.some(g => g.studentId === a.studentId && g.worksheetId === a.worksheetId)),
  [assignments, ids, gradings])

  // ── 학습통계: 주간(월~일) 학생별 집계
  const week = useMemo(() => {
    const now = new Date()
    const mon = new Date(now)
    mon.setDate(now.getDate() - (now.getDay() + 6) % 7 + weekOffset * 7)
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return dateKey(d) })
  }, [weekOffset])
  const weekStats = useMemo(() => {
    const keySet = new Set(week)
    const itemMap = new Map(wbItems.map(i => [i.id, i]))
    const pMap = new Map(problems.map(p => [p.id, p]))
    return students.map(st => {
      let total = 0, correct = 0
      const byDiff: Record<Diff, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      for (const g of gradings) {
        if (g.studentId !== st.id || !keySet.has(dateKey(g.date))) continue
        const ws = g.worksheetId ? wsMap.get(g.worksheetId) : undefined
        g.results.forEach((r, i) => {
          total++
          if (r.correct) correct++
          let d: Diff = 3
          if (ws) d = pMap.get(r.itemId ?? ws.problemIds[i] ?? '')?.diff ?? 3
          else if (r.itemId) d = itemMap.get(r.itemId)?.diff ?? 3
          byDiff[d]++
        })
      }
      return { st, total, rate: total ? Math.round(correct / total * 100) : null, byDiff }
    })
  }, [students, gradings, week, wsMap, wbItems, problems])
  const avgTotal = weekStats.length ? Math.round(weekStats.reduce((a, r) => a + r.total, 0) / weekStats.length) : 0
  const rated = weekStats.filter(r => r.rate !== null)
  const avgRate = rated.length ? Math.round(rated.reduce((a, r) => a + (r.rate ?? 0), 0) / rated.length) : 0

  const mmdd = (d: string) => d.slice(5).replace('-', '.')

  return (
    <div>
      {/* 서브탭 + 날짜 네비 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-line bg-white p-1 text-sm font-bold">
          {(['진도', '숙제', '학습통계', '강의'] as const).map(s => (
            <button key={s} onClick={() => setSub(s)}
              className={`rounded-lg px-4 py-1.5 ${sub === s ? 'bg-pine text-paper' : 'text-ink2 hover:text-ink'}`}>{s}</button>
          ))}
        </div>
        <div className="grow" />
        {sub === '진도' && (
          <input type="date" value={date} onChange={e => { setDate(e.target.value); setSelTarget(null) }}
            className="rounded-lg border border-line px-3 py-1.5 text-sm" />
        )}
      </div>

      {sub === '진도' && (
        dayTargets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
            이 날짜에 {label} 학생들의 채점 기록이 없습니다.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <aside className="grid h-fit gap-2">
              {dayTargets.map(t => (
                <button key={t.key} onClick={() => setSelTarget(t.key)}
                  className={`rounded-xl border p-3 text-left ${selected?.key === t.key ? 'border-pine bg-pine-soft/50' : 'border-line bg-white hover:border-pine'}`}>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${t.badge === '학습지' ? 'bg-amber-soft text-amber' : 'bg-pine-soft text-pine-dark'}`}>{t.badge}</span>
                  <div className="mt-1 text-sm font-bold leading-snug">{t.name}</div>
                  <div className="text-xs text-ink2">{t.gs.length}명</div>
                </button>
              ))}
            </aside>
            <div className="grid h-fit gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {selected?.gs.map(g => {
                const s = scoreOf(g) ?? 0
                const correct = g.results.filter(r => r.correct).length
                const wrong = g.results.length - correct
                const C = 2 * Math.PI * 22
                return (
                  <div key={g.id} className="rounded-2xl border border-line bg-white p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <b>{nameOf.get(g.studentId) ?? '학생'}</b>
                      <span className="text-[11px] font-bold text-pine">● 채점 완료</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* 정답률 도넛 */}
                      <svg viewBox="0 0 56 56" className="h-14 w-14 shrink-0">
                        <circle cx="28" cy="28" r="22" fill="none" stroke="var(--color-line)" strokeWidth="6" />
                        <circle cx="28" cy="28" r="22" fill="none" stroke="var(--color-pine)" strokeWidth="6"
                          strokeDasharray={`${C * s / 100} ${C}`} strokeLinecap="round" transform="rotate(-90 28 28)" />
                        <text x="28" y="32" textAnchor="middle" fontSize="12" fontWeight="900" fill="var(--color-pine-dark)">{s}%</text>
                      </svg>
                      <div className="text-xs text-ink2">
                        {g.pageFrom != null && <div>진도 {g.pageFrom}P~{g.pageTo ?? g.pageFrom}P</div>}
                        <div>채점 문제 수 <b className="text-ink">{g.results.length}문제</b></div>
                        <div><span className="font-bold text-pine">○{correct}</span> <span className="ml-1 font-bold text-clay">✗{wrong}</span></div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      )}

      {sub === '숙제' && (
        pendingHomework.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
            숙제 내역이 없습니다.
            <div className="mt-2">
              <button onClick={() => alert('숙제 내기 방법\n\n수업 > 학습지 탭에서 학습지를 체크하고 하단 바의 [숙제 내기]를 누르거나, 행의 [숙제내기] 버튼을 누르세요.')}
                className="text-xs font-semibold text-pine hover:underline">숙제는 어떻게 내주나요?</button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            {pendingHomework.map(a => (
              <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm">
                <b>{nameOf.get(a.studentId)}</b>
                <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[11px] font-bold text-stone-700">숙제</span>
                <span className="font-semibold">{wsMap.get(a.worksheetId)?.title ?? '삭제된 학습지'}</span>
                <div className="grow" />
                <span className="text-xs text-ink2">{dateKey(a.date)} 출제 · 미채점</span>
              </div>
            ))}
          </div>
        )
      )}

      {sub === '학습통계' && (
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <button onClick={() => setWeekOffset(o => o - 1)} className="rounded-lg border border-line px-2 py-1 text-xs font-bold hover:bg-paper2">←</button>
            <b>{weekOffset === 0 ? '이번 주' : ''} {mmdd(week[0])} ~ {mmdd(week[6])}</b>
            <button onClick={() => setWeekOffset(o => o + 1)} disabled={weekOffset >= 0}
              className="rounded-lg border border-line px-2 py-1 text-xs font-bold hover:bg-paper2 disabled:opacity-30">→</button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="rounded-lg border border-line px-2.5 py-1 text-xs font-bold text-pine hover:bg-pine-soft">이번주</button>
            )}
            <div className="mx-2 flex items-center gap-2 text-xs text-ink2">
              {RATE_LEGEND.filter(([t]) => t !== '채점 전').map(([t, cls]) => (
                <span key={t} className="flex items-center gap-1"><span className={`inline-block h-3 w-3 rounded ${cls}`} />{t}</span>
              ))}
            </div>
            <div className="grow" />
            <button
              onClick={() => downloadCsv(`학습통계_${label}_${week[0]}.csv`, [
                ['학생명', '푼 문제 수', '정답률(%)', ...DIFFS.map(d => `난이도 ${DIFF_LABEL[d]}`)],
                ...weekStats.map(r => [r.st.name, r.total, r.rate ?? '', ...DIFFS.map(d => r.byDiff[d])]),
              ])}
              className="rounded-lg border border-pine px-3 py-1.5 text-xs font-bold text-pine hover:bg-pine-soft">
              Excel 다운로드
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink2">
                <th className="py-1.5">학생명</th>
                <th>푼 문제 수 <span className="font-normal">(평균 {avgTotal}문제)</span></th>
                <th>정답률 <span className="font-normal">(평균 {avgRate}%)</span></th>
                <th>난이도별 푼 문제수 비율</th>
              </tr>
            </thead>
            <tbody>
              {weekStats.map(r => (
                <Fragment key={r.st.id}>
                  <tr className="border-b border-line/50">
                    <td className="py-2 font-semibold">{r.st.name}</td>
                    <td className="py-2">{r.total}문제</td>
                    <td className="py-2">
                      <span className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${rateColor(r.rate)}`}>
                        {r.rate !== null ? `${r.rate}%` : '채점 전'}
                      </span>
                    </td>
                    <td className="py-2 pr-2">
                      <button onClick={() => setOpenStat(openStat === r.st.id ? null : r.st.id)}
                        className="flex h-4 w-full max-w-56 overflow-hidden rounded bg-paper2" title="누르면 상세 정보를 볼 수 있습니다">
                        {DIFFS.map(d => r.byDiff[d] > 0 && (
                          <span key={d} style={{ width: `${r.byDiff[d] / Math.max(1, r.total) * 100}%` }}
                            className={['bg-stone-300', 'bg-pine/50', 'bg-amber/70', 'bg-orange-400', 'bg-red-400'][d - 1]} />
                        ))}
                      </button>
                    </td>
                  </tr>
                  {openStat === r.st.id && (
                    <tr className="border-b border-line/50 bg-paper2/60">
                      <td colSpan={4} className="px-2 py-1.5 text-xs text-ink2">
                        {DIFFS.map(d => `${DIFF_LABEL[d]} ${r.byDiff[d]}문제`).join(' · ')}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-ink2">난이도별 푼 문제수를 누르면 상세 정보를 볼 수 있습니다!</p>
        </div>
      )}

      {sub === '강의' && (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          강의 출제내역이 없습니다.
        </div>
      )}
    </div>
  )
}

/* ═══════════ 오늘의 학습 (전체학생) ═══════════ */

function GroupToday({ label, students }: { label: string; students: Student[] }) {
  const { assignments, worksheets, gradings, setDailyConfig, dailyConfigs } = useStore()
  const [date, setDate] = useState(todayKey())
  const [setting, setSetting] = useState(false)

  const wsMap = useMemo(() => new Map(worksheets.map(w => [w.id, w])), [worksheets])
  const rows = useMemo(() => students.map(st => {
    const dayAs = assignments.filter(a => a.studentId === st.id && dateKey(a.date) === date)
    let solved = 0, scoreSum = 0, scoreN = 0
    for (const a of dayAs) {
      const g = gradings.find(x => x.studentId === st.id && x.worksheetId === a.worksheetId)
      if (g && g.results.length) {
        solved++
        scoreSum += g.results.filter(r => r.correct).length / g.results.length * 100
        scoreN++
      }
    }
    return { st, issued: dayAs.length, solved, score: scoreN ? Math.round(scoreSum / scoreN) : null, titles: dayAs.map(a => wsMap.get(a.worksheetId)?.title ?? '') }
  }), [students, assignments, gradings, date, wsMap])

  const [y, m, d] = date.split('-')
  const first = students[0]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="text-sm font-black">{label} 전체학생 — 오늘의 학습 결과를 확인하세요.</div>
        <div className="grow" />
        <span className="text-sm font-bold">{y}년 {Number(m)}월 {Number(d)}일</span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-lg border border-line px-3 py-1.5 text-sm" />
        {date !== todayKey() && (
          <button onClick={() => setDate(todayKey())} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold text-pine hover:bg-pine-soft">오늘</button>
        )}
        <button onClick={() => setSetting(true)}
          className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper hover:brightness-105">
          ⚙ 전체학생 학습 설정하기
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink2">
              <th className="px-4 py-2.5">학생명</th><th>푼 문제/출제된 문제수</th><th>점수</th><th>출제 학습지</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.st.id} className="border-b border-line/50 last:border-0">
                <td className="px-4 py-2.5 font-semibold">{r.st.name}</td>
                <td className="py-2.5">{r.issued === 0 ? <span className="text-ink2">—</span> : r.solved === 0 ? <span className="text-ink2">시작 전</span> : `${r.solved}/${r.issued}`}</td>
                <td className="py-2.5 font-bold text-pine-dark">{r.score !== null ? `${r.score}점` : <span className="font-semibold text-ink2">{r.issued ? '시작 전' : '—'}</span>}</td>
                <td className="max-w-[220px] truncate py-2.5 pr-3 text-xs text-ink2">{r.titles.join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 전체학생 일괄 설정 — 오늘의 학습 설정 모달을 그룹 전원에 적용 */}
      {setting && first && (
        <ConfigModal
          student={first}
          initial={dailyConfigs[first.id]}
          onSave={(cfg: DailyConfig) => {
            for (const st of students) setDailyConfig(st.id, cfg)
            setSetting(false)
            alert(`${label} 학생 ${students.length}명에게 오늘의 학습 설정을 일괄 적용했습니다.`)
          }}
          onClose={() => setSetting(false)}
        />
      )}
    </div>
  )
}

/* ═══════════ 유형분석 (그룹 합산 — 원본 학년 화면: 보고서 버튼 없음) ═══════════ */

function GroupAnalysis({ students }: { students: Student[] }) {
  const { gradings, wbItems, ensureCourse } = useStore()
  const [courseId, setCourseId] = useState(() => CURRICULA.find(c => c.grade === students[0]?.grade)?.id ?? 'm1-1')
  useEffect(() => { ensureCourse(courseId) }, [courseId, ensureCourse])
  const course = curriculumFor(courseId)
  const ids = useMemo(() => new Set(students.map(s => s.id)), [students])

  // 그룹 전체 채점을 유형별 합산
  const statMap = useMemo(() => {
    const itemMap = new Map(wbItems.map(i => [i.id, i]))
    const m = new Map<string, { wrong: number; total: number }>()
    for (const g of gradings) {
      if (!ids.has(g.studentId)) continue
      for (const r of g.results) {
        const t = resultTypeId(r, itemMap)
        if (!t) continue
        const cur = m.get(t) ?? { wrong: 0, total: 0 }
        cur.total++
        if (!r.correct) cur.wrong++
        m.set(t, cur)
      }
    }
    return m
  }, [gradings, ids, wbItems])

  const sections = useMemo(() => {
    const out: { key: string; title: string; rows: { id: string; name: string }[] }[] = []
    for (const u of course.units)
      for (const m of u.mids) {
        const all = m.subs.flatMap(s => s.types)
        if (!all.some(t => statMap.has(t.id))) continue
        out.push({ key: m.id, title: `${u.name} | ${m.name}`, rows: all })
      }
    return out
  }, [course, statMap])

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <select value={courseId} onChange={e => setCourseId(e.target.value)}
          className="rounded-lg border border-line px-3 py-2 font-semibold">
          {CURRICULA.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <span className="text-xs text-ink2">그룹 전체 채점을 합산한 유형별 성취도입니다.</span>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink2">
        {ACHIEVEMENT_GRADES.map(g => (
          <span key={g.key} className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded ${g.dot}`} />{g.name}
          </span>
        ))}
      </div>
      {sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          이 과정에 그룹 채점 데이터가 없습니다.
        </div>
      ) : sections.map(sec => (
        <div key={sec.key} className="mb-4 rounded-2xl border border-line bg-white p-4">
          <div className="mb-2 text-sm font-black">{sec.title}</div>
          <div className="flex flex-wrap gap-1.5">
            {sec.rows.map(t => {
              const s = statMap.get(t.id)
              const g = achievementOf(s)
              return (
                <span key={t.id} title={s ? `${g.name} — 채점 ${s.total} · 오답 ${s.wrong}` : g.name}
                  className={`rounded-lg px-2 py-1 text-xs font-semibold ${g.cls}`}>
                  {t.name}{s && <span className="ml-1 opacity-75">{Math.round((1 - s.wrong / s.total) * 100)}%</span>}
                </span>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ═══════════ 학습지 (목록 / 현황보드 + Excel) ═══════════ */

function GroupWorksheets({ label, students }: { label: string; students: Student[] }) {
  const { assignments, worksheets, gradings } = useStore()
  const [view, setView] = useState<'list' | 'board'>('list')
  const [excludeDrill, setExcludeDrill] = useState(false)

  const ids = useMemo(() => new Set(students.map(s => s.id)), [students])
  const DRILL_TAGS = ['오답', '오답학습', '심화학습', '복습', '취약유형', '기간별 오답', '학습지 오답', '교재 오답', '단원별 취약']

  // 그룹에 출제된 학습지 (학생별 최신 채점 점수 포함)
  const rows = useMemo(() => {
    const byWs = new Map<string, { ws: Worksheet; date: string; studentIds: Set<string> }>()
    for (const a of assignments) {
      if (!ids.has(a.studentId)) continue
      const ws = worksheets.find(w => w.id === a.worksheetId)
      if (!ws || ws.deletedAt) continue
      const cur = byWs.get(ws.id) ?? { ws, date: a.date, studentIds: new Set<string>() }
      if (a.date < cur.date) cur.date = a.date
      cur.studentIds.add(a.studentId)
      byWs.set(ws.id, cur)
    }
    let list = [...byWs.values()]
    if (excludeDrill) list = list.filter(r => !r.ws.tags.some(t => DRILL_TAGS.includes(t)) && !r.ws.supplement)
    return list
      .map(r => ({
        ...r,
        scores: students.filter(s => r.studentIds.has(s.id)).map(s => {
          let latest: Grading | undefined
          for (const g of gradings) {
            if (g.studentId !== s.id || g.source !== '학습지' || g.worksheetId !== r.ws.id) continue
            if (!latest || g.date > latest.date) latest = g
          }
          return { student: s, score: scoreOf(latest) }
        }),
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, worksheets, gradings, ids, students, excludeDrill])

  function exportCsv() {
    downloadCsv(`학습지현황보드_${label}.csv`, [
      ['출제일', '학습지명', ...students.map(s => s.name)],
      ...rows.map(r => [
        dateKey(r.date), r.ws.title,
        ...students.map(s => {
          const cell = r.scores.find(x => x.student.id === s.id)
          return cell ? (cell.score !== null ? cell.score : '채점 전') : ''
        }),
      ]),
    ])
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <div className="flex rounded-xl border border-line bg-white p-1 text-sm font-bold">
          {([['list', '목록'], ['board', '현황']] as const).map(([v, t]) => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded-lg px-4 py-1.5 ${view === v ? 'bg-pine text-paper' : 'text-ink2 hover:text-ink'}`}>{t}</button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 font-semibold text-ink2">
          <input type="checkbox" checked={excludeDrill} onChange={e => setExcludeDrill(e.target.checked)} />
          오답∙복습학습지 제외
        </label>
        <div className="grow" />
        {view === 'board' && (
          <>
            <span className="flex items-center gap-2 text-xs text-ink2">
              학습지 현황보드 — 정답률 컬러:
              {RATE_LEGEND.map(([t, cls]) => (
                <span key={t} className="flex items-center gap-1"><span className={`inline-block h-3 w-3 rounded ${cls}`} />{t}</span>
              ))}
            </span>
            <button onClick={exportCsv}
              className="rounded-lg border border-pine px-3 py-1.5 text-xs font-bold text-pine hover:bg-pine-soft">
              Excel 다운로드
            </button>
          </>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          {label} 학생들에게 출제한 학습지가 없습니다.
        </div>
      ) : view === 'list' ? (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink2">
                <th className="px-3 py-2.5">학년</th><th>태그</th><th>학습지명</th><th>출제일</th><th>미리보기</th><th>출제</th><th className="pr-3">채점</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const done = r.scores.filter(s => s.score !== null)
                const avg = done.length ? Math.round(done.reduce((a, s) => a + (s.score ?? 0), 0) / done.length) : null
                return (
                  <tr key={r.ws.id} className="border-b border-line/50 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <div className="font-semibold">{r.ws.grade.split('-')[0]}</div>
                      <div className="text-[11px] text-ink2">(22개정)</div>
                    </td>
                    <td className="py-2.5">
                      <div className="flex max-w-40 flex-wrap gap-1">
                        {r.ws.tags.map(t => <span key={t} className="rounded bg-paper2 px-1.5 py-0.5 text-[11px] text-ink2">{t}</span>)}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <b>{r.ws.title}</b>
                      <div className="text-xs text-pine">{r.ws.problemIds.length}문제</div>
                    </td>
                    <td className="whitespace-nowrap py-2.5 text-ink2">{dateKey(r.date).slice(2).replace(/-/g, '.')}</td>
                    <td className="py-2.5">
                      <Link to={`/worksheet/${r.ws.id}`} className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold hover:bg-paper2">미리보기</Link>
                    </td>
                    <td className="whitespace-nowrap py-2.5 text-xs text-ink2">{r.studentIds.size}명</td>
                    <td className="whitespace-nowrap py-2.5 pr-3">
                      {avg !== null
                        ? <span className="text-xs">채점 {done.length}/{r.studentIds.size}명 · 평균 <b className="text-pine-dark">{avg}점</b></span>
                        : <span className="text-xs text-ink2">채점 전</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map(r => (
            <div key={r.ws.id} className="rounded-2xl border border-line bg-white p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-xs text-ink2">{dateKey(r.date).slice(2).replace(/-/g, '.')}</span>
                <b>{r.ws.title}</b>
                <span className="text-xs text-pine">{r.ws.problemIds.length}문제</span>
                <div className="grow" />
                <span className="text-xs text-ink2">출제 {r.studentIds.size}명</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.scores.map(({ student: s, score }) => (
                  <span key={s.id}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${rateColor(score)}`}>
                    {score !== null ? `${score}점` : '채점 전'} <span className="font-semibold opacity-80">{s.name}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════ 보고서 (그룹 학생들의 저장 보고서 목록) ═══════════ */

function GroupReports({ students }: { students: Student[] }) {
  const { savedReports, removeSavedReport } = useStore()
  const [q, setQ] = useState('')
  const ids = useMemo(() => new Set(students.map(s => s.id)), [students])
  const nameOf = useMemo(() => new Map(students.map(s => [s.id, s.name])), [students])
  const KIND_LABEL = { daily: '일일 보고지', monthly: '월간 보고서', analysis: '유형분석 보고서' } as const

  const rows = savedReports.filter(r => ids.has(r.studentId))
    .filter(r => !q.trim() || r.name.includes(q.trim()) || (nameOf.get(r.studentId) ?? '').includes(q.trim()))

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="보고서명·학생 검색"
          className="w-56 rounded-lg border border-line px-3 py-2 text-sm" />
        <span className="text-xs text-ink2">보고서 저장은 각 학생의 보고서 탭 [💾 보고서 저장]에서 합니다.</span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          아직 만들어진 보고서가 없습니다. 새로운 보고서를 만들어보세요.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink2">
                <th className="px-4 py-2.5">이름</th><th>보고서명</th><th>종류</th><th>기간</th><th>생성일</th><th className="pr-4 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-line/50 last:border-0">
                  <td className="px-4 py-2.5 font-semibold">{nameOf.get(r.studentId)}</td>
                  <td className="py-2.5 font-bold">{r.name}</td>
                  <td className="py-2.5 text-xs text-ink2">{KIND_LABEL[r.kind]}</td>
                  <td className="py-2.5 text-xs text-ink2">{r.period}</td>
                  <td className="py-2.5 text-xs text-ink2">{dateKey(r.createdAt).slice(2).replace(/-/g, '.')} 생성</td>
                  <td className="py-2.5 pr-4 text-right">
                    <button onClick={() => { if (confirm(`'${r.name}' 보고서를 삭제할까요?`)) removeSavedReport(r.id) }}
                      className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-clay hover:bg-red-50">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ═══════════ 풀이피드백 (반 전체 베끼기 의심 한눈에 보기) ═══════════ */

function fmtTime2(iso: string): string {
  try { return new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

function GroupSolveFeedback({ students }: { students: Student[] }) {
  const { solveFeedbacks, worksheets, problems } = useStore()
  const ids = useMemo(() => new Set(students.map(s => s.id)), [students])
  const nameOf = useMemo(() => new Map(students.map(s => [s.id, s.name])), [students])
  const groupFb = useMemo(() => solveFeedbacks.filter(f => ids.has(f.studentId)), [solveFeedbacks, ids])

  const perStudent = useMemo(() => students.map(s => {
    const fs = groupFb.filter(f => f.studentId === s.id)
    return { s, total: fs.length, suspect: fs.filter(f => !f.hasWork).length, last: fs.length ? [...fs].sort((a, b) => b.at.localeCompare(a.at))[0].at : '' }
  }).filter(x => x.total > 0).sort((a, b) => b.suspect - a.suspect || b.total - a.total), [students, groupFb])

  const suspectItems = useMemo(() => groupFb.filter(f => !f.hasWork).sort((a, b) => b.at.localeCompare(a.at)), [groupFb])
  const studentsWithSuspect = new Set(suspectItems.map(f => f.studentId)).size

  const wsName = (id: string) => worksheets.find(w => w.id === id)?.title ?? '학습지'
  const probNo = (wsId: string, pid: string) => { const w = worksheets.find(x => x.id === wsId); const i = w ? w.problemIds.indexOf(pid) : -1; return i >= 0 ? i + 1 : null }
  const probType = (pid: string) => { const p = problems.find(x => x.id === pid); return p ? typeName(p.typeId) : '' }

  if (groupFb.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
        아직 이 반의 풀이 피드백이 없습니다. 학생들이 학생앱에서 <b>‘✏️ 풀이 쓰고 AI 피드백 받기’</b>로 풀이를 올리면 반 전체가 한눈에 모입니다.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-bold">반 전체 풀이 피드백 <b className="text-pine">{groupFb.length}</b>건</span>
        <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${suspectItems.length ? 'bg-amber-soft text-amber' : 'bg-pine-soft text-pine-dark'}`}>
          {suspectItems.length ? `⚠️ 베끼기 의심 ${suspectItems.length}건 · ${studentsWithSuspect}명` : '✅ 베끼기 의심 없음'}
        </span>
      </div>

      {/* 학생별 요약 (베끼기 의심 많은 순) */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper2 text-left text-xs text-ink2">
              <th className="px-3 py-2">학생</th><th>풀이 피드백</th><th>베끼기 의심</th><th>최근</th>
            </tr>
          </thead>
          <tbody>
            {perStudent.map(x => (
              <tr key={x.s.id} className={`border-b border-line/50 ${x.suspect > 0 ? 'bg-amber-soft/30' : ''}`}>
                <td className="px-3 py-2 font-bold">{x.s.name}</td>
                <td>{x.total}건</td>
                <td className={x.suspect > 0 ? 'font-bold text-amber' : 'text-ink2'}>{x.suspect > 0 ? `⚠️ ${x.suspect}건` : '—'}</td>
                <td className="text-xs text-ink2">{fmtTime2(x.last)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 베끼기 의심 목록 */}
      {suspectItems.length > 0 && (
        <>
          <div className="mb-2 text-sm font-bold text-amber">⚠️ 베끼기 의심 — 과정 없이 답만 제출</div>
          <div className="grid gap-2">
            {suspectItems.map(f => {
              const no = probNo(f.worksheetId, f.problemId)
              return (
                <div key={f.id} className="rounded-xl border border-amber bg-amber-soft/40 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
                    <b>{nameOf.get(f.studentId) ?? '학생'}</b>
                    <span className="text-ink2">·</span>
                    <span>{wsName(f.worksheetId)}</span>
                    {no != null && <span className="rounded bg-white px-1.5 py-0.5 text-xs font-bold text-ink2">{no}번</span>}
                    <span className="text-xs text-ink2">{probType(f.problemId)}</span>
                    <div className="grow" />
                    <span className="text-xs text-ink2">{fmtTime2(f.at)}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-ink2">{f.feedback}</p>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
