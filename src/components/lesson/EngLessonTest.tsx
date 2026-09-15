import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore, uid } from '../../lib/store'
import { curriculumFor } from '../../data/curriculum'
import { filterByEngBook } from '../../data/engBooks'
import { gradeKey } from '../../lib/grade'
import { brandFor, DEFAULT_ACADEMY } from '../../lib/brand'
import { dateKey, todayKey } from '../../lib/dates'
import { DEFAULT_SHEET_OPTIONS, type Problem, type Student } from '../../types'

// ── 📝 영어 수업 연계 테스트 (수업 > 과목 영어 > 반·전체 [전체] > 수업 연계 테스트) ─────────
//
// 명수쌤 2026-09-15: "영어도 수업만 하시잖아. 그 수업과 연계해서 테스트와 단어테스트를 해줘야 하는데 방법 만들어줘."
//
//   · 수업이 끝나면 여기서 반 학생 전원에게 **각자 자기 교과서 문항**으로 테스트를 낸다(학생 정보의 영어 교과서).
//     교과서가 안 적힌 학생은 전체 문항에서 나간다 — 표에 빨갛게 표시해 준다.
//   · 범위는 문항 유형(독해 · 어법·어휘 · 서술형 · 단어·문장)과 그 아래 중단원으로 고른다.
//     🔴 문제은행에 교과서 '과(Lesson)' 표시가 없다(exam4you 추출 때 남기지 않았다 — 2026-09-15 확인).
//        과 단위로 내려면 원본을 다시 추출해야 한다. 그때까지는 유형 + 교과서로 낸다.
//   · 자동채점을 켜서 학생이 앱에서 풀면 바로 ○/✕ 가 뜨고, 「오늘 교실」에 오답 수가 올라온다 → 선생님이 부른다.
//   · 이전에 그 학생에게 나간 문항은 빼고 낸다(같은 문제 반복 방지).
//   · 태그 '수업연계' — 오늘 할 일(lib/routine.ts eng-test)이 이 태그로 자동 확인한다.

const COURSES: [string, string][] = [['eng-m1', '중1'], ['eng-m2', '중2'], ['eng-m3', '중3'], ['eng-h1', '고1'], ['eng-h2', '고2'], ['eng-h3', '고3']]
const COUNTS = [10, 15, 20, 25, 30]
const courseOfGrade = (grade: string) => COURSES.find(c => c[1] === gradeKey(grade))?.[0]

/** 학생·날짜로 고정된 난수 — 같은 날 다시 눌러도 같은 문항, 학생마다 다른 순서 */
function seeded(seed: string) {
  let h = 2166136261
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296 }
}
/** 유형별로 고르게 — 한 유형에 몰리지 않게 돌아가며 뽑는다 */
export function pickSpread(cands: Problem[], n: number, seed: string): Problem[] {
  const rnd = seeded(seed)
  const byType = new Map<string, Problem[]>()
  for (const p of cands) { if (!byType.has(p.typeId)) byType.set(p.typeId, []); byType.get(p.typeId)!.push(p) }
  const buckets = [...byType.values()].map(b => b.sort(() => rnd() - 0.5))
  buckets.sort(() => rnd() - 0.5)
  const out: Problem[] = []
  while (out.length < n && buckets.some(b => b.length)) {
    for (const b of buckets) { if (out.length >= n) break; const p = b.shift(); if (p) out.push(p) }
  }
  return out.sort((a, b) => a.typeId.localeCompare(b.typeId))   // 인쇄·풀이 순서는 유형 순
}

