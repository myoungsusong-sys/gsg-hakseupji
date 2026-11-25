import type { Assignment, Problem, SchoolExam, Student, Worksheet } from '../types'
import { CURRICULA, curriculumFor, type Curriculum } from '../data/curriculum'
import { gradeKey } from './grade'
import { groupOf } from './schoolReview'
import { isSchoolCourse, schoolKey } from '../data/schoolPub'

// ── 📝 시험 범위 → 출제 (학생 시험 일정 표의 [이 범위로 출제]) — 2026-09-17 명수쌤 "이 범위로 출제 버튼 만들어줘" ──
//
//   ① 과정 고르기: 학생 학년 + 시험 학기(시험 이름의 '1학기/2학기', 없으면 시험 달) + 과목 이름.
//   ② 범위 글자 읽기: 단원 **이름**이 가장 믿을 만하다(학교 교과서 단원 번호는 우리 과정 번호와 다르다).
//      이름이 없으면 'N단원'·'Ⅱ~Ⅲ' 번호, 그것도 없으면 전체. 화면에서 선생님이 칩으로 고친다.
//   ③ 문항 뽑기는 내신관(lib/naesin.ts pickNaesinProblems)을 그대로 쓴다 — 유형 고르게·쌍둥이 중복 없이·난이도 섞기.

export type ExamSubjectGroup = '수학' | '국어' | '영어' | '과학' | '사회' | '역사'

/** 시험이 몇 학기 것인가 — 이름 우선, 없으면 달(3~8월 1학기) */
export function semesterOf(exam: Pick<SchoolExam, 'name' | 'days'>): 1 | 2 {
  const m = exam.name.match(/([12])\s*학기/)
  if (m) return Number(m[1]) as 1 | 2
  const mon = Number(exam.days[0]?.date.slice(5, 7) || 0)
  return mon >= 3 && mon <= 8 ? 1 : 2
}

const norm = (s: string) => s.replace(/\s+/g, '').replace(/[Ⅰ1]$/, 'Ⅰ').replace(/[Ⅱ2]$/, 'Ⅱ')
const has = (id: string) => CURRICULA.some(c => c.id === id)

