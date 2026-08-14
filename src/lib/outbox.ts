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

export type PendingOp =
  | { kind: 'upsert'; table: string; id: string; data: unknown; at: string }
  | { kind: 'del'; table: string; id: string; at: string }

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
    const { error } = await supabase.from(op.table)
      .upsert({ id: op.id, data: op.data, updated_at: new Date().toISOString() })
    return error ? error.message : null
  } catch (e: unknown) {
    // supabase-js 는 보통 {error} 로 돌려주지만, fetch 자체가 죽으면 throw 한다(오프라인 등)
    return (e as Error)?.message ?? '네트워크 오류'
  }
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

/** 쓰기 한 건. 즉시 보내 보고, 실패하면 큐에 남아 계속 재시도된다. 성공하면 true. */
export async function write(op: PendingOp): Promise<boolean> {
  const k = keyOf(op.table, op.id)
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
