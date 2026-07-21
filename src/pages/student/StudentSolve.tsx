import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { GradeResult, Grading, Problem } from '../../types'
import { useStore, uid } from '../../lib/store'
import { isMachineGradable, requestAiGrade } from '../../lib/aiGrade'
import { coursesForWorksheet, typeName } from '../../data/curriculum'
import AnswerInput, { autoCorrect } from '../../components/student/AnswerInput'
import ProblemContent from '../../components/ProblemContent'
import SolveFeedback from '../../components/student/SolveFeedback'
import VideoModal from '../../components/VideoModal'
import MathText from '../../components/MathText'
import { useStudentSelf } from './StudentShell'
import { clearDraft, readDraft, writeDraft, AnswerText, isImgAnswer } from './common'
import { fetchNote, clearNote, type TeacherNote } from '../../lib/live'

// ── 학습지 풀기 — 매쓰플랫 학생앱 풀이 화면 구조 ──────────────────
// · 1문제씩 페이징: [←] N번 문제 / 총 M 문제 [→] + 문제 풀이 현황 토글(번호 칩 점프)
// · 문제 위 필기: 👁(필기 보기)·undo·redo·펜·지우개·전체지우기 + 펜 설정(굵기 5종·색 5종·손으로 쓰기)
// · 하단 고정 답 바: 객관식 1~5 원형 버튼 / 주관식 입력 + [모름] + [다음]([제출하기])
// · ≡ 빠른채점: 전 문항 답 한 화면 입력 모달
// · 우리만의 것(원본에 없음): ✏️ 풀이 쓰고 AI 피드백 받기, 선생님 실시간 첨삭, 임시저장, 채점 전 공개
// · 답이 바뀔 때마다 localStorage 임시저장 (stu-draft-<wsId>) → 새로고침해도 유지
// · 제출: confirm → autoCorrect 자동채점('모름'은 unknown 처리) → hj_gradings 저장 → 결과 화면

const DONT_KNOW = '모름'
const DIFF_LABEL: Record<number, string> = { 1: '하', 2: '중하', 3: '중', 4: '상', 5: '최상' }

// 펜 설정 (매쓰플랫 동일 — 굵기 5·색 5)
const PEN_SIZES = [1.5, 2.5, 3.5, 5, 7]
const PEN_COLORS = ['#1c1917', '#3b82f6', '#22c55e', '#f59e0b', '#f472b6']

interface Stroke { color: string; size: number; erase?: boolean; pts: [number, number][] }  // pts는 0~1 정규화

