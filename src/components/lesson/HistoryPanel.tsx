import { Fragment, useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import { dateKey, todayKey } from '../../lib/dates'
import { DIFFS, DIFF_LABEL } from '../../types'
import type { Diff, Student } from '../../types'

type Group = '학습지' | '교재' | '오답' | '챌린지'

interface Row {
  id: string
  badge: '교재' | '학습지' | '숙제'
  group: '학습지' | '교재' | '오답'
  label: string
  round?: number      // [N회차] — 같은 대상 몇 번째 채점인지
  total: number
  correct: number
  unknown: number
}

// 매쓰플랫 진도 카드 색상 (학습지=파랑 · 교재=연두 · 오답심화·챌린지=보라)
const CARD_COLOR: Record<Group, { on: string; off: string; text: string }> = {
  학습지: { on: 'border-pine bg-pine-soft/60', off: 'border-pine/40 bg-white hover:bg-pine-soft/30', text: 'text-pine-dark' },
  교재: { on: 'border-lime-500 bg-lime-50', off: 'border-lime-300 bg-white hover:bg-lime-50/60', text: 'text-lime-700' },
  오답: { on: 'border-purple-500 bg-purple-50', off: 'border-purple-300 bg-white hover:bg-purple-50/60', text: 'text-purple-700' },
  챌린지: { on: 'border-purple-500 bg-purple-50', off: 'border-purple-300 bg-white hover:bg-purple-50/60', text: 'text-purple-700' },
}

const BADGE_STYLE: Record<Row['badge'], string> = {
  교재: 'bg-pine-soft text-pine-dark',
  학습지: 'bg-amber-soft text-amber',
  숙제: 'bg-stone-200 text-stone-700',
}

const mmdd = (d: string) => d.slice(5).replace('-', '.')

// 매쓰플랫 수업>학습내역 동일 구조: 날짜 내비 + 진도 카드 + 학습 목록 + 출제 내역 + 숙제 패널 + 난이도 통계
export default function HistoryPanel({ student }: { student: Student }) {
  const { gradings, assignments, worksheets, workbooks, wbItems, problems, removeAssignment } = useStore()
  const [date, setDate] = useState(todayKey())
  const [rangeTo, setRangeTo] = useState<string | null>(null)   // 기간 조회 모드: date ~ rangeTo
  const [calOpen, setCalOpen] = useState(false)                 // 커스텀 달력 피커
  const [filter, setFilter] = useState<Group | 'all'>('all')
  const [deleteMode, setDeleteMode] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const myGradings = useMemo(() => gradings.filter(g => g.studentId === student.id), [gradings, student.id])
  const myAssignments = useMemo(() => assignments.filter(a => a.studentId === student.id), [assignments, student.id])

  // 기록 있는 날짜 (오름차순 전체)
  const recordedDates = useMemo(() => {
    const set = new Set<string>()
    for (const g of myGradings) set.add(dateKey(g.date))
    for (const a of myAssignments) set.add(dateKey(a.date))
    return [...set].sort()
  }, [myGradings, myAssignments])
  // 지난 수업: 현재 날짜보다 앞선 가장 가까운 기록일 / 최근 학습일: 기록 있는 가장 최근 날짜
  const prevDate = useMemo(() => [...recordedDates].reverse().find(d => d < date), [recordedDates, date])
  const latestDate = recordedDates.length ? recordedDates[recordedDates.length - 1] : undefined

  const wsMap = useMemo(() => new Map(worksheets.map(w => [w.id, w])), [worksheets])
  const wbMap = useMemo(() => new Map(workbooks.map(w => [w.id, w])), [workbooks])

  // 단일 날짜 또는 기간(date ~ rangeTo) 조회
  const inView = (d: string) => rangeTo ? d >= date && d <= rangeTo : d === date
  const dayGradings = useMemo(() => myGradings.filter(g => inView(dateKey(g.date))), [myGradings, date, rangeTo])   // eslint-disable-line react-hooks/exhaustive-deps
  const dayAssignments = useMemo(() => myAssignments.filter(a => inView(dateKey(a.date))), [myAssignments, date, rangeTo])   // eslint-disable-line react-hooks/exhaustive-deps

  // [N회차] — 같은 대상(학습지/교재)을 몇 번째 채점한 기록인지 (전체 이력 기준)
  const roundOf = useMemo(() => {
    const m = new Map<string, number>()
    const sorted = [...myGradings].sort((a, b) => a.date.localeCompare(b.date))
    const cnt = new Map<string, number>()
    for (const g of sorted) {
      const target = g.worksheetId ?? g.workbookId
      if (!target) continue
      const n = (cnt.get(target) ?? 0) + 1
      cnt.set(target, n)
      m.set(g.id, n)
    }
    return m
  }, [myGradings])

  // 그날 채점 → 학습 목록 행
  const rows = useMemo<Row[]>(() => dayGradings.map(g => {
    const total = g.results.length
    const correct = g.results.filter(r => r.correct).length
    const unknown = g.results.filter(r => r.unknown).length
    if (g.imported) {
      // 매쓰플랫 이관 이력 — 원본 참조 없이 저장된 제목·분류로 직접 렌더
      const group: Row['group'] = g.category === '오답' ? '오답' : g.category === '교재' ? '교재' : '학습지'
      const badge: Row['badge'] = g.category === '교재' ? '교재' : '학습지'
      return { id: g.id, badge, group, label: g.title ?? '학습지', total, correct, unknown }
    }
    if (g.workbookId) {
      const name = wbMap.get(g.workbookId)?.name ?? '교재'
      const range = g.pageFrom != null ? ` p.${g.pageFrom}~${g.pageTo ?? g.pageFrom}` : ''
      return { id: g.id, badge: '교재' as const, group: '교재' as const, label: `${name}${range}`, round: roundOf.get(g.id), total, correct, unknown }
    }
    const ws = g.worksheetId ? wsMap.get(g.worksheetId) : undefined
    const isWrong = ws?.tags.includes('오답') ?? false
    const isHomework = !!g.worksheetId && myAssignments.some(a => a.worksheetId === g.worksheetId && a.kind === '숙제')
    return {
      id: g.id,
      badge: (isHomework ? '숙제' : '학습지') as Row['badge'],
      group: (isWrong ? '오답' : '학습지') as Row['group'],
      label: ws?.title ?? '학습지',
      round: roundOf.get(g.id),
      total, correct, unknown,
    }
  }), [dayGradings, wsMap, wbMap, myAssignments, roundOf])

  const visibleRows = filter === 'all' ? rows : rows.filter(r => r.group === filter)

  function cardOf(group: Group) {
    const rs = rows.filter(r => r.group === group)   // 챌린지는 우리 데이터에 없어 항상 0
    const total = rs.reduce((a, r) => a + r.total, 0)
    const correct = rs.reduce((a, r) => a + r.correct, 0)
    return { total, rate: total ? Math.round((correct / total) * 100) : 0 }
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
        // 학습지 채점의 itemId는 문제 id (신규 기록) — 교재(WBItem)보다 먼저 학습지로 분기
        if (ws) d = pMap.get(r.itemId ?? ws.problemIds[i] ?? '')?.diff ?? 3
        else if (r.itemId) d = itemMap.get(r.itemId)?.diff ?? 3
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
    setRangeTo(null)
    setFilter('all')
    setOpenId(null)
  }
  function pickRange(from: string, to: string) {
    setDate(from)
    setRangeTo(to)
    setFilter('all')
    setOpenId(null)
  }

  function cancelHomework(worksheetId: string) {
    if (confirm('숙제를 취소할까요? (수업 출제는 유지)')) removeAssignment(worksheetId, student.id, '숙제')
  }

  // 매쓰플랫 진도 카드 4종 (2×2): 학습지·교재·오답심화·챌린지
  const cards: { group: Group; title: string; icon: string }[] = [
    { group: '학습지', title: '학습지', icon: '📄' },
    { group: '교재', title: '교재', icon: '📖' },
    { group: '오답', title: '오답·심화', icon: '🔁' },
    { group: '챌린지', title: '챌린지', icon: '🏆' },
  ]

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div>
        {/* 날짜 내비 (매쓰플랫식: 지난 수업 | 현재 날짜 + 📅달력(기간 선택 지원) | 최근 학습일) */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {prevDate && !rangeTo && (
            <button onClick={() => pickDate(prevDate)}
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink2 hover:border-pine hover:text-ink">
              &lt; 지난 수업 {mmdd(prevDate)}
            </button>
          )}
          {rangeTo ? (
            <span className="text-sm font-black">
              {date.replaceAll('-', '.')} ~ {rangeTo.replaceAll('-', '.')}
              <button onClick={() => pickDate(todayKey())} className="ml-2 rounded-full bg-paper2 px-2 py-0.5 text-xs font-semibold text-ink2 hover:text-ink">기간 해제 ✕</button>
            </span>
          ) : (
            <span className="text-sm font-black">{date === todayKey() ? `오늘 ${mmdd(date)}` : mmdd(date)}</span>
          )}
          <div className="relative">
            <button onClick={() => setCalOpen(v => !v)} title="달력 (기간 선택 가능)"
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm hover:border-pine">📅</button>
            {calOpen && (
              <CalendarPicker
                recorded={new Set(recordedDates)}
                onPickDay={d => { pickDate(d); setCalOpen(false) }}
                onPickRange={(f, t) => { pickRange(f, t); setCalOpen(false) }}
                onClose={() => setCalOpen(false)} />
            )}
          </div>
          <div className="grow" />
          {latestDate && (
            <button onClick={() => pickDate(latestDate)}
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-pine-dark hover:border-pine">
              최근 학습일
            </button>
          )}
        </div>

        {/* 진도 카드 3종 */}
        <div className="mb-2 flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-black">진도</span>
          <span className="text-xs text-ink2">각 카드를 선택해 필요한 학습내용만 확인할 수 있어요.</span>
        </div>
        <div className="mb-5 grid grid-cols-2 gap-3">
          {cards.map(c => {
            const s = cardOf(c.group)
            const on = filter === c.group
            const col = CARD_COLOR[c.group]
            return (
              <button key={c.group} onClick={() => setFilter(on ? 'all' : c.group)}
                className={`rounded-2xl border p-4 text-left transition ${on ? col.on : col.off}`}>
                <div className={`text-xs font-bold ${col.text}`}>{c.icon} {c.title}</div>
                <div className="mt-1.5 text-sm text-ink2">총 문제 수 <b className="text-lg text-ink">{s.total}</b>개</div>
                <div className="mt-0.5 text-xs text-ink2">정답률 {s.rate}%</div>
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
                  <th className="py-1.5">진도</th><th>채점</th><th>정답률</th><th>상세보기</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(r => (
                  <Fragment key={r.id}>
                    <tr className="border-b border-line/50">
                      <td className="py-2 pr-2">
                        <span className={`mr-2 rounded px-2 py-0.5 text-xs font-bold ${BADGE_STYLE[r.badge]}`}>{r.badge}</span>
                        <span className="font-semibold">{r.round != null && <span className="text-pine-dark">[{r.round}회차] </span>}{r.label}</span>
                      </td>
                      <td className="py-2">{r.correct}/{r.total}</td>
                      <td className="py-2 font-bold text-pine-dark">{r.total ? Math.round((r.correct / r.total) * 100) : 0}%</td>
                      <td className="py-2">
                        <button onClick={() => setOpenId(openId === r.id ? null : r.id)}
                          className="text-xs font-semibold text-pine-dark hover:underline">
                          {openId === r.id ? '접기 ∧' : '상세보기 ∨'}
                        </button>
                      </td>
                    </tr>
                    {openId === r.id && (
                      <tr className="border-b border-line/50 bg-paper2/60">
                        <td colSpan={4} className="px-2 py-2 text-xs text-ink2">
                          정답 {r.correct}문항 · 오답 {r.total - r.correct}문항{r.unknown > 0 ? ` (모름 ${r.unknown})` : ''} · 총 {r.total}문항
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
          <div className="mb-3 flex flex-wrap items-baseline gap-2 text-sm font-black">
            난이도별 통계 <span className="font-normal text-ink2">— 이날 채점 {dayTotal}문항</span>
            <span className="ml-auto text-[11px] font-normal text-ink2"><span className="text-pine">▪</span>문제수 <span className="text-amber">●</span>정답률</span>
          </div>
          {dayTotal === 0 ? (
            <p className="py-4 text-center text-sm text-ink2">통계 내역이 없습니다.</p>
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
                      {s.count}문항{rate !== null && <> · <span className="text-amber">●</span> {rate}%</>}
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
        <button
          onClick={() => alert('숙제 내기 방법\n\n1) 수업 > 학습지 탭에서 학습지를 체크하고 하단 바의 [숙제 내기]를 누르거나, 행의 [숙제내기] 버튼을 누르세요.\n2) 학생은 학생앱 > 학습지에서 "숙제" 뱃지가 붙은 학습지를 풀어 제출합니다.\n3) 제출되면 이 패널의 미채점 건수가 줄고, 학습내역에 채점 기록이 쌓입니다.')}
          className="mb-2 text-xs font-semibold text-pine hover:underline">
          숙제는 어떻게 내주나요?
        </button>
        {pendingHomework.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink2">숙제 내역이 없습니다.</p>
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

// ── 커스텀 달력 피커 (매쓰플랫 동일 구성): 월 네비 + 학습일 점 표시 + 기간 선택 모드
//    + [오늘 기준 지난 7일]/[오늘 기준 지난 한 달] 프리셋 + "1년까지 조회" 안내 ──
function CalendarPicker({ recorded, onPickDay, onPickRange, onClose }: {
  recorded: Set<string>
  onPickDay: (d: string) => void
  onPickRange: (from: string, to: string) => void
  onClose: () => void
}) {
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 })
  const [rangeMode, setRangeMode] = useState(false)
  const [rFrom, setRFrom] = useState('')
  const [rTo, setRTo] = useState('')

  const key = (d: number) => `${ym.y}-${String(ym.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const daysInMonth = new Date(ym.y, ym.m, 0).getDate()
  const firstDay = new Date(ym.y, ym.m - 1, 1).getDay()   // 0=일
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const maxTo = (from: string) => {   // 시작일 기준 1년까지 조회 가능
    const d = new Date(from); d.setFullYear(d.getFullYear() + 1)
    return dateKey(d)
  }

  function clickDay(d: number) {
    const k = key(d)
    if (!rangeMode) { onPickDay(k); return }
    if (!rFrom || (rFrom && rTo)) { setRFrom(k); setRTo('') }
    else if (k < rFrom) { setRFrom(k) }
    else if (k > maxTo(rFrom)) { alert('기간의 시작일을 기준으로 1년까지 조회할 수 있습니다.') }
    else setRTo(k)
  }
  function preset(days: number) {
    const to = todayKey()
    const d = new Date(); d.setDate(d.getDate() - days)
    onPickRange(dateKey(d), to)
  }

  const prevM = () => setYm(({ y, m }) => m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 })
  const nextM = () => setYm(({ y, m }) => m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 })

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute left-0 top-full z-20 mt-1 w-80 rounded-xl border border-line bg-white p-4 shadow-xl">
        {/* 기간 선택 모드 헤더 */}
        <div className="mb-3 flex items-center justify-between text-xs font-bold">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={rangeMode} onChange={e => { setRangeMode(e.target.checked); setRFrom(''); setRTo('') }} />
            기간 선택
          </label>
          {rangeMode && (
            <span className="text-ink2">
              [{rFrom ? rFrom.replaceAll('-', '.') : '시작일'}] ~ [{rTo ? rTo.replaceAll('-', '.') : '종료일'}]
            </span>
          )}
        </div>
        {rangeMode && !rFrom && <p className="mb-2 text-center text-xs text-ink2">기간을 선택해주세요.</p>}

        {/* 월 네비 */}
        <div className="mb-2 flex items-center justify-between text-sm font-bold">
          <button onClick={prevM} className="rounded px-2 py-1 hover:bg-paper2">← {ym.m === 1 ? 12 : ym.m - 1}월</button>
          <span>{ym.y}년 {ym.m}월</span>
          <button onClick={nextM} className="rounded px-2 py-1 hover:bg-paper2">{ym.m === 12 ? 1 : ym.m + 1}월 →</button>
        </div>

        {/* 요일 + 날짜 (학습일 점 표시) */}
        <div className="grid grid-cols-7 text-center text-[11px] font-bold text-ink2">
          {['일', '월', '화', '수', '목', '금', '토'].map(d => <span key={d} className="py-1">{d}</span>)}
        </div>
        <div className="mb-2 grid grid-cols-7 text-center">
          {cells.map((d, i) => {
            if (d === null) return <span key={i} />
            const k = key(d)
            const inRange = rangeMode && rFrom && ((rTo && k >= rFrom && k <= rTo) || k === rFrom)
            return (
              <button key={i} onClick={() => clickDay(d)}
                className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold hover:bg-paper2 ${
                  inRange ? 'bg-pine text-paper hover:bg-pine' : k === todayKey() ? 'border border-pine text-pine-dark' : ''}`}>
                {d}
                {recorded.has(k) && <span className={`absolute bottom-0.5 h-1 w-1 rounded-full ${inRange ? 'bg-paper' : 'bg-pine'}`} />}
              </button>
            )
          })}
        </div>

        {/* 프리셋 + 적용 */}
        <div className="mb-2 flex flex-wrap gap-1.5">
          <button onClick={() => preset(6)} className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold hover:border-pine">오늘 기준 지난 7일</button>
          <button onClick={() => preset(29)} className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold hover:border-pine">오늘 기준 지난 한 달</button>
        </div>
        {rangeMode && (
          <div className="mb-2 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink2 hover:bg-paper2">취소</button>
            <button disabled={!rFrom || !rTo} onClick={() => onPickRange(rFrom, rTo)}
              className="rounded-lg bg-pine px-4 py-1.5 text-xs font-bold text-paper hover:brightness-105 disabled:opacity-40">적용하기</button>
          </div>
        )}
        <p className="text-[11px] text-ink2">기간의 시작일을 기준으로 1년까지 조회할 수 있습니다.</p>
      </div>
    </>
  )
}
