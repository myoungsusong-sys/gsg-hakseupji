// AI 1차 채점 — Vercel 서버리스 (Node), Claude 비전
// solve-feedback(학생용 힌트)과 달리 "판정"이 목적: 정답·해설과 학생 답/풀이를 대조해
// 선생님 승인 큐에 올릴 verdict(정오)·근거·신뢰도를 반환한다. 학생에게 직접 노출되지 않는다.
// 정답 근거 우선순위: ①answer 텍스트 ②answerImageUrl/solutionImageUrl(서술형·과학) ③없으면 AI가 직접 풀어 판정(신뢰도 하향).
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM = `너는 한국 수학·과학 학원의 1차 채점관이다. 학생의 답(또는 풀이 이미지)을 문제·정답과 대조해 정오를 판정한다.
판정 결과는 선생님이 승인/수정하므로, 확신이 없으면 솔직하게 낮은 신뢰도로 보고하라.

원칙:
- 정답 자료(텍스트/정답이미지/해설이미지)가 있으면 그것을 기준으로 판정한다.
- 정답 자료가 없으면 문제를 직접 풀어 정답을 구한 뒤 판정하되 confidence를 한 단계 낮춘다.
- 서술형은 최종 답뿐 아니라 풀이 논리가 유효한지도 본다. 답은 맞는데 과정이 틀리면 reason에 명시한다.
- 학생 풀이 이미지가 없고 선택/단답만 있으면 그 답만으로 판정한다.
- reason은 선생님이 3초 안에 읽을 1~2문장(존댓말, 핵심만).
- 반드시 아래 JSON 한 줄로만 답한다(설명·코드블록 없이):
{"verdict": true/false/null, "reason": "판정 근거", "confidence": "high"/"mid"/"low"}
- verdict: 정답 true / 오답 false / 판정 불가(풀이·답 식별 불가 등) null.`

// 확인용 객관식 만들기 (mode:'quiz') — 서술형을 틀린 학생이 정답을 빨간펜으로 적은 뒤
// 바로 이해했는지 확인하는 5지선다. (명수쌤 2026-08-07)
// 🔴 별도 엔드포인트로 두지 않는다 — Vercel 서버리스 함수는 12개가 한도라
//    api/ai-quiz.ts 를 만들었더니 13개가 되어 배포가 통째로 막혔다 (2026-08-07 실측).
// 🔴 문항은 AI 에게 맡기지 않는다. 원래 문제를 그대로 쓰고 **오답 보기 4개만** 받는다.
//    문항을 만들게 했더니 "A+B+C 의 값은?" 처럼 묻는 것을 바꿔 놓고 정답은 원래 값을
//    그대로 쓰는 앞뒤 안 맞는 문제가 나왔다 (2026-08-07 라이브 실측).
const SYSTEM_QUIZ = `너는 한국 중·고등 수학·과학 학원의 문제 출제자다.
학생이 방금 서술형 문제를 틀렸다. 같은 문제를 객관식으로 다시 풀려서 확인하려 한다.

너의 일은 **그럴듯한 오답 보기 4개**를 만드는 것이다.
- 문항을 새로 쓰지 마라. 문제는 이미 정해져 있다.
- 오답은 학생이 흔히 하는 실수에서 나온 값으로 만든다
  (부호 반대 · 계산 한 단계 누락 · 단위 혼동 · 제곱/제곱근 혼동 등).
- 정답과 형태가 같아야 한다. 정답이 수면 수로, 식이면 식으로, 각도면 각도로.
- **정답과 같은 값을 오답에 넣지 마라.** 4개는 서로 달라야 한다.
- 각 보기는 30자 이내. 수식은 일반 텍스트로(예: x^2, √3, 1/2).

[정답이 텍스트로 주어지지 않은 경우]
서술형은 정답이 이미지로만 있는 경우가 많다. 그때는 **정답 이미지·해설 이미지에서 최종 답을 읽어**
answer 에 넣어라. 규칙:
- 최종 답 **하나**만 쓴다. 30자 이내. 풀이 과정을 쓰지 마라.
- 답이 여러 개면 원문 그대로 쉼표로 잇는다(예: "1, -1").
- 이미지가 흐리거나 최종 답을 확정할 수 없으면 **answer 를 빈 문자열로 두어라.**
  틀린 답으로 확인문제를 만드는 것이 안 만드는 것보다 훨씬 나쁘다.

- 반드시 아래 JSON 한 줄로만 답한다(설명·코드블록 없이):
{"answer":"정답(텍스트로 이미 주어졌으면 빈 문자열)","distractors":["오답1","오답2","오답3","오답4"],"why":"정답이 그 값인 이유 한 문장"}`

