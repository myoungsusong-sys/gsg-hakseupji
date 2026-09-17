import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore, uid } from '../../lib/store'
import { curriculumFor } from '../../data/curriculum'
import { filterByEngBook } from '../../data/engBooks'
import { gradeKey } from '../../lib/grade'
import { brandFor, DEFAULT_ACADEMY } from '../../lib/brand'
import { dayLabel, examSubjects } from '../../lib/exam'
import {
  assignedProblemIds, coursesForExamSubject, examSheetTitle, parseRange, pickCandidates, semesterOf,
  subjectGroupOfCourse, typeIdsOfMids, type RangePick,
} from '../../lib/examRange'
import { indexPool, LEVELS, pickNaesinProblems, type NaesinLevel, type NaesinSet } from '../../lib/naesin'
import { DEFAULT_SHEET_OPTIONS, type SchoolExam, type Student, type ThemeKey } from '../../types'

// ── 📝 이 범위로 출제 — 학생이 넣은 시험 과목·범위로 과목마다 학습지 1장 (2026-09-17) ─────────────
//   과정은 학년·학기·과목 이름으로 고르고, 범위 글자는 단원 이름 → 번호 → 전체 순으로 읽는다(lib/examRange.ts).
//   선생님이 칩으로 고친 뒤 [출제]. 문항은 내신관과 같은 규칙으로 뽑고(유형 고르게·난이도 섞기),
//   그 학생에게 이미 나간 문항은 뺀다. 영어는 학생 교과서 문항만. 제목이 '내신대비'라 표의 대비 학습지 수에 잡힌다.

type Row = { subject: string; courses: string[]; course: string; on: boolean; mids: string[]; how: RangePick['how'] }
const HOW: Record<RangePick['how'], string> = { name: '범위 글자에서 단원 이름을 읽었어요', number: '범위의 단원 번호로 골랐어요 — 학교 교과서 번호와 다를 수 있어요', all: '범위를 못 읽어 전체로 잡았어요' }
const THEME: Record<string, ThemeKey> = { 수학: 'amber', 과학: 'pine', 사회: 'navy', 영어: 'blue', 국어: 'coral' }

