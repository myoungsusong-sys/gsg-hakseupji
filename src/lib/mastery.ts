import type { Problem, Diff } from '../types'
import { CONCEPTS } from '../data/concepts'
import { CURRICULA } from '../data/curriculum'
import { buildSixSet, subUnitMap } from './sixSet'

/**
 * 🪜 유형 마스터 — 틀리면 내려가고 맞히면 올라가는 **적응형 사다리** (2026-09-05 명수쌤 지시)
 *
 *   "기본 유형 문제를 학생이 틀렸을 때 개념 빈칸부터 다시 돌아가서,
 *    다음 단계 다음 단계를 계속 이어지게 해서 유형을 마스터하게 시키는 것.
 *    단계 올렸는데 틀리면 다시 내려서 이해시키고 다음 단계로 올라가는 툴."
 *
 * ## 왜 「목록」이 아니라 「루프」인가
 * 6종 세트를 한 번에 늘어놓으면 학생은 그냥 순서대로 푼다 — 틀린 자리에서 멈추지 않는다.
 * 마스터리는 **틀린 지점에서 아래로 내려가 이해시키고, 다시 올라오는 것**이다.
 * 그래서 이 엔진은 문항 목록이 아니라 **다음 한 문제**를 준다.
 *
 * ## 사다리 (0층이 개념)
 *   0층 개념 빈칸  — 소단원 개념의 핵심 낱말을 가린 빈칸. 문제가 아니라 **이해 확인**이다
 *   1층 기본       — 난이도 한 단계 아래
 *   2층 표준       — 기준 문항의 난이도
 *   3층 심화1      — +1
 *   4층 심화2      — +2
 *
 * ## 오르내림 규칙 (실제 학습에서 검증된 형태로 단순하게)
 *   · 맞히면      → 한 층 위로. 단, **연속 2개**를 맞혀야 올라간다(찍어서 올라가는 것 방지)
 *   · 틀리면      → 한 층 아래로. 그 층에서 **다시 2개 연속**을 맞혀야 재도전
 *   · 1층에서 틀림 → **0층(개념)으로 내려간다.** 이것이 "개념 빈칸부터 다시"의 실체다
 *   · 4층에서 2연속 → **마스터**. 루프 종료
 *   · 같은 층에서 3번 틀리면 → 선생님 호출(혼자 뚫을 수 없는 지점이다. 붙잡아 두지 않는다)
 *
 * ## 상태는 학생·유형 단위로 남는다
 * 오늘 3층까지 갔다가 내일 다시 1층부터 시작하면 의미가 없다. `MasteryState` 를 저장해
 * 이어서 오르내린다.
 */

export type Floor = 0 | 1 | 2 | 3 | 4

export const FLOOR_NAME: Record<Floor, string> = {
  0: '개념',
  1: '기본',
  2: '표준',
  3: '심화',
  4: '최상',
}

export const FLOOR_DESC: Record<Floor, string> = {
  0: '개념 빈칸 — 무엇을 몰랐는지 먼저 확인합니다',
  1: '기본 — 한 단계 쉬운 문제로 감을 잡습니다',
  2: '표준 — 이 유형의 기준 문제입니다',
  3: '심화 — 한 단계 어려운 문제입니다',
  4: '최상 — 여기까지 맞히면 이 유형은 끝입니다',
}

/** 올라가려면 필요한 연속 정답 수 — 찍어서 통과하는 것을 막는다 */
export const UP_STREAK = 2
/** 같은 층에서 이만큼 틀리면 선생님을 부른다 */
export const STUCK_LIMIT = 3

export interface MasteryState {
  studentId: string
  typeId: string
  floor: Floor
  /** 이 층에서 연속으로 맞힌 수 */
  streak: number
  /** 이 층에서 누적 틀린 수 (층을 옮기면 0으로) */
  missAtFloor: number
  /**
   * 층과 무관하게 **연속으로** 틀린 수. 층을 옮겨도 안 지워진다.
   *
   * 🔴 왜 따로 두나 (2026-09-05 시뮬레이션에서 발견)
   *    처음엔 missAtFloor 만으로 「3번 틀리면 선생님 호출」을 판정했는데,
   *    틀릴 때마다 층을 내려가면서 그 값이 0으로 초기화돼 **영영 3에 닿지 않았다.**
   *    실제로는 「표준✗ → 기본✗ → 개념✗」 처럼 계속 틀리며 바닥까지 내려가도
   *    호출이 안 걸린다. 학생이 혼자 헤매는 것을 못 잡는 셈이라 별도 카운터를 둔다.
   */
  missStreak: number
  /** 이미 낸 문항 — 같은 문제를 두 번 내지 않는다 */
  servedIds: string[]
  /** 층별 시도 기록 — 선생님이 어디서 막혔는지 본다 */
  log: { at: string; floor: Floor; problemId: string; correct: boolean }[]
  mastered: boolean
  /** 선생님 호출이 걸린 상태인가 */
  needsTeacher: boolean
}

