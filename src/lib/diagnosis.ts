import type { Diff, Problem } from '../types'
import { curriculumFor, defaultCurriculumForGrade } from '../data/curriculum'
import { POOL_COURSES, WANJA_COURSES } from '../data/pool'

// ── 입학 진단고사 — 과정(현재+선수) 유형을 대단원 고르게 커버하는 문항 선발 ──────────
// 채점하면 유형분석(7컬러)이 그대로 신입생 취약점 지도가 된다.

// 수학 과정 사슬 — 선수 과정 역추적용 (고2+는 대표 이수 경로: 대수→미적분Ⅰ)
const MATH_CHAIN = [
  'e1-1', 'e1-2', 'e2-1', 'e2-2', 'e3-1', 'e3-2', 'e4-1', 'e4-2', 'e5-1', 'e5-2', 'e6-1', 'e6-2',
  'm1-1', 'm1-2', 'm2-1', 'm2-2', 'm3-1', 'm3-2',
  'h-cm1', 'h-cm2', 'h-alg', 'h-calc1',
]

export function hasPool(courseId: string): boolean {
  return (POOL_COURSES as readonly string[]).includes(courseId)
    || (WANJA_COURSES as readonly string[]).includes(courseId)
}

// 학년 → 진단 범위 과정들 (현재 과정 + 풀 있는 선수 과정 최대 prevCount개, 현재가 앞)
export function diagnosisCourses(grade: string, prevCount = 2): string[] {
  const cur = defaultCurriculumForGrade(grade)
  const out = hasPool(cur) ? [cur] : []
  const i = MATH_CHAIN.indexOf(cur)
  if (i > 0) {
    for (let j = i - 1; j >= 0 && out.length < 1 + prevCount; j--) {
      if (hasPool(MATH_CHAIN[j])) out.push(MATH_CHAIN[j])
    }
  }
  return out.length ? out : [cur]
}

// 과정별 문항 배분 — 현재 과정에 절반 이상, 선수로 갈수록 줄임 (가중치 3:2:1…)
export function planQuota(courses: string[], total: number): { courseId: string; count: number }[] {
  const w = courses.map((_, i) => Math.max(1, courses.length - i + (i === 0 ? 1 : 0)))
  const sum = w.reduce((a, b) => a + b, 0)
  const counts = w.map(x => Math.floor((total * x) / sum))
  let rest = total - counts.reduce((a, b) => a + b, 0)
  for (let i = 0; rest > 0; i = (i + 1) % counts.length) { counts[i]++; rest-- }
  return courses.map((courseId, i) => ({ courseId, count: counts[i] }))
}

function stride<T>(arr: T[], n: number): T[] {
  if (n >= arr.length) return [...arr]
  const out: T[] = []
  for (let i = 0; i < n; i++) out.push(arr[Math.floor((i * arr.length) / n + arr.length / n / 2)])
  return [...new Set(out)]
}

// 과정 1개에서 count문항 선발 — 대단원별 비례 배분 → 유형 고른 표집 → 유형당 1문항
// 난이도는 [중,중하,중,상] 순환 목표에 근접한 문항을 고름 (진단 표준 분포: 중 50%·중하 25%·상 25%)
export function pickDiagnosisProblems(courseId: string, count: number, pool: Problem[]): Problem[] {
  const cur = curriculumFor(courseId)
  const byType = new Map<string, Problem[]>()
  for (const p of pool) {
    if (!byType.has(p.typeId)) byType.set(p.typeId, [])
    byType.get(p.typeId)!.push(p)
  }

  // 대단원별 풀이 있는 유형 목록 (교육과정 순)
  const unitTypes = cur.units
    .map(u => ({
      unit: u,
      types: u.mids.flatMap(m => m.subs.flatMap(s => s.types.map(t => t.id)))
        .filter(t => (byType.get(t)?.length ?? 0) > 0),
    }))
    .filter(x => x.types.length > 0)
  if (unitTypes.length === 0) return []

  // 대단원별 배분 (유형 수 비례, 최소 1)
  const totalTypes = unitTypes.reduce((a, x) => a + x.types.length, 0)
  const quota = unitTypes.map(x => Math.max(1, Math.floor((count * x.types.length) / totalTypes)))
  let rest = count - quota.reduce((a, b) => a + b, 0)
  for (let i = 0; rest > 0; i = (i + 1) % quota.length) { quota[i]++; rest-- }
  while (rest < 0) {
    const i = quota.indexOf(Math.max(...quota))
    quota[i]--; rest++
  }

  const DIFF_CYCLE: Diff[] = [3, 2, 3, 4]
  const picked: Problem[] = []
  const used = new Set<string>()
  unitTypes.forEach((x, ui) => {
    const chosen = stride(x.types, quota[ui])
    // stride 중복 제거로 모자라면 남은 유형에서 보충
    for (const t of x.types) {
      if (chosen.length >= quota[ui]) break
      if (!chosen.includes(t)) chosen.push(t)
    }
    chosen.slice(0, quota[ui]).forEach((typeId, ti) => {
      const target = DIFF_CYCLE[(picked.length + ti) % DIFF_CYCLE.length]
      const cands = (byType.get(typeId) ?? []).filter(p => !used.has(p.id))
      if (cands.length === 0) return
      cands.sort((a, b) => Math.abs(a.diff - target) - Math.abs(b.diff - target))
      used.add(cands[0].id)
      picked.push(cands[0])
    })
  })
  return picked
}
