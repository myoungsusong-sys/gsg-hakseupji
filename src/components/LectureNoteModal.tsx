import { useMemo, useState } from 'react'
import MathText from './MathText'
import type { LecNote, NoteBlock, Quiz } from '../data/lecnotes'

// 개념강의 필기노트 창 — 노트(무누락) + 이해확인 문제(즉시 채점·해설)
// 학생이 강의를 정확히 이해했는지 확인하는 용도. 결과는 로컬에 저장(강의별 최고점).

const SCORE_KEY = 'gsg-lecnote-score'
type ScoreMap = Record<string, { best: number; total: number; at: string }>
function loadScores(): ScoreMap {
  try { return JSON.parse(localStorage.getItem(SCORE_KEY) || '{}') } catch { return {} }
}
export function getLecScore(lecId: number | string): { best: number; total: number } | null {
  const s = loadScores()[String(lecId)]
  return s ? { best: s.best, total: s.total } : null
}
function saveScore(lecId: number | string, got: number, total: number) {
  try {
    const all = loadScores()
    const prev = all[String(lecId)]
    if (!prev || got > prev.best) {
      all[String(lecId)] = { best: got, total, at: new Date().toISOString() }
      localStorage.setItem(SCORE_KEY, JSON.stringify(all))
    }
  } catch { /* 저장 실패는 무시 */ }
}

function Block({ b }: { b: NoteBlock }) {
  if (b.t === 'h') return <h3 className="mt-6 mb-2 border-l-4 border-pine pl-2.5 text-base font-black">{b.x}</h3>
  if (b.t === 'box') return (
    <div className="my-3 rounded-xl border border-pine/30 bg-pine-soft/30 px-4 py-3">
      <div className="mb-1 text-xs font-black text-pine-dark">핵심</div>
      {/* 노트 본문에 \n 이 있으므로 줄바꿈 보존 */}
      <MathText text={b.x} className="block whitespace-pre-line text-sm leading-relaxed" />
    </div>
  )
  if (b.t === 'ex') return (
    <div className="my-3 rounded-xl border border-line bg-paper2/60 px-4 py-3">
      <div className="mb-1.5 text-xs font-black text-amber">예제</div>
      <MathText text={b.x} className="block whitespace-pre-line text-sm font-bold leading-relaxed" />
      {b.s && b.s.length > 0 && (
        <ol className="mt-2 grid gap-1 border-t border-line/70 pt-2">
          {b.s.map((step, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="shrink-0 text-xs font-bold text-ink2">{i + 1})</span>
              <MathText text={step} />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
  return <p className="my-2 text-sm leading-[1.9]"><MathText text={b.x} /></p>
}

function QuizSection({ lecId, quiz }: { lecId: number; quiz: Quiz[] }) {
  const [picked, setPicked] = useState<Record<number, number>>({})
  const [done, setDone] = useState(false)
  const got = useMemo(() => quiz.reduce((n, q, i) => n + (picked[i] === q.a ? 1 : 0), 0), [picked, quiz])
  const allPicked = quiz.every((_, i) => picked[i] !== undefined)

  if (quiz.length === 0) return null
  return (
    <div className="mt-8 border-t-2 border-dashed border-line pt-5">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-base font-black">🧠 이해 확인</h3>
        <span className="text-xs text-ink2">강의를 정확히 이해했는지 확인해 보세요 · {quiz.length}문제</span>
      </div>
      <div className="grid gap-4">
        {quiz.map((q, i) => {
          const sel = picked[i]
          return (
            <div key={i} className="rounded-xl border border-line px-4 py-3">
              <div className="mb-2 flex gap-2 text-sm font-bold">
                <span className="shrink-0 text-pine-dark">{i + 1}.</span>
                <MathText text={q.q} className="leading-relaxed" />
              </div>
              <div className="grid gap-1.5">
                {q.c.map((c, ci) => {
                  const isSel = sel === ci
                  const reveal = done || sel !== undefined
                  const right = ci === q.a
                  const cls = !reveal ? 'border-line hover:border-pine hover:bg-pine-soft/30'
                    : right ? 'border-pine bg-pine-soft/50 font-bold'
                    : isSel ? 'border-clay bg-clay/10 line-through opacity-70'
                    : 'border-line opacity-50'
                  return (
                    <button key={ci} disabled={sel !== undefined}
                      onClick={() => setPicked(p => ({ ...p, [i]: ci }))}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${cls}`}>
                      <span className="shrink-0 text-xs font-bold text-ink2">{'①②③④⑤'[ci] ?? ci + 1}</span>
                      <MathText text={c} />
                      {reveal && right && <span className="ml-auto shrink-0 text-xs font-black text-pine-dark">정답</span>}
                    </button>
                  )
                })}
              </div>
              {sel !== undefined && (
                <div className={`mt-2 rounded-lg px-3 py-2 text-sm leading-relaxed ${sel === q.a ? 'bg-pine-soft/40' : 'bg-clay/10'}`}>
                  <b className={sel === q.a ? 'text-pine-dark' : 'text-clay'}>{sel === q.a ? '맞았어요! ' : '다시 볼까요? '}</b>
                  <MathText text={q.e} />
                </div>
              )}
            </div>
          )
        })}
      </div>
      {allPicked && !done && (
        <button onClick={() => { setDone(true); saveScore(lecId, got, quiz.length) }}
          className="mt-4 w-full rounded-xl bg-pine py-2.5 font-bold text-white hover:bg-pine-dark">
          결과 확인
        </button>
      )}
      {done && (
        <div className="mt-4 rounded-xl border border-line bg-paper2 px-4 py-3 text-center">
          <div className="text-lg font-black">{quiz.length}문제 중 <span className="text-pine-dark">{got}문제</span> 정답</div>
          <div className="mt-1 text-sm text-ink2">
            {got === quiz.length ? '완벽해요! 이 강의는 확실히 이해했어요 👏'
              : got >= quiz.length * 0.7 ? '거의 다 왔어요. 틀린 문제의 해설을 다시 읽어보세요.'
              : '아직 헷갈리는 부분이 있어요. 노트를 다시 보고 강의를 한 번 더 들어보세요.'}
          </div>
        </div>
      )}
    </div>
  )
}

export default function LectureNoteModal(
  { lecId, note, onClose, onPlay }: { lecId: number; note: LecNote; onClose: () => void; onPlay?: () => void },
) {
  return (
    <div className="no-print fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute inset-x-0 bottom-0 top-0 mx-auto flex max-w-3xl flex-col bg-white shadow-2xl sm:inset-y-6 sm:rounded-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-3">
          <span className="rounded-full bg-pine-soft px-2.5 py-0.5 text-xs font-black text-pine-dark">필기노트</span>
          <b className="min-w-0 grow truncate text-sm">{note.t}</b>
          {onPlay && (
            <button onClick={onPlay} className="shrink-0 rounded-lg bg-pine px-3 py-1 text-xs font-bold text-white hover:bg-pine-dark">
              ▶ 강의 보기
            </button>
          )}
          <button onClick={onClose} className="shrink-0 text-ink2 hover:text-ink">✕</button>
        </div>
        <div className="grow overflow-y-auto px-5 py-4 sm:px-8">
          {note.n.map((b, i) => <Block key={i} b={b} />)}
          <QuizSection lecId={lecId} quiz={note.q} />
          <div className="h-6" />
        </div>
      </div>
    </div>
  )
}
