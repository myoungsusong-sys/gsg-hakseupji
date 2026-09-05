import { useEffect, useMemo, useState } from 'react'
import type { Problem } from '../types'
import { DIFF_LABEL } from '../types'
import ProblemContent from './ProblemContent'
import MathText from './MathText'
import {
  newMastery, step, passConcept, pickForFloor, conceptBlanks,
  FLOOR_NAME, FLOOR_DESC, UP_STREAK, progressPercent,
  type MasteryState, type ConceptBlank,
} from '../lib/mastery'

/**
 * 🪜 유형 마스터 — 학생 화면 (2026-09-05 명수쌤 지시)
 *
 * 학생은 **한 번에 한 문제**만 본다. 채점하면 즉시 오르내림이 일어나고,
 * 왜 올라갔는지·왜 내려왔는지를 문장으로 알려 준다.
 * 기본에서 막히면 **개념 빈칸**으로 내려가 이해를 확인한 뒤 다시 올라온다.
 *
 * 채점은 학생이 스스로 「맞음/틀림」을 누르는 방식이다 —
 * 주관식 자동채점은 표기 흔들림(2/1 vs 2, ①/1)에 약해서 오판이 사고로 이어진다.
 * 객관식은 보기 클릭으로 자동 판정한다.
 */

export default function MasteryRunner({
  typeId, typeName, base, pool, studentId, initial, onChange, onClose,
}: {
  typeId: string
  typeName: string
  /** 기준 문항 — 보통 학생이 방금 틀린 그 문제 */
  base: Problem
  pool: Problem[]
  studentId: string
  initial?: MasteryState
  onChange?: (s: MasteryState) => void
  onClose?: () => void
}) {
  const [state, setState] = useState<MasteryState>(() => initial ?? newMastery(studentId, typeId, 2))
  const [current, setCurrent] = useState<Problem | null>(null)
  const [picked, setPicked] = useState<number | null>(null)   // 객관식 선택
  const [revealed, setRevealed] = useState(false)
  const [msg, setMsg] = useState<string>('')
  const [event, setEvent] = useState<string>('')

  // 개념 빈칸 (0층)
  const blanks = useMemo(() => conceptBlanks(typeId), [typeId])
  const [blankIdx, setBlankIdx] = useState(0)
  const [blankShown, setBlankShown] = useState(false)

  // 층이 바뀌면 그 층의 문제를 새로 뽑는다
  useEffect(() => {
    setPicked(null); setRevealed(false)
    if (state.floor === 0) { setCurrent(null); setBlankIdx(0); setBlankShown(false); return }
    setCurrent(pickForFloor(state, base, pool))
  }, [state.floor, state.servedIds.length, base, pool])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onChange?.(state) }, [state])          // eslint-disable-line react-hooks/exhaustive-deps

  function apply(r: ReturnType<typeof step>) {
    setState(r.next); setMsg(r.message); setEvent(r.event)
  }

  function mark(correct: boolean) {
    if (!current) return
    apply(step(state, current.id, correct, new Date().toISOString()))
  }

  // ── 마스터 / 선생님 호출 ──────────────────────────────────────────────
  if (state.mastered) {
    return (
      <Frame typeName={typeName} state={state} onClose={onClose}>
        <div className="py-10 text-center">
          <div className="text-4xl">🎉</div>
          <p className="mt-3 text-lg font-black text-pine-dark">이 유형을 마스터했습니다</p>
          <p className="mt-1 text-sm text-ink2">최상 단계까지 연속으로 맞혔습니다.</p>
          <Trail state={state} />
        </div>
      </Frame>
    )
  }
  if (state.needsTeacher) {
    return (
      <Frame typeName={typeName} state={state} onClose={onClose}>
        <div className="py-8 text-center">
          <div className="text-3xl">🙋</div>
          <p className="mt-3 text-base font-black text-amber">선생님을 불러 주세요</p>
          <p className="mt-1 text-sm text-ink2">{msg}</p>
          <p className="mt-3 text-xs text-ink2">혼자 더 푸는 것보다 설명을 한 번 듣는 것이 빠릅니다.</p>
          <Trail state={state} />
          <button type="button"
            onClick={() => { setState({ ...state, needsTeacher: false, missStreak: 0, missAtFloor: 0 }); setMsg('') }}
            className="mt-4 rounded-lg border border-line px-4 py-2 text-sm hover:bg-paper2">
            설명 들었습니다 — 이어서 풀기
          </button>
        </div>
      </Frame>
    )
  }

  // ── 0층: 개념 빈칸 ────────────────────────────────────────────────────
  if (state.floor === 0) {
    const b: ConceptBlank | undefined = blanks[blankIdx]
    return (
      <Frame typeName={typeName} state={state} onClose={onClose}>
        {msg && <Banner event={event} msg={msg} />}
        {!b ? (
          <div className="py-8 text-center text-sm text-ink2">
            이 유형에 연결된 개념 정리가 없습니다.
            <button type="button" onClick={() => apply(passConcept(state))}
              className="mt-3 block w-full rounded-lg bg-pine py-2.5 text-sm font-bold text-paper">
              기본 문제부터 시작하기
            </button>
          </div>
        ) : (
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold text-pine-dark">
              <span className={`rounded px-1.5 py-0.5 text-[11px] ${
                b.kind === '공식' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
                {b.kind}
              </span>
              {b.title} · 개념 확인 {blankIdx + 1}/{blanks.length}
            </p>
            <div className="mt-3 rounded-xl border border-line bg-paper2/40 p-4 text-[15px] leading-relaxed">
              <MathText text={blankShown ? b.full : b.text} />
            </div>
            {blankShown && (
              <div className="mt-2 rounded-lg bg-pine-soft px-3 py-2 text-sm">
                <span className="font-bold text-pine-dark">답 </span>
                <MathText text={b.kind === '공식' ? `$${b.answer}$` : b.answer} />
              </div>
            )}
            {!blankShown ? (
              <button type="button" onClick={() => setBlankShown(true)}
                className="mt-3 w-full rounded-lg border border-pine py-2.5 text-sm font-bold text-pine hover:bg-pine-soft">
                {b.kind === '공식' ? '빈칸에 들어갈 식 확인하기' : '빈칸에 들어갈 말 확인하기'}
              </button>
            ) : (
              <div className="mt-3 flex gap-2">
                <button type="button"
                  onClick={() => {
                    if (blankIdx + 1 < blanks.length) { setBlankIdx(blankIdx + 1); setBlankShown(false) }
                    else apply(passConcept(state))
                  }}
                  className="flex-1 rounded-lg bg-pine py-2.5 text-sm font-bold text-paper hover:bg-pine-dark">
                  {blankIdx + 1 < blanks.length ? '다음 개념' : '개념 확인 완료 — 기본 문제로'}
                </button>
              </div>
            )}
          </div>
        )}
      </Frame>
    )
  }

  // ── 1~4층: 문제 풀이 ──────────────────────────────────────────────────
  return (
    <Frame typeName={typeName} state={state} onClose={onClose}>
      {msg && <Banner event={event} msg={msg} />}
      {!current ? (
        <div className="py-10 text-center text-sm text-ink2">
          이 단계에 낼 문제가 더 없습니다.
          <div className="mt-2 text-xs">문제은행에 이 유형·난이도 문항이 부족합니다.</div>
        </div>
      ) : (
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className="rounded bg-pine-soft px-2 py-0.5 font-bold text-pine-dark">
              {FLOOR_NAME[state.floor]}
            </span>
            <span className="rounded bg-paper2 px-2 py-0.5">{DIFF_LABEL[current.diff]}</span>
            <span className="text-ink2">{FLOOR_DESC[state.floor]}</span>
          </div>

          <div className="rounded-xl border border-line p-4">
            {/* 보기는 아래에서 **클릭 버튼**으로 직접 그린다 — 여기서 또 그리면 두 번 나온다 */}
            <ProblemContent p={current} hideChoices />
            {current.choices && (
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                {current.choices.map((c, i) => (
                  <button key={i} type="button" disabled={revealed}
                    onClick={() => { setPicked(i); setRevealed(true) }}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${
                      picked === i ? 'border-pine bg-pine-soft font-bold' : 'border-line hover:bg-paper2'
                    }`}>
                    {'①②③④⑤'[i]} <MathText text={c} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 채점 */}
          {!revealed && !current.choices && (
            <button type="button" onClick={() => setRevealed(true)}
              className="mt-3 w-full rounded-lg border border-pine py-2.5 text-sm font-bold text-pine hover:bg-pine-soft">
              풀었습니다 — 정답 확인
            </button>
          )}
          {revealed && (
            <div className="mt-3 rounded-xl border border-line bg-paper2/40 p-3">
              <div className="text-sm"><b>정답</b> <MathText text={String(current.answer ?? '')} /></div>
              {current.solution && !current.solution.startsWith('http') && (
                <div className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-ink2">
                  <MathText text={current.solution} />
                </div>
              )}
              {current.solution?.startsWith('http') && (
                <img src={current.solution} alt="해설" className="mt-2 w-full max-w-[430px]" />
              )}
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => mark(true)}
                  className="flex-1 rounded-lg bg-pine py-2.5 text-sm font-bold text-paper hover:bg-pine-dark">
                  맞았어요
                </button>
                <button type="button" onClick={() => mark(false)}
                  className="flex-1 rounded-lg border border-amber py-2.5 text-sm font-bold text-amber hover:bg-amber/10">
                  틀렸어요
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Frame>
  )
}

// ── 껍데기 ────────────────────────────────────────────────────────────────

function Frame({ typeName, state, onClose, children }: {
  typeName: string; state: MasteryState; onClose?: () => void; children: React.ReactNode
}) {
  const pct = progressPercent(state)
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-black">🪜 {typeName}</p>
          <p className="text-[11px] text-ink2">
            {FLOOR_NAME[state.floor]} 단계 · 연속 {state.streak}/{UP_STREAK}
            {state.log.length > 0 && ` · 지금까지 ${state.log.length}문제`}
          </p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose}
            className="ml-auto rounded-lg px-2 py-1 text-ink2 hover:bg-paper2">✕</button>
        )}
      </div>

      {/* 사다리 — 지금 어느 층인지 한눈에 */}
      <div className="mb-3 flex items-center gap-1">
        {([0, 1, 2, 3, 4] as const).map((f) => (
          <div key={f} className="flex-1">
            <div className={`h-1.5 rounded-full ${
              f < state.floor ? 'bg-pine' : f === state.floor ? 'bg-pine-dark' : 'bg-line'
            }`} />
            <div className={`mt-1 text-center text-[10px] ${
              f === state.floor ? 'font-bold text-pine-dark' : 'text-ink2'
            }`}>{FLOOR_NAME[f]}</div>
          </div>
        ))}
      </div>
      <div className="mb-3 h-1 rounded-full bg-line">
        <div className="h-1 rounded-full bg-pine transition-all" style={{ width: `${pct}%` }} />
      </div>

      {children}
    </div>
  )
}

