// _concepts/<과정>.json 들을 src/data/concepts-gen.ts 로 합친다.
// concepts.ts(수학 중고 274장, 손으로 검수된 정본)는 건드리지 않고 **덧붙이기만** 한다.
//   node _concepts/합치기.mjs
import fs from 'node:fs'
import path from 'node:path'

const DIR = '_concepts'
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()
const all = []
const seen = new Set()
const report = []
for (const f of files) {
  const arr = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
  let dup = 0
  for (const c of arr) {
    if (seen.has(c.subId)) { dup++; continue }
    seen.add(c.subId); all.push(c)
  }
  report.push(`${f.replace('.json', '').padEnd(11)} ${String(arr.length).padStart(3)}장${dup ? ` (중복 ${dup} 건너뜀)` : ''}`)
}

const head = `// 자동 생성 — _concepts/*.json 을 \`node _concepts/합치기.mjs\` 로 합친 것. 손으로 고치지 마라.
// 원본은 _concepts/<과정id>.json 이고, 형식 규칙은 _concepts/작성지침.md 에 있다.
// 이 카드들이 「유형 마스터」 0층의 개념·공식 빈칸 재료가 된다.
import type { Concept } from './concepts'

export const CONCEPTS_GEN: Concept[] = ${JSON.stringify(all, null, 1)}
`
fs.writeFileSync('src/data/concepts-gen.ts', head)
console.log(report.join('\n'))
console.log(`\n합계 ${all.length}장 → src/data/concepts-gen.ts`)