// ── 서술형 점수제 ①: 배점 기준표(루브릭) 만들기 ────────────────────
// 🔴 이 호출의 content 에는 **학생 답·학생 풀이 이미지를 절대 넣지 않는다.**
//    프롬프트로 "보지 마라"라고 쓰는 게 아니라 배열에 안 넣어서 구조적으로 막는다.
//    넣으면 첫 학생 풀이에 맞춰진 기준이 캐시되어 그 문항을 푸는 전원에게 영구 적용된다.
const SYSTEM_RUBRIC = `너는 한국 중·고등 수학·과학 학원의 **채점 기준표 작성자**다.
한 문항에 대해, 그 문항을 푸는 모든 학생에게 똑같이 적용할 배점 기준을 만든다.

[가장 중요한 원칙]
지금 너에게는 **어떤 학생의 답도 주어지지 않는다.** 특정 풀이 방식을 전제하지 마라.
같은 답에 이르는 다른 풀이도 그대로 만점이 되도록, 기준은 **풀이 경로가 아니라 도달해야 할 지점**으로 쓴다.
(나쁨: "2로 나누는 과정을 4번 반복했다" / 좋음: "1200을 소수의 곱으로 정확히 분해했다")

[기준 쓰는 법]
- 기준은 2~6개. 각 기준은 40자 이내.
- **채점자가 보고 즉시 O/X 를 찍을 수 있는 관찰 가능한 것**만 쓴다.
  "이해했다", "잘 풀었다", "논리적이다" 는 기준이 아니다.
- 마지막 기준은 반드시 "최종 답을 정확히 구했다"에 해당하는 항목으로 둔다.
- weight 는 자연수. **weight 의 합이 반드시 maxScore 와 같아야 한다.**
- maxScore 는 4~8 중에서 고른다. 단계가 적으면 4, 많으면 8.

[정답 자료를 읽는 법]
정답이 텍스트로 주어졌으면 그대로 answer 에 쓴다.
이미지로만 주어졌으면 거기서 **최종 답 하나만** 읽어 answer 에 쓴다.
- 해설에는 중간 계산값이 여럿 있다. 문제가 묻는 것을 다시 읽고 그 값을 고른다.
- 답이 여럿이면 원문 그대로 쉼표로 잇는다(예: "1, -1").

[모르겠으면 만들지 마라]
이미지가 흐리거나, 최종 답을 확정할 수 없거나, 배점 단위를 나눌 근거가 없으면
**criteria 를 빈 배열 []** 로 두고 answer 도 빈 문자열로 둔다.
틀린 기준이 저장되면 그 문항을 푸는 학생 전원이 그 기준으로 채점된다. 안 만드는 것이 훨씬 낫다.

[source / confidence]
- source: "answerText" | "answerImage" | "solutionImage" | "aiSolved"
  (정답 자료가 아예 없어 네가 직접 풀었으면 "aiSolved")
- confidence: source 가 "answerText" 면 최대 "high", 이미지에서 읽었으면 최대 "mid",
  "aiSolved" 면 반드시 "low".

반드시 아래 JSON 한 줄로만 답한다(설명·코드블록 없이):
{"maxScore":6,"answer":"최종 답","criteria":[{"text":"기준","weight":2}],"source":"solutionImage","confidence":"mid"}`

