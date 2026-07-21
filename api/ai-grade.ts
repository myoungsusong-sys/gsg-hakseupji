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
    problemText, problemImageUrl,          // 문제 (텍스트 또는 이미지 URL — 과학은 이미지)
    answerText, answerImageUrl, solutionImageUrl,   // 정답 근거 (있는 것만)
    studentAnswer,                          // 학생이 고른/쓴 답 (①~⑤·단답)
    workImageBase64, workMediaType,         // 학생 풀이 이미지 (선택)
  } = await readBody(req)

  if (!studentAnswer && !workImageBase64) { res.status(400).json({ error: '학생 답 또는 풀이 이미지가 필요합니다.' }); return }

  const content: any[] = []
  const push = (label: string, url: string) => content.push(
    { type: 'text', text: label },
    { type: 'image', source: { type: 'url', url } },
  )
  if (isHttp(problemImageUrl)) push('[문제 이미지]', problemImageUrl)
  if (problemText) content.push({ type: 'text', text: `[문제]\n${String(problemText).slice(0, 2000)}` })
  if (answerText) content.push({ type: 'text', text: `[정답]\n${String(answerText).slice(0, 300)}` })
  if (isHttp(answerImageUrl)) push('[정답 이미지]', answerImageUrl)
  if (isHttp(solutionImageUrl)) push('[해설 이미지 — 정답 판정 기준]', solutionImageUrl)
  if (studentAnswer) content.push({ type: 'text', text: `[학생이 제출한 답]\n${String(studentAnswer).slice(0, 300)}` })
  if (workImageBase64) {
    const media = OK_MEDIA.includes(workMediaType) ? workMediaType : 'image/jpeg'
    const data = String(workImageBase64).replace(/^data:[^,]+,/, '')
    content.push({ type: 'text', text: '[학생 풀이 이미지]' },
      { type: 'image', source: { type: 'base64', media_type: media as any, data } })
  }
  content.push({ type: 'text', text: '위 자료로 지침대로 판정하고 JSON 한 줄로만 답하라.' })

  try {
    const client = new Anthropic({ apiKey: key })
    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 500,
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    })
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('').trim()
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
    res.status(502).json({ error: String(e?.message ?? e).slice(0, 200) })
  }
}
