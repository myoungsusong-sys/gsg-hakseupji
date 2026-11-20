import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SUPABASE_ON } from '../../lib/supabase'
import { useStore } from '../../lib/store'
import { dateKey, krDateLabel, nextClassDate } from '../../lib/dates'
import { clearParentSession, fetchChildRemote, getParentSession, matchChildLocal, type ChildBundle } from '../../lib/parent'
import { isNowBlock, planForBlock, SUBJECT_CLS, todayDayLabel } from '../../lib/timetable'
import { todayKey } from '../../lib/dates'
import { BrandLogo } from '../../components/BrandMark'
import { typeName } from '../../data/curriculum'

function scoreOfDate(bundle: ChildBundle, key: string) {
  let solved = 0, correct = 0, unknown = 0, pending = 0
  for (const g of bundle.gradings) {
    if (dateKey(g.date) !== key) continue
    for (const r of g.results) {
      // 🔴 선생님 승인 대기는 아직 채점이 안 끝난 것 — 정답률 분자·분모 어디에도 넣지 않는다.
      //    넣으면 AI 호출이 실패한 날(correct=false 로 저장) 아이 정답률이 실제보다 낮게 보인다 (2026-08-13).
      if (r.pending) { pending++; continue }
      solved++; if (r.correct) correct++; else if (r.unknown) unknown++
    }
  }
  return { solved, correct, unknown, pending, score: solved ? Math.round(correct / solved * 100) : null }
}

