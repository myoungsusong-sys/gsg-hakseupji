// deno run scripts/test-1110/essayGroup.test.ts — 서술형 묶음 규칙 시험 (2026-11-10)
import { numberLabels, orderGroups, withWholeGroups, mainCount } from '../../src/lib/essayGroup.ts'
const P = (id: string, groupMain?: string) => ({ id, groupMain } as any)
let fail = 0
const eq = (a: unknown, b: unknown, m: string) => { const ok = JSON.stringify(a) === JSON.stringify(b); console.log((ok ? '통과 ' : '실패 ') + m + (ok ? '' : ` — ${JSON.stringify(a)}`)); if (!ok) fail++ }
const all = [P('a'), P('m', 'm'), P('x'), P('s1', 'm'), P('s2', 'm'), P('b')]
eq(orderGroups(all).map(p => p.id), ['a', 'm', 's1', 's2', 'x', 'b'], '하위문제를 본문제 바로 뒤로')
eq(numberLabels(orderGroups(all)).map(l => l.short), ['1', '2', '2(1)', '2(2)', '3', '4'], '번호: 하위는 번호를 안 먹음')
eq(numberLabels(orderGroups(all)).map(l => l.big), ['01', '02', '(1)', '(2)', '03', '04'], '문제지 큰 번호')
eq(mainCount(all), 4, '머리 문항 수 = 4')
eq(withWholeGroups([P('a'), P('s2', 'm')], all).map(p => p.id), ['a', 'm', 's1', 's2'], '하위 하나만 담아도 묶음 전체')
eq(withWholeGroups([P('m', 'm')], all).map(p => p.id), ['m', 's1', 's2'], '본문제만 담아도 하위 따라옴')
eq(numberLabels([P('s1', 'm'), P('b')]).map(l => l.short), ['1', '2'], '본문제 없는 하위는 보통 문항처럼')
eq(withWholeGroups([P('a'), P('b')], all).map(p => p.id), ['a', 'b'], '묶음 없으면 그대로')
console.log(fail ? `실패 ${fail}` : '전부 통과'); Deno.exit(fail ? 1 : 0)
