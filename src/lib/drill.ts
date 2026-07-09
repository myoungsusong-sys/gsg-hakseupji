import type { Diff, Grading, Problem, WBItem } from '../types'
import { achievementOf } from './achievement'

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
export interface WrongRef { typeId: string; diff?: Diff }
export interface DrillOptions {
  twinPer: number          // 문제당 쌍둥이 수 (같은 유형·같은 난이도 우선)
  similarPer: number       // 문제당 유사 수 (같은 유형, 난이도 조정 가능)
  diffShift: -1 | 0 | 1    // 유사 난이도: 쉽게/그대로/어렵게
  typeCap: number          // 유형별 최대 문제 수 (0 = 무제한)
  excludeIds: Set<string>  // 기존 출제 문제 제외
}

// 틀린 문항 각각에 대해 쌍둥이·유사를 뽑는다. 반환: 선발된 Problem[] (중복 없음, 유형→난이도 순 정렬)
export function pickDrillProblems(wrongs: WrongRef[], pool: Problem[], opts: DrillOptions): Problem[] {
  const used = new Set<string>(opts.excludeIds)
  const perType = new Map<string, number>()
  const picked: Problem[] = []

  const byType = new Map<string, Problem[]>()
  for (const p of pool) {
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

  for (const w of wrongs) {
    const cands = byType.get(w.typeId) ?? []
    if (cands.length === 0) continue
    const baseDiff = w.diff ?? 3

    // 쌍둥이: 같은 twinGroup 우선 → 난이도 근접순
    const twins = [...cands].sort((a, b) => {
      const ta = a.twinGroup ? 0 : 1, tb = b.twinGroup ? 0 : 1
      if (ta !== tb) return ta - tb
      return Math.abs(a.diff - baseDiff) - Math.abs(b.diff - baseDiff)
    })
    take(twins, opts.twinPer, w.typeId)

    // 유사: 난이도 조정(diffShift) 목표에 근접순
    const target = Math.min(5, Math.max(1, baseDiff + opts.diffShift))
    const sims = [...cands].sort((a, b) =>
      Math.abs(a.diff - target) - Math.abs(b.diff - target))
    take(sims, opts.similarPer, w.typeId)
  }

  picked.sort((a, b) => a.typeId !== b.typeId ? a.typeId.localeCompare(b.typeId) : a.diff - b.diff)
  return picked
}
