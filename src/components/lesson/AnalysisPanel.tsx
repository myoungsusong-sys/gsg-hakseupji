import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CURRICULA, curriculumFor, typeName } from '../../data/curriculum'
import type { TypeNode } from '../../data/curriculum'
import { useStore } from '../../lib/store'
import { achievementColor, resultTypeId, weakTypes, wrongByType } from '../../lib/drill'
import { dateKey } from '../../lib/dates'
import type { Student } from '../../types'

// 매쓰플랫 「수업 > 유형분석」 — 유형×난이도밴드 문항 타일 매트릭스 + 유형별 상세 보기
const BANDS = ['개념', '기본', '심화'] as const
type Band = typeof BANDS[number]

interface Rec {
  date: string
  source: '교재' | '학습지'
  sourceName: string
  correct: boolean
  unknown?: boolean
}

type TypeBands = Record<Band, Rec[]>

// achievementColor의 5색과 반드시 동일한 클래스 문자열 (개수 집계·구간명 키로 사용)
const LEGEND = [
  { c: 'bg-stone-100 text-stone-400', t: '미학습' },
  { c: 'bg-red-100 text-red-800', t: '취약' },
  { c: 'bg-amber-soft text-amber', t: '보통' },
  { c: 'bg-pine-soft text-pine-dark', t: '양호' },
  { c: 'bg-pine text-white', t: '우수' },
]

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

export default function AnalysisPanel({ student }: { student: Student }) {
  const { gradings, wbItems, workbooks, worksheets } = useStore()
  const nav = useNavigate()

  const [courseId, setCourseId] = useState(() => defaultCourseId(student.grade))
  const [recOnly, setRecOnly] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [detailId, setDetailId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // 학생이 바뀌면 과정·선택·상세를 초기화
  useEffect(() => {
    setCourseId(defaultCourseId(student.grade))
    setChecked(new Set())
    setDetailId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id])
  // 과정이 바뀌면 선택·상세·접기만 초기화 (학습지 만들기 URL이 과정과 엮이므로)
  useEffect(() => { setChecked(new Set()); setDetailId(null); setCollapsed(new Set()) }, [courseId])

  const course = curriculumFor(courseId)
  const myGradings = useMemo(() => gradings.filter(g => g.studentId === student.id), [gradings, student.id])
  const stats = useMemo(() => wrongByType(student.id, gradings, wbItems), [student.id, gradings, wbItems])
  const statMap = useMemo(() => new Map(stats.map(s => [s.typeId, s])), [stats])
  const weak = useMemo(() => weakTypes(stats), [stats])

  // 유형×밴드 문항 타일 + 유형별 최근 채점 내역
  // 교재 채점: itemId→WBItem(typeId·diff), 학습지 채점: typeId 직접(diff는 3으로 간주)
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
        const diff = r.itemId ? itemMap.get(r.itemId)?.diff ?? 3 : 3
        const rec: Rec = { date: g.date, source, sourceName, correct: r.correct, unknown: r.unknown }
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
        const rows = recOnly ? all.filter(t => (statMap.get(t.id)?.wrong ?? 0) > 0) : all
        if (rows.length === 0) continue
        out.push({ key: m.id, title: `${u.name} | ${m.name}`, rows })
      }
    return out
  }, [course, statMap, recOnly, showAll])

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
  const detailStat = detailId ? statMap.get(detailId) : undefined
  const detailCls = achievementColor(detailStat)
  const detailLabel = LEGEND.find(l => l.c === detailCls)?.t ?? '미학습'

  function toggleCheck(id: string) {
    setChecked(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
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
  }

  return (
    <div className="print-root">
      {/* 인쇄 시에만 보이는 보고서 머리글 */}
      <div className="mb-3 hidden print:block">
        <span className="text-lg font-black text-pine-dark">{student.name}</span>
        <span className="ml-2 text-sm">유형분석 보고서 · {course.label}</span>
      </div>

      {/* 필터 줄: 과정 | 추천 유형만 보기(토글) | 전체 유형 보기 | 초기화 */}
      <div className="no-print mb-3 flex flex-wrap items-center gap-3 text-sm">
        <select value={courseId} onChange={e => setCourseId(e.target.value)}
          className="rounded-lg border border-line px-3 py-2 font-semibold">
          {CURRICULA.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
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

      {/* 둘째 줄: 좌측 요약 | 우측 보고서 버튼들 */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span>
          누적 채점 <b className="text-ink">{myGradings.length}</b>회 ·
          푼 유형 <b className="text-ink"> {stats.length}</b>개 ·
          취약 유형 <b className="text-clay"> {weak.length}</b>개
        </span>
        <div className="grow" />
        <button onClick={() => alert('인쇄한 보고서는 브라우저 인쇄 기록에 저장됩니다')}
          className="no-print rounded-lg border border-line px-3 py-2 font-semibold text-ink2 hover:bg-paper2">
          🗒 보고서 내역
        </button>
        <button onClick={() => window.print()}
          className="no-print rounded-lg bg-blue-500 px-4 py-2 font-bold text-white hover:brightness-105">
          ＋ 유형분석 보고서 만들기
        </button>
      </div>

      {/* 범례 (인쇄에 포함) */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink2">
        {LEGEND.map(l => (
          <span key={l.t} className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded ${l.c}`} />
            {l.t} <b>{legendCounts.get(l.c) ?? 0}</b>
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
            <button onClick={() => toggleCollapse(sec.key)}
              className="mb-2 flex w-full items-center justify-between text-left text-sm font-black hover:text-pine-dark">
              <span>{sec.title}</span>
              <span className="text-xs text-ink2">{collapsed.has(sec.key) ? '▸' : '▾'}</span>
            </button>
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
                    return (
                      <tr key={t.id} onClick={() => setDetailId(t.id)}
                        className={`cursor-pointer border-b border-line/50 last:border-0 hover:bg-paper2 ${detailId === t.id ? 'bg-pine-soft/40' : ''}`}>
                        <td onClick={e => e.stopPropagation()} className="text-center">
                          <input type="checkbox" checked={checked.has(t.id)} onChange={() => toggleCheck(t.id)}
                            className="no-print cursor-pointer" />
                        </td>
                        <td className="py-1.5 pr-2">{t.name}</td>
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
              학습 성취도 <b className={`rounded px-1.5 py-0.5 ${detailCls}`}>{detailLabel}</b>입니다.
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
