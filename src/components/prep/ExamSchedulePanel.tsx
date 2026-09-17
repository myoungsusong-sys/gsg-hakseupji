import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../../lib/store'
import { todayKey } from '../../lib/dates'
import { dDayLabel, dayLabel, examPhase, examRows } from '../../lib/exam'
import ExamForm from '../ExamForm'
import ExamRangeAssign from './ExamRangeAssign'
import type { SchoolExam, Student } from '../../types'

// ── 📅 학생 시험 일정 (수업 준비 › 내신 대비 맨 위) ──────────────────────────────
//   학생이 학생앱에서 넣은 일정을 D-day 순으로 본다. 누가 안 넣었는지, 대비 학습지가 나갔는지도.
//   선생님이 대신 넣거나 고칠 수도 있다(by: 'teacher').

export default function ExamSchedulePanel() {
  const { students, schoolExams, worksheets, assignments, saveSchoolExam, removeSchoolExam } = useStore()
  const today = todayKey()
  const [editing, setEditing] = useState<{ st: Student; exam?: SchoolExam } | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [assign, setAssign] = useState<{ st: Student; exam: SchoolExam } | null>(null)
  const rows = useMemo(() => examRows(students.filter(s => s.active), schoolExams, worksheets, assignments, today),
    [students, schoolExams, worksheets, assignments, today])
  const withExam = rows.filter(r => r.exam)
  const none = rows.filter(r => !r.exam)
  const soon = withExam.filter(r => (r.dDay ?? 99) <= 14)
  const noSheet = soon.filter(r => r.sheets === 0)

  return (
    <section className="mb-6 rounded-2xl border border-line bg-white p-5">
      <div className="mb-1 flex flex-wrap items-baseline gap-3">
        <h2 className="text-base font-black">📅 학생 시험 일정</h2>
        <span className="text-sm text-ink2">
          일정 있는 학생 <b className="text-ink">{withExam.length}명</b> · 2주 이내 <b className={soon.length ? 'text-clay' : 'text-ink'}>{soon.length}명</b>
          {soon.length > 0 && <> · 그중 대비 학습지 없음 <b className="text-clay">{noSheet.length}명</b></>}
        </span>
      </div>
      <p className="mb-3 text-xs text-ink2">
        학생이 학생앱 <b className="text-ink">학습 홈 › 🏫 학교 시험</b>에서 직접 넣습니다. 선생님도 여기서 넣거나 고칠 수 있어요.
        대비 학습지는 [📝 이 범위로 출제]나 내신관 [출제하기]로 나간 것(제목 '내신대비')을 최근 3주 기준으로 셉니다.
      </p>

      {editing && (
        <div className="mb-4 rounded-xl border border-pine/40 bg-pine-soft/20 p-4">
          <div className="mb-2 text-sm font-black text-pine-dark">{editing.st.name} — {editing.exam ? `${editing.exam.name} 고치기` : '시험 일정 넣기'}</div>
          <ExamForm key={editing.exam?.id ?? `new-${editing.st.id}`} studentId={editing.st.id} by="teacher" initial={editing.exam}
            onSave={e => { saveSchoolExam(e); setEditing(null) }} onCancel={() => setEditing(null)}
            onDelete={editing.exam ? () => { removeSchoolExam(editing.exam!.id); setEditing(null) } : undefined} />
        </div>
      )}

      {withExam.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-ink2">아직 시험 일정을 넣은 학생이 없습니다. 학생들에게 학습 홈에서 넣게 하세요.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-paper2 text-left text-xs text-ink2">
              <tr><th className="px-3 py-2">학생</th><th className="px-3 py-2">시험</th><th className="px-3 py-2">날짜 · 과목</th><th className="px-3 py-2">범위</th><th className="px-3 py-2">시기</th><th className="px-3 py-2 text-right">대비 학습지</th><th className="px-3 py-2"></th></tr>
            </thead>
            <tbody>
              {withExam.map(r => {
                const e = r.exam!
                return (
                  <tr key={r.st.id} className="border-t border-line align-top">
                    <td className="px-3 py-2"><b>{r.st.name}</b><div className="text-xs text-ink2">{r.st.grade}{r.st.school ? ` · ${r.st.school}` : ''}</div></td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-black ${r.state === 'during' ? 'bg-clay text-white' : (r.dDay ?? 99) <= 7 ? 'bg-amber-soft text-amber' : 'bg-pine-soft text-pine-dark'}`}>{dDayLabel(r.dDay ?? 0)}</span>
                      <div className="mt-0.5 font-semibold">{e.name}</div>
                      {e.by === 'teacher' && <div className="text-[11px] text-ink2">선생님 입력</div>}
                    </td>
                    <td className="px-3 py-2 text-xs">{e.days.map(d => <div key={d.date}>{dayLabel(d)}</div>)}</td>
                    <td className="max-w-[220px] px-3 py-2 text-xs text-ink2">
                      {Object.entries(e.ranges ?? {}).map(([s, v]) => <div key={s}><b className="text-ink">{s}</b> {v}</div>)}
                      {!Object.keys(e.ranges ?? {}).length && '—'}
                    </td>
                    <td className="px-3 py-2 text-xs">{examPhase(e, today).label}</td>
                    <td className={`px-3 py-2 text-right font-bold ${r.sheets === 0 && (r.dDay ?? 99) <= 14 ? 'text-clay' : 'text-ink'}`}>{r.sheets}장</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <button onClick={() => setAssign({ st: r.st, exam: e })}
                          className="whitespace-nowrap rounded-lg bg-pine px-2.5 py-1 text-xs font-bold text-paper hover:brightness-110">📝 이 범위로 출제</button>
                        <button onClick={() => setEditing({ st: r.st, exam: e })} className="text-xs font-bold text-pine hover:underline">고치기</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {none.length > 0 && (
        <div className="mt-3 text-xs text-ink2">
          <b className="text-ink">아직 안 넣은 학생 {none.length}명</b>
          {' — '}
          {(showAll ? none : none.slice(0, 12)).map(r => (
            <button key={r.st.id} onClick={() => setEditing({ st: r.st })} className="mr-1.5 underline decoration-dotted hover:text-pine" title="선생님이 대신 넣기">{r.st.name}</button>
          ))}
          {none.length > 12 && <button onClick={() => setShowAll(v => !v)} className="font-bold text-pine">{showAll ? '접기' : `외 ${none.length - 12}명`}</button>}
          <span className="ml-1">(이름을 누르면 대신 넣을 수 있어요)</span>
        </div>
      )}
      {assign && <ExamRangeAssign key={assign.exam.id} st={assign.st} exam={assign.exam} onClose={() => setAssign(null)} />}
      <p className="mt-2 text-xs text-ink2">학생이 적은 범위로 바로 내려면 행의 <b className="text-ink">📝 이 범위로 출제</b>. 단원별로 골라 내려면 아래 <b className="text-ink">내신관</b>에서 학년·범위를 골라 [출제하기]. 학교별 기출은 <Link to="/prep/school-test" className="font-bold text-pine underline">학교별 기출</Link>.</p>
    </section>
  )
}