/** 과목 이름 → 이 학생이 쓸 수 있는 과정 후보(첫째가 기본값). 문제은행이 없는 과목은 빈 배열. */
export function coursesForExamSubject(subject: string, grade: string, sem: 1 | 2): string[] {
  const g = gradeKey(grade)                        // '중2' · '고1'
  const lv = g[0], n = Number(g[1])
  if (!lv || !n) return []
  const name = norm(subject)
  const group = groupOf(subject) as ExamSubjectGroup | null
  const out: string[] = []
  const push = (...ids: string[]) => { for (const id of ids) if (has(id) && !out.includes(id)) out.push(id) }

  if (group === '수학') {
    if (lv === '중') push(`m${n}-${sem}`, `m${n}-${sem === 1 ? 2 : 1}`)
    else {
      if (/공통수학Ⅰ|공통수학1/.test(name)) push('h-cm1')
      if (/공통수학Ⅱ|공통수학2/.test(name)) push('h-cm2')
      if (/대수/.test(name)) push('h-alg')
      if (/미적분Ⅱ|미적분2/.test(name)) push('h-calc2')
      else if (/미적/.test(name)) push('h-calc1')
      if (/확률|확통/.test(name)) push('h-stat')
      if (/기하/.test(name)) push('h-geo')
      if (n === 1) push(sem === 1 ? 'h-cm1' : 'h-cm2', 'h-cm1', 'h-cm2')
      if (n === 2) push('h-alg', 'h-calc1', 'h-stat')
      if (n === 3) push('h-calc2', 'h-geo', 'h-stat')
    }
  } else if (group === '과학') {
    if (lv === '중') {
      if (n === 3) push(sem === 2 ? 'm-sci3-2' : 'm-sci3', 'm-sci3', 'm-sci3-2')
      else push(`m-sci${n}-${sem}`, `m-sci${n}-${sem === 1 ? 2 : 1}`)
    } else {
      if (/통합과학Ⅰ|통합과학1/.test(name)) push('h-int1')
      if (/통합과학Ⅱ|통합과학2/.test(name)) push('h-int2')
      if (/물리/.test(name)) push('h-phy')
      if (/화학/.test(name)) push('h-chem')
      if (/생명|생물/.test(name)) push('h-bio')
      if (/지구/.test(name)) push('h-earth')
      if (n === 1) push(sem === 1 ? 'h-int1' : 'h-int2', 'h-int1', 'h-int2')
    }
  } else if (group === '사회') {
    // 🆕 중학 역사 — 올쏘 역사①·② 문제은행(2026-09-28). 학교마다 ①·②를 가르치는 학년이 달라
    //    학년 기본값(중1·2 → ①, 중3 → ②) 뒤에 나머지 역사 과정을 후보로 붙인다(화면에서 고른다).
    if (lv === '중' && /역사/.test(name)) {
      const a = n >= 3 ? 2 : 1, b = a === 1 ? 2 : 1, o = sem === 1 ? 2 : 1
      push(`m-his${a}-${sem}`, `m-his${a}-${o}`, `m-his${b}-${sem}`, `m-his${b}-${o}`)
      return out
    }
    // 🆕 고등 한국사(22개정 고1 한국사1·2) — 2026-09-28. 학기로 1·2 를 먼저, 나머지를 뒤에
    if (lv === '고' && /한국사|역사/.test(name)) {
      push(sem === 1 ? 'h-khis1' : 'h-khis2', 'h-khis1', 'h-khis2')
      return out
    }
    if (/한국사|역사/.test(name)) return []
    if (lv === '중') {
      const a = Math.min(n, 2), b = a === 1 ? 2 : 1, o = sem === 1 ? 2 : 1
      push(`m-soc${a}-${sem}`, `m-soc${a}-${o}`, `m-soc${b}-${sem}`, `m-soc${b}-${o}`)
    }
    else {
      if (/통합사회Ⅰ|통합사회1/.test(name)) push('h-soc1')
      if (/통합사회Ⅱ|통합사회2/.test(name)) push('h-soc2')
      if (n === 1 || /통합사회/.test(name)) push(sem === 1 ? 'h-soc1' : 'h-soc2', 'h-soc1', 'h-soc2')
    }
  } else if (group === '영어') {
    push(`eng-${lv === '중' ? 'm' : 'h'}${n}`)
  } else if (group === '국어') {
    push(`kor-${lv === '중' ? 'm' : 'h'}${n}`)
  }
  return out
}
/**
 * 🏫 이 학생 학교·학기에 맞춘 시험대비 과정 — 2026-11-25 윤자혜 선생님 «시험범위를 올리면 그에 맞는 문제지 출제» (내포중 2학년)
 *   ① 이름에 학교가 들어간 시험대비 과정(예: «시험대비 · 중2 영어 NE능률(김기택) (2026 2학기 기말 · 내포중)»)
 *   ② 학교 교과서 표(schoolBooksSeed)와 출판사가 맞는 족보·내신 기출 과정(국어·영어)
 *   교과서 본 과정에 시험 단원이 없을 때(능률 중2 본 과정은 1~4과뿐, 시험은 7·8과) 이 과정이 있어야 범위대로 나간다.
 */
export function schoolExamCourses(subject: string, st: Pick<Student, 'school' | 'grade'>, sem: 1 | 2): string[] {
  const group = groupOf(subject)
  const g = gradeKey(st.grade)
  const key = schoolKey(st.school)
  if (!group || !g || !key) return []
  const same = (c: Curriculum) => (c.grade === `${g}-${sem}` || c.grade === g) && groupOf(c.subject ?? '') === group
  const bySchool = CURRICULA.filter(c => /^(exam2?|set2?)-/.test(c.id) && same(c) && c.label.includes(key))
  const byBook = CURRICULA.filter(c => /^(zb|ns)-/.test(c.id) && same(c) && isSchoolCourse(c, st.school, st.grade))
  return [...bySchool, ...byBook].map(c => c.id)
}

export function subjectGroupOfCourse(courseId: string): ExamSubjectGroup {
  return (curriculumFor(courseId).subject ?? '수학') as ExamSubjectGroup
}

// ── 범위 글자 → 중단원 ──────────────────────────────────────────────────────
export interface RangePick { midIds: string[]; how: 'name' | 'number' | 'all' }
const ROMAN = 'ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ'
const STOP = new Set(['단원', '범위', '까지', '부터', '전체', '교과서', '교재', '시험', '중간', '기말', '프린트', '학습지', '활동지', '포함', '제외', '본문'])

