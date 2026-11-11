import { zbCourseOf } from './curriculum-zb'
import { EXAM_COURSES } from './curriculum-exam'

// 학습지 문항 id → 그 문항이 든 과정 파일(gen-<과정>.json). 학습지마다 필요한 과정만 부른다.
// 🔴 2026-11-11 «문제가 안 뜹니다»(김채원 · 내신 기출 중2 과학 6-2-1 호흡): 예전엔 족보(zb-…) 문항만 알아봐서
//    시험대비·내신 기출 문항(ns-sci-m2-0877-01 · exam-int2-adv-001)은 과정 파일을 아무도 안 불렀고,
//    채점 화면이 «0문제 · 문제은행에서 찾을 수 없습니다»였다. (curriculum-zb.ts 는 자동 생성이라 여기 둔다)
let examIds: string[] | null = null
function examCourseOf(problemId: string): string | null {
  if (!examIds) examIds = EXAM_COURSES.map(c => c.id).sort((a, b) => b.length - a.length)   // 긴 id 먼저 — 앞머리가 겹쳐도 맞게
  for (const id of examIds) if (problemId.startsWith(id + '-')) return id
  return null
}

export function problemCoursesOf(problemIds: readonly string[] | undefined): string[] {
  const out = new Set<string>()
  for (const id of problemIds ?? []) { const c = zbCourseOf(id) ?? examCourseOf(id); if (c) out.add(c) }
  return [...out]
}
