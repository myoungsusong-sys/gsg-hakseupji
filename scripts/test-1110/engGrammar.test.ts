// node --experimental-strip-types scripts/test-1110/engGrammar.test.ts <gen-eng-h1.json 경로> — 영어 문법 개념·오답 추천 시험 (2026-11-10)
import { readFileSync } from 'node:fs'
import { grammarOf, grammarStats, rate, recommendEng } from '../../src/lib/engGrammar.ts'
let fail = 0
const ok = (c: boolean, m: string) => { console.log((c ? '통과 ' : '실패 ') + m); if (!c) fail++ }
const P = (id: string, solution: string, extra: any = {}) => ({ id, typeId: 'eng-h1-u1m0s1t0', kind: '객관식', diff: 3, body: '', answer: '①', solution, source: '', ...extra }) as any
ok(JSON.stringify(grammarOf(P('a', '선행사가 사물이므로 관계대명사 which 를 쓴다.'))) === '["relpron"]', '관계대명사')
ok(grammarOf(P('b', '현재완료 수동태 has been built')).join() === 'tense,passive', '한 문항 여러 개념')
ok(grammarOf(P('c', '관계부사 where')).join() === 'reladv', '관계부사는 관계대명사로 안 셈')
ok(grammarOf({ ...P('d', '관계대명사'), typeId: 'm1-1-u0m0s0t0' }).length === 0, '영어 아닌 문항은 []')
ok(grammarOf(P('e', '부사절 접속사 although')).join() === 'conj', '«부사절» 은 형용사·부사로 안 셈')
const st = grammarStats([
  { problem: P('a', '관계대명사'), correct: false, date: '2026-11-05' },
  { problem: P('a2', '관계대명사'), correct: true, date: '2026-11-06' },
  { problem: P('a3', '관계대명사'), correct: false, date: '2026-10-01' },
], '2026-11-01')
ok(st.length === 1 && st[0].total === 2 && st[0].wrong === 1 && st[0].prevTotal === 1 && rate(st[0].total, st[0].wrong) === 50, '기간 나눠 세기·정답률 50%')
const pool = [P('r1', '관계대명사'), P('r2', '관계대명사', { book: 'NE' }), P('r3', '수동태'), P('r4', '관계대명사', { noAnswer: true }), P('done', '관계대명사'),
  { ...P('t1', ''), typeId: 'eng-h1-u0m0s0t0' }]
const rec = recommendEng({ pool, weakGrammar: ['relpron'], weakTypes: ['eng-h1-u0m0s0t0'], solved: new Set(['done']), book: 'NE', count: 3 })
ok(rec.map(p => p.id).join() === 'r2,r1,t1', '교과서 먼저·푼 것/정답 없는 것 빼기·유형 몫 — ' + rec.map(p => p.id).join())
const file = process.argv[2]
if (file) {
  const d = JSON.parse(readFileSync(file, 'utf8'))
  const g = d.filter((p: any) => /u1m0|u2m/.test(p.typeId))
  const n = g.filter((p: any) => grammarOf(p).length).length
  console.log(`실데이터 ${file.split('/').pop()}: 어법·서술형 ${g.length} 중 개념 붙음 ${n} (${Math.round(n / g.length * 100)}%)`)
  ok(n / g.length > 0.5, '고등 어법·서술형 절반 넘게 개념 붙음')
}
console.log(fail ? `실패 ${fail}` : '전부 통과'); process.exit(fail ? 1 : 0)
