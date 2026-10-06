import type { MasteryState } from './mastery'
import { normalizeMastery } from './mastery'
import { dateKey } from './dates'

/**
 * 🪜 오늘 몫 — 승강제를 «하루 문제 수»로 끊어 세트로 만든다 (2026-10-06 명수쌤 지시)
 *
 * 명수쌤 「과학 보니까 승강제 기본문제가 너무 많던데 나눠야하지않을까?
 *        학생이 하루에 와서 그걸 다 풀고 갈 수는 없으니까」
 *      → 「기본유형을 하루문제수로 하고 몇 세트를 만들어서 완전히 숙지할 수 있게 해줘」 · 과목 공통
 *
 * ## 왜 필요했나 (실측 2026-10-06)
 * 과학 문제은행은 유형 520개 · 문항 37,183개인데, 그중 **422개(81%)가 4층짜리**다.
 * 승강제는 한 층에서 2연속 정답이어야 올라가므로(UP_STREAK) 유형 하나에 **최소 8문제**,
 * 앞에 개념 빈칸이 붙고 한 번이라도 틀리면 그 층에서 2문제를 더 맞혀야 한다.
 * 정복 큐는 12유형까지 줄을 세우니(MasteryQueue limit) **최소 96문제** — 하루에 못 푼다.
 * 그런데 하루 상한이 **아예 없었다**.
 *
 * ## 어떻게 끊나
 * 하루에 푼 승강제 문제가 상한에 닿으면 그날은 거기서 멈춘다(= 한 세트). 다음에 오면
 * **그 자리에서 이어서** 다음 세트를 푼다 — 이미 푼 문제는 다시 안 나오고(servedIds),
 * 올라간 층도 그대로다(서버 settings.masteries 에 학생·유형별로 저장된다).
 * 그래서 여러 세트에 걸쳐 같은 유형을 되풀어 숙지하게 된다.
 *
 * 🔴 과목을 가리지 않고 **합쳐서** 센다(명수쌤 「과목 공통」). 과학에서 20문제를 풀면
 *    그날 수학 승강제도 멈춘다 — 학생이 하루에 쓸 수 있는 몫은 하나다.
 */

/** 하루에 푸는 승강제 문제 수 — 선생님이 바꿀 수 있다(관리 > 학생앱) */
export const DAILY_CAP_DEFAULT = 20
export const DAILY_CAP_MIN = 5
export const DAILY_CAP_MAX = 100

/** 0 이하·빈 값·엉뚱한 값이 와도 앱이 멈추지 않게 — 상한은 늘 쓸 수 있는 수로 만든다 */
export function normalizeCap(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n <= 0) return DAILY_CAP_DEFAULT
  return Math.min(DAILY_CAP_MAX, Math.max(DAILY_CAP_MIN, Math.round(n)))
}

type Masteries = Record<string, MasteryState | undefined>

/** `학생id|유형id` 키에서 이 학생 것만 골라 (유형id, 상태) 로 — 저장 형식이 덜 찬 것도 채워서 쓴다 */
function* entriesOf(masteries: Masteries | undefined, studentId: string) {
  for (const [k, raw] of Object.entries(masteries ?? {})) {
    const bar = k.indexOf('|')
    if (bar < 0 || k.slice(0, bar) !== studentId) continue
    const typeId = k.slice(bar + 1)
    const st = normalizeMastery(raw, studentId, typeId)
    if (st) yield [typeId, st] as const
  }
}

/** 그 학생이 «그날» 승강제에서 푼 문제 수. `exceptTypeId` 는 뺀다(그 유형은 부르는 쪽이 직접 센다) */
export function solvedOn(
  masteries: Masteries | undefined,
  studentId: string,
  day: string,
  exceptTypeId?: string,
): number {
  let n = 0
  for (const [typeId, st] of entriesOf(masteries, studentId)) {
    if (typeId === exceptTypeId) continue
    for (const l of st.log) if (l?.at && dateKey(l.at) === day) n++
  }
  return n
}

/** 지금까지 승강제를 푼 «서로 다른 날» 의 수 = 몇 세트째인가 (오늘 한 문제라도 풀면 오늘이 포함된다) */
export function setCountUpTo(
  masteries: Masteries | undefined,
  studentId: string,
  day: string,
): number {
  const days = new Set<string>()
  for (const [, st] of entriesOf(masteries, studentId)) {
    for (const l of st.log) {
      if (!l?.at) continue
      const d = dateKey(l.at)
      if (d <= day) days.add(d)
    }
  }
  return days.size
}

export interface TodaySet {
  /** 하루 문제 수 */
  cap: number
  /** 오늘 푼 문제 수 */
  done: number
  /** 앞으로 몇 문제 */
  left: number
  /** 오늘 몫을 다 썼나 */
  full: boolean
  /** 몇 세트째 — 오늘 아직 한 문제도 안 풀었으면 «이번이 N세트» 로 센다 */
  setNo: number
}

/**
 * 오늘 몫을 센다.
 *
 * @param extraToday 지금 화면에서 풀고 있는 유형이 오늘 푼 수 (store 에 저장되기 전 값).
 *                   `exceptTypeId` 와 짝으로 쓴다 — 같은 유형을 두 번 세지 않으려고.
 */
export function todaySet(
  masteries: Masteries | undefined,
  studentId: string,
  cap: unknown,
  opt?: { exceptTypeId?: string; extraToday?: number; now?: Date },
): TodaySet {
  const day = dateKey(opt?.now ?? new Date())
  const limit = normalizeCap(cap)
  const done = solvedOn(masteries, studentId, day, opt?.exceptTypeId) + (opt?.extraToday ?? 0)
  const past = setCountUpTo(masteries, studentId, day)
  // 오늘 아직 안 풀었으면 오늘이 «다음» 세트다. 한 문제라도 풀었으면 past 에 오늘이 들어 있다.
  const setNo = done > 0 ? Math.max(1, past) : past + 1
  return { cap: limit, done, left: Math.max(0, limit - done), full: done >= limit, setNo }
}
