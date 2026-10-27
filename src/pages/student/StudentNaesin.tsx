import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../lib/store'
import { useStudentSelf } from './StudentShell'
import { STATUS_CLASS, statusOf, usePreview, PREVIEW_LOCK_TITLE } from './common'
import { studentCourseResults } from '../../lib/examSets'

// ── 📝 시험대비 탭 (학생앱) — 2026-10-27 명수쌤 «시험대비·수업세트 문제를 따로 탭에서 풀고 채점되게» ──
//   배정받은 시험대비·수업세트 학습지만 과정별로 모은다. 풀기·채점·결과는 학습지 탭과 같은 화면(solve/result)을 쓴다.
export default function StudentNaesin() {
  const me = useStudentSelf()
  const { assignments, worksheets, gradings } = useStore()
  const nav = useNavigate()
  const pv = usePreview()
  const results = useMemo(
    () => studentCourseResults(me, worksheets, assignments, gradings).filter(r => r.sheets.some(s => s.assigned)),
    [me, worksheets, assignments, gradings],
  )

  return (
    <div>
      <h1 className="mb-1 text-xl font-black">📝 시험대비</h1>
      <p className="mb-4 text-sm text-ink2">선생님이 내 준 시험대비·수업세트 문제예요. 답을 넣고 제출하면 바로 채점돼요.</p>

      {results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          아직 받은 시험대비 학습지가 없어요.
        </div>
      ) : (
        <div className="grid gap-4">
          {results.map(r => (
            <section key={r.course.id} className="rounded-2xl border border-line bg-white p-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-black">
                  <span className={`mr-2 rounded px-1.5 py-0.5 text-[11px] font-bold ${r.kind === '수업세트' ? 'bg-amber-soft text-amber' : 'bg-pine-soft text-pine-dark'}`}>{r.kind}</span>
                  {r.course.label.replace(/^(시험대비|수업세트) · /, '')}
                </h2>
                <span className="text-sm text-ink2">
                  {r.done}/{r.sheets.filter(s => s.assigned).length}장 완료
                  {r.answered > 0 && <> · 정답률 <b className="text-pine-dark">{Math.round(r.correct / r.answered * 100)}%</b></>}
                </span>
              </div>
              <ul className="divide-y divide-line/60">
                {r.sheets.filter(s => s.assigned).map(s => {
                  const st = statusOf(s.ws.id, s.g)
                  const done = st === '학습완료' && !!s.g
                  return (
                    <li key={s.ws.id} className="flex flex-wrap items-center gap-3 py-2.5">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS[st]}`}>{st}</span>
                      <button onClick={() => nav(done ? `/student/result/${s.ws.id}` : `/student/solve/${s.ws.id}`)}
                        disabled={pv.on} title={pv.on ? PREVIEW_LOCK_TITLE : undefined}
                        className="min-w-0 flex-1 text-left text-sm font-bold hover:text-pine hover:underline disabled:cursor-default">
                        {s.ws.title.replace(/^(내신대비|수업세트) \| /, '')}
                        <span className="ml-1.5 text-xs font-semibold text-pine">{s.total}문제</span>
                      </button>
                      {done ? (
                        <button onClick={() => nav(`/student/result/${s.ws.id}`)} disabled={pv.on}
                          className="rounded-lg border border-pine px-2.5 py-1 text-xs font-bold text-pine hover:bg-pine-soft disabled:cursor-default">
                          {s.score}점 <span className="ml-1 font-semibold text-clay">✕ {s.total - s.correct}</span> <span className="font-semibold text-pine-dark">○ {s.correct}</span>
                        </button>
                      ) : (
                        <button onClick={() => nav(`/student/solve/${s.ws.id}`)} disabled={pv.on}
                          className="rounded-lg bg-pine px-3 py-1 text-xs font-bold text-paper hover:brightness-110 disabled:opacity-40">
                          {st === '풀이중' ? '이어서 풀기' : '풀기'}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
              {r.weak.length > 0 && (
                <p className="mt-3 rounded-lg bg-paper2 px-3 py-2 text-xs text-ink2">
                  🔁 더 볼 곳: {r.weak.slice(0, 3).map(w => `${w.name} (${w.wrong}/${w.total} 틀림)`).join(' · ')}
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
