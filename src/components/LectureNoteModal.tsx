import { useMemo, useState } from 'react'
import NoteText from './NoteText'
import type { Blank, LecNote, Quiz } from '../data/lecnotes'

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

// 개념 빈칸테스트 — 화면에선 입력·채점, 인쇄하면 학생용 시험지(빈 밑줄)로 나간다.
// q의 {{1}} 자리에 입력칸을 끼워 렌더. 채점은 공백·대소문자 무시 비교.
function normAns(s: string): string {
  return (s || '').replace(/\s+/g, '').replace(/[.,]$/, '').toLowerCase()
}

// 빈칸 뒤 조사 자동 보정 —— 정답이 "2"·"$3^2$"처럼 수식/숫자라 받침을 알 수 없어
// "2 과 3", "곱셈 기호을" 같은 비문이 생긴다. 정답의 마지막 '읽는 소리'로 받침을 판정해 고른다.
const JOSA: Record<string, [string, string]> = {   // [받침 있음, 받침 없음]
  '과': ['과', '와'], '와': ['과', '와'],
  '을': ['을', '를'], '를': ['을', '를'],
  '이': ['이', '가'], '가': ['이', '가'],
  '은': ['은', '는'], '는': ['은', '는'],
  '으로': ['으로', '로'], '로': ['으로', '로'],
}
// 숫자·알파벳의 한글 읽기 끝소리에 받침이 있는지
const DIGIT_JONG: Record<string, boolean> = { '0': false, '1': true, '2': false, '3': true, '4': false, '5': false, '6': true, '7': true, '8': true, '9': false }
function hasJong(ans: string): boolean | null {
  const raw = (ans || '').trim()
  // 거듭제곱($3^2$, $2^{10}$)은 "…제곱"으로 읽히므로 받침 없음. 지수 표기를 먼저 판정한다.
  if (/\^\s*\{?\s*\d+\s*\}?\s*\$?\s*$/.test(raw)) return false
  // 분수($\frac{4}{9}$)는 "…분의 …"로 읽히므로 분자 숫자로 판정
  const frac = raw.match(/\\d?frac\s*\{[^}]*\}\s*\{([^}]*)\}/)
  if (frac) {
    const n = frac[1].replace(/[^0-9]/g, '').slice(-1)
    if (n) return DIGIT_JONG[n]
  }
  // 그 밖에는 수식·기호를 걷어내고 마지막 '읽히는' 글자로 판정
  const t = raw.replace(/\$/g, '').replace(/\\[a-zA-Z]+|[{}^_\\]/g, '').replace(/[()[\]\s.,]/g, '')
  const last = t.slice(-1)
  if (!last) return null
  if (/[0-9]/.test(last)) return DIGIT_JONG[last]
  const code = last.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0   // 한글: 종성 유무
  return null                                                               // 판정 불가 → 원문 유지
}
function fixJosa(seg: string, prevAns: string | undefined): string {
  if (prevAns === undefined) return seg
  const m = seg.match(/^\s*(으로|로|과|와|을|를|이|가|은|는)(?![가-힣])/)
  if (!m) return seg
  const jong = hasJong(prevAns)
  if (jong === null) return seg
  const pair = JOSA[m[1]]
  if (!pair) return seg
  return seg.replace(m[1], jong ? pair[0] : pair[1])
}