export function newMastery(studentId: string, typeId: string, startFloor: Floor = 2): MasteryState {
  return {
    studentId, typeId, floor: startFloor, streak: 0, missAtFloor: 0, missStreak: 0,
    servedIds: [], log: [], mastered: false, needsTeacher: false,
  }
}

// ── 개념 빈칸 (0층) ──────────────────────────────────────────────────────────

export interface ConceptBlank {
  conceptId: string
  title: string
  /** 빈칸이 뚫린 문장 — 빈칸은 ○○○ / □ 로 표시 */
  text: string
  /** 가려진 낱말 또는 수식 (정답) */
  answer: string
  /** 원문 — 채점 후 보여 준다 */
  full: string
  /** 낱말을 가렸나(용어) 수식을 가렸나(공식) — 화면에서 구분해 보여 준다 */
  kind: '용어' | '공식'
}

/** typeId → 소단원 id */
function subIdOf(typeId: string): string | undefined {
  for (const c of CURRICULA)
    for (const u of c.units)
      for (const m of u.mids)
        for (const s of m.subs)
          if (s.types.some((t) => t.id === typeId)) return s.id
  return undefined
}

/** 예시·부연은 공식이 아니다 — 이런 줄에서 수식을 가리면 "예: □" 같은 답 없는 빈칸이 된다 */
const EXAMPLE_LINE = /^\s*(예|예시|참고|주의)\s*[:：]/

/**
 * 개념 문장에서 빈칸을 만든다 — **용어**와 **공식** 두 갈래 (2026-09-05 명수쌤
 * "해당 문제에 사용되는 공식이나 개념 빈칸도 다 만들어서 가장 기본 단계로").
 *
 * ## 용어 빈칸
 * 「소인수분해: 자연수를 …」 처럼 정의어가 앞에 오는 줄에서 그 낱말을 가린다.
 * 정의어가 없으면 가장 긴 한글 낱말(대개 그 문장의 핵심어)을 가린다.
 *
 * ## 공식 빈칸
 * 등식 `A = B` 가 든 줄에서 **우변을 가린다.** 학생이 "무엇 = ?" 을 채우게 하는 것이
 * 공식 암기 확인의 본형이다. 좌변을 가리면 답이 여럿일 수 있어 채점이 흔들린다.
 *
 * ## 안 가리는 것
 *  · 「예: …」 「참고: …」 로 시작하는 부연 — 가려도 답이 정해지지 않는다
 *  · 수식이 하나도 없는 줄에서 공식 빈칸을 억지로 만들지 않는다
 *
 * 한 소단원에서 **용어 2개 + 공식 3개**까지 뽑는다. 개념 확인이 길어지면 학생이 지친다.
 */
/** 괄호·중괄호 **밖**(깊이 0)에 있는 첫 등호. 없으면 -1.
 *  `\mathrm{P}(X = x_i) = p_i` 에서 앞의 등호를 잡아 「$P(X = □ (i=1,…)」 처럼
 *  수식을 두 동강 내던 사고를 막는다. */
function topLevelEq(s: string): number {
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '\\') { i++; continue }              // \{ \} \left( 는 글자다
    if (ch === '(' || ch === '{' || ch === '[') depth++
    else if (ch === ')' || ch === '}' || ch === ']') depth--
    else if (ch === '=' && depth === 0 && s[i + 1] !== '=') return i
  }
  return -1
}

/** 우변이 빈칸으로 낼 값어치가 있나. `y=f(x)`·`P(X=a)=0` 같은 건 문제가 안 된다 */
const WORTH_ASKING = /[0-9^_]|\\d?frac|\\sqrt|\\sum|\\int|\\times|\\div|\\cdot|\\pi|[+\-]/

/** 「소인수: 어떤 자연수의 …」 처럼 **줄머리에 정의어**가 있는 것만 용어 빈칸으로 쓴다.
 *  문장 한가운데서 가장 긴 낱말을 집으면 「최대공약수의」·「소인수분해했을」 처럼
 *  조사가 붙은 채 잘려 답을 쓸 수 없다. */
