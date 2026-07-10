// 학생 풀이(사진/필기 이미지) AI 피드백 — Vercel 서버리스 함수 (Node), Claude 비전
// 정확성 최우선: 정답을 유출하지 않고, 풀이 "과정"을 채점한다. 정답만 있고 과정이 없으면 감지(베끼기 방지).
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM = `너는 한국 수학·과학 학원의 채점 도우미다. 학생이 태블릿에 쓴(또는 사진 찍은) "풀이 과정" 이미지를 보고 피드백한다.

원칙:
- 학생의 "풀이 과정"을 단계별로 살핀다. 어디까지 맞고 어디서 틀렸는지, 왜 틀렸는지 짚는다.
- 정답 숫자·완성된 풀이를 그대로 알려주지 않는다(베껴 쓰기 방지). 대신 다음 한 걸음을 유도하는 힌트를 준다.
- 이미지에 "풀이 과정 없이 답만" 있거나, 문제와 무관한 낙서/빈 종이면 hasWork=false로 표시하고 "풀이 과정을 직접 써서 다시 올려 주세요"라고 안내한다.
- 따뜻하지만 정확하게. 2~5문장. 이모지·머리말 없이 자연스러운 존댓말.
- 반드시 아래 JSON 한 줄로만 답한다(설명·코드블록 없이):
{"hasWork": true/false, "correct": true/false/null, "feedback": "학생에게 보여줄 피드백"}
- correct: 풀이 결과가 정답과 일치하면 true, 틀리면 false, 판단 불가(과정 없음 등)면 null.`

function readBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c: any) => { data += c })
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) } })
  })
}

const OK_MEDIA = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return }
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) { res.status(503).json({ error: 'AI가 아직 설정되지 않았습니다(ANTHROPIC_API_KEY).' }); return }

  const { imageBase64, mediaType, problemText, answer } = await readBody(req)
  if (!imageBase64 || typeof imageBase64 !== 'string') { res.status(400).json({ error: '이미지가 없습니다.' }); return }
  const media = OK_MEDIA.includes(mediaType) ? mediaType : 'image/jpeg'
  const data = String(imageBase64).replace(/^data:[^,]+,/, '')   // dataURL 접두 제거

  const ctxLines = [
    problemText ? `[문제]\n${String(problemText).slice(0, 2000)}` : '문제 원문은 제공되지 않았다. 이미지 속 문제/풀이를 보고 판단하라.',
    answer ? `[정답(내부 판정용 — 학생에게 노출 금지)]\n${String(answer).slice(0, 200)}` : '',
    '위 학생의 풀이 이미지를 보고 지침대로 JSON으로 답하라.',
  ].filter(Boolean).join('\n\n')

  try {
    const client = new Anthropic({ apiKey: key })
    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 700,
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: media as any, data } },
          { type: 'text', text: ctxLines },
        ],
      }],
    })
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('').trim()
    // JSON 파싱(관대하게) — 실패 시 전체를 피드백으로
    let out = { hasWork: true as boolean, correct: null as boolean | null, feedback: text }
    const m = text.match(/\{[\s\S]*\}/)
    if (m) { try { const j = JSON.parse(m[0]); out = { hasWork: j.hasWork !== false, correct: j.correct ?? null, feedback: String(j.feedback ?? text) } } catch { /* keep raw */ } }
    if (!out.feedback) { res.status(502).json({ error: '빈 응답' }); return }
    res.status(200).json(out)
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message ?? e).slice(0, 200) })
  }
}
