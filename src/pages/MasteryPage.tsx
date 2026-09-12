import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useSubject, SUBJECTS, type Subject } from '../lib/subject'
import { CURRICULA } from '../data/curriculum'
import MasteryRunner from '../components/MasteryRunner'
import MasteryPrint from '../components/MasteryPrint'
import { newMastery, type MasteryState } from '../lib/mastery'
import type { Problem } from '../types'
import MasteryQueue, { typeNameOf } from '../components/MasteryQueue'
import { stateToStart, type WrongTypeRow } from '../lib/wrongTypes'
import { filterByEngBook } from '../data/engBooks'

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

/**
 * 🗺️ 커리큘럼 **밖** 유형의 소속 과정 — public/type-course.json (scripts/build-type-course.mjs 가 만든다)
 *
 * 🔴 왜 필요한가 (2026-09-12 실측)
 *    커리큘럼 트리에 등록된 유형은 6,684개인데, 실제 문항은 그보다 훨씬 넓게 붙어 있다 —
 *    이미지 풀 1,322,593문항 중 **712,189건(53.8%)**, 교재(wb-match) **78,673문항**이
 *    커리큘럼에 없는 유형이다. 그런 문항을 틀리면 정복 큐에는 줄이 서는데
 *    아래 `row` 를 못 찾아 **[정복 시작]이 아무 반응도 없었다**(게다가 상태는 저장돼 '진행중'으로 영영 남음).
 *    사다리 자체는 `유형 + 문제풀` 만 있으면 도니까, 과정만 알아내면 그대로 돌릴 수 있다.
 */
