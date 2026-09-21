import { CURRICULA, subjectOfCourse } from '../data/curriculum'
import { GEN_ONLY_COURSES, POOL_COURSES, WANJA_COURSES } from '../data/pool'
import { gradeKey } from './grade'

// ── 학습지 문항이 들어 있을 문제은행 과정 — 가까운 것부터 단계별로 (2026-09-21) ─────────────
//
// 🔴 명수쌤 2026-09-21: "학습지앱에서 프린트하려고 하는데 미리보기가 아예 안 떠 로딩만 계속돼"
//    미리보기(WorksheetView)는 **이미 불러온 문제은행**에서만 문항을 찾는데, 앱은 처음에 학습지 학년의
//    **기본 과정 하나**(고2 → 대수, 중2 → 2-1 수학)만 불러온다. 미적분Ⅰ·과학·영어 학습지를 인쇄 창으로 열면
//    문항을 하나도 못 찾아 「조판 중…」에서 영원히 멈췄다. 다른 화면을 먼저 봐서 그 과정이 올라와 있을 때만 됐다.
//    → 미리보기가 직접 불러온다. 문항 id 만으로는 과정을 알 수 없으므로(mf<번호> 등) 가까운 것부터 넓힌다:
//      ① 같은 학년·같은 과목  ② 같은 학교급·같은 과목  ③ 그 과목 전체.
const LOADABLE: string[] = [...new Set<string>([...POOL_COURSES, ...GEN_ONLY_COURSES, ...WANJA_COURSES])]
const gradeOfCourse = (id: string) => CURRICULA.find(c => c.id === id)?.grade ?? ''
/** 학교급(초/중/고) — 단원표에 학년이 없는 풀 전용 과정(15개정 고등 h-hs1·h-s1 등)은 이름으로 판정 */
const levelOf = (id: string): string => {
  const g = gradeKey(gradeOfCourse(id))
  if (g) return g[0]
  if (id.startsWith('h-') || /-h\d$/.test(id)) return '고'
  if (/^m\d|^m-|-m\d$/.test(id)) return '중'
  if (/^e\d/.test(id)) return '초'
  return ''
}

export function poolStagesFor(grade: string, subject?: string): string[][] {
  const subj = subject ?? '수학'
  const g = gradeKey(grade)
  const bySubj = LOADABLE.filter(c => (subjectOfCourse(c) ?? '수학') === subj)
  const s1 = g ? bySubj.filter(c => gradeKey(gradeOfCourse(c)) === g) : []
  const s2 = g ? bySubj.filter(c => !s1.includes(c) && levelOf(c) === g[0]) : []
  const s3 = bySubj.filter(c => !s1.includes(c) && !s2.includes(c))
  // 수학 문제은행은 크다(초 30MB·중 21MB·고 21MB) — 과목 전체를 받으면 태블릿이 멈춘다.
  // 수학 학습지 문항은 같은 학교급 안에 있으므로 수학은 ②까지만 찾는다.
  return (subj === '수학' ? [s1, s2] : [s1, s2, s3]).filter(s => s.length > 0)
}
