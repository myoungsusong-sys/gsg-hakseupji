// 개념·공식 빈칸이 실제로 쓸 만한지 여러 유형에서 뽑아 눈으로 본다.
import { conceptBlanks } from '/Users/songmyeongsumaegbug-eeo/hakseupji-deploy/src/lib/mastery'
import { CURRICULA } from '/Users/songmyeongsumaegbug-eeo/hakseupji-deploy/src/data/curriculum'

const SAMPLES = ['15240', '15274', '18209', '18582', '19395']   // 소인수분해·서로소·지수함수·극대극소·확률분포

for (const t of SAMPLES) {
  let name = t
  outer: for (const c of CURRICULA) for (const u of c.units) for (const m of u.mids)
    for (const s of m.subs) for (const ty of s.types)
      if (ty.id === t) { name = `${c.id} · ${s.name} · ${ty.name}`; break outer }
  const bs = conceptBlanks(t)
  console.log(`\n■ ${name}  → 빈칸 ${bs.length}개`)
  for (const b of bs) {
    console.log(`  [${b.kind}] ${b.text.slice(0, 95)}`)
    console.log(`         답: ${b.answer}`)
  }
}

// 커버리지: 전체 유형 중 빈칸이 하나라도 나오는 비율
let has = 0, tot = 0, term = 0, formula = 0
for (const c of CURRICULA) for (const u of c.units) for (const m of u.mids)
  for (const s of m.subs) for (const ty of s.types) {
    tot++
    const bs = conceptBlanks(ty.id)
    if (bs.length) has++
    term += bs.filter(b => b.kind === '용어').length
    formula += bs.filter(b => b.kind === '공식').length
  }
console.log(`\n■ 커버리지: 유형 ${tot}개 중 빈칸이 있는 유형 ${has}개 (${Math.round(100*has/tot)}%)`)
console.log(`  용어 빈칸 ${term}개 · 공식 빈칸 ${formula}개`)
