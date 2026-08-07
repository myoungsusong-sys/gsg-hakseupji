// 확인용 객관식 만들기 — Vercel 서버리스 (Node), Claude 비전
// 서술형을 틀린 학생이 "정답을 빨간펜으로 적은 뒤" 바로 다시 확인하도록,
// 같은 개념을 묻는 5지선다를 그 자리에서 만든다. (명수쌤 지시 2026-08-07)
// 틀린 문항에서만 호출한다 — 맞은 문항은 부르지 않으므로 토큰이 새지 않는다.
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM = `너는 한국 중·고등 수학·과학 학원의 문제 출제자다.
학생이 방금 서술형 문제를 틀렸다. 학생이 정답을 제대로 이해했는지 30초 안에 확인할
**5지선다 객관식 한 문제**를 만든다.

원칙:
- 원래 문제와 **같은 개념·같은 수치**를 묻는다. 새로운 개념이나 더 어려운 변형은 금지.
- 정답은 원래 문제의 정답과 뜻이 같아야 한다.
- 오답 4개는 학생이 흔히 하는 실수(부호 반대·계산 한 단계 누락·단위 혼동 등)에서 만든다.
  터무니없는 보기는 넣지 않는다.
- 보기는 짧게(각 30자 이내). 수식은 일반 텍스트로 쓴다(예: x^2, √3, 1/2).
- 문항은 1~2문장. 존댓말.
- 반드시 아래 JSON 한 줄로만 답한다(설명·코드블록 없이):
{"question":"문항","choices":["①것","②것","③것","④것","⑤것"],"answerIndex":0,"why":"정답인 이유 한 문장"}
- choices 는 정확히 5개, 번호를 붙이지 말고 내용만 쓴다. answerIndex 는 0~4.`

function readBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c: any) => { data += c })
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) } })
  })
}

const isHttp = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\//.test(u)

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return }
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) { res.status(503).json({ error: 'AI가 아직 설정되지 않았습니다(ANTHROPIC_API_KEY).' }); return }

  const { problemText, problemImageUrl, answerText, answerImageUrl, studentAnswer } = await readBody(req)
  if (!problemText && !isHttp(problemImageUrl)) { res.status(400).json({ error: '문제가 필요합니다.' }); return }

  const content: any[] = []
  const push = (label: string, url: string) => content.push(
    { type: 'text', text: label },
    { type: 'image', source: { type: 'url', url } },
  )
  if (isHttp(problemImageUrl)) push('[원래 문제 이미지]', problemImageUrl)
  if (problemText) content.push({ type: 'text', text: `[원래 문제]\n${String(problemText).slice(0, 2000)}` })
  if (answerText) content.push({ type: 'text', text: `[원래 문제의 정답]\n${String(answerText).slice(0, 300)}` })
  if (isHttp(answerImageUrl)) push('[원래 문제의 정답 이미지]', answerImageUrl)
  if (studentAnswer) content.push({ type: 'text', text: `[학생이 틀리게 쓴 답 — 오답 보기 만들 때 참고]\n${String(studentAnswer).slice(0, 300)}` })
  content.push({ type: 'text', text: '위 자료로 확인용 5지선다 한 문제를 만들고 JSON 한 줄로만 답하라.' })

  try {
    const client = new Anthropic({ apiKey: key })
    const msg = await client.messages.create({
      // 🔴 Haiku 4.5 는 output_config.effort 를 지원하지 않는다 — 넣으면 400 (2026-08-06 실측)
      model: 'claude-haiku-4-5',
      max_tokens: 700,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    })
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('').trim()
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) { res.status(502).json({ error: 'AI 응답 형식 오류' }); return }
    let j: any
    try { j = JSON.parse(m[0]) } catch { res.status(502).json({ error: 'AI 응답 형식 오류' }); return }
    const choices = Array.isArray(j.choices) ? j.choices.map((c: unknown) => String(c).slice(0, 80)) : []
    const answerIndex = Number(j.answerIndex)
    // 보기가 5개가 아니거나 정답 번호가 범위 밖이면 쓸 수 없다 — 잘못된 문제를 학생에게 내지 않는다
    if (choices.length !== 5 || !(answerIndex >= 0 && answerIndex <= 4)) {
      res.status(502).json({ error: 'AI가 만든 보기가 올바르지 않습니다.' }); return
    }
    res.status(200).json({
      question: String(j.question ?? '').slice(0, 400),
      choices, answerIndex,
      why: String(j.why ?? '').slice(0, 300),
    })
  } catch (e: any) {
    const msg = String(e?.message ?? e)
    if (/credit balance is too low/i.test(msg)) {
      res.status(402).json({ error: 'AI 크레딧이 부족합니다. Anthropic 콘솔(Plans & Billing)에서 충전한 뒤 다시 시도해주세요.' })
      return
    }
    res.status(502).json({ error: msg.slice(0, 200) })
  }
}
