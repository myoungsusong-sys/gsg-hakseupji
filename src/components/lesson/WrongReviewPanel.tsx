import { useEffect, useMemo, useState } from 'react'
import type { Problem, Student } from '../../types'
import { useStore } from '../../lib/store'
import { dateKey } from '../../lib/dates'
import { reportGradings } from '../../lib/reportFeed'
import { coursesForWorksheet, courseIdOfType, typeName, stripCountTag } from '../../data/curriculum'
import { problemCoursesOf } from '../../data/problemCourses'
import ProblemContent from '../ProblemContent'
import MathText from '../MathText'

// ❌ 틀린 문제 — 2026-11-26 명수쌤 «학생들이 풀다가 틀리면 선생님앱에 틀린문제와 정답해설을 선생님이 볼 수 있게.
//    선생님이 학생을 불러서 설명할 때 미리 한번 보고 하면 수월하니까»
//    학습지(선생님 채점·학생 제출·자동 채점)와 승강제에서 틀리거나 «모름»인 문항을 최근 순으로 모아
//    문제 원문 · 학생 답 · 정답 · 해설을 한 화면에 보여 준다.

const PERIODS: [number, string][] = [[1, '오늘'], [3, '3일'], [7, '7일'], [30, '30일']]

type Row = { key: string; at: string; title: string; problemId?: string; typeId?: string; studentAnswer?: string; unknown?: boolean; courses: string[] }

export default function WrongReviewPanel({ student }: { student: Student }) {
  const { gradings, masteries, worksheets, problems, ensureCourse } = useStore()
  const [days, setDays] = useState(7)
  const [showSol, setShowSol] = useState(true)

  const rows = useMemo(() => {
    const since = Date.now() - days * 86400000
    const out: Row[] = []
    const seen = new Set<string>()
    const all = reportGradings(gradings.filter(g => g.studentId === student.id), masteries, student.id)
    for (const g of all) {
      if (g.source === '교재') continue                               // 교재 문항은 원문이 문제은행에 없다
      const ws = g.worksheetId ? worksheets.find(w => w.id === g.worksheetId) : undefined
      const wsCourses = ws ? [...coursesForWorksheet(ws.grade, ws.subject ?? '수학'), ...problemCoursesOf(ws.problemIds)] : []
      g.results.forEach((r, i) => {
        if (r.correct) return
        const at = r.at ?? g.date
        if (Date.parse(at) < since) return
        const pid = r.itemId ?? ws?.problemIds[i]
        const k = `${pid ?? g.id + i}`
        if (seen.has(k)) return                                         // 같은 문항을 여러 번 틀려도 한 번만(가장 최근)
        seen.add(k)
        const typeCourse = r.typeId ? courseIdOfType(r.typeId) : ''
        out.push({
          key: `${g.id}|${i}`, at, title: ws?.title ?? g.title ?? '학습지', problemId: pid, typeId: r.typeId,
          studentAnswer: r.studentAnswer, unknown: r.unknown,
          courses: [...new Set([...wsCourses, ...(typeCourse ? [typeCourse] : [])])],
        })
      })
    }
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80)
  }, [gradings, masteries, worksheets, student.id, days])

  const need = useMemo(() => [...new Set(rows.flatMap(r => r.courses))].filter(Boolean), [rows])
  useEffect(() => { need.forEach(c => ensureCourse(c)) }, [need.join('|')])   // eslint-disable-line react-hooks/exhaustive-deps
  const byId = useMemo(() => {
    const want = new Set(rows.map(r => r.problemId).filter(Boolean) as string[])
    const m = new Map<string, Problem>()
    for (const p of problems) if (want.has(p.id)) m.set(p.id, p)
    return m
  }, [problems, rows])

  let lastDay = ''
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-black">❌ {student.name} — 틀린 문제</h2>
        <span className="text-sm text-ink2">{rows.length}문항</span>
        <div className="grow" />
        {PERIODS.map(([d, l]) => (
          <button key={d} type="button" onClick={() => setDays(d)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${days === d ? 'bg-pine text-paper' : 'border border-line text-ink2 hover:bg-paper2'}`}>{l}</button>
        ))}
        <label className="ml-2 flex items-center gap-1 text-xs font-bold text-ink2">
          <input type="checkbox" checked={showSol} onChange={e => setShowSol(e.target.checked)} className="accent-pine" /> 해설 펼치기
        </label>
      </div>
      <p className="mb-4 text-xs text-ink2">학습지(선생님 채점·학생 제출)와 승강제에서 틀렸거나 «모름»으로 고른 문항입니다. 학생을 불러 설명하기 전에 정답과 해설을 미리 보세요.</p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink2">이 기간에 틀린 문제가 없습니다.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map(r => {
            const p = r.problemId ? byId.get(r.problemId) : undefined
            const day = dateKey(new Date(r.at))
            const head = day !== lastDay ? (lastDay = day, <div className="mt-2 text-xs font-black text-ink2">{day}</div>) : null
            return (
              <div key={r.key}>
                {head}
                <div className="rounded-xl border border-line p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-paper2 px-2 py-0.5 font-bold">{r.title}</span>
                    {(p?.typeId ?? r.typeId) && <span className="text-ink2">{stripCountTag(typeName(p?.typeId ?? r.typeId ?? ''))}</span>}
                    <div className="grow" />
                    <span className={`rounded-full px-2 py-0.5 font-bold ${r.unknown ? 'bg-amber-soft text-amber' : 'bg-clay/10 text-clay'}`}>{r.unknown ? '모름' : '틀림'}</span>
                  </div>
                  {p ? (
                    <>
                      <ProblemContent p={p} />
                      <div className="mt-3 flex flex-wrap gap-4 rounded-lg bg-paper2 px-3 py-2 text-sm">
                        <span>학생 답: <b className="text-clay">{r.studentAnswer?.trim() || (r.unknown ? '모름' : '—')}</b></span>
                        <span>정답: <b className="text-pine-dark">{/^https?:/.test(p.answer ?? '') ? '해설 그림 참고' : (p.answer || '—')}</b></span>
                      </div>
                      {showSol && p.solution && (
                        <div className="mt-3 border-t border-line/40 pt-2">
                          <div className="mb-1 text-xs font-black text-ink2">해설</div>
                          {/^https?:/.test(p.solution)
                            ? <img src={p.solution} alt="해설" loading="lazy" className="w-full max-w-[465px]" />
                            : <MathText text={p.solution} className="text-[13px] leading-relaxed" />}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-ink2">{r.problemId ? '문제를 불러오는 중…' : '문제 원문이 없는 기록입니다.'}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
