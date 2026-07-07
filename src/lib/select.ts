import type { Diff, DiffMatrix, Kind, Problem } from '../types'
import { DIFFS } from '../types'

// 매쓰플랫 방식: 선택 난이도 → 비율 매트릭스로 난이도별 목표 문항 수 산출 후,
// 난이도 구간마다 유형(교육과정 순) 라운드로빈으로 선발. 부족분은 인접 난이도에서 보충.
export function pickProblems(
  pool: Problem[],
  count: number,
  focus: Diff,
  kind: 'all' | Kind,
  typeOrder: string[],
  matrix: DiffMatrix,
): Problem[] {
  const filtered = pool.filter(p => kind === 'all' || p.kind === kind)
  if (filtered.length === 0) return []

  // 1) 난이도별 목표 수 (비율 → 반올림, 합 보정)
  const ratio = matrix[focus]
  const target: Record<Diff, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let assigned = 0
  DIFFS.forEach((d, i) => {
    target[d] = Math.floor((count * ratio[i]) / 100)
    assigned += target[d]
  })
  // 잔여분은 비율 큰 순서로 배분
  const order = [...DIFFS].sort((a, b) => ratio[DIFFS.indexOf(b)] - ratio[DIFFS.indexOf(a)])
  let rest = count - assigned
  for (const d of order) { if (rest <= 0) break; target[d]++; rest-- }

  // 2) 난이도 구간별 유형 라운드로빈 선발
  const used = new Set<string>()
  const picked: Problem[] = []

  function pickFromDiff(d: Diff, need: number): number {
    if (need <= 0) return 0
    const byType = new Map<string, Problem[]>()
    for (const t of typeOrder) byType.set(t, [])
    for (const p of filtered) {
      if (p.diff === d && !used.has(p.id)) byType.get(p.typeId)?.push(p)
    }
    let got = 0, round = 0
    while (got < need) {
      let any = false
      for (const t of typeOrder) {
        const list = byType.get(t)!
        if (round < list.length) {
          any = true
          used.add(list[round].id)
          picked.push(list[round])
          got++
          if (got >= need) break
        }
      }
      if (!any) break
      round++
    }
    return got
  }

  let shortage = 0
  for (const d of DIFFS) shortage += target[d] - pickFromDiff(d, target[d])

  // 3) 부족분: 목표 난이도에서 가까운 순으로 아무 난이도에서나 보충
  if (shortage > 0) {
    const near = [...DIFFS].sort((a, b) => Math.abs(a - focus) - Math.abs(b - focus))
    for (const d of near) {
      if (shortage <= 0) break
      shortage -= pickFromDiff(d, shortage)
    }
  }

  // 4) 출제 순서: 교육과정(유형) 순 → 난이도 순
  picked.sort((a, b) => {
    const ta = typeOrder.indexOf(a.typeId), tb = typeOrder.indexOf(b.typeId)
    return ta !== tb ? ta - tb : a.diff - b.diff
  })
  return picked
}

// 쌍둥이: 같은 템플릿(twinGroup) / 유사: 같은 유형
export function twinProblems(pool: Problem[], current: Problem, usedIds: Set<string>): Problem[] {
  if (!current.twinGroup) return []
  return pool.filter(p =>
    p.twinGroup === current.twinGroup && p.id !== current.id && !usedIds.has(p.id))
}

export function similarProblems(pool: Problem[], current: Problem, usedIds: Set<string>): Problem[] {
  return pool.filter(p =>
    p.typeId === current.typeId && p.id !== current.id && !usedIds.has(p.id) &&
    (!current.twinGroup || p.twinGroup !== current.twinGroup))
}
