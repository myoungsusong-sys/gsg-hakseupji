// 저장 실패를 삼키지 않는다 — 못 올린 쓰기를 모아 두고 될 때까지 다시 보낸다
//
// ■ 왜 만들었나 (2026-08-15 "이현서 오늘 채점 기록 0건"의 구조적 원인)
//   ① 선생님이 채점하면 화면 상태가 먼저 바뀐다 → 채점판에 「✓ 저장됨 18:42」가 뜬다.
//   ② 그런데 cloud.upsert 는 실패해도 console.warn 한 줄이 전부였다(fire-and-forget).
//      네트워크가 잠깐 끊기거나 세션이 만료돼 RLS 에 막히면 아무도 모른다.
//      errorLog 는 console.error 만 주워 담으므로 이 warn 은 오류 기록에도 안 남았다.
//   ③ 그 상태에서 다른 기기가 아무거나 저장하면 실시간 구독이 loadAll() 을 돌려
//      store 가 setState(fromCloud(remote)) 로 화면 상태를 클라우드 것으로 통째 교체한다.
//   → 못 올라간 채점은 이 순간 로컬에서도 지워진다. 선생님은 저장된 걸 봤는데 기록은 0건이 된다.
//      새로고침을 안 해도 몇 초 만에 사라질 수 있다.
//
// ■ 그래서 이 파일이 하는 일은 셋뿐이다
//   · 실패한 쓰기를 (테이블, id) 하나당 하나씩 모은다 — localStorage 라 새로고침·재부팅에도 남는다
//   · 될 때까지 다시 보낸다 (백오프 + 온라인 복귀·탭 복귀 때 즉시 재시도)
//   · 🔴 클라우드에서 받은 데이터 위에 대기분을 덮어씌운다(applyTo). 위 ③을 막는 핵심이다.
//     이게 없으면 큐에 넣어도 화면에서는 사라진 것처럼 보인다.
//
// ■ 안 건드리는 것
//   live_* · replay_* · rubric_* 는 cloud.* 를 거치지 않고 supabase 를 직접 부른다(초 단위 쓰기).
//   여기 들어오지 않으므로 큐가 스냅샷·녹화로 부풀지 않는다.
import { supabase } from './supabase'
import { applyAssignmentCmds, ASSIGN_KEY, ASSIGN_TABLE, type AssignmentCmd } from './assignmentCmds'
import type { Assignment } from '../types'

export type PendingOp =
  | { kind: 'upsert'; table: string; id: string; data: unknown; at: string }
  | { kind: 'del'; table: string; id: string; at: string }
  // 배정은 스냅샷 upsert(마지막 쓰기가 이김) 대신 명령으로 남긴다 — 보낼 때마다 서버 최신을
  // 읽어 병합하므로, 두 기기가 동시에 배정해도 서로를 지우지 않는다 (assignmentCmds.ts 머리말)
  | { kind: 'aops'; table: string; id: string; cmds: AssignmentCmd[]; at: string }

export interface OutboxStatus {
  pending: number        // 아직 못 올린 쓰기 건수
  failing: boolean       // 한 번이라도 실패해서 재시도 중인가
  lastError?: string     // 마지막 실패 사유 (선생님에게 보여줄 짧은 문장)
  overflow: boolean      // localStorage 에 못 담았다 = 이 탭을 닫으면 사라진다
}

const LS = 'gsg-hakseupji-outbox-v1'
const keyOf = (table: string, id: string) => `${table}|${id}`

// (테이블,id) 하나당 최신 것 하나만 남긴다 — upsert 라 마지막 쓰기가 이긴다
const ops = new Map<string, PendingOp>()
let overflow = false
let failing = false
let lastError: string | undefined
let fails = 0                 // 연속 실패 횟수 (백오프용)
let flushing = false
let timer: ReturnType<typeof setTimeout> | null = null

const listeners = new Set<(s: OutboxStatus) => void>()
function snapshot(): OutboxStatus {
  return { pending: ops.size, failing, lastError, overflow }
}
function emit() { const s = snapshot(); for (const fn of listeners) fn(s) }

