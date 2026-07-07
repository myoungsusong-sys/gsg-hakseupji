import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CURRICULA, curriculumFor, typeName } from '../../data/curriculum'
import type { TypeNode } from '../../data/curriculum'
import { useStore } from '../../lib/store'
import { achievementColor, resultTypeId, weakTypes, wrongByType } from '../../lib/drill'
import { dateKey } from '../../lib/dates'
import type { Student } from '../../types'

// 매쓰플랫 「수업 > 유형분석」 — 유형×난이도밴드 성취도 매트릭스 + 유형별 상세 보기
const BANDS = ['개념', '기본', '심화'] as const
type Band = typeof BANDS[number]

interface BandAgg { total: number; wrong: number }
type TypeBands = Record<Band, BandAgg>

interface Rec {
  date: string
  source: '교재' | '학습지'
  correct: boolean
  unknown?: boolean
}

// achievementColor의 5색과 반드시 동일한 클래스 문자열 (개수 집계 키로 사용)
const LEGEND = [
  { c: 'bg-stone-100 text-stone-400', t: '미학습' },
  { c: 'bg-red-100 text-red-800', t: '취약' },
  { c: 'bg-amber-soft text-amber', t: '보통' },
  { c: 'bg-pine-soft text-pine-dark', t: '양호' },
  { c: 'bg-pine text-white', t: '우수' },
]

function emptyBands(): TypeBands {
  return { 개념: { total: 0, wrong: 0 }, 기본: { total: 0, wrong: 0 }, 심화: { total: 0, wrong: 0 } }
}

function bandOf(diff: number): Band {
  if (diff <= 2) return '개념'
  if (diff === 3) return '기본'
  return '심화'
}

function defaultCourseId(grade: string): string {
  return CURRICULA.find(c => c.grade === grade)?.id ?? 'm1-1'
}

