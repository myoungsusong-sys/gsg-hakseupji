/**
 * 🗺️ 유형 → 과정 색인 만들기  (public/type-course.json)
 *
 * 왜 필요한가 (2026-09-12 실측에서 드러난 구멍):
 *   유형 마스터 사다리는 유형이 **커리큘럼 트리에 있을 때만** 열린다(MasteryPage 의 `row`).
 *   그런데 실제 데이터는 커리큘럼보다 훨씬 넓다 —
 *     · 이미지 풀 1,322,593문항 중 712,189건(53.8%)이 커리큘럼에 없는 유형
 *     · 교재(wb-match) 78,673문항(3,531유형)도 마찬가지
 *   그래서 학생이 그런 문항을 틀리면 정복 큐에 줄은 서는데 [정복 시작]이 **아무 반응도 없었다.**
 *   (게다가 누른 순간 상태가 저장돼 '진행중'으로 영영 남는다.)
 *
 * 이 색인은 그 유형이 어느 과정 풀에 들어 있는지만 알려 준다. 그것만 있으면
 * ensureCourse 로 풀을 싣고 사다리를 돌릴 수 있다(유형 이름은 없어도 사다리는 돈다).
 *
 * 커리큘럼에 이미 있는 유형은 넣지 않는다 — 앱이 커리큘럼에서 먼저 찾기 때문에 중복이다.
 *
 * 실행: node scripts/build-type-course.mjs   (문항 데이터가 바뀌면 다시 돌린다)
 */
import fs from 'fs'
import { execSync } from 'child_process'

execSync('npx --yes esbuild@0.23.1 src/data/curriculum.ts --bundle --format=esm --platform=node --outfile=scripts/_cur.mjs', { stdio: 'ignore' })
const { CURRICULA } = await import('./_cur.mjs')
const known = new Set()
for (const c of CURRICULA) for (const u of c.units) for (const m of u.mids) for (const s of m.subs) for (const t of s.types) known.add(t.id)

// typeId -> { pool: Map(course->n), wb: Map(course->n) }
//
// ⚠️ **풀을 먼저 본다.** 교재 출현수만 세면 "교재에는 많지만 그 과정 풀에는 한 문항도 없는"
//    과정을 가리켜, 사다리를 열어도 문제가 안 나온다(2026-09-12 실측에서 4건 발견: h-prob→실제 h-stat).
//    사다리에 필요한 건 **풀 문항**이므로 풀에 있는 과정이 있으면 무조건 그쪽이다.
const count = new Map()
const bump = (tid, course, from) => {
  if (!tid || known.has(tid)) return
  const e = count.get(tid) ?? { pool: new Map(), wb: new Map() }
  const m = e[from]
  m.set(course, (m.get(course) ?? 0) + 1)
  count.set(tid, e)
}

for (const f of fs.readdirSync('public')) {
  if (!f.endsWith('.json')) continue
  let d
  try { d = JSON.parse(fs.readFileSync('public/' + f, 'utf8')) } catch { continue }
  if (f.startsWith('pool-')) {
    const course = f.slice(5, -5)
    // [pid, hash, typeId, ...] — 완자행([이미지경로, typeId, ...])은 첫 칸이 문자열이라 갈린다
    for (const r of Object.values(d)) bump(String(typeof r[0] === 'string' ? r[1] : r[2]), course, 'pool')
  } else if (f.startsWith('wb-match-')) {
    const course = f.slice(9, -5)
    // { 교재명: [ [번호, 쪽, typeId, 난이도, 정답, 'C'|'S'], ... ] }
    const walk = (o) => {
      if (Array.isArray(o)) {
        if (o.length >= 3 && typeof o[2] === 'string' && /^\d+$/.test(o[2])) bump(o[2], course, 'wb')
        else o.forEach(walk)
      } else if (o && typeof o === 'object') Object.values(o).forEach(walk)
    }
    walk(d)
  }
}

const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
const out = {}
let wbOnly = 0
for (const [tid, e] of count) {
  const c = top(e.pool) ?? (wbOnly++, top(e.wb))
  if (c) out[tid] = c
}
fs.writeFileSync('public/type-course.json', JSON.stringify(out))
fs.rmSync('scripts/_cur.mjs', { force: true })
console.log(`유형 ${Object.keys(out).length}개(그중 풀에 문항 없는 교재전용 ${wbOnly}개) → public/type-course.json (${(fs.statSync('public/type-course.json').size / 1024).toFixed(0)}KB)`)
