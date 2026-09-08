import type { Grading, WBItem, Problem } from '../types'
import { newMastery, type MasteryState, type Floor } from './mastery'

/**
 * 🪜 오답 → 유형 정복 큐 (2026-09-08 명수쌤: "문제집 풀이한 것 오답들도 승강제 유형정복을 적용")
 *
 * 재료는 이미 있다 — 교재 문항(WBItem)마다 매칭표로 유형 id 가 붙어 있고(typeId), 학습지 채점은 유형을 직접 기록한다.
 * 이 모듈은 **채점 기록만 읽어** 학생별 「정복해야 할 유형」을 만든다. 저장하지 않는다(파생 데이터).
 *
 * 승강제 규칙 (여기 한 곳에서만 정한다)
 *  · 대기   : 최근 N일 안에 그 유형을 틀렸고 사다리를 아직 안 탔다 → 시작층은 틀린 문항 난이도로 (쉬운 걸 틀리면 기본부터)
 *  · 진행중 : 사다리 타는 중
 *  · 재정복 : 이미 최상까지 정복했는데 **그 뒤에** 교재·학습지에서 또 틀렸다 → **강등**. 한 층 아래(심화)에서 다시 시작
 *  · 정복   : 최상 통과 뒤 새 오답 없음 → 큐에서 빠진다
 *  · 선생님 : 사다리에서 연속 3회 틀려 호출이 걸림 → 맨 위
 *  실수(careless=재시도로 맞힘)는 오답으로 세지 않는다.
 */
export type QueueStatus = '선생님' | '재정복' | '진행중' | '대기'

export interface WrongTypeRow {
  typeId: string
  wrong: number                     // 최근 N일 오답 수 (실수 제외)
  lastAt: string                    // 마지막 오답 날짜 (YYYY-MM-DD)
  sources: ('교재' | '학습지')[]
  workbookIds: string[]
  minDiff: number                   // 틀린 문항 중 가장 쉬운 난이도 (1~5)
  startFloor: Floor                 // 큐에서 시작할 층
  state?: MasteryState
  status: QueueStatus
}

const ORDER: Record<QueueStatus, number> = { 선생님: 0, 재정복: 1, 진행중: 2, 대기: 3 }

/** 난이도 표기가 숫자(1~5)·글자(하/중/상)로 섞여 있다 — 하나로 */
function diffNum(d: unknown): number {
  if (typeof d === 'number' && Number.isFinite(d)) return Math.max(1, Math.min(5, d))
  const s = String(d ?? '')
  if (/최상|5/.test(s)) return 5
  if (/상|4/.test(s)) return 4
  if (/하|1|2/.test(s)) return s.includes('2') ? 2 : 1
  return 3
}

/** 틀린 문항 난이도 → 시작층. 쉬운 걸 틀렸으면 기본(1)부터, 표준·심화를 틀렸으면 표준(2)부터 */
export function startFloorFor(minDiff: number): Floor {
  return minDiff <= 2 ? 1 : 2
}

/** 사다리 정복이 마지막 오답보다 **먼저**였으면 강등 대상 */
function masteredAt(st?: MasteryState): string | null {
  if (!st?.mastered) return null
  const last = st.log[st.log.length - 1]
  return last?.at ? last.at.slice(0, 10) : null
}

export function wrongTypesOf(opts: {
  studentId: string
  gradings: Grading[]
  wbItems: WBItem[]
  problems: Problem[]
  masteries: Record<string, MasteryState>
  days?: number
  today?: string
}): WrongTypeRow[] {
  const { studentId, gradings, wbItems, problems, masteries } = opts
  const days = opts.days ?? 30
  const todayStr = opts.today ?? new Date().toISOString().slice(0, 10)
  const since = new Date(new Date(todayStr).getTime() - days * 86_400_000).toISOString().slice(0, 10)

  const wbById = new Map(wbItems.map((w) => [w.id, w]))
  const pbById = new Map(problems.map((p) => [p.id, p]))
  const acc = new Map<string, { wrong: number; lastAt: string; sources: Set<'교재' | '학습지'>; books: Set<string>; minDiff: number }>()

  for (const g of gradings) {
    if (g.studentId !== studentId || !g.date || g.date < since) continue
    const source: '교재' | '학습지' = (g.source ?? '교재') === '학습지' ? '학습지' : '교재'
    for (const r of g.results) {
      if (r.correct || r.careless) continue
      let typeId: string | undefined
      let diff = 3
      if (source === '교재') {
        const w = r.itemId ? wbById.get(r.itemId) : undefined
        if (!w) continue
        typeId = w.typeId; diff = diffNum(w.diff)
      } else {
        const p = r.itemId ? pbById.get(r.itemId) : undefined
        typeId = r.typeId ?? p?.typeId
        if (p) diff = diffNum(p.diff)
      }
      if (!typeId) continue
      const a = acc.get(typeId) ?? { wrong: 0, lastAt: '', sources: new Set(), books: new Set(), minDiff: 5 }
      a.wrong += 1
      if (g.date > a.lastAt) a.lastAt = g.date
      a.sources.add(source)
      if (g.workbookId) a.books.add(g.workbookId)
      a.minDiff = Math.min(a.minDiff, diff)
      acc.set(typeId, a)
    }
  }

  const rows: WrongTypeRow[] = []
  for (const [typeId, a] of acc) {
    const st = masteries[`${studentId}|${typeId}`]
    let status: QueueStatus
    if (st?.needsTeacher) status = '선생님'
    else if (st?.mastered) {
      const at = masteredAt(st)
      if (at && at >= a.lastAt) continue          // 정복 뒤 새 오답 없음 → 큐에서 뺀다
      status = '재정복'
    } else if (st) status = '진행중'
    else status = '대기'
    rows.push({
      typeId, wrong: a.wrong, lastAt: a.lastAt, sources: [...a.sources], workbookIds: [...a.books],
      minDiff: a.minDiff, startFloor: status === '재정복' ? 3 : startFloorFor(a.minDiff), state: st, status,
    })
  }
  return rows.sort((x, y) => ORDER[x.status] - ORDER[y.status] || y.wrong - x.wrong || y.lastAt.localeCompare(x.lastAt))
}

/** 큐에서 사다리를 시작할 때 쓸 상태 — 재정복이면 강등(한 층 아래)으로 새로 시작, 진행중이면 그대로 */
export function stateToStart(row: WrongTypeRow, studentId: string): MasteryState {
  if (row.state && row.status !== '재정복') return row.state
  return newMastery(studentId, row.typeId, row.startFloor)
}
