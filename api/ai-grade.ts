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
const SYSTEM_QUIZ = `너는 한국 중·고등 수학·과학 학원의 문제 출제자다.
학생이 방금 서술형 문제를 틀렸다. 정답을 적고 이해했는지 확인하도록,
**그 문제를 그대로 5지선다로 바꾼다.**

가장 중요한 규칙:
- **문제를 새로 만들지 마라.** 원래 문제의 묻는 내용을 그대로 쓰고 보기 5개만 붙인다.
  숫자·조건을 바꾸거나 다른 것을 묻는 변형은 금지다.
- **정답은 [원래 문제의 정답]과 반드시 같아야 하고, 그 값이 보기 안에 있어야 한다.**
  보기를 다 쓴 뒤 answerIndex 자리의 보기가 정말 원래 정답인지 스스로 확인하고 답하라.
- 오답 4개는 학생이 흔히 하는 실수(부호 반대·계산 한 단계 누락·단위 혼동 등)에서 만든다.
  터무니없는 보기는 넣지 않는다.

그 밖에:
- 보기는 짧게(각 30자 이내). 수식은 일반 텍스트로 쓴다(예: x^2, √3, 1/2).
- 문항은 원래 문제 문장을 거의 그대로. 존댓말.
- why 는 정답이 왜 그 값인지 한 문장. 계산이 맞는지 확인한 뒤 쓴다.
- 반드시 아래 JSON 한 줄로만 답한다(설명·코드블록 없이):
{"question":"문항","choices":["것1","것2","것3","것4","것5"],"answerIndex":0,"why":"정답인 이유 한 문장"}
- choices 는 정확히 5개, 번호를 붙이지 말고 내용만 쓴다. answerIndex 는 0~4.`

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
  } = await readBody(req)

  const quiz = mode === 'quiz'
  if (quiz) {
    if (!problemText && !isHttp(problemImageUrl)) { res.status(400).json({ error: '문제가 필요합니다.' }); return }
  } else if (!studentAnswer && !workImageBase64) {
    res.status(400).json({ error: '학생 답 또는 풀이 이미지가 필요합니다.' }); return
  }

  const content: any[] = []
  const push = (label: string, url: string) => content.push(
    { type: 'text', text: label },
    { type: 'image', source: { type: 'url', url } },
  )
  if (isHttp(problemImageUrl)) push(quiz ? '[원래 문제 이미지]' : '[문제 이미지]', problemImageUrl)
  if (problemText) content.push({ type: 'text', text: `[${quiz ? '원래 문제' : '문제'}]\n${String(problemText).slice(0, 2000)}` })
  if (answerText) content.push({ type: 'text', text: `[${quiz ? '원래 문제의 정답' : '정답'}]\n${String(answerText).slice(0, 300)}` })
  if (isHttp(answerImageUrl)) push('[정답 이미지]', answerImageUrl)
  if (!quiz && isHttp(solutionImageUrl)) push('[해설 이미지 — 정답 판정 기준]', solutionImageUrl)
  if (studentAnswer) content.push({ type: 'text', text: quiz
    ? `[학생이 틀리게 쓴 답 — 오답 보기 만들 때 참고]\n${String(studentAnswer).slice(0, 300)}`
    : `[학생이 제출한 답]\n${String(studentAnswer).slice(0, 300)}` })
  if (!quiz && workImageBase64) {
    const media = OK_MEDIA.includes(workMediaType) ? workMediaType : 'image/jpeg'
    const data = String(workImageBase64).replace(/^data:[^,]+,/, '')
    content.push({ type: 'text', text: '[학생 풀이 이미지]' },
      { type: 'image', source: { type: 'base64', media_type: media as any, data } })
  }
  content.push({ type: 'text', text: quiz
    ? '위 자료로 확인용 5지선다 한 문제를 만들고 JSON 한 줄로만 답하라.'
    : '위 자료로 지침대로 판정하고 JSON 한 줄로만 답하라.' })

  try {
    const client = new Anthropic({ apiKey: key })
    const msg = await client.messages.create({
      // 🔴 Haiku 4.5 는 output_config.effort 를 지원하지 않는다 — 넣으면 400
      //    ("This model does not support the effort parameter." 2026-08-06 라이브 실측)
      model: 'claude-haiku-4-5',
      max_tokens: quiz ? 700 : 500,
      system: quiz ? SYSTEM_QUIZ : SYSTEM,
      messages: [{ role: 'user', content }],
    })
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('').trim()
    if (quiz) {
      const q = text.match(/\{[\s\S]*\}/)
      if (!q) { res.status(502).json({ error: 'AI 응답 형식 오류' }); return }
      let j: any
      try { j = JSON.parse(q[0]) } catch { res.status(502).json({ error: 'AI 응답 형식 오류' }); return }
      const choices: string[] = Array.isArray(j.choices) ? j.choices.map((c: unknown) => String(c).slice(0, 80)) : []
      let answerIndex = Number(j.answerIndex)
      // 보기가 5개가 아니거나 정답 번호가 범위 밖이면 잘못된 문제를 학생에게 내지 않는다
      if (choices.length !== 5 || !(answerIndex >= 0 && answerIndex <= 4)) {
        res.status(502).json({ error: 'AI가 만든 보기가 올바르지 않습니다.' }); return
      }
      // 🔴 원래 정답이 보기 안에 있어야 한다. AI 가 문제를 변형해 놓고 답이 보기에 없는
      //    문제를 만든 적이 있다(2026-08-07 라이브 실측) — 학생에게 그런 문제를 내지 않는다.
      if (answerText) {
        const norm = (s: string) => String(s).replace(/[\s,]/g, '').replace(/[①②③④⑤]/g, '')
        const want = norm(answerText)
        const at = choices.findIndex(c => norm(c) === want)
        if (at < 0) { res.status(502).json({ error: '정답이 보기에 없는 문제가 만들어졌습니다.' }); return }
        answerIndex = at
      }
      res.status(200).json({
        question: String(j.question ?? '').slice(0, 400),
        choices, answerIndex, why: String(j.why ?? '').slice(0, 300),
      })
      return
    }
    let out: { verdict: boolean | null; reason: string; confidence: 'high' | 'mid' | 'low' } | null = null
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        const j = JSON.parse(m[0])
        out = {
          verdict: j.verdict === true ? true : j.verdict === false ? false : null,
          reason: String(j.reason ?? '').slice(0, 400),
          confidence: ['high', 'mid', 'low'].includes(j.confidence) ? j.confidence : 'low',
        }
      } catch { /* fallthrough */ }
    }
    if (!out) { res.status(502).json({ error: 'AI 응답 형식 오류' }); return }
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
