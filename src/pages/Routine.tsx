import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { todayKey, weekdayOf } from '../lib/dates'
import { isTeacherAccountEmail, teacherByEmail } from '../lib/role'
import {
  autoStatus, ROUTINE_WHENS, routineCheckKey, routineItemsFor, routineKeyOf, routineProgress, type RoutineCtx, type RoutineItem,
} from '../lib/routine'

// ── ✅ 오늘 할 일 — 선생님 하루 루틴 체크리스트 ──────────────────────────────────
//
// 명수쌤 2026-09-15: "박성우 선생님은 뭘 어떻게 진행해야 하는지 모르고 학생이 올 때까지 기다리기만 해!
//   이러면 우리 학원 망해 ㅜ 체크리스트를 만들어줘!"
//
//   · 강사 계정은 로그인하면 **이 화면부터** 본다. 위에서 아래로 그대로 하면 된다.
//   · 항목마다 [열기]가 그 화면으로 간다. 기록으로 아는 것은 기록으로 확인한다(호출 몇 명·채점 몇/몇).
//   · 원장은 아래 「강사별 오늘 진행」에서 누가 안 하고 있는지 숫자로 본다.
//   항목 정의·자동 확인 규칙은 lib/routine.ts 한 곳에만 있다.

const md = (day: string) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일 (${weekdayOf(day)})`

export default function Routine() {
  const { students, worksheets, gradings, dailyNotes, teachers, routineChecks, setRoutineCheck, academyProfile, schoolExams, assignments } = useStore()
  const { email } = useAuth()
  const today = todayKey()
  const me = teacherByEmail(teachers, email)
  const myKey = routineKeyOf(teachers, email)
  const isOwner = !isTeacherAccountEmail(email)
  const myName = me?.name ?? (isOwner ? (academyProfile.teacherName?.trim() || '원장') : '선생님')
  const ctx: RoutineCtx = useMemo(
    () => ({ today, students, worksheets, gradings, dailyNotes, routineChecks, schoolExams, assignments }),
    [today, students, worksheets, gradings, dailyNotes, routineChecks, schoolExams, assignments])
  const items = useMemo(() => routineItemsFor(me), [me])
  const prog = routineProgress(myKey, items, ctx)
  const callsOf = (key: string) => Object.keys(routineChecks).filter(k => k.startsWith(`${key}|${today}|call|`)).length

  // 원장용 — 강사별 오늘 진행. 강사 명부에 없는 강사 계정의 기록은 이메일로 보인다.
  const teacherRows = useMemo(() => {
    if (!isOwner) return []
    const rows = teachers.filter(t => t.active).map(t => {
      const its = routineItemsFor(t)
      const p = routineProgress(t.id, its, ctx)
      return { key: t.id, name: t.name, subjects: (t.subjects ?? []).join('·'), linked: !!(t.loginId || t.loginEmail), ...p, calls: callsOf(t.id) }
    })
    const known = new Set(['owner', ...teachers.map(t => t.id)])
    const strangers = [...new Set(Object.keys(routineChecks).map(k => k.split('|')[0]))].filter(k => k.includes('@') && !known.has(k))
    for (const k of strangers) {
      const p = routineProgress(k, routineItemsFor(undefined), ctx)
      rows.push({ key: k, name: k, subjects: '명부에 없는 계정', linked: false, ...p, calls: callsOf(k) })
    }
    return rows.sort((a, b) => a.done / a.total - b.done / b.total || a.name.localeCompare(b.name, 'ko'))
  }, [isOwner, teachers, ctx, routineChecks])   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-1 flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-black">✅ 오늘 할 일</h1>
        <span className="text-sm text-ink2">{myName} 선생님 · {md(today)}</span>
        <div className="grow" />
        <span className={`text-sm font-black ${prog.done === prog.total ? 'text-pine' : 'text-ink'}`}>
          {prog.done} / {prog.total} 완료
        </span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-paper2">
        <div className="h-full rounded-full bg-pine transition-all" style={{ width: `${prog.total ? Math.round(prog.done / prog.total * 100) : 0}%` }} />
      </div>

      <div className="mb-5 rounded-2xl border border-clay/40 bg-red-50 px-5 py-4">
        <div className="text-base font-black text-clay">학생이 오기를 기다리지 마세요.</div>
        <p className="mt-1 text-sm text-ink">
          학생은 스스로 질문하러 오지 않습니다. <b>30분마다</b> <Link to="/today" className="font-bold text-pine underline">오늘 교실</Link>을 보고,
          앱이 위에 올려 준 학생부터 <b>선생님이 먼저 불러서</b> 설명합니다. 이게 이 학원의 수업 방식입니다.
        </p>
      </div>

      {ROUTINE_WHENS.map(when => {
        const list = items.filter(it => it.when === when)
        if (!list.length) return null
        return (
          <section key={when} className="mb-5">
            <h2 className="mb-2 text-sm font-black text-ink2">{when}</h2>
            <div className="grid gap-2">
              {list.map(it => <Row key={it.id} it={it} teacherKey={myKey} ctx={ctx} onToggle={setRoutineCheck} />)}
            </div>
          </section>
        )
      })}

      <p className="mb-8 text-xs text-ink2">
        체크는 강사별·날짜별로 저장됩니다. 「기록으로 확인」이 붙은 항목은 실제 기록(호출·채점·한마디)이 있어야 완료로 잡힙니다.
        {isOwner && ' 강사에게는 로그인하면 이 화면이 먼저 뜹니다.'}
      </p>

      {isOwner && (
        <section className="rounded-2xl border border-line bg-white p-4">
          <div className="mb-1 text-sm font-black">🗂 강사별 오늘 진행</div>
          <p className="mb-3 text-xs text-ink2">
            강사가 오늘 체크한 것과 기록으로 확인된 것을 합쳐 셉니다. 「먼저 부르기」는 오늘 교실에서 [호출]을 누른 수입니다.
            강사 계정이 강사 명부와 연결돼 있어야 이름으로 보입니다(관리 › 강사 › 아이디/로그인 이메일).
          </p>
          {teacherRows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink2">
              등록된 강사가 없습니다. 관리 › 강사에서 강사를 등록하고 아이디를 연결하세요.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-paper2 text-left text-xs text-ink2">
                  <tr>
                    <th className="px-3 py-2">강사</th><th className="px-3 py-2">담당</th>
                    <th className="px-3 py-2">오늘 진행</th><th className="px-3 py-2">먼저 부르기</th><th className="px-3 py-2">안 한 것</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherRows.map(r => (
                    <tr key={r.key} className="border-t border-line align-top">
                      <td className="px-3 py-2 font-black">
                        {r.name}
                        {!r.linked && <div className="text-[11px] font-normal text-clay">계정 미연결 — 체크가 안 잡힙니다</div>}
                      </td>
                      <td className="px-3 py-2 text-xs text-ink2">{r.subjects || '—'}</td>
                      <td className="px-3 py-2">
                        <b className={r.done === r.total ? 'text-pine' : r.done === 0 ? 'text-clay' : 'text-ink'}>{r.done}</b> / {r.total}
                      </td>
                      <td className={`px-3 py-2 font-bold ${r.calls ? 'text-pine' : 'text-clay'}`}>{r.calls}명</td>
                      <td className="px-3 py-2 text-xs text-ink2">
                        {r.undone.length ? r.undone.slice(0, 4).map(u => u.label.split(' ').slice(0, 3).join(' ')).join(' · ') + (r.undone.length > 4 ? ` 외 ${r.undone.length - 4}` : '') : '전부 완료 ✓'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function Row({ it, teacherKey, ctx, onToggle }: {
  it: RoutineItem; teacherKey: string; ctx: RoutineCtx; onToggle: (key: string, on: boolean) => void
}) {
  const key = routineCheckKey(teacherKey, ctx.today, it.id)
  const manual = !!ctx.routineChecks[key]
  const auto = autoStatus(it, teacherKey, ctx)
  const done = manual || !!auto.done
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 ${done ? 'border-pine/40 bg-pine-soft/40' : 'border-line bg-white'}`}>
      <input type="checkbox" checked={done} disabled={!!auto.done}
        onChange={e => onToggle(key, e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-pine" aria-label={it.label} />
      <div className="min-w-0 grow">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={`font-bold ${done ? 'text-pine-dark line-through decoration-pine/50' : 'text-ink'}`}>{it.label}</span>
          {it.repeat && <span className="rounded bg-amber-soft px-1.5 py-0.5 text-[11px] font-bold text-amber">{it.repeat}</span>}
          {auto.done && <span className="rounded bg-pine-soft px-1.5 py-0.5 text-[11px] font-bold text-pine-dark">기록으로 확인</span>}
        </div>
        <div className="mt-0.5 text-xs text-ink2">{it.why}</div>
        {auto.note && (
          <div className={`mt-1 text-xs font-bold ${auto.done ? 'text-pine-dark' : 'text-clay'}`}>{auto.note}</div>
        )}
      </div>
      {it.link && (
        <Link to={it.link} onClick={e => e.stopPropagation()}
          className="shrink-0 self-center rounded-lg border border-pine px-3 py-1.5 text-xs font-bold text-pine hover:bg-pine-soft"
          title={it.linkLabel}>
          열기 →
        </Link>
      )}
    </label>
  )
}
