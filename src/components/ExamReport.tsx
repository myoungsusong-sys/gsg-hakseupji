import { useMemo } from 'react'
import type { Assignment, Grading, Student, Worksheet } from '../types'

/* 🏁 시험 성적표 — 「시험으로 출제」한 학습지 한 장의 결과를 한 화면에.
   · 요약: 응시/미응시 · 평균 · 최고 · 최저 · 만점자
   · 학생별: 등수(동점은 같은 등수, 다음 등수는 건너뛴다) · 점수 · ○/✕/모름 · 제출 시각
   · 문항별 정답률: 낮은 것부터 — 다음 수업에서 다시 짚을 문항을 고르는 자리다
   점수 규약은 학생앱 summaryOf 와 같다: 맞은 문항 ÷ 전체 문항 × 100 (반올림).
   ⚠️ 부분점수(서술형 score)는 여기서 세지 않는다 — correct(만점)만 정답으로 센다. */

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function ExamReport({ ws, students, assignments, gradings, onClose }: {
  ws: Worksheet
  students: Student[]
  assignments: Assignment[]
  gradings: Grading[]
  onClose: () => void
}) {
  const exam = assignments.find(a => a.worksheetId === ws.id && a.exam)?.exam

  const { rows, absent, stat, hard } = useMemo(() => {
    // 이 시험을 받은 학생 (시험으로 출제된 배정 기준, 없으면 이 학습지 배정 전체)
    const examIds = assignments.filter(a => a.worksheetId === ws.id && a.kind === '시험').map(a => a.studentId)
    const targetIds = new Set(examIds.length ? examIds : assignments.filter(a => a.worksheetId === ws.id).map(a => a.studentId))

    // 학생별 최신 채점 1건
    const latest = new Map<string, Grading>()
    for (const g of gradings) {
      if (g.source !== '학습지' || g.worksheetId !== ws.id || g.results.length === 0) continue
      const cur = latest.get(g.studentId)
      if (!cur || g.date > cur.date) latest.set(g.studentId, g)
    }

    const total = ws.problemIds.length
    const taken = [...targetIds]
      .map(id => ({ st: students.find(s => s.id === id), g: latest.get(id) }))
      .filter((x): x is { st: Student; g: Grading } => !!x.st && !!x.g)
      .map(({ st, g }) => {
        const correct = g.results.filter(r => r.correct).length
        const unknown = g.results.filter(r => r.unknown).length
        return {
          st, g, correct, unknown,
          wrong: total - correct,
          score: total > 0 ? Math.round(correct / total * 100) : 0,
        }
      })
      .sort((a, b) => b.score - a.score || a.st.name.localeCompare(b.st.name, 'ko'))

    // 등수 — 동점은 같은 등수, 다음은 건너뛴다 (1,1,3…)
    let prev = -1, prevRank = 0
    const ranked = taken.map((r, i) => {
      const rank = r.score === prev ? prevRank : i + 1
      prev = r.score; prevRank = rank
      return { ...r, rank }
    })

    const absent = [...targetIds]
      .filter(id => !latest.has(id))
      .map(id => students.find(s => s.id === id))
      .filter((s): s is Student => !!s)
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))

    const scores = ranked.map(r => r.score)
    const stat = {
      taken: ranked.length,
      target: targetIds.size,
      avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      max: scores.length ? Math.max(...scores) : 0,
      min: scores.length ? Math.min(...scores) : 0,
      perfect: scores.filter(s => s === 100).length,
      total,
    }

    // 문항별 정답률 — 분모는 **응시자 전원**이다.
    // 🔴 답을 내지 않은 문항은 results 에 아예 없다. 그것을 빼고 세면 아무도 못 푼 문항이
    //    통계에서 사라져 「가장 어려웠던 문항」이 거꾸로 나온다 — 시험에서 미응답은 오답이다.
    const okCount = new Map<string, number>()
    // itemId 는 옛 기록에 없을 수 있다 — 그 경우 results 순서 = ws.problemIds 순서로 읽는다(types.ts 규약)
    for (const r of ranked) r.g.results.forEach((res, i) => {
      const key = res.itemId ?? ws.problemIds[i]
      if (!key || !res.correct) return
      okCount.set(key, (okCount.get(key) ?? 0) + 1)
    })
    const hard = ranked.length === 0 ? [] : ws.problemIds
      .map((id, i) => {
        const ok = okCount.get(id) ?? 0
        return { no: i + 1, id, ok, n: ranked.length, rate: Math.round(ok / ranked.length * 100) }
      })
      .sort((a, b) => a.rate - b.rate || a.no - b.no)

    return { rows: ranked, absent, stat, hard }
  }, [ws, students, assignments, gradings])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl bg-white" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-black">🏁 시험 성적표</h3>
            <p className="mt-0.5 truncate text-sm font-semibold text-ink2">
              {ws.title}
              {exam && (
                <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-bold text-clay">
                  {exam.minutes ? `${exam.minutes}분` : '시간 제한 없음'}{exam.once ? ' · 1회 응시' : ''}
                </span>
              )}
            </p>
          </div>
          <div className="grow" />
          <button onClick={onClose} className="rounded-lg px-2 text-lg text-ink2 hover:bg-paper2">✕</button>
        </div>

        <div className="min-h-0 grow overflow-y-auto px-6 py-4">
          {/* 요약 */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ['응시', `${stat.taken}/${stat.target}명`],
              ['평균', `${stat.avg}점`],
              ['최고', `${stat.max}점`],
              ['최저', `${stat.min}점`],
              ['만점', `${stat.perfect}명`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line px-3 py-2 text-center">
                <div className="text-[11px] font-bold text-ink2">{k}</div>
                <div className="text-base font-black">{v}</div>
              </div>
            ))}
          </div>

          {/* 학생별 */}
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-ink2">
              아직 응시한 학생이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper2/60 text-xs text-ink2">
                    <th className="px-3 py-2">등수</th>
                    <th className="px-3 py-2 text-left">이름</th>
                    <th className="px-3 py-2">점수</th>
                    <th className="px-3 py-2">○</th>
                    <th className="px-3 py-2">✕</th>
                    <th className="px-3 py-2">모름</th>
                    <th className="px-3 py-2">제출</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.st.id} className="border-b border-line/60 last:border-0">
                      <td className="px-3 py-2 text-center font-black">
                        {r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}
                      </td>
                      <td className="px-3 py-2 font-bold">
                        {r.st.name}
                        <span className="ml-1.5 text-xs font-semibold text-ink2">{r.st.klass ?? r.st.grade}</span>
                      </td>
                      <td className="px-3 py-2 text-center text-base font-black">{r.score}</td>
                      <td className="px-3 py-2 text-center font-bold text-pine-dark">{r.correct}</td>
                      <td className="px-3 py-2 text-center font-bold text-clay">{r.wrong}</td>
                      <td className="px-3 py-2 text-center text-ink2">{r.unknown || '-'}</td>
                      <td className="px-3 py-2 text-center text-xs text-ink2">{fmtTime(r.g.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 미응시 */}
          {absent.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber/40 bg-amber-soft/40 px-3 py-2.5 text-sm">
              <b className="text-amber">미응시 {absent.length}명</b>
              <span className="ml-2 text-ink2">{absent.map(s => s.name).join(', ')}</span>
            </div>
          )}

          {/* 문항별 정답률 — 어려웠던 순 */}
          {hard.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-sm font-black">문항별 정답률 <span className="text-xs font-semibold text-ink2">(낮은 순 — 다시 짚을 문항)</span></div>
              <div className="flex flex-wrap gap-1.5">
                {hard.map(h => (
                  <span key={h.id}
                    className={`rounded-lg px-2 py-1 text-xs font-bold ${
                      h.rate < 40 ? 'bg-red-100 text-clay' : h.rate < 70 ? 'bg-amber-soft text-amber' : 'bg-pine-soft text-pine-dark'}`}
                    title={`${h.n}명 중 ${h.ok}명 정답`}>
                    {h.no}번 {h.rate}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-line px-6 py-3">
          <button onClick={onClose} className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper">닫기</button>
        </div>
      </div>
    </div>
  )
}
