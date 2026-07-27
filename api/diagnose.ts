// 🛠 화면 오류 AI 점검 — Vercel 서버리스 (Node), Claude
//
// 학생·선생님이 "화면이 이상해요"를 누르면 그 순간의 상태(경로·직전 오류·화면 이동 기록·
// 저장 공간)를 받아 **원인을 찾고, 브라우저에서 고칠 수 있는 조치를 고른다.**
//
// ⚠️ 두 가지 안전선 (이 파일의 존재 이유이자 한계):
//  ① AI는 **코드를 고치지 않는다.** 배포된 앱의 소스는 git 에 있고, 검토 없이 채점앱 코드를
//     바꿔 배포하면 100%로 맞춰둔 채점 엔진이 조용히 깨질 수 있다. 코드 수정이 필요한
//     문제는 `report`(개발자용 보고서)로 넘기고 끝낸다 — 고치는 건 사람이 한다.
//  ② AI가 돌려주는 조치는 **정해진 목록(enum)에서 고르기만** 한다. 임의의 JS 를 돌려받아
//     실행하는 경로는 만들지 않는다(클라이언트에서도 화이트리스트로 한 번 더 막는다).
//
// 개인정보: 학생 이름·답안·문제 내용은 받지 않는다. 경로·오류 메시지·저장 키 이름뿐이다.
import Anthropic from '@anthropic-ai/sdk'

const ACTIONS = ['reload', 'hard_reload', 'go_home', 'relogin', 'free_space', 'none'] as const

const SYSTEM = `너는 학원 학습지앱(React SPA, 해시 라우팅, Supabase 동기화)의 화면 문제를 봐주는 기술 지원이다.
학생 또는 선생님이 "화면이 이상하다"고 눌렀을 때의 상태를 받아, 원인을 짚고 지금 브라우저에서 할 수 있는 조치를 고른다.

고를 수 있는 조치는 아래 여섯 가지뿐이다. 다른 것은 만들어내지 마라. 코드를 쓰지도 마라.
- reload: 그냥 새로고침. 동기화가 덜 됐거나 일시적으로 화면이 빈 경우.
- hard_reload: 캐시와 서비스워커를 지우고 새로고침. 배포 직후 옛 화면이 남아 깨진 경우.
- go_home: 첫 화면으로 이동. 막다른 화면이나 엉뚱한 화면으로 튕긴 경우.
- relogin: 로그인 정보를 지우고 다시 로그인. 명부를 못 읽거나 내 정보가 안 뜨는 경우.
- free_space: 저장 공간이 꽉 차 화면이 깨진 경우에만. (핵심 학습 데이터는 지우지 않는다)
- none: 브라우저에서 고칠 수 없음. 코드를 고쳐야 하는 문제.

판단 지침:
- 저장 공간(storage)이 4500KB를 넘고 화면이 안 뜬다면 쿼터 초과를 강하게 의심하라.
- 화면 이동 기록(routeHistory)에 사용자가 누르지 않았을 법한 이동이 있으면 그것을 원인 후보로 짚어라.
- 오류가 하나도 없고 저장 공간도 여유로우면 섣불리 조치하지 말고 reload 하나만 권하거나 none 으로 둬라.
- **확실하지 않으면 none 이 낫다.** 멀쩡한 상태를 건드리는 것보다 사람에게 넘기는 편이 안전하다.

출력 규칙:
- cause: 원인 추정을 한국어 1~2문장. 모르면 모른다고 써라.
- userMessage: 화면에 그대로 보여줄 안내. **중학생도 이해할 쉬운 말**, 2문장 이내, 존댓말.
  기술 용어(캐시, 쿼터, 라우팅) 대신 "저장 공간이 꽉 찼어요" 처럼 풀어 써라.
- actions: 실행 순서대로 최대 2개. 각각 why 는 한 문장.
- fixable: actions 로 해결될 것 같으면 true, 코드 수정이 필요하면 false.
- report: 명수쌤(개발자)이 볼 보고서. 증상·원인 가설·재현 단서·어느 파일/화면을 볼지. 한국어.`

const SCHEMA = {
  type: 'object',
  properties: {
    cause: { type: 'string' },
    userMessage: { type: 'string' },
    fixable: { type: 'boolean' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ACTIONS as unknown as string[] },
          why: { type: 'string' },
        },
        required: ['type', 'why'],
        additionalProperties: false,
      },
    },
    report: { type: 'string' },
  },
  required: ['cause', 'userMessage', 'fixable', 'actions', 'report'],
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

  const b = await readBody(req)
  const snap = {
    앱: b.app === 'teacher' ? '선생님 화면' : '학생앱',
    현재_주소: String(b.route ?? '').slice(0, 200),
    화면_이동_기록: Array.isArray(b.routeHistory) ? b.routeHistory.slice(-10) : [],
    직전_오류: Array.isArray(b.errors) ? b.errors.slice(-12) : [],
    저장공간_KB: Number(b.storageKB ?? 0),
    큰_저장항목: Array.isArray(b.storageItems) ? b.storageItems.slice(0, 8) : [],
    앱버전: String(b.appVersion ?? '').slice(0, 40),
    온라인: !!b.online,
    동기화됨: b.synced === undefined ? null : !!b.synced,
    브라우저: String(b.ua ?? '').slice(0, 200),
    사용자가_쓴_증상: String(b.note ?? '').slice(0, 500),
  }

  try {
    const client = new Anthropic({ apiKey: key })
    const msg = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA as any } },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `아래는 "화면이 이상하다"를 누른 순간의 상태다. 원인을 찾고 조치를 골라라.\n\n${JSON.stringify(snap, null, 1).slice(0, 12000)}`,
      }],
    })
    if (msg.stop_reason === 'refusal') { res.status(502).json({ error: 'AI가 점검하지 못했습니다.' }); return }

    const text = msg.content
      .filter((x): x is Anthropic.TextBlock => x.type === 'text')
      .map(x => x.text).join('').trim()
    let out: any = null
    try { out = JSON.parse(text) } catch { out = null }
    if (!out) { res.status(502).json({ error: 'AI 응답 형식 오류' }); return }

    // 조치는 허용 목록만 통과시킨다 (서버에서 한 번, 클라이언트에서 또 한 번)
    const actions = (Array.isArray(out.actions) ? out.actions : [])
      .filter((a: any) => (ACTIONS as readonly string[]).includes(a?.type))
      .slice(0, 2)
      .map((a: any) => ({ type: a.type, why: String(a.why ?? '').slice(0, 200) }))

    res.status(200).json({
      cause: String(out.cause ?? '').slice(0, 600),
      userMessage: String(out.userMessage ?? '').slice(0, 400),
      fixable: !!out.fixable && actions.some((a: any) => a.type !== 'none'),
      actions,
      report: String(out.report ?? '').slice(0, 3000),
    })
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message ?? e).slice(0, 200) })
  }
}
