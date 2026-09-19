import type { Grading, WBItem, Problem } from '../types'
import { newMastery, type MasteryState, type Floor } from './mastery'
import { dateKey } from './dates'

/**
 * 🪜 오답 → 유형 정복 큐 (2026-09-08 명수쌤: "문제집 풀이한 것 오답들도 승강제 유형정복을 적용")
 *
 * 재료는 이미 있다 — 교재 문항(WBItem)마다 매칭표로 유형 id 가 붙어 있고(typeId), 학습지 채점은 유형을 직접 기록한다.
 * 이 모듈은 **채점 기록만 읽어** 학생별 「정복해야 할 유형」을 만든다. 저장하지 않는다(파생 데이터).
 *
 * 승강제 규칙 (여기 한 곳에서만 정한다)
 *  · 대기   : 그 유형을 틀렸고 사다리를 아직 안 탔다 → 시작층은 틀린 문항 난이도로 (쉬운 걸 틀리면 기본부터)
 *  · 진행중 : 사다리 타는 중
 *  · 재정복 : 이미 최상까지 정복했는데 **그 뒤에** 교재·학습지에서 또 틀렸다 → **강등**. 한 층 아래(심화)에서 다시 시작
 *  · 정복   : 최상 통과 뒤 새 오답 없음 → 큐에서 빠진다
 *  · 선생님 : 사다리에서 연속 3회 틀려 호출이 걸림 → 맨 위
 *  실수(careless=재시도로 맞힘)·나중에 맞힌 문항·승인 대기(AI 실패)는 오답으로 세지 않는다.
 *
 * 📕 채점 단위로 좁히기 (2026-09-19 명수쌤: "교재 오답을 입력하면 바로 오답문제 유형만 승강제로")
 *  · `gradingIds` 를 주면 **그 채점(들)의 오답 유형만** 센다(기간 무시). `pageRange` 로 쪽을 더 좁힌다.
 *  · 입구 셋: 학생 교재 자가채점 결과 · 학생 홈 「방금 채점한 오답」 · 선생님 채점판 버튼.
 *
 * ⏱ 「언제 틀렸나」는 **문항별 at** 으로 본다 (2026-09-19 리뷰 F1)
 *    채점 기록의 date 는 「마지막으로 저장한 시각」이다. 선생님이 같은 범위를 이어서 채점하면 date 가 now 로 바뀌는데,
 *    그걸로 정복 시각과 비교하면 **이미 정복한 유형이 「재정복」으로 되살아나 정복 기록을 덮어썼다.**
 *    → 저장할 때 `carryResultAt` 이 문항마다 「그 표시가 처음 생긴 시각」을 at 으로 박고, 여기서는 at 을 쓴다.
 */
export type QueueStatus = '선생님' | '재정복' | '진행중' | '대기'

