// 배정(assignments) 변경을 「결과 스냅샷」이 아니라 「무엇을 했나」(명령)로 표현한다.
//
// ■ 왜 (2026-08-15 강리원 배정 유실의 구조적 원인)
//   배정 전체가 hj_settings 'assignments' 한 행에 통짜 배열로 저장되는데,
//   기존에는 각 기기가 자기 화면 기준 배열을 setSetting 으로 통째 upsert 했다(마지막 쓰기가 이김).
//   두 기기가 동시에 배정을 만들면 — 자동 오답학습지는 학생이 제출할 때마다 그 학생 기기에서
//   배정을 만들므로 반 전체 제출 시 상시 동시 — 늦게 쓴 쪽이 먼저 쓴 쪽의 배정을 통째로 지웠다.
//
// ■ 그래서
//   쓰기를 명령(add/remove/sync)으로 남기고, 보내는 쪽(outbox)이 보낼 때마다
//   서버 최신을 읽어 이 명령을 병합한 뒤 조건부 갱신(CAS)으로 저장한다.
//   명령은 몇 번을 다시 적용해도 결과가 같다(멱등) — 재시도·재전송에 안전하다.
import type { Assignment } from '../types'

export const ASSIGN_KEY = 'assignments'
export const ASSIGN_TABLE = 'hj_settings'

export type AssignmentCmd =
  // 없는 (학습지×학생×종류)만 덧붙인다 — store.addAssignment 와 같은 중복 규칙
  | { type: 'add'; items: Assignment[] }
  // (학습지×학생) 제거, kind 지정 시 그 종류만 — store.removeAssignment 와 동일
  | { type: 'remove'; worksheetId: string; studentId: string; kind?: Assignment['kind'] }
  // 이 학습지를 받는 학생을 통째로 맞춘다 — store.syncAssignments 와 동일 (출제 다이얼로그)
  | { type: 'sync'; worksheetId: string; studentIds: string[]; kind: Assignment['kind']; reveal?: Assignment['reveal']; exam?: Assignment['exam']; items: Assignment[] }

export function applyAssignmentCmds(cur: Assignment[], cmds: AssignmentCmd[]): Assignment[] {
  let out = cur
  for (const c of cmds) {
    if (c.type === 'add') {
      const fresh = c.items.filter(n => !out.some(a =>
        a.id === n.id || (a.worksheetId === n.worksheetId && a.studentId === n.studentId && a.kind === n.kind)))
      if (fresh.length) out = [...out, ...fresh]
    } else if (c.type === 'remove') {
      out = out.filter(a =>
        !(a.worksheetId === c.worksheetId && a.studentId === c.studentId && (c.kind ? a.kind === c.kind : true)))
    } else {
      const keep = new Set(c.studentIds)
      const kept = out
        .filter(a => a.worksheetId !== c.worksheetId || keep.has(a.studentId))
        .map(a => (a.worksheetId === c.worksheetId ? { ...a, reveal: c.reveal, exam: c.exam } : a))
      const has = new Set(kept.filter(a => a.worksheetId === c.worksheetId && a.kind === c.kind).map(a => a.studentId))
      out = [...kept, ...c.items.filter(n => !has.has(n.studentId) && !kept.some(a => a.id === n.id))]
    }
  }
  return out
}