export default function ExamRangeAssign({ st, exam, onClose }: { st: Student; exam: SchoolExam; onClose: () => void }) {
  const { problems, poolLoaded, ensureCourse, worksheets, assignments, saveWorksheet, addAssignment, academyProfile } = useStore()
  const sem = semesterOf(exam)
  const [rows, setRows] = useState<Row[]>(() => examSubjects(exam).map(subject => {
    const courses = coursesForExamSubject(subject, st.grade, sem)
    const course = courses[0] ?? ''
    const pr = course ? parseRange(exam.ranges?.[subject], curriculumFor(course)) : { midIds: [], how: 'all' as const }
    return { subject, courses, course, on: courses.length > 0, mids: pr.midIds, how: pr.how }
  }))
  const [level, setLevel] = useState<NaesinLevel>('실전')
  const [count, setCount] = useState(25)
  const [kind, setKind] = useState<'숙제' | '수업'>('숙제')
  const [done, setDone] = useState<{ subject: string; wsId: string; n: number }[] | null>(null)

  const wanted = rows.filter(r => r.on && r.course).map(r => r.course)
  useEffect(() => { wanted.forEach(c => ensureCourse(c)) }, [wanted.join('|')])   // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => assignedProblemIds(st.id, worksheets, assignments), [st.id, worksheets, assignments])
  const cands = useMemo(() => rows.map(r => {
    if (!r.on || !r.course) return []
    let pool = pickCandidates(problems, typeIdsOfMids(curriculumFor(r.course), r.mids))
    if (subjectGroupOfCourse(r.course) === '영어') pool = filterByEngBook(pool, st.engBook)
    return pool.filter(p => !prev.has(p.id))
  }), [rows, problems, prev, st.engBook])

  // 🔴 표시와 출제가 같게 — 창에서 미리 뽑아 두고 [출제]는 이것을 그대로 쓴다.
  //    같은 문제 틀(쌍둥이)은 한 장에 하나라서, 틀이 적은 과목은 후보가 많아도 목표보다 적게 나온다
  //    (2026-09-17 실측: 통합사회2 400문항 = 틀 10개 × 40 → 10문항).
  const picks = useMemo(() => rows.map((r, i) => {
    if (!r.on || !r.course || !cands[i].length) return []
    const set = { typeIds: typeIdsOfMids(curriculumFor(r.course), r.mids), count, level } as NaesinSet
    return pickNaesinProblems(set, indexPool(cands[i]))
  }), [rows, cands, count, level])
  const twinsOf = (i: number) => new Set(cands[i].map(p => p.twinGroup ?? p.id)).size

  const patch = (i: number, p: Partial<Row>) => setRows(rs => rs.map((r, k) => (k === i ? { ...r, ...p } : r)))
  const setCourse = (i: number, course: string) => {
    const pr = parseRange(exam.ranges?.[rows[i].subject], curriculumFor(course))
    patch(i, { course, mids: pr.midIds, how: pr.how })
  }
  const toggleMids = (i: number, ids: string[]) => {
    const cur = new Set(rows[i].mids); const on = ids.every(id => cur.has(id))
    ids.forEach(id => (on ? cur.delete(id) : cur.add(id)))
    patch(i, { mids: [...cur] })
  }

  const loading = wanted.some(c => !poolLoaded.has(c))
  const ready = rows.map((r, i) => r.on && r.course && r.mids.length > 0 && picks[i].length > 0)
  const nReady = ready.filter(Boolean).length

  function make() {
    const brand = brandFor(academyProfile.academyName?.trim() || DEFAULT_ACADEMY, '수학')
    const out: { subject: string; wsId: string; n: number }[] = []
    rows.forEach((r, i) => {
      if (!ready[i]) return
      const cur = curriculumFor(r.course)
      const picked = picks[i]
      if (!picked.length) return
      const group = subjectGroupOfCourse(r.course)
      const id = uid('ws')
      saveWorksheet({
        id, title: examSheetTitle(exam, r.subject, cur, r.mids, st), author: brand,
        grade: gradeKey(st.grade) || st.grade, subject: group,
        tags: ['내신대비', '시험범위', level], theme: THEME[group] ?? 'pine',
        problemIds: picked.map(p => p.id), conceptIds: [],
        options: { ...DEFAULT_SHEET_OPTIONS, showTypeName: true, autoGrade: true },
        listIds: [], createdAt: new Date().toISOString(), deletedAt: null,
      })
      addAssignment(id, [st.id], kind)
      out.push({ subject: r.subject, wsId: id, n: picked.length })
    })
    setDone(out)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black">📝 {st.name} · {exam.name} — 이 범위로 출제</p>
            <p className="truncate text-xs text-ink2">{st.grade}{st.school ? ` · ${st.school}` : ''} · {exam.days.map(dayLabel).join(' → ')}</p>
          </div>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg px-2 py-1 text-ink2 hover:bg-paper2" aria-label="닫기">✕</button>
        </div>

        {done ? (
          <div className="grid gap-3 p-5">
            {done.length ? (
              <>
                <p className="text-sm font-black text-pine-dark">✓ {st.name} 학생에게 {done.length}장 출제했습니다 ({kind})</p>
                <div className="flex flex-wrap gap-1.5">
                  {done.map(d => (
                    <Link key={d.wsId} to={`/worksheet/${d.wsId}`} className="rounded-full border border-pine bg-white px-3 py-1 text-xs font-bold text-pine hover:bg-pine-soft">
                      {d.subject} {d.n}문항 ↗
                    </Link>
                  ))}
                </div>
                <p className="text-xs text-ink2">학생앱 [학습지] 탭에 바로 뜨고 자동채점됩니다. 종이로 주려면 학습지를 열어 인쇄하세요.</p>
              </>
            ) : <p className="text-sm text-clay">만들 수 있는 학습지가 없었습니다.</p>}
            <button type="button" onClick={onClose} className="justify-self-start rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper">닫기</button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 overflow-y-auto p-5">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5"><span className="font-semibold">난이도</span>
                  <select value={level} onChange={e => setLevel(e.target.value as NaesinLevel)} className="rounded-lg border border-line px-2 py-1">
                    {LEVELS.map(l => <option key={l}>{l}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1.5"><span className="font-semibold">과목당</span>
                  <select value={count} onChange={e => setCount(Number(e.target.value))} className="rounded-lg border border-line px-2 py-1">
                    {[15, 20, 25, 30].map(n => <option key={n} value={n}>{n}문항</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1.5"><span className="font-semibold">출제 종류</span>
                  <select value={kind} onChange={e => setKind(e.target.value as '숙제' | '수업')} className="rounded-lg border border-line px-2 py-1">
                    <option>숙제</option><option>수업</option>
                  </select>
                </label>
                {loading && <span className="text-xs text-ink2">문제은행 불러오는 중…</span>}
              </div>

              {rows.map((r, i) => {
                const cur = r.course ? curriculumFor(r.course) : null
                return (
                  <div key={r.subject} className={`rounded-xl border p-3 ${r.on && r.course ? 'border-line' : 'border-dashed border-line bg-paper2/40'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={r.on} disabled={!r.courses.length} onChange={e => patch(i, { on: e.target.checked })} className="accent-pine" />
                        <b>{r.subject}</b>
                      </label>
                      {r.courses.length > 0 ? (
                        <select value={r.course} onChange={e => setCourse(i, e.target.value)} className="rounded-lg border border-line px-2 py-1 text-xs">
                          {r.courses.map(c => <option key={c} value={c}>{curriculumFor(c).label}</option>)}
                        </select>
                      ) : <span className="text-xs text-ink2">이 과목은 문제은행이 없어 출제할 수 없어요</span>}
                      {exam.ranges?.[r.subject] && <span className="rounded bg-paper2 px-2 py-0.5 text-xs">학생이 적은 범위: <b>{exam.ranges[r.subject]}</b></span>}
                      <div className="grow" />
                      {r.on && r.course && (
                        <span className={`text-xs font-bold ${picks[i].length >= count ? 'text-ink' : 'text-clay'}`}>
                          {poolLoaded.has(r.course) ? `후보 ${cands[i].length.toLocaleString()}문항 → ${picks[i].length}문항` : '불러오는 중…'}
                        </span>
                      )}
                    </div>
                    {r.on && cur && (
                      <>
                        <p className="mt-1 text-[11px] text-ink2">
                          {HOW[r.how]}
                          {subjectGroupOfCourse(r.course) === '영어' && (st.engBook ? ` · 교과서 ${st.engBook} 문항만` : ' · 교과서 미지정(전체 교과서에서 나감)')}
                        </p>
                        {poolLoaded.has(r.course) && cands[i].length > 0 && picks[i].length < count && (
                          <p className="text-[11px] font-bold text-clay">
                            {twinsOf(i) <= picks[i].length
                              ? `이 범위는 서로 다른 문제 틀이 ${twinsOf(i)}개뿐이라 ${picks[i].length}문항만 나갑니다(같은 틀의 숫자만 바꾼 문제는 한 장에 하나).`
                              : `이 범위·난이도로는 ${picks[i].length}문항까지만 뽑힙니다. 범위를 넓히거나 난이도를 바꿔 보세요.`}
                          </p>
                        )}
                        <div className="mt-2 grid gap-1.5">
                          {cur.units.map(u => {
                            const ids = u.mids.map(m => m.id)
                            const on = ids.every(id => r.mids.includes(id)); const some = ids.some(id => r.mids.includes(id))
                            return (
                              <div key={u.id} className="flex flex-wrap items-center gap-1">
                                <button type="button" onClick={() => toggleMids(i, ids)}
                                  className={`rounded-md border px-2 py-0.5 text-xs font-black ${on ? 'border-pine bg-pine text-paper' : some ? 'border-pine text-pine-dark' : 'border-line text-ink2 hover:border-pine'}`}>
                                  {u.name}
                                </button>
                                {u.mids.length > 1 && u.mids.map(m => (
                                  <button key={m.id} type="button" onClick={() => toggleMids(i, [m.id])}
                                    className={`rounded-full border px-2 py-0.5 text-[11px] ${r.mids.includes(m.id) ? 'border-pine bg-pine-soft font-bold text-pine-dark' : 'border-line text-ink2 hover:border-pine'}`}>
                                    {m.name}
                                  </button>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
              <span className="text-xs text-ink2">과목마다 학습지 1장 · 전에 나간 문항 제외 · 자동채점</span>
              <div className="grow" />
              <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink2">취소</button>
              <button type="button" onClick={make} disabled={loading || nReady === 0}
                className="rounded-lg bg-pine px-4 py-2 text-sm font-black text-paper hover:brightness-110 disabled:opacity-40">
                {nReady}과목 출제하기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