const DEF_HEAD = /^([가-힣][가-힣A-Za-z0-9·()]{1,11})(?:\s*\$[^$]*\$)?\s*[:：]/

/** 「최대·최소(2)」·「성질」처럼 **소제목**은 용어가 아니다 — 답으로 쓰지 않는다 */
const LABEL_WORDS = /^(성질|참고|주의|방법|유형|정리|공식|핵심|조건|계산|풀이|요약|보기|순서|절차)$/
const GOOD_TERM = (w: string) => !/[0-9]/.test(w) && !LABEL_WORDS.test(w) && w.length >= 2

/** 개념카드 제목에서 가릴 만한 낱말들 (「소수와 합성수」 → 소수, 합성수) */
function titleWords(t: string): string[] {
  return t.split(/[\s,·]+|와 |과 |의 /)
    .map((w) => w.replace(/[()]/g, '').trim())
    .filter((w) => /^[가-힣]{2,10}$/.test(w) && GOOD_TERM(w))
}

export function conceptBlanks(typeId: string): ConceptBlank[] {
  const sid = subIdOf(typeId)
  if (!sid) return []
  const terms: ConceptBlank[] = []
  const formulas: ConceptBlank[] = []

  for (const c of CONCEPTS.filter((x) => x.subId === sid)) {
    for (const line of c.lines) {
      if (EXAMPLE_LINE.test(line)) continue

      // ── 공식 빈칸: 등식의 우변을 가린다 ──────────────────────────────
      if (formulas.length < 3) {
        let done = false
        for (const m of line.matchAll(/\$([^$]+)\$/g)) {
          const inner = m[1]
          const i = topLevelEq(inner)
          if (i <= 0) continue
          const rhs = inner.slice(i + 1).trim()
          if (rhs.length < 2 || !WORTH_ASKING.test(rhs)) continue
          formulas.push({
            conceptId: c.id, title: c.title,
            text: line.replace(m[0], `$${inner.slice(0, i + 1)}\\;\\square$`),
            answer: rhs, full: line, kind: '공식',
          })
          done = true
          break
        }
        if (done) continue            // 한 줄에서 공식·용어를 둘 다 뽑지 않는다
      }

      // ── 용어 빈칸 ────────────────────────────────────────────────────
      if (terms.length >= 2) continue
      const word = line.match(DEF_HEAD)?.[1]
      if (!word || !GOOD_TERM(word)) continue
      terms.push({
        conceptId: c.id, title: c.title,
        text: line.replace(word, '○'.repeat(Math.min(word.length, 4))),
        answer: word, full: line, kind: '용어',
      })
    }
  }
  // 정의줄도 등식도 없는 소단원 — 개념카드 제목 낱말을 본문에서 찾아 가린다
  if (!terms.length && !formulas.length) {
    for (const c of CONCEPTS.filter((x) => x.subId === sid)) {
      for (const w of titleWords(c.title)) {
        const line = c.lines.find((l) => l.includes(w) && !EXAMPLE_LINE.test(l))
        if (!line) continue
        terms.push({
          conceptId: c.id, title: c.title,
          text: line.replace(w, '○'.repeat(Math.min(w.length, 4))),
          answer: w, full: line, kind: '용어',
        })
        break
      }
      if (terms.length >= 2) break
    }
  }
  // 용어(무엇인가) → 공식(어떻게 쓰나) 순서가 이해에 맞다
  return [...terms, ...formulas]
}

// ── 층별 문항 고르기 ─────────────────────────────────────────────────────────

const clampFloor = (n: number): Floor => Math.min(4, Math.max(0, n)) as Floor

/**
 * 그 층에 맞는 문항 하나. 6종 세트의 난이도 사다리를 그대로 쓴다
 * (사다리 계산은 sixSet.ts 에 한 번만 두고 여기서 재사용한다).
 */
export function pickForFloor(
  state: MasteryState,
  base: Problem,
  pool: Problem[],
): Problem | null {
  const used = new Set(state.servedIds)
  const set = buildSixSet(base, pool, subUnitMap(), used)
  const slot = ({ 1: '기본', 2: '쌍둥이', 3: '심화1', 4: '심화2' } as const)[
    state.floor as 1 | 2 | 3 | 4
  ]
  // 2층(표준)은 기준 문항과 같은 난이도의 다른 문제 = 쌍둥이 자리
  const p = set.items[slot]
  if (p) return p
  // 세트에 없으면 같은 유형에서 난이도로 직접 고른다
  const want = clampDiffOfFloor(state.floor, base.diff)
  const cands = pool.filter((x) => x.typeId === base.typeId && !used.has(x.id))
  return cands.find((x) => x.diff === want)
    ?? cands.sort((a, b) => Math.abs(a.diff - want) - Math.abs(b.diff - want))[0]
    ?? null
}

