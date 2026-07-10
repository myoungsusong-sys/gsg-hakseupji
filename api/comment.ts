// 일일 보고지 "선생님 한마디" AI 작성/보정 — Vercel 서버리스 함수 (Node)
// 키는 서버 환경변수 ANTHROPIC_API_KEY 로만 사용(브라우저 노출 없음).
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM = `너는 한국의 수학·과학 학원 선생님이 학부모에게 보내는 "일일 학습 보고지"의 '선생님 한마디'를 써 주는 조력자다.
- 따뜻하지만 전문적이고, 구체적으로 쓴다. 2~4문장, 학부모가 읽기 좋은 자연스러운 존댓말.
- 반드시 제공된 '오늘 데이터'에 근거한다. 데이터에 없는 사실을 지어내거나 과장하지 않는다.
- 이모지는 쓰지 않는다. "안녕하세요" 같은 인사말·서명은 넣지 않는다(카드 본문에 바로 들어감).
- 결과 텍스트만 출력한다. 따옴표나 머리말("선생님 한마디:")을 붙이지 않는다.`

function readBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c: any) => { data += c })
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) } })
  })
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return }
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) { res.status(503).json({ error: 'AI가 아직 설정되지 않았습니다(ANTHROPIC_API_KEY).' }); return }

  const { mode, context, draft } = await readBody(req)
  const ctx = String(context ?? '').slice(0, 4000)
  const prompt = mode === 'polish'
    ? `아래는 선생님이 직접 쓴 초안이다. 오늘 데이터를 참고해, 뜻은 그대로 두고 문장만 더 자연스럽고 정중하게 다듬어라(내용 추가/삭제 최소화).\n\n[오늘 데이터]\n${ctx}\n\n[선생님 초안]\n${String(draft ?? '').slice(0, 2000)}`
    : `아래 오늘 학습 데이터를 바탕으로 '선생님 한마디'를 새로 써라.\n\n[오늘 데이터]\n${ctx}`

  try {
    const client = new Anthropic({ apiKey: key })
    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 600,
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('').trim()
    if (!text) { res.status(502).json({ error: '빈 응답' }); return }
    res.status(200).json({ text })
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message ?? e).slice(0, 200) })
  }
}
