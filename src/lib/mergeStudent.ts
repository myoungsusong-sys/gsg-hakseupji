import type { Student } from '../types'

// ── 같은 학생이 두 번 등록된 것을 하나로 합친다 ─────────────────────────
//
// 왜 필요한가: 이름을 한 글자 다르게 등록하면(강려원 / 강리원) 같은 아이가 두 명이 된다.
// 그러면 채점 기록이 반반으로 쪼개져 정답률·리포트·오답학습지가 **반쪽만** 보게 된다.
// (2026-08-13 실측: 강려원 143건 / 강리원 142건 — 학년·학교·학부모 연락처가 모두 같았다)
//
// 🔴 이 파일은 **계획만 만든다.** 실제 쓰기는 호출부(관리 화면)가 사람이 미리보기를 확인한
//    뒤에 한다. 그래야 무엇이 어디로 가는지 보고 나서 누를 수 있다.
//
// 🔴 studentId 가 박히는 자리가 **필드만이 아니다.** 아래 셋은 id·키 문자열 안에 들어 있어서
//    필드만 바꾸면 조용히 어긋난다. 여기가 이 작업에서 제일 틀리기 쉬운 곳이다.
//      · PointSettlement.id  = `${studentId}_${YYYY-MM}`
//      · LecturePlan.id      = `${studentId}_${workbookId}`
//      · SolveFeedback.id    = `${studentId}_${worksheetId}_${problemId}`
//      · ttChecks 의 키       = `${studentId}|${날짜}|${블록idx}`
//      · dailyConfigs 의 키   = studentId 그 자체
//    그리고 두 학생이 같은 교재를 갖고 있으면 옮긴 뒤 **id가 겹친다** → 겹치면 남길 쪽(keep)을
//    우선하고 옮겨온 쪽은 버린다(사람이 미리보기에서 개수를 보고 판단할 수 있게 세어 둔다).

export interface MergeCandidate {
  a: Student
  b: Student
  reasons: string[]      // 같다고 본 근거 (학년·학교·학부모 연락처 …)
  score: number          // 높을수록 확실
}

// 한 글자만 다른 같은 길이 이름
function oneCharApart(a: string, b: string): boolean {
  if (a.length !== b.length || a === b) return false
  let n = 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++n > 1) return false
  return n === 1
}

const digits = (s?: string) => (s ?? '').replace(/\D/g, '')

// 중복 후보 찾기 — 이름이 한 글자 다르고, 학년·학교·연락처가 겹칠수록 점수가 높다
export function findMergeCandidates(students: Student[]): MergeCandidate[] {
  const act = students.filter(s => s.active)
  const out: MergeCandidate[] = []
  for (let i = 0; i < act.length; i++) {
    for (let j = i + 1; j < act.length; j++) {
      const a = act[i], b = act[j]
      if (!oneCharApart(a.name, b.name)) continue
      const reasons: string[] = []
      let score = 0
      if (a.grade === b.grade) { reasons.push(`학년 같음(${a.grade})`); score += 2 }
      if (a.school && a.school === b.school) { reasons.push(`학교 같음(${a.school})`); score += 2 }
      const pa = digits(a.parentPhone), pb = digits(b.parentPhone)
      if (pa && pa === pb) { reasons.push('학부모 연락처 같음'); score += 3 }
      // 🔴 연락처가 같아도 **학년이 다르면 형제자매**일 가능성이 크다 — 점수를 깎는다.
      //    (실측: 송지안 중3 / 송지우 고1 은 같은 번호지만 남매다. 합치면 안 된다)
      if (pa && pa === pb && a.grade !== b.grade) { reasons.push('⚠️ 학년이 달라 형제자매일 수 있음'); score -= 4 }
      if (score <= 0) continue
      out.push({ a, b, reasons, score })
    }
  }
  return out.sort((x, y) => y.score - x.score)
}

export interface MergePlan {
  keep: Student
  drop: Student
  moves: { label: string; n: number }[]   // 무엇이 몇 건 옮겨지나 (미리보기용)
  conflicts: { label: string; n: number }[]  // id가 겹쳐 버려지는 것
}

interface Coll {
  gradings: { studentId: string }[]
  workbooks: { studentId?: string }[]
  assignments: { studentId: string }[]
  dailyNotes: { studentId: string }[]
  savedReports: { studentId: string }[]
  lecturePlans: { id: string; studentId: string }[]
  solveFeedbacks: { id: string; studentId: string }[]
  pointEntries: { studentId: string }[]
  pointSettlements: { id: string; studentId: string }[]
  ttChecks: Record<string, true>
  dailyConfigs: Record<string, unknown>
}

// 미리보기 계획 — 실제로 쓰지 않고 "무엇이 몇 건 움직이나"만 센다
export function planMerge(keep: Student, drop: Student, c: Coll): MergePlan {
  const n = (arr: { studentId?: string }[]) => arr.filter(x => x.studentId === drop.id).length
  const keepIds = (arr: { id: string; studentId: string }[]) =>
    new Set(arr.filter(x => x.studentId === keep.id).map(x => x.id.replace(keep.id, '@')))
  const clash = (arr: { id: string; studentId: string }[]) => {
    const ks = keepIds(arr)
    return arr.filter(x => x.studentId === drop.id && ks.has(x.id.replace(drop.id, '@'))).length
  }

  const moves = [
    { label: '채점 기록', n: n(c.gradings) },
    { label: '교재', n: n(c.workbooks) },
    { label: '학습지 배정', n: n(c.assignments) },
    { label: '수업 일지', n: n(c.dailyNotes) },
    { label: '저장한 보고서', n: n(c.savedReports) },
    { label: '진도표', n: n(c.lecturePlans) },
    { label: '풀이 피드백', n: n(c.solveFeedbacks) },
    { label: '포인트 항목', n: n(c.pointEntries) },
    { label: '포인트 정산', n: n(c.pointSettlements) },
    { label: '시간표 완료 체크', n: Object.keys(c.ttChecks).filter(k => k.startsWith(drop.id + '|')).length },
    { label: '오늘의 학습 설정', n: c.dailyConfigs[drop.id] ? 1 : 0 },
  ].filter(m => m.n > 0)

  const conflicts = [
    { label: '진도표(같은 교재)', n: clash(c.lecturePlans) },
    { label: '풀이 피드백(같은 문항)', n: clash(c.solveFeedbacks) },
    { label: '포인트 정산(같은 달)', n: clash(c.pointSettlements) },
  ].filter(x => x.n > 0)

  return { keep, drop, moves, conflicts }
}
