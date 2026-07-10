import { useSyncExternalStore } from 'react'

// 전역 과목 컨텍스트 — 수업 준비(학습지 만들기·문제은행·교재·기출) 화면 공용.
// 헤더 스위처에서 한 번 고르면 출제 관련 화면 전체가 그 과목 모드로 동작하고, 기기별로 기억된다.
// ★ 확장(국어·영어·사회…): 아래 SUBJECTS 배열에 과목명만 추가하면 헤더 스위처가 따라온다.
//   (커리큘럼 쪽은 curriculum.ts의 Curriculum.subject에 같은 문자열을 쓰면 자동 연동)
export const SUBJECTS = ['수학', '과학'] as const
export type Subject = (typeof SUBJECTS)[number]

const KEY = 'gsg-subject'

function load(): Subject {
  try {
    const v = localStorage.getItem(KEY) as Subject | null
    if (v && (SUBJECTS as readonly string[]).includes(v)) return v
  } catch { /* 무시 */ }
  return '수학'
}

let cur: Subject = load()
const listeners = new Set<() => void>()

export function getSubject(): Subject { return cur }

export function setSubject(s: Subject) {
  if (cur === s) return
  cur = s
  try { localStorage.setItem(KEY, s) } catch { /* 무시 */ }
  listeners.forEach(f => f())
}

export function useSubject(): [Subject, (s: Subject) => void] {
  const v = useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb) },
    () => cur,
  )
  return [v, setSubject]
}
