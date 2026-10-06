// masterySet.ts 단위 시험 — 「했다」가 아니라 「확인했다」
import { todaySet, solvedOn, setCountUpTo, normalizeCap, DAILY_CAP_DEFAULT } from '../src/lib/masterySet'
import type { MasteryState } from '../src/lib/mastery'

let pass = 0
let fail = 0
function eq(got: unknown, want: unknown, label: string) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) { pass++; console.log(`  ✅ ${label}`) }
  else { fail++; console.log(`  ❌ ${label}\n     받음 ${g}\n     기대 ${w}`) }
}

function st(studentId: string, typeId: string, days: [string, number][]): MasteryState {
  const log: MasteryState['log'] = []
  for (const [day, n] of days)
    for (let i = 0; i < n; i++)
      log.push({ at: `${day}T10:0${i % 10}:00.000Z`, floor: 1, problemId: `p${day}-${i}`, correct: true })
  return {
    studentId, typeId, floor: 1, streak: 0, missAtFloor: 0, missStreak: 0,
    servedIds: log.map((l) => l.problemId), log, mastered: false, needsTeacher: false,
  }
}

const TODAY = new Date()
const d = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
const today = d(TODAY)
const yest = d(new Date(TODAY.getTime() - 864e5))
const prev = d(new Date(TODAY.getTime() - 2 * 864e5))

console.log('① normalizeCap — 엉뚱한 값이 와도 앱이 멈추지 않는다')
eq(normalizeCap(undefined), DAILY_CAP_DEFAULT, '없으면 기본 20')
eq(normalizeCap(0), DAILY_CAP_DEFAULT, '0 이면 기본 20')
eq(normalizeCap(-5), DAILY_CAP_DEFAULT, '음수면 기본 20')
eq(normalizeCap('30'), 30, '문자열 숫자도 받는다')
eq(normalizeCap(1), 5, '너무 작으면 최소 5')
eq(normalizeCap(9999), 100, '너무 크면 최대 100')
eq(normalizeCap(20.4), 20, '소수는 반올림')

console.log('\n② solvedOn — 과목·유형을 가리지 않고 그날 푼 수를 합한다')
const M = {
  'S1|t-sci-1': st('S1', 't-sci-1', [[today, 7], [yest, 8]]),
  'S1|t-math-1': st('S1', 't-math-1', [[today, 5]]),
  'S2|t-sci-1': st('S2', 't-sci-1', [[today, 99]]),     // 다른 학생 — 섞이면 안 된다
}
eq(solvedOn(M, 'S1', today), 12, '오늘 과학 7 + 수학 5 = 12')
eq(solvedOn(M, 'S1', yest), 8, '어제는 8')
eq(solvedOn(M, 'S1', today, 't-sci-1'), 5, '과학을 빼면 5 (부르는 쪽이 직접 세는 경우)')
eq(solvedOn(M, 'S2', today), 99, '다른 학생은 따로')
eq(solvedOn(M, 'S3', today), 0, '기록 없는 학생은 0')
eq(solvedOn(undefined, 'S1', today), 0, 'masteries 가 없어도 안 터진다')

console.log('\n③ setCountUpTo — 몇 세트째 (= 승강제를 푼 서로 다른 날의 수)')
eq(setCountUpTo(M, 'S1', today), 2, '오늘·어제 = 2세트')
eq(setCountUpTo(M, 'S1', yest), 1, '어제까지는 1세트')
eq(setCountUpTo(M, 'S1', prev), 0, '그 전에는 0')

console.log('\n④ todaySet — 오늘 몫')
eq(todaySet(M, 'S1', 20), { cap: 20, done: 12, left: 8, full: false, setNo: 2 }, '12/20 · 2세트째')
eq(todaySet(M, 'S1', 12), { cap: 12, done: 12, left: 0, full: true, setNo: 2 }, '딱 채우면 full')
eq(todaySet(M, 'S1', 10), { cap: 10, done: 12, left: 0, full: true, setNo: 2 }, '넘겨도 left 는 음수가 안 된다')
eq(todaySet(M, 'S1', undefined), { cap: 20, done: 12, left: 8, full: false, setNo: 2 }, '상한 미설정 = 20')

console.log('\n⑤ todaySet — 지금 풀고 있는 유형은 extraToday 로 더한다 (store 저장 전 값)')
eq(todaySet(M, 'S1', 20, { exceptTypeId: 't-sci-1', extraToday: 7 }),
  { cap: 20, done: 12, left: 8, full: false, setNo: 2 }, '빼고 더하면 같은 12 — 두 번 세지 않는다')
eq(todaySet(M, 'S1', 20, { exceptTypeId: 't-sci-1', extraToday: 8 }),
  { cap: 20, done: 13, left: 7, full: false, setNo: 2 }, '한 문제 더 풀면 13')

console.log('\n⑥ 오늘 처음 푸는 학생 — 「이번이 N세트」')
const M2 = { 'S9|t1': st('S9', 't1', [[yest, 20], [prev, 20]]) }
eq(todaySet(M2, 'S9', 20).setNo, 3, '어제·그제 풀었고 오늘 아직 0 → 이번이 3세트')
eq(todaySet(M2, 'S9', 20).done, 0, '오늘 0문제')
eq(todaySet(M2, 'S9', 20).full, false, '오늘 몫 남았다')
const M3 = {}
eq(todaySet(M3, 'S9', 20).setNo, 1, '처음 오는 학생 → 1세트')

console.log('\n⑦ 덜 찬 저장 상태도 견딘다 (2026-10-02 최다혜 멈춤 사고 유형)')
const M4 = {
  'S1|t1': { studentId: 'S1', typeId: 't1', floor: 1 } as unknown as MasteryState,  // log·servedIds 없음
  'S1|t2': st('S1', 't2', [[today, 3]]),
  'badkey': st('S1', 'x', [[today, 50]]),                                            // | 없는 키
}
eq(todaySet(M4, 'S1', 20).done, 3, 'log 없는 칸은 0으로 세고, | 없는 키는 무시')

console.log(`\n${fail ? '❌' : '✅'} ${pass}건 통과 · ${fail}건 실패`)
if (fail) process.exit(1)
