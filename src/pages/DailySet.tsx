import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useBrand } from '../lib/brand'
import { todayKey } from '../lib/dates'
import { loadWbMatch } from '../data/wbMatch'
import { buildByTypeRound, dailyWsId, typeOrderOfBook, unitsOfOrder } from '../lib/daily'
import { typeUnitName } from '../data/curriculum'
import { DEFAULT_SHEET_OPTIONS } from '../types'
import type { Problem, Student } from '../types'

// ── 📤 오늘 기본과제 — 반/전체 학생에게 3세트를 한 번에 내보낸다 ────────────────
//
// 왜 만들었나 (2026-08-21 명수쌤): "선생님한테 애들이 질문을 안 해서 선생님이 하는 일이 없다.
// 매일 기본으로 수학·과학 문제를 풀게 하고 영어는 단어시험을 봐야겠다. 학생들이 와서 풀고
// 질문을 하러 오는 형식으로."
//
// 🔴 지금까지 앱에는 **반 30명을 한 번에 내보내는 코드가 없었다.** 선생님이 학생 한 명씩
//    [출제]를 눌러야 했고 → 아무도 안 눌렀고 → 오답이 안 생겼고 → 「오늘 교실」이 비었고
//    → 결국 선생님이 놀았다. 이 화면이 그 고리의 첫 조각이다.
//
// 🔴 문제는 **교재가 아니라 문제은행에서** 뽑는다. 교재 매칭표는 정답만 있고 문제 이미지가
//    없어서 선생님이 화면에서 문제를 볼 수 없다. 마플시너지의 유형 221개가 문제은행에
//    100% 있고(실측) 그 문항들은 문제·해설 이미지를 갖고 있다 →
//    **유형 순서는 교재를 따르고 문제는 문제은행에서** 가져오면
//    학생 화면·PDF 출력·선생님 지도화면이 한꺼번에 해결된다.

type Made = { student: Student; subject: '수학' | '과학'; wsId: string; n: number }

