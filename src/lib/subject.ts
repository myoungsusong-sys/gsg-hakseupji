import { useSyncExternalStore } from 'react'
import type { Grading, WBItem, Workbook, Worksheet } from '../types'
import { subjectOfCourse, subjectOfType } from '../data/curriculum'
import { resultTypeId } from './drill'

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

// 채점 기록 1건의 과목 — 보고서·집계를 헤더 과목 스위처에 맞춰 거를 때 쓴다.
// (안 거르면 과학 보고서에 그날 푼 수학 교재·유형·단원이 그대로 섞여 나온다)
// 판정 순서: 교재/학습지의 명시 subject > 교재 course로 유도 > 문항 유형으로 유도 > 수학(레거시 데이터).
export function subjectOfGrading(
  g: Grading,
  wbById: Map<string, Workbook>,
  wsById: Map<string, Worksheet>,
  itemMap: Map<string, WBItem>,
): Subject {
  if ((g.source ?? '교재') === '교재') {
    const w = g.workbookId ? wbById.get(g.workbookId) : undefined
    if (w) return w.subject ?? subjectOfCourse(w.course) ?? '수학'
  } else {
    const w = g.worksheetId ? wsById.get(g.worksheetId) : undefined
    if (w?.subject) return w.subject
  }
  // 참조가 끊긴 기록(이관분·레거시 학습지)은 문항 유형으로 유도
  for (const r of g.results) {
    const t = resultTypeId(r, itemMap)
    const s = t ? subjectOfType(t) : undefined
    if (s) return s
  }
  return '수학'
}

export function useSubject(): [Subject, (s: Subject) => void] {
  const v = useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb) },
    () => cur,
  )
  return [v, setSubject]
}
