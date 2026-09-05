import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { GradeResult, Problem } from '../../types'
import { DIFF_LABEL } from '../../types'
import { useStore } from '../../lib/store'
import { coursesForWorksheet, typeName } from '../../data/curriculum'
import ProblemContent from '../../components/ProblemContent'
import VideoModal from '../../components/VideoModal'
import MathText from '../../components/MathText'
import { useStudentSelf } from './StudentShell'
import { latestGradingFor, statusOf, summaryOf, AnswerText, isImgAnswer, usePreview } from './common'
import { useSupplement, supplementKindOf, SUPPLEMENT_RULE_MSG, WRONG_DONE_MSG, ONE_CLICK_OFF_MSG } from './supplement'

// 자동 오답학습지 이중 발화 방어 — 같은 채점(g.id)으로는 한 세션에 한 번만 시도.
// StrictMode(dev) 마운트 2회·재마운트 때 stateRef/마커가 아직 낡아 있는 창을 막는다.
const autoDrillFired = new Set<string>()

// ── 학습지 결과 화면 (매쓰플랫 학생앱 학습완료 상세 구조) ────────
// 요약 카드 + 문항 카드 그리드(정답 연파랑/오답 연분홍) + [한문제씩] 모드(1문항 페이지 넘김
// + 문제 풀이 현황 패널 + 문항 메타: 유형명·정답률·난이도·[쌍둥이]·출처)
// 정답·해설·풀이영상 노출은 선생님 공개 설정(studentAppConfig) 따름 — 비공개면 문의 안내
export default function StudentResult() {
  const me = useStudentSelf()
  const { wsId } = useParams()
  const { worksheets, gradings, problems, ensureCourse, studentAppConfig: gcfg, assignments, upsertGrading } = useStore()
  // 학습지별 공개 설정(출제할 때 고른 것)이 있으면 그게 우선이다 — 「문제만 내보내기」
  const asgReveal = assignments.find(a => a.worksheetId === wsId && a.studentId === me.id)?.reveal
  const cfg = {
    ...gcfg,
    showAnswer: asgReveal?.answer === false ? false : gcfg.showAnswer,
    showSolution: asgReveal?.solution === false ? false : gcfg.showSolution,
    showAnswerBefore: asgReveal?.answer === false ? false : gcfg.showAnswerBefore,
    showSolutionBefore: asgReveal?.solution === false ? false : gcfg.showSolutionBefore,
  }
  const nav = useNavigate()
  const preview = usePreview()   // 선생님 미리보기에선 라우팅을 막는다
  const supplement = useSupplement(me)

  const [onlyWrong, setOnlyWrong] = useState(false)
  const [withBody, setWithBody] = useState(false)          // 문제 같이 보기 (기본 OFF — 매쓰플랫 동일)
  const [openSolution, setOpenSolution] = useState<Set<string>>(new Set())
  const [video, setVideo] = useState<{ src: string; subtitle?: string; title: string } | null>(null)
  const [single, setSingle] = useState(false)              // [한문제씩] 모드
  const [idx, setIdx] = useState(0)
  const [showStatus, setShowStatus] = useState(false)      // 문제 풀이 현황 패널

  const ws = worksheets.find(w => w.id === wsId && !w.deletedAt)
  const g = ws ? latestGradingFor(gradings, me.id, ws.id) : undefined

  useEffect(() => {
    if (ws) for (const c of coursesForWorksheet(ws.grade, ws.subject)) ensureCourse(c)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws?.grade])

  // 📘 제출 즉시 자동 오답학습지 — 학생이 방금 제출한 채점에 확정 오답이 있으면
  // 조용히 만들어 숙제로 배정한다. 발화 조건(적대 리뷰 반영, 전부 필수):
  //  · by==='student' — 학생 제출 기록만. 선생님 채점(연속 자동저장)은 절대 발화하지 않는다
  //    (선생님이 셀 단위로 채점하는 도중 학생이 결과를 열면 반쪽 데이터로 만들어지는 사고 차단).
  //  · 10분 컷오프 — "제출 직후"에만. 배포 전 옛 채점을 복습 열람만 해도 숙제가 걸리는
  //    소급 발화를 막고, build 실패 기록이 영구 재시도 무장 상태로 남는 것도 막는다.
  //  · 구성도 확정 오답만 — 가채점(pending) 오답 유형이 승인 전에 학습지로 박제되지 않게
  //    results 를 확정분으로 거른 사본을 build 에 넘긴다(트리거·구성 기준 일치).
  // 멱등 방어: g.autoDrill 마커 · 모듈 fired 가드(StrictMode/재마운트) · build 내부 pendingOf.
  useEffect(() => {
    if (!ws || !g) return
    if ((gcfg.autoDrill ?? true) === false) return   // 관리 스위치 OFF
    if (g.by !== 'student') return                   // 학생 제출 기록에만
    if (g.autoDrill) return                          // 이미 이 채점으로 생성함
    if (Date.now() - new Date(g.date).getTime() > 10 * 60_000) return   // 제출 직후에만
    if (autoDrillFired.has(g.id)) return             // 같은 세션 이중 실행(StrictMode 등) 방어
    const confirmed = { ...g, results: g.results.filter(r => !r.pending) }
    if (!confirmed.results.some(r => !r.correct)) return
    autoDrillFired.add(g.id)
    // 결정적 id — 두 기기/두 탭이 동시에 발화해도 클라우드에선 같은 행이라 드릴이 두 장 생기지 않는다
    const newId = supplement.build('오답학습', ws, confirmed, { silent: true, wsId: `ws-auto-${g.id}` })
    if (newId) upsertGrading({ ...g, autoDrill: { wsId: newId, at: new Date().toISOString() } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws?.id, g?.id])

  const items = useMemo(() => {
    if (!ws || !g) return []
    const m = new Map(problems.map(p => [p.id, p]))
    const resultOf = new Map<string, GradeResult>()
    g.results.forEach((r, i) => {
      const pid = r.itemId ?? ws.problemIds[i]   // 구버전 기록은 순서 기준
      if (pid) resultOf.set(pid, r)
    })
    return ws.problemIds.map((pid, i) => ({
      no: i + 1, p: m.get(pid), r: resultOf.get(pid),
    }))
  }, [ws, g, problems])

  if (!ws) return <Navigate to="/student/worksheets" replace />
  if (!g) return <Navigate to={`/student/solve/${ws.id}`} replace />

  const sum = summaryOf(ws, g)
  const anyOpen = cfg.showAnswer || cfg.showSolution || cfg.showVideo
  const shown = onlyWrong ? items.filter(x => !x.r?.correct) : items
  const wrongCount = g.results.filter(r => !r.correct).length
  const suppKind = supplementKindOf(ws)

  // 보충학습 생성 가드 — 진행 중(미완료) 같은 종류가 있으면 생성 불가
  const pendingWrong = supplement.pendingOf('오답학습')
  const pendingDeep = supplement.pendingOf('심화학습')
  const wrongBlocked = pendingWrong && pendingWrong.id !== ws.id
  const deepBlocked = pendingDeep && pendingDeep.id !== ws.id

  function toggleSolution(pid: string) {
    setOpenSolution(prev => { const n = new Set(prev); if (n.has(pid)) n.delete(pid); else n.add(pid); return n })
  }

  // 문항 카드 공통 본문 (내 답 · 답 · 해설 · 풀이영상 · 비공개 안내)
  function ItemBody({ no, p, r }: { no: number; p?: Problem; r?: GradeResult }) {
    const correct = !!r?.correct
    return (
      <div className="grid gap-2.5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink2">내 답 :</span>
          {r?.studentAnswer
            ? <b className={correct ? 'text-pine-dark' : 'text-clay'}>
                {r.studentAnswer.includes('$') ? <MathText text={r.studentAnswer} /> : r.studentAnswer}
              </b>
            : <span className="text-ink2/60">미입력</span>}
        </div>
        {/* ✍️ 서술형 부분점수 + 첨삭 — 점수가 있는 기록에만 뜬다.
            옛 기록은 score 가 undefined 라 이 블록이 통째로 안 그려진다(예전 화면 그대로).
            🔴 r.ai.reason 은 선생님용 문장이라 여기 절대 노출하지 않는다 — feedback 만 보여준다. */}
        {r?.score != null && r?.maxScore != null && (
          <div className="grid gap-1.5 rounded-xl bg-paper2/70 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-lg px-2 py-0.5 text-sm font-black ${
                r.pending ? 'bg-violet-100 text-violet-700' : 'bg-white text-ink'}`}>
                {r.score} <span className="text-xs font-bold text-ink2">/ {r.maxScore}점</span>
              </span>
              {r.pending && <span className="text-[11px] font-bold text-violet-700">가채점 — 선생님 확인 중</span>}
            </div>
            {!!r.criteria?.length && (
              <div className="grid gap-0.5">
                {r.criteria.map((c, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                    <span className={c.got >= c.weight ? 'text-pine' : c.got > 0 ? 'text-amber' : 'text-clay'}>
                      {c.got >= c.weight ? '○' : c.got > 0 ? '△' : '✕'}
                    </span>
                    <span className="grow text-ink2">{c.text}</span>
                    <span className="shrink-0 font-bold text-ink2">{c.got}/{c.weight}</span>
                  </div>
                ))}
              </div>
            )}
            {!!r.feedback && (
              <div className="border-t border-line/50 pt-1.5">
                <div className="mb-0.5 text-[11px] font-bold text-ink2">
                  {r.feedbackBy === 'teacher' ? '✍️ 선생님 첨삭' : r.pending ? '🤖 AI 첨삭 (선생님 확인 전)' : '🤖 AI 첨삭'}
                </div>
                <p className="text-[12px] leading-relaxed text-ink">{r.feedback}</p>
              </div>
            )}
          </div>
        )}
        {cfg.showAnswer && p && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink2">답 :</span>
            <AnswerText p={p} />
          </div>
        )}
        {p && (cfg.showSolution || (cfg.showVideo && p.videoUrl)) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line/50 pt-2.5">
            {cfg.showSolution && p.solution && (
              <button onClick={() => toggleSolution(p.id)}
                className="rounded-lg border border-line px-2.5 py-1 text-xs font-bold text-ink2 hover:bg-paper2">
                {openSolution.has(p.id) ? '해설 접기' : '해설'}
              </button>
            )}
            {cfg.showVideo && p.videoUrl && (
              <button onClick={() => setVideo({ src: p.videoUrl!, subtitle: p.subtitleUrl, title: `${no}번 풀이영상` })}
                className="rounded-lg border border-pine px-2.5 py-1 text-xs font-bold text-pine hover:bg-pine-soft">
                ▶ 풀이영상
              </button>
            )}
          </div>
        )}
        {p && cfg.showSolution && openSolution.has(p.id) && (
          <div className="rounded-xl bg-paper2/50 p-3">
            {isImgAnswer(p.solution) || /^https?:/.test(p.solution)
              ? <img src={p.solution} alt="해설" className="w-full max-w-[465px]" />
              : <MathText text={p.solution} className="text-[13px] leading-relaxed" />}
          </div>
        )}
        {!anyOpen && (
          <div className="rounded-xl bg-paper2/60 p-3 text-xs text-ink2">
            🔒 정답 · 해설 · 풀이 영상이 비공개 상태예요. 선생님에게 문의해주세요.
          </div>
        )}
      </div>
    )
  }

  const cur = items[Math.min(idx, items.length - 1)]

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button onClick={() => nav('/student/worksheets')}
          className="rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-paper2">← 학습지</button>
        <h1 className="text-lg font-black">{ws.title}</h1>
        <div className="grow" />
        <button onClick={() => setSingle(s => !s)}
          className={`rounded-lg border px-3 py-2 text-sm font-bold ${
            single ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2 hover:bg-paper2'}`}>
          {single ? '☰ 모아 보기' : '📄 한문제씩'}
        </button>
      </div>

      {/* 📘 자동 오답학습지 안내 띠 — 제출 즉시 만들어진 복습 숙제로 바로 진입.
          드릴을 이미 다 풀었으면(학습완료) 띠를 거둔다 — 완료된 드릴로 재진입해
          재제출하면 같은 회차가 또 생기는 동선을 막는다 (2026-08-16 리뷰). */}
      {g.autoDrill && (() => {
        const dw = worksheets.find(w => w.id === g.autoDrill!.wsId && !w.deletedAt)
        if (!dw || statusOf(dw.id, latestGradingFor(gradings, me.id, dw.id)) === '학습완료') return null
        return (
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-pine/40 bg-pine-soft px-4 py-3">
            <span className="text-sm font-bold text-pine-dark">
              📘 틀린 유형으로 <b>오답학습지</b>가 숙제로 만들어졌어요!
            </span>
            <div className="grow" />
            <button onClick={() => nav(`/student/solve/${dw.id}`)}
              className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper hover:brightness-110">
              바로 풀기 →
            </button>
          </div>
        )
      })()}

      {!single && (
        <>
          {/* 요약 카드 */}
          <div className="mb-5 rounded-2xl border border-line bg-white p-6">
            <div className="text-sm font-semibold text-ink2">학습지 풀이결과</div>
            <div className="mt-1 text-xl font-black">
              총 {sum.total}문제 중 <span className="text-pine-dark">{sum.correct}문제</span> 맞혔어요! {sum.correct > 0 ? '🎉' : '💪'}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <span className="rounded-xl bg-pine-soft px-4 py-2 font-black text-pine-dark">총점 {sum.score}점</span>
              <span className="font-semibold text-clay">틀린 문제 {sum.wrong}</span>
              <span className="text-ink2">|</span>
              <span className="font-semibold text-pine-dark">맞은 문제 {sum.correct}</span>
              {(() => {
                // ⏱ 문항별 풀이 시간 합계 — 기록이 있는 문항이 하나라도 있을 때만
                const tot = g.results.reduce((a, r) => a + (r.sec ?? 0), 0)
                const n = g.results.filter(r => r.sec).length
                if (!tot) return null
                const mm = String(Math.floor(tot / 60)).padStart(2, '0'), ss = String(tot % 60).padStart(2, '0')
                const avg = Math.round(tot / n)
                return (
                  <span className="rounded-lg bg-paper2 px-3 py-1.5 text-xs font-bold text-ink2"
                    title={`문항별 풀이 시간의 합 (기록된 ${n}문항)`}>
                    ⏱ 총 풀이 {mm}:{ss} · 문제당 평균 {String(Math.floor(avg / 60)).padStart(2, '0')}:{String(avg % 60).padStart(2, '0')}
                  </span>
                )
              })()}
              {g.results.some(r => r.pending) && (
                <span className="rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700"
                  title="서술형 등 자동채점이 어려운 문항은 AI가 1차 채점하고 선생님이 확인 후 확정돼요">
                  🤖 AI 가채점 {g.results.filter(r => r.pending).length}문항 — 선생님 확인 중 (점수 잠정)
                </span>
              )}
            </div>
          </div>

          {/* 토글 */}
          <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={onlyWrong} onChange={e => setOnlyWrong(e.target.checked)}
                className="h-4 w-4 accent-pine" />
              오답만 보기
            </label>
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={withBody} onChange={e => setWithBody(e.target.checked)}
                className="h-4 w-4 accent-pine" />
              문제 같이 보기
            </label>
            <div className="grow" />
            {!anyOpen && (
              <span className="text-xs text-ink2">🔒 채점 후 답과 해설이 비공개되어 있습니다. 선생님에게 문의해주세요.</span>
            )}
          </div>

          {/* 문항 카드 그리드 */}
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map(({ no, p, r }) => {
              const correct = !!r?.correct
              return (
                <div key={no} className="overflow-hidden rounded-2xl border border-line bg-white">
                  {/* 번호 밴드 — 정답 연파랑 / 오답 연분홍 */}
                  <div className={`flex items-center gap-2 px-4 py-2 ${r?.pending ? 'bg-violet-50' : correct ? 'bg-pine-soft' : 'bg-red-50'}`}>
                    <span className={`text-lg font-black ${r?.pending ? 'text-violet-700' : correct ? 'text-pine-dark' : 'text-clay'}`}>
                      {r?.pending ? '🤖' : correct ? '○' : '✕'}
                    </span>
                    <b className={r?.pending ? 'text-violet-700' : correct ? 'text-pine-dark' : 'text-clay'}>{no}번</b>
                    {r?.pending && <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                      {r.pending === 'ai' ? 'AI 채점 중' : `가채점 ${r.correct ? '○' : '✕'} · 확인 중`}
                    </span>}
                    {r?.self && <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-bold text-ink2"
                      title="모범답안을 보고 스스로 표시한 문항이에요">✍️ 자기채점</span>}
                    {p && <span className="ml-1 truncate text-[11px] text-ink2">{typeName(p.typeId)}</span>}
                    {!!r?.sec && (
                      <span title="이 문제를 푸는 데 걸린 시간"
                        className="ml-auto shrink-0 rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-ink2">
                        ⏱ {String(Math.floor(r.sec / 60)).padStart(2, '0')}:{String(r.sec % 60).padStart(2, '0')}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-2.5 p-4">
                    {withBody && p && (
                      <div className="rounded-xl bg-paper2/50 p-3"><ProblemContent p={p} /></div>
                    )}
                    <ItemBody no={no} p={p} r={r} />
                    {/* 🪜 틀린 문항은 그 자리에서 사다리로 — 개념 빈칸까지 내려갔다가 다시 올라온다
                        (2026-09-05 명수쌤: "틀리면 기본개념…맞으면 단계를 높여서 최종 유형정복까지") */}
                    {!correct && !r?.pending && p && !preview.on && (
                      <button type="button"
                        onClick={() => nav(`/student/mastery?type=${p.typeId}&base=${encodeURIComponent(p.id)}`)}
                        className="w-full rounded-xl bg-pine py-2.5 text-sm font-bold text-white hover:bg-pine-dark">
                        🪜 이 유형 마스터하기
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {shown.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
              오답이 없어요! 완벽해요 🎉
            </div>
          )}
        </>
      )}

      {single && cur && (
        <>
          {/* 페이지 네비 + 문제 풀이 현황 토글 */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx <= 0}
              className="h-9 w-9 rounded-lg border border-line font-bold text-ink2 hover:bg-paper2 disabled:opacity-30">←</button>
            <span className="text-sm font-black">{cur.no}번 문제 <span className="font-semibold text-ink2">/ 총 {items.length} 문제</span></span>
            <button onClick={() => setIdx(i => Math.min(items.length - 1, i + 1))} disabled={idx >= items.length - 1}
              className="h-9 w-9 rounded-lg border border-line font-bold text-ink2 hover:bg-paper2 disabled:opacity-30">→</button>
            <div className="grow" />
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={showStatus} onChange={e => setShowStatus(e.target.checked)}
                className="h-4 w-4 accent-pine" />
              문제 풀이 현황
            </label>
          </div>

          <div className="flex items-start gap-4">
            {/* 문제풀이 현황 패널 — 번호 점프 그리드 */}
            {showStatus && (
              <aside className="w-52 shrink-0 rounded-2xl border border-line bg-white p-4">
                <div className="mb-2 text-sm font-black">문제풀이 현황</div>
                <div className="mb-3 grid gap-1 text-[11px] text-ink2">
                  <span><span className="mr-1 inline-block h-3 w-3 rounded-full border border-line bg-white align-[-1px]" />안 푼 문제</span>
                  <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-pine align-[-1px]" />푼 문제</span>
                  <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-amber-soft align-[-1px]" />모르는 문제</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {items.map((it, i) => {
                    const answered = !!it.r?.studentAnswer
                    const unknown = !!it.r?.unknown
                    return (
                      <button key={it.no} onClick={() => setIdx(i)}
                        className={`h-8 w-8 rounded-full border text-xs font-bold transition ${
                          i === idx ? 'ring-2 ring-pine/60' : ''} ${
                          unknown ? 'border-amber bg-amber-soft text-amber'
                          : answered ? 'border-pine bg-pine text-paper'
                          : 'border-line bg-white text-ink2'}`}>
                        {it.no}
                      </button>
                    )
                  })}
                </div>
              </aside>
            )}

            {/* 1문항 카드 */}
            <div className="min-w-0 grow overflow-hidden rounded-2xl border border-line bg-white">
              {/* 문항 헤더: N번 ㅣ 유형명 ㅣ 정답률 ㅣ 난이도 ㅣ [쌍둥이] 출처 */}
              <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 text-sm ${
                cur.r?.correct ? 'bg-pine-soft' : 'bg-red-50'}`}>
                <span className={`text-lg font-black ${cur.r?.correct ? 'text-pine-dark' : 'text-clay'}`}>
                  {cur.r?.correct ? '○' : '✕'}
                </span>
                <b className={cur.r?.correct ? 'text-pine-dark' : 'text-clay'}>{cur.no}번</b>
                {cur.p && (
                  <>
                    <span className="text-ink2/40">ㅣ</span>
                    <span className="text-xs font-semibold text-ink2">{typeName(cur.p.typeId)}</span>
                    {cur.p.correctRate != null && (
                      <>
                        <span className="text-ink2/40">ㅣ</span>
                        <span className="text-xs text-ink2">정답률 {cur.p.correctRate}%</span>
                      </>
                    )}
                    <span className="text-ink2/40">ㅣ</span>
                    <span className="text-xs text-ink2">난이도 {DIFF_LABEL[cur.p.diff]}</span>
                    {cur.p.twinGroup && (
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">쌍둥이</span>
                    )}
                    {cur.p.source && (
                      <>
                        <span className="text-ink2/40">ㅣ</span>
                        <span className="text-xs text-ink2">{cur.p.source}</span>
                      </>
                    )}
                  </>
                )}
              </div>
              <div className="grid gap-3 p-4">
                {cur.p
                  ? <div className="rounded-xl bg-paper2/50 p-3"><ProblemContent p={cur.p} /></div>
                  : <div className="rounded-xl bg-paper2/50 p-3 text-sm text-ink2">문제를 불러오는 중이에요…</div>}
                <ItemBody no={cur.no} p={cur.p} r={cur.r} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* 하단 보충학습 바 */}
      <div className="h-20" />
      <div className="fixed inset-x-0 bottom-0 z-30">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 rounded-t-2xl border border-b-0 border-line bg-white px-6 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.12)]">
          <span className="text-xs text-ink2">
            {!supplement.allowed
              ? <>🔒 {ONE_CLICK_OFF_MSG}</>
              : suppKind === '오답학습' && wrongCount === 0
              ? <>🎉 오답학습 완료! <b className="text-pine-dark">{WRONG_DONE_MSG}</b></>
              : wrongCount > 0 ? <>오답·모름 <b className="text-clay">{wrongCount}문제</b></> : '오답이 없어요'}
          </span>
          <div className="grow" />
          <button onClick={() => supplement.create('오답학습', ws, g)}
            disabled={wrongCount === 0 || !!wrongBlocked || !supplement.allowed}
            title={!supplement.allowed ? ONE_CLICK_OFF_MSG
              : wrongBlocked ? `${SUPPLEMENT_RULE_MSG} (진행 중: ${pendingWrong!.title})`
              : wrongCount === 0 ? WRONG_DONE_MSG
              : '틀린 유형을 틀리지 않을 때까지 반복해서 공부해요'}
            className="rounded-lg border border-clay px-4 py-2 text-sm font-bold text-clay hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent">
            ◎ 오답학습
          </button>
          <button onClick={() => supplement.create('심화학습', ws, g)}
            disabled={!!deepBlocked || sum.correct === 0 || !supplement.allowed}
            title={!supplement.allowed ? ONE_CLICK_OFF_MSG
              : deepBlocked ? `${SUPPLEMENT_RULE_MSG} (진행 중: ${pendingDeep!.title})`
              : sum.correct === 0 ? '심화학습은 맞힌 문제의 유형으로 만들어져요'
              : '맞힌 문제의 유형을 한 단계 높은 난이도로 연습해요'}
            className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper hover:brightness-110 disabled:opacity-40">
            📊 심화학습
          </button>
        </div>
      </div>

      {video && <VideoModal src={video.src} subtitle={video.subtitle} title={video.title} onClose={() => setVideo(null)} />}
    </div>
  )
}