export default function EngLessonTest({ label, students }: { label: string; students: Student[] }) {
  const { problems, poolLoaded, ensureCourse, worksheets, assignments, gradings, saveWorksheet, addAssignment, academyProfile } = useStore()
  const today = todayKey()
  const brand = brandFor(academyProfile.academyName?.trim() || DEFAULT_ACADEMY, '영어')

  // 과정 — 반의 학년이 가장 많은 쪽
  const defaultCourse = useMemo(() => {
    const c = new Map<string, number>()
    for (const s of students) { const k = courseOfGrade(s.grade); if (k) c.set(k, (c.get(k) ?? 0) + 1) }
    return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'eng-m1'
  }, [students])
  const [course, setCourse] = useState(defaultCourse)
  useEffect(() => { setCourse(defaultCourse) }, [defaultCourse])
  useEffect(() => { ensureCourse(course) }, [course])   // eslint-disable-line react-hooks/exhaustive-deps
  const cur = curriculumFor(course)
  const loaded = poolLoaded.has(course)
  const pool = useMemo(() => problems.filter(p => p.typeId.startsWith(`${course}-`)), [problems, course])

  const [mids, setMids] = useState<Set<string>>(new Set())      // 비어 있으면 전체
  useEffect(() => { setMids(new Set()) }, [course])
  const [count, setCount] = useState(15)
  const [essay, setEssay] = useState(true)
  const [excludePrev, setExcludePrev] = useState(true)
  const [busy, setBusy] = useState('')
  const [made, setMade] = useState<{ st: Student; wsId: string; n: number }[]>([])

  const toggleMid = (id: string) => setMids(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleUnit = (all: string[]) => setMids(p => {
    const n = new Set(p); const on = all.every(m => n.has(m))
    for (const m of all) { if (on) n.delete(m); else n.add(m) }
    return n
  })

  // 학생별 후보 — 교과서 · 범위 · 형태 · 이전 출제 제외
  const prevOf = useMemo(() => {
    const m = new Map<string, Set<string>>()
    const wsById = new Map(worksheets.map(w => [w.id, w]))
    for (const a of assignments) {
      const w = wsById.get(a.worksheetId); if (!w) continue
      if (!m.has(a.studentId)) m.set(a.studentId, new Set())
      for (const id of w.problemIds) m.get(a.studentId)!.add(id)
    }
    return m
  }, [worksheets, assignments])
  const rows = useMemo(() => students.map(st => {
    const inRange = mids.size ? pool.filter(p => [...mids].some(m => p.typeId.startsWith(`${m}s`))) : pool
    const byKind = essay ? inRange : inRange.filter(p => p.kind === '객관식')
    const byBook = filterByEngBook(byKind, st.engBook)
    const prev = prevOf.get(st.id)
    const cands = excludePrev && prev ? byBook.filter(p => !prev.has(p.id)) : byBook
    return { st, cands, will: Math.min(count, cands.length) }
  }), [students, pool, mids, essay, excludePrev, prevOf, count])

  // 오늘 이미 나간 수업 연계 테스트 (이 반)
  const todays = useMemo(() => {
    const ids = new Set(students.map(s => s.id))
    return worksheets
      .filter(w => !w.deletedAt && (w.tags ?? []).includes('수업연계') && dateKey(w.createdAt) === today)
      .map(w => {
        const a = assignments.find(x => x.worksheetId === w.id && ids.has(x.studentId))
        const st = a && students.find(s => s.id === a.studentId)
        const g = a && gradings.find(x => x.worksheetId === w.id && x.studentId === a.studentId)
        return st ? { w, st, right: g ? g.results.filter(r => r.correct).length : null, total: g ? g.results.length : w.problemIds.length } : null
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.st.name.localeCompare(b.st.name, 'ko'))
  }, [worksheets, assignments, gradings, students, today])

  async function make() {
    setBusy('만드는 중…')
    const out: { st: Student; wsId: string; n: number }[] = []
    for (const r of rows) {
      if (!r.will) continue
      const picks = pickSpread(r.cands, count, `${today}|${r.st.id}|${course}`)
      const id = uid('ws')
      saveWorksheet({
        id, title: `영어 수업 테스트 - ${r.st.name} (${today.slice(5).replace('-', '.')})`,
        author: brand, grade: gradeKey(r.st.grade) || r.st.grade, subject: '영어',
        tags: ['수업연계', '영어 테스트'], theme: 'pine',
        problemIds: picks.map(p => p.id), conceptIds: [],
        options: { ...DEFAULT_SHEET_OPTIONS, autoGrade: true },
        listIds: [], createdAt: new Date().toISOString(), deletedAt: null,
      })
      addAssignment(id, [r.st.id], '수업')
      out.push({ st: r.st, wsId: id, n: picks.length })
    }
    setMade(out); setBusy('')
  }

  const noBook = rows.filter(r => !r.st.engBook).length
  const short = rows.filter(r => r.will < count).length
  const total = rows.reduce((a, r) => a + r.will, 0)

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-black">📝 {label} 수업 연계 테스트</h1>
        <span className="text-sm text-ink2">{students.length}명</span>
      </div>
      <p className="mb-4 text-sm text-ink2">
        수업이 끝나면 여기서 바로 냅니다. 학생마다 <b className="text-ink">자기 교과서(학생 정보 › 영어 교과서) 문항만</b> 나가고,
        학생이 앱에서 풀면 자동채점돼 <Link to="/today" className="font-bold text-pine underline">오늘 교실</Link>에 오답 수가 올라옵니다 — 그 학생부터 부르세요.
        단어테스트는 <b className="text-ink">영단어 현황</b> 탭에서 매일 따로 봅니다.
      </p>

      <div className="mb-4 grid gap-3 rounded-2xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2"><span className="font-semibold">과정</span>
            <select value={course} onChange={e => setCourse(e.target.value)} className="rounded-lg border border-line px-2 py-1.5">
              {COURSES.map(([id, g]) => <option key={id} value={id}>{g} 영어</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2"><span className="font-semibold">문항 수</span>
            <select value={count} onChange={e => setCount(Number(e.target.value))} className="rounded-lg border border-line px-2 py-1.5">
              {COUNTS.map(n => <option key={n} value={n}>{n}문항</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={essay} onChange={e => setEssay(e.target.checked)} className="accent-pine" />서술형 포함</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={excludePrev} onChange={e => setExcludePrev(e.target.checked)} className="accent-pine" />전에 나간 문항 제외</label>
          <span className="text-xs text-ink2">{loaded ? `문제은행 ${pool.length.toLocaleString()}문항` : '문제은행 불러오는 중…'}</span>
        </div>
        <div>
          <div className="mb-1 text-xs font-bold text-ink2">범위 — 오늘 수업한 것에 맞춰 고르세요 (아무것도 안 고르면 전체)</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {cur.units.map(u => {
              const all = u.mids.map(m => m.id)
              const on = all.length > 0 && all.every(m => mids.has(m))
              const some = all.some(m => mids.has(m))
              return (
                <div key={u.id} className={`rounded-xl border p-2.5 ${some ? 'border-pine bg-pine-soft/30' : 'border-line'}`}>
                  <button onClick={() => toggleUnit(all)} className={`text-sm font-black ${on ? 'text-pine-dark' : 'text-ink'}`}>
                    {on ? '☑' : some ? '◪' : '☐'} {u.name}
                  </button>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {u.mids.map(m => (
                      <button key={m.id} onClick={() => toggleMid(m.id)}
                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          mids.has(m.id) ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink2 hover:border-pine'}`}>
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mb-3 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-paper2 text-left text-xs text-ink2">
            <tr><th className="px-3 py-2">학생</th><th className="px-3 py-2">영어 교과서</th><th className="px-3 py-2 text-right">낼 수 있는 문항</th><th className="px-3 py-2 text-right">나갈 문항</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.st.id} className="border-t border-line">
                <td className="px-3 py-2 font-bold">{r.st.name} <span className="text-xs font-normal text-ink2">{r.st.grade}</span></td>
                <td className="px-3 py-2">{r.st.engBook
                  ? <span className="rounded bg-pine-soft px-1.5 py-0.5 text-xs font-bold text-pine-dark">{r.st.engBook}</span>
                  : <span className="text-xs font-bold text-clay">미지정 — 전체 교과서에서 나감</span>}</td>
                <td className="px-3 py-2 text-right text-ink2">{loaded ? r.cands.length.toLocaleString() : '…'}</td>
                <td className={`px-3 py-2 text-right font-black ${r.will < count ? 'text-clay' : 'text-ink'}`}>{loaded ? r.will : '…'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {noBook > 0 && (
        <p className="mb-2 text-xs text-clay">교과서가 안 적힌 학생 {noBook}명 — 관리 › 학생 정보에서 영어 교과서를 넣으면 내신 문항만 나갑니다.</p>
      )}
      {short > 0 && loaded && <p className="mb-2 text-xs text-ink2">{short}명은 이 범위에 문항이 모자라 있는 만큼만 나갑니다.</p>}

      <button onClick={make} disabled={!loaded || !!busy || total === 0}
        className="mb-6 rounded-xl bg-pine px-5 py-3 text-sm font-black text-paper hover:brightness-110 disabled:opacity-40">
        {busy || `${rows.filter(r => r.will > 0).length}명에게 테스트 내기 (총 ${total}문항)`}
      </button>

      {made.length > 0 && (
        <div className="mb-6 rounded-2xl border border-pine/40 bg-pine-soft/40 p-4">
          <div className="mb-1 text-sm font-black text-pine-dark">✓ {made.length}명에게 나갔습니다</div>
          <p className="mb-2 text-xs text-ink2">학생앱 › 학습지에 바로 뜹니다. 종이로 주려면 각 학습지를 열어 인쇄하세요.</p>
          <div className="flex flex-wrap gap-1.5">
            {made.map(m => (
              <Link key={m.wsId} to={`/worksheet/${m.wsId}`} className="rounded-full border border-pine bg-white px-3 py-1 text-xs font-bold text-pine hover:bg-pine-soft">
                {m.st.name} {m.n}문항 ↗
              </Link>
            ))}
          </div>
        </div>
      )}

      {todays.length > 0 && (
        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="mb-2 text-sm font-black">오늘 나간 수업 연계 테스트 {todays.length}장</div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {todays.map(t => (
              <div key={t.w.id} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                <b>{t.st.name}</b>
                <span className="text-xs text-ink2">{t.w.problemIds.length}문항</span>
                <div className="grow" />
                {t.right == null
                  ? <span className="text-xs text-ink2">아직 안 풂</span>
                  : <span className={`text-xs font-black ${t.total - t.right > 0 ? 'text-clay' : 'text-pine'}`}>✕ {t.total - t.right} · ○ {t.right}</span>}
                <Link to={`/worksheet/${t.w.id}`} className="text-xs font-bold text-pine hover:underline">열기 ↗</Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
