import type { Grading, GradeResult } from '../types'
import { dateKey } from './dates'
import { typeName } from '../data/curriculum'
import type { MasteryState } from './mastery'

/**
 * 보고서에 «모든 채점 기록»을 모으는 도우미 (2026-11-23 윤자혜 선생님 «모든 채점기록을 보고서에 반영»)
 *
 * 채점 기록이 저장되는 곳은 두 군데다.
 *  ① hj_gradings(store.gradings) — 선생님 채점·학생앱 자동 채점·AI 채점 승인·학습지·교재·오답·챌린지·단어·서술형
 *  ② 승강제(masteries) 의 log — 유형 정복 사다리로 푼 문항. ①에 안 들어가서 보고서의 «채점 기록 0건»에 빠졌다.
 * 그래서 ②를 «하루 × 유형» 단위의 표시 전용 채점 기록으로 바꿔 ①과 합쳐 보고서가 쓰게 한다.
 * 또 AI 채점 승인 대기(pending) 문항은 아직 정답·오답이 정해지지 않았으니 점수에서 빼고 «승인 대기»로 따로 센다.
 */

/** 승강제 log → 표시 전용 채점 기록 (하루 × 유형 1건). 날짜는 로컬 날짜 기준 */
export function masteryGradings(masteries: Record<string, MasteryState> | undefined, studentId?: string): Grading[] {
  const out: Grading[] = []
  for (const [k, st] of Object.entries(masteries ?? {})) {
    const bar = k.indexOf('|')
    if (bar < 0) continue
    const sid = k.slice(0, bar)
    if (studentId && sid !== studentId) continue
    const typeId = k.slice(bar + 1)
    const byDay = new Map<string, { at: string; results: GradeResult[] }>()
    for (const l of st?.log ?? []) {
      if (!l?.at) continue
      const day = dateKey(new Date(l.at))
      const e = byDay.get(day) ?? { at: l.at, results: [] }
      e.results.push({ itemId: l.problemId, typeId, correct: !!l.correct, at: l.at })
      if (l.at > e.at) e.at = l.at
      byDay.set(day, e)
    }
    for (const [day, e] of byDay) {
      out.push({
        id: `ms|${k}|${day}`, studentId: sid, source: '학습지', date: e.at, results: e.results,
        imported: true, title: `승강제 · ${typeName(typeId) || typeId}`, category: '학습지',
      })
    }
  }
  return out
}

/** 채점 기록 + 승강제 기록 (보고서용) */
export function reportGradings(gradings: Grading[], masteries: Record<string, MasteryState> | undefined, studentId?: string): Grading[] {
  const ms = masteryGradings(masteries, studentId)
  return ms.length ? [...gradings, ...ms] : gradings
}

/** AI 채점 승인 대기 문항(pending)을 뺀 확정 기록만 — 다 빠진 기록은 버린다 */
export function confirmedOnly(gs: Grading[]): Grading[] {
  const out: Grading[] = []
  for (const g of gs) {
    if (!g.results.some(r => r.pending)) { out.push(g); continue }
    const results = g.results.filter(r => !r.pending)
    if (results.length) out.push({ ...g, results })
  }
  return out
}

/** 승인 대기 문항 수 */
export const pendingCount = (gs: Grading[]): number => gs.reduce((a, g) => a + g.results.filter(r => r.pending).length, 0)
