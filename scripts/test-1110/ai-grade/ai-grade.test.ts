// deno run -A --config scripts/test-1110/ai-grade/deno.json scripts/test-1110/ai-grade/ai-grade.test.ts — AI 채점 서버를 가짜 AI 응답으로 시험(크레딧 0)
import handler from '../../../api/ai-grade.ts'
import { calls, q } from './mock.ts'
Deno.env.set('ANTHROPIC_API_KEY', 'x')
async function run(body: any) {
  let status = 0, out: any
  const res = { status(s: number) { status = s; return this }, json(j: any) { out = j } }
  await handler({ method: 'POST', body }, res)
  return { status, out }
}
let fail = 0
const ok = (c: boolean, m: string) => { console.log((c ? '통과 ' : '실패 ') + m); if (!c) fail++ }
const base = { problemText: '1200을 소인수분해하시오.', answerText: '2^4×3×5^2', studentAnswer: '2^4×3×5^2' }

// 1) 루브릭 새로 만들기(합 맞음) + 부분점수 채점 → verdict 는 score 기준으로 맞춰져야
q.push({ text: '{"maxScore":6,"answer":"2^4×3×5^2","criteria":[{"text":"2로 나눔","weight":2},{"text":"3,5 분해","weight":2},{"text":"최종 답","weight":2}],"source":"answerText","confidence":"high"}' })
q.push({ text: '{"verdict":true,"score":4,"got":[2,2,0],"reason":"최종 답 표기 누락","confidence":"high","feedback":"잘 분해했어요."}' })
let r = await run({ ...base, wantRubric: true })
ok(r.status === 200 && r.out.score === 4 && r.out.maxScore === 6 && r.out.verdict === false, '부분점수 4/6 → verdict=false 로 맞춤')
ok(!!r.out.rubric && r.out.criteria[2].got === 0 && r.out.feedback, '새 루브릭 돌려줌 + 기준별 점수 + 첨삭')
ok(!JSON.stringify(calls[0].messages).includes('[학생이 제출한 답]'), '루브릭 만들 때 학생 답을 안 보냄')

// 2) 루브릭 합 ≠ 만점 → 버리고 옛 정오 채점으로
calls.length = 0
q.push({ text: '{"maxScore":6,"criteria":[{"text":"a","weight":3},{"text":"b","weight":4}]}' })
q.push({ text: '{"verdict":true,"reason":"맞음","confidence":"mid"}' })
r = await run({ ...base, wantRubric: true })
ok(r.status === 200 && r.out.verdict === true && r.out.score === undefined, '합 어긋난 루브릭 버림 → 정오 채점 폴백')

// 3) 캐시된 루브릭 + got 길이 틀림 → got 버리고 score 유지, 만점이면 true
q.push({ text: '{"verdict":false,"score":6,"got":[3],"reason":"","confidence":"high","feedback":"완벽"}' })
r = await run({ ...base, rubric: { maxScore: 6, criteria: [{ text: 'a', weight: 3 }, { text: 'b', weight: 3 }] } })
ok(r.out.score === 6 && r.out.verdict === true && r.out.criteria.every((c: any) => c.got === 0) && !r.out.rubric, '만점 → true · 잘못된 got 버림 · 캐시 루브릭은 다시 안 돌려줌')

// 4) 점수 범위 밖 → 잘라냄
q.push({ text: '{"verdict":true,"score":99,"got":[],"reason":"","confidence":"high"}' })
r = await run({ ...base, rubric: { maxScore: 6, criteria: [{ text: 'a', weight: 6 }] } })
ok(r.out.score === 6, '점수 99 → 만점 6 으로 자름')

// 5) 판정 불가 → score 0
q.push({ text: '{"verdict":null,"score":5,"reason":"글씨 판독 불가","confidence":"low"}' })
r = await run({ ...base, rubric: { maxScore: 6, criteria: [{ text: 'a', weight: 6 }] } })
ok(r.out.verdict === null && r.out.score === 0, '판정 불가 → 0점')

// 6) 잘림 / 형식 오류 / 크레딧 소진
q.push({ text: '{"verdict":tr', stop: 'max_tokens' })
r = await run(base); ok(r.status === 502 && /잘렸/.test(r.out.error), '잘림 → 잘렸다고 안내')
q.push(new Error('400 credit balance is too low'))
r = await run(base); ok(r.status === 402 && /크레딧/.test(r.out.error), '크레딧 소진 → 402 한글 안내')

// 7) 확인용 객관식 — 정답과 같은 보기 버림, 4개 미만이면 502, 정답 자리 무작위
q.push({ text: '{"answer":"","distractors":["2^4×3×5^2","2^3×3×5^2","2^4×5^2","2^4×3^2×5","2^5×3×5"],"why":"..."}' })
r = await run({ ...base, mode: 'quiz' })
ok(r.status === 200 && r.out.choices.length === 5 && r.out.choices[r.out.answerIndex] === base.answerText && new Set(r.out.choices).size === 5, '확인 객관식 5지 · 정답 하나 · 중복 없음')
q.push({ text: '{"answer":"","distractors":["1","1","1"]}' })
r = await run({ ...base, mode: 'quiz' }); ok(r.status === 502, '보기 모자라면 502')
q.push({ text: '{"answer":"","distractors":["a","b","c","d"]}' })
r = await run({ problemText: '서술형', mode: 'quiz' }); ok(r.status === 400, '정답 못 읽으면 객관식 안 만듦(400)')
q.push({ text: '{"answer":"x=3","distractors":["x=-3","x=1","x=9","x=0"]}' })
r = await run({ problemText: '서술형', solutionImageUrl: 'https://a/s.png', mode: 'quiz' })
ok(r.status === 200 && r.out.choices.includes('x=3'), '정답 이미지에서 읽은 답으로 객관식 만듦')
console.log(fail ? `실패 ${fail}건` : '전부 통과')
Deno.exit(fail ? 1 : 0)