function BlankSection({ blanks }: { blanks: Blank[] }) {
  const [val, setVal] = useState<Record<string, string>>({})
  const [graded, setGraded] = useState(false)
  const total = useMemo(() => blanks.reduce((n, b) => n + b.a.length, 0), [blanks])
  const got = useMemo(
    () => blanks.reduce((n, b, i) => n + b.a.filter((ans, j) => normAns(val[`${i}-${j}`] || '') === normAns(ans)).length, 0),
    [val, blanks],
  )
  if (blanks.length === 0) return null

  return (
    <div>
      <div className="note-noprint mb-2 flex items-center gap-2">
        <span className="text-xs text-ink2">빈칸에 알맞은 말을 써넣으세요 · 총 {total}개</span>
        <div className="grow" />
        {graded && <span className="text-sm font-black">{got}/{total}</span>}
      </div>
      <ol className="grid gap-2.5">
        {blanks.map((b, i) => {
          // "…약수가 {{1}}개…" → 텍스트와 입력칸을 번갈아 렌더
          const parts = b.q.split(/(\{\{\d+\}\})/g)
          return (
            <li key={i} className="rounded-xl border border-line px-3 py-2 text-sm leading-loose">
              <span className="mr-1.5 font-black text-note-accent">{i + 1}.</span>
              {parts.map((p, k) => {
                const m = p.match(/^\{\{(\d+)\}\}$/)
                if (!m) {
                  // 바로 앞이 빈칸이면 그 정답의 받침에 맞춰 조사를 고른다 ("2 과 3" → "2 와 3")
                  const prev = parts[k - 1]?.match(/^\{\{(\d+)\}\}$/)
                  const text = prev ? fixJosa(p, b.a[Number(prev[1]) - 1]) : p
                  return <NoteText key={k} text={text} />
                }
                const j = Number(m[1]) - 1
                const key = `${i}-${j}`
                const right = graded && normAns(val[key] || '') === normAns(b.a[j] ?? '')
                const wrong = graded && !right
                return (
                  <span key={k} className="inline-flex items-baseline">
                    {/* 인쇄용 빈 네모칸 */}
                    <span className="note-printonly mx-0.5 inline-block h-5 w-24 border-b-2 border-ink/50 align-baseline" />
                    <input value={val[key] ?? ''} onChange={e => setVal(v => ({ ...v, [key]: e.target.value }))}
                      disabled={graded} placeholder={String(j + 1)}
                      className={`note-noprint mx-0.5 w-24 rounded-md border-b-2 bg-note-pink/20 px-1.5 py-0.5 text-center text-sm font-bold outline-none placeholder:font-normal placeholder:text-ink2/40 ${
                        wrong ? 'border-clay bg-clay/10 text-clay' : right ? 'border-note-accent text-note-accent' : 'border-note-accent/50 focus:border-note-accent'}`} />
                    {wrong && <b className="note-noprint mr-0.5 text-xs text-note-accent">{b.a[j]}</b>}
                  </span>
                )
              })}
              {b.hint && <span className="ml-1 text-xs text-ink2">({b.hint})</span>}
            </li>
          )
        })}
      </ol>
      <div className="note-noprint mt-3 flex gap-2">
        {!graded ? (
          <button onClick={() => setGraded(true)}
            className="grow rounded-2xl bg-note-accent py-2.5 font-bold text-white hover:brightness-105">채점하기</button>
        ) : (
          <>
            <div className="grow rounded-2xl bg-note-pink/50 py-2.5 text-center text-sm font-bold">
              {got === total ? '완벽해요! 개념이 확실히 잡혔어요 👏'
                : got >= total * 0.7 ? `${total - got}개만 더! 틀린 곳을 다시 외워보세요`
                : '아직이에요. 위 암기카드를 다시 보고 도전!'}
            </div>
            <button onClick={() => { setVal({}); setGraded(false) }}
              className="shrink-0 rounded-2xl border border-line px-4 font-bold hover:border-note-accent">다시</button>
          </>
        )}
      </div>
    </div>
  )
}

export default function LectureNoteModal(
  { lecId, note, onClose, onPlay }: { lecId: number; note: LecNote; onClose: () => void; onPlay?: () => void },
) {
  // 정리노트 / 빈칸테스트를 탭으로 분리 — 인쇄도 보고 있는 탭만 나간다
  const [tab, setTab] = useState<'note' | 'blank'>('note')
  const hasBlank = !!note.blank && note.blank.length > 0

  return (
    <div className="note-noprint fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute inset-x-0 bottom-0 top-0 mx-auto flex max-w-3xl flex-col bg-white shadow-2xl sm:inset-y-6 sm:rounded-3xl"
        onClick={e => e.stopPropagation()}>
        {/* 헤더 (인쇄 제외) */}
        <div className="note-noprint flex shrink-0 items-center gap-2 border-b border-line px-5 py-3">
          <b className="min-w-0 grow truncate text-sm">{note.t}</b>
          <button onClick={() => window.print()} title="보고 있는 탭을 인쇄"
            className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs font-bold hover:border-note-accent">🖨️ 인쇄</button>
          {onPlay && (
            <button onClick={onPlay} className="shrink-0 rounded-lg bg-pine px-3 py-1 text-xs font-bold text-white hover:bg-pine-dark">▶ 강의</button>
          )}
          <button onClick={onClose} className="shrink-0 text-ink2 hover:text-ink">✕</button>
        </div>

        {/* 탭 — 정리노트 | 빈칸테스트 */}
        {hasBlank && (
          <div className="note-noprint flex shrink-0 gap-1 border-b border-line px-4 pt-2">
            {([['note', '📖 정리노트'], ['blank', '✍️ 빈칸 테스트']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`rounded-t-xl px-4 py-2 text-sm font-bold transition ${
                  tab === k ? 'bg-note-pink/60 text-note-accent' : 'text-ink2 hover:bg-paper2'}`}>
                {label}
                {k === 'blank' && <span className="ml-1 text-xs font-normal">{note.blank!.length}문항</span>}
              </button>
            ))}
          </div>
        )}

        {/* 빈칸 테스트 탭 — 노트와 완전히 분리된 공간(인쇄하면 시험지) */}
        {tab === 'blank' && hasBlank && (
          <div className="note-print grow overflow-y-auto px-5 py-5 sm:px-8">
            <div className="mb-4 flex items-end justify-between border-b-2 border-dashed border-note-accent/40 pb-3">
              <div>
                <div className="text-xs font-bold text-note-accent">✍️ 개념 빈칸 테스트</div>
                <h1 className="mt-0.5 text-xl font-black leading-snug">{note.t}</h1>
              </div>
              {/* 인쇄용 이름/점수 칸 */}
              <div className="note-printonly text-xs">이름 __________ 점수 ______</div>
            </div>
            <BlankSection blanks={note.blank!} />
            <div className="h-6" />
          </div>
        )}

        {/* 노트 본문 (인쇄 대상) */}
        {tab === 'note' && (
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
        )}
      </div>
    </div>
  )
}