export interface WrongTypeRow {
  typeId: string
  wrong: number                     // 틀린 **문항 수** (같은 문항이 여러 기록에 실려도 1번만)
  lastAt: string                    // 마지막으로 틀린 날짜 (YYYY-MM-DD, 한국 시간)
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

/** 사다리를 정복한 시각(ISO). 마지막 오답보다 **먼저**였으면 강등 대상 */
function masteredAt(st?: MasteryState): string | null {
  if (!st?.mastered) return null
  const last = st.log[st.log.length - 1]
  return last?.at ?? null
}

// ── 색인 캐시 — 부를 때마다 수만 건 Map 을 새로 만들지 않는다 (리뷰 F6) ──
const byIdCache = new WeakMap<object, Map<string, unknown>>()
function indexById<T extends { id: string }>(arr: T[]): Map<string, T> {
  let m = byIdCache.get(arr) as Map<string, T> | undefined
  if (!m) { m = new Map(arr.map((x) => [x.id, x])); byIdCache.set(arr, m) }
  return m
}
const bookCache = new WeakMap<WBItem[], Set<string>>()
function booksOf(wbItems: WBItem[]): Set<string> {
  let s = bookCache.get(wbItems)
  if (!s) { s = new Set(wbItems.map((w) => w.workbookId)); bookCache.set(wbItems, s) }
  return s
}

/** 결과 한 줄이 「언제부터 그 표시였나」 — 옛 기록은 at 이 없으니 채점 기록 시각으로 */
const markAt = (r: { at?: string }, g: Grading) => r.at ?? g.date

export function wrongTypesOf(opts: {
  studentId: string
  gradings: Grading[]
  wbItems: WBItem[]
  problems: Problem[]
  masteries: Record<string, MasteryState>
  days?: number
  today?: string
  gradingIds?: string[]
  pageRange?: [number, number]      // 교재 쪽 범위로 더 좁힌다 (학생 쪽 화면 · 선생님 채점 범위)
}): WrongTypeRow[] {
  const { studentId, wbItems, problems, masteries } = opts
  const days = opts.days ?? 30
  const todayStr = opts.today ?? dateKey(new Date())
  const since = new Date(new Date(todayStr).getTime() - days * 86_400_000).toISOString().slice(0, 10)
  const scope = opts.gradingIds?.length ? new Set(opts.gradingIds) : null
  const pr = opts.pageRange

  const mine = opts.gradings.filter((g) => g.studentId === studentId && !!g.date)
  const wbById = indexById(wbItems)
  let pbById: Map<string, Problem> | null = null      // 학습지 결과가 있을 때만 만든다

  // 문항별 **최신** 표시 — 화면이 보여 주는 것과 맞춘다. 나중에 맞힌 문항은 이미 풀린 오답이다 (리뷰 F7)
  const latest = new Map<string, { t: string; ok: boolean }>()
  for (const g of mine) for (const r of g.results) {
    if (!r.itemId) continue
    const t = markAt(r, g)
    const cur = latest.get(r.itemId)
    if (!cur || t >= cur.t) latest.set(r.itemId, { t, ok: !!r.correct || !!r.careless })
  }

  const acc = new Map<string, { items: Set<string>; loose: number; lastRaw: string; sources: Set<'교재' | '학습지'>; books: Set<string>; minDiff: number }>()
  for (const g of mine) {
    if (scope ? !scope.has(g.id) : g.date < since) continue
    const source: '교재' | '학습지' = (g.source ?? '교재') === '학습지' ? '학습지' : '교재'
    for (const r of g.results) {
      if (r.correct || r.careless) continue
      if (r.pending && r.unknown) continue                 // 승인 대기(AI 판정 실패) — 아직 틀린 게 아니다 (리뷰 F10)
      const t = markAt(r, g)
      if (r.itemId) { const lt = latest.get(r.itemId); if (lt?.ok && lt.t > t) continue }
      let typeId: string | undefined
      let diff = 3
      if (source === '교재') {
        const w = r.itemId ? (wbById.get(r.itemId) as WBItem | undefined) : undefined
        if (!w) continue
        if (pr && (w.page < pr[0] || w.page > pr[1])) continue
        typeId = w.typeId; diff = diffNum(w.diff)
      } else {
        pbById ??= indexById(problems)
        const p = r.itemId ? pbById.get(r.itemId) : undefined
        typeId = r.typeId ?? p?.typeId
        if (p) diff = diffNum(p.diff)
      }
      if (!typeId) continue
      const a = acc.get(typeId) ?? { items: new Set<string>(), loose: 0, lastRaw: '', sources: new Set(), books: new Set(), minDiff: 5 }
      if (r.itemId) a.items.add(r.itemId); else a.loose += 1
      if (t > a.lastRaw) a.lastRaw = t
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
      if (at && at >= a.lastRaw) continue          // 정복 뒤 새 오답 없음 → 큐에서 뺀다 (문항별 at 으로 비교)
      status = '재정복'
    } else if (st) status = '진행중'
    else status = '대기'
    rows.push({
      typeId, wrong: a.items.size + a.loose, lastAt: dateKey(a.lastRaw), sources: [...a.sources], workbookIds: [...a.books],
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

/**
 * 범위가 준비됐나 — 교재 오답은 매칭표(wbItems)가 **비동기로** 실려야 유형을 안다.
 * 아직 안 실렸는데 「다 정복했어요 🎉」라고 하면 거짓말이 된다.
 * 판정은 **교재 단위**로 한다: 그 채점의 교재 문항이 하나라도 실렸으면 준비된 것.
 * (문항 단위로 보면 지워진 문항 id 하나 때문에 영원히 「찾는 중」에 갇힌다 — 리뷰 F4)
 */
export function scopeLoaded(gradingIds: string[], gradings: Grading[], wbItems: WBItem[]): boolean {
  const books = booksOf(wbItems)
  return gradingIds.every((gid) => {
    const g = gradings.find((x) => x.id === gid)
    if (!g) return false
    if ((g.source ?? '교재') !== '교재') return true
    return !g.workbookId || books.has(g.workbookId)
  })
}

/** 최근 N일 채점 중 **아직 정복 안 된 오답 유형이 남은** 것 — 최신부터 (학생 홈 「방금 채점한 오답」) */
export function recentWrongGradings(opts: {
  studentId: string
  gradings: Grading[]
  wbItems: WBItem[]
  problems: Problem[]
  masteries: Record<string, MasteryState>
  withinDays?: number
  limit?: number
  now?: number
}): { grading: Grading; rows: WrongTypeRow[] }[] {
  const since = new Date((opts.now ?? Date.now()) - (opts.withinDays ?? 3) * 86_400_000).toISOString()
  const mine = opts.gradings.filter((g) => g.studentId === opts.studentId && !!g.date)   // 한 번만 거른다 (리뷰 F6)
  const cands = mine
    .filter((g) => g.date >= since && g.results.some((r) => !r.correct && !r.careless))
    .sort((a, b) => b.date.localeCompare(a.date))
  const out: { grading: Grading; rows: WrongTypeRow[] }[] = []
  for (const g of cands) {
    const rows = wrongTypesOf({ ...opts, gradings: mine, gradingIds: [g.id] })
    if (rows.length) out.push({ grading: g, rows })
    if (out.length >= (opts.limit ?? 2)) break
  }
  return out
}

/**
 * 저장 직전에 부른다 — 문항마다 「그 표시가 처음 생긴 시각」(at)을 박는다 (리뷰 F1).
 * 같은 학생의 이전 기록(교체 전의 같은 기록 포함)에서 같은 문항이 **같은 표시**였으면 그 at 을 이어받고,
 * 표시가 바뀌었거나 처음이면 이번 기록 시각을 쓴다. 옛 기록은 at 이 없으니 그 기록의 date 로 본다.
 */
export function carryResultAt(g: Grading, existing: Grading[]): Grading {
  if (!g.results?.length) return g
  const prev = new Map<string, { correct: boolean; unknown: boolean; at: string }>()
  const mine = existing.filter((x) => x.studentId === g.studentId && !!x.date).sort((a, b) => a.date.localeCompare(b.date))
  for (const x of mine) for (const r of x.results) {
    if (r.itemId) prev.set(r.itemId, { correct: !!r.correct, unknown: !!r.unknown, at: r.at ?? x.date })
  }
  let changed = false
  const results = g.results.map((r) => {
    if (!r.itemId) return r
    const p = prev.get(r.itemId)
    const at = p && p.correct === !!r.correct && p.unknown === !!r.unknown ? p.at : (r.at ?? g.date)
    if (at === r.at) return r
    changed = true
    return { ...r, at }
  })
  return changed ? { ...g, results } : g
}
