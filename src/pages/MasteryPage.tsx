import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { CURRICULA } from '../data/curriculum'
import MasteryRunner from '../components/MasteryRunner'
import MasteryPrint from '../components/MasteryPrint'
import type { Problem } from '../types'

/**
 * 🪜 유형 마스터 — 유형 하나를 **끝까지** 물고 늘어지는 화면 (2026-09-05 명수쌤 지시)
 *
 *   개념 빈칸 ↔ 기본 ↔ 표준 ↔ 심화 ↔ 최상
 *   틀리면 내려가 다시 이해시키고, 두 번 연속 맞히면 올린다.
 *
 * 화면으로 풀리는 학생은 [시작]으로, 태블릿을 안 쓰는 학생은 [인쇄]로 같은 사다리를 종이로 받는다.
 */

type TypeRow = { id: string; name: string; course: string; sub: string }

export default function MasteryPage() {
  const { problems, ensureCourse } = useStore()
  const [params] = useSearchParams()
  const [course, setCourse] = useState(params.get('course') ?? 'm1-1')
  const [q, setQ] = useState('')
  const [typeId, setTypeId] = useState<string | null>(params.get('type'))
  const [mode, setMode] = useState<'풀기' | '인쇄'>('풀기')

  useEffect(() => { ensureCourse(course) }, [course])   // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo<TypeRow[]>(() => {
    const c = CURRICULA.find((x) => x.id === course)
    if (!c) return []
    const out: TypeRow[] = []
    for (const u of c.units) for (const m of u.mids) for (const s of m.subs) for (const t of s.types)
      out.push({ id: t.id, name: t.name, course, sub: s.name })
    return out
  }, [course])

  const shown = useMemo(() => {
    const k = q.trim()
    return (k ? rows.filter((r) => r.name.includes(k) || r.sub.includes(k)) : rows).slice(0, 300)
  }, [rows, q])

  const pool = useMemo(
    () => (typeId ? problems.filter((p) => p.typeId === typeId) : []),
    [problems, typeId],
  )
  // 기준 문항 = 그 유형의 **표준**(중간 난이도). 여기가 2층이고 위아래로 사다리가 뻗는다.
  // 가장 쉬운 것을 기준으로 잡으면 기본과 표준이 똑같이 「하」가 되어 사다리가 뭉개진다(2026-09-05 실측).
  const base: Problem | null = useMemo(() => {
    if (!pool.length) return null
    return [...pool].sort((a, b) => Math.abs(a.diff - 3) - Math.abs(b.diff - 3))[0]
  }, [pool])

  const row = rows.find((r) => r.id === typeId)

  if (typeId && base && row) {
    if (mode === '인쇄') {
      return <MasteryPrint typeId={typeId} typeName={row.name} base={base} pool={pool}
        onClose={() => setMode('풀기')} />
    }
    return (
      <MasteryRunner
        typeId={typeId} typeName={row.name} base={base} pool={pool} studentId="me"
        onClose={() => setTypeId(null)}
      />
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-lg font-bold text-ink">🪜 유형 마스터</h1>
      <p className="mt-1 text-sm text-ink2">
        유형 하나를 개념 빈칸부터 최상 난이도까지 올려 붙인다.
        틀리면 한 단계 내려가 다시 이해시키고, 연속 두 문제를 맞히면 올라간다.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <select value={course} onChange={(e) => { setCourse(e.target.value); setTypeId(null) }}
          className="rounded-lg border border-line px-3 py-2 text-sm">
          {CURRICULA.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="유형·소단원 검색"
          className="flex-1 rounded-lg border border-line px-3 py-2 text-sm" />
        <label className="flex items-center gap-1.5 text-sm text-ink2">
          <input type="checkbox" checked={mode === '인쇄'}
            onChange={(e) => setMode(e.target.checked ? '인쇄' : '풀기')} />
          종이로 (인쇄용)
        </label>
      </div>

      <div className="mt-3 divide-y divide-line rounded-xl border border-line bg-paper">
        {shown.map((r) => {
          const n = problems.filter((p) => p.typeId === r.id).length
          return (
            <button key={r.id} type="button" disabled={n === 0} onClick={() => setTypeId(r.id)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-pine-soft disabled:opacity-40">
              <span>
                <span className="text-ink">{r.name}</span>
                <span className="ml-2 text-xs text-ink2">{r.sub}</span>
              </span>
              <span className="text-xs text-ink2">{n}문항</span>
            </button>
          )
        })}
        {!shown.length && <p className="px-4 py-6 text-center text-sm text-ink2">해당하는 유형이 없습니다.</p>}
      </div>
    </div>
  )
}
