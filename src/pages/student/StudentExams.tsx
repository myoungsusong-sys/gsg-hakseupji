import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStudentSelf, usePreview, PREVIEW_LOCK_TITLE } from './common'
import { useStore } from '../../lib/store'
import { todayKey } from '../../lib/dates'
import { dDayLabel, dayLabel, examPhase, examState, examTasks, examsOfStudent, examStart } from '../../lib/exam'
import ExamForm from '../../components/ExamForm'
import type { SchoolExam } from '../../types'

// ── 🏫 내 학교 시험 일정 (학생앱) — 학생이 직접 넣고 고친다 ─────────────────────
//   명수쌤 2026-09-17: "학생들 시험일정을 올리면 거기에 맞게 준비할 수 있도록 · 학생들이 입력하게 해줘"
//   저장하면 학습 홈 「🏫 학교 시험」 카드에 D-day 와 오늘 할 대비 과제가 뜨고, 선생님 내신 대비 화면에도 잡힌다.

export default function StudentExams() {
  const me = useStudentSelf()
  const pv = usePreview()
  const { schoolExams, saveSchoolExam, removeSchoolExam } = useStore()
  const today = todayKey()
  const mine = examsOfStudent(schoolExams, me.id)
    .sort((a, b) => examStart(b).localeCompare(examStart(a)))
  const upcoming = mine.filter(e => examState(e, today).state !== 'past').sort((a, b) => examStart(a).localeCompare(examStart(b)))
  const past = mine.filter(e => examState(e, today).state === 'past')
  const [editing, setEditing] = useState<SchoolExam | 'new' | null>(upcoming.length ? null : 'new')

  const lock = pv.on ? { disabled: true, title: PREVIEW_LOCK_TITLE } : {}

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-black">🏫 내 학교 시험 일정</h1>
        <Link to="/student" className="text-sm font-bold text-pine hover:underline">← 학습 홈</Link>
        <div className="grow" />
        {editing === null && (
          <button {...lock} onClick={() => setEditing('new')} className="rounded-lg bg-pine px-4 py-2 text-sm font-black text-paper disabled:opacity-40">
            ＋ 시험 일정 추가
          </button>
        )}
      </div>
      <p className="text-sm text-ink2">
        학교 시험 날짜와 그날 보는 과목을 넣어 두면 <b className="text-ink">D-day에 맞춰 무엇을 해야 하는지</b> 학습 홈에 나오고, 선생님도 같은 일정을 보고 준비해 줍니다.
        범위는 알게 되면 나중에 고쳐도 돼요.
      </p>

      {editing !== null && (
        <section className="rounded-2xl border border-pine/40 bg-white p-5">
          <div className="mb-3 text-sm font-black text-pine-dark">{editing === 'new' ? '새 시험 일정' : `${editing.name} 고치기`}</div>
          <ExamForm key={editing === 'new' ? 'new' : editing.id} studentId={me.id} by="student"
            initial={editing === 'new' ? undefined : editing}
            onSave={e => { if (pv.on) return; saveSchoolExam(e); setEditing(null) }}
            onCancel={upcoming.length || editing !== 'new' ? () => setEditing(null) : undefined}
            onDelete={editing !== 'new' ? () => { if (pv.on) return; removeSchoolExam(editing.id); setEditing(null) } : undefined} />
        </section>
      )}

      {upcoming.map(e => {
        const { dDay, state } = examState(e, today)
        const phase = examPhase(e, today)
        const tasks = examTasks(e, today)
        return (
          <section key={e.id} className="rounded-2xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className={`rounded-full px-2.5 py-1 text-sm font-black ${state === 'during' ? 'bg-clay text-white' : dDay <= 7 ? 'bg-amber-soft text-amber' : 'bg-pine-soft text-pine-dark'}`}>{dDayLabel(dDay)}</span>
              <b className="text-base">{e.name}</b>
              <span className="text-xs text-ink2">{phase.label}</span>
              <div className="grow" />
              <button {...lock} onClick={() => setEditing(e)} className="text-xs font-bold text-pine hover:underline disabled:opacity-40">고치기</button>
            </div>
            <ul className="mt-2 grid gap-0.5 text-sm">
              {e.days.map(d => <li key={d.date}>📅 {dayLabel(d)}</li>)}
            </ul>
            {Object.keys(e.ranges ?? {}).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {Object.entries(e.ranges!).map(([s, r]) => <span key={s} className="rounded bg-paper2 px-2 py-0.5"><b>{s}</b> {r}</span>)}
              </div>
            )}
            {e.memo && <p className="mt-1 text-xs text-ink2">메모: {e.memo}</p>}
            <div className="mt-3 rounded-xl bg-paper2/60 p-3">
              <div className="text-xs font-black text-ink">지금 시기 — {phase.label}</div>
              <p className="text-xs text-ink2">{phase.hint}</p>
              <ul className="mt-1.5 grid gap-1 text-sm">
                {tasks.map((t, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    <b className="w-16 shrink-0 truncate">{t.subject}</b><span className="min-w-0 grow">{t.text}</span>
                    {t.link && <Link to={t.link} className="text-xs font-bold text-pine hover:underline">{t.linkLabel} →</Link>}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )
      })}

      {past.length > 0 && (
        <section className="rounded-2xl border border-line bg-paper2/40 p-4">
          <div className="mb-1 text-xs font-black text-ink2">지난 시험</div>
          <ul className="grid gap-0.5 text-sm text-ink2">
            {past.map(e => <li key={e.id}>{e.name} · {e.days.map(dayLabel).join(' → ')}</li>)}
          </ul>
        </section>
      )}
    </div>
  )
}
