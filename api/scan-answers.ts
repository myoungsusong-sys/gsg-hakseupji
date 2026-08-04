// 사진 한 장 → 번호별 학생 답 읽기 — Vercel 서버리스 (Node), Claude 비전
//
// ⚠️ 이 API는 **채점하지 않는다.** 학생이 공책에 쓴 답을 번호별로 "읽어서" 돌려줄 뿐이고,
// 정답 대조는 기존 채점 엔진(lib/mathAnswer 의 mathEqual)이 그대로 한다. 이유 —
//  ① 채점 로직이 안 바뀌니 전수 감사 기준선(객관식 177,600 · 주관식 868,977)이 그대로다.
//  ② 읽은 값이 입력칸에 그대로 채워지므로 학생이 오독을 눈으로 잡고 고칠 수 있다.
// 그래서 **정답은 AI에 보내지 않는다.** 정답을 알려주면 학생이 뭘 썼든 정답으로 읽어버리는
// 편향이 생긴다. 보내는 것은 문항 번호와 답 형태(객관식/OX/주관식·칸 수)뿐이다.
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM = `너는 학생이 공책이나 교재에 손으로 쓴 답을 사진에서 읽어 옮겨 적는 사람이다.
채점은 하지 않는다. 맞았는지 틀렸는지 판단하지 말고, **쓰여 있는 그대로** 읽어라.

원칙:
- 주어진 문항 번호 목록에 대해서만 답을 읽는다. 사진에 없는 번호는 answer를 ""(빈 문자열)로 둔다.
- 학생이 쓴 것을 고쳐 쓰지 마라. 틀린 답이어도 틀린 그대로 옮긴다. 계산해서 채우지도 마라.
- 지우거나 그어 지운 답은 무시하고, 최종적으로 남긴 답만 읽는다.
- 수식은 학생앱 입력 표기로 옮긴다: 분수는 3/4, 지수는 x^2, 루트는 √2(또는 루트2), 원주율은 π.
  대분수는 "2 4/7"처럼 정수 뒤에 띄어 쓴다. 단위(cm, 개, 원)는 쓰여 있으면 그대로 붙인다.
- 객관식은 고른 번호만 숫자로 (예: "3"). 여러 개 고른 문항은 쉼표로 (예: "3,5").
- OX 문항은 "O" 또는 "X".
- 답이 여러 개인 문항(parts가 2 이상)은 쓰인 순서대로 쉼표로 이어 적는다 (예: "a=2, b=5").
- 글씨가 흐리거나 어느 번호의 답인지 애매하면 추측해서 채우지 말고 confidence를 low로 준다.
  아예 못 읽겠으면 answer를 "" 로 둔다. **비워 두는 것이 잘못 읽는 것보다 낫다.**

confidence: high(또렷하게 읽힘) / mid(읽히지만 헷갈리는 글자가 있음) / low(추정)`

const OK_MEDIA = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

const SCHEMA = {
  type: 'object',
  properties: {
    answers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          no: { type: 'string', description: '문항 번호 (요청에 준 번호를 그대로)' },
          answer: { type: 'string', description: '학생이 쓴 답. 못 읽었으면 빈 문자열' },
          confidence: { type: 'string', enum: ['high', 'mid', 'low'] },
        },
        required: ['no', 'answer', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['answers'],
  additionalProperties: false,
} as const

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

  const {
    imageBase64, mediaType,     // 학생이 찍은 사진 (data URL 또는 순수 base64)
    items,                      // [{ no, kind: '객관식'|'OX'|'주관식', parts?: number }] — 정답은 넣지 않는다
    pageLabel,                  // 예: "오투 중등과학 3-2 124쪽" (선택, 사진 대조용 힌트)
  } = await readBody(req)

  if (!imageBase64) { res.status(400).json({ error: '사진이 필요합니다.' }); return }
  const list = Array.isArray(items) ? items.slice(0, 60) : []
  if (!list.length) { res.status(400).json({ error: '읽을 문항 목록이 필요합니다.' }); return }

  const media = OK_MEDIA.includes(mediaType) ? mediaType : 'image/jpeg'
  const data = String(imageBase64).replace(/^data:[^,]+,/, '')

  const guide = list.map((it: any) => {
    const kind = it.kind === '객관식' ? '객관식(1~5 중 고름)' : it.kind === 'OX' ? 'OX' : '주관식'
    const parts = Number(it.parts) > 1 ? ` · 답 ${Number(it.parts)}개` : ''
    return `- ${it.no}번: ${kind}${parts}`
  }).join('\n')

  const content: any[] = [
    { type: 'text', text: '[학생이 답을 쓴 사진]' },
    { type: 'image', source: { type: 'base64', media_type: media as any, data } },
    {
      type: 'text',
      text: `${pageLabel ? `[교재] ${String(pageLabel).slice(0, 100)}\n\n` : ''}[읽어야 할 문항]\n${guide}\n\n` +
        '위 사진에서 각 번호의 답을 읽어 JSON으로 돌려라. 목록에 있는 번호는 빠짐없이 넣되, ' +
        '사진에서 찾지 못한 번호는 answer를 빈 문자열로 둔다.',
    },
  ]

  try {
    const client = new Anthropic({ apiKey: key })
    const msg = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: SCHEMA as any },
      },
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    })
    // 안전 거름망: 정책상 거절되면 content 가 비거나 부분만 온다 — 먼저 stop_reason 을 본다.
    if (msg.stop_reason === 'refusal') { res.status(502).json({ error: 'AI가 이 사진을 읽지 못했습니다.' }); return }

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('').trim()
    let parsed: { answers?: any[] } | null = null
    try { parsed = JSON.parse(text) } catch { parsed = null }
    if (!parsed?.answers) { res.status(502).json({ error: 'AI 응답 형식 오류' }); return }

    // 요청한 번호만, 문자열로 정규화해서 돌려준다 (클라이언트가 그대로 입력칸에 채운다)
    const want = new Set(list.map((it: any) => String(it.no)))
    const answers = parsed.answers
      .filter((a: any) => want.has(String(a?.no)))
      .map((a: any) => ({
        no: String(a.no),
        answer: String(a.answer ?? '').slice(0, 200),
        confidence: ['high', 'mid', 'low'].includes(a.confidence) ? a.confidence : 'low',
      }))
    res.status(200).json({ answers })
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
