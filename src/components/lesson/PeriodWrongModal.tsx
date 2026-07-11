import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Grading, Student, Worksheet } from '../../types'
import { DEFAULT_SHEET_OPTIONS } from '../../types'
import { useStore, uid } from '../../lib/store'
import { useBrand } from '../../lib/brand'
import { dateKey, todayKey } from '../../lib/dates'
import { pickDrillProblems, wrongByType, type TypeStat, type WrongRef } from '../../lib/drill'
import { achievementOf } from '../../lib/achievement'
import { CURRICULA, curriculumFor, courseTagOfType, typeName } from '../../data/curriculum'
import DrillModal, { type DrillWrong } from './DrillModal'

type Tab = 'weak' | 'period' | 'sheet'

const TABS: [Tab, string][] = [
  ['weak', '단원별 취약 유형'],
  ['period', '기간별 오답'],
  ['sheet', '학습지별 오답'],
]

// 출제 방식 3종 (원본 문구)
const WAYS = [
  ['same', '틀린 문제 그대로'],
  ['twin', '틀린 문제의 쌍둥이・유사문제'],
  ['both', '틀린 문제 그대로+쌍둥이・유사문제'],
] as const
type Way = typeof WAYS[number][0]

// 매쓰플랫 「단원·기간별 취약 유형 관리」 (풀스크린 3탭) — 원본 구조: 단원 트리 + 우측 2탭
export default function PeriodWrongModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const { gradings, wbItems, worksheets, problems, assignments, saveWorksheet, addAssignment, ensureCourse } = useStore()
  const brand = useBrand()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('weak')
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return dateKey(d)
  })
  const [to, setTo] = useState(todayKey())
  const [checked, setChecked] = useState<Set<string>>(new Set())   // 탭3 선택 학습지
  const [drill, setDrill] = useState<{ title: string; wrongs: DrillWrong[]; tags: string[] } | null>(null)

  const itemMap = useMemo(() => new Map(wbItems.map(i => [i.id, i])), [wbItems])
  const problemMap = useMemo(() => new Map(problems.map(p => [p.id, p])), [problems])
  const wsMap = useMemo(() => new Map(worksheets.map(w => [w.id, w])), [worksheets])

  // ── 공용: 학습지 생성 (매쓰플랫 [편집 후 만들기]/[바로 만들기]) ──
  function createSheet(title: string, tags: string[], problemIds: string[], autoGrade: boolean, mode: 'view' | 'edit', firstTypeId?: string) {
    if (problemIds.length === 0) { alert('선발 가능한 문제가 문제은행에 없습니다.'); return }
    const id = uid('ws')
    saveWorksheet({
      id, title, author: brand,
      grade: (firstTypeId && courseTagOfType(firstTypeId)) || student.grade,
      tags, theme: 'amber', problemIds, conceptIds: [],
      options: { ...DEFAULT_SHEET_OPTIONS, autoGrade, wrongNoteArea: true },
      listIds: [], createdAt: new Date().toISOString(), deletedAt: null,
    })
    addAssignment(id, [student.id], '수업')
    onClose()
    nav(mode === 'view' ? `/worksheet/${id}` : `/make?edit=${id}`)
  }

  // ── 탭1: 단원별 취약 유형 — 최근 1년 채점 기준 ─────────────────────
  const yearAgo = useMemo(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return dateKey(d) }, [])
  const yearGradings = useMemo(
    () => gradings.filter(g => g.studentId === student.id && dateKey(g.date) >= yearAgo),
    [gradings, student.id, yearAgo],
  )
  const stats = useMemo(() => wrongByType(student.id, yearGradings, wbItems), [student.id, yearGradings, wbItems])
  const statMap = useMemo(() => new Map(stats.map(s => [s.typeId, s])), [stats])

  const [courseId, setCourseId] = useState(() => CURRICULA.find(c => c.grade === student.grade)?.id ?? 'm1-1')
  useEffect(() => { ensureCourse(courseId) }, [courseId, ensureCourse])
  const course = curriculumFor(courseId)
  const [learnedOnly, setLearnedOnly] = useState<'all' | 'learned'>('learned')
  const [openUnits, setOpenUnits] = useState<Set<string>>(new Set())
  const [selTypes, setSelTypes] = useState<Set<string>>(new Set())
  const [rightTab, setRightTab] = useState<'type' | 'problem'>('type')

  // 좌측 트리: 대단원별 유형 목록 + 정답률
  const unitRows = useMemo(() => {
    return course.units.map(u => {
      const types = u.mids.flatMap(m => m.subs.flatMap(s => s.types))
        .filter(t => learnedOnly === 'all' || statMap.has(t.id))
      let total = 0, wrong = 0
      for (const t of types) {
        const s = statMap.get(t.id)
        if (s) { total += s.total; wrong += s.wrong }
      }
      const rate = total ? Math.round((1 - wrong / total) * 100) : null
      return { unit: u, types, rate }
    }).filter(r => r.types.length > 0)
  }, [course, statMap, learnedOnly])

  function toggleType(id: string) {
    setSelTypes(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  // ── 탭1 우측 · 틀린 유형 학습지 옵션 ──
  const [wayBasis, setWayBasis] = useState<'count' | 'rate'>('count')  // 유형 수 기준 / 정답률 기준
  const [topN, setTopN] = useState(5)
  const [rateMax, setRateMax] = useState(50)
  const [typeDiff, setTypeDiff] = useState<'twin' | 'easy' | 'same' | 'hard'>('twin')
  const [typeAuto, setTypeAuto] = useState(true)
  const [includeAssigned, setIncludeAssigned] = useState(true)   // 출제된 문제 포함 (기본 포함)
  const [rankOpen, setRankOpen] = useState(false)                // 취약순위표

  // 취약 순위 (정답률 낮은 순, 최근 1년)
  const weakRank = useMemo(() =>
    [...stats].filter(s => s.wrong > 0)
      .sort((a, b) => (1 - b.wrong / b.total) < (1 - a.wrong / a.total) ? 1 : -1), [stats])

  // 이 학생에게 이미 출제된 문제 id ('출제된 문제 포함' 해제 시 제외)
  const assignedIds = useMemo(() => {
    const set = new Set<string>()
    for (const a of assignments) {
      if (a.studentId !== student.id) continue
      const ws = wsMap.get(a.worksheetId)
      if (ws) for (const pid of ws.problemIds) set.add(pid)
    }
    return set
  }, [assignments, student.id, wsMap])

  // 대상 유형: 트리에서 직접 선택 > 기준(상위 취약 N / 정답률 X% 이하)
  const targetTypes = useMemo<TypeStat[]>(() => {
    if (selTypes.size > 0) return [...selTypes].map(id => statMap.get(id) ?? { typeId: id, wrong: 0, total: 0 })
    if (wayBasis === 'count') return weakRank.slice(0, topN)
    return weakRank.filter(s => Math.round((1 - s.wrong / s.total) * 100) <= rateMax)
  }, [selTypes, statMap, wayBasis, weakRank, topN, rateMax])

  // 틀린 유형 학습지 문제 선발 (난이도 옵션: 쌍둥이/쉽게/그대로/어렵게)
  const typeSheetIds = useMemo(() => {
    const refs: WrongRef[] = targetTypes.map(s => ({ typeId: s.typeId }))
    const excludeIds = new Set<string>(includeAssigned ? [] : assignedIds)
    const opts = typeDiff === 'twin'
      ? { twinPer: 1, similarPer: 1, diffShift: 0 as const, typeCap: 3, excludeIds }
      : { twinPer: 0, similarPer: 2, diffShift: (typeDiff === 'easy' ? -1 : typeDiff === 'hard' ? 1 : 0) as -1 | 0 | 1, typeCap: 3, excludeIds }
    return pickDrillProblems(refs, problems, opts).map(p => p.id)
  }, [targetTypes, typeDiff, includeAssigned, assignedIds, problems])

  // ── 탭1 우측 · 틀린 문제 학습지 옵션 (최근 1년 틀린 문제 기반) ──
  const [probWay, setProbWay] = useState<Way>('twin')
  const [probCap, setProbCap] = useState(50)
  const [probAuto, setProbAuto] = useState(true)

  // 최근 1년 틀린 문제 참조 (선택 유형이 있으면 그 유형만)
  const yearWrongs = useMemo(() => {
    const out: DrillWrong[] = []
    for (const g of yearGradings) {
      const ws = g.worksheetId ? wsMap.get(g.worksheetId) : undefined
      g.results.forEach((r, i) => {
        if (r.correct) return
        if (g.source === '학습지') {
          const pid = r.itemId ?? ws?.problemIds[i]
          const p = pid ? problemMap.get(pid) : undefined
          const typeId = r.typeId ?? p?.typeId
          if (typeId) out.push({ typeId, diff: p?.diff, problemId: pid })
        } else if (r.itemId) {
          const it = itemMap.get(r.itemId)
          if (it) out.push({ typeId: it.typeId, diff: it.diff })
        }
      })
    }
    return selTypes.size > 0 ? out.filter(w => selTypes.has(w.typeId)) : out
  }, [yearGradings, wsMap, problemMap, itemMap, selTypes])

  // 출제 방식 3종 → 문제 id (최대 150)
  function pickByWay(wrongs: DrillWrong[], way: Way, cap: number): string[] {
    const originals: string[] = []
    for (const w of wrongs) {
      if (w.problemId && problemMap.has(w.problemId) && !originals.includes(w.problemId)) originals.push(w.problemId)
    }
    let ids: string[] = []
    if (way === 'same') ids = originals
    else {
      const excludeIds = new Set<string>(way === 'both' ? originals : [])
      const picked = pickDrillProblems(wrongs, problems, { twinPer: 1, similarPer: 1, diffShift: 0, typeCap: 3, excludeIds }).map(p => p.id)
      ids = way === 'both' ? [...originals, ...picked] : picked
    }
    return ids.slice(0, Math.min(150, Math.max(1, cap)))
  }
  const probSheetIds = useMemo(() => pickByWay(yearWrongs, probWay, probCap), [yearWrongs, probWay, probCap])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── 탭2: 기간 내 오답 집계 — 소스별(시그니처/시중/내 교재/내 학습지) ──
  const { srcCounts, periodWrongs } = useMemo(() => {
    const out: DrillWrong[] = []
    const counts = { signature: 0, market: 0, myBook: 0, mySheet: 0 }
    const wbById = new Map(wbItems.map(i => [i.id, i]))
    for (const g of gradings) {
      if (g.studentId !== student.id) continue
      const k = dateKey(g.date)
      if (k < from || k > to) continue
      const isSheet = g.source === '학습지'
      const ws = g.worksheetId ? wsMap.get(g.worksheetId) : undefined
      g.results.forEach((r, i) => {
        if (r.correct) return
        if (isSheet) {
          const pid = r.itemId ?? ws?.problemIds[i]
          const p = pid ? problemMap.get(pid) : undefined
          const typeId = r.typeId ?? p?.typeId
          if (typeId) { out.push({ typeId, diff: p?.diff, problemId: pid }); counts.mySheet++ }
        } else if (r.itemId) {
          const it = wbById.get(r.itemId)
          if (it) {
            out.push({ typeId: it.typeId, diff: it.diff })
            // 시중교재 = 매칭 교재(파생 문항 id에 '#' 포함), 내 교재 = 직접 등록
            if (r.itemId.includes('#')) counts.market++; else counts.myBook++
          }
        }
      })
    }
    return { srcCounts: counts, periodWrongs: out }
  }, [gradings, student.id, from, to, wsMap, problemMap, wbItems])

  const total = periodWrongs.length
  const [periodWay, setPeriodWay] = useState<Way>('twin')
  const [periodCap, setPeriodCap] = useState(50)
  const [periodAuto, setPeriodAuto] = useState(true)
  const periodIds = useMemo(() => pickByWay(periodWrongs, periodWay, periodCap), [periodWrongs, periodWay, periodCap])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── 탭3: 채점된 학습지 목록 (학습지별 최신 채점의 오답, 원문제 id 포함) ──
  const gradedSheets = useMemo(() => {
    const latest = new Map<string, Grading>()
    for (const g of gradings) {
      if (g.studentId !== student.id || g.source !== '학습지' || !g.worksheetId) continue
      const cur = latest.get(g.worksheetId)
      if (!cur || g.date > cur.date) latest.set(g.worksheetId, g)
    }
    const out: { ws: Worksheet; wrongs: DrillWrong[]; date: string; score: number; assignedAt?: string }[] = []
    for (const [wsId, g] of latest) {
      const ws = wsMap.get(wsId)
      if (!ws || ws.deletedAt) continue
      const wrongs: DrillWrong[] = []
      g.results.forEach((r, i) => {
        if (r.correct) return
        const pid = r.itemId ?? ws.problemIds[i]   // 신규=itemId(문제 id), 구버전=순서
        const p = pid ? problemMap.get(pid) : undefined
        const typeId = r.typeId ?? p?.typeId
        if (typeId) wrongs.push({ typeId, diff: p?.diff, problemId: pid })
      })
      const score = g.results.length ? Math.round(g.results.filter(r => r.correct).length / g.results.length * 100) : 0
      const assignedAt = assignments.find(a => a.worksheetId === wsId && a.studentId === student.id)?.date
      out.push({ ws, wrongs, date: g.date, score, assignedAt })
    }
    return out.sort((a, b) => b.date.localeCompare(a.date))
  }, [gradings, student.id, wsMap, problemMap, assignments])

  const selectedWrongs = useMemo(
    () => gradedSheets.filter(s => checked.has(s.ws.id)).flatMap(s => s.wrongs),
    [gradedSheets, checked],
  )

  function toggleSheet(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (drill) {
    return (
      <DrillModal
        student={student}
        title={drill.title}
        wrongs={drill.wrongs}
        defaultTags={drill.tags}
        onClose={onClose}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="text-lg font-black">단원·기간별 취약 유형 관리</div>
          <button onClick={onClose} aria-label="닫기"
            className="rounded-lg px-2 py-0.5 text-lg leading-none text-ink2 hover:bg-paper2">✕</button>
        </div>

        {/* 탭 3개 (매쓰플랫 동일) */}
        <div className="flex border-b border-line px-4 text-sm font-semibold">
          {TABS.map(([k, t]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`-mb-px border-b-2 px-4 py-3 ${tab === k ? 'border-pine text-pine' : 'border-transparent text-ink2 hover:text-ink'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="grow overflow-y-auto p-6 text-sm">
          {tab === 'weak' && (
            <div>
              {/* 필터 줄 (매쓰플랫: 학년·학기 셀렉트 + 전체/배운 유형 라디오 + 기간 안내 + 학습량 부족이란?) */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <select value={courseId} onChange={e => { setCourseId(e.target.value); setSelTypes(new Set()); setOpenUnits(new Set()) }}
                  className="rounded-lg border border-line px-3 py-2 font-semibold">
                  {CURRICULA.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input type="radio" name="pw-learned" checked={learnedOnly === 'all'} onChange={() => setLearnedOnly('all')} /> 전체 유형
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input type="radio" name="pw-learned" checked={learnedOnly === 'learned'} onChange={() => setLearnedOnly('learned')} /> 배운 유형만
                </label>
                <span className="text-xs text-ink2">최근 1년 간 학습한 문제에 대한 분석입니다.</span>
                <div className="grow" />
                <button onClick={() => alert('학습량 부족이란?\n\n해당 유형에서 푼 문제가 2문제 미만이면 성취도를 판단하기 어려워 "학습량 부족(그레이)"로 표시합니다. 2문제 이상 풀어보세요!')}
                  className="text-xs font-semibold text-pine hover:underline">학습량 부족이란?</button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                {/* 좌측: 대단원 아코디언 + 정답률 → 유형 선택 */}
                <aside className="h-fit max-h-[52vh] overflow-y-auto rounded-xl border border-line p-2">
                  {unitRows.length === 0 ? (
                    <p className="p-4 text-center text-xs text-ink2">
                      {learnedOnly === 'learned' ? '이 과정에 학습한 유형이 없습니다. "전체 유형"으로 전환해보세요.' : '이 과정에 유형이 없습니다.'}
                    </p>
                  ) : unitRows.map(({ unit, types, rate }) => {
                    const open = openUnits.has(unit.id)
                    return (
                      <div key={unit.id} className="mb-0.5">
                        <button onClick={() => setOpenUnits(prev => { const n = new Set(prev); if (n.has(unit.id)) n.delete(unit.id); else n.add(unit.id); return n })}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-paper2">
                          <span className="text-[10px] text-ink2">{open ? '▾' : '▸'}</span>
                          <span className="grow text-sm font-bold">{unit.name}</span>
                          {rate !== null && <span className={`text-xs font-black ${rate < 60 ? 'text-clay' : 'text-pine-dark'}`}>{rate}%</span>}
                        </button>
                        {open && (
                          <div className="ml-4 border-l border-line/70 pl-2">
                            {types.map(t => {
                              const s = statMap.get(t.id)
                              const g = achievementOf(s)
                              return (
                                <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-paper2">
                                  <input type="checkbox" checked={selTypes.has(t.id)} onChange={() => toggleType(t.id)} />
                                  <span title={`성취도 ${g.name}`} className={`inline-block h-2.5 w-2.5 shrink-0 rounded ${g.dot}`} />
                                  <span className="grow leading-snug">{t.name}</span>
                                  {s && <span className="shrink-0 text-ink2">{Math.round((1 - s.wrong / s.total) * 100)}%</span>}
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </aside>

                {/* 우측: 2탭 — 틀린 유형 학습지 / 틀린 문제 학습지 */}
                <div className="rounded-xl border border-line">
                  <div className="flex border-b border-line px-3 text-sm font-semibold">
                    {([['type', '틀린 유형 학습지'], ['problem', '틀린 문제 학습지']] as const).map(([k, t]) => (
                      <button key={k} onClick={() => setRightTab(k)}
                        className={`-mb-px border-b-2 px-3 py-2.5 ${rightTab === k ? 'border-pine text-pine' : 'border-transparent text-ink2 hover:text-ink'}`}>
                        {t}
                      </button>
                    ))}
                  </div>

                  <div className="p-4">
                    {selTypes.size === 0 && weakRank.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-line bg-paper2/50 p-8 text-center text-ink2">
                        왼쪽 목록에서 단원, 유형을 선택해주세요.<br />
                        [취약 유형 학습지] 또는 [틀린 문제 학습지]를 만들 수 있습니다.
                      </div>
                    ) : rightTab === 'type' ? (
                      <div className="grid gap-4">
                        <p className="text-xs text-ink2">유형별로 고르게 구성된 오답학습지를 만들고 싶을 때 사용하세요.</p>
                        {selTypes.size > 0 ? (
                          <div className="rounded-lg bg-pine-soft/50 px-3 py-2 text-xs">
                            왼쪽에서 선택한 유형 <b className="text-pine-dark">{selTypes.size}</b>개로 만듭니다.
                            <button onClick={() => setSelTypes(new Set())} className="ml-2 font-semibold text-ink2 hover:text-ink">선택 해제</button>
                          </div>
                        ) : (
                          <div className="grid gap-2">
                            <label className="flex flex-wrap items-center gap-1.5">
                              <input type="radio" name="pw-basis" checked={wayBasis === 'count'} onChange={() => setWayBasis('count')} />
                              유형 수 기준 — 상위 취약
                              <select value={topN} onChange={e => setTopN(Number(e.target.value))} className="rounded border border-line px-1.5 py-0.5 font-bold">
                                {[3, 5, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                              개 유형
                              <span className="relative">
                                <button onClick={() => setRankOpen(v => !v)} className="ml-1 text-xs font-semibold text-pine hover:underline">취약순위표 보기</button>
                                {rankOpen && (
                                  <>
                                    <div className="fixed inset-0 z-10" onClick={() => setRankOpen(false)} />
                                    <div className="absolute left-0 top-6 z-20 max-h-64 w-72 overflow-y-auto rounded-xl border border-line bg-white p-3 shadow-xl">
                                      <div className="mb-1.5 text-xs font-black">취약순위표 <span className="font-normal text-ink2">(정답률 낮은 순)</span></div>
                                      {weakRank.map((s, i) => (
                                        <div key={s.typeId} className="flex items-center gap-2 py-0.5 text-xs">
                                          <b className="w-5 shrink-0 text-clay">{i + 1}</b>
                                          <span className="grow leading-snug">{typeName(s.typeId)}</span>
                                          <span className="shrink-0 text-ink2">{Math.round((1 - s.wrong / s.total) * 100)}%</span>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </span>
                            </label>
                            <label className="flex flex-wrap items-center gap-1.5">
                              <input type="radio" name="pw-basis" checked={wayBasis === 'rate'} onChange={() => setWayBasis('rate')} />
                              정답률 기준 — 정답률
                              <select value={rateMax} onChange={e => setRateMax(Number(e.target.value))} className="rounded border border-line px-1.5 py-0.5 font-bold">
                                {[30, 40, 50, 60, 70].map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                              % 이하 유형 <b>{weakRank.filter(s => Math.round((1 - s.wrong / s.total) * 100) <= rateMax).length}</b>개
                            </label>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">난이도</span>
                          <select value={typeDiff} onChange={e => setTypeDiff(e.target.value as typeof typeDiff)}
                            className="rounded-lg border border-line px-2 py-1 font-bold">
                            <option value="twin">쌍둥이 문제</option>
                            <option value="easy">더 쉽게</option>
                            <option value="same">그대로</option>
                            <option value="hard">더 어렵게</option>
                          </select>
                        </div>
                        <p className="text-[11px] text-ink2">'쌍둥이 문제' 선택 시 유형 별 취약점을 쌍둥이・유사 문제로 구성합니다.</p>
                        <div className="flex flex-wrap gap-4">
                          <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                            <input type="checkbox" checked={typeAuto} onChange={e => setTypeAuto(e.target.checked)} /> 자동채점 ON
                          </label>
                          <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                            <input type="checkbox" checked={includeAssigned} onChange={e => setIncludeAssigned(e.target.checked)} /> 출제된 문제 포함
                          </label>
                        </div>
                        <div className="rounded-xl bg-paper2 px-4 py-3">
                          학습지 문제 수 <b className="text-pine-dark">{typeSheetIds.length}</b>개
                          <span className="ml-2 text-xs text-ink2">(대상 유형 {targetTypes.length}개)</span>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => createSheet(`[취약 유형] ${student.name}`, ['오답', '취약유형'], typeSheetIds, typeAuto, 'edit', targetTypes[0]?.typeId)}
                            className="rounded-lg border border-pine px-4 py-2 font-bold text-pine hover:bg-pine-soft">편집 후 만들기</button>
                          <button onClick={() => createSheet(`[취약 유형] ${student.name}`, ['오답', '취약유형'], typeSheetIds, typeAuto, 'view', targetTypes[0]?.typeId)}
                            className="rounded-lg bg-pine px-5 py-2 font-bold text-paper hover:brightness-110">바로 만들기</button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        <p className="text-xs text-ink2">틀린 문제의 쌍둥이 문제, 유사문제를 기반으로 오답 학습지를 만듭니다.</p>
                        <div className="grid gap-1.5">
                          {WAYS.map(([v, label]) => (
                            <label key={v} className="flex cursor-pointer items-center gap-1.5 font-semibold">
                              <input type="radio" name="pw-probway" checked={probWay === v} onChange={() => setProbWay(v)} /> {label}
                            </label>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">문제 수</span>
                          <input type="number" min={1} max={150} value={probCap}
                            onChange={e => setProbCap(Math.min(150, Math.max(1, Number(e.target.value) || 1)))}
                            className="w-20 rounded-lg border border-line px-2 py-1" />
                          <span className="text-xs text-ink2">(최대 150개)</span>
                        </div>
                        <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                          <input type="checkbox" checked={probAuto} onChange={e => setProbAuto(e.target.checked)} /> 자동채점 ON
                        </label>
                        <div className="rounded-xl bg-paper2 px-4 py-3">
                          학습지 문제 수 <b className="text-pine-dark">{probSheetIds.length}</b>개
                          <span className="ml-2 text-xs text-ink2">(최근 1년 틀린 문제 {yearWrongs.length}개{selTypes.size > 0 ? ` · 선택 유형 ${selTypes.size}개 기준` : ''})</span>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => createSheet(`[틀린 문제] ${student.name}`, ['오답', '단원별 취약'], probSheetIds, probAuto, 'edit', yearWrongs[0]?.typeId)}
                            className="rounded-lg border border-pine px-4 py-2 font-bold text-pine hover:bg-pine-soft">편집 후 만들기</button>
                          <button onClick={() => createSheet(`[틀린 문제] ${student.name}`, ['오답', '단원별 취약'], probSheetIds, probAuto, 'view', yearWrongs[0]?.typeId)}
                            className="rounded-lg bg-pine px-5 py-2 font-bold text-paper hover:brightness-110">바로 만들기</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'period' && (
            <div>
              <p className="mb-1 text-ink2">기간의 시작일을 기준으로 1년까지 조회할 수 있습니다</p>
              <div className="mb-2 flex items-center gap-2">
                <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                  className="rounded-lg border border-line px-3 py-2" />
                <span className="text-ink2">~</span>
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                  className="rounded-lg border border-line px-3 py-2" />
              </div>
              <p className="mb-4 text-xs text-ink2">{from.replaceAll('-', '.')} 부터 {to.replaceAll('-', '.')} 까지 채점한 문제로 학습지를 만듭니다.</p>

              {/* 소스별 집계 (매쓰플랫: 시그니처 교재/시중교재/내 교재/내 학습지) */}
              <div className="mb-4 rounded-xl bg-paper2 px-4 py-3">
                선택한 기간에 틀린 문제 수 <b className="text-pine-dark">{total}</b>개
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink2">
                  <span>시그니처 교재 <b>{srcCounts.signature}</b>개</span>
                  <span>시중교재 <b>{srcCounts.market}</b>개</span>
                  <span>내 교재 <b>{srcCounts.myBook}</b>개</span>
                  <span>내 학습지 <b>{srcCounts.mySheet}</b>개</span>
                </div>
              </div>
              {total === 0 && <p className="mb-4 text-ink2">기간 내 오답이 없습니다</p>}

              <div className="mb-4 grid gap-1.5">
                {WAYS.map(([v, label]) => (
                  <label key={v} className="flex cursor-pointer items-center gap-1.5 font-semibold">
                    <input type="radio" name="pw-periodway" checked={periodWay === v} onChange={() => setPeriodWay(v)} /> {label}
                  </label>
                ))}
              </div>
              <div className="mb-4 flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-2">
                  <span className="font-semibold">문제 수</span>
                  <input type="number" min={1} max={150} value={periodCap}
                    onChange={e => setPeriodCap(Math.min(150, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-20 rounded-lg border border-line px-2 py-1" />
                  <span className="text-xs text-ink2">(최대 150개)</span>
                </span>
                <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                  <input type="checkbox" checked={periodAuto} onChange={e => setPeriodAuto(e.target.checked)} /> 자동채점 ON
                </label>
              </div>
              <div className="mb-4 rounded-xl bg-paper2 px-4 py-3">
                학습지 문제 수 <b className="text-pine-dark">{periodIds.length}</b>개
              </div>
              <div className="flex justify-end gap-2">
                <button disabled={total === 0}
                  onClick={() => createSheet(`[오답] ${from}~${to}`, ['오답', '기간별 오답'], periodIds, periodAuto, 'edit', periodWrongs[0]?.typeId)}
                  className="rounded-lg border border-pine px-4 py-2 font-bold text-pine hover:bg-pine-soft disabled:opacity-40">편집 후 만들기</button>
                <button disabled={total === 0}
                  onClick={() => createSheet(`[오답] ${from}~${to}`, ['오답', '기간별 오답'], periodIds, periodAuto, 'view', periodWrongs[0]?.typeId)}
                  className="rounded-lg bg-pine px-5 py-2 font-bold text-paper hover:brightness-110 disabled:opacity-40">바로 만들기</button>
              </div>
            </div>
          )}

          {tab === 'sheet' && (
            <div>
              <p className="mb-4 text-ink2">{student.name} 학생에게 출제된 학습지만 노출이 됩니다.</p>
              {gradedSheets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line bg-paper2/50 p-8 text-center text-ink2">
                  아직 채점된 학습지가 없습니다.
                </div>
              ) : (
                <>
                  {/* 컬럼형 테이블 (매쓰플랫: 선택·명·개정·출제일·학습지명·문항수·점수) */}
                  <div className="overflow-x-auto rounded-xl border border-line">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs text-ink2">
                          <th className="w-10 px-3 py-2 text-center">선택</th>
                          <th className="py-2">명</th>
                          <th className="py-2">개정</th>
                          <th className="py-2">출제일</th>
                          <th className="py-2">학습지명</th>
                          <th className="py-2">문항수</th>
                          <th className="py-2 pr-3">점수</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gradedSheets.map(({ ws, wrongs, date, score, assignedAt }) => (
                          <tr key={ws.id} onClick={() => toggleSheet(ws.id)}
                            className="cursor-pointer border-b border-line/50 last:border-0 hover:bg-paper2/50">
                            <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                              <input type="checkbox" checked={checked.has(ws.id)} onChange={() => toggleSheet(ws.id)} />
                            </td>
                            <td className="py-2"><span className="rounded bg-amber-soft px-1.5 py-0.5 text-[11px] font-bold text-amber">학습지</span></td>
                            <td className="py-2 text-xs text-ink2">22개정</td>
                            <td className="whitespace-nowrap py-2 text-xs text-ink2">{assignedAt ? dateKey(assignedAt).slice(2).replace(/-/g, '.') : '—'}</td>
                            <td className="py-2 pr-2">
                              <b>{ws.title}</b>
                              <div className="text-[11px] text-ink2">{dateKey(date)} 채점 · 오답 <b className="text-clay">{wrongs.length}</b>문제</div>
                            </td>
                            <td className="py-2">{ws.problemIds.length}</td>
                            <td className="py-2 pr-3 font-bold text-pine-dark">{score}점</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-5 flex items-center justify-end gap-3">
                    <span className="text-ink2">선택 {checked.size}개 · 오답 합계 <b className="text-pine-dark">{selectedWrongs.length}</b>문제</span>
                    <button disabled={selectedWrongs.length === 0}
                      onClick={() => setDrill({
                        title: `[오답] 학습지 ${checked.size}개 합본`,
                        wrongs: selectedWrongs,
                        tags: ['오답', '학습지 오답'],
                      })}
                      className="rounded-lg bg-pine px-5 py-2 font-bold text-paper hover:brightness-110 disabled:opacity-40">
                      오답 학습지 만들기
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
