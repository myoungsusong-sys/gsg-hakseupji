// 영어·국어 개념카드를 **다른 학년으로 복제**한다.
//   node _concepts/학년복제.mjs eng-m3 eng-m1 eng-m2 eng-h1 eng-h2 eng-h3
//
// 왜 복제해도 되나: 영어·국어 유형 트리는 `curriculum-engkor.ts` 의 한 벌을
// 학년마다 그대로 쓴다(소단원 순서·개수가 같고 subId 의 과정 앞머리만 다르다).
// 어법·음운 변동 같은 **개념 설명은 학년이 달라도 같다.** 그래서 한 번 쓰고 옮긴다.
// 🔴 순서가 어긋나면 엉뚱한 소단원에 붙으므로, 옮기기 전에 **소단원 이름을 대조**한다.
import fs from 'node:fs'

const [src, ...dsts] = process.argv.slice(2)
if (!src || !dsts.length) {
  console.error('사용: node _concepts/학년복제.mjs <원본과정> <대상과정...>')
  process.exit(1)
}

const cards = JSON.parse(fs.readFileSync(`_concepts/${src}.json`, 'utf8'))
const readTsv = (course) =>
  fs.readFileSync(`_concepts/입력/${course}.tsv`, 'utf8').trim().split('\n')
    .map((l) => { const [id, path] = l.split('\t'); return { id, name: path.split(' > ').pop() } })

const srcRows = readTsv(src)
if (srcRows.length !== cards.length) {
  console.error(`✗ ${src}: 카드 ${cards.length} ≠ 소단원 ${srcRows.length}`)
  process.exit(1)
}

for (const dst of dsts) {
  const rows = readTsv(dst)
  if (rows.length !== srcRows.length) { console.error(`✗ ${dst}: 소단원 수가 다르다 (${rows.length} vs ${srcRows.length})`); continue }
  const bad = rows.findIndex((r, i) => r.name !== srcRows[i].name)
  if (bad >= 0) { console.error(`✗ ${dst}: ${bad}번째 소단원 이름이 다르다 (${rows[bad].name} vs ${srcRows[bad].name})`); continue }
  const out = cards.map((c, i) => ({ ...c, id: `c-${rows[i].id}`, subId: rows[i].id }))
  fs.writeFileSync(`_concepts/${dst}.json`, JSON.stringify(out, null, 1))
  console.log(`✓ ${dst} ← ${src} · ${out.length}장`)
}
