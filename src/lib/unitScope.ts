// 🔗 관리앱(학생앱) «오늘 배운 단원» 연결 (2026-10-19 명수쌤 "전과목 다 이어지게")
//
// 관리앱 학생앱에서 학생이 오늘 학교에서 배운 단원을 **이 앱의 단원 id 그대로** 고른다.
//   개념강의 칸 → #/student/unit?unit=<단원id>          (단원 개념학습: 강의·개념카드·개념영상)
//   문제풀이 칸 → #/student/mastery?unit=<단원id>       (단원 승강제: 그 단원 유형 전부를 차례로 끝까지)
// 단원 id 는 대(`<과정>-u0`)·중(`-u0m0`)·소(`-u0m0s0`) 어느 층이든 된다 — 그 아래 유형을 모두 모은다.
// 끝나면 바깥 창(관리앱 학생앱)에 postMessage 로 알려 칸을 자동 완료시킨다.

import { CURRICULA, type Curriculum } from '../data/curriculum'

export interface UnitScope {
  id: string
  course: Curriculum
  name: string
  path: string              // "대단원 › 중단원 › 소단원"
  bigName: string
  midName: string           // 대단원을 골랐으면 ''
  subName: string           // 소단원을 골랐을 때만
  subIds: string[]          // 개념카드 찾을 때
  /** 고른 단원 + 위·아래 단원 id 전부 — 개념영상 찾을 때 (중단원 가로 강의 + 소단원 쇼츠) */
  videoKeys: string[]
  typeIds: string[]         // 커리큘럼 순서대로
}

export function findUnit(id: string | null | undefined): UnitScope | null {
  if (!id) return null
  for (const c of CURRICULA) for (const u of c.units) {
    const all = (subs: { id: string; types: { id: string }[] }[], up: string[], mids: string[]) => ({
      subIds: subs.map(s => s.id),
      typeIds: subs.flatMap(s => s.types.map(t => t.id)),
      videoKeys: [...up, id, ...mids, ...subs.map(s => s.id)].filter((x, i, a) => a.indexOf(x) === i),
    })
    if (u.id === id) {
      return { id, course: c, name: u.name, path: u.name, bigName: u.name, midName: '', subName: '', ...all(u.mids.flatMap(m => m.subs), [], u.mids.map(m => m.id)) }
    }
    for (const m of u.mids) {
      if (m.id === id) return { id, course: c, name: m.name, path: `${u.name} › ${m.name}`, bigName: u.name, midName: m.name, subName: '', ...all(m.subs, [u.id], []) }
      for (const s of m.subs) if (s.id === id) {
        return { id, course: c, name: s.name, path: `${u.name} › ${m.name} › ${s.name}`, bigName: u.name, midName: m.name, subName: s.name, ...all([s], [u.id, m.id], []) }
      }
    }
  }
  return null
}

/** 바깥 창(관리앱 학생앱)에 알린다. 안에 들어 있지 않으면 아무 일도 하지 않는다. 학생 정보는 싣지 않는다. */
export function tellHost(msg: { step: 'concept' | 'drill'; unit: string; done: number; total: number; complete: boolean }) {
  try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'hj-unit', ...msg }, '*') } catch { /* 무시 */ }
}
