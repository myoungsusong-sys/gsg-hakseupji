import { useSyncExternalStore } from 'react'

// ── 지점 스코프 — 지금 어느 지점을 보고 있나 (기기별 저장) ──
//
// 왜 localStorage 인가: 지점은 "이 태블릿·이 노트북이 어느 지점에 있나"라서 계정이 아니라
// 기기에 붙는 게 맞다. 당진 데스크의 브라우저는 늘 당진이면 된다. (subject.ts 와 같은 방식)
//
// 🔴 이 파일의 규칙 3가지 — "72명이 사라지지 않는다"의 코드 보장이다. 지우지 마라.
//  ① 기본값은 ALL(전체 지점)이다. 처음 켠 사람에게 학생이 줄어 보이면 그건 고장으로 읽힌다.
//  ② **지점이 2개 미만이면 필터는 항등이다.** 지점을 안 쓰는 학원(지금 상태)에서는
//     이 기능이 존재하지 않는 것처럼 동작해야 한다.
//  ③ **미배정(branchId 없음) 학생은 어느 지점을 골라도 보인다.** 배정하는 도중에 학생이
//     화면에서 사라지면 수업이 멈춘다. 숨기고 싶은 유혹이 들면 TodayRoom 의 실패 기록을 보라.

const KEY = 'gsg-branch'
export const ALL = 'all'

function load(): string {
  try { return localStorage.getItem(KEY) || ALL } catch { return ALL }
}

let cur = load()
const listeners = new Set<() => void>()

export function getBranch(): string { return cur }

export function setBranch(v: string) {
  if (cur === v) return
  cur = v
  try { localStorage.setItem(KEY, v) } catch { /* 사파리 프라이빗 등 — 무시 */ }
  listeners.forEach(f => f())
}

export function useBranchScope(): string {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb) },
    () => cur,
    () => ALL,
  )
}