export default function AnalysisPanel({ student }: { student: Student }) {
  const { gradings, wbItems } = useStore()
  const nav = useNavigate()

  const [courseId, setCourseId] = useState(() => defaultCourseId(student.grade))
  const [weakOnly, setWeakOnly] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [detailId, setDetailId] = useState<string | null>(null)

  // 학생이 바뀌면 과정·선택·상세를 초기화
  useEffect(() => {
    setCourseId(defaultCourseId(student.grade))
    setChecked(new Set())
    setDetailId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id])
  // 과정이 바뀌면 선택·상세만 초기화 (학습지 만들기 URL이 과정과 엮이므로)
  useEffect(() => { setChecked(new Set()); setDetailId(null) }, [courseId])

  const course = curriculumFor(courseId)
  const myGradings = useMemo(() => gradings.filter(g => g.studentId === student.id), [gradings, student.id])
  const stats = useMemo(() => wrongByType(student.id, gradings, wbItems), [student.id, gradings, wbItems])
  const statMap = useMemo(() => new Map(stats.map(s => [s.typeId, s])), [stats])
  const weak = useMemo(() => weakTypes(stats), [stats])

  // 유형×밴드 집계 + 유형별 최근 채점 내역
  // 교재 채점: itemId→WBItem(typeId·diff), 학습지 채점: typeId 직접(diff는 3으로 간주)
  const { bands, recs } = useMemo(() => {
    const itemMap = new Map(wbItems.map(i => [i.id, i]))
    const bands = new Map<string, TypeBands>()
    const recs = new Map<string, Rec[]>()
    for (const g of myGradings) {
      const source: Rec['source'] = g.source ?? '교재'
      for (const r of g.results) {
        const typeId = resultTypeId(r, itemMap)
        if (!typeId) continue
        const diff = r.itemId ? itemMap.get(r.itemId)?.diff ?? 3 : 3
        const tb = bands.get(typeId) ?? emptyBands()
        const agg = tb[bandOf(diff)]
        agg.total++
        if (!r.correct) agg.wrong++
        bands.set(typeId, tb)
        const list = recs.get(typeId) ?? []
        list.push({ date: g.date, source, correct: r.correct, unknown: r.unknown })
        recs.set(typeId, list)
      }
    }
    for (const list of recs.values()) list.sort((a, b) => b.date.localeCompare(a.date))
    return { bands, recs }
  }, [myGradings, wbItems])

  // 매트릭스 섹션: 소단원 단위 (대단원 > 소단원)
  const sections = useMemo(() => {
    const out: { key: string; title: string; rows: TypeNode[] }[] = []
    for (const u of course.units)
      for (const m of u.mids)
        for (const s of m.subs) {
          if (!showAll && !s.types.some(t => statMap.has(t.id))) continue
          const rows = weakOnly ? s.types.filter(t => (statMap.get(t.id)?.wrong ?? 0) > 0) : s.types
          if (rows.length === 0) continue
          out.push({ key: s.id, title: `${u.name} > ${s.name}`, rows })
        }
    return out
  }, [course, statMap, weakOnly, showAll])

  // 범례별 유형 개수 (선택 과정 전체 기준)
  const legendCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const u of course.units)
      for (const mid of u.mids)
        for (const s of mid.subs)
          for (const t of s.types) {
            const cls = achievementColor(statMap.get(t.id))
            m.set(cls, (m.get(cls) ?? 0) + 1)
          }
    return m
  }, [course, statMap])

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

  if (stats.length === 0) {
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

  function toggleCheck(id: string) {
    setChecked(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  return (
    <div className="print-root">
      {/* 인쇄 시에만 보이는 보고서 머리글 */}
      <div className="mb-3 hidden print:block">
        <span className="text-lg font-black text-pine-dark">{student.name}</span>
        <span className="ml-2 text-sm">유형분석 보고서 · {course.label}</span>
      </div>

      {/* 상단 컨트롤 바 */}
      <div className="no-print mb-3 flex flex-wrap items-center gap-3 text-sm">
        <select value={courseId} onChange={e => setCourseId(e.target.value)}
          className="rounded-lg border border-line px-3 py-2 font-semibold">
          {CURRICULA.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={weakOnly} onChange={e => setWeakOnly(e.target.checked)} />
          취약 유형만 보기
        </label>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          전체 유형 보기
        </label>
        <div className="grow" />
        <button disabled={checked.size === 0}
          onClick={() => nav(`/make?types=${[...checked].join(',')}&course=${courseId}`)}
          className="rounded-lg bg-pine px-4 py-2 font-bold text-paper disabled:opacity-40">
          선택 유형으로 학습지 만들기 ({checked.size})
        </button>
        <button onClick={() => window.print()}
          className="rounded-lg border border-pine px-4 py-2 font-semibold text-pine hover:bg-pine-soft">
          🖨 유형분석 보고서
        </button>
      </div>

      {/* 요약 + 범례 (인쇄에 포함) */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink2">
        <span className="text-sm">
          누적 채점 <b className="text-ink">{myGradings.length}</b>회 ·
          푼 유형 <b className="text-ink"> {stats.length}</b>개 ·
          취약 유형 <b className="text-clay"> {weak.length}</b>개
        </span>
        <span className="mx-1 hidden h-3 w-px bg-line sm:inline-block" />
        {LEGEND.map(l => (
          <span key={l.t} className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded ${l.c}`} />
            {l.t} <b>{legendCounts.get(l.c) ?? 0}</b>
          </span>
        ))}
      </div>

      {/* 성취도 매트릭스 */}
      {sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-10 text-center text-sm text-ink2">
          {weakOnly
            ? '이 과정에 취약 유형이 없습니다.'
            : <>이 과정에 채점 데이터가 없습니다. 다른 과정을 선택하거나 <b>전체 유형 보기</b>를 켜세요.</>}
        </div>
      ) : (
        sections.map(sec => (
          <div key={sec.key} className="mb-4 rounded-2xl border border-line bg-white p-4">
            <div className="mb-2 text-sm font-black">{sec.title}</div>
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-8" /><col /><col className="w-24" /><col className="w-24" /><col className="w-24" />
              </colgroup>
              <thead>
                <tr className="border-b border-line text-xs text-ink2">
                  <th />
                  <th className="pb-1 text-left font-semibold">유형</th>
                  {BANDS.map(b => <th key={b} className="pb-1 text-center font-semibold">{b}</th>)}
                </tr>
              </thead>
              <tbody>
                {sec.rows.map(t => {
                  const tb = bands.get(t.id)
                  return (
                    <tr key={t.id} onClick={() => setDetailId(t.id)}
                      className={`cursor-pointer border-b border-line/50 last:border-0 hover:bg-paper2 ${detailId === t.id ? 'bg-pine-soft/40' : ''}`}>
                      <td onClick={e => e.stopPropagation()} className="text-center">
                        <input type="checkbox" checked={checked.has(t.id)} onChange={() => toggleCheck(t.id)}
                          className="no-print cursor-pointer" />
                      </td>
                      <td className="py-1.5 pr-2">{t.name}</td>
                      {BANDS.map(b => <BandCell key={b} typeId={t.id} agg={tb?.[b]} />)}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))
      )}

      {/* 유형별 상세 보기 (우측 고정) */}
      {detailId && (
        <aside className="no-print fixed bottom-4 right-4 top-24 z-40 w-80 overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-xl">
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
          <h3 className="mb-3 text-sm font-black leading-snug">{typeName(detailId)}</h3>

          <table className="mb-4 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink2">
                <th className="py-1 text-left font-semibold">난이도</th>
                <th className="font-semibold">푼</th>
                <th className="font-semibold">맞음</th>
                <th className="font-semibold">틀림</th>
              </tr>
            </thead>
            <tbody>
              {BANDS.map(b => {
                const a = bands.get(detailId)?.[b] ?? { total: 0, wrong: 0 }
                return (
                  <tr key={b} className="border-b border-line/50 text-center">
                    <td className="py-1.5 text-left font-semibold">{b}</td>
                    <td>{a.total}</td>
                    <td className={a.total - a.wrong > 0 ? 'text-pine-dark' : ''}>{a.total - a.wrong}</td>
                    <td className={a.wrong > 0 ? 'font-bold text-clay' : ''}>{a.wrong}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="mb-1 text-xs font-bold text-ink2">최근 채점 내역</div>
          {(recs.get(detailId) ?? []).length === 0 ? (
            <p className="mb-4 text-xs text-ink2">이 유형의 채점 기록이 없습니다.</p>
          ) : (
            <div className="mb-4">
              {(recs.get(detailId) ?? []).slice(0, 12).map((r, i) => (
                <div key={i} className="flex items-center justify-between border-b border-line/50 py-1 text-xs last:border-0">
                  <span className="text-ink2">{dateKey(r.date)}</span>
                  <span>{r.source}</span>
                  <span className={`font-black ${r.correct ? 'text-pine' : 'text-clay'}`}>
                    {r.correct ? '○' : r.unknown ? '모름' : '✕'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => nav(`/make?types=${detailId}&course=${courseId}`)}
            className="w-full rounded-lg bg-pine py-2 text-sm font-bold text-paper hover:brightness-105">
            이 유형으로 학습지 만들기
          </button>
          <button onClick={() => setDetailId(null)}
            className="mt-2 w-full rounded-lg border border-line py-2 text-sm font-semibold hover:bg-paper2">
            닫기
          </button>
        </aside>
      )}
    </div>
  )
}

// 매트릭스 셀: 성취도 색 + 정답률% + 푼 수. 미학습은 회색 '-'
function BandCell({ typeId, agg }: { typeId: string; agg?: BandAgg }) {
  if (!agg || agg.total === 0) {
    return (
      <td className="p-1 text-center">
        <div className="rounded bg-stone-100 py-1.5 text-xs font-semibold text-stone-400">-</div>
      </td>
    )
  }
  const rate = Math.round((1 - agg.wrong / agg.total) * 100)
  return (
    <td className="p-1 text-center">
      <div className={`rounded py-1.5 text-xs font-semibold ${achievementColor({ typeId, wrong: agg.wrong, total: agg.total })}`}>
        {rate}% <span className="opacity-75">· {agg.total}문항</span>
      </div>
    </td>
  )
}
