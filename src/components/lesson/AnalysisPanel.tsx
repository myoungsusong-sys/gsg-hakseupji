import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CURRICULA, curriculumFor, typeName } from '../../data/curriculum'
import type { TypeNode } from '../../data/curriculum'
import { useStore } from '../../lib/store'
import { resultTypeId, wrongByType } from '../../lib/drill'
import { ACHIEVEMENT_GRADES, achievementOf, isWeakGrade } from '../../lib/achievement'
import { dateKey, todayKey } from '../../lib/dates'
import type { Problem, Student } from '../../types'
import ProblemContent from '../ProblemContent'
import VideoModal from '../VideoModal'

// 매쓰플랫 「수업 > 유형분석」 — 유형×난이도밴드 문항 타일 매트릭스 + 성취도 7컬러 + 유형별 상세 보기
const BANDS = ['개념', '기본', '심화'] as const
type Band = typeof BANDS[number]

interface Rec {
  date: string
  source: '교재' | '학습지'
  sourceName: string
  correct: boolean
  unknown?: boolean
  label?: string    // 교재 문항 번호 (예: "3")
  page?: number     // 교재 쪽
}

type TypeBands = Record<Band, Rec[]>

function emptyBands(): TypeBands {
  return { 개념: [], 기본: [], 심화: [] }
}

function bandOf(diff: number): Band {
  if (diff <= 2) return '개념'
  if (diff === 3) return '기본'
  return '심화'
}

function defaultCourseId(grade: string): string {
  return CURRICULA.find(c => c.grade === grade)?.id ?? 'm1-1'
}

// YYYY-MM-DD → YYYY년MM월DD일
function koDate(d: string): string {
  const [y, m, day] = dateKey(d).split('-')
  return `${y}년${m}월${day}일`
}

// ── 과거 학습 이력: 그 달의 주차 목록 (ISO — 첫 목요일이 포함된 주가 1주차) ──
interface WeekRow { n: number; from: string; to: string }
function weeksOfMonth(y: number, m: number): WeekRow[] {  // m: 1~12
  const out: WeekRow[] = []
  // 그 달 1일이 속한 주의 월요일부터 훑는다
  const first = new Date(y, m - 1, 1)
  const mon = new Date(first)
  mon.setDate(first.getDate() - (first.getDay() + 6) % 7)
  let n = 0
  for (let i = 0; i < 6; i++) {
    const start = new Date(mon); start.setDate(mon.getDate() + i * 7)
    const thu = new Date(start); thu.setDate(start.getDate() + 3)
    if (thu.getMonth() + 1 !== m || thu.getFullYear() !== y) continue   // 목요일 기준 소속 월
    n++
    const end = new Date(start); end.setDate(start.getDate() + 6)
    out.push({ n, from: dateKey(start), to: dateKey(end) })
  }
  return out
}