// ── 서술형 점수제 ②: 루브릭이 주어진 채점 + 첨삭 ──────────────────
// 🔴 응답에 criteria 의 text 를 다시 싣게 하지 않는다. got 숫자 배열만 받는다 —
//    출력 토큰이 줄고, 채점마다 기준 문구가 미묘하게 달라지는 '기준 표류'가 구조적으로 막힌다.
const SYSTEM_GRADE_R = `너는 한국 수학·과학 학원의 1차 채점관이다.
**배점 기준표는 이미 정해져 있다.** 너는 그 기준에 학생 답을 대보고 점수를 매기고, 첨삭을 쓴다.

[기준을 바꾸지 마라]
- 기준을 새로 만들거나 문구를 고치거나 순서를 바꾸지 마라.
- 기준에 없는 이유로 감점하지 마라. 기준에 있는데 학생이 해낸 것을 빼먹지 마라.
- got 은 기준 배열과 **같은 길이·같은 순서**의 숫자 배열이다.
  각 원소는 0 이상 그 기준의 weight 이하. 부분적으로 맞았으면 중간값도 준다.
- score = got 의 합. 네가 직접 더해서 score 에 쓴다.

[verdict — 기존 화면·통계가 그대로 쓰는 값이다]
- score 가 maxScore 와 같으면 verdict=true
- 그 미만이면(부분점수 포함) verdict=false
- 학생 답·풀이를 식별할 수 없어 판정 자체가 불가능하면 verdict=null, score=0, confidence="low"

[reason — 선생님용] 1~2문장. 존댓말. 어느 기준에서 왜 깎였는지만. 선생님이 3초에 읽는다.

[confidence] 학생 글씨를 못 읽었거나 풀이 이미지가 잘렸으면 반드시 낮춘다.

[feedback — 학생이 직접 읽는 글이다. 가장 공들여 쓴다]
4~6문장의 **한 문단**. 줄바꿈·불릿·번호 금지. 이모지 금지. 학생 이름 부르지 않는다.
반드시 이 순서로 쓴다:
1) 학생이 실제로 해낸 것을 **숫자와 식을 인용해서** 구체적으로 칭찬한다.
   ("잘했어요"는 칭찬이 아니다. "1200을 2^4×3×5^2 으로 정확히 분해했어요"가 칭찬이다)
2) 어디서 어긋났는지 **"~해야 하는데 ~했다"** 형태로 한 지점만 짚는다. 여럿이면 가장 결정적인 것 하나만.
3) 그래서 점수가 어떻게 되었는지 한 문장.
4) 다음에 같은 실수를 안 하려면 무엇을 하면 되는지 **행동으로** 한 문장.
   ("꼼꼼히 하세요"는 행동이 아니다. "소인수를 다 구한 뒤 문제 조건을 다시 읽는 습관"이 행동이다)
5) 짧은 격려 한 문장.
금지: "틀렸습니다"로 시작하지 마라. "아쉽게도"를 두 번 이상 쓰지 마라.
만점이면 2)3)을 빼고 3~4문장으로 줄인다. 없는 실수를 지어내지 마라.
판정 불가(verdict=null)면 feedback 을 빈 문자열로 둔다.

반드시 아래 JSON 한 줄로만 답한다(설명·코드블록 없이):
{"verdict":false,"score":4,"got":[2,2,0,0],"reason":"판정 근거","confidence":"high","feedback":"학생용 첨삭"}`

function readBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c: any) => { data += c })
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) } })
  })
}

