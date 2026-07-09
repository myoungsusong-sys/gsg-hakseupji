import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { GradeResult, Problem } from '../../types'
import { useStore } from '../../lib/store'
import { defaultCurriculumForGrade, typeName } from '../../data/curriculum'
import AnswerInput, { autoCorrect } from '../../components/student/AnswerInput'
import ProblemContent from '../../components/ProblemContent'
import VideoModal from '../../components/VideoModal'
import MathText from '../../components/MathText'
import { useStudentSelf } from './StudentShell'
import { clearDraft, readDraft, writeDraft, AnswerText, isImgAnswer } from './common'

// ── 학습지 풀기 — 문항별 답 입력 + 임시저장 + 제출(자동채점) ────
// · 답이 바뀔 때마다 localStorage 임시저장 (stu-draft-<wsId>) → 새로고침해도 유지
// · 제출: confirm → autoCorrect 자동채점 → hj_gradings 저장(by 'student', 답 입력한 문항만) → 결과 화면
export default function StudentSolve() {
  const me = useStudentSelf()
  const { wsId } = useParams()
  const { worksheets, assignments, problems, ensureCourse, saveGrading, studentAppConfig: cfg } = useStore()
  const nav = useNavigate()
  // 관리 > 학생앱 설정 「채점 전 공개」 소비 — 풀이 중에도 정답·해설·풀이영상 노출 (기본 비공개)
  const [openSolution, setOpenSolution] = useState<Set<string>>(new Set())
  const [video, setVideo] = useState<{ src: string; subtitle?: string; title: string } | null>(null)

  const ws = worksheets.find(w => w.id === wsId && !w.deletedAt)
  const mine = !!ws && assignments.some(a => a.worksheetId === ws.id && a.studentId === me.id)

  // 문제 풀 로드 보장 (배정 직후 과정 풀이 아직 안 올라온 경우)
  useEffect(() => {
    if (ws) ensureCourse(defaultCurriculumForGrade(ws.grade))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws?.grade])

  const list = useMemo(() => {
    if (!ws) return []
    const m = new Map(problems.map(p => [p.id, p]))
    return ws.problemIds.map(id => m.get(id)).filter((p): p is Problem => !!p)
  }, [problems, ws])

  const [answers, setAnswers] = useState<Record<string, string>>(() => (wsId && readDraft(wsId)?.answers) || {})
  const [savedAt, setSavedAt] = useState<string | null>(() => (wsId && readDraft(wsId)?.at) || null)

  // 같은 화면에서 학습지가 바뀌면(오답학습 진입 등) 답 상태를 그 학습지 임시저장분으로 리셋
  useEffect(() => {
    const d = wsId ? readDraft(wsId) : null
    setAnswers(d?.answers ?? {})
    setSavedAt(d?.at ?? null)
  }, [wsId])

  if (!ws || !mine) return <Navigate to="/student/worksheets" replace />

  function setAnswer(pid: string, v: string) {
    setAnswers(prev => {
      const next = { ...prev, [pid]: v }
      setSavedAt(writeDraft(ws!.id, next))   // 문항 답이 바뀔 때마다 임시저장
      return next
    })
  }

  const answered = list.filter(p => (answers[p.id] ?? '').trim() !== '')

  function submit() {
    if (answered.length === 0) { alert('답을 한 문제 이상 입력해주세요.'); return }
    const blank = list.length - answered.length
    const msg = blank > 0
      ? `아직 답을 입력하지 않은 문제가 ${blank}개 있어요.\n답을 입력한 문제만 채점됩니다. 제출할까요?`
      : '제출할까요? 제출하면 바로 자동 채점됩니다.'
    if (!confirm(msg)) return
    // 자동채점 — 답 입력한 문항만 기록 (itemId=문제 id, 선생님 채점 기록과 같은 형식)
    const results: GradeResult[] = answered.map(p => ({
      itemId: p.id,
      typeId: p.typeId,
      studentAnswer: answers[p.id].trim(),
      correct: autoCorrect(p, answers[p.id].trim()),
    }))
    saveGrading({
      studentId: me.id, source: '학습지', worksheetId: ws!.id,
      date: new Date().toISOString(), results, by: 'student',
    })
    clearDraft(ws!.id)
    nav(`/student/result/${ws!.id}`, { replace: true })
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button onClick={() => nav('/student/worksheets')}
          className="rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-paper2">← 학습지</button>
        <div>
          <h1 className="text-lg font-black">{ws.title}</h1>
          <div className="text-xs text-ink2">{ws.problemIds.length}문제 · 답을 입력하면 자동으로 임시저장돼요</div>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          문제를 불러오는 중이에요… 잠시 후에도 나오지 않으면 선생님께 문의해주세요.
        </div>
      ) : (
        <div className="grid gap-4">
          {list.map((p, i) => (
            <div key={p.id} className="rounded-2xl border border-line bg-white p-5">
              <div className="mb-3 flex items-baseline gap-2">
                <b className="text-pine-dark">{i + 1}번</b>
                <span className="text-xs text-ink2">{typeName(p.typeId)}</span>
                {(answers[p.id] ?? '').trim() !== '' && (
                  <span className="rounded bg-pine-soft px-1.5 py-0.5 text-[10px] font-bold text-pine-dark">답 입력됨</span>
                )}
              </div>
              <div className="mb-4">
                <ProblemContent p={p} />
              </div>
              <div className="border-t border-line/60 pt-3">
                <AnswerInput p={p} value={answers[p.id] ?? ''} onChange={v => setAnswer(p.id, v)} />
              </div>
              {/* 채점 전 공개 (선생님 설정) — 정답/해설/풀이영상 */}
              {(cfg.showAnswerBefore || cfg.showSolutionBefore || (cfg.showVideoBefore && p.videoUrl)) && (
                <div className="mt-3 grid gap-2 border-t border-line/60 pt-3 text-sm">
                  {cfg.showAnswerBefore && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-ink2">답 :</span>
                      <AnswerText p={p} />
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {cfg.showSolutionBefore && p.solution && (
                      <button onClick={() => setOpenSolution(prev => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n })}
                        className="rounded-lg border border-line px-2.5 py-1 text-xs font-bold text-ink2 hover:bg-paper2">
                        {openSolution.has(p.id) ? '해설 접기' : '해설'}
                      </button>
                    )}
                    {cfg.showVideoBefore && p.videoUrl && (
                      <button onClick={() => setVideo({ src: p.videoUrl!, subtitle: p.subtitleUrl, title: `${i + 1}번 풀이영상` })}
                        className="rounded-lg border border-pine px-2.5 py-1 text-xs font-bold text-pine hover:bg-pine-soft">
                        ▶ 풀이영상
                      </button>
                    )}
                  </div>
                  {cfg.showSolutionBefore && openSolution.has(p.id) && (
                    <div className="rounded-xl bg-paper2/50 p-3">
                      {isImgAnswer(p.solution) || /^https?:/.test(p.solution)
                        ? <img src={p.solution} alt="해설" className="w-full max-w-[465px]" />
                        : <MathText text={p.solution} className="text-[13px] leading-relaxed" />}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 하단 고정 제출 바 */}
      <div className="h-20" />
      <div className="fixed inset-x-0 bottom-0 z-30">
        <div className="mx-auto flex max-w-4xl items-center gap-3 rounded-t-2xl border border-b-0 border-line bg-white px-6 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.12)]">
          <span className="text-sm">
            <b className="text-pine-dark">{answered.length}</b><span className="text-ink2"> / {list.length}문제 입력</span>
          </span>
          {savedAt && (
            <span className="text-xs text-ink2">
              ✓ 임시저장 {new Date(savedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <div className="grow" />
          <button onClick={submit} disabled={list.length === 0}
            className="rounded-lg bg-pine px-8 py-2.5 text-sm font-bold text-paper hover:brightness-110 disabled:opacity-40">
            제출하기
          </button>
        </div>
      </div>

      {video && <VideoModal src={video.src} subtitle={video.subtitle} title={video.title} onClose={() => setVideo(null)} />}
    </div>
  )
}