export function onOutbox(fn: (s: OutboxStatus) => void): () => void {
  listeners.add(fn); fn(snapshot())
  return () => { listeners.delete(fn) }
}
export const outboxStatus = snapshot

// ── 저장 (새로고침·재부팅에도 남게) ─────────────────────────────
function persist() {
  try {
    if (ops.size === 0) { localStorage.removeItem(LS); overflow = false; return }
    localStorage.setItem(LS, JSON.stringify([...ops.values()]))
    overflow = false
  } catch {
    // 쿼터 초과(풀이 이미지가 큰 경우 등) — 메모리에는 남기고 사실대로 알린다.
    // 여기서 버리면 지금 고치려는 그 사고가 그대로 난다.
    overflow = true
  }
}
function restore() {
  try {
    const raw = localStorage.getItem(LS)
    if (!raw) return
    const arr = JSON.parse(raw) as PendingOp[]
    if (Array.isArray(arr)) for (const o of arr) if (o && o.table && o.id) ops.set(keyOf(o.table, o.id), o)
  } catch { /* 손상된 큐는 무시 */ }
}
restore()

// ── 실제 전송 ────────────────────────────────────────────────
async function send(op: PendingOp): Promise<string | null> {
  if (!supabase) return '클라우드 연결 없음'
  try {
    if (op.kind === 'del') {
      const { error } = await supabase.from(op.table).delete().eq('id', op.id)
      return error ? error.message : null
    }
    if (op.kind === 'aops') return casMergeAssignments(op.cmds)
    const { error } = await supabase.from(op.table)
      .upsert({ id: op.id, data: op.data, updated_at: new Date().toISOString() })
    return error ? error.message : null
  } catch (e: unknown) {
    // supabase-js 는 보통 {error} 로 돌려주지만, fetch 자체가 죽으면 throw 한다(오프라인 등)
    return (e as Error)?.message ?? '네트워크 오류'
  }
}

/**
 * 배정 병합 저장 (CAS) — 서버 최신을 읽고 → 명령을 적용하고 → **읽었을 때의 updated_at
 * 그대로일 때만** 쓴다. 그 사이 다른 기기가 먼저 썼으면 0행 갱신이 되고, 다시 읽어 병합한다.
 * Postgres 가 행 잠금으로 갱신을 줄 세우므로 두 기기가 같은 순간에 써도 한쪽만 이기고,
 * 진 쪽은 이긴 쪽의 결과 **위에** 자기 명령을 다시 얹는다 — 어느 쪽 배정도 사라지지 않는다.
 */
async function casMergeAssignments(cmds: AssignmentCmd[]): Promise<string | null> {
  if (!supabase) return '클라우드 연결 없음'
  let lastErr = '배정 저장 경합 — 재시도 초과'
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 150 + Math.floor(Math.random() * 300) * attempt))
    const { data: row, error: readErr } = await supabase
      .from(ASSIGN_TABLE).select('data, updated_at').eq('id', ASSIGN_KEY).maybeSingle()
    if (readErr) return readErr.message
    const cur = ((row?.data as { value?: Assignment[] } | null)?.value) ?? []
    const payload = { data: { __id: ASSIGN_KEY, value: applyAssignmentCmds(cur, cmds) }, updated_at: new Date().toISOString() }
    if (!row) {
      const { error } = await supabase.from(ASSIGN_TABLE).insert({ id: ASSIGN_KEY, ...payload })
      if (!error) return null
      if (error.code !== '23505') return error.message   // 23505(중복키) = 다른 기기가 방금 만듦 → 재시도
      lastErr = error.message
    } else {
      const base = supabase.from(ASSIGN_TABLE).update(payload).eq('id', ASSIGN_KEY)
      const { data: hit, error } = await (row.updated_at == null
        ? base.is('updated_at', null)
        : base.eq('updated_at', row.updated_at as string)).select('id')
      if (error) return error.message
      if (hit && hit.length > 0) return null   // 갱신 성공
    }
  }
  return lastErr
}

// 2초 → 5 → 15 → 30 → 60초, 그 뒤로는 60초마다
const BACKOFF = [2000, 5000, 15000, 30000, 60000]
function schedule() {
  if (timer || ops.size === 0) return
  const wait = BACKOFF[Math.min(fails, BACKOFF.length - 1)]
  timer = setTimeout(() => { timer = null; void flush() }, wait)
}