export function parseRange(range: string | undefined, cur: Curriculum): RangePick {
  const all = cur.units.flatMap(u => u.mids.map(m => m.id))
  const text = (range ?? '').trim()
  if (!text || cur.units.length <= 1) return { midIds: all, how: 'all' }
  const flat = text.replace(/\s+/g, '')

  // ⓪ 중단원 이름이 «1-2. …» 꼴이면 글자의 «1-(2)»·«1-2» 번호로 맞춘다 — 국어 교과서 과정(11/25 내포중 국어: «읽기»·«자료» 낱말로 4-1·3-2 까지 끌려옴)
  const pairOf = (name: string) => /^\s*(\d+)\s*-\s*(\d+)\s*[.)]/.exec(name)
  if (cur.units.some(u => u.mids.some(m => pairOf(m.name)))) {
    const pairs = new Set([...text.matchAll(/(\d+)\s*-\s*\(?\s*(\d+)\s*\)?/g)].map(m => `${Number(m[1])}-${Number(m[2])}`))
    const byPair = all.filter(id => { const m = cur.units.flatMap(u => u.mids).find(x => x.id === id); const p = m && pairOf(m.name); return !!p && pairs.has(`${Number(p[1])}-${Number(p[2])}`) })
    if (byPair.length) return { midIds: byPair, how: 'name' }
  }

  // ① 이름 — 중단원·대단원 이름이 글자에 있거나, 글자의 낱말이 이름 안에 있으면
  type Hit = { pos: number; mids: string[] }
  const hits: Hit[] = []
  // 글자에 이름이 통째로 든 단원·중단원 — 그 이름의 낱말(«에너지»·«성질»·«호흡»)로 다른 단원을 또 끌어오지 않는다(11/25)
  const exactNames = cur.units.flatMap(u => [u.name, ...u.mids.map(m => m.name)]).map(n => n.replace(/\s+/g, '')).filter(n => n.length >= 2 && flat.includes(n))
  const words = [...new Set(text.split(/[\s,·/~\-–()[\]]+/).map(w => w.replace(/(단원|까지|부터|에서)$/, '')).filter(w => /[가-힣]{2,}/.test(w) && !STOP.has(w)))]
    .filter(w => !exactNames.some(n => n.includes(w)))
  for (const u of cur.units) {
    const un = u.name.replace(/\s+/g, '')
    const uPos = flat.indexOf(un)
    if (un.length >= 2 && uPos >= 0) {
      // 대단원 이름 뒤에 그 안의 중단원을 골라 적었으면(«동물과 에너지 — 소화, 순환, 호흡») 그 중단원만
      const named = u.mids.map(m => ({ m, pos: flat.indexOf(m.name.replace(/\s+/g, '')) })).filter(x => x.m.name.replace(/\s+/g, '').length >= 2 && x.pos >= 0)
      if (named.length) named.forEach(x => hits.push({ pos: x.pos, mids: [x.m.id] }))
      else hits.push({ pos: uPos, mids: u.mids.map(m => m.id) })
      continue
    }
    for (const m of u.mids) {
      const mn = m.name.replace(/\s+/g, '')
      let pos = mn.length >= 2 ? flat.indexOf(mn) : -1
      if (pos < 0) for (const w of words) { if (w.length >= 2 && mn.includes(w)) { pos = flat.indexOf(w); break } }
      if (pos >= 0) hits.push({ pos, mids: [m.id] })
    }
    if (!hits.some(h => u.mids.some(m => h.mids.includes(m.id)))) {
      for (const w of words) if (w.length >= 3 && un.includes(w)) { hits.push({ pos: flat.indexOf(w), mids: u.mids.map(m => m.id) }); break }
    }
  }
  if (hits.length) {
    hits.sort((a, b) => a.pos - b.pos)
    const pick = new Set<string>()
    hits.forEach(h => h.mids.forEach(id => pick.add(id)))
    // 'A~B' — 사이의 중단원도 넣는다
    for (let i = 0; i + 1 < hits.length; i++) {
      const between = flat.slice(hits[i].pos, hits[i + 1].pos)
      if (/[~∼–]|부터/.test(between)) {   // 11/25 «-» 는 뺌 — «1-(2)»·«2-3» 같은 번호 속 붙임표가 사이 단원을 다 끌어왔다
        const a = Math.min(...hits[i].mids.map(id => all.indexOf(id)))
        const b = Math.max(...hits[i + 1].mids.map(id => all.indexOf(id)))
        for (let k = a; k <= b; k++) pick.add(all[k])
      }
    }
    return { midIds: all.filter(id => pick.has(id)), how: 'name' }
  }

  // ② 번호 — 'N단원' · 'N~M단원' · 'Ⅱ~Ⅲ'
  const units = new Set<number>()
  const toks: { pos: number; end: number; n: number }[] = []
  for (const m of text.matchAll(/(\d+)\s*[~∼\-–]\s*(\d+)\s*단원/g)) {
    for (let k = Number(m[1]); k <= Number(m[2]); k++) units.add(k)
  }
  for (const m of text.matchAll(/(\d+)\s*단원/g)) toks.push({ pos: m.index!, end: m.index! + m[0].length, n: Number(m[1]) })
  // «7, 8단원» — 쉼표로 늘어놓은 번호도 (11/25 내포중 영어 범위)
  for (const m of text.matchAll(/(\d+(?:\s*[,，·]\s*\d+)+)\s*(?:단원|과)/g)) for (const d of m[1].split(/[,，·]/)) units.add(Number(d.trim()))
  for (const m of text.matchAll(new RegExp(`[${ROMAN}]`, 'g'))) toks.push({ pos: m.index!, end: m.index! + 1, n: ROMAN.indexOf(m[0]) + 1 })
  toks.sort((a, b) => a.pos - b.pos)
  toks.forEach((t, i) => {
    units.add(t.n)
    const prev = toks[i - 1]
    if (prev && /[~∼\-–]|부터/.test(text.slice(prev.end, t.pos))) for (let k = prev.n; k <= t.n; k++) units.add(k)
  })
  // 단원 이름에 번호가 있으면(«Lesson 7»·«7과»·«3단원») 그 번호로 맞춘다 — 기말 대비 과정은 5과부터 시작해 순서 번호와 다르다(11/25)
  const noOf = (name: string, i: number) => { const m = /^\s*(?:Lesson\s*(\d+)|(\d+)\s*(?:과|단원))/i.exec(name); return m ? Number(m[1] ?? m[2]) : i + 1 }
  const midIds = cur.units.filter((u, i) => units.has(noOf(u.name, i))).flatMap(u => u.mids.map(m => m.id))
  if (midIds.length) return { midIds, how: 'number' }
  return { midIds: all, how: 'all' }
}

