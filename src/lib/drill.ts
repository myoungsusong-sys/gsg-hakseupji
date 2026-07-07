import type { Grading, WBItem } from '../types'

export interface TypeStat { typeId: string; wrong: number; total: number }

// 학생의 채점 이력에서 유형별 오답 집계 (모든 교재 합산)
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
      const item = itemMap.get(r.itemId)
      if (!item) continue
      const cur = acc.get(item.typeId) ?? { wrong: 0, total: 0 }
      cur.total++
      if (!r.correct) cur.wrong++
      acc.set(item.typeId, cur)
    }
  }
  return [...acc.entries()].map(([typeId, v]) => ({ typeId, ...v }))
}

// 취약 유형: 오답이 1개 이상인 유형을 오답 많은 순으로
export function weakTypes(stats: TypeStat[]): TypeStat[] {
  return stats.filter(s => s.wrong > 0).sort((a, b) => b.wrong - a.wrong)
}

// 성취도 컬러 (매쓰플랫 성취도 매트릭스 방식): 정답률 → 색
export function achievementColor(stat: TypeStat | undefined): string {
  if (!stat || stat.total === 0) return 'bg-stone-100 text-stone-400'   // 미학습
  const rate = 1 - stat.wrong / stat.total
  if (rate >= 0.9) return 'bg-pine text-white'          // 우수
  if (rate >= 0.7) return 'bg-pine-soft text-pine-dark' // 양호
  if (rate >= 0.4) return 'bg-amber-soft text-amber'    // 보통
  return 'bg-red-100 text-red-800'                       // 취약
}
