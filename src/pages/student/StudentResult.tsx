import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { GradeResult, Problem } from '../../types'
import { DIFF_LABEL } from '../../types'
import { useStore } from '../../lib/store'
import { defaultCurriculumForGrade, typeName } from '../../data/curriculum'
import ProblemContent from '../../components/ProblemContent'
import VideoModal from '../../components/VideoModal'
import MathText from '../../components/MathText'
import { useStudentSelf } from './StudentShell'
import { latestGradingFor, summaryOf, AnswerText, isImgAnswer } from './common'
import { useSupplement, supplementKindOf, SUPPLEMENT_RULE_MSG, WRONG_DONE_MSG } from './supplement'

// ── 학습지 결과 화면 (매쓰플랫 학생앱 학습완료 상세 구조) ────────
// 요약 카드 + 문항 카드 그리드(정답 연파랑/오답 연분홍) + [한문제씩] 모드(1문항 페이지 넘김
// + 문제 풀이 현황 패널 + 문항 메타: 유형명·정답률·난이도·[쌍둥이]·출처)
// 정답·해설·풀이영상 노출은 선생님 공개 설정(studentAppConfig) 따름 — 비공개면 문의 안내
export default function StudentResult() {
  const me = useStudentSelf()
  const { wsId } = useParams()
  const { worksheets, gradings, problems, ensureCourse, studentAppConfig: cfg } = useStore()
  const nav = useNavigate()
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
    if (ws) ensureCourse(defaultCurriculumForGrade(ws.grade))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws?.grade])

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
                  <div className={`flex items-center gap-2 px-4 py-2 ${correct ? 'bg-pine-soft' : 'bg-red-50'}`}>
                    <span className={`text-lg font-black ${correct ? 'text-pine-dark' : 'text-clay'}`}>{correct ? '○' : '✕'}</span>
                    <b className={correct ? 'text-pine-dark' : 'text-clay'}>{no}번</b>
                    {p && <span className="ml-1 truncate text-[11px] text-ink2">{typeName(p.typeId)}</span>}
                  </div>
                  <div className="grid gap-2.5 p-4">
                    {withBody && p && (
                      <div className="rounded-xl bg-paper2/50 p-3"><ProblemContent p={p} /></div>
                    )}
                    <ItemBody no={no} p={p} r={r} />
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
            {suppKind === '오답학습' && wrongCount === 0
              ? <>🎉 오답학습 완료! <b className="text-pine-dark">{WRONG_DONE_MSG}</b></>
              : wrongCount > 0 ? <>오답·모름 <b className="text-clay">{wrongCount}문제</b></> : '오답이 없어요'}
          </span>
          <div className="grow" />
          <button onClick={() => supplement.create('오답학습', ws, g)}
            disabled={wrongCount === 0 || !!wrongBlocked}
            title={wrongBlocked ? `${SUPPLEMENT_RULE_MSG} (진행 중: ${pendingWrong!.title})`
              : wrongCount === 0 ? WRONG_DONE_MSG
              : '틀린 유형을 틀리지 않을 때까지 반복해서 공부해요'}
            className="rounded-lg border border-clay px-4 py-2 text-sm font-bold text-clay hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent">
            ◎ 오답학습
          </button>
          <button onClick={() => supplement.create('심화학습', ws, g)}
            disabled={!!deepBlocked || sum.correct === 0}
            title={deepBlocked ? `${SUPPLEMENT_RULE_MSG} (진행 중: ${pendingDeep!.title})`
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