/**
 * 고른 중단원의 유형 — **중단원을 번갈아** 늘어놓는다(1번 중단원 첫 유형, 2번 중단원 첫 유형, …).
 * 🔴 차례대로 이어 붙이면 뽑기(pickNaesinProblems)가 앞에서부터 유형을 돌아 25문항이 첫 단원에서 다 찬다
 *    (2026-09-17 실측: '삼각비~원의 성질' 25문항이 전부 삼각비, 영어는 독해·어법에만).
 */
export function typeIdsOfMids(cur: Curriculum, midIds: string[]): string[] {
  const want = new Set(midIds)
  const lists = cur.units.flatMap(u => u.mids.filter(m => want.has(m.id)).map(m => m.subs.flatMap(s => s.types.map(t => t.id))))
  const out: string[] = []
  for (let k = 0; lists.some(l => k < l.length); k++) for (const l of lists) if (k < l.length) out.push(l[k])
  return out
}

/** 이 학생에게 이미 나간 문항 — 다시 안 낸다 */
export function assignedProblemIds(studentId: string, worksheets: Worksheet[], assignments: Assignment[]): Set<string> {
  const byId = new Map(worksheets.map(w => [w.id, w]))
  const out = new Set<string>()
  for (const a of assignments) if (a.studentId === studentId) for (const id of byId.get(a.worksheetId)?.problemIds ?? []) out.add(id)
  return out
}

/** 학습지 제목 — '내신대비' 로 시작해야 시험 일정 표의 대비 학습지 수에 잡힌다(lib/exam.ts naesinSheetsFor) */
export function examSheetTitle(exam: SchoolExam, subject: string, cur: Curriculum, midIds: string[], st: Pick<Student, 'name'>): string {
  const all = cur.units.flatMap(u => u.mids.map(m => m.id))
  let scope: string
  if (midIds.length === all.length) scope = '전 범위'
  else {
    const units = cur.units.filter(u => u.mids.some(m => midIds.includes(m.id)))
    scope = units.length === 1 && units[0].mids.every(m => midIds.includes(m.id)) ? units[0].name
      : units.length === 1 ? units[0].mids.filter(m => midIds.includes(m.id)).map(m => m.name).join('·')
        : `${units[0].name}~${units[units.length - 1].name}`
  }
  return `내신대비 | ${exam.name} ${subject} (${scope}) - ${st.name}`
}

export const pickCandidates = (pool: Problem[], typeIds: string[]) => {
  const want = new Set(typeIds)
  return pool.filter(p => want.has(p.typeId))
}
