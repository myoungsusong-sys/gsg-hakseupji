// 개념카드 JSON 이 「유형 마스터」의 빈칸 생성 규칙에 맞는지 검사한다.
// 사용:  node _concepts/검사.mjs _concepts/e3-1.json
// mastery.ts 의 conceptBlanks() 와 같은 규칙이다. 여기서 통과해야 앱에서 빈칸이 나온다.
import fs from 'node:fs'

const EXAMPLE_LINE = /^\s*(예|예시|참고|주의)\s*[:：]/
const WORTH_ASKING = /[0-9^_]|\\d?frac|\\sqrt|\\sum|\\int|\\times|\\div|\\cdot|\\pi|[+\-]/
const LABEL_WORDS = /^(성질|참고|주의|방법|유형|정리|공식|핵심|조건|계산|풀이|요약|보기|순서|절차)$/
const DEF_HEAD = /^([가-힣][가-힣A-Za-z0-9·()]{1,11})(?:\s*\$[^$]*\$)?\s*[:：]/
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
      if (rhs.length < 2 || !WORTH_ASKING.test(rhs)) continue
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
  if (!term) bad.push(`${c.subId} 용어 빈칸 0개 — 줄머리에 「낱말: 설명」 줄이 필요`)
  if (!formula) bad.push(`${c.subId} 공식 빈칸 0개 — $...$ 안 괄호 밖 등호 + 값 있는 우변이 필요`)
}
console.log(`카드 ${arr.length}개`)
const all = [...dollars, ...bad]
if (!all.length) console.log('✓ 전부 통과 — 용어·공식 빈칸이 모두 나온다')
else { console.log(`✗ 손볼 것 ${all.length}건`); for (const b of all.slice(0, 40)) console.log('  ' + b) }
process.exit(all.length ? 1 : 0)
