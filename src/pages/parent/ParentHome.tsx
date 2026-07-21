import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SUPABASE_ON } from '../../lib/supabase'
import { useStore } from '../../lib/store'
import { dateKey, krDateLabel, nextClassDate } from '../../lib/dates'
import { clearParentSession, fetchChildRemote, getParentSession, matchChildLocal, type ChildBundle } from '../../lib/parent'
import { isNowBlock, planForBlock, SUBJECT_CLS, todayDayLabel } from '../../lib/timetable'
import { todayKey } from '../../lib/dates'

function scoreOfDate(bundle: ChildBundle, key: string) {
  let solved = 0, correct = 0, unknown = 0
  for (const g of bundle.gradings) {
    if (dateKey(g.date) !== key) continue
    for (const r of g.results) { solved++; if (r.correct) correct++; else if (r.unknown) unknown++ }
  }
  return { solved, correct, unknown, score: solved ? Math.round(correct / solved * 100) : null }
}

export default function ParentHome() {
  const nav = useNavigate()
  const store = useStore()
  const [bundle, setBundle] = useState<ChildBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [date, setDate] = useState<string | null>(null)

  useEffect(() => {
    const sess = getParentSession()
    if (!sess) { nav('/parent-login', { replace: true }); return }
    let alive = true
    ;(async () => {
      try {
        const b = SUPABASE_ON
          ? await fetchChildRemote(sess.name, sess.phone)
          : matchChildLocal(store.students, store.dailyNotes, store.gradings, store.academyProfile.academyName ?? '', sess.name, sess.phone, store.ttChecks, store.lecturePlans)
        if (!b) throw new Error('자녀 정보를 찾을 수 없습니다. 다시 로그인해 주세요.')
        if (alive) { setBundle(b); setLoading(false) }
      } catch (e: any) {
        if (alive) { setErr(e?.message || '조회 실패'); setLoading(false) }
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.synced])

  // 기록 있는 날짜(보고서·채점) 목록 — 최신순
  const dates = useMemo(() => {
    if (!bundle) return []
    const s = new Set<string>()
    for (const n of bundle.dailyNotes) s.add(n.date)
    for (const g of bundle.gradings) s.add(dateKey(g.date))
    return [...s].sort().reverse()
  }, [bundle])
  const cur = date ?? dates[0] ?? null

  function logout() { clearParentSession(); nav('/parent-login', { replace: true }) }

  if (loading) return <Center>불러오는 중…</Center>
  if (err || !bundle) return (
    <Center>
      <p className="mb-3 font-bold">{err ?? '오류'}</p>
      <button onClick={logout} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-paper2">다시 로그인</button>
    </Center>
  )

  const st = bundle.student
  const note = cur ? bundle.dailyNotes.find(n => n.date === cur) : undefined
  const stat = cur ? scoreOfDate(bundle, cur) : { solved: 0, correct: 0, unknown: 0, score: null }
  const next = cur ? (note?.makeupDate || nextClassDate(cur, st.classDays)) : null

  return (
    <div className="min-h-screen bg-paper2">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black tracking-tight text-pine-dark">깊은생각</span>
            <span className="text-lg font-light text-ink">학습지</span>
          </div>
          <span className="rounded-full bg-pine-soft px-2 py-0.5 text-xs font-bold text-pine-dark">학부모</span>
          <div className="grow" />
          <button onClick={logout} className="text-sm font-semibold text-ink2 hover:text-pine">로그아웃</button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-5">
        <div className="mb-4 flex items-center gap-2">
          <h1 className="text-xl font-black">{st.name}</h1>
          <span className="text-sm text-ink2">{st.grade}{st.klass ? ` · ${st.klass}` : ''}</span>
          {bundle.academyName && <><div className="grow" /><span className="text-sm font-bold text-ink2">{bundle.academyName}</span></>}
        </div>

        <TodayTimetable bundle={bundle} />

        {dates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center text-sm text-ink2">
            아직 등록된 학습 보고가 없습니다. 수업이 진행되면 이곳에 매일의 보고서가 올라옵니다.
          </div>
        ) : (
          <>
            {/* 날짜 선택 */}
            <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
              {dates.slice(0, 14).map(d => (
                <button key={d} onClick={() => setDate(d)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold transition ${d === cur ? 'bg-pine text-paper' : 'border border-line bg-white text-ink2 hover:border-pine'}`}>
                  {krDateLabel(d)}
                </button>
              ))}
            </div>

            {/* 보고서 카드 */}
            <div className="overflow-hidden rounded-2xl border border-line bg-white">
              <div className="bg-gradient-to-br from-pine to-pine-dark px-5 py-4 text-paper">
                <div className="text-sm opacity-90">{cur && krDateLabel(cur)} 학습 보고</div>
                <div className="mt-0.5 text-lg font-black">{st.name} 학생</div>
              </div>

              <div className="grid gap-3 p-5">
                {(note?.checkIn || note?.checkOut) && (
                  <div className="flex gap-4 rounded-xl bg-paper2/60 px-4 py-2.5 text-sm">
                    <span>🟢 등원 <b>{note?.checkIn || '—'}</b></span>
                    <span>🔴 하원 <b>{note?.checkOut || '—'}</b></span>
                  </div>
                )}

                {/* 스탯 타일 */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Tile label="푼 문제" value={`${stat.solved}`} />
                  <Tile label="정답" value={`${stat.correct}`} />
                  <Tile label="점수" value={stat.score != null ? `${stat.score}점` : '—'} highlight />
                </div>

                {note?.comment && (
                  <div className="rounded-xl bg-amber-soft/50 px-4 py-3 text-sm leading-relaxed">
                    <b className="text-amber">📝 선생님 한마디</b>
                    <p className="mt-1 whitespace-pre-wrap text-ink">{note.comment}</p>
                  </div>
                )}
                {note?.nextPlan && (
                  <div className="rounded-xl bg-pine-soft/40 px-4 py-3 text-sm">
                    <b className="text-pine-dark">📌 다음 학습</b> <span className="text-ink">{note.nextPlan}</span>
                  </div>
                )}
                {next && (
                  <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm">
                    <b className="text-blue-700">📅 다음 수업{note?.makeupDate ? '(보강)' : ''}</b> <span className="text-ink">{krDateLabel(next)}</span>
                  </div>
                )}
                {stat.solved === 0 && !note?.comment && (
                  <p className="py-2 text-center text-sm text-ink2">이 날은 채점 기록이 없습니다.</p>
                )}
              </div>
            </div>

            {/* 최근 학습 추이 (정답률) */}
            <div className="mt-5 rounded-2xl border border-line bg-white p-5">
              <div className="mb-3 text-sm font-bold">최근 학습 추이 (정답률)</div>
              <div className="grid gap-1.5">
                {dates.slice(0, 10).map(d => {
                  const s = scoreOfDate(bundle, d)
                  return (
                    <div key={d} className="flex items-center gap-2 text-xs">
                      <span className="w-24 shrink-0 text-ink2">{krDateLabel(d)}</span>
                      <div className="h-3 grow overflow-hidden rounded-full bg-paper2">
                        {s.score != null && <div className="h-full rounded-full bg-pine" style={{ width: `${s.score}%` }} />}
                      </div>
                      <span className="w-16 shrink-0 text-right font-bold tabular-nums">{s.score != null ? `${s.score}점` : '—'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        <p className="mt-6 text-center text-xs text-ink2">문의는 학원으로 연락 주세요. · 깊은생각 학습지 학부모앱</p>
      </main>
    </div>
  )
}

// 오늘 시간표 + 완료율 — 학원에서 짠 시간표와 자녀가 체크한 진행 상황(읽기 전용)
function TodayTimetable({ bundle }: { bundle: ChildBundle }) {
  const today = todayKey()
  const blocks = bundle.student.timetable?.blocks?.[todayDayLabel()] ?? []
  if (blocks.length === 0) return null

  const checks = bundle.ttChecks ?? {}
  const doneCount = blocks.filter((_, i) => checks[`${bundle.student.id}|${today}|${i}`]).length
  const pct = Math.round((doneCount / blocks.length) * 100)

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <span className="font-black">📅 오늘 시간표</span>
        <span className="text-xs text-ink2">({todayDayLabel()}요일)</span>
        <div className="grow" />
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${pct === 100 ? 'bg-pine text-paper' : 'bg-pine-soft text-pine-dark'}`}>
          {doneCount} / {blocks.length} 완료 · {pct}%
        </span>
      </div>
      <div className="h-1.5 bg-paper2">
        <div className="h-full bg-pine transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="grid gap-1.5 p-4">
        {blocks.map((b, i) => {
          const done = !!checks[`${bundle.student.id}|${today}|${i}`]
          const now = isNowBlock(b)
          const plan = planForBlock(b, today, bundle.lecturePlans ?? [], bundle.student.id)
          return (
            <div key={i}
              className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                done ? 'border-pine/40 bg-pine-soft/25' : now ? 'border-pine bg-pine-soft/50' : 'border-line/60'}`}>
              <span className={`shrink-0 text-xs font-black tabular-nums ${done ? 'text-ink2 line-through' : ''}`}>{b.start}~{b.end}</span>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${SUBJECT_CLS[b.subject] ?? SUBJECT_CLS.기타}`}>{b.subject}</span>
              <span className={`min-w-0 truncate font-semibold ${done ? 'text-ink2 line-through' : ''}`}>
                {b.kind === '인강' ? '🎧 ' : '📗 '}{b.title}
              </span>
              {b.makeup && <span className="shrink-0 rounded bg-amber-soft px-1.5 py-0.5 text-[11px] font-bold text-amber">🔁 보충</span>}
              {plan && (
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${plan.behind ? 'bg-red-100 text-red-800' : 'bg-paper2 text-ink2'}`}>
                  {plan.behind ? '⚠ ' : '📖 '}{plan.text}
                </span>
              )}
              {done
                ? <span className="ml-auto shrink-0 text-xs font-black text-pine">✓ 완료</span>
                : now && <span className="ml-auto shrink-0 rounded-full bg-pine px-2 py-0.5 text-[10px] font-black text-paper">진행 중</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Tile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-2 py-3 ${highlight ? 'bg-pine text-paper' : 'bg-paper2/70 text-ink'}`}>
      <div className={`text-lg font-black ${highlight ? '' : 'text-pine-dark'}`}>{value}</div>
      <div className={`text-[11px] ${highlight ? 'opacity-90' : 'text-ink2'}`}>{label}</div>
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center text-ink2">{children}</div>
}