export default function StudentSolve() {
  const me = useStudentSelf()
  const { wsId } = useParams()
  const { worksheets, assignments, problems, ensureCourse, upsertGrading, studentAppConfig: cfg } = useStore()
  const nav = useNavigate()
  const [openSolution, setOpenSolution] = useState<Set<string>>(new Set())
  const [video, setVideo] = useState<{ src: string; subtitle?: string; title: string } | null>(null)

  const ws = worksheets.find(w => w.id === wsId && !w.deletedAt)
  const mine = !!ws && assignments.some(a => a.worksheetId === ws.id && a.studentId === me.id)

  useEffect(() => {
    if (ws) for (const c of coursesForWorksheet(ws.grade, ws.subject)) ensureCourse(c)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws?.grade])

  const list = useMemo(() => {
    if (!ws) return []
    const m = new Map(problems.map(p => [p.id, p]))
    return ws.problemIds.map(id => m.get(id)).filter((p): p is Problem => !!p)
  }, [problems, ws])

  const [answers, setAnswers] = useState<Record<string, string>>(() => (wsId && readDraft(wsId)?.answers) || {})
  const [savedAt, setSavedAt] = useState<string | null>(() => (wsId && readDraft(wsId)?.at) || null)
  const [idx, setIdx] = useState(0)
  const [statusOn, setStatusOn] = useState(false)   // 문제 풀이 현황 토글
  const [quick, setQuick] = useState(false)         // ≡ 빠른채점 모달

  // 필기 도구 상태 (문항별 스트로크 — 세션 메모리 보관)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [inkOn, setInkOn] = useState(true)          // 👁 필기 표시/숨김(숨기면 그리기도 잠금)
  const [penSize, setPenSize] = useState(1)         // PEN_SIZES 인덱스
  const [penColor, setPenColor] = useState(PEN_COLORS[0])
  const [handWrite, setHandWrite] = useState(true)  // 손으로 쓰기 — OFF면 스타일러스(pen 포인터)만
  const [penPop, setPenPop] = useState(false)
  const [inks, setInks] = useState<Record<string, Stroke[]>>({})
  const [redos, setRedos] = useState<Record<string, Stroke[]>>({})

  useEffect(() => {
    const d = wsId ? readDraft(wsId) : null
    setAnswers(d?.answers ?? {})
    setSavedAt(d?.at ?? null)
    setIdx(0); setInks({}); setRedos({})
  }, [wsId])

  // 선생님 실시간 첨삭 수신 — 4초마다 확인 (우리만의 기능)
  const [note, setNote] = useState<TeacherNote | null>(null)
  useEffect(() => {
    let alive = true
    const poll = async () => { const n = await fetchNote(me.id); if (alive) setNote(n) }
    poll()
    const t = setInterval(poll, 4000)
    return () => { alive = false; clearInterval(t) }
  }, [me.id])
  function ackNote() { clearNote(me.id); setNote(null) }

  if (!ws || !mine) return <Navigate to="/student/worksheets" replace />

  const p = list[idx]

  function setAnswer(pid: string, v: string) {
    setAnswers(prev => {
      const next = { ...prev, [pid]: v }
      setSavedAt(writeDraft(ws!.id, next))
      return next
    })
  }

  const answered = list.filter(q => (answers[q.id] ?? '').trim() !== '')

  // 필기(잉크) → 풀이 이미지 합성 (문제 이미지 위에 필기 얹기, 768px JPEG). CORS 오염 등 실패 시 undefined.
  function exportWork(q: Problem, strokes: Stroke[]): Promise<string | undefined> {
    if (strokes.length === 0) return Promise.resolve(undefined)
    return new Promise(resolve => {
      const compose = (img: HTMLImageElement | null) => {
        try {
          const W = 768
          const H = img ? Math.round(W * img.naturalHeight / img.naturalWidth) : Math.round(W * 0.75)
          const c = document.createElement('canvas'); c.width = W; c.height = H
          const g = c.getContext('2d')!
          g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H)
          if (img) g.drawImage(img, 0, 0, W, H)
          // 잉크 레이어(지우개 반영) 별도 캔버스에 그린 뒤 합성
          const ink = document.createElement('canvas'); ink.width = W; ink.height = H
          const ig = ink.getContext('2d')!
          for (const s of strokes) {
            ig.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over'
            ig.strokeStyle = s.color; ig.lineWidth = s.erase ? s.size * 5 : s.size
            ig.lineCap = 'round'; ig.lineJoin = 'round'
            ig.beginPath()
            s.pts.forEach(([x, y], i) => { const px = x * W, py = y * H; if (i === 0) ig.moveTo(px, py); else ig.lineTo(px, py) })
            ig.stroke()
          }
          g.drawImage(ink, 0, 0)
          resolve(c.toDataURL('image/jpeg', 0.7))
        } catch { resolve(undefined) }
      }
      if (q.imageUrl) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => compose(img)
        img.onerror = () => compose(null)
        img.src = q.imageUrl
      } else compose(null)
    })
  }

  // AI 1차 채점 파이프라인 — 제출 후 백그라운드로 문항별 판정 → pending 'teacher'로 갱신 (선생님 승인 큐행)
  async function runAiPipeline(rec: Grading, targets: Problem[]) {
    let cur = rec
    for (const q of targets) {
      let workImg: string | undefined
      try { workImg = await exportWork(q, inks[q.id] ?? []) } catch { /* 풀이 이미지 없이 진행 */ }
      let patch: Partial<GradeResult>
      try {
        const v = await requestAiGrade(q, (answers[q.id] ?? '').trim(), workImg)
        patch = {
          workImg, pending: 'teacher',
          correct: v.verdict === true,   // 잠정 — 선생님 확정 전
          ai: { verdict: v.verdict, reason: v.reason, confidence: v.confidence, at: new Date().toISOString() },
        }
      } catch {
        patch = { workImg, pending: 'teacher' }   // AI 실패 → 선생님 수동 채점으로 강등
      }
      cur = { ...cur, results: cur.results.map(r => r.itemId === q.id ? { ...r, ...patch } : r) }
      upsertGrading(cur)
    }
  }

  function submit() {
    if (answered.length === 0) { alert('답을 한 문제 이상 입력해주세요.'); return }
    const blank = list.length - answered.length
    const msg = blank > 0
      ? `아직 답을 입력하지 않은 문제가 ${blank}개 있어요.\n답을 입력한 문제만 채점됩니다. 제출할까요?`
      : '제출할까요? 제출하면 바로 자동 채점됩니다.'
    if (!confirm(msg)) return
    const aiOn = cfg.aiGrade ?? false
    const aiTargets: Problem[] = []
    const results: GradeResult[] = answered.map(q => {
      const a = answers[q.id].trim()
      const dk = a === DONT_KNOW
      if (dk) return { itemId: q.id, typeId: q.typeId, studentAnswer: a, correct: false, unknown: true }
      // 자동채점 불가(서술형·이미지정답·답없음 과학) + AI 채점 ON → AI 1차 채점 대상
      if (aiOn && !isMachineGradable(q)) {
        aiTargets.push(q)
        return { itemId: q.id, typeId: q.typeId, studentAnswer: a, correct: false, pending: 'ai' as const }
      }
      return { itemId: q.id, typeId: q.typeId, studentAnswer: a, correct: autoCorrect(q, a) }
    })
    const rec: Grading = {
      id: uid('gr'), studentId: me.id, source: '학습지', worksheetId: ws!.id,
      date: new Date().toISOString(), results, by: 'student',
    }
    upsertGrading(rec)
    clearDraft(ws!.id)
    if (aiTargets.length > 0) void runAiPipeline(rec, aiTargets)
    nav(`/student/result/${ws!.id}`, { replace: true })
  }

  // 필기 조작 (현재 문항)
  const pid = p?.id ?? ''
  const myInk = inks[pid] ?? []
  const myRedo = redos[pid] ?? []
  function pushStroke(s: Stroke) {
    setInks(prev => ({ ...prev, [pid]: [...(prev[pid] ?? []), s] }))
    setRedos(prev => ({ ...prev, [pid]: [] }))
  }
  function undoInk() {
    if (myInk.length === 0) return
    setInks(prev => ({ ...prev, [pid]: myInk.slice(0, -1) }))
    setRedos(prev => ({ ...prev, [pid]: [...myRedo, myInk[myInk.length - 1]] }))
  }
  function redoInk() {
    if (myRedo.length === 0) return
    setRedos(prev => ({ ...prev, [pid]: myRedo.slice(0, -1) }))
    setInks(prev => ({ ...prev, [pid]: [...myInk, myRedo[myRedo.length - 1]] }))
  }
  function clearInk() {
    if (myInk.length === 0) return
    if (!confirm('이 문제의 필기를 모두 지울까요?')) return
    setInks(prev => ({ ...prev, [pid]: [] }))
    setRedos(prev => ({ ...prev, [pid]: [] }))
  }

  const cur = (answers[pid] ?? '').trim()
  const isLast = idx >= list.length - 1

  const toolBtn = (on: boolean) =>
    `flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-bold transition ${
      on ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink2 hover:text-ink'}`

  return (
    <div>
      {/* 헤더: ← | 제목 | ≡ 빠른채점 (매쓰플랫 동일 배치) */}
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => nav('/student/worksheets')}
          className="rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-paper2">←</button>
        <h1 className="grow text-center text-lg font-black">{ws.title}</h1>
        <button onClick={() => setQuick(true)}
          className="rounded-lg border border-line px-3 py-2 text-sm font-bold text-ink2 hover:text-ink">
          ≡ 빠른채점
        </button>
      </div>

      {/* 선생님 실시간 첨삭 배너 (우리만) */}
      {note && (note.text || note.img) && (
        <div className="mb-5 rounded-2xl border-2 border-clay bg-red-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <b className="text-clay">🖍 선생님 첨삭이 도착했어요!</b>
            <div className="grow" />
            <button onClick={ackNote}
              className="rounded-lg bg-clay px-4 py-1.5 text-xs font-bold text-white hover:brightness-105">확인했어요</button>
          </div>
          {note.text && <p className="mb-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed">{note.text}</p>}
          {note.img && <img src={note.img} alt="선생님 첨삭" className="w-full max-w-xl rounded-xl border border-clay/40 bg-white" />}
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          문제를 불러오는 중이에요… 잠시 후에도 나오지 않으면 선생님께 문의해주세요.
        </div>
      ) : (
        <>
          {/* 문항 네비: [←] N번 문제 / 총 M 문제 [→] + 문제 풀이 현황 토글 */}
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-lg text-ink2 hover:bg-paper2 disabled:opacity-30">←</button>
              <b className="text-[15px]"><span className="text-pine-dark">{idx + 1}번 문제</span> <span className="font-semibold text-ink2">/ 총 {list.length} 문제</span></b>
              <button onClick={() => setIdx(i => Math.min(list.length - 1, i + 1))} disabled={isLast}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-lg text-ink2 hover:bg-paper2 disabled:opacity-30">→</button>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink2">
              문제 풀이 현황
              <button onClick={() => setStatusOn(v => !v)} role="switch" aria-checked={statusOn}
                className={`h-6 w-11 rounded-full p-0.5 transition ${statusOn ? 'bg-pine' : 'bg-line'}`}>
                <span className={`block h-5 w-5 rounded-full bg-white shadow transition ${statusOn ? 'translate-x-5' : ''}`} />
              </button>
            </label>
            {savedAt && (
              <span className="text-xs text-ink2">
                ✓ 임시저장 {new Date(savedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* 문제 풀이 현황 — 번호 칩(입력 파랑·모름 노랑), 클릭 점프 */}
          {statusOn && (
            <div className="mb-4 flex flex-wrap gap-1.5 rounded-2xl border border-line bg-white p-3.5">
              {list.map((q, i) => {
                const a = (answers[q.id] ?? '').trim()
                return (
                  <button key={q.id} onClick={() => setIdx(i)}
                    className={`h-9 w-9 rounded-full border text-sm font-bold transition ${
                      i === idx ? 'border-pine ring-2 ring-pine/30' : 'border-line'} ${
                      a === DONT_KNOW ? 'bg-amber-soft text-amber'
                        : a ? 'bg-pine text-paper' : 'bg-white text-ink2 hover:bg-paper2'}`}>
                    {i + 1}
                  </button>
                )
              })}
            </div>
          )}

          {/* 문제 카드 */}
          <div className="rounded-2xl border border-line bg-white p-5">
            {/* 메타 + 필기 툴바 */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <b className="text-pine-dark">{idx + 1}번</b>
              <span className="text-xs text-ink2">{typeName(p.typeId)}</span>
              <span className="text-ink2/40">|</span>
              <span className="text-xs text-ink2">난이도 <b>{DIFF_LABEL[p.diff] ?? '중'}</b></span>
              {cur !== '' && (
                <span className="rounded bg-pine-soft px-1.5 py-0.5 text-[10px] font-bold text-pine-dark">
                  {cur === DONT_KNOW ? '모름 표시' : '답 입력됨'}
                </span>
              )}
              <div className="grow" />
              {/* 필기 툴바 (매쓰플랫 동일: 👁 ↶ ↷ 펜 지우개 🗑 + 펜 설정) */}
              <div className="relative flex items-center gap-1.5">
                <button onClick={() => setInkOn(v => !v)} title={inkOn ? '필기 숨기기' : '필기 보기'} className={toolBtn(inkOn)}>👁</button>
                <button onClick={undoInk} disabled={myInk.length === 0} title="되돌리기"
                  className={`${toolBtn(false)} disabled:opacity-30`}>↶</button>
                <button onClick={redoInk} disabled={myRedo.length === 0} title="다시하기"
                  className={`${toolBtn(false)} disabled:opacity-30`}>↷</button>
                <button onClick={() => { setTool('pen'); setPenPop(v => tool === 'pen' ? !v : true) }} title="펜 (다시 누르면 펜 설정)"
                  className={toolBtn(tool === 'pen')}>
                  <span style={tool === 'pen' ? undefined : { color: penColor }}>✏️</span>
                </button>
                <button onClick={() => setTool('eraser')} title="지우개" className={toolBtn(tool === 'eraser')}>◻</button>
                <button onClick={clearInk} disabled={myInk.length === 0} title="전체 지우기"
                  className={`${toolBtn(false)} disabled:opacity-30`}>🗑</button>

                {/* 펜 설정 팝오버 — 손으로 쓰기 · 굵기 5 · 색 5 */}
                {penPop && (
                  <div className="absolute right-0 top-11 z-40 w-64 rounded-2xl border border-line bg-white p-4 shadow-xl">
                    <div className="mb-3 flex items-center justify-between">
                      <b className="text-sm">펜 설정</b>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-ink2">
                        손으로 쓰기
                        <button onClick={() => setHandWrite(v => !v)} role="switch" aria-checked={handWrite}
                          title="끄면 스타일러스 펜으로만 필기돼요"
                          className={`h-5 w-9 rounded-full p-0.5 transition ${handWrite ? 'bg-pine' : 'bg-line'}`}>
                          <span className={`block h-4 w-4 rounded-full bg-white shadow transition ${handWrite ? 'translate-x-4' : ''}`} />
                        </button>
                      </label>
                    </div>
                    <div className="mb-3 flex items-center justify-between px-1">
                      {PEN_SIZES.map((s, i) => (
                        <button key={i} onClick={() => setPenSize(i)}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${penSize === i ? 'bg-paper2 ring-1 ring-pine' : 'hover:bg-paper2/60'}`}>
                          <span className="rounded-full bg-ink" style={{ width: s * 2, height: s * 2 }} />
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between px-1">
                      {PEN_COLORS.map(c => (
                        <button key={c} onClick={() => setPenColor(c)}
                          className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white ${penColor === c ? 'ring-2 ring-pine' : ''}`}
                          style={{ background: c }}>
                          {penColor === c ? '✓' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 문제 본문 + 필기 캔버스 오버레이 */}
            <InkCanvas
              strokes={inkOn ? myInk : []}
              live={inkOn}
              tool={tool}
              color={penColor}
              size={PEN_SIZES[penSize]}
              handWrite={handWrite}
              onCommit={pushStroke}>
              <ProblemContent p={p} />
            </InkCanvas>

            {/* ✏️ 풀이 쓰고 AI 피드백 받기 — 우리만의 기능 (매쓰플랫 없음) */}
            {(cfg.solveFeedback ?? true) && (
              <div className="mt-4 border-t border-line/60 pt-3">
                <SolveFeedback studentId={me.id} studentName={me.name} worksheetId={ws.id} label={`${ws.title} · ${idx + 1}번`} problem={p} />
              </div>
            )}

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
                    <button onClick={() => setVideo({ src: p.videoUrl!, subtitle: p.subtitleUrl, title: `${idx + 1}번 풀이영상` })}
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
        </>
      )}

      {/* 하단 고정 답 바 — 객관식 1~5 원형 / 주관식 입력 + [모름] + [다음]([제출하기]) */}
      <div className="h-24" />
      {p && (
        <div className="fixed inset-x-0 bottom-0 z-30">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 rounded-t-2xl border border-b-0 border-line bg-white px-6 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.12)]">
            <span className="text-sm">
              <b className="text-pine-dark">{answered.length}</b><span className="text-ink2"> / {list.length}</span>
            </span>
            <div className="grow-0" />
            {p.kind === '객관식' ? (
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => {
                  const c = ['①', '②', '③', '④', '⑤'][n - 1]
                  const on = cur === c
                  return (
                    <button key={n} onClick={() => setAnswer(p.id, on ? '' : c)}
                      className={`h-11 w-11 rounded-full border text-base font-bold transition ${
                        on ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink hover:bg-paper2'}`}>
                      {n}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="min-w-0 max-w-md grow">
                <AnswerInput p={p} value={cur === DONT_KNOW ? '' : cur} onChange={v => setAnswer(p.id, v)} />
              </div>
            )}
            <button onClick={() => setAnswer(p.id, cur === DONT_KNOW ? '' : DONT_KNOW)}
              className={`h-11 rounded-full border px-4 text-sm font-bold transition ${
                cur === DONT_KNOW ? 'border-amber bg-amber-soft text-amber' : 'border-line bg-white text-ink2 hover:bg-paper2'}`}>
              모름
            </button>
            <div className="grow" />
            {!isLast && (
              <button onClick={() => setIdx(i => i + 1)}
                className="rounded-lg bg-pine px-8 py-2.5 text-sm font-bold text-paper hover:brightness-110">
                다음
              </button>
            )}
            {(isLast || answered.length === list.length) && (
              <button onClick={submit}
                className={`rounded-lg px-8 py-2.5 text-sm font-bold ${
                  isLast ? 'bg-pine text-paper hover:brightness-110' : 'border border-pine text-pine hover:bg-pine-soft'}`}>
                제출하기
              </button>
            )}
          </div>
        </div>
      )}

      {/* ≡ 빠른채점 — 전 문항 답 한 화면 입력 */}
      {quick && ws && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => setQuick(false)}>
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-line p-4">
              <h2 className="text-base font-black">빠른채점 <span className="text-xs font-semibold text-ink2">— 답만 빠르게 입력해요</span></h2>
              <div className="grow" />
              <button onClick={() => setQuick(false)} className="rounded-lg px-2 py-0.5 text-lg text-ink2 hover:bg-paper2">✕</button>
            </div>
            <div className="min-h-0 grow overflow-y-auto p-4">
              <div className="grid gap-3">
                {list.map((q, i) => (
                  <div key={q.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line/70 p-3">
                    <b className="w-10 text-sm text-pine-dark">{i + 1}번</b>
                    <div className="min-w-0 grow">
                      <AnswerInput p={q} value={(answers[q.id] ?? '') === DONT_KNOW ? '' : (answers[q.id] ?? '')} onChange={v => setAnswer(q.id, v)} />
                    </div>
                    <button onClick={() => setAnswer(q.id, (answers[q.id] ?? '') === DONT_KNOW ? '' : DONT_KNOW)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                        (answers[q.id] ?? '') === DONT_KNOW ? 'border-amber bg-amber-soft text-amber' : 'border-line text-ink2 hover:bg-paper2'}`}>
                      모름
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-line p-4">
              <span className="text-sm"><b className="text-pine-dark">{answered.length}</b><span className="text-ink2"> / {list.length}문제 입력</span></span>
              <div className="grow" />
              <button onClick={() => { setQuick(false); submit() }}
                className="rounded-lg bg-pine px-6 py-2.5 text-sm font-bold text-paper hover:brightness-110">제출하기</button>
            </div>
          </div>
        </div>
      )}

      {video && <VideoModal src={video.src} subtitle={video.subtitle} title={video.title} onClose={() => setVideo(null)} />}
    </div>
  )
}

// ── 필기 캔버스 — 문제 본문 위 오버레이 (스트로크 0~1 정규화 좌표로 저장 → 리사이즈에도 유지) ──
function InkCanvas({ strokes, live, tool, color, size, handWrite, onCommit, children }: {
  strokes: Stroke[]
  live: boolean                      // false면 표시·입력 모두 잠금(👁 숨김)
  tool: 'pen' | 'eraser'
  color: string
  size: number
  handWrite: boolean                 // false면 스타일러스(pointerType 'pen')만
  onCommit: (s: Stroke) => void
  children: React.ReactNode
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<Stroke | null>(null)

  function redraw() {
    const canvas = canvasRef.current, box = boxRef.current
    if (!canvas || !box) return
    const w = box.clientWidth, h = box.clientHeight
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr; canvas.height = h * dpr
    }
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const paint = (s: Stroke) => {
      ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over'
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.erase ? s.size * 5 : s.size
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath()
      s.pts.forEach(([x, y], i) => { const px = x * w, py = y * h; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py) })
      ctx.stroke()
    }
    for (const s of strokes) paint(s)
    if (drawing.current) paint(drawing.current)
    ctx.globalCompositeOperation = 'source-over'
  }

  useEffect(() => { redraw() })
  useEffect(() => {
    const ro = new ResizeObserver(() => redraw())
    if (boxRef.current) ro.observe(boxRef.current)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function norm(e: React.PointerEvent): [number, number] {
    const r = boxRef.current!.getBoundingClientRect()
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]
  }
  const allowed = (e: React.PointerEvent) => live && (handWrite || e.pointerType === 'pen')

  return (
    <div ref={boxRef} className="relative">
      {children}
      <canvas ref={canvasRef}
        className={`absolute inset-0 h-full w-full ${live ? 'touch-none' : 'pointer-events-none'}`}
        onPointerDown={e => {
          if (!allowed(e)) return
          e.currentTarget.setPointerCapture(e.pointerId)
          drawing.current = { color, size, erase: tool === 'eraser', pts: [norm(e)] }
          redraw()
        }}
        onPointerMove={e => {
          if (!drawing.current) return
          drawing.current.pts.push(norm(e))
          redraw()
        }}
        onPointerUp={() => {
          if (!drawing.current) return
          const s = drawing.current
          drawing.current = null
          if (s.pts.length > 1) onCommit(s)
        }}
        onPointerCancel={() => { drawing.current = null; redraw() }}
      />
    </div>
  )
}
