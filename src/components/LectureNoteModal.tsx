import { useMemo, useState } from 'react'
import NoteText from './NoteText'
import type { LecNote, Quiz } from '../data/lecnotes'

// 개념강의 정리노트 창(여고생 스타일) — 요약 정리 + 외울 개념·공식 + 이해확인. 인쇄 가능.
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
    const all = loadScores(); const prev = all[String(lecId)]
    if (!prev || got > prev.best) {
      all[String(lecId)] = { best: got, total, at: new Date().toISOString() }
      localStorage.setItem(SCORE_KEY, JSON.stringify(all))
    }
  } catch { /* 저장 실패 무시 */ }
}

const SEC_TINTS = ['bg-note-pink', 'bg-note-purple', 'bg-note-mint']

function QuizSection({ lecId, quiz }: { lecId: number; quiz: Quiz[] }) {
  const [picked, setPicked] = useState<Record<number, number>>({})
  const [done, setDone] = useState(false)
  const got = useMemo(() => quiz.reduce((n, q, i) => n + (picked[i] === q.a ? 1 : 0), 0), [picked, quiz])
  const allPicked = quiz.every((_, i) => picked[i] !== undefined)
  if (quiz.length === 0) return null
  return (
    <div className="mt-7">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-base font-black text-note-accent">🧠 이해 확인</h3>
        <span className="text-xs text-ink2">제대로 이해했는지 확인! · {quiz.length}문제</span>
      </div>
      <div className="grid gap-3">
        {quiz.map((q, i) => {
          const sel = picked[i]
          return (
            <div key={i} className="rounded-2xl border border-line bg-white px-4 py-3">
              <div className="mb-2 flex gap-2 text-sm font-bold">
                <span className="shrink-0 text-note-accent">Q{i + 1}.</span>
                <NoteText text={q.q} className="leading-relaxed" />
              </div>
              <div className="grid gap-1.5">
                {q.c.map((c, ci) => {
                  const isSel = sel === ci, reveal = sel !== undefined, right = ci === q.a
                  const cls = !reveal ? 'border-line hover:border-note-accent hover:bg-note-pink/40'
                    : right ? 'border-note-accent bg-note-pink/60 font-bold'
                    : isSel ? 'border-clay bg-clay/10 line-through opacity-70' : 'border-line opacity-50'
                  return (
                    <button key={ci} disabled={reveal} onClick={() => setPicked(p => ({ ...p, [i]: ci }))}
                      className={`note-noprint flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${cls}`}>
                      <span className="shrink-0 text-xs font-bold text-ink2">{'①②③④⑤'[ci] ?? ci + 1}</span>
                      <NoteText text={c} />
                      {reveal && right && <span className="ml-auto shrink-0 text-xs font-black text-note-accent">정답</span>}
                    </button>
                  )
                })}
              </div>
              {sel !== undefined && (
                <div className={`mt-2 rounded-xl px-3 py-2 text-sm leading-relaxed ${sel === q.a ? 'bg-note-mint' : 'bg-clay/10'}`}>
                  <b className={sel === q.a ? 'text-note-accent' : 'text-clay'}>{sel === q.a ? '맞았어! ' : '아쉬워! '}</b>
                  <NoteText text={q.e} />
                </div>
              )}
            </div>
          )
        })}
      </div>
      {allPicked && !done && (
        <button onClick={() => { setDone(true); saveScore(lecId, got, quiz.length) }}
          className="note-noprint mt-3 w-full rounded-2xl bg-note-accent py-2.5 font-bold text-white hover:brightness-105">
          결과 확인
        </button>
      )}
      {done && (
        <div className="mt-3 rounded-2xl border border-note-accent/30 bg-note-pink/50 px-4 py-3 text-center">
          <div className="text-lg font-black">{quiz.length}문제 중 <span className="text-note-accent">{got}개</span> 정답 🎀</div>
          <div className="mt-1 text-sm text-ink2">
            {got === quiz.length ? '완벽해! 이 강의는 확실히 이해했어 👏'
              : got >= quiz.length * 0.7 ? '거의 다 왔어! 틀린 문제 해설만 다시 보면 돼.'
              : '헷갈리는 게 있네. 정리노트 다시 보고 강의 한 번 더 듣자 💪'}
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
    <div className="note-noprint fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute inset-x-0 bottom-0 top-0 mx-auto flex max-w-3xl flex-col bg-white shadow-2xl sm:inset-y-6 sm:rounded-3xl"
        onClick={e => e.stopPropagation()}>
        {/* 헤더 (인쇄 제외) */}
        <div className="note-noprint flex shrink-0 items-center gap-2 border-b border-line px-5 py-3">
          <span className="rounded-full bg-note-pink px-2.5 py-0.5 text-xs font-black text-note-accent">정리노트</span>
          <b className="min-w-0 grow truncate text-sm">{note.t}</b>
          <button onClick={() => window.print()} title="인쇄"
            className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs font-bold hover:border-note-accent">🖨️ 인쇄</button>
          {onPlay && (
            <button onClick={onPlay} className="shrink-0 rounded-lg bg-pine px-3 py-1 text-xs font-bold text-white hover:bg-pine-dark">▶ 강의</button>
          )}
          <button onClick={onClose} className="shrink-0 text-ink2 hover:text-ink">✕</button>
        </div>

        {/* 노트 본문 (인쇄 대상) */}
        <div className="note-print grow overflow-y-auto px-5 py-5 sm:px-8">
          <div className="mb-4 border-b-2 border-dashed border-note-accent/40 pb-3">
            <div className="text-xs font-bold text-note-accent">📖 오늘의 개념정리</div>
            <h1 className="mt-0.5 text-xl font-black leading-snug">{note.t}</h1>
            {note.intro && <p className="mt-1.5 text-sm text-ink2"><NoteText text={note.intro} /></p>}
          </div>

          {/* 요약 섹션 */}
          <div className="grid gap-3">
            {note.sec.map((s, i) => (
              <div key={i} className={`rounded-2xl ${SEC_TINTS[i % SEC_TINTS.length]} px-4 py-3`}>
                <h3 className="mb-1.5 text-[15px] font-black">{s.h}</h3>
                <ul className="grid gap-1.5">
                  {s.pts.map((p, j) => (
                    <li key={j} className="flex gap-2 text-sm leading-relaxed">
                      <span className="shrink-0 select-none text-note-accent">✦</span>
                      <NoteText text={p} />
                    </li>
                  ))}
                </ul>
                {s.tip && (
                  <div className="mt-2 flex gap-1.5 rounded-xl bg-white/70 px-3 py-1.5 text-[13px] leading-relaxed">
                    <span className="shrink-0">💡</span><NoteText text={s.tip} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 외워야 할 개념·공식 */}
          {note.memo.length > 0 && (
            <div className="mt-5 rounded-2xl border-2 border-note-accent/50 bg-note-pink/40 px-4 py-3">
              <h3 className="mb-2 text-base font-black text-note-accent">⭐ 시험 전, 이것만은 외우자!</h3>
              <div className="grid gap-2">
                {note.memo.map((m, i) => (
                  <div key={i} className="flex flex-col gap-0.5 rounded-xl bg-white px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3">
                    <span className="shrink-0 text-sm font-black text-note-accent">{m.k}</span>
                    <span className="text-sm leading-relaxed"><NoteText text={m.v} /></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <QuizSection lecId={lecId} quiz={note.q} />
          <div className="h-6" />
        </div>
      </div>
    </div>
  )
}
