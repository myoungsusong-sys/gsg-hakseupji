// 마스터리 사다리를 **시나리오로** 검증한다. 화면을 만들기 전에 규칙이 맞는지 본다.
import { newMastery, step, passConcept, FLOOR_NAME, type MasteryState } from
  '/Users/songmyeongsumaegbug-eeo/hakseupji-deploy/src/lib/mastery'

let n = 0
const now = () => `2026-09-05T00:00:${String(n++).padStart(2, '0')}Z`

function run(title: string, marks: (boolean | 'concept')[]) {
  let s: MasteryState = newMastery('s1', '15240', 2)
  const trail: string[] = [`${FLOOR_NAME[s.floor]}`]
  for (const m of marks) {
    const r = m === 'concept' ? passConcept(s) : step(s, `p${n}`, m, now())
    s = r.next
    trail.push(`${m === 'concept' ? '개념통과' : m ? '○' : '✗'}→${FLOOR_NAME[s.floor]}${s.mastered ? '(마스터)' : ''}${s.needsTeacher ? '(선생님호출)' : ''}`)
    if (s.mastered || s.needsTeacher) break
  }
  console.log(`\n■ ${title}`)
  console.log('  ' + trail.join('  '))
}

run('계속 맞히면 표준→심화→최상→마스터',
  [true, true, true, true, true, true])

run('표준에서 틀리면 기본으로 내려감',
  [false, true, true])

run('기본에서 또 틀리면 개념으로 (핵심 요구사항)',
  [false, false])

run('개념 통과 후 기본부터 다시 올라감',
  [false, false, 'concept', true, true, true, true])

run('한 층에서 3번 틀리면 선생님 호출',
  [false, false, false] as boolean[])

run('한 문제만 맞혀서는 못 올라간다(찍기 방지)',
  [true, false, true, true])

// 규칙 자체를 어기지 않는지 무작위로 두들겨 본다
console.log('\n■ 무작위 2,000판 — 불변식 검사')
let bad = 0
for (let i = 0; i < 2000; i++) {
  let s = newMastery('s', 't', 2)
  for (let k = 0; k < 40 && !s.mastered && !s.needsTeacher; k++) {
    const r = Math.random() < 0.55 ? step(s, `p${k}`, true, now()) : step(s, `p${k}`, false, now())
    s = r.next
    if (s.floor < 0 || s.floor > 4) { bad++; break }
    if (s.streak < 0 || s.streak > 2) { bad++; break }
    if (s.mastered && s.floor !== 4) { bad++; break }
  }
}
console.log(bad === 0 ? '  ✓ 층은 0~4, 연속정답은 0~2, 마스터는 최상층에서만 — 위반 0건'
                      : `  ✗ 위반 ${bad}건`)