/** 대기분을 지금 한 번 보내 본다. 전부 올라갔으면 true. */
export async function flush(): Promise<boolean> {
  if (flushing || !supabase) return ops.size === 0
  flushing = true
  try {
    for (const [k, op] of [...ops]) {
      const err = await send(op)
      if (err) {
        fails++; failing = true; lastError = err.slice(0, 160)
        persist(); emit(); schedule()
        return false                       // 하나 막히면 순서를 지키려 여기서 멈춘다
      }
      // 보내는 사이에 같은 칸에 더 새 것이 들어왔으면 그건 남긴다
      if (ops.get(k) === op) ops.delete(k)
    }
    fails = 0; failing = false; lastError = undefined
    persist(); emit()
    return true
  } finally { flushing = false }
}

async function enqueueAndSend(k: string, op: PendingOp): Promise<boolean> {
  ops.set(k, op)          // 🔴 보내기 전에 넣는다 — 보내는 도중 창이 닫혀도 남게
  persist(); emit()
  const err = await send(op)
  if (!err) {
    if (ops.get(k) === op) { ops.delete(k); persist() }
    if (ops.size === 0) { fails = 0; failing = false; lastError = undefined }
    emit()
    return true
  }
  fails++; failing = true; lastError = err.slice(0, 160)
  emit(); schedule()
  return false
}

/** 쓰기 한 건. 즉시 보내 보고, 실패하면 큐에 남아 계속 재시도된다. 성공하면 true. */
export async function write(op: PendingOp): Promise<boolean> {
  return enqueueAndSend(keyOf(op.table, op.id), op)
}

/**
 * 배정 명령 쓰기. 같은 칸에 아직 못 보낸 명령이 있으면 **바꿔치기가 아니라 뒤에 잇는다** —
 * 오프라인에 여러 배정을 만들어도 전부 순서대로 서버에 병합된다. 명령이 멱등이라
 * 재전송으로 같은 명령이 두 번 적용돼도 결과는 같다.
 */
export async function writeAssignmentOps(cmds: AssignmentCmd[]): Promise<boolean> {
  const k = keyOf(ASSIGN_TABLE, ASSIGN_KEY)
  const prev = ops.get(k)
  const op: PendingOp = prev?.kind === 'aops'
    ? { ...prev, cmds: [...prev.cmds, ...cmds], at: new Date().toISOString() }
    : { kind: 'aops', table: ASSIGN_TABLE, id: ASSIGN_KEY, cmds, at: new Date().toISOString() }
  return enqueueAndSend(k, op)
}

/**
 * 🔴 클라우드에서 읽어 온 행 위에 아직 못 올린 대기분을 덮어씌운다.
 * 이게 없으면 큐에 잘 담아 놓고도 화면에서는 채점이 사라진 것처럼 보인다(위 ③).
 */
export function applyTo(table: string, rows: { id: string; data: unknown }[]): { id: string; data: unknown }[] {
  if (ops.size === 0) return rows
  const mine = [...ops.values()].filter(o => o.table === table)
  if (mine.length === 0) return rows
  const byId = new Map(rows.map(r => [r.id, r]))
  for (const o of mine) {
    if (o.kind === 'del') byId.delete(o.id)
    else if (o.kind === 'aops') {
      // 배정 명령은 덮어쓰기가 아니라 클라우드 값 위에 적용 — 다른 기기의 배정을 화면에서도 안 지운다
      const cur = ((byId.get(o.id)?.data as { value?: Assignment[] } | undefined)?.value) ?? []
      byId.set(o.id, { id: o.id, data: { __id: o.id, value: applyAssignmentCmds(cur, o.cmds) } })
    }
    else byId.set(o.id, { id: o.id, data: o.data })
  }
  return [...byId.values()]
}

// ── 다시 보낼 기회를 놓치지 않는다 ────────────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { fails = 0; void flush() })
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void flush() })
  // 부팅 직후 한 번 — 지난번에 못 올린 것이 있으면 여기서 올라간다
  setTimeout(() => { void flush() }, 1500)
}
