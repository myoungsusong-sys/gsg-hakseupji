import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { GradeResult } from '../../types'
import { useStore } from '../../lib/store'
import { defaultCurriculumForGrade, typeName } from '../../data/curriculum'
import ProblemContent from '../../components/ProblemContent'
import VideoModal from '../../components/VideoModal'
import MathText from '../../components/MathText'
import { useStudentSelf } from './StudentShell'
import { latestGradingFor, summaryOf, AnswerText, isImgAnswer } from './common'
import { useSupplement } from './supplement'

// ── 학습지 결과 화면 (매쓰플랫 학생앱 학습완료 상세 구조) ────────
// 요약 카드("총 N문제 중 n문제 맞혔어요! 🎉") + 문항 카드 그리드(정답 연파랑/오답 연분홍)
// 정답·해설·풀이영상 노출은 선생님 공개 설정(studentAppConfig) 따름 — 비공개면 문의 안내
export default function StudentResult() {
  const me = useStudentSelf()
  const { wsId } = useParams()
  const { worksheets, gradings, problems, ensureCourse, studentAppConfig: cfg } = useStore()
  const nav = useNavigate()
  const createSupplement = useSupplement(me)

  const [onlyWrong, setOnlyWrong] = useState(false)
  const [withBody, setWithBody] = useState(false)          // 문제 같이 보기 (기본 OFF — 매쓰플랫 동일)
  const [openSolution, setOpenSolution] = useState<Set<string>>(new Set())
  const [video, setVideo] = useState<{ src: string; subtitle?: string; title: string } | null>(null)

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

  function toggleSolution(pid: string) {
    setOpenSolution(prev => { const n = new Set(prev); if (n.has(pid)) n.delete(pid); else n.add(pid); return n })
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button onClick={() => nav('/student/worksheets')}
          className="rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-paper2">← 학습지</button>
        <h1 className="text-lg font-black">{ws.title}</h1>
      </div>

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
              <div className="grid gap-2.5 p-4 text-sm">
                {withBody && p && (
                  <div className="rounded-xl bg-paper2/50 p-3"><ProblemContent p={p} /></div>
                )}
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
            </div>
          )
        })}
      </div>
      {shown.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          오답이 없어요! 완벽해요 🎉
        </div>
      )}

      {/* 하단 보충학습 바 */}
      <div className="h-20" />
      <div className="fixed inset-x-0 bottom-0 z-30">
        <div className="mx-auto flex max-w-4xl items-center gap-2 rounded-t-2xl border border-b-0 border-line bg-white px-6 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.12)]">
          <span className="text-xs text-ink2">
            {wrongCount > 0 ? <>오답·모름 <b className="text-clay">{wrongCount}문제</b></> : '오답이 없어요'}
          </span>
          <div className="grow" />
          <button onClick={() => createSupplement('오답학습', ws, g)} disabled={wrongCount === 0}
            className="rounded-lg border border-clay px-4 py-2 text-sm font-bold text-clay hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent">
            ⊕ 오답학습
          </button>
          <button onClick={() => createSupplement('심화학습', ws, g)}
            className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper hover:brightness-110">
            📊 심화학습
          </button>
        </div>
      </div>

      {video && <VideoModal src={video.src} subtitle={video.subtitle} title={video.title} onClose={() => setVideo(null)} />}
    </div>
  )
}