export default function DailySet() {
  const {
    students, problems, saveWorksheet, addAssignment, ensureCourse,
  } = useStore()
  const brand = useBrand()
  const day = todayKey()

  const [onlyMgmt, setOnlyMgmt] = useState(true)   // 프리미엄 관리앱 등록 학생만
  const [round, setRound] = useState(1)            // 1=대표유형 · 2=유형별 2번째
  // 🔴 진도 범위는 **단원**으로 고른다 (명수쌤: "4단원이면 1,2단원").
  //    과정마다 단원이 다르므로 과정키별로 따로 기억한다.
  const [unitPick, setUnitPick] = useState<Record<string, string[]>>({})
  const [unitList, setUnitList] = useState<{ course: string; label: string; units: string[] }[]>([])
  const [mathN, setMathN] = useState(15)
  const [sciN, setSciN] = useState(18)
  const [busy, setBusy] = useState('')
  const [made, setMade] = useState<Made[]>([])
  const [skipped, setSkipped] = useState<string[]>([])
  const [hi2, setHi2] = useState<'대수' | '미적분'>('대수')   // 고2는 두 과목 중 오늘 낼 것
  // 🔴 problems 는 지연 로드로 나중에 채워진다. 함수 안에서 잡은 값은 낡은 값이라
  //    ref 로 **지금 값**을 본다(안 그러면 늘 "문제은행이 안 들어왔어요" 가 뜬다).
  const problemsRef = useRef(problems)
  useEffect(() => { problemsRef.current = problems }, [problems])

  const targets = useMemo(() => {
    const act = students.filter(s => s.active)
    return onlyMgmt ? act.filter(s => s.mgmtId) : act
  }, [students, onlyMgmt])

  const mgmtCount = students.filter(s => s.active && s.mgmtId).length

  // ── 학년 → 과정·교재 ─────────────────────────────────────────────
  // 🔴 명수쌤 확정(2026-08-21): **중학교는 2학기 · 고등은 공통수학2·미적분·대수.**
  //    학생 학년은 '중2' 같은 학년 표기인데 과정은 'm2-2' 같은 학기 표기라 그냥은 안 맞는다.
  //    그래서 여기서 명시적으로 잇는다 — 추측하지 않는다.
  // 🔴 유형 순서는 **교재 매칭표(책 차례)** 에서 뽑는다. 교육과정 트리는 과학 과정이 아예 없고,
  //    무엇보다 "마플시너지 대표유형부터" 라는 요구가 곧 '책 차례대로' 라는 뜻이다.
  const RAIL: Record<string, { math?: [string, string]; sci?: [string, string] }> = {
    //            [과정키, 교재이름(유형 순서를 가져올 책)]
    중1: { math: ['m1-2', '수학의 바이블 유형ON 중등수학1(하)'], sci: ['m-sci1-2', '오투 중등과학 1-2'] },
    중2: { math: ['m2-2', '쎈 중등수학2(하)'],                  sci: ['m-sci2-2', '오투 중등과학 2-2'] },
    중3: { math: ['m3-2', '쎈 중등수학3(하)'],                  sci: ['m-sci3-2', '오투 중등과학 3-2'] },
    고1: { math: ['h-cm2', '마플시너지 공통수학2'],              sci: ['h-int2', '오투 통합과학2'] },
    고2: { math: ['h-alg', '마플시너지 대수'] },                 // 미적분은 아래 hi2Course 로 고른다
    고3: { math: ['h-calc1', '쎈 미적분1'] },
  }

  // 대상 학생들이 쓰는 과정 목록 — [과정키, [과정키, 교재명, 화면라벨]]
  function railsOf(list: Student[]) {
    const need = new Map<string, [string, string, string]>()
    for (const s of list) {
      const rail = RAIL[s.grade]
      if (!rail) continue
      const mm = s.grade === '고2' && hi2 === '미적분' ? (['h-calc1', '쎈 미적분1'] as [string, string]) : rail.math
      if (mm) need.set(mm[0], [mm[0], mm[1], `${s.grade} 수학`])
      if (rail.sci) need.set(rail.sci[0], [rail.sci[0], rail.sci[1], `${s.grade} 과학`])
    }
    return need
  }

  // typeUnitName 은 "대단원 · 중단원" 을 준다 — 대단원만 쓴다
  const bigUnitOf = (t: string) => (typeUnitName(t) || '').split(' · ')[0] || ''

  // 대상 학생의 과정들을 읽어 단원 목록을 화면에 띄운다(단원을 골라야 범위를 정할 수 있다)
  async function loadUnits() {
    setBusy('단원 읽는 중…')
    const need = railsOf(targets)
    const out: { course: string; label: string; units: string[] }[] = []
    for (const [course, [, bookName, label]] of need) {
      try {
        const data = await loadWbMatch(course)
        const key = Object.keys(data).find(k => k.startsWith(bookName + '|')) ?? Object.keys(data)[0]
        if (!key) continue
        const order = typeOrderOfBook(data[key] as unknown[][])
        const units = unitsOfOrder(order, bigUnitOf)
        if (units.length) out.push({ course, label, units })
      } catch { /* 매칭표 없음 */ }
    }
    setUnitList(out)
    // 기본값: 앞의 절반 단원 (4단원이면 1,2단원)
    setUnitPick(p => {
      const n = { ...p }
      for (const u of out) if (!n[u.course]) n[u.course] = u.units.slice(0, Math.ceil(u.units.length / 2))
      return n
    })
    setBusy('')
  }

  async function makeAll() {
    if (!targets.length) return
    setBusy('준비 중…'); setMade([]); setSkipped([])
    const out: Made[] = []
    const skip: string[] = []

    // 과정별로 ①문제은행 로드 ②교재 매칭표에서 유형 순서 뽑기 — 한 번씩만 한다
    const need = railsOf(targets)
    need.forEach((_, c) => ensureCourse(c))

    setBusy('교재 차례 읽는 중…')
    const orders = new Map<string, string[]>()
    for (const [course, [, bookName]] of need) {
      try {
        const data = await loadWbMatch(course)
        const key = Object.keys(data).find(k => k.startsWith(bookName + '|')) ?? Object.keys(data)[0]
        if (key) orders.set(course, typeOrderOfBook(data[key] as unknown[][]))
      } catch { /* 매칭표가 없으면 아래에서 건너뛴다 */ }
    }

    // 🔴 문제은행은 지연 로드라 setState 반영을 기다려야 한다. 고정 시간으로 자면 느린 날
    //    통째로 실패하므로, **실제로 들어왔는지 확인하며** 최대 30초까지 기다린다.
    setBusy('문제은행 불러오는 중… (처음 한 번만 오래 걸려요)')
    const wanted = new Set<string>()
    orders.forEach(o => o.slice(0, 40).forEach(t => wanted.add(t)))
    for (let i = 0; i < 60; i++) {
      const have = problemsRef.current.some(p => wanted.has(p.typeId))
      if (have) break
      await new Promise(r => setTimeout(r, 500))
    }

    const pool = problemsRef.current
    for (const s of targets) {
      const rail = RAIL[s.grade]
      if (!rail) { skip.push(`${s.name}(${s.grade}) — 지원하지 않는 학년`); continue }
      setBusy(`${s.name} 학생 만드는 중…`)
      const plan: [string, [string, string] | undefined][] = [
        ['수학', s.grade === '고2' && hi2 === '미적분' ? ['h-calc1', '쎈 미적분1'] : rail.math],
        ['과학', rail.sci],
      ]
      for (const [subject, entry] of plan) {
        if (!entry) { skip.push(`${s.name}(${s.grade}) ${subject} — 해당 과정 없음`); continue }
        const [course] = entry
        const typeOrder = orders.get(course)
        if (!typeOrder?.length) { skip.push(`${s.name} ${subject} — 교재 차례를 못 읽음(${course})`); continue }
        const tset = new Set(typeOrder)
        const inCourse = pool.filter(p => tset.has(p.typeId))
        if (!inCourse.length) { skip.push(`${s.name} ${subject} — 문제은행이 안 들어왔어요(${course})`); continue }
        const picks = buildByTypeRound(inCourse, {
          typeOrder, round,
          count: subject === '수학' ? mathN : sciN,
          units: unitPick[course], unitOf: bigUnitOf,
        })
        if (!picks.length) { skip.push(`${s.name} ${subject} — 이 범위·회차에 문제가 없어요`); continue }
        const id = dailyWsId(s.id, subject, day)
        saveWorksheet({
          id,
          title: `${subject} 기본과제 ${round}회차 - ${s.name} (${day.slice(5).replace('-', '.')})`,
          author: brand, grade: s.grade, subject: subject as '수학' | '과학',
          tags: ['오늘의 학습', '기본과제'], theme: subject === '수학' ? 'amber' : 'pine',
          problemIds: picks.map((p: Problem) => p.id), conceptIds: [],
          options: { ...DEFAULT_SHEET_OPTIONS, autoGrade: true },
          listIds: [], createdAt: new Date().toISOString(), deletedAt: null,
        })
        addAssignment(id, [s.id], '수업')
        out.push({ student: s, subject: subject as '수학' | '과학', wsId: id, n: picks.length })
      }
    }
    setMade(out); setSkipped(skip); setBusy('')
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-1 text-xl font-black">📤 오늘 기본과제</h1>
      <p className="mb-5 text-sm text-ink2">
        평일마다 학생별로 <b className="text-ink">수학·과학</b> 학습지를 한 번에 만듭니다.
        학생이 풀고 채점하면 <Link to="/today" className="font-bold text-pine underline">오늘 교실</Link>에
        오답 수로 떠서, 선생님이 부르고 틀린 문제를 바로 볼 수 있어요.
      </p>

      <div className="mb-5 grid gap-3 rounded-2xl border border-line bg-white p-4">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={onlyMgmt} onChange={e => setOnlyMgmt(e.target.checked)} />
          프리미엄 관리앱 등록 학생만
          <span className="font-normal text-ink2">({mgmtCount}명 / 재원생 {students.filter(s => s.active).length}명)</span>
        </label>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <span className="font-semibold">회차</span>
            <select value={round} onChange={e => setRound(Number(e.target.value))}
              className="rounded-lg border border-line px-2 py-1 font-bold">
              <option value={1}>1회차 — 유형 대표문제</option>
              <option value={2}>2회차 — 유형별 2번째</option>
              <option value={3}>3회차 — 유형별 3번째</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="font-semibold">고2 과목</span>
            <select value={hi2} onChange={e => setHi2(e.target.value as '대수' | '미적분')}
              className="rounded-lg border border-line px-2 py-1 font-bold">
              <option value="대수">대수</option>
              <option value="미적분">미적분</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="font-semibold">수학</span>
            <input type="number" min={5} max={40} value={mathN} onChange={e => setMathN(Number(e.target.value))}
              className="w-14 rounded-lg border border-line px-2 py-1 text-right font-bold" />
            <span className="text-ink2">문항</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="font-semibold">과학</span>
            <input type="number" min={5} max={40} value={sciN} onChange={e => setSciN(Number(e.target.value))}
              className="w-14 rounded-lg border border-line px-2 py-1 text-right font-bold" />
            <span className="text-ink2">문항</span>
          </label>
        </div>

        {/* 🔴 진도 범위 = 단원. "4단원이면 1,2단원" — 선생님이 쓰는 단위로 고른다 */}
        <div className="grid gap-2 rounded-xl bg-paper2/60 p-3">
          <div className="flex items-center gap-2">
            <b className="text-sm">진도 범위 (단원)</b>
            <button onClick={loadUnits} disabled={!!busy || !targets.length}
              className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-bold text-ink2 hover:border-pine disabled:opacity-50">
              {unitList.length ? '단원 다시 읽기' : '📖 단원 불러오기'}
            </button>
            {!unitList.length && <span className="text-xs text-ink2">먼저 눌러 단원을 고르세요 (안 고르면 전체 범위)</span>}
          </div>
          {unitList.map(u => (
            <div key={u.course} className="grid gap-1">
              <span className="text-xs font-bold text-ink2">{u.label} <span className="font-normal">— 총 {u.units.length}단원</span></span>
              <div className="flex flex-wrap gap-1.5">
                {u.units.map((name, i) => {
                  const on = (unitPick[u.course] ?? []).includes(name)
                  return (
                    <button key={name} type="button"
                      onClick={() => setUnitPick(p => {
                        const cur = p[u.course] ?? []
                        return { ...p, [u.course]: on ? cur.filter(x => x !== name) : [...cur, name] }
                      })}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        on ? 'bg-pine text-paper' : 'border border-line bg-white text-ink2'}`}>
                      {i + 1}. {name}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <button onClick={makeAll} disabled={!!busy || !targets.length}
          className="rounded-lg bg-pine px-5 py-2.5 text-sm font-bold text-paper hover:brightness-110 disabled:opacity-50">
          {busy || `📤 ${targets.length}명에게 만들기 (수학 + 과학)`}
        </button>
        {!targets.length && (
          <p className="text-xs text-clay">
            대상 학생이 없습니다. 프리미엄 관리앱 등록 학생이 0명이면 위 체크를 풀어 전체 재원생으로 만드세요.
          </p>
        )}
      </div>

      {made.length > 0 && (
        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <b className="text-sm">✅ {made.length}장 만들었습니다</b>
            <span className="text-xs text-ink2">
              학생 {new Set(made.map(m => m.student.id)).size}명 · 문항 합계 {made.reduce((a, m) => a + m.n, 0)}
            </span>
          </div>
          <div className="grid gap-1.5">
            {made.map(m => (
              <div key={m.wsId} className="flex items-center gap-2 rounded-lg border border-line/70 px-3 py-2 text-sm">
                <b className="w-20">{m.student.name}</b>
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                  m.subject === '수학' ? 'bg-amber/20 text-ink' : 'bg-pine-soft text-pine-dark'}`}>{m.subject}</span>
                <span className="text-ink2">{m.n}문항</span>
                <div className="grow" />
                <Link to={`/worksheet/${m.wsId}?out=문제지`}
                  className="rounded-lg border border-line px-2.5 py-1 text-xs font-bold text-ink2 hover:border-pine">
                  🖨 인쇄
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {skipped.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber/50 bg-amber/10 px-4 py-3 text-xs leading-relaxed">
          <b>건너뛴 것 {skipped.length}건</b>
          <ul className="mt-1 grid gap-0.5 text-ink2">{skipped.map((s, i) => <li key={i}>· {s}</li>)}</ul>
        </div>
      )}
    </div>
  )
}