let typeCourse: Record<string, string> | null = null
let typeCourseReq: Promise<Record<string, string>> | null = null
function loadTypeCourse(): Promise<Record<string, string>> {
  if (typeCourse) return Promise.resolve(typeCourse)
  typeCourseReq ??= fetch(`${import.meta.env.BASE_URL}type-course.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then((d: Record<string, string>) => (typeCourse = d))
  return typeCourseReq
}

/** 커리큘럼 트리 안에서만 찾는다 (색인 fallback 없이) */
function courseOfTypeInCurriculum(typeId: string): string | null {
  for (const c of CURRICULA) for (const u of c.units) for (const m of u.mids)
    for (const s of m.subs) for (const t of s.types) if (t.id === typeId) return c.id
  return null
}

/** 유형이 속한 과정 — 틀린 문항에서 넘어올 때 과정을 알아내려고 쓴다 */
function courseOfType(typeId: string): string | null {
  for (const c of CURRICULA) for (const u of c.units) for (const m of u.mids)
    for (const s of m.subs) for (const t of s.types) if (t.id === typeId) return c.id
  return typeCourse?.[typeId] ?? null
}

export default function MasteryPage({ studentId: studentIdProp = 'me' }: { studentId?: string }) {
  const { problems, ensureCourse, poolLoaded, masteries, saveMastery, allStudents } = useStore()
  const [params] = useSearchParams()
  // 선생님이 특정 학생의 사다리를 열어 본다 (`?student=<학생id>`) — 학생 대신 확인·시연할 때 (2026-09-08)
  const studentId = params.get('student') ?? studentIdProp
  const viewingName = params.get('student') ? (allStudents.find((s) => s.id === studentId)?.name ?? studentId) : null
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

  // 🗺️ 유형→과정 색인은 fetch 라 첫 렌더에 없다. 도착한 뒤 **커리큘럼 밖 유형이면 과정을 다시 맞춘다.**
  //    (안 하면 `?type=` 링크로 들어온 커리큘럼 밖 유형이 기본값 m1-1 풀을 보고 빈 화면이 된다)
  const [, setIdxReady] = useState(0)
  useEffect(() => {
    loadTypeCourse().then((idx) => {
      setIdxReady((n) => n + 1)
      if (typeId && !courseOfTypeInCurriculum(typeId) && idx[typeId]) setCourse(idx[typeId])
    })
  }, [typeId])

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

  // 📗 영어는 **학생이 쓰는 교과서 문항만** 낸다 — 다른 출판사 본문은 처음 보는 지문이라
  //    내신 대비가 안 된다 (2026-09-12 명수쌤 지시). 교과서 미지정이면 거르지 않는다.
  //    교과서에 매이지 않는 문항(어휘·어법·씨앗)은 book 이 없어 항상 남는다.
  const engBook = allStudents.find((s) => s.id === studentId)?.engBook
  const pool = useMemo(
    () => (typeId ? filterByEngBook(problems.filter((p) => p.typeId === typeId), engBook) : []),
    [problems, typeId, engBook],
  )
  // 기준 문항 = 학생이 방금 틀린 그 문제. 없으면 그 유형의 **표준**(중간 난이도).
  // 가장 쉬운 것을 기준으로 잡으면 기본과 표준이 똑같이 「하」가 되어 사다리가 뭉개진다(2026-09-05 실측).
  const base: Problem | null = useMemo(() => {
    if (!pool.length) return null
    const given = paramBase ? pool.find((p) => p.id === paramBase) : undefined
    return given
      ?? [...pool].sort((a, b) => Math.abs(a.diff - 3) - Math.abs(b.diff - 3))[0]
  }, [pool, paramBase])

  // 🔴 커리큘럼에 **이름이 없는 유형**도 문항만 있으면 사다리를 돌린다.
  //    예전엔 여기서 undefined 가 나와 아래 `typeId && base && row` 가 막혔고,
  //    학생이 [정복 시작]을 눌러도 화면이 그대로였다 (2026-09-12 수정).
  //    이름은 모르지만 사다리는 유형·문제풀만 있으면 돈다 — 0층 개념 빈칸도 없으면 안내 후 넘어간다.
  const row = rows.find((r) => r.id === typeId)
    ?? (typeId && pool.length ? { id: typeId, name: `유형 ${typeId}`, course, sub: '' } : undefined)
  const saved = typeId ? masteries[`${studentId}|${typeId}`] : undefined

  // 🪜 정복 대기 큐에서 누름 — 과정을 그 유형의 것으로 맞추고, 시작층(강등이면 한 층 아래)을 저장한 뒤 연다 (2026-09-08)
  const pickFromQueue = (r: WrongTypeRow) => {
    const c = typeNameOf(r.typeId)?.course ?? courseOfType(r.typeId)
    if (c) setCourse(c)
    saveMastery(studentId, r.typeId, stateToStart(r, studentId))
    setTypeId(r.typeId)
  }

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

  // 유형을 골랐는데 그 유형에 문항이 하나도 없다 — 조용히 목록으로 돌아가면
  // 학생은 "버튼이 고장났다"고 느낀다. 이유를 말하고 돌아갈 길을 준다 (2026-09-12).
  // ⚠️ 풀은 비동기로 실린다 — `poolLoaded` 를 안 보면 **로딩 중에 이 안내가 잘못 뜬다.**
  if (typeId && !pool.length && !poolLoaded.has(course)) {
    return <div className="mx-auto max-w-3xl py-16 text-center text-sm text-ink2">문제를 불러오는 중…</div>
  }
  if (typeId && !pool.length) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mt-6 rounded-2xl border border-line bg-white p-6 text-center">
          <div className="text-3xl">📭</div>
          <p className="mt-3 font-black text-ink">이 유형은 아직 풀 문제가 없습니다</p>
          <p className="mt-1 text-sm text-ink2">
            교재에서는 틀린 유형이지만 연습할 문항이 아직 들어오지 않았어요. 선생님께 알려 주세요.
            <span className="ml-1 text-xs">(유형 {typeId})</span>
          </p>
          <button type="button" onClick={() => setTypeId(null)}
            className="mt-4 rounded-lg border border-line px-4 py-2 text-sm hover:bg-paper2">
            목록으로
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-lg font-bold text-ink">🪜 유형 마스터{viewingName ? <span className="ml-2 rounded-full bg-pine-soft px-2.5 py-0.5 text-sm font-black text-pine-dark">{viewingName} 학생 보기</span> : null}</h1>
      {/* 📗 걸러지고 있다는 걸 알려 준다 — 안 그러면 "왜 문제가 몇 개 없지?" 가 된다 */}
      {engBook && (
        <p className="mt-1 text-xs font-bold text-pine-dark">
          📗 영어 교과서 <span className="rounded bg-pine-soft px-1.5 py-0.5">{engBook}</span> 문항만 나갑니다
          <span className="ml-1 font-normal text-ink2">(학생 정보에서 바꿀 수 있어요)</span>
        </p>
      )}
      <p className="mt-1 text-sm text-ink2">
        유형 하나를 개념 빈칸부터 최상 난이도까지 올려 붙인다.
        틀리면 한 단계 내려가 다시 이해시키고, 연속 두 문제를 맞히면 올라간다.
      </p>

      {/* 🪜 교재·학습지 오답이 만든 줄 — 여기서 누르면 바로 사다리 (2026-09-08 명수쌤: 문제집 오답도 승강제 유형정복에) */}
      <div className="mt-4"><MasteryQueue studentId={studentId} onPick={pickFromQueue} /></div>

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
