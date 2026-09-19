import type { Diff, Grading, Problem, WBItem, Worksheet } from '../types'
import { achievementOf } from './achievement'
import { autoPickable } from './pickable'

export interface TypeStat { typeId: string; wrong: number; total: number }

// 채점 결과 1건의 유형: 학습지 채점은 typeId 직접 기록, 교재 채점은 itemId→WBItem 참조
export function resultTypeId(r: { itemId?: string; typeId?: string }, itemMap: Map<string, WBItem>): string | undefined {
  return r.typeId ?? (r.itemId ? itemMap.get(r.itemId)?.typeId : undefined)
}

// 학생의 채점 이력에서 유형별 오답 집계 (교재+학습지 합산, '모름'은 오답과 동일 집계)
export function wrongByType(
  studentId: string,
  gradings: Grading[],
  wbItems: WBItem[],
): TypeStat[] {
  const itemMap = new Map(wbItems.map(i => [i.id, i]))
  const acc = new Map<string, { wrong: number; total: number }>()
  for (const g of gradings) {
    if (g.studentId !== studentId) continue
    for (const r of g.results) {
      const typeId = resultTypeId(r, itemMap)
      if (!typeId) continue
      const cur = acc.get(typeId) ?? { wrong: 0, total: 0 }
      cur.total++
      if (!r.correct) cur.wrong++
      acc.set(typeId, cur)
    }
  }
  return [...acc.entries()].map(([typeId, v]) => ({ typeId, ...v }))
}

// 취약 유형: 오답이 1개 이상인 유형을 오답 많은 순으로
export function weakTypes(stats: TypeStat[]): TypeStat[] {
  return stats.filter(s => s.wrong > 0).sort((a, b) => b.wrong - a.wrong)
}

// 성취도 컬러 — 매쓰플랫 7단계 공통 체계(lib/achievement.ts)로 위임.
// (구 5구간 자체 기준을 대체 — 하위호환: 반환은 여전히 칩 클래스 문자열)
export function achievementColor(stat: TypeStat | undefined): string {
  return achievementOf(stat).cls
}

// ── 오답 학습지 선발 (매쓰플랫 오답학습지 옵션 다이얼로그와 동일 파라미터) ──────────
export interface WrongRef { typeId: string; diff?: Diff; problemId?: string }
export interface DrillOptions {
  twinPer: number          // 문제당 쌍둥이 수 (같은 유형·같은 난이도 우선)
  similarPer: number       // 문제당 유사 수 (같은 유형, 난이도 조정 가능)
  diffShift: -1 | 0 | 1    // 유사 난이도: 쉽게/그대로/어렵게
  typeCap: number          // 유형별 최대 문제 수 (0 = 무제한)
  excludeIds: Set<string>  // 기존 출제 문제 제외
}

