import { useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import { dateKey, todayKey } from '../../lib/dates'
import { DIFFS, DIFF_LABEL } from '../../types'
import type { Diff, Student } from '../../types'

type Group = '학습지' | '교재' | '오답'

interface Row {
  id: string
  badge: '교재' | '학습지' | '숙제'
  group: Group
  label: string
  total: number
  correct: number
  unknown: number
}

const BADGE_STYLE: Record<Row['badge'], string> = {
  교재: 'bg-pine-soft text-pine-dark',
  학습지: 'bg-amber-soft text-amber',
  숙제: 'bg-stone-200 text-stone-700',
}

// 매쓰플랫 수업>학습내역 동일 구조: 날짜 내비 + 진도 카드 + 학습 목록 + 출제 내역 + 숙제 패널 + 난이도 통계
export default function HistoryPanel({ student }: { student: Student }) {
  const { gradings, assignments, worksheets, workbooks, wbItems, problems, removeAssignment } = useStore()
  const [date, setDate] = useState(todayKey())
  const [filter, setFilter] = useState<Group | 'all'>('all')
  const [deleteMode, setDeleteMode] = useState(false)

  const myGradings = useMemo(() => gradings.filter(g => g.studentId === student.id), [gradings, student.id])
  const myAssignments = useMemo(() => assignments.filter(a => a.studentId === student.id), [assignments, student.id])

  // 기록 있는 날짜 칩 (최신 7개)
  const dateChips = useMemo(() => {
    const set = new Set<string>()
    for (const g of myGradings) set.add(dateKey(g.date))
    for (const a of myAssignments) set.add(dateKey(a.date))
    return [...set].sort((a, b) => b.localeCompare(a)).slice(0, 7)
  }, [myGradings, myAssignments])

  const wsMap = useMemo(() => new Map(worksheets.map(w => [w.id, w])), [worksheets])
  const wbMap = useMemo(() => new Map(workbooks.map(w => [w.id, w])), [workbooks])

  const dayGradings = useMemo(() => myGradings.filter(g => dateKey(g.date) === date), [myGradings, date])
  const dayAssignments = useMemo(() => myAssignments.filter(a => dateKey(a.date) === date), [myAssignments, date])

  // 그날 채점 → 학습 목록 행
  const rows = useMemo<Row[]>(() => dayGradings.map(g => {
    const total = g.results.length
    const correct = g.results.filter(r => r.correct).length
    const unknown = g.results.filter(r => r.unknown).length
    if (g.workbookId) {
      const name = wbMap.get(g.workbookId)?.name ?? '교재'
      const range = g.pageFrom != null ? ` p.${g.pageFrom}~${g.pageTo ?? g.pageFrom}` : ''
      return { id: g.id, badge: '교재' as const, group: '교재' as const, label: `${name}${range}`, total, correct, unknown }
    }
    const ws = g.worksheetId ? wsMap.get(g.worksheetId) : undefined
    const isWrong = ws?.tags.includes('오답') ?? false
    const isHomework = !!g.worksheetId && myAssignments.some(a => a.worksheetId === g.worksheetId && a.kind === '숙제')
    return {
      id: g.id,
      badge: (isHomework ? '숙제' : '학습지') as Row['badge'],
      group: (isWrong ? '오답' : '학습지') as Group,
      label: ws?.title ?? '학습지',
      total, correct, unknown,
    }
  }), [dayGradings, wsMap, wbMap, myAssignments])

  const visibleRows = filter === 'all' ? rows : rows.filter(r => r.group === filter)

  function cardOf(group: Group) {
    const rs = rows.filter(r => r.group === group)
    const total = rs.reduce((a, r) => a + r.total, 0)
    const correct = rs.reduce((a, r) => a + r.correct, 0)
    return { n: rs.length, rate: total ? Math.round((correct / total) * 100) : null }
  }

  // 미채점 숙제 (전체 기간)
  const pendingHomework = useMemo(() =>
    myAssignments.filter(a => a.kind === '숙제' && !myGradings.some(g => g.worksheetId === a.worksheetId)),
  [myAssignments, myGradings])

  // 그날 채점 문항의 난이도 분포
  const diffStats = useMemo(() => {
    const acc: Record<Diff, { count: number; correct: number }> = {
      1: { count: 0, correct: 0 }, 2: { count: 0, correct: 0 }, 3: { count: 0, correct: 0 },
      4: { count: 0, correct: 0 }, 5: { count: 0, correct: 0 },
    }
    const itemMap = new Map(wbItems.map(i => [i.id, i]))
    const pMap = new Map(problems.map(p => [p.id, p]))
    for (const g of dayGradings) {
      const ws = g.worksheetId ? wsMap.get(g.worksheetId) : undefined
      g.results.forEach((r, i) => {
        let d: Diff = 3
        if (r.itemId) d = itemMap.get(r.itemId)?.diff ?? 3
        else if (ws) d = pMap.get(ws.problemIds[i] ?? '')?.diff ?? 3
        acc[d].count++
        if (r.correct) acc[d].correct++
      })
    }
    return acc
  }, [dayGradings, wbItems, problems, wsMap])
  const maxDiffCount = Math.max(1, ...DIFFS.map(d => diffStats[d].count))
  const dayTotal = DIFFS.reduce((a, d) => a + diffStats[d].count, 0)

  function pickDate(d: string) {
    setDate(d)
    setFilter('all')
  }

  function cancelHomework(worksheetId: string) {
    if (confirm('숙제를 취소할까요? (수업 출제는 유지)')) removeAssignment(worksheetId, student.id, '숙제')
  }

  const cards: { group: Group; title: string; icon: string }[] = [
    { group: '학습지', title: '학습지', icon: '📄' },
    { group: '교재', title: '교재', icon: '📖' },
    { group: '오답', title: '오답·심화', icon: '🔁' },
  ]

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div>
        {/* 날짜 내비 */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {dateChips.map(d => (
            <button key={d} onClick={() => pickDate(d)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${date === d ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line bg-white text-ink2 hover:border-pine'}`}>
              {d === todayKey() ? '오늘' : d.slice(5).replace('-', '.')}
            </button>
          ))}
          <div className="grow" />
          <input type="date" value={date} onChange={e => pickDate(e.target.value)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm" />
        </div>

        {/* 진도 카드 3종 */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          {cards.map(c => {
            const s = cardOf(c.group)
            const on = filter === c.group
            return (
              <button key={c.group} onClick={() => setFilter(on ? 'all' : c.group)}
                className={`rounded-2xl border p-4 text-left transition ${on ? 'border-pine bg-pine-soft/60' : 'border-line bg-white hover:border-pine'}`}>
                <div className="text-xs font-bold text-ink2">{c.icon} {c.title}</div>
                <div className="mt-1 text-xl font-black text-ink">{s.n}<span className="text-sm font-bold">건</span></div>
                <div className="mt-0.5 text-xs text-ink2">{s.rate === null ? '기록 없음' : `정답률 ${s.rate}%`}</div>
              </button>
            )
          })}
        </div>

        {/* 학습 목록 표 */}
        <div className="mb-5 rounded-2xl border border-line bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-black">
            학습 목록
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')} className="rounded-full bg-paper2 px-2 py-0.5 text-xs font-semibold text-ink2 hover:text-ink">
                {filter} 필터 해제 ✕
              </button>
            )}
          </div>
          {visibleRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink2">이 날짜에 채점 기록이 없습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink2">
                  <th className="py-1.5">구분</th><th>내용</th><th>채점</th><th>정답률</th><th>비고</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(r => (
                  <tr key={r.id} className="border-b border-line/50">
                    <td className="py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-bold ${BADGE_STYLE[r.badge]}`}>{r.badge}</span>
                    </td>
                    <td className="py-2 pr-2 font-semibold">{r.label}</td>
                    <td className="py-2">{r.correct}/{r.total}</td>
                    <td className="py-2 font-bold text-pine-dark">{r.total ? Math.round((r.correct / r.total) * 100) : 0}%</td>
                    <td className="py-2 text-xs text-ink2">{r.unknown > 0 ? `모름 ${r.unknown}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 그날 출제 내역 */}
        <div className="mb-5 rounded-2xl border border-line bg-white p-5">
          <div className="mb-3 text-sm font-black">출제 내역</div>
          {dayAssignments.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink2">이 날짜에 출제한 학습지가 없습니다.</p>
          ) : (
            <div className="grid gap-2">
              {dayAssignments.map(a => {
                const ws = wsMap.get(a.worksheetId)
                const graded = myGradings.some(g => g.worksheetId === a.worksheetId)
                return (
                  <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line/70 px-3 py-2 text-sm">
                    <span className={`rounded px-2 py-0.5 text-xs font-bold ${a.kind === '숙제' ? BADGE_STYLE['숙제'] : 'bg-pine-soft text-pine-dark'}`}>{a.kind}</span>
                    <span className="font-semibold">{ws?.title ?? '삭제된 학습지'}</span>
                    <span className={`text-xs font-bold ${graded ? 'text-pine' : 'text-ink2'}`}>{graded ? '✓ 채점 완료' : '미채점'}</span>
                    <div className="grow" />
                    {a.kind === '숙제' && (
                      <button onClick={() => cancelHomework(a.worksheetId)}
                        className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-clay hover:bg-red-50">
                        숙제 취소
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 난이도별 통계 */}
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="mb-3 text-sm font-black">난이도별 통계 <span className="font-normal text-ink2">— 이날 채점 {dayTotal}문항</span></div>
          {dayTotal === 0 ? (
            <p className="py-4 text-center text-sm text-ink2">채점 기록이 쌓이면 난이도 분포가 표시됩니다.</p>
          ) : (
            <div className="grid gap-2">
              {DIFFS.map(d => {
                const s = diffStats[d]
                const rate = s.count ? Math.round((s.correct / s.count) * 100) : null
                return (
                  <div key={d} className="flex items-center gap-3 text-sm">
                    <span className="w-10 shrink-0 text-xs font-bold text-ink2">{DIFF_LABEL[d]}</span>
                    <div className="h-5 grow overflow-hidden rounded bg-paper2">
                      <div className="h-full rounded bg-pine/80" style={{ width: `${(s.count / maxDiffCount) * 100}%` }} />
                    </div>
                    <span className="w-28 shrink-0 text-right text-xs text-ink2">
                      {s.count}문항{rate !== null ? ` · 정답률 ${rate}%` : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 우측 숙제 패널 */}
      <aside className="h-fit rounded-2xl border border-line bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-black">숙제 <span className="font-normal text-ink2">미채점 {pendingHomework.length}건</span></span>
          {pendingHomework.length > 0 && (
            <button onClick={() => setDeleteMode(m => !m)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${deleteMode ? 'bg-pine text-paper' : 'border border-line text-ink2 hover:text-ink'}`}>
              {deleteMode ? '완료' : '숙제 삭제'}
            </button>
          )}
        </div>
        {pendingHomework.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink2">확인할 숙제가 없습니다.</p>
        ) : (
          <div className="grid gap-2">
            {pendingHomework.map(a => {
              const ws = wsMap.get(a.worksheetId)
              return (
                <div key={a.id} className="flex items-center gap-2 rounded-xl border border-line/70 px-3 py-2">
                  <div className="min-w-0 grow">
                    <div className="truncate text-sm font-semibold">{ws?.title ?? '삭제된 학습지'}</div>
                    <div className="text-[11px] text-ink2">{dateKey(a.date)} 출제</div>
                  </div>
                  {deleteMode ? (
                    <button onClick={() => cancelHomework(a.worksheetId)}
                      className="shrink-0 rounded-lg bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800 hover:brightness-95">
                      삭제
                    </button>
                  ) : (
                    <span className="shrink-0 rounded-lg bg-amber-soft px-2.5 py-1 text-xs font-bold text-amber">확인하기</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </aside>
    </div>
  )
}
