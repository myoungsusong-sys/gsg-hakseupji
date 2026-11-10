import type { Problem } from '../types'

// ✍️ 서술형 본문제 + 하위문제 묶음 (2026-11-10)
// 나의 DB 에서 묶은 문항(Problem.groupMain)을 학습지에서 한 문제로 다룬다.
// · 담기: 묶음의 한 문항을 담으면 묶음 전체가 함께 들어간다(본문제 없이 (2)만 나가는 일을 막는다)
// · 순서: 하위문제는 늘 본문제 바로 뒤에, 나의 DB 등록 순서대로
// · 번호: 본문제가 N번, 하위문제는 번호를 따로 먹지 않고 (1)(2)(3) — 빠른정답·해설은 «N(1)»
// 채점·결과는 지금처럼 문항(id)마다 따로 한다 — 하위문제마다 답이 따로 있기 때문이다.

const isSub = (p: Problem, ids: Set<string>) => !!p.groupMain && p.groupMain !== p.id && ids.has(p.groupMain)

/** 묶음을 본문제 바로 뒤로 모은다. 본문제가 목록에 없는 하위문제는 보통 문항처럼 제자리에 둔다. */
export function orderGroups<T extends Problem>(items: T[], dbOrder?: T[]): T[] {
  const ids = new Set(items.map(p => p.id))
  const subsOf = new Map<string, T[]>()
  for (const p of items) if (isSub(p, ids)) {
    const arr = subsOf.get(p.groupMain!) ?? []
    arr.push(p); subsOf.set(p.groupMain!, arr)
  }
  if (subsOf.size === 0) return items
  // 하위문제 순서 = 나의 DB 등록 순서 (담은 순서가 아니라)
  if (dbOrder) {
    const rank = new Map(dbOrder.map((p, i) => [p.id, i]))
    for (const arr of subsOf.values()) arr.sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9))
  }
  const out: T[] = []
  for (const p of items) {
    if (isSub(p, ids)) continue
    out.push(p)
    const subs = subsOf.get(p.id)
    if (subs) out.push(...subs)
  }
  return out
}

/** 담을 문항 목록에 묶음의 나머지(본문제·형제 하위문제)를 채워 넣고 순서를 맞춘다. */
export function withWholeGroups<T extends Problem>(picked: T[], all: T[]): T[] {
  const mains = new Set(picked.map(p => p.groupMain).filter((g): g is string => !!g))
  if (mains.size === 0) return picked
  const have = new Set(picked.map(p => p.id))
  const extra = all.filter(p => !have.has(p.id) && p.groupMain && mains.has(p.groupMain))
  if (extra.length === 0) return orderGroups(picked, all)
  // 빠진 본문제는 그 묶음의 첫 하위문제 자리 앞에, 빠진 하위문제는 본문제 뒤에 오게 orderGroups 가 맞춘다
  const out: T[] = []
  const placed = new Set<string>()
  for (const p of picked) {
    const g = p.groupMain
    if (g && !placed.has(g)) {
      placed.add(g)
      const main = extra.find(x => x.id === g)
      if (main) out.push(main)
    }
    out.push(p)
  }
  for (const p of extra) if (!out.includes(p)) out.push(p)
  return orderGroups(out, all)
}

export interface NoLabel {
  big: string     // 문제지 큰 번호 — 본문제·보통 '03', 하위 '(1)'
  short: string   // 빠른정답·OMR·해설·학생 화면 — 본문제·보통 '3', 하위 '3(1)'
  sub: boolean
}

/** 문항 순서대로 번호를 매긴다. 하위문제는 번호를 먹지 않는다. */
export function numberLabels(items: Problem[]): NoLabel[] {
  const ids = new Set(items.map(p => p.id))
  const out: NoLabel[] = []
  let n = 0
  const mainNo = new Map<string, number>()
  const subCount = new Map<string, number>()
  for (const p of items) {
    if (isSub(p, ids) && mainNo.has(p.groupMain!)) {
      const k = (subCount.get(p.groupMain!) ?? 0) + 1
      subCount.set(p.groupMain!, k)
      out.push({ big: `(${k})`, short: `${mainNo.get(p.groupMain!)}(${k})`, sub: true })
      continue
    }
    n += 1
    mainNo.set(p.id, n)
    out.push({ big: String(n).padStart(2, '0'), short: String(n), sub: false })
  }
  return out
}

/** 문제 수(하위문제는 본문제에 포함) — 학습지 머리의 «N문항» */
export function mainCount(items: Problem[]): number {
  return numberLabels(items).filter(l => !l.sub).length
}
