// 영어 외부 지문 → 변형 문제 · 단어장 · 문장 드릴 (2026-11-07)
// 선생님이 붙여 넣은 영어 지문 하나로
//   mode 'exercise' : 고른 유형(어법·어휘·빈칸·순서·삽입·요약·주제·제목·서술형 영작/배열/고치기 …)의 변형 문제
//   mode 'words'    : 핵심 단어장(단어·품사·뜻·지문 속 예문)
//   mode 'drill'    : 문장 단위 해석 짝(영어 문장 · 우리말 해석) — 해석 쓰기·배열·빈칸 시험지는 화면이 만든다
// 정확성 최우선: 정답이 하나로만 맞도록, 지문에 없는 사실을 지어내지 않도록 한다.
import Anthropic from '@anthropic-ai/sdk'

export const EXERCISE_TYPES = [
  '주제', '제목', '요지', '글의 목적', '심경 변화', '내용 일치', '빈칸 추론', '어법(틀린 것)', '어법(옳은 것)',
  '어휘 쓰임', '순서 배열', '문장 삽입', '무관한 문장', '문단 요약', '지칭 추론', '영영 풀이',
  '서술형/영작', '서술형/순서 배열', '서술형/틀린 부분 고치기', '서술형/빈칸 채우기', '서술형/요약문 완성',
] as const

function readBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  return new Promise(resolve => {
    let data = ''
    req.on('data', (c: any) => { data += c })
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) } })
  })
}

const SYS_EX = `너는 한국 중·고등 영어 내신·수능 문제를 만드는 출제위원이다. 선생님이 준 영어 지문 하나로 변형 문제를 만든다.
원칙:
- 지문 내용만 근거로 한다. 지문에 없는 사실을 지어내지 않는다.
- 객관식은 선택지 5개(①~⑤ 표기 없이 글만), 정답은 반드시 하나. 오답 선택지도 그럴듯하게.
- 어법·어휘 유형은 지문을 그대로 옮기고 해당 자리 5곳에 (A)~(E) 대신 ①~⑤ 밑줄 표시를 「①[word]」 처럼 쓴다.
- 순서 배열·문장 삽입은 지문을 (A)(B)(C) 단락 또는 ( ① )~( ⑤ ) 자리로 나눠 실제로 풀 수 있게 만든다.
- 서술형은 kind 를 "서술형" 으로, 모범답안을 answer 에, 채점 기준을 solution 에 쓴다.
- 발문(지시문)은 한국 시험지 말투로 쓴다. 예: "다음 글의 주제로 가장 적절한 것은?"
- 해설(solution)은 우리말 2~4문장. 정답 근거가 되는 지문 속 문장을 짚는다.
- 반드시 아래 JSON 하나로만 답한다(설명·코드블록 없이):
{"problems":[{"type":"유형 이름","kind":"객관식" 또는 "서술형","body":"발문\\n\\n(지문 또는 변형된 지문)","choices":["…","…","…","…","…"],"answer":"객관식은 1~5 숫자, 서술형은 모범답안","solution":"해설"}]}`

const SYS_WORDS = `너는 한국 중·고등 영어 선생님이다. 선생님이 준 영어 지문에서 학생이 꼭 알아야 할 단어·숙어를 뽑아 단어장을 만든다.
- 너무 쉬운 기초 단어(the, is, go 등)는 빼고, 지문 이해에 중요한 단어 위주로 고른다.
- meaning 은 이 지문에서 쓰인 뜻을 우리말로 짧게(여러 뜻이면 이 지문 뜻을 앞에).
- example 은 그 단어가 들어간 지문 속 문장을 그대로 옮긴다.
- 반드시 아래 JSON 하나로만 답한다:
{"words":[{"word":"…","pos":"n./v./adj./adv./phr. 등","meaning":"…","example":"…"}]}`

const SYS_DRILL = `너는 한국 중·고등 영어 선생님이다. 선생님이 준 영어 지문을 문장 단위로 나누고 각 문장의 자연스러운 우리말 해석을 붙인다.
- 지문의 문장을 하나도 빠뜨리지 말고 순서대로, 영어 문장은 원문 그대로 옮긴다.
- 해석은 학생이 보고 영작할 수 있게 직역에 가깝되 자연스러운 우리말로.
- key 에는 그 문장에서 시험에 잘 나오는 핵심 어구(빈칸으로 뚫을 곳) 1~2개를 원문 그대로 적는다.
- 반드시 아래 JSON 하나로만 답한다:
{"sentences":[{"en":"…","ko":"…","key":["…"]}]}`

function firstJson(text: string): any {
  const s = text.indexOf('{'), e = text.lastIndexOf('}')
  if (s < 0 || e < s) throw new Error('JSON 없음')
  return JSON.parse(text.slice(s, e + 1))
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return }
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) { res.status(503).json({ error: 'AI가 아직 설정되지 않았습니다(ANTHROPIC_API_KEY).' }); return }
  const { mode, passage, types, perType, level, wordCount } = await readBody(req)
  const text = String(passage || '').trim()
  if (text.length < 80) { res.status(400).json({ error: '지문이 너무 짧아요. 여섯 문장 이상 넣어 주세요.' }); return }
  if (text.length > 6000) { res.status(400).json({ error: '지문이 너무 길어요(6,000자까지).' }); return }

  let system = SYS_EX, ask = '', maxTokens = 8000
  if (mode === 'words') {
    system = SYS_WORDS
    ask = `[수준] ${level || '고1'}\n[뽑을 단어 수] ${Math.max(5, Math.min(40, Number(wordCount) || 20))}개\n\n[지문]\n${text}`
    maxTokens = 4000
  } else if (mode === 'drill') {
    system = SYS_DRILL
    ask = `[지문]\n${text}`
    maxTokens = 6000
  } else {
    const ok = (Array.isArray(types) ? types : []).map(String).filter((t: string) => (EXERCISE_TYPES as readonly string[]).includes(t))
    if (!ok.length) { res.status(400).json({ error: '만들 유형을 하나 이상 고르세요.' }); return }
    const n = Math.max(1, Math.min(3, Number(perType) || 1))
    ask = `[수준] ${level || '고1'}\n[만들 유형과 문항 수] ${ok.map(t => `${t} ${n}문항`).join(', ')}\n\n[지문]\n${text}`
    maxTokens = Math.min(16000, 1200 * ok.length * n + 1000)
  }

  try {
    const client = new Anthropic({ apiKey: key })
    const msg = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: ask }],
    })
    const out = msg.content.map((c: any) => (c.type === 'text' ? c.text : '')).join('')
    res.status(200).json(firstJson(out))
  } catch (e: any) {
    res.status(500).json({ error: 'AI 생성에 실패했어요. 잠시 뒤 다시 눌러 주세요. (' + String(e?.message || e).slice(0, 120) + ')' })
  }
}