function Banner({ event, msg }: { event: string; msg: string }) {
  const tone = event === '올라감' || event === '마스터' ? 'border-pine bg-pine-soft/50 text-pine-dark'
    : event === '선생님호출' ? 'border-amber bg-amber/10 text-amber'
    : event === '개념으로' || event === '내려감' ? 'border-sky-300 bg-sky-50 text-sky-800'
    : 'border-line bg-paper2/50 text-ink2'
  return <div className={`mb-3 rounded-lg border px-3 py-2 text-xs font-semibold ${tone}`}>{msg}</div>
}

/** 지나온 자취 — 어디서 막혔는지 선생님도 학생도 본다 */
function Trail({ state }: { state: MasteryState }) {
  if (!state.log.length) return null
  return (
    <div className="mt-4 text-left">
      <p className="mb-1 text-xs font-bold text-ink2">지나온 길</p>
      <div className="flex flex-wrap gap-1">
        {state.log.map((l, i) => (
          <span key={i} className={`rounded px-1.5 py-0.5 text-[10px] ${
            l.correct ? 'bg-pine-soft text-pine-dark' : 'bg-amber/15 text-amber'
          }`}>{FLOOR_NAME[l.floor]}{l.correct ? '○' : '✗'}</span>
        ))}
      </div>
    </div>
  )
}