// 틀린 문항 각각에 대해 쌍둥이·유사를 뽑는다. 반환: 선발된 Problem[] (중복 없음, 유형→난이도 순 정렬)
//
// 🎯 난이도 규칙 (2026-09-19 명수쌤 "수학 오답문제 만들 때 난이도가 안 맞는 것들 안 나가게 해줘")
//   예전에는 같은 유형 안에서 난이도가 **가까운 순으로 정렬만** 해서, 맞는 난이도를 다 쓰면
//   난이도 2 오답에 난이도 5 문제가 나갔다. 이제:
//   · 쌍둥이 = 틀린 문제와 같은 쌍둥이 묶음 → 같은 난이도 → ±1 까지만
//   · 유사   = 목표(틀린 난이도 + 쉽게/그대로/어렵게) **±1 안에서만**
//   · 범위 안에 없으면 모자라도 채우지 않는다. 난이도를 모르는 참조는 3 을 기준으로 본다
//     (호출부는 wrongDiffByType 으로 실제 틀린 난이도를 붙여 넘긴다).
export const DRILL_DIFF_BAND = 1
export function pickDrillProblems(wrongs: WrongRef[], pool: Problem[], opts: DrillOptions): Problem[] {
  const used = new Set<string>(opts.excludeIds)
  const perType = new Map<string, number>()
  const picked: Problem[] = []

  const byType = new Map<string, Problem[]>()
  const byId = new Map<string, Problem>()
  for (const p of pool) {
    byId.set(p.id, p)
    if (!autoPickable(p)) continue
    if (!byType.has(p.typeId)) byType.set(p.typeId, [])
    byType.get(p.typeId)!.push(p)
  }

  function take(cands: Problem[], n: number, typeId: string): void {
    for (const p of cands) {
      if (n <= 0) break
      if (used.has(p.id)) continue
      if (opts.typeCap > 0 && (perType.get(typeId) ?? 0) >= opts.typeCap) break
      used.add(p.id)
      perType.set(typeId, (perType.get(typeId) ?? 0) + 1)
      picked.push(p)
      n--
    }
  }
  const near = (d: number, t: number) => Math.abs(d - t) <= DRILL_DIFF_BAND

  for (const w of wrongs) {
    const cands = byType.get(w.typeId) ?? []
    if (cands.length === 0) continue
    const baseDiff = w.diff ?? 3
    const twinOf = w.problemId ? byId.get(w.problemId)?.twinGroup : undefined

    // 쌍둥이: 같은 묶음 → 같은 난이도 → 가까운 난이도 (±1 밖은 버린다)
    const twins = cands.filter(p => near(p.diff, baseDiff)).sort((a, b) => {
      const ga = twinOf && a.twinGroup === twinOf ? 0 : 1, gb = twinOf && b.twinGroup === twinOf ? 0 : 1
      if (ga !== gb) return ga - gb
      return Math.abs(a.diff - baseDiff) - Math.abs(b.diff - baseDiff)
    })
    take(twins, opts.twinPer, w.typeId)

    // 유사: 목표 난이도 ±1 안에서 가까운 순
    const target = Math.min(5, Math.max(1, baseDiff + opts.diffShift))
    const sims = cands.filter(p => near(p.diff, target))
      .sort((a, b) => Math.abs(a.diff - target) - Math.abs(b.diff - target))
    take(sims, opts.similarPer, w.typeId)
  }

  picked.sort((a, b) => a.typeId !== b.typeId ? a.typeId.localeCompare(b.typeId) : a.diff - b.diff)
  return picked
}

/**
 * 유형별로 학생이 **실제로 틀린 문항의 난이도**(중앙값) — 유형만 아는 오답 참조(취약 유형 등)에 붙인다.
 * 학습지 채점은 문항 id(itemId 또는 학습지 문항 순서)로, 교재 채점은 교재 문항(WBItem)으로 난이도를 찾는다.
 */
export function wrongDiffByType(
  studentId: string, gradings: Grading[], wbItems: WBItem[], problems: Problem[], worksheets: Worksheet[],
): Map<string, Diff> {
  const itemMap = new Map(wbItems.map(i => [i.id, i]))
  const pMap = new Map(problems.map(p => [p.id, p]))
  const wsMap = new Map(worksheets.map(w => [w.id, w]))
  const acc = new Map<string, number[]>()
  for (const g of gradings) {
    if (g.studentId !== studentId) continue
    const ws = g.worksheetId ? wsMap.get(g.worksheetId) : undefined
    g.results.forEach((r, i) => {
      if (r.correct) return
      const it = r.itemId ? itemMap.get(r.itemId) : undefined
      const p = pMap.get(r.itemId ?? '') ?? (ws ? pMap.get(ws.problemIds[i] ?? '') : undefined)
      const typeId = r.typeId ?? p?.typeId ?? it?.typeId
      const d = p?.diff ?? it?.diff
      if (!typeId || !d) return
      const arr = acc.get(typeId) ?? []
      arr.push(d); acc.set(typeId, arr)
    })
  }
  const out = new Map<string, Diff>()
  for (const [t, ds] of acc) {
    const s = [...ds].sort((a, b) => a - b)
    out.set(t, s[Math.floor((s.length - 1) / 2)] as Diff)
  }
  return out
}
