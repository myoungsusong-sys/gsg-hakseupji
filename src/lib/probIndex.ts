import type { Problem } from '../types'

// ── 문항 id → 문항 색인 (2026-09-21) ─────────────────────────────────────────────
//
// 🔴 명수쌤 2026-09-21: "김선엽 학습지 생성이 안돼" — 인앱에서 직접 해 보니 「수업 준비 → 학습지」 목록에서
//    ⋮ 한 번 누르는 데 45초 넘게 화면이 멈췄다. 목록이 다시 그려질 때마다 학습지마다·문항마다
//    `problems.find(...)` 로 문제은행 **전체(실측 666,123문항)** 를 처음부터 훑었기 때문이다
//    (학습지 186개 · 문항 5,922개 → 한 번 그리는 데 약 28초).
//    → 문제은행 배열 하나당 색인을 **한 번만** 만들어 재사용한다(배열 참조가 바뀌면 새로 만든다).
//      같은 id 가 둘이면 `find` 와 똑같이 **앞의 것**을 쓴다.
const cache = new WeakMap<readonly Problem[], Map<string, Problem>>()

export function probIndex(problems: readonly Problem[]): Map<string, Problem> {
  let m = cache.get(problems)
  if (!m) {
    m = new Map()
    for (const p of problems) if (!m.has(p.id)) m.set(p.id, p)
    cache.set(problems, m)
  }
  return m
}

// 유형 id → 문항 수 — 「학습지 만들기」 유형 목록이 유형마다 problems.filter 로 66만 문항을 셌다(체크 한 번에 수백 ms~초)
const countCache = new WeakMap<readonly Problem[], Map<string, number>>()

export function countByType(problems: readonly Problem[]): Map<string, number> {
  let m = countCache.get(problems)
  if (!m) {
    m = new Map()
    for (const p of problems) m.set(p.typeId, (m.get(p.typeId) ?? 0) + 1)
    countCache.set(problems, m)
  }
  return m
}
