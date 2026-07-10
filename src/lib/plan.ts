// 강의 진도표 생성 — 쪽수 균등 + 단원 존중
import type { PlanSession } from '../types'
import { dateKey, WEEKDAYS_KR } from './dates'

// [start, end] 사이에서 수업 요일(classDays)에 해당하는 날짜 키 목록
export function classDatesBetween(start: string, end: string, classDays: string[]): string[] {
  const out: string[] = []
  if (!start || !end || !classDays.length) return out
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return out
  for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    if (classDays.includes(WEEKDAYS_KR[d.getDay()])) out.push(dateKey(d))
  }
  return out
}

// pages: [{page, unit}] 정렬됨 · dates: 수업일 목록 → 수업일별 진도(쪽 범위·단원)
// 방법: 먼저 쪽수를 고르게 나눌 이상적 절단점(round)을 잡고, 그 근처에 단원 경계가 있으면 그리로 살짝 당겨 끊는다.
//   → 쪽수 균등이 1순위, 단원 존중이 2순위. (경계가 가까이 있을 때만 스냅)
export function buildSessions(pages: { page: number; unit: string }[], dates: string[]): PlanSession[] {
  if (!dates.length || !pages.length) return []
  const total = pages.length
  const N = Math.min(dates.length, total)          // 세션 수
  const target = total / N                         // 세션당 목표 쪽수
  const window = Math.max(1, Math.round(target * 0.34))  // 경계 스냅 허용 폭(쪽)
  const boundaries = new Set<number>()             // 단원이 바뀌는 시작 인덱스
  for (let i = 1; i < total; i++) if (pages[i].unit !== pages[i - 1].unit) boundaries.add(i)

  const cuts = [0]
  for (let k = 1; k < N; k++) {
    const ideal = Math.round(k * total / N)
    let best = ideal, bestDist = Infinity
    for (let b = ideal - window; b <= ideal + window; b++) {
      if (!boundaries.has(b)) continue
      const d = Math.abs(b - ideal)
      if (d < bestDist) { bestDist = d; best = b }
    }
    best = Math.max(best, cuts[cuts.length - 1] + 1)   // 단조 증가
    best = Math.min(best, total - (N - k))             // 남은 세션마다 최소 1쪽 보장
    cuts.push(best)
  }
  cuts.push(total)

  const out: PlanSession[] = []
  for (let k = 0; k < N; k++) {
    const ch = pages.slice(cuts[k], cuts[k + 1])
    if (!ch.length) continue
    const units = [...new Set(ch.map(p => p.unit).filter(Boolean))]
    const unit = units.length === 0 ? '' : units.length === 1 ? units[0] : `${units[0]} 외 ${units.length - 1}단원`
    out.push({ date: dates[k], pageFrom: ch[0].page, pageTo: ch[ch.length - 1].page, unit, done: false })
  }
  return out
}
