// 개념카드 JSON 이 「유형 마스터」의 빈칸 생성 규칙에 맞는지 검사한다.
// 사용:  node _concepts/검사.mjs _concepts/e3-1.json
// mastery.ts 의 conceptBlanks() 와 같은 규칙이다. 여기서 통과해야 앱에서 빈칸이 나온다.
import fs from 'node:fs'

const EXAMPLE_LINE = /^\s*(예|예시|참고|주의)\s*[:：]/
// 우변이 빈칸으로 낼 값어치가 있나. 한 글자(`0`·`a`)나 `f(x)` 같은 것만 걸러낸다.
// 🔴 예전엔 '숫자나 연산기호가 있어야' 통과시켰는데, 그러면 $PV = nRT$·$p = mv$ 같은
//    정통 공식이 전부 탈락했다(2026-09-05 에이전트가 발견).
const TRIVIAL_RHS = /^(?:\d|[A-Za-z]|\\?[A-Za-z]+\s*\(\s*[A-Za-z]\s*\))$/
const LABEL_WORDS = /^(성질|참고|주의|방법|유형|정리|공식|핵심|조건|계산|풀이|요약|보기|순서|절차)$/
const DEF_HEAD = /^([가-힣](?:[가-힣A-Za-z0-9·() ]{0,14}[가-힣A-Za-z0-9)])?)(?:\s*\$[^$]*\$)?\s*[:：]/
const goodTerm = (w) => !/[0-9]/.test(w) && !LABEL_WORDS.test(w) && w.length >= 2

function topLevelEq(s) {
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '\\') { i++; continue }
    if (ch === '(' || ch === '{' || ch === '[') depth++
    else if (ch === ')' || ch === '}' || ch === ']') depth--
    else if (ch === '=' && depth === 0 && s[i + 1] !== '=') return i
  }
  return -1
}

function check(c) {
  let term = 0, formula = 0
  for (const line of c.lines) {
    if (EXAMPLE_LINE.test(line)) continue
    let hit = false
    for (const m of line.matchAll(/\$([^$]+)\$/g)) {
      const inner = m[1], i = topLevelEq(inner)
      if (i <= 0) continue
      const rhs = inner.slice(i + 1).trim()
      if (rhs.length < 2 || TRIVIAL_RHS.test(rhs)) continue
      formula++; hit = true; break
    }
    if (hit) continue
    const w = line.match(DEF_HEAD)?.[1]
    if (w && goodTerm(w)) term++
  }
  return { term, formula }
}

const path = process.argv[2]
const arr = JSON.parse(fs.readFileSync(path, 'utf8'))
const bad = []
const dollars = []
for (const c of arr) {
  if (!c.id || !c.subId || !c.title || !Array.isArray(c.lines)) { bad.push(`${c.subId ?? '?'} 형식오류`); continue }
  if (c.lines.length < 4) bad.push(`${c.subId} 줄이 ${c.lines.length}개 (4개 이상)`)
  for (const l of c.lines) if ((l.match(/\$/g) ?? []).length % 2) dollars.push(`${c.subId} $ 짝이 안 맞음: ${l.slice(0, 50)}`)
  const { term, formula } = check(c)
  // 🔴 영어·국어에는 수식이 없다. 공식 줄을 강제하면 **억지 수식**을 지어내게 된다
  //    (2026-09-05). 대신 용어 빈칸을 **2개 이상** 요구해 빈칸 수를 맞춘다.
  const noMath = /^(eng|kor)-/.test(c.subId)
  if (noMath) {
    if (term < 2) bad.push(`${c.subId} 용어 빈칸 ${term}개 — 영어·국어는 「낱말: 설명」 줄이 2개 이상 필요`)
  } else {
    if (!term) bad.push(`${c.subId} 용어 빈칸 0개 — 줄머리에 「낱말: 설명」 줄이 필요`)
    if (!formula) bad.push(`${c.subId} 공식 빈칸 0개 — $...$ 안 괄호 밖 등호 + 값 있는 우변이 필요`)
  }
}
console.log(`카드 ${arr.length}개`)
const all = [...dollars, ...bad]
if (!all.length) console.log('✓ 전부 통과 — 용어·공식 빈칸이 모두 나온다')
else { console.log(`✗ 손볼 것 ${all.length}건`); for (const b of all.slice(0, 40)) console.log('  ' + b) }
process.exit(all.length ? 1 : 0)
