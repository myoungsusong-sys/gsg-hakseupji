import { useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import { todayKey } from '../../lib/dates'
import {
  EMPTY_SCHOOL_TT, SCHOOL_SUBJECTS, STEP_LABEL, WEEKDAYS, hasSchoolTimetable, isSkipped,
  mondayOf, reviewKey, weekDays, weekProgress, weekReview,
} from '../../lib/schoolReview'
import type { SchoolTimetable, Student } from '../../types'

// ── 🏫 학교 복습 (수업 > 학생 탭) ────────────────────────────────────────────
//
// 명수쌤 2026-08-26: "시간표를 등록할게. 그날그날 학교수업한 내용을 (수학 제외) 복습하도록.
//   당일 내용이 많으면 주말에 완료해서 그 주에 마무리. 복습은 문제풀이 후 오답작성까지."
//
// 이 화면에서 ①학교 시간표를 넣고 ②그 주 복습이 어디까지 됐는지 본다.
// 학생은 학생앱 홈의 「오늘 학교 복습」 카드에서 체크한다 — 같은 기록(reviewChecks)을 본다.

export default function SchoolReviewPanel({ student }: { student: Student }) {
  const { updateStudent, reviewChecks, toggleReviewCheck } = useStore()
  const today = todayKey()
  const [week, setWeek] = useState(() => mondayOf(today))
  const [edit, setEdit] = useState(false)

  const tt = student.schoolTimetable
  const items = useMemo(
    () => weekReview(student, week, reviewChecks, today),
    [student, week, reviewChecks, today])
  const prog = weekProgress(items)
  const late = items.filter(i => i.late)
  const days = weekDays(week)

  const card = 'rounded-2xl border border-line bg-white p-5'
  const shiftWeek = (n: number) => {
    const d = new Date(week); d.setDate(d.getDate() + n * 7)
    setWeek(mondayOf(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`))
  }

  if (!hasSchoolTimetable(tt) && !edit) {
    return (
      <div className={`${card} text-center`}>
        <div className="text-3xl">🏫</div>
        <h2 className="mt-2 font-black">학교 시간표를 넣어주세요</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink2">
          요일별로 학교에서 배우는 과목을 넣으면, <b className="text-ink">그날 배운 과목</b>이 그날의 복습 과제가 됩니다.
          한 과목은 <b className="text-ink">문제풀이 → 오답작성</b> 두 칸이고, 못 끝낸 것은 그 주 <b className="text-ink">토·일로 넘어가</b> 그 주 안에 마무리합니다.
          <br />수학은 매일 따로 하므로 <b className="text-ink">복습 목록에서 빠집니다</b>.
        </p>
        <button onClick={() => setEdit(true)}
          className="mt-4 rounded-xl bg-pine px-5 py-2.5 text-sm font-black text-paper">시간표 넣기</button>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {edit && <TimetableEditor student={student} onSave={tt2 => { updateStudent(student.id, { schoolTimetable: tt2 }); setEdit(false) }} onCancel={() => setEdit(false)} />}

      {!edit && (
        <>
          <div className={card}>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-black">🏫 학교 복습</h2>
              <div className="flex items-center gap-1 text-sm">
                <button onClick={() => shiftWeek(-1)} className="rounded-lg border border-line px-2 py-1 text-xs font-bold text-ink2">‹ 지난주</button>
                <span className="px-1 font-bold tabular-nums">{week.slice(5).replace('-', '.')} 주</span>
                <button onClick={() => shiftWeek(1)} className="rounded-lg border border-line px-2 py-1 text-xs font-bold text-ink2">다음주 ›</button>
              </div>
              <div className="grow" />
              <button onClick={() => setEdit(true)}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink2 hover:border-pine">⚙ 시간표 고치기</button>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="h-2.5 grow overflow-hidden rounded-full bg-paper2">
                <div className="h-full rounded-full bg-pine" style={{ width: `${prog.pct}%` }} />
              </div>
              <b className="shrink-0 text-sm tabular-nums">{prog.done} / {prog.total}칸 · {prog.pct}%</b>
            </div>
            {late.length > 0 && (
              <p className="mt-2 text-xs font-bold text-clay">
                ⏰ 밀린 것 {late.length}과목 — 토·일에 마무리해야 이번 주가 끝납니다
                ({[...new Set(late.map(i => i.subject))].join(' · ')})
              </p>
            )}
            {items.length === 0 && (
              <p className="mt-2 text-sm text-ink2">이 주에는 복습할 과목이 없습니다. (수학은 복습 목록에서 빠집니다)</p>
            )}
          </div>

          {days.filter(d => d.label !== '토' && d.label !== '일').map(d => {
            const rows = items.filter(i => i.date === d.key)
            if (!rows.length) return null
            return (
              <div key={d.key} className={card}>
                <div className="mb-3 flex items-baseline gap-2">
                  <b className="text-sm">{d.label}요일</b>
                  <span className="text-xs text-ink2">{d.key.slice(5).replace('-', '.')}</span>
                  {d.key === today && <span className="rounded-full bg-pine-soft px-2 py-0.5 text-[11px] font-black text-pine-dark">오늘</span>}
                  <div className="grow" />
                  <span className="text-xs font-bold text-ink2">{rows.filter(r => r.done).length} / {rows.length}과목</span>
                </div>
                <div className="grid gap-1.5">
                  {rows.map(r => (
                    <div key={r.subject}
                      className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                        r.done ? 'border-pine/40 bg-pine-soft/25' : r.late ? 'border-clay/40 bg-red-50/40' : 'border-line/70'}`}>
                      <b className={`w-24 shrink-0 ${r.done ? 'text-ink2 line-through' : ''}`}>{r.subject}</b>
                      {(['solve', 'wrong'] as const).map(step => {
                        const k = reviewKey(student.id, r.date, r.subject, step)
                        const on = step === 'solve' ? r.solve : r.wrong
                        return (
                          <button key={step} onClick={() => toggleReviewCheck(k)}
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              on ? 'bg-pine text-paper' : 'border border-line text-ink2 hover:border-pine'}`}>
                            {on ? '✓ ' : ''}{STEP_LABEL[step]}
                          </button>
                        )
                      })}
                      {r.late && !r.done && <span className="text-xs font-bold text-clay">밀림</span>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

/* ═══════════ 시간표 넣기 ═══════════ */
function TimetableEditor({ student, onSave, onCancel }: {
  student: Student
  onSave: (tt: SchoolTimetable) => void
  onCancel: () => void
}) {
  const [days, setDays] = useState<Record<string, string[]>>(() => {
    const base = { ...EMPTY_SCHOOL_TT.days }
    for (const d of WEEKDAYS) base[d] = [...(student.schoolTimetable?.days[d] ?? [])]
    return base
  })

  const toggle = (day: string, sub: string) => setDays(p => {
    const cur = p[day] ?? []
    return { ...p, [day]: cur.includes(sub) ? cur.filter(x => x !== sub) : [...cur, sub] }
  })
  const [custom, setCustom] = useState('')
  const addCustom = (day: string) => {
    const v = custom.trim()
    if (!v) return
    setDays(p => ({ ...p, [day]: [...(p[day] ?? []), v] }))
    setCustom('')
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-black">🏫 학교 시간표 넣기</h2>
        <span className="text-xs text-ink2">
          요일마다 그날 배우는 과목을 눌러 고르세요. <b className="text-ink">수학은 넣어도 복습 목록에서 빠집니다</b>(매일 따로 하니까요).
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {WEEKDAYS.map(day => (
          <div key={day} className="rounded-xl bg-paper2/60 p-3">
            <div className="mb-2 flex items-center gap-2">
              <b className="w-8 text-sm">{day}</b>
              <span className="text-xs text-ink2">
                {(days[day] ?? []).length ? (days[day] ?? []).join(' · ') : '아직 없음'}
              </span>
              {(days[day] ?? []).length > 0 && (
                <button onClick={() => setDays(p => ({ ...p, [day]: [] }))}
                  className="ml-auto text-xs font-bold text-ink2 hover:text-clay">비우기</button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SCHOOL_SUBJECTS.map(sub => {
                const on = (days[day] ?? []).includes(sub)
                return (
                  <button key={sub} type="button" onClick={() => toggle(day, sub)}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      on ? 'bg-pine text-paper' : 'border border-line bg-white text-ink2 hover:border-pine'}`}>
                    {sub}
                  </button>
                )
              })}
              {(days[day] ?? []).filter(s => !(SCHOOL_SUBJECTS as readonly string[]).includes(s)).map(s => (
                <button key={s} type="button" onClick={() => toggle(day, s)}
                  className="rounded-full bg-pine px-2.5 py-1 text-xs font-bold text-paper">{s} ✕</button>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              <input value={custom} onChange={e => setCustom(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCustom(day) }}
                placeholder="목록에 없는 과목 직접 넣기"
                className="grow rounded-lg border border-line px-2.5 py-1 text-xs" />
              <button onClick={() => addCustom(day)}
                className="rounded-lg border border-line px-3 py-1 text-xs font-bold text-ink2">＋ {day}에 추가</button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-ink2">
        같은 과목이 하루에 두 번 있어도 복습은 한 번만 나옵니다.
        {' '}못 끝낸 과목은 <b className="text-ink">그 주 토·일로 넘어가</b> 일요일까지가 마감입니다.
      </p>

      <div className="mt-4 flex gap-2">
        <button onClick={onCancel} className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-ink2">취소</button>
        <button onClick={() => onSave({ days, updatedAt: new Date().toISOString() })}
          className="rounded-xl bg-pine px-5 py-2.5 text-sm font-black text-paper">저장</button>
        <span className="self-center text-xs text-ink2">
          {WEEKDAYS.reduce((n, d) => n + (days[d] ?? []).filter(s => !isSkipped(s)).length, 0)}과목 (수학 제외)
        </span>
      </div>
    </div>
  )
}
