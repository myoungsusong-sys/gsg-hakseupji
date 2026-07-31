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
// 초점은 날짜순으로 한 칸씩 밀어 고른다(연달아 같은 초점이 안 걸리게). 분량은 해시.
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
- 구체적인 것 하나를 짚어라. **단, 자료에 적힌 것만** — 단원 이름, 틀린 유형, 점수, 지난주 대비.
  뭉뚱그리면 티가 나지만, 없는 것을 지어내면 그건 거짓말이라 훨씬 나쁘다.
- 잘한 날은 담백하게. 아쉬운 날은 감추지 말고 사실대로 쓰되, 다음에 뭘 할지 한마디 붙인다.
- 학부모가 아는 말로 쓴다. '오답률', '정답률', '취약 유형' 같은 업계 말은 풀어서.

[🔴 없는 것은 없는 대로 둔다 — 지어내면 그 글은 실패다]
학부모는 이 글을 **선생님이 직접 본 사실**로 읽는다. 아래는 '오늘 데이터'에 **아예 없는**
것들이다. 자료에 그 항목이 적혀 있지 않으면 절대 쓰지 마라. 짐작·추측·미화 모두 금지다.
 · 수업 태도, 표정, 집중력, 자세, 앉아 있던 모습
 · 질문을 했는지, 발표를 했는지, 친구와 어땠는지
 · 걸린 시간·속도 (자료에 '푼 시간'이 없으면)
 · 숙제를 해 왔는지, 집에서 무엇을 했는지
 · 다음 시간에 무엇을 할지 (자료에 '다음 학습 계획'이 없으면)
 · 학생의 마음·의지·노력의 정도 — "끝까지 붙잡고 풀었다", "포기하지 않았다",
   "어려워했지만", "집중해서", "차분히" 같은 말은 자료에 근거가 없으면 전부 지어낸 것이다.
 · 점수가 낮거나 높은 **이유** (자료에 없으면 원인을 만들어 붙이지 마라)
쓸 말이 모자라면 **짧게 끝내라.** 한 문장이어도 된다. 채우려고 없는 말을 넣지 마라.

[자료를 넘겨 읽지 마라 — 자주 나오는 과장]
- '오늘 취약 유형'은 **자주 틀린 유형**일 뿐, 틀린 문제가 전부 그 유형이라는 뜻이 아니다.
  "틀린 4문항이 모두 ○○이었다"처럼 단정하지 마라. 자료에 그렇게 적혀 있지 않다.
- 어느 단계에서 막혔는지(식 세우기·계산 실수 등)는 자료에 없다. 굳이 쓰겠다면 단정하지 말고
  "~인 것 같습니다" 처럼 짐작임이 드러나게 쓰고, 한 번만 써라.
- 자료에 없는 지난 수업·지난 단원과 견주지 마라('지난 7일 평균'이 있을 때 그 숫자만 쓴다).
- **단원 안의 세부 내용을 만들지 마라.** 자료에 '이차방정식'이라고만 적혀 있으면
  '인수분해로 푸는 문제', '근의 공식', '판별식' 같은 말은 쓸 수 없다. 적힌 이름 그대로만 쓴다.
- **틀린 문항 수를 특정 유형에 배정하지 마라.** 자료에 있는 것은 '틀린 개수'와 '자주 틀린
  유형'이지, 그 유형에서 몇 개를 틀렸는지가 아니다. "활용에서 네 개를 놓쳤다"는 지어낸 숫자다.

