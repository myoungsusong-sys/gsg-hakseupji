// 일일 보고지 "선생님 한마디" AI 작성/보정 — Vercel 서버리스 함수 (Node)
// 키는 서버 환경변수 ANTHROPIC_API_KEY 로만 사용(브라우저 노출 없음).
//
// ✍️ 이 코멘트는 **수업마다 학부모에게 나간다.** 그래서 두 가지가 생명이다.
//   ① AI 티가 안 날 것  ② 매번 같은 양식이 아닐 것            (2026-07-28 명수쌤 지시)
//
// 예전 프롬프트는 "2~4문장, 따뜻하고 전문적으로, 오늘 데이터에 근거해"가 전부였다.
// 그러니 매번 **단원 → 점수 → 취약유형 → 격려**라는 같은 뼈대가 나왔고, 최근에 뭐라고
// 썼는지 모르니 표현까지 돌고 돌았다. 아래 셋으로 그 틀을 깬다.
//   1. 오늘의 초점(angle)을 하나 정해 준다 — 다 훑지 말고 한 가지만 쓰게 한다.
//   2. 분량을 매번 바꾼다 — 한 문장으로 끝나는 날이 있어야 사람 같다.
//   3. 최근에 보낸 한마디를 같이 넘겨 준다 — 시작하는 말과 구조가 겹치지 않게.
// 초점·분량은 (학생+날짜+과목) 해시로 고른다. 같은 날 다시 눌러도 같은 결이 나오고,
// 날이 바뀌거나 학생이 바뀌면 달라진다.
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM = `너는 학원 선생님이 학부모에게 보내는 일일 보고지의 '선생님 한마디'를 대신 써 준다.
목표는 하나다 — **사람이 쓴 것처럼 보일 것.**

[가장 중요]
- 오늘 데이터를 처음부터 끝까지 요약하지 마라. 말할 만한 것 하나(많아야 둘)만 골라 쓴다.
- 점수·문항 수는 보고지 표에 이미 다 나와 있다. 숫자는 꼭 필요할 때 하나만 쓰고, 나열하지 않는다.
- 매번 같은 틀로 쓰지 마라. 시작하는 말, 문장 수, 다루는 내용이 매번 달라야 한다.

[쓰지 마라 — 읽는 순간 AI 티가 나는 말]
"~하는 모습이 인상적입니다" · "꾸준함이 큰 힘이 됩니다" · "앞으로도" · "화이팅" ·
"응원하겠습니다" · "성실히 임했습니다" · "차근차근" · "한 단계 더 성장" · "이러한 노력이" ·
"~를 통해" · "말씀드립니다" · 느낌표 두 개 이상 · 이모지 · 인사말 · 서명.
문장을 전부 '~습니다'로 끝내지 마라. '~네요', '~았어요', '~더군요' 같은 실제 말투를 섞어라.

[사람처럼 보이는 법]
- 구체적인 것 하나를 짚어라(단원 이름, 틀린 유형, 걸린 시간 등). 뭉뚱그리면 바로 티가 난다.
- 잘한 날은 담백하게. 아쉬운 날은 감추지 말고 사실대로 쓰되, 다음에 뭘 할지 한마디 붙인다.
- 학부모가 아는 말로 쓴다. '오답률', '정답률', '취약 유형' 같은 업계 말은 풀어서.

[지키는 선]
- 제공된 '오늘 데이터'에 없는 사실은 절대 지어내지 않는다. 없으면 안 쓰면 된다.
- 결과 문장만 출력한다. 따옴표, 머리말("선생님 한마디:"), 설명은 붙이지 않는다.`

// 오늘 어디에 초점을 둘지 — 다 훑지 말고 하나만 쓰게 하는 장치
const ANGLES = [
  '오늘 다룬 단원 내용 자체. 무엇을 배웠고 어디가 고비였는지.',
  '지난주와 견준 흐름. 오르든 내리든 그 변화 하나만.',
  '틀린 유형 하나를 짚고, 다음 시간에 그걸 어떻게 다룰지.',
  '푸는 태도와 속도. 시간을 얼마나 썼는지, 막힌 데서 끝까지 붙잡았는지.',
  '오늘 제일 잘한 것 하나만. 짧고 담백하게.',
  '다음 수업에 무엇을 할지 예고 중심으로.',
  '집에서 한 가지 도와줄 수 있는 것을 부탁하듯이.',
]

const LENGTHS = [
  '한 문장. 짧게 끊어라.',
  '한 문장, 길어야 두 문장.',
  '두 문장.',
  '두 문장, 길어야 세 문장.',
  '세 문장.',
]

/** 문자열 → 안정적인 해시. 같은 날 다시 눌러도 같은 결, 날이 바뀌면 달라진다. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
const pick = <T,>(arr: T[], seed: string, salt: string): T => arr[hash(seed + salt) % arr.length]

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

  const { mode, context, draft, seed, recent } = await readBody(req)
  const ctx = String(context ?? '').slice(0, 4000)
  // 최근에 보낸 한마디 — 시작하는 말과 구조가 겹치지 않게 하는 가장 강한 장치
  const past = (Array.isArray(recent) ? recent : [])
    .map((s: unknown) => String(s ?? '').trim()).filter(Boolean).slice(0, 4)
  const avoid = past.length
    ? `\n\n[최근에 이 학생에게 보낸 한마디 — 시작하는 말·표현·구조가 겹치면 안 된다]\n${past.map(s => `· ${s}`).join('\n')}`
    : ''

  const s = String(seed ?? ctx).slice(0, 200)
  const prompt = mode === 'polish'
    ? `아래는 선생님이 직접 쓴 초안이다. 뜻은 그대로 두고 문장만 자연스럽게 다듬어라.
내용을 더하거나 빼지 말고, 선생님이 쓴 말투를 살려라. AI가 고친 티가 나면 실패다.\n\n[오늘 데이터]\n${ctx}\n\n[선생님 초안]\n${String(draft ?? '').slice(0, 2000)}${avoid}`
    : `아래 오늘 학습 데이터로 '선생님 한마디'를 써라.

[오늘은 이것에 초점을 둔다] ${pick(ANGLES, s, 'angle')}
[분량] ${pick(LENGTHS, s, 'len')}

데이터를 다 훑지 말고 위 초점 하나로만 써라. 초점에 쓸 만한 내용이 데이터에 없으면
그때만 다른 것을 골라라.\n\n[오늘 데이터]\n${ctx}${avoid}`

  try {
    const client = new Anthropic({ apiKey: key })
    const msg = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 2000,            // Opus 5는 사고가 기본 켜짐 — 사고+본문이 함께 이 한도를 쓴다
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    })
    if (msg.stop_reason === 'refusal') { res.status(502).json({ error: 'AI가 응답을 거절했습니다.' }); return }
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('').trim()
    if (!text) { res.status(502).json({ error: '빈 응답' }); return }
    res.status(200).json({ text })
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message ?? e).slice(0, 200) })
  }
}
