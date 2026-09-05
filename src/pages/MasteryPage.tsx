import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useSubject, SUBJECTS, type Subject } from '../lib/subject'
import { CURRICULA } from '../data/curriculum'
import MasteryRunner from '../components/MasteryRunner'
import MasteryPrint from '../components/MasteryPrint'
import { newMastery, type MasteryState } from '../lib/mastery'
import type { Problem } from '../types'

/**
 * 🪜 유형 마스터 — 유형 하나를 **끝까지** 물고 늘어지는 화면 (2026-09-05 명수쌤 지시)
 *
 *   개념 빈칸 ↔ 기본 ↔ 표준 ↔ 심화 ↔ 최상
 *   틀리면 내려가 다시 이해시키고, 두 번 연속 맞히면 올린다.
 *
 * 🔴 **과목을 가리지 않는다.** 사다리는 `유형 + 문제풀 + 개념카드` 세 가지만 있으면 돌아간다
 *    (2026-09-05 명수쌤: "모든과목 문제은행이 수학처럼 … 최종 유형정복까지").
 *    수학·과학·사회·역사는 문제풀이 있으니 개념카드가 채워지는 대로 그 과정이 열린다.
 *
 * 들어오는 길 둘 — 유형을 직접 고르거나, 학생이 **방금 틀린 문항**에서 넘어온다
 * (`?type=<유형id>&base=<문항id>`). 진행상태는 학생별·유형별로 저장돼 기기를 바꿔도 이어진다.
 */

type TypeRow = { id: string; name: string; course: string; sub: string }

/** 유형이 속한 과정 — 틀린 문항에서 넘어올 때 과정을 알아내려고 쓴다 */
function courseOfType(typeId: string): string | null {
  for (const c of CURRICULA) for (const u of c.units) for (const m of u.mids)
    for (const s of m.subs) for (const t of s.types) if (t.id === typeId) return c.id
  return null
}

export default function MasteryPage({ studentId = 'me' }: { studentId?: string }) {
  const { problems, ensureCourse, masteries, saveMastery } = useStore()
  const [params] = useSearchParams()
  const [subject, setSubject] = useSubject()

  const paramType = params.get('type')
  const paramBase = params.get('base')
  const [course, setCourse] = useState(
    () => params.get('course') ?? (paramType && courseOfType(paramType)) ?? 'm1-1',
  )
  const [q, setQ] = useState('')
  const [typeId, setTypeId] = useState<string | null>(paramType)
  const [mode, setMode] = useState<'풀기' | '인쇄'>('풀기')

  useEffect(() => { ensureCourse(course) }, [course])   // eslint-disable-line react-hooks/exhaustive-deps

  // 과목 스위처에 맞는 과정만 보여 준다 (subject 없는 과정 = 수학)
  const courses = useMemo(
    () => CURRICULA.filter((c) => (c.subject ?? '수학') === subject),
    [subject],
  )
  // 🔴 링크로 들어온 과정(예: 국어)이 지금 과목(수학)과 다르면 **과목을 먼저 맞춘다.**
  //    안 그러면 아래 효과가 「그 과목에 없는 과정」이라 보고 첫 과정으로 되돌려 버린다
  //    (2026-09-05 실물에서 발견 — 국어 링크가 초1-1 수학으로 튀었다).
  useEffect(() => {
    const c = CURRICULA.find((x) => x.id === course)
    const want = c?.subject ?? '수학'
    if (want !== subject) setSubject(want)
  }, [course])   // eslint-disable-line react-hooks/exhaustive-deps

  // 고른 과정이 그 과목에 없으면 첫 과정으로 옮긴다.
  // 단 **과목을 바꾸는 중이면 건드리지 않는다** — 위 효과가 과목을 맞추기 전에
  // 이게 먼저 돌면 링크로 연 유형이 풀려 목록으로 튄다(2026-09-05 실물에서 발견).
  useEffect(() => {
    const cur = CURRICULA.find((x) => x.id === course)
    if ((cur?.subject ?? '수학') !== subject) return      // 아직 과목이 안 맞았다 — 기다린다
    if (courses.length && !courses.some((c) => c.id === course)) {
      setCourse(courses[0].id); setTypeId(null)
    }
  }, [courses, subject])   // eslint-disable-line react-hooks/exhaustive-deps

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
  // 기준 문항 = 학생이 방금 틀린 그 문제. 없으면 그 유형의 **표준**(중간 난이도).
  // 가장 쉬운 것을 기준으로 잡으면 기본과 표준이 똑같이 「하」가 되어 사다리가 뭉개진다(2026-09-05 실측).
  const base: Problem | null = useMemo(() => {
    if (!pool.length) return null
    const given = paramBase ? pool.find((p) => p.id === paramBase) : undefined
    return given
      ?? [...pool].sort((a, b) => Math.abs(a.diff - 3) - Math.abs(b.diff - 3))[0]
  }, [pool, paramBase])

  const row = rows.find((r) => r.id === typeId)
  const saved = typeId ? masteries[`${studentId}|${typeId}`] : undefined

  if (typeId && base && row) {
    if (mode === '인쇄') {
      return <MasteryPrint typeId={typeId} typeName={row.name} base={base} pool={pool}
        onClose={() => setMode('풀기')} />
    }
    return (
      <MasteryRunner
        key={typeId}
        typeId={typeId} typeName={row.name} base={base} pool={pool} studentId={studentId}
        initial={saved ?? newMastery(studentId, typeId, 2)}
        onChange={(st: MasteryState) => saveMastery(studentId, typeId, st)}
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
        <select value={subject} onChange={(e) => setSubject(e.target.value as Subject)}
          className="rounded-lg border border-line px-3 py-2 text-sm font-bold">
          {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={course} onChange={(e) => { setCourse(e.target.value); setTypeId(null) }}
          className="rounded-lg border border-line px-3 py-2 text-sm">
          {courses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="유형·소단원 검색"
          className="min-w-[10rem] flex-1 rounded-lg border border-line px-3 py-2 text-sm" />
        <label className="flex items-center gap-1.5 text-sm text-ink2">
          <input type="checkbox" checked={mode === '인쇄'}
            onChange={(e) => setMode(e.target.checked ? '인쇄' : '풀기')} />
          종이로 (인쇄용)
        </label>
      </div>

      {!courses.length && (
        <p className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink2">
          {subject} 은(는) 아직 문제은행이 없습니다.
        </p>
      )}

      <div className="mt-3 divide-y divide-line rounded-xl border border-line bg-paper">
        {shown.map((r) => {
          const n = problems.filter((p) => p.typeId === r.id).length
          const st = masteries[`${studentId}|${r.id}`]
          return (
            <button key={r.id} type="button" disabled={n === 0} onClick={() => setTypeId(r.id)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-pine-soft disabled:opacity-40">
              <span>
                <span className="text-ink">{r.name}</span>
                <span className="ml-2 text-xs text-ink2">{r.sub}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-ink2">
                {st?.mastered && <span className="rounded bg-pine-soft px-1.5 py-0.5 font-bold text-pine-dark">마스터</span>}
                {st && !st.mastered && <span className="rounded bg-sky-100 px-1.5 py-0.5 font-bold text-sky-800">진행 중</span>}
                {n}문항
              </span>
            </button>
          )
        })}
        {!shown.length && !!courses.length &&
          <p className="px-4 py-6 text-center text-sm text-ink2">해당하는 유형이 없습니다.</p>}
      </div>
    </div>
  )
}
