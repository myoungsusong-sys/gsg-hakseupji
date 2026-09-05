import type { Problem, Diff } from '../types'
import { CURRICULA } from '../data/curriculum'

/**
 * 🎯 6종 세트 — 문항 하나에 딸린 여섯 갈래 (2026-09-05 명수쌤 스펙)
 *
 * 학생이 한 문항을 틀렸을 때, 무엇을 더 풀려야 하는가에 대한 답이다.
 * 매쓰플랫의 「쌍둥이/유사」보다 넓게 — **쉬운 쪽·같은 쪽·어려운 쪽**을 한 벌로 묶는다.
 *
 *   ① 기본     — 같은 유형, 난이도 한 단계 **아래** (막혔을 때 내려갈 곳)
 *   ② 쌍둥이   — 같은 템플릿, 숫자만 다른 것
 *   ③ 다른 답  — 같은 템플릿인데 **묻는 값이 다른** 것 (답을 외워서 맞히는 것을 막는다)
 *   ④ 유사유형 — 같은 소단원의 **다른 유형**, 난이도는 같게 (옆으로 넓히기)
 *   ⑤ 심화1    — 같은 유형, 난이도 **+1**
 *   ⑥ 심화2    — 같은 유형, 난이도 **+2**
 *
 * ## 재료가 없을 때 (실측에 근거한 대체 규칙)
 * 2026-09-05 중1-1 전수 측정: 유형 795개 중
 *   난이도 2종 이상 781 · 3종 이상 683 · 소단원에 유형 2개 이상 35/36
 * 즉 대부분 채워지지만 **전부는 아니다.** 빈칸을 억지로 채우면 엉뚱한 문항이 들어가므로,
 * 아래 순서로만 물러서고 그래도 없으면 **그 칸을 비운다**(없는 걸 있는 척하지 않는다).
 *   · ①⑤⑥ : 정확한 난이도 → 그 방향의 가장 가까운 난이도 → 없음
 *   · ②    : twinGroup → (없으면) 같은 유형·같은 난이도의 다른 문항
 *   · ③    : twinGroup 중 답이 다른 것 → 같은 유형 중 답이 다른 것
 *   · ④    : 같은 소단원 다른 유형 → 같은 중단원 다른 유형 → 없음
 *
 * ## 왜 소단원인가
 * 처음엔 중단원으로 잡았다가 「유사유형이 29%뿐」이라는 잘못된 결론을 냈다.
 * 실제로는 중1-1 소단원 36개 중 35개가 유형 2개 이상이다 — 소단원이 맞는 단위다.
 */

export type SixSlot = '기본' | '쌍둥이' | '다른답' | '유사유형' | '심화1' | '심화2'

export const SIX_SLOTS: SixSlot[] = ['기본', '쌍둥이', '다른답', '유사유형', '심화1', '심화2']

/** 슬롯별로 학생·선생님에게 보여줄 설명 — 왜 이 문제를 푸는지 알려 준다 */
export const SLOT_DESC: Record<SixSlot, string> = {
  기본: '한 단계 쉬운 같은 유형 — 막혔다면 여기부터',
  쌍둥이: '숫자만 바꾼 같은 문제',
  다른답: '같은 틀인데 묻는 것이 다른 문제',
  유사유형: '같은 소단원의 다른 유형',
  심화1: '한 단계 어려운 같은 유형',
  심화2: '두 단계 어려운 같은 유형',
}

export interface SixSet {
  base: Problem
  items: Partial<Record<SixSlot, Problem>>
  /** 못 채운 칸 — 화면에서 "없음"으로 정직하게 보여 준다 */
  missing: SixSlot[]
}

/** typeId → 소단원 id (curriculum 에서 미리 만들어 넘긴다) */
export type SubUnitMap = Map<string, string>

let _subMap: SubUnitMap | null = null
/**
 * 전 과정의 typeId → 소단원 지도. 한 번만 만들어 두고 재사용한다
 * (4,510유형을 화면 그릴 때마다 훑으면 느리다).
 */
export function subUnitMap(): SubUnitMap {
  if (_subMap) return _subMap
  const m: SubUnitMap = new Map()
  for (const c of CURRICULA)
    for (const u of c.units)
      for (const mid of u.mids)
        for (const s of mid.subs)
          for (const t of s.types) m.set(t.id, `${c.id}|${u.id}|${mid.id}|${s.name}`)
  _subMap = m
  return m
}

const clampDiff = (d: number): Diff => Math.min(5, Math.max(1, d)) as Diff

/** 난이도가 target 에 가장 가까운 것부터 — 같은 방향(위/아래)을 우선한다 */
function byDiffNear(target: number, dir: 1 | -1 | 0) {
  return (a: Problem, b: Problem) => {
    const da = a.diff - target
    const db = b.diff - target
    // 원하는 방향이면 가산점
    const sa = dir === 0 ? 0 : (Math.sign(da) === dir || da === 0 ? 0 : 1)
    const sb = dir === 0 ? 0 : (Math.sign(db) === dir || db === 0 ? 0 : 1)
    return sa !== sb ? sa - sb : Math.abs(da) - Math.abs(db)
  }
}

/**
 * 한 문항에 대한 6종 세트를 고른다.
 * used 에 담긴 id 는 쓰지 않는다(한 학습지 안에서 같은 문항이 두 번 나오지 않게).
 */
