import { useEffect, useMemo, useRef, useState } from 'react'
import type { Problem } from '../types'
import { DIFF_LABEL } from '../types'
import ProblemContent from './ProblemContent'
import InkCanvas, { PEN_SIZES, PEN_COLORS, type Stroke } from './student/InkCanvas'
import * as pencil from '../lib/pencilSound'
import AskProblemButton from './student/AskProblemButton'
import { autoCorrect, choiceAnswerCount, isImgAnswer, isSelfGraded, toggleChoice } from './student/AnswerInput'
import { answerParts, joinAnswerParts, joinPlainParts, plainAnswerParts } from '../lib/answers'
import MathText from './MathText'
import { readSticky, writeSticky } from '../pages/student/common'
import { useStore } from '../lib/store'
import { dateKey } from '../lib/dates'
import { todaySet, type TodaySet } from '../lib/masterySet'
import MathAnswerField, { levelFromCourse } from './student/MathAnswerField'
import { answerUnit } from '../lib/mathAnswer'
import {
  newMastery, normalizeMastery, step, passConcept, pickForFloor, conceptBlanks, topFloorOf,
  FLOOR_NAME, FLOOR_DESC, UP_STREAK, progressPercent,
  type MasteryState, type ConceptBlank, type Floor,
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
  typeId, typeName, base, pool, studentId, initial, onChange, onClose, onSkip, skipLabel, course,
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
  /** 이 유형에 낼 문항이 아예 없을 때 — 다음 오답 유형(범위 모드) 또는 목록으로. 정복으로 치지 않는다 */
  onSkip?: () => void
  skipLabel?: string
  /** 어느 과정인가 — 답 입력 키패드를 초등/중등/고등에 맞춘다 */
  course?: string
}) {
  // 🔴 저장된 상태는 빈 칸을 채워서 쓴다(normalizeMastery) — 덜 찬 상태로 화면이 죽던 것(2026-10-02 최다혜)
  const [state, setState] = useState<MasteryState>(() => normalizeMastery(initial, studentId, typeId) ?? newMastery(studentId, typeId, 2))
  const [current, setCurrent] = useState<Problem | null>(null)
  const [picked, setPicked] = useState<number | null>(null)   // 객관식 선택
  const [input, setInput] = useState('')                      // 주관식 학생 답
  const [sel, setSel] = useState('')                          // 정답이 여럿인 객관식 — 고른 보기 「①,③」
  const [partVals, setPartVals] = useState<string[]>([])      // 답이 여럿인 주관식 — 칸별 입력
  const [judged, setJudged] = useState<boolean | null>(null)  // 자동 채점 결과
  const [revealed, setRevealed] = useState(false)
  const [msg, setMsg] = useState<string>('')
  const [event, setEvent] = useState<string>('')

  // ✏️ 문제 위 필기 (2026-10-09 명수쌤 「학생이 수학 승강제풀이를 패드로 하는데 풀이를 쓸 수 없대」)
  //    학습지 풀이 화면(StudentSolve)에는 펜 필기가 있는데 **승강제 화면에는 쓸 자리가 아예 없었다.**
  //    같은 InkCanvas 를 문제 위 + 그 아래 빈 풀이 칸에 깐다. 규칙도 학습지와 같다 —
  //    펜(또는 지우개)을 «골라야» 써지고, 안 골랐을 때는 터치가 통과해 화면이 스크롤된다(10-03 명수쌤).
  //    필기는 이 기기 메모리에 문항별로만 둔다(서버로 보내지 않는다).
  const [tool, setTool] = useState<'none' | 'pen' | 'eraser'>('none')
  const [penSize, setPenSize] = useState(1)          // PEN_SIZES 인덱스
  const [penColor, setPenColor] = useState(PEN_COLORS[0])
  const [handWrite, setHandWrite] = useState(true)   // 손으로 쓰기 — 끄면 스타일러스(pen 포인터)만
  const [penSound, setPenSound] = useState(() => pencil.soundOn())
  const [penPop, setPenPop] = useState(false)
  const [inks, setInks] = useState<Record<string, Stroke[]>>({})
  const [redos, setRedos] = useState<Record<string, Stroke[]>>({})

  // 개념 빈칸 (0층)
  const blanks = useMemo(() => conceptBlanks(typeId), [typeId])
  // 🔴 2026-10-03 — 이 유형이 실제로 가진 난이도만큼만 사다리를 쓴다(「N단계 중 M단계」).
  //    난이도가 한 종류뿐인 유형까지 5단계를 억지로 올리면 같은 문제를 다섯 번 보게 된다.
  const top = useMemo(() => topFloorOf(typeId, pool), [typeId, pool])
  const [blankIdx, setBlankIdx] = useState(0)
  const [blankShown, setBlankShown] = useState(false)

  // 🪜 오늘 몫 — 하루 문제 수에 닿으면 그날은 여기서 멈춘다(= 한 세트). 2026-10-06 명수쌤 지시.
  //    과목을 가리지 않고 합쳐 센다. 지금 유형은 store 에 저장되기 전 값이 정확하니 직접 세어 더한다.
  const { masteries, studentAppConfig } = useStore()
  const [extend, setExtend] = useState(false)        // 「조금 더 풀기」를 누르면 오늘은 상한을 풀어 준다
  const solvedHere = useMemo(() => {
    const today = dateKey(new Date())
    return state.log.filter((l) => l?.at && dateKey(l.at) === today).length
  }, [state.log])
  const sets: TodaySet = useMemo(
    () => todaySet(masteries, studentId, studentAppConfig.masteryDailyCap,
      { exceptTypeId: typeId, extraToday: solvedHere }),
    [masteries, studentId, studentAppConfig.masteryDailyCap, typeId, solvedHere],
  )
  const capped = sets.full && !extend
  // 🔴 아래 「층이 바뀌면 문제를 뽑는다」 useEffect 가 capped 를 의존성에 넣으면, 상한에 닿는 순간
  //    다시 돌면서 **풀고 있던 문제를 치워 버린다**(마지막 문제의 해설을 못 본다).
  //    그래서 ref 로만 읽는다 — 다음에 뽑으러 올 때 비로소 막힌다.
  const cappedRef = useRef(capped)
  useEffect(() => { cappedRef.current = capped }, [capped])

  // 층이 바뀌면 그 층의 문제를 새로 뽑는다
  // 🔴 2026-10-01: 새로고침·앱 재시작 뒤에도 **풀던 그 문제**로 돌아온다(같은 층·같은 진행 수일 때만).
  const curKey = studentId && studentId !== 'me' ? `${studentId}:ladder-cur:${typeId}` : null
  useEffect(() => {
    setPicked(null); setRevealed(false); setInput(''); setSel(''); setPartVals([]); setJudged(null)
    if (state.floor === 0) { setCurrent(null); setBlankIdx(0); setBlankShown(false); return }
    // 오늘 몫을 다 썼으면 다음 문제를 뽑지 않는다 — 뽑아 두면 servedIds 에 들어가 내일 그 문제를 잃는다
    if (cappedRef.current) { setCurrent(null); return }
    const kept = curKey ? readSticky<{ floor: number; n: number; pid: string }>(curKey) : undefined
    const again = kept && kept.floor === state.floor && kept.n === state.servedIds.length
      ? pool.find((p) => p.id === kept.pid) : undefined
    const next = again ?? pickForFloor(state, base, pool)
    setCurrent(next)
    if (curKey && next) writeSticky(curKey, { floor: state.floor, n: state.servedIds.length, pid: next.id })
  }, [state.floor, state.servedIds.length, base, pool])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onChange?.(state) }, [state])          // eslint-disable-line react-hooks/exhaustive-deps

  function apply(r: ReturnType<typeof step>) {
    setState(r.next); setMsg(r.message); setEvent(r.event)
  }

  // 매쓰플랫 문항은 보기가 **이미지 안에** 있어 choices 배열이 없다.
  // 그래도 객관식이면 ①~⑤ 버튼을 줘야 한다 — 안 그러면 학생이 식을 통째로 타이핑해야 한다.
  const isChoice = !!current && (current.kind === '객관식' || !!current.choices)
  // 🔴 2026-09-29 명수쌤 「승강제 문제 답 두 개 입력하는 거 답 하나만 입력이 된대」 —
  //    보기를 누르는 즉시 그 한 개로 채점해서 정답이 둘인 객관식은 무엇을 눌러도 오답이었다.
  //    → 정답이 여럿이면 보기를 켜고 끈 뒤 [제출]. 주관식도 답이 여럿이면((가)·(나), `a, b`) 칸을 나눠 받는다.
  const multi = isChoice && choiceAnswerCount(current?.answer) > 1
  const labeled = current && !isChoice ? answerParts(current.answer) : null
  const plain = current && !isChoice && !labeled ? plainAnswerParts(current.answer) : null
  const nParts = labeled?.length ?? plain?.length ?? 0
  const joinedParts = labeled ? joinAnswerParts(partVals, current?.answer) : plain ? joinPlainParts(partVals) : ''
  // ✍️ 답 입력을 간단하게 (2026-10-06 명수쌤 「학생들이 정답입력을 간단히 할 수 있게 해줘」)
  //    · 키패드 — 숫자·√·제곱·분수·ㄱㄴㄷ·㉠㉡·단위를 눌러서 넣는다(태블릿 OS 키보드를 안 띄워도 된다)
  //    · 단위 — 정답이 「6[cm]」처럼 단위로 끝나면 cm 은 칸 밖에 미리 적어 주고 «숫자만» 받는다.
  //      실측(2026-10-06): 주관식 정답 219,431개 중 54,803개(25.0%)가 이 모양이다.
  const kp = levelFromCourse(course)
  const unit = current && !isChoice && nParts === 0 ? answerUnit(current.answer) : null

  // 필기 조작 (지금 문항)
  const inkId = current?.id ?? ''
  const myInk = inks[inkId] ?? []
  const myRedo = redos[inkId] ?? []
  function pushStroke(s: Stroke) {
    setInks(prev => ({ ...prev, [inkId]: [...(prev[inkId] ?? []), s] }))
    setRedos(prev => ({ ...prev, [inkId]: [] }))
  }
  function undoInk() {
    if (myInk.length === 0) return
    setInks(prev => ({ ...prev, [inkId]: myInk.slice(0, -1) }))
    setRedos(prev => ({ ...prev, [inkId]: [...myRedo, myInk[myInk.length - 1]] }))
  }
  function redoInk() {
    if (myRedo.length === 0) return
    setRedos(prev => ({ ...prev, [inkId]: myRedo.slice(0, -1) }))
    setInks(prev => ({ ...prev, [inkId]: [...myInk, myRedo[myRedo.length - 1]] }))
  }
  function clearInk() {
    if (myInk.length === 0) return
    if (!confirm('이 문제의 필기를 모두 지울까요?')) return
    setInks(prev => ({ ...prev, [inkId]: [] }))
    setRedos(prev => ({ ...prev, [inkId]: [] }))
  }
  const toolBtn = (on: boolean) =>
    `flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-bold transition ${
      on ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink2 hover:text-ink'}`

  function mark(correct: boolean) {
    if (!current) return
    apply(step(state, current.id, correct, new Date().toISOString(), top))
  }

  /** 학생 답을 채점한다. **맞으면 곧바로 다음 단계로 넘어간다.**
   *  틀렸을 때만 정답·해설을 띄우고 [다음 문제로] 를 한 번 누르게 한다 —
   *  틀린 문제의 해설을 못 보고 넘어가면 사다리를 타는 뜻이 없다. */
  function judge(answer: string) {
    if (!current || judged !== null) return
    const ok = autoCorrect(current, answer)
    setJudged(ok)
    setRevealed(true)
    if (ok) mark(true)
  }

  // ── 마스터 / 선생님 호출 ──────────────────────────────────────────────
  if (state.mastered) {
    return (
      <Frame typeName={typeName} state={state} top={top} sets={sets} onClose={onClose}>
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
      <Frame typeName={typeName} state={state} top={top} sets={sets} onClose={onClose}>
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

  // ── 오늘 몫을 다 썼다 ─────────────────────────────────────────────────
  // 🔴 마스터·선생님 호출보다 «뒤»에 둔다 — 마지막 문제로 마스터했으면 축하를 먼저 보여 준다.
  //    개념 빈칸(0층)보다는 «앞»이다. 상한에 닿았는데 새 유형의 개념만 계속 넘기게 두면 끊은 뜻이 없다.
  if (capped && judged === null && !revealed) {
    return (
      <Frame typeName={typeName} state={state} top={top} sets={sets} onClose={onClose}>
        <div className="py-8 text-center">
          <div className="text-3xl">🌙</div>
          <p className="mt-3 text-base font-black text-pine-dark">오늘 몫을 다 풀었어요</p>
          <p className="mt-1 text-sm text-ink2">
            {sets.setNo}세트 · 오늘 {sets.done}문제 — 수고했어요.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-ink2">
            여기까지 푼 것은 그대로 남아 있어요.<br />
            다음에 오면 <b>이 자리에서 이어서</b> 다음 세트를 풉니다.
          </p>
          <Trail state={state} />
          <div className="mt-4 flex flex-col items-center gap-2">
            {onClose && (
              <button type="button" onClick={onClose}
                className="w-full rounded-lg bg-pine py-2.5 text-sm font-bold text-paper hover:bg-pine-dark">
                오늘은 여기까지
              </button>
            )}
            <button type="button" onClick={() => setExtend(true)}
              className="text-[11px] text-ink2 underline hover:text-ink">
              조금 더 풀기
            </button>
          </div>
        </div>
      </Frame>
    )
  }

  // ── 0층: 개념 빈칸 ────────────────────────────────────────────────────
  if (state.floor === 0) {
    const b: ConceptBlank | undefined = blanks[blankIdx]
    return (
      <Frame typeName={typeName} state={state} top={top} sets={sets} onClose={onClose}>
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
    <Frame typeName={typeName} state={state} top={top} sets={sets} onClose={onClose}>
      {msg && <Banner event={event} msg={msg} />}
      {!current ? (
        <div className="py-10 text-center text-sm text-ink2">
          이 유형은 아직 풀 문제가 없습니다.
          <div className="mt-2 text-xs">문제은행에 이 유형 문항이 들어오면 다시 이어서 할 수 있어요.</div>
          {/* 🔴 2026-10-02 명수쌤: 낼 문제가 0이면 빈 화면 대신 다음으로 — 범위 모드면 다음 오답 유형, 아니면 목록. 정복으로 치지 않는다 */}
          {onSkip && (
            <button type="button" onClick={onSkip}
              className="mt-4 rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper hover:brightness-110">
              {skipLabel ?? '다음 오답 유형으로 →'}
            </button>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className="rounded bg-pine-soft px-2 py-0.5 font-bold text-pine-dark">
              {FLOOR_NAME[state.floor]}
            </span>
            <span className="rounded bg-paper2 px-2 py-0.5">{DIFF_LABEL[current.diff]}</span>
            <span className="text-ink2">{FLOOR_DESC[state.floor]}</span>
            {/* ❓ 학생 화면에서만 보인다(선생님 화면의 승강제는 학생 컨텍스트가 없어 버튼이 안 그려진다) */}
            <span className="ml-auto">
              <AskProblemButton p={current} where="승강제" label={`${typeName} · ${FLOOR_NAME[state.floor]}`}
                studentAnswer={judged !== null ? (picked !== null ? '①②③④⑤'[picked] : sel || input.trim() || undefined) : undefined}
                correct={judged === null ? undefined : judged === true} />
            </span>
          </div>

          <div className="rounded-xl border border-line p-4">
            {/* ✏️ 필기 도구줄 — 학습지 풀이 화면과 같은 단추(↶ ↷ 펜 지우개 🗑 + 펜 설정) */}
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-ink2">
                {tool === 'none' ? '✏️ 펜을 누르면 문제 위·아래 칸에 풀이를 쓸 수 있어요' : tool === 'pen' ? '✏️ 쓰는 중 — 펜을 한 번 더 누르면 펜 설정' : '◻ 지우는 중'}
              </span>
              <div className="grow" />
              <div className="relative flex items-center gap-1.5">
                <button type="button" onClick={undoInk} disabled={myInk.length === 0} title="되돌리기"
                  className={`${toolBtn(false)} disabled:opacity-30`}>↶</button>
                <button type="button" onClick={redoInk} disabled={myRedo.length === 0} title="다시하기"
                  className={`${toolBtn(false)} disabled:opacity-30`}>↷</button>
                <button type="button" onClick={() => { setTool('pen'); setPenPop(v => tool === 'pen' ? !v : false) }} title="펜 (다시 누르면 펜 설정)"
                  className={toolBtn(tool === 'pen')}>
                  <span style={tool === 'pen' ? undefined : { color: penColor }}>✏️</span>
                </button>
                <button type="button" onClick={() => { setTool('eraser'); setPenPop(false) }} title="지우개" className={toolBtn(tool === 'eraser')}>◻</button>
                <button type="button" onClick={clearInk} disabled={myInk.length === 0} title="전체 지우기"
                  className={`${toolBtn(false)} disabled:opacity-30`}>🗑</button>

                {/* 펜 설정 — 손으로 쓰기 · 연필 소리 · 굵기 5 · 색 5 */}
                {penPop && (
                  <div className="absolute right-0 top-11 z-40 w-64 rounded-2xl border border-line bg-white p-4 shadow-xl">
                    <div className="mb-3 flex items-center justify-between">
                      <b className="text-sm">펜 설정</b>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-ink2">
                        손으로 쓰기
                        <button type="button" onClick={() => setHandWrite(v => !v)} role="switch" aria-checked={handWrite}
                          title="끄면 스타일러스 펜으로만 필기돼요"
                          className={`h-5 w-9 rounded-full p-0.5 transition ${handWrite ? 'bg-pine' : 'bg-line'}`}>
                          <span className={`block h-4 w-4 rounded-full bg-white shadow transition ${handWrite ? 'translate-x-4' : ''}`} />
                        </button>
                      </label>
                    </div>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold text-ink2">✏️ 연필 소리</span>
                      <button type="button" onClick={() => { const v = !penSound; setPenSound(v); pencil.setSoundOn(v) }}
                        role="switch" aria-checked={penSound}
                        title="쓸 때 사각사각 소리가 나요. 교실이 시끄러우면 끄세요"
                        className={`h-5 w-9 rounded-full p-0.5 transition ${penSound ? 'bg-pine' : 'bg-line'}`}>
                        <span className={`block h-4 w-4 rounded-full bg-white shadow transition ${penSound ? 'translate-x-4' : ''}`} />
                      </button>
                    </div>
                    <div className="mb-3 flex items-center justify-between px-1">
                      {PEN_SIZES.map((sz, i) => (
                        <button type="button" key={i} onClick={() => setPenSize(i)}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${penSize === i ? 'bg-paper2 ring-1 ring-pine' : 'hover:bg-paper2/60'}`}>
                          <span className="rounded-full bg-ink" style={{ width: sz * 2, height: sz * 2 }} />
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between px-1">
                      {PEN_COLORS.map(c => (
                        <button type="button" key={c} onClick={() => setPenColor(c)}
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

            {/* 문제 본문 + 그 아래 빈 풀이 칸 — 둘 다 필기 캔버스 안이다.
                🔴 보기 버튼은 캔버스 «밖»에 둔다 — 펜을 고른 동안 캔버스가 터치를 받으므로 안에 두면 안 눌린다 */}
            <InkCanvas
              strokes={myInk}
              live
              tool={tool}
              color={penColor}
              size={PEN_SIZES[penSize]}
              handWrite={handWrite}
              onCommit={pushStroke}>
              {/* 보기는 아래에서 **클릭 버튼**으로 직접 그린다 — 여기서 또 그리면 두 번 나온다 */}
              <ProblemContent p={current} hideChoices />
              <div className="mt-3 flex h-72 items-start justify-end rounded-lg border border-dashed border-line/80 bg-paper2/20 p-2">
                {myInk.length === 0 && <span className="text-[11px] text-ink2/60">풀이 칸</span>}
              </div>
            </InkCanvas>
            {isChoice && (
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                {(current.choices ?? ['', '', '', '', '']).map((c, i) => (
                  <button key={i} type="button" disabled={judged !== null}
                    onClick={() => { if (multi) setSel(v => toggleChoice(v, '①②③④⑤'[i])); else { setPicked(i); judge('①②③④⑤'[i]) } }}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${
                      (multi ? sel.split(',').includes('①②③④⑤'[i]) : picked === i) ? 'border-pine bg-pine-soft font-bold' : 'border-line hover:bg-paper2'
                    }`}>
                    {'①②③④⑤'[i]}{c ? <> <MathText text={c} /></> : null}
                  </button>
                ))}
              </div>
            )}
            {multi && judged === null && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink2">정답이 여러 개인 문제예요 — 해당 번호를 모두 고른 뒤 제출해요</span>
                <button type="button" disabled={!sel} onClick={() => judge(sel)}
                  className="ml-auto rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper disabled:opacity-40">
                  제출
                </button>
              </div>
            )}
          </div>

          {/* 채점 — 학생이 답을 넣으면 **자동으로** 맞는지 보고 단계를 옮긴다 */}
          {judged === null && !isChoice && !isSelfGraded(current) && nParts > 0 && (
            <form className="mt-3 flex items-end gap-2"
              onSubmit={(e) => { e.preventDefault(); if (joinedParts) { setInput(joinedParts); judge(joinedParts) } }}>
              <div className="grid flex-1 gap-1.5">
                <span className="text-[11px] text-ink2">답이 {nParts}개인 문제예요 — 칸마다 하나씩 적어요</span>
                {Array.from({ length: nParts }, (_, k) => (
                  <div key={k} className="flex items-start gap-2">
                    {labeled && <span className="mt-2 w-8 shrink-0 text-sm font-bold text-ink2">({labeled[k].label})</span>}
                    <MathAnswerField
                      value={partVals[k] ?? ''} level={kp} width="w-40" placeholder={`답 ${k + 1}`}
                      defaultOpen={k === 0}
                      onChange={(v) => setPartVals(pv => { const n = [...pv]; n[k] = v; return n })}
                      onSubmit={() => { if (joinedParts) { setInput(joinedParts); judge(joinedParts) } }}
                    />
                  </div>
                ))}
              </div>
              <button type="submit" disabled={!joinedParts}
                className="rounded-lg bg-pine px-5 py-2.5 text-sm font-bold text-paper disabled:opacity-40">
                제출
              </button>
            </form>
          )}
          {judged === null && !isChoice && !isSelfGraded(current) && nParts === 0 && (
            <form className="mt-3"
              onSubmit={(e) => { e.preventDefault(); if (input.trim()) judge(input) }}>
              <div className="flex flex-wrap items-start gap-2">
                <MathAnswerField
                  value={input} onChange={setInput} level={kp} width="w-44" defaultOpen
                  hideUnits={!!unit} placeholder={unit ? '숫자만' : '답 입력'}
                  onSubmit={() => { if (input.trim()) judge(input) }}
                />
                {unit && <span className="mt-2 text-sm font-bold text-ink">{unit.label}</span>}
                <button type="submit" disabled={!input.trim()}
                  className="mt-0.5 rounded-lg bg-pine px-5 py-2.5 text-sm font-bold text-paper disabled:opacity-40">
                  제출
                </button>
              </div>
              {unit && (
                <span className="mt-1 block text-[11px] text-ink2">
                  단위 {unit.label}는 이미 적혀 있어요 — 숫자(값)만 넣으면 돼요
                </span>
              )}
            </form>
          )}

          {/* 정답이 이미지로만 오는 문항(서술형 등)은 기계가 못 읽는다 — 스스로 대조한다 */}
          {judged === null && !isChoice && isSelfGraded(current) && (
            !revealed ? (
              <button type="button" onClick={() => setRevealed(true)}
                className="mt-3 w-full rounded-lg border border-pine py-2.5 text-sm font-bold text-pine hover:bg-pine-soft">
                풀었습니다 — 정답 보기
              </button>
            ) : (
              <div className="mt-3 rounded-xl border border-line bg-paper2/40 p-3">
                <p className="text-xs text-ink2">이 문항은 자동 채점이 안 됩니다. 정답과 대조해 직접 표시해 주세요.</p>
                {isImgAnswer(String(current.answer ?? ''))
                  ? <img src={String(current.answer)} alt="정답" className="mt-2 max-h-16" />
                  : <div className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-2 text-sm font-bold">{String(current.answer)}</div>}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => { setJudged(true); mark(true) }}
                    className="flex-1 rounded-lg bg-pine py-2.5 text-sm font-bold text-paper">맞았어요</button>
                  <button type="button" onClick={() => setJudged(false)}
                    className="flex-1 rounded-lg border border-amber py-2.5 text-sm font-bold text-amber">틀렸어요</button>
                </div>
              </div>
            )
          )}

          {/* 틀렸을 때만 멈춰서 정답·해설을 보여 준다 */}
          {judged === false && (
            <div className="mt-3 rounded-xl border border-clay/40 bg-red-50/60 p-3">
              <p className="text-sm font-bold text-clay">✕ 틀렸습니다</p>
              <div className="mt-2 text-sm">
                <b>정답</b>{' '}
                {isImgAnswer(String(current.answer ?? ''))
                  ? <img src={String(current.answer)} alt="정답" className="inline-block max-h-6 align-middle" />
                  : <MathText text={String(current.answer ?? '')} />}
              </div>
              {current.solution && !current.solution.startsWith('http') && (
                <div className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-ink2">
                  <MathText text={current.solution} />
                </div>
              )}
              {current.solution?.startsWith('http') && (
                <img src={current.solution} alt="해설" className="mt-2 w-full max-w-[430px]" />
              )}
              <button type="button" onClick={() => mark(false)}
                className="mt-3 w-full rounded-lg bg-clay py-2.5 text-sm font-bold text-white">
                해설을 봤습니다 — 한 단계 내려가기
              </button>
            </div>
          )}
        </div>
      )}
    </Frame>
  )
}

// ── 껍데기 ────────────────────────────────────────────────────────────────

function Frame({ typeName, state, top, sets, onClose, children }: {
  typeName: string; state: MasteryState; top: Floor
  sets?: TodaySet                      // 🪜 오늘 몫 — 몇 세트째 · 오늘 몇/몇 문제
  onClose?: () => void; children: React.ReactNode
}) {
  const pct = progressPercent(state, top)
  const steps = Array.from({ length: top + 1 }, (_, i) => i as Floor)
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-black">🪜 {typeName}</p>
          <p className="text-[11px] text-ink2">
            {top + 1}단계 중 {state.floor + 1}단계 · {FLOOR_NAME[state.floor]} · 연속 {state.streak}/{UP_STREAK}
            {state.log.length > 0 && ` · 지금까지 ${state.log.length}문제`}
          </p>
          {sets && (
            <p className="mt-0.5 text-[11px] font-semibold text-pine-dark">
              {sets.setNo}세트 · 오늘 {sets.done}/{sets.cap}문제
              {sets.left > 0 ? ` · 앞으로 ${sets.left}` : ' · 오늘 몫 끝'}
            </p>
          )}
        </div>
        {onClose && (
          <button type="button" onClick={onClose}
            className="ml-auto rounded-lg px-2 py-1 text-ink2 hover:bg-paper2">✕</button>
        )}
      </div>

      {/* 사다리 — 지금 어느 층인지 한눈에 */}
      <div className="mb-3 flex items-center gap-1">
        {steps.map((f) => (
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

      {/* 🪜 오늘 몫 — 사다리(이 유형의 진행)와 따로 보여 준다. 학생이 「오늘 얼마 남았나」를 알아야 한다 */}
      {sets && (
        <div className="mb-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-line">
            <div className="h-1.5 rounded-full bg-amber transition-all"
              style={{ width: `${Math.min(100, Math.round((sets.done / Math.max(1, sets.cap)) * 100))}%` }} />
          </div>
          <span className="shrink-0 text-[10px] text-ink2">오늘 {sets.done}/{sets.cap}</span>
        </div>
      )}

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