[지키는 선]
- 제공된 '오늘 데이터'에 없는 사실은 절대 지어내지 않는다. 없으면 안 쓰면 된다.
- 결과 문장만 출력한다. 따옴표, 머리말("선생님 한마디:"), 설명은 붙이지 않는다.`

// 오늘 어디에 초점을 둘지 — 다 훑지 말고 하나만 쓰게 하는 장치
//
// 🔴 초점은 **그 근거가 오늘 자료에 실제로 있을 때만** 고른다. (2026-07-31 명수쌤 지적)
// 전에는 일곱 가지를 날짜순으로 무조건 돌렸는데, 자료에 없는 초점이 걸리면
// (태도·속도 / 다음 시간 예고 / 집에서 도울 것) AI가 그럴듯한 말을 **지어냈다** —
// "끝까지 붙잡고 풀었어요", "다음 시간엔 ○○을 하겠습니다" 같은 문장이 근거 없이 나갔다.
// 학부모는 이걸 선생님이 본 사실로 읽으니 가장 나쁜 종류의 오류다.
// → 클라이언트가 "지금 자료로 쓸 수 있는 초점(have)"을 함께 보내고, 여기서 그 안에서만 고른다.
const ANGLES: { key: string; text: string }[] = [
  { key: 'unit', text: '오늘 다룬 단원 내용. 무엇을 배웠는지 — 자료에 적힌 범위 안에서만.' },
  { key: 'trend', text: '지난주와 견준 흐름. 오르든 내리든 그 변화 하나만.' },
  { key: 'wrong', text: '자주 틀린 유형 하나를 짚어라. (다음에 어떻게 할지는 자료에 계획이 있을 때만)' },
  { key: 'pace', text: '푸는 데 걸린 시간. 자료에 적힌 시간만 쓰고, 태도나 마음가짐은 쓰지 마라.' },
  { key: 'best', text: '오늘 제일 잘한 것 하나만. 짧고 담백하게.' },
  { key: 'next', text: '자료에 적힌 다음 학습 계획을 예고하듯 한 줄로.' },
  { key: 'home', text: '자주 틀린 그 유형을 집에서 한 번 더 봐 달라고 부탁하듯이. 그 밖의 부탁은 만들지 마라.' },
]
// have 를 안 보내는 (옛) 호출용 기본값 — 자료에서 바로 확인되는 것만. 지어내기 쉬운
// pace·next·home 은 근거를 받았을 때만 열린다.
const SAFE_KEYS = ['unit', 'trend', 'wrong', 'best']

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

/**
 * 오늘의 초점 고르기. 순수 해시로 뽑으면 며칠 걸러 같은 초점이 다시 걸린다(실제로
 * 5일 뽑아보니 이틀이 '다음 시간 예고'로 겹쳤다). 그래서 **날짜순으로 한 칸씩 밀어**
 * 고른다 — 하루 뒤든 이틀 뒤든 초점이 반드시 달라지고, 학생마다 시작점이 다르다.
 * seed 는 `학생id|YYYY-MM-DD|과목` 형식.
 */
function angleOf(seed: string, have?: unknown): string {
  const keys = Array.isArray(have) ? have.map(String) : []
  const pool = ANGLES.filter(a => (keys.length ? keys : SAFE_KEYS).includes(a.key))
  // 쓸 수 있는 초점이 하나도 없으면(자료가 거의 빈 날) 초점을 주지 않는다 —
  // 억지로 하나 골라 주면 그게 곧 지어내기가 된다.
  if (!pool.length) return '자료에 있는 사실 하나만 골라 담백하게. 없는 것은 쓰지 마라.'
  const [id = seed, date = ''] = seed.split('|')
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const day = m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : hash(date)
  return pool[(day + hash(id)) % pool.length].text
}

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

  const { mode, context, draft, seed, recent, have } = await readBody(req)
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

[오늘은 이것에 초점을 둔다] ${angleOf(s, have)}
[분량] ${pick(LENGTHS, s, 'len')}

데이터를 다 훑지 말고 위 초점 하나로만 써라.
**아래 [오늘 데이터]에 적힌 것이 전부다.** 여기 없는 일은 일어나지 않은 것으로 여기고,
쓸 말이 모자라면 짧게 끝내라. 없는 사실을 채워 넣으면 실패다.\n\n[오늘 데이터]\n${ctx}${avoid}`

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