export function buildSixSet(
  base: Problem,
  pool: Problem[],
  subUnitOf: SubUnitMap,
  used: Set<string> = new Set(),
): SixSet {
  const taken = new Set<string>([base.id, ...used])
  const items: Partial<Record<SixSlot, Problem>> = {}
  const missing: SixSlot[] = []

  const free = (p: Problem) => !taken.has(p.id)
  const take = (slot: SixSlot, p: Problem | undefined) => {
    if (p) { items[slot] = p; taken.add(p.id) } else { missing.push(slot) }
  }

  const sameType = pool.filter((p) => p.typeId === base.typeId && free(p))
  const sameTwin = base.twinGroup
    ? sameType.filter((p) => p.twinGroup === base.twinGroup)
    : []

  // ② 쌍둥이 — 같은 템플릿. 없으면 같은 유형·같은 난이도로 대신한다
  take('쌍둥이',
    sameTwin.find((p) => free(p))
    ?? sameType.filter(free).sort(byDiffNear(base.diff, 0))[0])

  // ③ 다른 답 — 같은 틀인데 답이 다른 것. 답을 외워서 맞히는 것을 막는 자리다
  const diffAnswer = (p: Problem) => String(p.answer ?? '') !== String(base.answer ?? '')
  take('다른답',
    sameTwin.filter((p) => free(p) && diffAnswer(p))[0]
    ?? sameType.filter((p) => free(p) && diffAnswer(p)).sort(byDiffNear(base.diff, 0))[0])

  // ①⑤⑥ 난이도 사다리 — 아래 1칸 · 위 2칸
  //
  // 🔴 난이도 1인 문항은 「더 쉬운 것」이, 5인 문항은 「더 어려운 것」이 **원리상 없다.**
  //    (2026-09-05 중1-1 실측: 난이도 1 문항 16,580개는 아래 칸 0%, 5는 위 칸 0%)
  //    이럴 때 빈칸으로 두면 세트가 반쪽이 된다. 그래서 **사다리를 통째로 옮긴다** —
  //    기준이 1이면 [1,2,3], 5면 [3,4,5] 처럼 4칸 창을 데이터가 있는 쪽으로 민다.
  //    기준 문항은 그 창 안에 그대로 남으므로 학생이 보는 흐름(쉬운 것 → 원문항 → 어려운 것)은 지켜진다.
  const avail = new Set(sameType.map((p) => p.diff))
  avail.add(base.diff)
  const lo = Math.min(...avail)
  const hi = Math.max(...avail)
  // 원하는 창 [base-1, base+2] 를 실제 있는 난이도 범위 안으로 민다
  let winLo = base.diff - 1
  if (winLo < lo) winLo = lo
  if (winLo + 3 > hi) winLo = Math.max(lo, hi - 3)
  const want = {
    기본: clampDiff(winLo),
    심화1: clampDiff(Math.max(winLo + 2, base.diff + 1)),
    심화2: clampDiff(Math.max(winLo + 3, base.diff + 2)),
  } as const

  for (const slot of ['기본', '심화1', '심화2'] as const) {
    const w = want[slot]
    const dir: 1 | -1 = slot === '기본' ? -1 : 1
    take(slot,
      sameType.filter((p) => free(p) && p.diff === w)[0]
      // 정확한 난이도가 없으면 그 방향에서 가장 가까운 것
      ?? sameType.filter((p) => free(p) && (dir === -1 ? p.diff <= w : p.diff >= w))
          .sort(byDiffNear(w, dir))[0]
      // 그래도 없으면 같은 유형 아무거나(난이도 가까운 순) — 빈칸보다 낫다
      ?? sameType.filter(free).sort(byDiffNear(w, dir))[0])
  }

  // ④ 유사유형 — 같은 소단원의 다른 유형, 난이도는 같게
  //
  // 🔴 소단원을 못 찾는 문항이 많다 (2026-09-05 실측: 중1-1 풀에 795유형이 있는데
  //    22개정 커리큘럼에는 231개뿐 — 나머지 564개는 구 교육과정 수확분이라 트리에 없다).
  //    커리큘럼에 있는 유형만 보면 이 칸은 100% 채워진다. 그래서 트리에 없는 문항은
  //    **같은 난이도의 다른 유형**으로 물러선다 — 소단원만큼 가깝진 않지만
  //    "옆으로 넓히기"라는 이 칸의 목적은 지킨다. (아무것도 안 주는 것보다 낫다)
  const sub = subUnitOf.get(base.typeId)
  const other = (p: Problem) => free(p) && p.typeId !== base.typeId
  const sameSub = sub
    ? pool.filter((p) => other(p) && subUnitOf.get(p.typeId) === sub)
    : []
  take('유사유형',
    sameSub.sort(byDiffNear(base.diff, 0))[0]
    ?? pool.filter((p) => other(p) && p.diff === base.diff)[0]
    ?? pool.filter(other).sort(byDiffNear(base.diff, 0))[0])

  return { base, items, missing }
}

/** 여러 문항에 대해 한 번에 — 학습지 전체를 6종 세트로 부풀릴 때 */
export function buildSixSets(
  bases: Problem[],
  pool: Problem[],
  subUnitOf: SubUnitMap,
): SixSet[] {
  const used = new Set<string>()
  return bases.map((b) => {
    const s = buildSixSet(b, pool, subUnitOf, used)
    Object.values(s.items).forEach((p) => p && used.add(p.id))
    return s
  })
}

/** 6종 세트를 한 줄 학습지로 펼친다 — [기본, 원문항, 쌍둥이, 다른답, 유사, 심화1, 심화2] 순 */
export function flattenSixSet(s: SixSet): Problem[] {
  const order: (SixSlot | 'base')[] = ['기본', 'base', '쌍둥이', '다른답', '유사유형', '심화1', '심화2']
  return order
    .map((k) => (k === 'base' ? s.base : s.items[k]))
    .filter((p): p is Problem => Boolean(p))
}