const OK_MEDIA = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const isHttp = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\//.test(u)

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return }
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) { res.status(503).json({ error: 'AI가 아직 설정되지 않았습니다(ANTHROPIC_API_KEY).' }); return }

  const {
    mode,                                   // 'quiz' 면 확인용 객관식 만들기, 없으면 채점
    problemText, problemImageUrl,          // 문제 (텍스트 또는 이미지 URL — 과학은 이미지)
    answerText, answerImageUrl, solutionImageUrl,   // 정답 근거 (있는 것만)
    studentAnswer,                          // 학생이 고른/쓴 답 (①~⑤·단답)
    workImageBase64, workMediaType,         // 학생 풀이 이미지 (선택)
    wantRubric,                             // true면 루브릭이 없을 때 만들어서 응답에 함께 돌려준다
    rubric,                                 // 캐시된 루브릭 {maxScore, criteria:[{text,weight}]}
  } = await readBody(req)

  const quiz = mode === 'quiz'
  if (quiz) {
    if (!problemText && !isHttp(problemImageUrl)) { res.status(400).json({ error: '문제가 필요합니다.' }); return }
  } else if (!studentAnswer && !workImageBase64) {
    res.status(400).json({ error: '학생 답 또는 풀이 이미지가 필요합니다.' }); return
  }

  // 🔴 withStudent=false 면 학생 답·풀이 이미지를 **배열에 아예 넣지 않는다.**
  //    루브릭은 그 문항을 푸는 전원에게 적용되므로, 첫 학생 풀이가 기준을 물들이면
  //    그 오염이 영구히 캐시된다. "보지 마라"라고 지시하는 게 아니라 구조로 막는다.
  function buildContent(withStudent: boolean): any[] {
    const content: any[] = []
    const push = (label: string, url: string) => content.push(
      { type: 'text', text: label },
      { type: 'image', source: { type: 'url', url } },
    )
    if (isHttp(problemImageUrl)) push(quiz ? '[원래 문제 이미지]' : '[문제 이미지]', problemImageUrl)
    if (problemText) content.push({ type: 'text', text: `[${quiz ? '원래 문제' : '문제'}]\n${String(problemText).slice(0, 2000)}` })
    if (answerText) content.push({ type: 'text', text: `[${quiz ? '원래 문제의 정답' : '정답'}]\n${String(answerText).slice(0, 300)}` })
    if (isHttp(answerImageUrl)) push('[정답 이미지]', answerImageUrl)
    // quiz 모드에도 해설을 준다 — 정답 텍스트가 없는 서술형은 여기서 최종 답을 읽어야 한다
    if (isHttp(solutionImageUrl)) push(quiz ? '[해설 이미지 — 여기서 최종 답을 읽어라]' : '[해설 이미지 — 정답 판정 기준]', solutionImageUrl)
    if (withStudent && studentAnswer) content.push({ type: 'text', text: quiz
      ? `[학생이 틀리게 쓴 답 — 오답 보기 만들 때 참고]\n${String(studentAnswer).slice(0, 300)}`
      : `[학생이 제출한 답]\n${String(studentAnswer).slice(0, 300)}` })
    if (withStudent && !quiz && workImageBase64) {
      const media = OK_MEDIA.includes(workMediaType) ? workMediaType : 'image/jpeg'
      const data = String(workImageBase64).replace(/^data:[^,]+,/, '')
      content.push({ type: 'text', text: '[학생 풀이 이미지]' },
        { type: 'image', source: { type: 'base64', media_type: media as any, data } })
    }
    content.push({ type: 'text', text: withStudent
      ? (quiz ? '위 자료로 확인용 5지선다 한 문제를 만들고 JSON 한 줄로만 답하라.'
              : '위 자료로 지침대로 판정하고 JSON 한 줄로만 답하라.')
      : '위 자료로 이 문항의 배점 기준표를 만들고 JSON 한 줄로만 답하라. 학생 답은 주어지지 않았다.' })
    return content
  }
  try {
    const client = new Anthropic({ apiKey: key })
    const ask = async (sys: string, cont: any[], maxTok: number) => {
      const msg = await client.messages.create({
        // 🔴 Haiku 4.5 는 output_config.effort 를 지원하지 않는다 — 넣으면 400
        //    ("This model does not support the effort parameter." 2026-08-06 라이브 실측)
        model: 'claude-haiku-4-5',
        max_tokens: maxTok,
        system: sys,
        messages: [{ role: 'user', content: cont }],
      })
      const t = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text).join('').trim()
      // 🔴 stop_reason 을 안 보면 잘림이 아래 JSON.parse 실패 → "AI 응답 형식 오류" 502 로
      //    둔갑해서, max_tokens 를 올려야 할 상황이 "모델이 이상한 걸 뱉었다"로 보인다.
      return { text: t, truncated: msg.stop_reason === 'max_tokens' }
    }

    // ── 루브릭 확보 ─────────────────────────────────────────────
    // 클라이언트가 캐시된 루브릭을 실어 보냈으면 그걸 쓴다. 없고 wantRubric 이면 만든다.
    // 🔴 wantRubric 도 rubric 도 안 오면 rb 는 null → 아래는 예전 SYSTEM 채점 그대로 돈다.
    //    옛 클라이언트에게는 응답이 한 글자도 안 바뀐다. 이게 하위호환의 뿌리다.
    type RB = { maxScore: number; criteria: { text: string; weight: number }[]; answer?: string; source?: string; confidence?: string }
    let rb: RB | null = null
    if (!quiz && rubric && Array.isArray(rubric.criteria) && rubric.criteria.length && Number(rubric.maxScore) > 0) {
      rb = { maxScore: Number(rubric.maxScore), criteria: rubric.criteria.map((c: any) => ({ text: String(c.text ?? '').slice(0, 80), weight: Number(c.weight) || 0 })) }
    } else if (!quiz && wantRubric) {
      try {
        const { text: rt } = await ask(SYSTEM_RUBRIC, buildContent(false), 700)
        const rm = rt.match(/\{[\s\S]*\}/)
        if (rm) {
          const j = JSON.parse(rm[0])
          const cs = (Array.isArray(j.criteria) ? j.criteria : [])
            .map((c: any) => ({ text: String(c.text ?? '').trim().slice(0, 80), weight: Math.round(Number(c.weight) || 0) }))
            .filter((c: any) => c.text && c.weight > 0)
          const ms = Math.round(Number(j.maxScore) || 0)
          const sum = cs.reduce((a: number, c: any) => a + c.weight, 0)
          // 🔴 AI 가 가장 자주 틀리는 것이 weight 합 ≠ maxScore 다. 어긋나면 저장도 사용도 하지 않는다.
          //    (6점 만점인데 기준 합이 7점인 루브릭이 캐시되면 그 문항 전원의 점수가 어긋난다)
          if (cs.length >= 2 && cs.length <= 8 && ms >= 1 && ms <= 20 && sum === ms) {
            rb = {
              maxScore: ms, criteria: cs, answer: String(j.answer ?? '').slice(0, 100),
              source: ['answerText', 'answerImage', 'solutionImage', 'aiSolved'].includes(j.source) ? j.source : 'aiSolved',
              confidence: ['high', 'mid', 'low'].includes(j.confidence) ? j.confidence : 'low',
            }
          }
        }
      } catch { /* 루브릭 실패 = 점수 없이 예전 verdict 채점으로 폴백. 제출을 막지 않는다 */ }
    }

    const useR = !!rb
    const gradeSys = useR
      ? `${SYSTEM_GRADE_R}\n\n[배점 기준표 — 만점 ${rb!.maxScore}점]\n${rb!.criteria.map((c, i) => `${i + 1}. (${c.weight}점) ${c.text}`).join('\n')}`
      : SYSTEM
    const { text, truncated } = await ask(
      quiz ? SYSTEM_QUIZ : gradeSys,
      buildContent(true),
      quiz ? 700 : useR ? 1100 : 500,
    )
    if (quiz) {
      const q = text.match(/\{[\s\S]*\}/)
      if (!q) { res.status(502).json({ error: 'AI 응답 형식 오류' }); return }
      let j: any
      try { j = JSON.parse(q[0]) } catch { res.status(502).json({ error: 'AI 응답 형식 오류' }); return }
      // 문항은 원본 그대로 쓴다. 정답은 ①넘어온 텍스트 ②(없으면) AI 가 정답 이미지에서 읽은 값.
      // 🔴 ②가 없던 시절 서술형은 answerText 가 언제나 undefined 라 여기서 100% 400 이 났다 —
      //    확인용 객관식이 통째로 죽어 있었다 (2026-08-13 발견, aiGrade.ts 주석 참조).
      const readAnswer = String(j.answer ?? '').trim()
      const answer = String(answerText ?? '').trim() || (readAnswer.length <= 30 ? readAnswer : '')
      if (!answer) { res.status(400).json({ error: '정답이 있어야 객관식을 만들 수 있습니다.' }); return }
      const norm = (s: string) => String(s).replace(/[\s,]/g, '')
      const seen = new Set([norm(answer)])
      const bad: string[] = []
      for (const d of (Array.isArray(j.distractors) ? j.distractors : [])) {
        const t = String(d).slice(0, 80).trim()
        if (!t || seen.has(norm(t))) continue      // 정답과 같거나 중복인 보기는 버린다
        seen.add(norm(t)); bad.push(t)
      }
      if (bad.length < 4) { res.status(502).json({ error: 'AI가 만든 보기가 올바르지 않습니다.' }); return }
      // 정답 자리를 매번 바꾼다 — 늘 같은 번호면 답을 외워 버린다
      const answerIndex = Math.floor(Math.random() * 5)
      const choices = [...bad.slice(0, 4)]
      choices.splice(answerIndex, 0, answer)
      res.status(200).json({
        question: String(problemText ?? '').slice(0, 2000),   // 원래 문제 그대로 (이미지 문제는 빈 값)
        choices, answerIndex, why: String(j.why ?? '').slice(0, 300),
      })
      return
    }
    let out: any = null
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        const j = JSON.parse(m[0])
        out = {
          verdict: j.verdict === true ? true : j.verdict === false ? false : null,
          reason: String(j.reason ?? '').slice(0, 400),
          confidence: ['high', 'mid', 'low'].includes(j.confidence) ? j.confidence : 'low',
        }
        if (useR) {
          const max = rb!.maxScore
          let score = Math.max(0, Math.min(max, Math.round(Number(j.score) || 0)))
          const got: number[] = Array.isArray(j.got) ? j.got.map((n: any) => Math.round(Number(n) || 0)) : []
          // got 이 기준과 길이가 다르거나 합이 score 와 안 맞으면 got 만 버린다(어느 쪽이 틀렸는지 모른다)
          const okGot = got.length === rb!.criteria.length
            && got.every((n, i) => n >= 0 && n <= rb!.criteria[i].weight)
            && got.reduce((a, b) => a + b, 0) === score
          if (out.verdict === null) score = 0
          // 🔴 verdict 와 score 가 어긋나면 score 를 기준으로 verdict 를 맞춘다.
          //    부분점수는 정답이 아니다 — correct 의 의미(만점일 때만 true)를 지킨다.
          else out.verdict = score === max
          out.score = score
          out.maxScore = max
          out.criteria = rb!.criteria.map((c, i) => ({ text: c.text, weight: c.weight, got: okGot ? got[i] : 0 }))
          out.feedback = String(j.feedback ?? '').slice(0, 1200)
          if (!rubric) out.rubric = rb   // 새로 만든 것만 돌려준다 → 클라이언트가 캐시에 저장
        }
      } catch { /* fallthrough */ }
    }
    if (!out) {
      res.status(502).json({ error: truncated
        ? 'AI 응답이 잘렸습니다(max_tokens). 서버 설정을 확인해주세요.'
        : 'AI 응답 형식 오류' })
      return
    }
    res.status(200).json(out)
  } catch (e: any) {
    // Anthropic 크레딧 소진은 원문이 영문 JSON이라 화면에 그대로 뜨면 알아보기 어렵다 → 한글 안내로 바꾼다
    const msg = String(e?.message ?? e)
    if (/credit balance is too low/i.test(msg)) {
      res.status(402).json({ error: 'AI 크레딧이 부족합니다. Anthropic 콘솔(Plans & Billing)에서 충전한 뒤 다시 시도해주세요.' })
      return
    }
    res.status(502).json({ error: msg.slice(0, 200) })
  }
}
