import { useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import { typeName } from '../../data/curriculum'
import MathText, { isImageUrl } from '../MathText'

// ── AI 1차 채점 승인 큐 (선생님) — 전역 플로팅 뱃지 + 패널 ──────────
// 학생앱 제출 중 자동채점 불가 문항(서술형·이미지정답·과학)을 AI가 1차 판정(pending 'teacher')하면
// 여기 쌓인다. 선생님은 풀이 이미지 + AI 판정·근거를 보고 [승인]/[○ 정답]/[✕ 오답]으로 확정한다.
// 확정 시 results 갱신(pending 해제·approvedAt) → 실시간 동기화로 학생·학부모·리포트 자동 반영.
export default function AiApprovalPanel() {
  const { gradings, worksheets, students, problems, upsertGrading } = useStore()
  const [open, setOpen] = useState(false)
  // 🔴 점수·첨삭 입력을 upsertGrading 에 직접 물리면 글자 하나마다 전역 저장 + 목록 전체
  //    재계산 + 실시간 동기화가 돈다. 확정을 누를 때만 커밋한다. 키 = `${gId}#${rIdx}`
  const [draft, setDraft] = useState<Record<string, { score?: number; feedback?: string }>>({})
  const [drawer, setDrawer] = useState<string | null>(null)
  // 선생님이 판정하려면 문제와 모범답안이 보여야 한다. 학습지 문항은 problems 에 있다.
  // (해당 과정이 아직 안 불러와졌으면 못 찾을 수 있다 — 그때는 학생 답만 보여준다)
  const probOf = useMemo(() => new Map(problems.map(p => [p.id, p])), [problems])

  // 승인 대기 행: grading × result (pending인 것만)
  const rows = useMemo(() => {
    const nameOf = new Map(students.map(s => [s.id, s.name]))
    const wsOf = new Map(worksheets.map(w => [w.id, w.title]))
    const out: {
      gId: string; rIdx: number; student: string; wsTitle: string; date: string
      r: import('../../types').GradeResult
    }[] = []
    for (const g of gradings) {
      if (g.source !== '학습지' || !g.results.some(r => r.pending)) continue
      g.results.forEach((r, i) => {
        if (!r.pending) return
        out.push({
          gId: g.id, rIdx: i,
          student: nameOf.get(g.studentId) ?? g.studentId,
          wsTitle: (g.worksheetId && wsOf.get(g.worksheetId)) || g.title || '학습지',
          date: g.date, r,
        })
      })
    }
    return out.sort((a, b) => b.date.localeCompare(a.date))
  }, [gradings, worksheets, students])

  if (rows.length === 0) return null

  // 확정: correct 지정, pending 제거, approvedAt 기록
  // 🔴 unknown 도 반드시 지운다 — AI 판정이 없어 '모름'으로 들어온 문항을 선생님이 ○/✕ 로
  //    확정했는데 unknown 이 남아 있으면 통계에서 계속 '모름'으로 세어진다 (2026-08-07 발견)
  // 🔴 score 도 같이 맞춘다 — 안 그러면 선생님이 AI 의 ○ 를 ✕ 로 뒤집었을 때
  //    correct:false 인데 score:만점 인 모순 기록이 남는다.
  //    mode: 'keep'=AI 점수 유지 · 'full'=만점 · 'zero'=0점 (선생님이 직접 넣은 값이 있으면 그게 우선)
  function decide(gId: string, rIdx: number, correct: boolean, mode: 'keep' | 'full' | 'zero') {
    const g = gradings.find(x => x.id === gId)
    if (!g) return
    const key = `${gId}#${rIdx}`
    const d = draft[key]
    const at = new Date().toISOString()
    const results = g.results.map((r, i) => {
      if (i !== rIdx) return r
      const next: import('../../types').GradeResult = {
        ...r, correct, unknown: undefined, pending: undefined, approvedAt: at,
      }
      if (r.maxScore != null) {
        next.score = d?.score != null ? d.score
          : mode === 'full' ? r.maxScore : mode === 'zero' ? 0 : (r.score ?? 0)
      }
      if (d?.feedback != null) { next.feedback = d.feedback; next.feedbackBy = 'teacher' }
      return next
    })
    upsertGrading({ ...g, results })
    setDraft(p => { const n = { ...p }; delete n[key]; return n })
    setDrawer(null)
  }

  // 일괄 승인 — AI 판정(신뢰도 high)만 그대로 확정
  function approveAllHigh() {
    if (!confirm('신뢰도 높음(high)인 AI 판정을 모두 승인할까요?')) return
    const byG = new Map<string, number[]>()
    for (const row of rows) {
      if (row.r.pending !== 'teacher' || !row.r.ai || row.r.ai.confidence !== 'high' || row.r.ai.verdict === null) continue
      const arr = byG.get(row.gId) ?? []
      arr.push(row.rIdx); byG.set(row.gId, arr)
    }
    for (const [gId, idxs] of byG) {
      const g = gradings.find(x => x.id === gId)
      if (!g) continue
      const at = new Date().toISOString()
      const results = g.results.map((r, i) => idxs.includes(i) && r.ai
        ? { ...r, correct: r.ai.verdict === true, unknown: undefined, pending: undefined, approvedAt: at }
        : r)
      upsertGrading({ ...g, results })
    }
  }

  const CONF_LABEL = { high: '높음', mid: '보통', low: '낮음' } as const

  return (
    <>
      {/* 플로팅 뱃지 (우하단) */}
      <button onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg hover:brightness-110">
        🤖 AI 채점 승인 <span className="rounded-full bg-white/25 px-2">{rows.length}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => setOpen(false)}>
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-line p-4">
              <h2 className="text-base font-black">🤖 AI 1차 채점 승인 <span className="text-sm font-semibold text-ink2">— {rows.length}문항 대기</span></h2>
              <div className="grow" />
              <button onClick={approveAllHigh}
                className="rounded-lg border border-violet-300 px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-50">
                신뢰도 높음 일괄 승인
              </button>
              <button onClick={() => setOpen(false)} className="rounded-lg px-2 py-0.5 text-lg text-ink2 hover:bg-paper2">✕</button>
            </div>
            <div className="min-h-0 grow overflow-y-auto p-4">
              <div className="grid gap-3">
                {rows.map(({ gId, rIdx, student, wsTitle, date, r }) => (
                  <div key={`${gId}#${rIdx}`} className="rounded-2xl border border-line p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                      <b>{student}</b>
                      <span className="text-ink2">· {wsTitle}</span>
                      <span className="text-xs text-ink2">{date.slice(5, 10)}</span>
                      {r.typeId && <span className="rounded bg-paper2 px-1.5 py-0.5 text-[10px] text-ink2">{typeName(r.typeId)}</span>}
                      <div className="grow" />
                      {r.pending === 'ai' ? (
                        <span className="rounded bg-paper2 px-2 py-0.5 text-xs font-bold text-ink2">AI 판정 중…</span>
                      ) : r.ai ? (
                        <span className={`rounded px-2 py-0.5 text-xs font-bold ${
                          r.ai.verdict === true ? 'bg-pine-soft text-pine-dark'
                            : r.ai.verdict === false ? 'bg-red-50 text-clay' : 'bg-amber-soft text-amber'}`}>
                          AI: {r.ai.verdict === true ? '○ 정답' : r.ai.verdict === false ? '✕ 오답' : '판정 불가'} · 신뢰도 {CONF_LABEL[r.ai.confidence]}
                        </span>
                      ) : (
                        <span className="rounded bg-amber-soft px-2 py-0.5 text-xs font-bold text-amber">AI 실패 — 직접 채점</span>
                      )}
                    </div>
                    {/* 문제 + 모범답안 — 선생님이 대조해서 판정할 수 있게 */}
                    {(() => {
                      const p = r.itemId ? probOf.get(r.itemId) : undefined
                      if (!p) return null
                      const ans = (p.answer ?? '').trim()
                      return (
                        <div className="mb-2 grid gap-1.5 rounded-xl bg-paper2/50 p-3">
                          {p.imageUrl
                            ? <img src={p.imageUrl} alt="문제" className="max-h-40 w-auto max-w-full rounded-lg" />
                            : p.body && <div className="text-sm leading-relaxed"><MathText text={p.body} /></div>}
                          {!!ans && !['.', '-'].includes(ans) && (
                            <div className="flex items-start gap-2 text-sm">
                              <span className="shrink-0 pt-0.5 text-[11px] font-bold text-ink2">모범답안</span>
                              {isImageUrl(ans)
                                ? <img src={ans} alt="모범답안" className="max-h-32 w-auto max-w-full rounded-lg bg-white p-1"
                                    /* 못 불러온 이미지는 깨진 아이콘 대신 줄째로 숨긴다 */
                                    onError={e => { (e.currentTarget.parentElement as HTMLElement | null)?.style.setProperty('display', 'none') }} />
                                : <span className="min-w-0 break-words"><MathText text={ans} /></span>}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <div className="min-w-0">
                        {r.workImg
                          ? <img src={r.workImg} alt="학생 풀이" className="max-h-56 w-auto max-w-full rounded-xl border border-line" />
                          : <div className="rounded-xl bg-paper2/60 px-3 py-2 text-xs text-ink2">풀이 이미지 없음 — 제출한 답: <b>{r.studentAnswer || '—'}</b></div>}
                        {r.ai?.reason && <p className="mt-2 text-xs leading-relaxed text-ink2">{r.ai.reason}</p>}

                        {/* ✍️ 부분점수 — 점수가 있는 문항에만. 옛 기록은 이 줄이 안 나온다 */}
                        {r.maxScore != null && (() => {
                          const key = `${gId}#${rIdx}`
                          const d = draft[key]
                          const cur = d?.score ?? r.score ?? 0
                          const set = (v: number) => setDraft(p => ({ ...p, [key]: { ...p[key], score: Math.max(0, Math.min(r.maxScore!, v)) } }))
                          return (
                            <div className="mt-2">
                              <button onClick={() => setDrawer(drawer === key ? null : key)}
                                className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-bold hover:border-pine">
                                {cur} / {r.maxScore}점 {drawer === key ? '▴' : '▾'}
                                {d && <span className="ml-1 text-pine">•</span>}
                              </button>
                              {drawer === key && (
                                <div className="mt-2 grid gap-2 rounded-xl border border-line bg-white p-3">
                                  {!!r.criteria?.length && (
                                    <div className="grid gap-1">
                                      {r.criteria.map((c, k) => (
                                        <div key={k} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                                          <span className="shrink-0 font-bold text-ink2">{c.got}/{c.weight}</span>
                                          <span className="text-ink2">{c.text}</span>
                                        </div>
                                      ))}
                                      <div className="text-[10px] text-ink2">🤖 AI 가 만든 기준 — 점수는 아래에서 고칠 수 있어요</div>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => set(cur - 1)}
                                      className="h-7 w-7 rounded-lg border border-line font-bold hover:bg-paper2">−</button>
                                    <b className="w-16 text-center text-sm">{cur} / {r.maxScore}</b>
                                    <button onClick={() => set(cur + 1)}
                                      className="h-7 w-7 rounded-lg border border-line font-bold hover:bg-paper2">+</button>
                                  </div>
                                  <textarea rows={4} defaultValue={r.feedback ?? ''}
                                    onChange={e => setDraft(p => ({ ...p, [key]: { ...p[key], feedback: e.target.value } }))}
                                    placeholder="학생에게 보여줄 첨삭 — 고치면 '선생님 첨삭'으로 표시됩니다"
                                    className="w-full resize-none rounded-lg border border-line px-2.5 py-2 text-xs leading-relaxed outline-none focus:border-pine" />
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                      <div className="flex flex-row gap-1.5 sm:flex-col">
                        {r.ai && r.ai.verdict !== null && r.pending === 'teacher' && (
                          <button onClick={() => decide(gId, rIdx, r.ai!.verdict === true, 'keep')}
                            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:brightness-110">
                            ✓ AI대로 승인
                          </button>
                        )}
                        <button onClick={() => decide(gId, rIdx, true, 'full')}
                          className="rounded-lg border border-pine px-3 py-2 text-xs font-bold text-pine hover:bg-pine-soft">○ 정답</button>
                        <button onClick={() => decide(gId, rIdx, false, 'zero')}
                          className="rounded-lg border border-clay px-3 py-2 text-xs font-bold text-clay hover:bg-red-50">✕ 오답</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