function clampDiffOfFloor(floor: Floor, baseDiff: Diff): Diff {
  const delta = { 0: -1, 1: -1, 2: 0, 3: 1, 4: 2 }[floor]
  return Math.min(5, Math.max(1, baseDiff + delta)) as Diff
}

// ── 채점 후 다음 층 결정 ─────────────────────────────────────────────────────

export interface StepResult {
  next: MasteryState
  /** 이번 채점으로 무슨 일이 일어났나 — 화면에 그대로 보여 준다 */
  event: '올라감' | '내려감' | '유지' | '개념으로' | '마스터' | '선생님호출'
  message: string
}

/**
 * 한 문제를 채점하고 다음 상태를 낸다.
 *
 * 🔴 순서가 중요하다: **막힘 판정을 올림/내림보다 먼저** 한다.
 *    안 그러면 3번 틀린 학생을 또 아래층으로 내려보내 놓고 그다음에야 선생님을 부른다.
 */
export function step(
  state: MasteryState,
  problemId: string,
  correct: boolean,
  now: string,
): StepResult {
  const s: MasteryState = {
    ...state,
    servedIds: [...state.servedIds, problemId],
    log: [...state.log, { at: now, floor: state.floor, problemId, correct }],
  }

  if (correct) {
    s.streak = state.streak + 1
    s.missStreak = 0                     // 맞히면 연속 오답은 끊긴다
    if (s.streak < UP_STREAK) {
      return { next: s, event: '유지',
        message: `맞았습니다. ${FLOOR_NAME[s.floor]} 단계에서 ${UP_STREAK - s.streak}문제만 더 맞히면 올라갑니다.` }
    }
    if (s.floor >= 4) {
      s.mastered = true
      return { next: s, event: '마스터', message: '이 유형을 마스터했습니다. 최상 단계까지 연속으로 맞혔습니다.' }
    }
    const up = clampFloor(s.floor + 1)
    s.floor = up; s.streak = 0; s.missAtFloor = 0
    return { next: s, event: '올라감',
      message: `연속 ${UP_STREAK}문제 정답 — ${FLOOR_NAME[up]} 단계로 올라갑니다.` }
  }

  // 틀렸다
  s.streak = 0
  s.missAtFloor = state.missAtFloor + 1
  s.missStreak = state.missStreak + 1

  // 막힘 판정은 **연속 오답**으로 — 층을 내려가며 계속 틀리는 경우를 잡아야 한다
  if (s.missStreak >= STUCK_LIMIT || s.missAtFloor >= STUCK_LIMIT) {
    s.needsTeacher = true
    return { next: s, event: '선생님호출',
      message: `${STUCK_LIMIT}번 연속으로 막혔습니다(${FLOOR_NAME[s.floor]} 단계). 선생님 설명이 필요합니다.` }
  }

  if (s.floor <= 1) {
    // 기본에서 틀렸다 = 개념이 안 잡힌 것. 여기가 "개념 빈칸부터 다시"의 자리다
    s.floor = 0; s.missAtFloor = 0
    return { next: s, event: '개념으로',
      message: '기본 문제에서 막혔습니다. 개념부터 다시 확인하고 올라갑시다.' }
  }

  const down = clampFloor(s.floor - 1)
  s.floor = down; s.missAtFloor = 0
  return { next: s, event: '내려감',
    message: `${FLOOR_NAME[down]} 단계로 내려갑니다. 여기서 ${UP_STREAK}문제를 맞히면 다시 올라갑니다.` }
}

/** 개념 빈칸(0층)을 통과했을 때 — 1층으로 올린다 */
export function passConcept(state: MasteryState): StepResult {
  const s: MasteryState = { ...state, floor: 1, streak: 0, missAtFloor: 0, missStreak: 0 }
  return { next: s, event: '올라감', message: '개념을 확인했습니다. 기본 문제부터 다시 시작합니다.' }
}

/** 화면 진행 막대용 — 0~100 */
export function progressPercent(s: MasteryState): number {
  if (s.mastered) return 100
  return Math.round(((s.floor + s.streak / UP_STREAK) / 5) * 100)
}