// 주(월요일 시작) 단위 집계 — 이번 주부터 거꾸로 n주. 승인 대기(pending) 문항은 세지 않는다.
function weeklyStats(bundle: ChildBundle, weeks = 4) {
  const now = new Date()
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const out: { label: string; from: Date; solved: number; correct: number; rate: number | null }[] = []
  for (let w = weeks - 1; w >= 0; w--) {
    const from = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() - 7 * w)
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7)
    let solved = 0, correct = 0
    for (const g of bundle.gradings) {
      const t = new Date(g.date).getTime()
      if (!(t >= from.getTime() && t < to.getTime())) continue
      for (const r of g.results) { if (r.pending) continue; solved++; if (r.correct) correct++ }
    }
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 1)
    out.push({
      label: w === 0 ? '이번 주' : `${from.getMonth() + 1}/${from.getDate()}~${end.getMonth() + 1}/${end.getDate()}`,
      from, solved, correct, rate: solved ? Math.round(correct / solved * 100) : null,
    })
  }
  return out
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
          : matchChildLocal(store.students, store.dailyNotes, store.gradings, store.academyProfile.academyName ?? '', sess.name, sess.phone, store.ttChecks, store.lecturePlans, store.pointEntries,
              { assignments: store.assignments, worksheets: store.worksheets, savedReports: store.savedReports, notices: store.academyProfile.notices })
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
            <BrandLogo />
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
        <Allowance bundle={bundle} />

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

            <MoreCards bundle={bundle} />

            {/* 이번 주 푼 문제 + 최근 4주 (주별 문제 수 막대 · 정답률) */}
            {(() => {
              const wk = weeklyStats(bundle)
              const cur = wk[wk.length - 1]
              const max = Math.max(1, ...wk.map(w => w.solved))
              return (
                <div className="mt-5 rounded-2xl border border-line bg-white p-5">
                  <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                    <div>
                      <div className="text-sm font-bold">이번 주 푼 문제</div>
                      <div className="mt-1 text-2xl font-black text-pine-dark tabular-nums">{cur.solved}<span className="ml-1 text-sm font-bold text-ink2">문제</span></div>
                    </div>
                    <div>
                      <div className="text-xs text-ink2">정답률</div>
                      <div className="mt-1 text-2xl font-black tabular-nums">{cur.rate != null ? `${cur.rate}%` : '—'}</div>
                    </div>
                    <p className="grow text-right text-xs text-ink2">채점될 때마다 바뀌고, 월요일에 새로 셉니다.</p>
                  </div>
                  <div className="mt-4 text-xs font-bold text-ink2">최근 4주</div>
                  <div className="mt-2 grid grid-cols-4 items-end gap-3" style={{ height: '7.5rem' }}>
                    {wk.map((w, i) => (
                      <div key={i} className="flex h-full flex-col items-center justify-end gap-1">
                        <span className="text-xs font-bold tabular-nums">{w.solved > 0 ? `${w.solved}문제` : '—'}</span>
                        <div className={`w-full max-w-16 rounded-t-lg ${i === wk.length - 1 ? 'bg-pine' : 'bg-pine-soft'}`}
                          style={{ height: `${Math.max(w.solved > 0 ? 6 : 2, Math.round(w.solved / max * 100) * 0.62)}%` }} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-1.5 grid grid-cols-4 gap-3 text-center text-[11px] text-ink2">
                    {wk.map((w, i) => (
                      <div key={i}>
                        <div className="font-bold text-ink">{w.rate != null ? `정답률 ${w.rate}%` : '기록 없음'}</div>
                        <div>{w.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

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

        <p className="mt-6 text-center text-xs text-ink2">문의는 학원으로 연락 주세요. · Summit On 학부모앱</p>
      </main>
    </div>
  )
}

// 학원 공지 · 숙제 목록 · 보고서 · 유형별 성취도 · 서술형 결과 (2026-11-20)
function MoreCards({ bundle }: { bundle: ChildBundle }) {
  const [openNotice, setOpenNotice] = useState<string | null>(null)
  const notices = (bundle.notices ?? []).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  const homework = bundle.homework ?? []
  const reports = (bundle.reports ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8)
  // 숙제 채점 상태 — 그 학습지의 최신 채점
  const stateOf = (wsId: string, count: number) => {
    let latest: ChildBundle['gradings'][number] | undefined
    for (const g of bundle.gradings) if (g.worksheetId === wsId && (!latest || g.date > latest.date)) latest = g
    if (!latest || latest.results.length === 0) return { label: '아직 안 함', cls: 'bg-paper2 text-ink2' }
    const ok = latest.results.filter(r => r.correct).length
    if (latest.results.length < count) return { label: `푸는 중 ${latest.results.length}/${count}`, cls: 'bg-amber-soft text-amber' }
    return { label: `${Math.round(ok / latest.results.length * 100)}점`, cls: 'bg-pine-soft text-pine-dark' }
  }
  // 유형별 성취도 — 채점 기록의 유형별 정답률(3문제 이상 푼 유형만). 약한 순 5개 · 잘하는 순 5개
  const types = useMemo(() => {
    const m = new Map<string, [number, number]>()
    for (const g of bundle.gradings) for (const r of g.results) {
      if (!r.typeId || r.pending) continue
      const v = m.get(r.typeId) ?? [0, 0]; v[1]++; if (r.correct) v[0]++; m.set(r.typeId, v)
    }
    const rows = [...m].filter(([, v]) => v[1] >= 3).map(([id, v]) => ({ id, name: typeName(id), n: v[1], rate: Math.round(v[0] / v[1] * 100) }))
      .filter(x => x.name && x.name !== x.id)
    return { weak: rows.slice().sort((a, b) => a.rate - b.rate || b.n - a.n).slice(0, 5), strong: rows.slice().sort((a, b) => b.rate - a.rate || b.n - a.n).slice(0, 5), total: rows.length }
  }, [bundle.gradings])
  // 서술형 결과 — 점수가 매겨지고 확정된 문항(최근 6개)
  const essays = useMemo(() => {
    const out: { date: string; score: number; max: number; feedback?: string; type: string }[] = []
    for (const g of bundle.gradings) for (const r of g.results) {
      if (r.score == null || r.maxScore == null || r.pending) continue
      out.push({ date: g.date, score: r.score, max: r.maxScore, feedback: r.feedback, type: r.typeId ? typeName(r.typeId) : '' })
    }
    return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)
  }, [bundle.gradings])
  const card = 'mt-5 rounded-2xl border border-line bg-white p-5'
  const md = (iso: string) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}` }

  return (
    <>
      {notices.length > 0 && (
        <div className={card} data-card="notices">
          <div className="mb-2 text-sm font-bold">📢 학원 공지</div>
          <ul className="divide-y divide-line/60">
            {notices.map(n => (
              <li key={n.id} className="py-2">
                <button onClick={() => setOpenNotice(openNotice === n.id ? null : n.id)} className="flex w-full items-center gap-2 text-left text-sm">
                  <span className="shrink-0 rounded bg-pine-soft px-1.5 py-0.5 text-[11px] font-bold text-pine-dark">{n.kind}</span>
                  <span className="min-w-0 grow truncate font-semibold">{n.title}</span>
                  <span className="shrink-0 text-xs text-ink2">{md(n.date)}</span>
                </button>
                {openNotice === n.id && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-paper2 px-3 py-2 text-sm text-ink">{n.body}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={card} data-card="homework">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-sm font-bold">📝 숙제·학습지</span><span className="text-xs text-ink2">최근 두 달</span>
        </div>
        {homework.length === 0 ? <p className="py-2 text-sm text-ink2">최근에 받은 숙제·학습지가 없습니다.</p> : (
          <ul className="divide-y divide-line/60">
            {homework.slice(0, 10).map(h => {
              const s = stateOf(h.worksheetId, h.count)
              return (
                <li key={h.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="w-10 shrink-0 text-xs text-ink2">{md(h.date)}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${h.kind === '숙제' ? 'bg-amber-soft text-amber' : 'bg-paper2 text-ink2'}`}>{h.kind}</span>
                  <span className="min-w-0 grow truncate">{h.title} <span className="text-xs text-ink2">{h.count}문제</span></span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${s.cls}`}>{s.label}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {reports.length > 0 && (
        <div className={card} data-card="reports">
          <div className="mb-2 text-sm font-bold">📑 보고서</div>
          <ul className="divide-y divide-line/60">
            {reports.map(r => (
              <li key={r.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="shrink-0 rounded bg-paper2 px-1.5 py-0.5 text-[11px] font-bold text-ink2">{r.kind === 'daily' ? '일일' : r.kind === 'monthly' ? '월간' : '유형분석'}</span>
                <span className="min-w-0 grow truncate font-semibold">{r.name}</span>
                <span className="shrink-0 text-xs text-ink2">{r.period}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink2">일일 보고는 위 날짜를 눌러 내용을 볼 수 있어요. 월간·유형분석 보고서 원본은 선생님께 요청해 주세요.</p>
        </div>
      )}

      {types.total > 0 && (
        <div className={card} data-card="types">
          <div className="mb-2 flex items-baseline gap-2"><span className="text-sm font-bold">🎯 유형별 성취도</span><span className="text-xs text-ink2">3문제 이상 푼 유형 {types.total}개</span></div>
          <div className="grid gap-4 sm:grid-cols-2">
            {([['더 연습할 유형', types.weak, 'bg-clay'], ['잘하는 유형', types.strong, 'bg-pine']] as const).map(([title, list, bar]) => (
              <div key={title}>
                <div className="mb-1.5 text-xs font-bold text-ink2">{title}</div>
                <ul className="grid gap-1.5">
                  {list.map(t => (
                    <li key={t.id} className="text-xs">
                      <div className="flex items-baseline gap-2"><span className="min-w-0 grow truncate">{t.name}</span><b className="tabular-nums">{t.rate}%</b><span className="text-ink2">{t.n}문제</span></div>
                      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-paper2"><div className={`h-full rounded-full ${bar}`} style={{ width: `${t.rate}%` }} /></div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {essays.length > 0 && (
        <div className={card} data-card="essays">
          <div className="mb-2 text-sm font-bold">✍️ 서술형 결과</div>
          <ul className="divide-y divide-line/60">
            {essays.map((e, i) => (
              <li key={i} className="py-2 text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="w-10 shrink-0 text-xs text-ink2">{md(e.date)}</span>
                  <span className="min-w-0 grow truncate">{e.type || '서술형 문항'}</span>
                  <b className="tabular-nums text-pine-dark">{e.score} / {e.max}점</b>
                </div>
                {e.feedback && <p className="mt-1 whitespace-pre-wrap rounded-lg bg-paper2 px-3 py-2 text-xs text-ink">{e.feedback}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
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

// 💝 용돈 보태기 — 실제 송금이 아니라 월말 정산에 합산되는 약속 기록(금액 상한 없음)
function Allowance({ bundle }: { bundle: ChildBundle }) {
  const store = useStore()
  const [amount, setAmount] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const month = todayKey().slice(0, 7)
  const mine = (bundle.pointEntries ?? []).filter(e => e.kind === 'parent' && e.date.slice(0, 7) === month)
  const sent = mine.reduce((a, e) => a + e.amount, 0)

  async function send() {
    const n = Math.floor(Number(amount) || 0)
    if (n <= 0) { setErr('금액을 입력해 주세요.'); return }
    if (!confirm(`${bundle.student.name} 학생에게 ${n.toLocaleString('ko-KR')}원을 보탤까요?\n\n(앱에는 약속으로 기록되고, 실제 전달은 월말 정산 때 이루어집니다)`)) return
    setBusy(true); setErr(null)
    try {
      const sess = getParentSession()
      if (SUPABASE_ON) {
        const r = await fetch('/api/parent-allowance', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: sess?.name, phone: sess?.phone, amount: n, message: msg }),
        })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || '전송 실패')
      } else {
        store.addPointEntry({
          studentId: bundle.student.id, date: todayKey(), amount: n,
          reason: msg.trim() || '부모님 응원 용돈', kind: 'parent', by: '학부모',
        })
      }
      setDone(`${n.toLocaleString('ko-KR')}원을 보탰어요 💝`)
      setAmount(''); setMsg('')
    } catch (e: any) {
      setErr(e?.message || '전송 실패')
    } finally { setBusy(false) }
  }

  return (
    <div className="mb-4 rounded-2xl border border-line bg-white p-5">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <span className="font-black">💝 용돈 보태기</span>
        <span className="text-xs text-ink2">공부한 만큼 쌓이는 자녀 저금통에 보탤 수 있어요 (월말 정산)</span>
        {sent > 0 && <><div className="grow" /><span className="text-sm font-black text-amber">이번 달 {sent.toLocaleString('ko-KR')}원</span></>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {[5000, 10000, 30000].map(v => (
          <button key={v} onClick={() => setAmount(String(v))}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-bold text-ink2 hover:border-pine">
            {v.toLocaleString('ko-KR')}원
          </button>
        ))}
        <input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="직접 입력"
          className="w-28 rounded-lg border border-line px-3 py-1.5 text-sm" />
        <input value={msg} onChange={e => setMsg(e.target.value)} placeholder="응원 한마디 (선택)" maxLength={60}
          className="w-0 min-w-40 flex-1 rounded-lg border border-line px-3 py-1.5 text-sm" />
        <button onClick={send} disabled={busy}
          className="rounded-lg bg-amber px-4 py-1.5 text-sm font-bold text-paper disabled:opacity-40">
          {busy ? '보내는 중…' : '보태기'}
        </button>
      </div>
      {done && <p className="mt-2 text-sm font-bold text-pine-dark">{done} 자녀 앱에 바로 표시됩니다.</p>}
      {err && <p className="mt-2 text-sm font-bold text-red-600">{err}</p>}
      {mine.length > 0 && (
        <div className="mt-3 grid gap-1">
          {mine.slice(-3).reverse().map(e => (
            <div key={e.id} className="flex items-center gap-2 rounded-lg bg-amber-soft/40 px-3 py-1.5 text-sm">
              <span className="text-xs text-ink2">{e.date.slice(5)}</span>
              <span className="min-w-0 truncate">{e.reason}</span>
              <span className="ml-auto shrink-0 font-black text-amber">{e.amount.toLocaleString('ko-KR')}원</span>
            </div>
          ))}
        </div>
      )}
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