export default function AnalysisPanel({ student }: { student: Student }) {
  const { gradings, wbItems, workbooks, worksheets, problems, savedReports, addSavedReport, removeSavedReport } = useStore()
  const nav = useNavigate()

  const [courseId, setCourseId] = useState(() => defaultCourseId(student.grade))
  const { ensureCourse } = useStore()
  useEffect(() => { ensureCourse(courseId) }, [courseId, ensureCourse])
  const [recOnly, setRecOnly] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [detailId, setDetailId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [legendInfo, setLegendInfo] = useState(false)                 // 성취도 컬러 ⓘ 설명 모달
  const [bookFilterOpen, setBookFilterOpen] = useState(false)         // 교재 필터 드롭다운
  const [bookFilter, setBookFilter] = useState<Set<string>>(new Set())// 적용된 교재 id (빈 = 전체)
  const [bookDraft, setBookDraft] = useState<Set<string>>(new Set())
  const [histOpen, setHistOpen] = useState(false)                     // 과거 학습 이력 팝오버
  const [histMonth, setHistMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() + 1 } })
  const [asOf, setAsOf] = useState<{ to: string; label: string } | null>(null)  // 선택한 주차까지의 스냅샷
  const [reportOpen, setReportOpen] = useState(false)                 // 보고서 내역 드로어
  const [repProblem, setRepProblem] = useState<Problem | null>(null)  // 유형 대표문제 모달
  const [video, setVideo] = useState<{ src: string; subtitle?: string; title: string } | null>(null)

  // 학생이 바뀌면 과정·선택·상세를 초기화
  useEffect(() => {
    setCourseId(defaultCourseId(student.grade))
    setChecked(new Set())
    setDetailId(null)
    setBookFilter(new Set())
    setAsOf(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id])
  // 과정이 바뀌면 선택·상세·접기만 초기화 (학습지 만들기 URL이 과정과 엮이므로)
  useEffect(() => { setChecked(new Set()); setDetailId(null); setCollapsed(new Set()) }, [courseId])

  const course = curriculumFor(courseId)
  const myBooks = useMemo(() => workbooks.filter(w => w.studentId === student.id), [workbooks, student.id])

  // 분석 대상 채점 기록: 학생 + (과거 학습 이력 스냅샷) + (교재 필터)
  const myGradings = useMemo(() => gradings.filter(g => {
    if (g.studentId !== student.id) return false
    if (asOf && dateKey(g.date) > asOf.to) return false
    if (bookFilter.size > 0 && !(g.workbookId && bookFilter.has(g.workbookId))) return false
    return true
  }), [gradings, student.id, asOf, bookFilter])

  const stats = useMemo(() => wrongByType(student.id, myGradings, wbItems), [student.id, myGradings, wbItems])
  const statMap = useMemo(() => new Map(stats.map(s => [s.typeId, s])), [stats])
  // 취약 유형: 7컬러 체계 기준(새드·레드) 통일
  const weak = useMemo(() => stats.filter(s => isWeakGrade(s)), [stats])
  // ★ 추천 유형 = 오답 보유 유형 (원본 ★ 칩)
  const recSet = useMemo(() => new Set(stats.filter(s => s.wrong > 0).map(s => s.typeId)), [stats])

  // 유형×밴드 문항 타일 + 유형별 최근 채점 내역
  // 교재 채점: itemId→WBItem(typeId·diff·번호·쪽), 학습지 채점: typeId 직접(diff는 3으로 간주)
  const { bands, recs } = useMemo(() => {
    const itemMap = new Map(wbItems.map(i => [i.id, i]))
    const wbNames = new Map(workbooks.map(w => [w.id, w.name]))
    const wsNames = new Map(worksheets.map(w => [w.id, w.title]))
    const bands = new Map<string, TypeBands>()
    const recs = new Map<string, Rec[]>()
    for (const g of myGradings) {
      const source: Rec['source'] = g.source ?? '교재'
      const sourceName =
        (g.worksheetId ? wsNames.get(g.worksheetId) : undefined) ??
        (g.workbookId ? wbNames.get(g.workbookId) : undefined) ?? source
      for (const r of g.results) {
        const typeId = resultTypeId(r, itemMap)
        if (!typeId) continue
        const item = r.itemId ? itemMap.get(r.itemId) : undefined
        const diff = item?.diff ?? 3
        const rec: Rec = {
          date: g.date, source, sourceName, correct: r.correct, unknown: r.unknown,
          label: item ? (item.label ?? String(item.no)) : undefined, page: item?.page,
        }
        const tb = bands.get(typeId) ?? emptyBands()
        tb[bandOf(diff)].push(rec)
        bands.set(typeId, tb)
        const list = recs.get(typeId) ?? []
        list.push(rec)
        recs.set(typeId, list)
      }
    }
    for (const list of recs.values()) list.sort((a, b) => b.date.localeCompare(a.date))
    return { bands, recs }
  }, [myGradings, wbItems, workbooks, worksheets])

  // 매트릭스 섹션: 중단원 단위 그룹 행 ("대단원 | 중단원")
  const sections = useMemo(() => {
    const out: { key: string; title: string; rows: TypeNode[] }[] = []
    for (const u of course.units)
      for (const m of u.mids) {
        const all = m.subs.flatMap(s => s.types)
        if (!showAll && !all.some(t => statMap.has(t.id))) continue
        const rows = recOnly ? all.filter(t => recSet.has(t.id)) : all
        if (rows.length === 0) continue
        out.push({ key: m.id, title: `${u.name} | ${m.name}`, rows })
      }
    return out
  }, [course, statMap, recOnly, showAll, recSet])

  // 범례별 유형 개수 — 7컬러 (추천 유형만 보기 시 추천 유형 기준으로 재계산, 매쓰플랫 동일)
  const legendCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const u of course.units)
      for (const mid of u.mids)
        for (const s of mid.subs)
          for (const t of s.types) {
            if (recOnly && !recSet.has(t.id)) continue
            const g = achievementOf(statMap.get(t.id))
            m.set(g.key, (m.get(g.key) ?? 0) + 1)
          }
    return m
  }, [course, statMap, recOnly, recSet])

  // 상세 패널 ◀▶ 이동: 선택 과정에서 데이터 있는 유형 순서
  const dataOrder = useMemo(() => {
    const out: string[] = []
    for (const u of course.units)
      for (const m of u.mids)
        for (const s of m.subs)
          for (const t of s.types)
            if (statMap.has(t.id)) out.push(t.id)
    return out
  }, [course, statMap])

  const myReports = useMemo(
    () => savedReports.filter(r => r.kind === 'analysis' && r.studentId === student.id),
    [savedReports, student.id],
  )

  const filterActive = bookFilter.size > 0 || !!asOf

  if (stats.length === 0 && !filterActive) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
        교재/학습지 채점이 쌓이면 유형별 성취도가 표시됩니다.
      </div>
    )
  }

  const detailIdx = detailId ? dataOrder.indexOf(detailId) : -1
  const prevId = detailIdx > 0 ? dataOrder[detailIdx - 1] : undefined
  const nextId = detailId
    ? (detailIdx === -1 ? dataOrder[0] : dataOrder[detailIdx + 1])
    : undefined
  const detailStat = detailId ? statMap.get(detailId) : undefined
  const detailGrade = achievementOf(detailStat)
  // 유형 대표문제 — 그 유형 문제 풀에서 풀이영상 있는 문항 우선
  const detailRep = detailId
    ? (problems.find(p => p.typeId === detailId && p.videoUrl) ?? problems.find(p => p.typeId === detailId) ?? null)
    : null

  function toggleCheck(id: string) {
    setChecked(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }
  // 그룹 헤더 체크박스 — 그 중단원의 표시 유형 전체 선택/해제
  function toggleSection(rows: TypeNode[]) {
    setChecked(prev => {
      const n = new Set(prev)
      const allOn = rows.every(t => n.has(t.id))
      for (const t of rows) { if (allOn) n.delete(t.id); else n.add(t.id) }
      return n
    })
  }

  function toggleCollapse(key: string) {
    setCollapsed(prev => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key); else n.add(key)
      return n
    })
  }

  function resetAll() {
    setCourseId(defaultCourseId(student.grade))
    setRecOnly(false)
    setShowAll(false)
    setChecked(new Set())
    setDetailId(null)
    setCollapsed(new Set())
    setBookFilter(new Set())
    setAsOf(null)
  }

  // [+ 유형분석 보고서 만들기] — 보고서 내역에 저장 후 브라우저 인쇄
  function makeReport() {
    addSavedReport({
      kind: 'analysis', studentId: student.id,
      name: `${student.name} 유형분석 보고서 — ${course.label}`,
      period: course.label,
    })
    setReportOpen(false)
    setTimeout(() => window.print(), 50)
  }

  const weeks = weeksOfMonth(histMonth.y, histMonth.m)
  const today = todayKey()

  return (
    <div className="print-root">
      {/* 인쇄 시에만 보이는 보고서 머리글 */}
      <div className="mb-3 hidden print:block">
        <span className="text-lg font-black text-pine-dark">{student.name}</span>
        <span className="ml-2 text-sm">유형분석 보고서 · {course.label}</span>
      </div>

      {/* 필터 줄: 과정 | 교재 필터 | 추천 유형만 보기(토글) | 전체 유형 보기 | 초기화 */}
      <div className="no-print mb-3 flex flex-wrap items-center gap-3 text-sm">
        <select value={courseId} onChange={e => setCourseId(e.target.value)}
          className="rounded-lg border border-line px-3 py-2 font-semibold">
          {CURRICULA.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>

        {/* 교재 필터 드롭다운 (매쓰플랫: 선택한 교재에 기반한 유형분석표) */}
        <div className="relative">
          <button onClick={() => { setBookDraft(new Set(bookFilter)); setBookFilterOpen(v => !v) }}
            className={`rounded-lg border px-3 py-2 font-semibold ${bookFilter.size > 0 ? 'border-pine bg-pine-soft/60 text-pine-dark' : 'border-line text-ink2 hover:text-ink'}`}>
            교재 필터{bookFilter.size > 0 ? ` (${bookFilter.size})` : ''} ▾
          </button>
          {bookFilterOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setBookFilterOpen(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-80 rounded-xl border border-line bg-white p-4 shadow-xl">
                <div className="mb-1 text-sm font-black">교재 필터</div>
                <p className="mb-3 text-xs text-ink2">선택한 교재에 기반한 유형분석표를 제공합니다.</p>
                {myBooks.length === 0 ? (
                  <p className="py-4 text-center text-xs text-ink2">이 학생에게 배정된 교재가 없습니다.</p>
                ) : (
                  <div className="mb-3 grid max-h-56 gap-1 overflow-y-auto">
                    {myBooks.map(b => (
                      <label key={b.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-paper2">
                        <input type="checkbox" checked={bookDraft.has(b.id)}
                          onChange={() => setBookDraft(prev => { const n = new Set(prev); if (n.has(b.id)) n.delete(b.id); else n.add(b.id); return n })} />
                        <span className="truncate text-sm">{b.name}</span>
                        {b.matchKey && <span className="shrink-0 rounded bg-pine-soft px-1 py-0.5 text-[10px] font-bold text-pine-dark">쌍둥이 지원</span>}
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setBookDraft(new Set())}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink2 hover:bg-paper2">전체 초기화</button>
                  <button onClick={() => { setBookFilter(new Set(bookDraft)); setBookFilterOpen(false) }}
                    className="rounded-lg bg-pine px-4 py-1.5 text-xs font-bold text-paper hover:brightness-105">적용하기</button>
                </div>
              </div>
            </>
          )}
        </div>

        <button onClick={() => setRecOnly(v => !v)} className="flex cursor-pointer items-center gap-1.5">
          <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${recOnly ? 'bg-pine' : 'bg-stone-300'}`}>
            <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${recOnly ? 'translate-x-4' : ''}`} />
          </span>
          추천 유형만 보기
        </button>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          전체 유형 보기
        </label>
        <div className="grow" />
        <button onClick={resetAll}
          className="rounded-lg border border-line px-3 py-2 font-semibold text-ink2 hover:bg-paper2">
          🔄 초기화
        </button>
      </div>

      {/* 둘째 줄: 좌측 요약 | 우측 과거 학습 이력·보고서 버튼들 */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span>
          누적 채점 <b className="text-ink">{myGradings.length}</b>회 ·
          푼 유형 <b className="text-ink"> {stats.length}</b>개 ·
          취약 유형 <b className="text-clay"> {weak.length}</b>개
        </span>
        {asOf && (
          <button onClick={() => setAsOf(null)}
            className="no-print rounded-full bg-amber-soft px-2.5 py-1 text-xs font-bold text-amber hover:brightness-95">
            📆 {asOf.label} 기준 ✕
          </button>
        )}
        <div className="grow" />

        {/* 과거 학습 이력 팝오버 */}
        <div className="relative">
          <button onClick={() => setHistOpen(v => !v)}
            className="no-print rounded-lg border border-line px-3 py-2 font-semibold text-ink2 hover:bg-paper2">
            📆 과거 학습 이력
          </button>
          {histOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setHistOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded-xl border border-line bg-white p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between text-sm font-bold">
                  <button onClick={() => setHistMonth(({ y, m }) => m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 })}
                    className="rounded px-2 py-1 hover:bg-paper2">← {histMonth.m === 1 ? 12 : histMonth.m - 1}월</button>
                  <span>{histMonth.y}년 {histMonth.m}월</span>
                  <button onClick={() => setHistMonth(({ y, m }) => m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 })}
                    className="rounded px-2 py-1 hover:bg-paper2">{histMonth.m === 12 ? 1 : histMonth.m + 1}월 →</button>
                </div>
                <div className="mb-3 grid gap-1">
                  {weeks.map(w => {
                    const disabled = w.from > today
                    const to = w.to > today ? today : w.to
                    const label = `${histMonth.m}월 ${w.n}주차`
                    return (
                      <button key={w.n} disabled={disabled}
                        onClick={() => { setAsOf({ to, label }); setHistOpen(false) }}
                        className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold ${asOf?.to === to ? 'border-pine bg-pine-soft/60 text-pine-dark' : 'border-line hover:border-pine'} disabled:cursor-not-allowed disabled:opacity-40`}>
                        {w.n}주차 <span className="font-normal text-ink2">({Number(w.from.slice(5, 7))}/{Number(w.from.slice(8))} ~ {Number(w.to.slice(5, 7))}/{Number(w.to.slice(8))})</span>
                      </button>
                    )
                  })}
                </div>
                <p className="mb-1 text-[11px] text-ink2">매월 첫 목요일이 포함된 주가 해당 월의 1주차입니다. (국제 표준)</p>
                <p className="text-[11px] text-ink2">선택한 주차까지 기록된 유형분석 내역을 불러옵니다.</p>
              </div>
            </>
          )}
        </div>

        <button onClick={() => setReportOpen(true)}
          className="no-print rounded-lg border border-line px-3 py-2 font-semibold text-ink2 hover:bg-paper2">
          🗒 보고서 내역
        </button>
        <button onClick={makeReport}
          className="no-print rounded-lg bg-blue-500 px-4 py-2 font-bold text-white hover:brightness-105">
          ＋ 유형분석 보고서 만들기
        </button>
      </div>

      {/* 성취도 컬러 범례 (7단계, 인쇄에 포함) */}
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink2">
        <button onClick={() => setLegendInfo(true)} className="font-bold text-ink hover:text-pine-dark">
          성취도 컬러 <span className="no-print rounded-full border border-line px-1">ⓘ</span>
        </button>
        {ACHIEVEMENT_GRADES.map(g => (
          <span key={g.key} className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded ${g.dot}`} />
            {g.name} <b>{legendCounts.get(g.key) ?? 0}</b>
          </span>
        ))}
        <span className="mx-1 hidden h-3 w-px bg-line sm:inline-block" />
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-pine" /> 정답</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-red-400" /> 오답</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-amber" /> 모름</span>
      </div>

      {/* 성취도 매트릭스 */}
      {sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-10 text-center text-sm text-ink2">
          {recOnly
            ? '이 과정에 추천 유형이 없습니다.'
            : <>이 과정에 채점 데이터가 없습니다. 다른 과정을 선택하거나 <b>전체 유형 보기</b>를 켜세요.</>}
        </div>
      ) : (
        sections.map(sec => (
          <div key={sec.key} className="mb-4 rounded-2xl border border-line bg-white p-4">
            <div className="mb-2 flex w-full items-center gap-2 text-sm font-black">
              <input type="checkbox" className="no-print cursor-pointer"
                checked={sec.rows.length > 0 && sec.rows.every(t => checked.has(t.id))}
                onChange={() => toggleSection(sec.rows)} />
              <button onClick={() => toggleCollapse(sec.key)}
                className="flex grow items-center justify-between text-left hover:text-pine-dark">
                <span>{sec.title}</span>
                <span className="text-xs text-ink2">{collapsed.has(sec.key) ? '▸' : '▾'}</span>
              </button>
            </div>
            {!collapsed.has(sec.key) && (
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-8" /><col /><col className="w-24" /><col className="w-24" /><col className="w-24" />
                </colgroup>
                <thead>
                  <tr className="border-b border-line text-xs text-ink2">
                    <th />
                    <th className="pb-1 text-left font-semibold">단원</th>
                    {BANDS.map(b => <th key={b} className="pb-1 text-center font-semibold">{b}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sec.rows.map(t => {
                    const tb = bands.get(t.id)
                    const grade = achievementOf(statMap.get(t.id))
                    return (
                      <tr key={t.id} onClick={() => setDetailId(t.id)}
                        className={`cursor-pointer border-b border-line/50 last:border-0 hover:bg-paper2 ${detailId === t.id ? 'bg-pine-soft/40' : ''}`}>
                        <td onClick={e => e.stopPropagation()} className="text-center">
                          <input type="checkbox" checked={checked.has(t.id)} onChange={() => toggleCheck(t.id)}
                            className="no-print cursor-pointer" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <span title={`성취도 ${grade.name}`}
                            className={`mr-1.5 inline-block h-3 w-3 rounded align-[-1px] ${grade.dot}`} />
                          {t.name}
                          {recSet.has(t.id) && (
                            <span title="추천 유형" className="ml-1 rounded bg-amber-soft px-1 py-0.5 text-[10px] font-bold text-amber">★ 추천</span>
                          )}
                        </td>
                        {BANDS.map(b => <BandCell key={b} tiles={tb?.[b]} />)}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        ))
      )}

      {/* 성취도 컬러 ⓘ 설명 모달 (매쓰플랫 원문) */}
      {legendInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setLegendInfo(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 className="text-base font-black">학생 학습 결과에 따라 성취도를 컬러로 보여줘요</h2>
              <button onClick={() => setLegendInfo(false)} className="text-lg text-ink2 hover:text-ink">✕</button>
            </div>
            <p className="mb-4 text-xs text-ink2">
              학생이 학습한 학습지, 교과서, 시중교재, 자기주도학습을 통한 모든 채점 데이터를 다음과 같은 컬러로 표시해요.
            </p>
            <div className="grid gap-2">
              {ACHIEVEMENT_GRADES.map(g => (
                <div key={g.key} className="flex items-center gap-3 rounded-xl border border-line/70 px-3 py-2 text-sm">
                  <span className={`flex h-8 w-14 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${g.cls}`}>{g.name}</span>
                  <span>{g.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 보고서 내역 드로어 (우측 슬라이드) */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setReportOpen(false)}>
          <div className="absolute right-0 top-0 flex h-full w-96 flex-col border-l border-line bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center">
              <h3 className="font-black">{student.name} 유형분석 보고서 내역</h3>
              <div className="grow" />
              <button onClick={() => setReportOpen(false)} className="text-ink2 hover:text-ink">✕</button>
            </div>
            {myReports.length === 0 ? (
              <div className="grow pt-16 text-center text-sm text-ink2">
                <div className="mb-2 text-3xl">📄</div>
                아직 만들어진 보고서가 없습니다.<br />아래 버튼을 눌러 새로운 보고서를 만들어보세요.
              </div>
            ) : (
              <div className="grow overflow-y-auto">
                <div className="grid gap-2">
                  {myReports.map(r => (
                    <div key={r.id} className="rounded-xl border border-line/70 px-3 py-2.5 text-sm">
                      <div className="font-bold leading-snug">{r.name}</div>
                      <div className="mt-0.5 flex items-center text-xs text-ink2">
                        {dateKey(r.createdAt)} 생성
                        <div className="grow" />
                        <button onClick={() => window.print()} className="mr-2 font-semibold text-pine hover:underline">인쇄</button>
                        <button onClick={() => { if (confirm('이 보고서 기록을 삭제할까요?')) removeSavedReport(r.id) }}
                          className="font-semibold text-clay hover:underline">삭제</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={makeReport}
              className="mt-4 w-full rounded-lg bg-blue-500 py-2.5 text-sm font-bold text-white hover:brightness-105">
              ＋ 유형분석 보고서 만들기
            </button>
          </div>
        </div>
      )}

      {/* 유형별 상세 보기 (우측 고정) */}
      {detailId && (
        <aside className={`no-print fixed right-4 top-24 z-40 w-80 overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-xl ${checked.size > 0 ? 'bottom-20' : 'bottom-4'}`}>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex gap-1">
              <button disabled={!prevId} onClick={() => prevId && setDetailId(prevId)}
                className="rounded border border-line px-2 py-1 text-xs hover:bg-paper2 disabled:opacity-30">◀</button>
              <button disabled={!nextId} onClick={() => nextId && setDetailId(nextId)}
                className="rounded border border-line px-2 py-1 text-xs hover:bg-paper2 disabled:opacity-30">▶</button>
            </div>
            <span className="text-xs font-bold text-ink2">유형별 상세 보기</span>
            <button onClick={() => setDetailId(null)} className="px-1 text-ink2 hover:text-ink">✕</button>
          </div>
          <h3 className="mb-2 text-sm font-black leading-snug">{typeName(detailId)}</h3>

          {detailStat ? (
            <p className="mb-3 text-sm">
              학습 성취도 <b className={`rounded px-1.5 py-0.5 ${detailGrade.cls}`}>{detailGrade.name}</b>입니다.
            </p>
          ) : (
            <p className="mb-3 text-sm text-ink2">아직 학습 기록이 없습니다.</p>
          )}

          <div className="mb-3 flex divide-x divide-line rounded-lg border border-line text-center text-xs text-ink2">
            <div className="flex-1 py-2">
              최근 푼 문제
              <div className="text-sm font-black text-ink">{detailStat?.total ?? 0}문제</div>
            </div>
            <div className="flex-1 py-2">
              틀린 문제
              <div className="text-sm font-black text-red-500">{detailStat?.wrong ?? 0}문제</div>
            </div>
            <div className="flex-1 py-2">
              맞은 문제
              <div className="text-sm font-black text-blue-500">{(detailStat?.total ?? 0) - (detailStat?.wrong ?? 0)}문제</div>
            </div>
          </div>

          {detailRep && (
            <button onClick={() => setRepProblem(detailRep)}
              className="mb-3 w-full rounded-lg border border-blue-400 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50">
              유형 대표문제&문제풀이 동영상 보기
            </button>
          )}

          <div className="mb-2 rounded bg-paper2 px-2.5 py-1.5 text-[11px] text-ink2">
            아래는 학생이 푼 문제에 대한 상세 내용 입니다.
          </div>
          {(recs.get(detailId) ?? []).length === 0 ? (
            <p className="mb-4 text-xs text-ink2">이 유형의 채점 기록이 없습니다.</p>
          ) : (
            <div className="mb-4">
              {(recs.get(detailId) ?? []).slice(0, 12).map((r, i) => (
                <div key={i} className="mb-2 rounded-lg border border-line p-2.5 text-xs">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 font-bold ${r.source === '학습지' ? 'bg-pine-soft text-pine-dark' : 'bg-amber-soft text-amber'}`}>
                      {r.source}
                    </span>
                    <span className="text-ink2">{koDate(r.date)} 학습완료</span>
                  </div>
                  <div className="mb-1 font-semibold">{r.sourceName}</div>
                  <div className="text-ink2">
                    결과 <b className={`text-sm ${r.correct ? 'text-blue-500' : 'text-red-500'}`}>
                      {r.correct ? '○' : r.unknown ? '모름' : '✕'}
                    </b>
                    {r.label && <span className="ml-2">문제 {r.label}번{r.page != null && <> · {r.page}p페이지</>}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => setDetailId(null)}
            className="w-full rounded-lg border border-line py-2 text-sm font-semibold hover:bg-paper2">
            닫기
          </button>
        </aside>
      )}

      {/* 유형 대표문제 모달 */}
      {repProblem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRepProblem(null)}>
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-base font-black">유형 대표문제 <span className="text-xs font-semibold text-ink2">— {typeName(repProblem.typeId)}</span></h2>
              <button onClick={() => setRepProblem(null)} className="text-lg text-ink2 hover:text-ink">✕</button>
            </div>
            <div className="mb-4 rounded-xl bg-paper2/50 p-3"><ProblemContent p={repProblem} /></div>
            {repProblem.videoUrl ? (
              <button onClick={() => setVideo({ src: repProblem.videoUrl!, subtitle: repProblem.subtitleUrl, title: '대표문제 풀이영상' })}
                className="w-full rounded-lg bg-pine py-2.5 text-sm font-bold text-paper hover:brightness-110">
                ▶ 문제풀이 동영상 보기
              </button>
            ) : (
              <p className="text-center text-xs text-ink2">이 문항은 풀이영상이 없습니다.</p>
            )}
          </div>
        </div>
      )}
      {video && <VideoModal src={video.src} subtitle={video.subtitle} title={video.title} onClose={() => setVideo(null)} />}

      {/* 하단 고정 바: 선택한 유형 → 학습지 만들기 */}
      {checked.size > 0 && (
        <div className="no-print fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-4 border-t border-line bg-white px-6 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <span className="text-sm">선택한 유형 <b className="text-blue-500">{checked.size}</b> 개</span>
          <button onClick={() => nav(`/make?types=${[...checked].join(',')}&course=${courseId}`)}
            className="rounded-lg bg-blue-500 px-5 py-2 text-sm font-bold text-white hover:brightness-105">
            학습지 만들기
          </button>
        </div>
      )}
    </div>
  )
}

// 매트릭스 셀: 문항별 성취도 타일 (정답=초록·오답=빨강·모름=노랑, 최대 12개 +n). 안 푼 밴드는 회색 '-'
function BandCell({ tiles }: { tiles?: Rec[] }) {
  if (!tiles || tiles.length === 0) {
    return (
      <td className="p-1 text-center">
        <div className="rounded bg-stone-100 py-1.5 text-xs font-semibold text-stone-400">-</div>
      </td>
    )
  }
  return (
    <td className="p-1">
      <div className="flex flex-wrap items-center justify-center gap-0.5 py-1">
        {tiles.slice(0, 12).map((t, i) => (
          <span key={i} title={t.correct ? '정답' : t.unknown ? '모름' : '오답'}
            className={`inline-block h-3 w-3 rounded-sm ${t.correct ? 'bg-pine' : t.unknown ? 'bg-amber' : 'bg-red-400'}`} />
        ))}
        {tiles.length > 12 && <span className="text-[10px] font-bold text-ink2">+{tiles.length - 12}</span>}
      </div>
    </td>
  )
}
