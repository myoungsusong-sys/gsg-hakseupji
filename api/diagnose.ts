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


// ── ❓ 문제 질문함 (같은 함수 안에 둔다 — 함수 12개 상한) ────────────────────
// 학생이 문제를 찍어 올리면 명수쌤 맥의 워커가 해설 노트 이미지를 만들어 돌려준다.
//
// 🔴 왜 서버를 거치나 — 이 경로가 아니면 «새 테이블·새 버킷»을 만들어야 하는데,
//    그러려면 Supabase 대시보드 로그인(DDL)이 필요하다. 세션이 만료돼 있고 비밀번호는
//    클로드가 다루지 않는다. 그래서 **DDL 0** 으로 간다:
//      · 행  = 기존 hj_settings 에 `qna_<질문id>` (사진이 없으니 행은 작다)
//      · 사진 = Storage 버킷 'qna' — 없으면 이 함수가 service_role 로 만든다
//    service_role 키는 **Vercel 안에만** 있고 워커·브라우저로 나가지 않는다.
// 🔴 backend.ts 의 실시간 구독은 qna_* 를 무시한다. 안 그러면 질문 하나에 전 기기가
//    9개 테이블을 다시 받아 egress 가 터진다(2026-09-02 실사고).
const QNA_BUCKET = 'qna'

function sbEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return { url, key }
}

async function sbRest(path: string, init: any = {}) {
  const { url, key } = sbEnv()
  if (!url || !key) throw new Error('서버에 Supabase 설정이 없습니다(SUPABASE_SERVICE_ROLE_KEY).')
  // 🔴 새 형식 키(sb_secret_…)는 JWT 가 아니다 — Authorization 에 넣으면 관리자 권한으로 인정되지 않을 수 있다
  //    (2026-09-22: wcfg_qna 저장이 「row-level security」 401 로 막혔다). apikey 에만 넣는다.
  //    옛 JWT 키(eyJ…)는 종전대로 둘 다 보낸다.
  const auth = key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}
  const r = await fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: key, ...auth, ...(init.headers || {}) },
  })
  return r
}

/** 버킷이 없으면 만든다 (공개 버킷 — 경로가 난수라 추측 불가. 관리앱 snapshots 와 같은 방식) */
async function qnaEnsureBucket() {
  const r = await sbRest(`/storage/v1/bucket/${QNA_BUCKET}`)
  if (r.ok) return
  await sbRest('/storage/v1/bucket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: QNA_BUCKET, name: QNA_BUCKET, public: true }),
  })
}

async function qnaUpload(path: string, b64: string, contentType: string) {
  await qnaEnsureBucket()
  const bytes = Buffer.from(b64, 'base64')
  if (bytes.length > 8 * 1024 * 1024) throw new Error('사진이 너무 큽니다(8MB 초과).')
  const r = await sbRest(`/storage/v1/object/${QNA_BUCKET}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, 'x-upsert': 'true' },
    body: bytes,
  })
  if (!r.ok) throw new Error(`업로드 실패(${r.status}) ${(await r.text()).slice(0, 120)}`)
  const { url } = sbEnv()
  return `${url}/storage/v1/object/public/${QNA_BUCKET}/${path}`
}

async function qnaRow(id: string) {
  const r = await sbRest(`/rest/v1/hj_settings?id=eq.${encodeURIComponent(id)}&select=id,data`)
  const rows = await r.json().catch(() => [])
  return Array.isArray(rows) && rows[0] ? rows[0].data?.value : null
}

async function qnaWrite(id: string, value: any) {
  const r = await sbRest('/rest/v1/hj_settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id, data: { __id: id, value }, updated_at: new Date().toISOString() }),
  })
  if (!r.ok) throw new Error(`저장 실패(${r.status}) ${(await r.text()).slice(0, 120)}`)
}

const qnaKeyOk = (k: unknown) =>
  !!process.env.QNA_WORKER_KEY && typeof k === 'string' && k === process.env.QNA_WORKER_KEY

async function handleQna(p: any, res: any) {
  const act = String(p.action || '')
  try {
    // ① 사진 올리기 — 학생의 문제 사진(shot) / 워커의 해설 이미지(answer)
    if (act === 'qna-upload') {
      const id = String(p.questionId || '')
      const kind = p.kind === 'answer' ? 'answer' : 'shot'
      if (!/^q-[\w-]{4,80}$/.test(id)) { res.status(400).json({ error: '질문 id 형식이 아닙니다.' }); return }
      if (kind === 'answer' && !qnaKeyOk(p.workerKey)) { res.status(401).json({ error: '키가 맞지 않습니다.' }); return }
      if (typeof p.b64 !== 'string' || p.b64.length < 100) { res.status(400).json({ error: '사진이 비어 있습니다.' }); return }
      const url = await qnaUpload(`${id}/${kind}.jpg`, p.b64, 'image/jpeg')
      res.status(200).json({ ok: true, url }); return
    }
    // ② 워커 — 대기 1건 집어 잠그기 (20분 넘게 만드는중이면 죽은 것으로 보고 다시 집는다)
    if (act === 'qna-take') {
      if (!qnaKeyOk(p.workerKey)) { res.status(401).json({ error: '키가 맞지 않습니다.' }); return }
      const r = await sbRest('/rest/v1/hj_settings?id=like.qna_*&select=id,data,updated_at&order=updated_at.asc&limit=200')
      const rows = await r.json().catch(() => [])
      const stale = Date.now() - 20 * 60_000
      const hit = (Array.isArray(rows) ? rows : []).find((x: any) => {
        const q = x?.data?.value
        if (!q) return false
        if (q.status === '대기') return true
        return q.status === '만드는중' && Date.parse(x.updated_at || '') < stale
      })
      if (!hit) { res.status(200).json({ ok: true, q: null }); return }
      const q = { ...hit.data.value, status: '만드는중' }
      await qnaWrite(hit.id, q)
      res.status(200).json({ ok: true, q }); return
    }
    // ③ 워커 — 완료 / 실패
    // ④ 워커 설정(지시문 틀·설정값) — 어느 맥에서든 고쳐 올리면 워커가 다음 질문부터 쓴다 (2026-09-22)
    //    행 id 'wcfg_qna' — 부팅 로드·실시간 구독에서 빠진다(backend.ts). 워커 키가 있어야 읽고 쓴다.
    if (act === 'qna-config' || act === 'qna-config-set') {
      if (!qnaKeyOk(p.workerKey)) { res.status(401).json({ error: '키가 맞지 않습니다.' }); return }
      const id = 'wcfg_qna'
      if (act === 'qna-config') { res.status(200).json({ ok: true, cfg: (await qnaRow(id)) ?? null }); return }
      const 틀 = p.cfg?.틀
      if (!틀 || typeof 틀 !== 'object' || !Object.keys(틀).length) { res.status(400).json({ error: '틀이 비어 있습니다.' }); return }
      for (const [k, v] of Object.entries(틀)) {
        if (!/^[\w가-힣.]{1,40}\.txt$/.test(k) || typeof v !== 'string' || v.length > 60_000) {
          res.status(400).json({ error: `틀 파일이 이상합니다: ${k}` }); return
        }
      }
      const 설정 = p.cfg?.설정 && typeof p.cfg.설정 === 'object' ? p.cfg.설정 : {}
      const cur = await qnaRow(id)
      const 버전 = (Number(cur?.버전) || 0) + 1
      await qnaWrite(id, { 틀, 설정, 버전, updatedAt: new Date().toISOString(), by: String(p.by || '').slice(0, 60) })
      res.status(200).json({ ok: true, 버전 }); return
    }
    // ⑤ 워커 상태 보고(박동) — 아이맥 워커가 5분마다·단계가 바뀔 때 보낸다. 어느 맥·선생님 앱에서든 본다 (2026-09-22)
    //    행 id 'wcfg_qna_beat' (부팅 로드·실시간 처리에서 빠진다). 쓰기는 워커 키, 읽기는 워커 키 또는 선생님 앱(직접 조회).
    if (act === 'qna-beat' || act === 'qna-beat-get') {
      if (!qnaKeyOk(p.workerKey)) { res.status(401).json({ error: '키가 맞지 않습니다.' }); return }
      const id = 'wcfg_qna_beat'
      if (act === 'qna-beat-get') { res.status(200).json({ ok: true, beat: (await qnaRow(id)) ?? null }); return }
      const b = p.beat && typeof p.beat === 'object' ? p.beat : {}
      if (JSON.stringify(b).length > 20_000) { res.status(400).json({ error: '상태가 너무 큽니다.' }); return }
      await qnaWrite(id, { ...b, at: new Date().toISOString() })
      res.status(200).json({ ok: true }); return
    }
    if (act === 'qna-done' || act === 'qna-fail') {
      if (!qnaKeyOk(p.workerKey)) { res.status(401).json({ error: '키가 맞지 않습니다.' }); return }
      const id = `qna_${String(p.id || '')}`
      const cur = await qnaRow(id)
      if (!cur) { res.status(404).json({ error: '그런 질문이 없습니다.' }); return }
      const q = act === 'qna-done'
        ? { ...cur, status: '완료', answerUrl: String(p.url || ''), answerText: String(p.title || ''),
            card: p.card && typeof p.card === 'object' ? p.card : undefined,
            answeredAt: new Date().toISOString(), error: undefined }
        // hold = 자동 검증을 통과하지 못한 것. 재시도가 아니라 «사람이 볼 것» 으로 돌린다.
        : { ...cur, status: p.hold ? '보류' : p.final ? '실패' : '대기',
            error: String(p.error || '').slice(0, 300), tries: (Number(cur.tries) || 0) + 1 }
      await qnaWrite(id, q)
      res.status(200).json({ ok: true }); return
    }
    res.status(400).json({ error: '모르는 동작입니다.' })
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e).slice(0, 200) })
  }
}

// ── 📱 카톡 알림 (같은 함수 안에 둔다) ─────────────────────────────────────
// ⚠️ 별도 파일(api/notify-kakao.ts)로 뒀더니 **Vercel Hobby 플랜의 서버리스 함수 12개
// 상한**을 넘어 배포가 조용히 실패했다(changelog 가 갱신되지 않아 알아챘다). 그래서
// 진단 API 안에 `action: 'notify'` 로 합쳤다. 함수를 새로 추가할 때는 개수를 먼저 세라.
//
// 방식: 카카오톡 **"나에게 보내기"**(메모 API) — 알림톡은 사업자등록+템플릿 심사, 친구에게
// 보내기는 검수가 필요하지만 이건 둘 다 없이 본인에게 보낼 수 있다.
// 필요한 환경변수: KAKAO_REST_KEY, KAKAO_REFRESH_TOKEN, (선택) KAKAO_CLIENT_SECRET
const TOKEN_URL = 'https://kauth.kakao.com/oauth/token'
const SEND_URL = 'https://kapi.kakao.com/v2/api/talk/memo/default/send'

// 텔레그램 알림 — 카톡과 달리 리프레시 토큰 만료가 없고 길이 제한도 넉넉하다.
// 🔴 별도 api 파일로 만들면 12/12 상한을 넘어 배포가 통째로 막힌다 — 여기 둔다.
//    (같은 이유로 카톡·AdminChat 도 이 파일에 합쳐져 있다)
async function sendTelegram(b: any, res: any) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    res.status(503).json({ error: '텔레그램 알림이 아직 설정되지 않았습니다(TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).' })
    return
  }
  const url = typeof b.url === 'string' && /^https?:\/\//.test(b.url) ? b.url : ''
  const text = `${String(b.title ?? '학습지앱 알림')}\n${String(b.text ?? '')}${url ? `\n${url}` : ''}`.slice(0, 3500)
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok || !j?.ok) {
      res.status(502).json({ error: '텔레그램 전송에 실패했습니다.', detail: String(j?.description ?? r.status).slice(0, 200) })
      return
    }
    res.status(200).json({ ok: true })
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message ?? e).slice(0, 200) })
  }
}

async function sendKakao(b: any, res: any) {
  const restKey = process.env.KAKAO_REST_KEY
  const refreshToken = process.env.KAKAO_REFRESH_TOKEN
  const clientSecret = process.env.KAKAO_CLIENT_SECRET
  if (!restKey || !refreshToken) {
    // 설정 전에는 조용히 꺼둔 상태 — 알림만 안 갈 뿐 보고 저장은 이미 끝났다
    res.status(503).json({ error: '카톡 알림이 아직 설정되지 않았습니다(KAKAO_REST_KEY / KAKAO_REFRESH_TOKEN).' })
    return
  }
  try {
    const form = new URLSearchParams({
      grant_type: 'refresh_token', client_id: restKey, refresh_token: refreshToken,
    })
    if (clientSecret) form.set('client_secret', clientSecret)
    const tRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: form,
    })
    const t: any = await tRes.json().catch(() => ({}))
    if (!tRes.ok || !t?.access_token) {
      res.status(502).json({
        error: '카톡 로그인 토큰이 만료됐습니다. 리프레시 토큰을 다시 발급해 주세요.',
        detail: String(t?.error_description ?? t?.error ?? tRes.status).slice(0, 200),
      })
      return
    }
    // 리프레시 토큰은 만료 1개월 미만일 때만 새로 발급된다. 새 토큰을 안전하게 저장할 곳이
    // 없어(설정 테이블은 학생 앱도 읽어간다) 저장하지 않고, 대신 카톡 본문에 경고를 붙인다.
    const leftDays = Number(t.refresh_token_expires_in ?? 0) / 86400
    const warn = leftDays > 0 && leftDays < 14 ? `⚠️ 카톡 알림 재설정 필요 (${Math.floor(leftDays)}일 남음)\n` : ''

    const url = typeof b.url === 'string' && /^https?:\/\//.test(b.url) ? b.url : 'https://gsg-hakseupji.vercel.app'
    const sRes = await fetch(SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${t.access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: new URLSearchParams({
        template_object: JSON.stringify({
          object_type: 'text',
          text: `${warn}${String(b.title ?? '학습지앱 알림')}\n${String(b.text ?? '')}`.slice(0, 190),
          link: { web_url: url, mobile_web_url: url },
          button_title: '열어보기',
        }),
      }),
    })
    const s: any = await sRes.json().catch(() => ({}))
    if (!sRes.ok) {
      res.status(502).json({ error: '카톡 전송에 실패했습니다.', detail: String(s?.msg ?? sRes.status).slice(0, 200) })
      return
    }
    res.status(200).json({ ok: true, warn: warn ? warn.trim() : undefined })
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

// ── 💬 관리자 채팅 (같은 함수 안에 둔다) ───────────────────────────────────
// 선생님이 말로 앱 데이터를 고친다. "오투 통합과학2 15쪽 8번 정답을 ~로 바꿔"
//
// ⚠️ 위 ①②와 같은 안전선을 그대로 따른다:
//  · AI 는 **정해진 4가지 작업(op)** 만 돌려준다. 임의 코드·임의 필드는 없다.
//  · 돌려준 작업은 **바로 실행되지 않는다.** 클라이언트가 "이전값 → 새값" 미리보기를 띄우고
//    선생님이 [적용]을 눌러야 실행된다(화이트리스트로 한 번 더 거른다). 되돌리기도 있다.
//  · 채점 엔진(answers.ts·mathAnswer.ts)과 소스 코드는 이 경로로 바뀌지 않는다.
const OPS = ['answer.set', 'student.update', 'config.set', 'grading.mark'] as const
const CONFIG_KEYS = [
  'showAnswer', 'showSolution', 'showVideo',
  'showAnswerBefore', 'showSolutionBefore', 'showVideoBefore',
  'dailyMasterOn', 'solveFeedback', 'aiGrade',
] as const

const CHAT_SYSTEM = `너는 학원 학습지앱의 **관리자(선생님) 비서**다. 선생님이 말로 부탁하는 일을 앱 데이터 수정 작업으로 바꿔 준다.

할 수 있는 작업은 아래 네 가지뿐이다. 이 밖의 일(코드 수정, 배포, 파일 만들기, 외부 전송)은 할 수 없다 —
그런 부탁을 받으면 ops 를 비우고 reply 로 "그건 개발 세션에서 해야 한다"고 알려라.

- answer.set — 교재 문항의 정답을 고친다. workbookId·page·label(문항 번호)·answer 가 모두 필요하다.
  answer 는 책의 정답과 해설에 적힌 문장을 **그대로** 쓴다. 지어내지 마라.
- student.update — 학생 정보를 고친다. studentId 와 patch(name·grade·klass·attendNo·school·active 중 일부).
- config.set — 학생앱 전역 설정 스위치. key 와 value(true/false).
  ⚠️ 이 설정은 학생별이 아니라 **전체 학생에게 한 번에** 적용된다. 그 사실을 reply 에 반드시 알려라.
- grading.mark — 채점 기록 하나의 ○/✕ 를 고친다. gradingId·page·label·mark('o'|'x'|'unknown').

지침:
- **모르면 묻는다.** 어느 교재인지·몇 쪽인지·어느 학생인지 확실하지 않으면 ops 를 비우고 reply 로 되물어라.
  이름이 비슷한 교재나 학생이 여럿이면 고르라고 물어라. 넘겨짚어 고치지 마라.
- 정답 내용을 **추측해서 만들어내지 마라.** 선생님이 불러 준 문장만 쓴다.
- 한 번에 여러 문항을 부탁받으면 ops 를 여러 개 만들어도 된다(최대 40개).
- reply 는 한국어 존댓말로 짧게. 무엇을 바꿀 것인지 한 줄로 요약하고, 확인이 필요하면 그것만 묻는다.
  (실제 적용은 선생님이 [적용] 버튼을 눌러야 일어난다 — "적용해 두었습니다"라고 하지 마라.)
- 목록에 없는 id 는 절대 만들어 쓰지 마라.`

const CHAT_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    ops: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: OPS as unknown as string[] },
          why: { type: 'string' },
          workbookId: { type: 'string' },
          page: { type: 'number' },
          label: { type: 'string' },
          answer: { type: 'string' },
          studentId: { type: 'string' },
          patch: {
            type: 'object',
            properties: {
              name: { type: 'string' }, grade: { type: 'string' }, klass: { type: 'string' },
              attendNo: { type: 'string' }, school: { type: 'string' }, active: { type: 'boolean' },
            },
            additionalProperties: false,
          },
          key: { type: 'string', enum: CONFIG_KEYS as unknown as string[] },
          value: { type: 'boolean' },
          gradingId: { type: 'string' },
          mark: { type: 'string', enum: ['o', 'x', 'unknown'] },
        },
        required: ['type', 'why'],
        additionalProperties: false,
      },
    },
  },
  required: ['reply', 'ops'],
  additionalProperties: false,
} as const

// 💬 채팅창을 쓸 수 있는 사람 — 이 둘만 (2026-07-30 명수쌤 지시).
// 클라이언트에서 버튼을 숨기는 것만으로는 API 직접 호출을 막지 못한다 → 여기서 세션을 검증한다.
// (src/lib/adminOps.ts 의 CHAT_ALLOWED_EMAILS 와 같은 목록을 유지할 것)
const CHAT_ALLOWED = ['annals@hanmail.net', 'azzico77@naver.com', 'azzico@naver.com']

/** 로그인 세션의 이메일이 허용 목록에 있으면 true. 실패 사유는 문자열로 돌려준다. */
async function chatCaller(req: any): Promise<{ ok: true; email: string } | { ok: false; code: number; error: string }> {
  const auth = String(req.headers?.authorization ?? '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return { ok: false, code: 401, error: '로그인 후 이용해 주세요.' }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return { ok: false, code: 503, error: '설정이 덜 되어 있습니다(SUPABASE_SERVICE_ROLE_KEY).' }
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(
      process.env.SUPABASE_URL || 'https://rttqkpquyzfrdxqhgqvi.supabase.co',
      key, { auth: { persistSession: false } },
    )
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data?.user) return { ok: false, code: 401, error: '세션이 만료되었습니다. 다시 로그인해 주세요.' }
    const email = String(data.user.email ?? '').trim().toLowerCase()
    if (!CHAT_ALLOWED.includes(email)) {
      return { ok: false, code: 403, error: '이 기능은 원장·관리자 계정만 사용할 수 있습니다.' }
    }
    return { ok: true, email }
  } catch (e: any) {
    return { ok: false, code: 502, error: String(e?.message ?? e).slice(0, 200) }
  }
}

async function adminChat(b: any, res: any, key: string) {
  const history = (Array.isArray(b.history) ? b.history : []).slice(-12)
    .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.text === 'string')
    .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: String(m.text).slice(0, 4000) }))
  if (!history.length) { res.status(400).json({ error: '메시지가 비어 있습니다.' }); return }

  // 카탈로그(교재·학생·설정 목록)는 클라이언트가 만들어 보낸다 — 정답표 수십만 문항은 보내지 않는다.
  const catalog = {
    교재: Array.isArray(b.workbooks) ? b.workbooks.slice(0, 200) : [],
    학생: Array.isArray(b.students) ? b.students.slice(0, 300) : [],
    학생앱설정: b.config ?? {},
    최근_채점기록: Array.isArray(b.gradings) ? b.gradings.slice(0, 30) : [],
    // 선생님이 "지금 이 문항" 처럼 말할 때 쓰라고, 보고 있는 화면·교재를 함께 준다
    지금_화면: String(b.route ?? '').slice(0, 200),
  }

  try {
    const client = new Anthropic({ apiKey: key })
    const msg = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: CHAT_SCHEMA as any } },
      system: `${CHAT_SYSTEM}\n\n## 지금 이 학원의 데이터 목록 (여기 있는 id 만 쓸 수 있다)\n${JSON.stringify(catalog).slice(0, 60000)}`,
      messages: history,
    })
    if (msg.stop_reason === 'refusal') { res.status(502).json({ error: 'AI가 답하지 못했습니다.' }); return }
    const text = msg.content
      .filter((x): x is Anthropic.TextBlock => x.type === 'text')
      .map(x => x.text).join('').trim()
    let out: any = null
    try { out = JSON.parse(text) } catch { out = null }
    if (!out) { res.status(502).json({ error: 'AI 응답 형식 오류' }); return }

    const ops = (Array.isArray(out.ops) ? out.ops : [])
      .filter((o: any) => (OPS as readonly string[]).includes(o?.type))
      .slice(0, 40)
    res.status(200).json({ reply: String(out.reply ?? '').slice(0, 4000), ops })
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message ?? e).slice(0, 200) })
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return }

  // 카톡 알림·관리자 채팅도 이 함수가 받는다 (함수 개수 상한 때문 — 위 주석 참고)
  const pre = await readBody(req)
  if (pre?.action === 'notify') {
    // 텔레그램 환경변수가 붙어 있으면 텔레그램으로. 없으면 예전대로 카톡.
    // → 환경변수를 지우는 것만으로 코드 수정 없이 카톡으로 되돌아간다.
    const useTg = pre.via === 'telegram' || (!pre.via && !!process.env.TELEGRAM_BOT_TOKEN)
    await (useTg ? sendTelegram(pre, res) : sendKakao(pre, res))
    return
  }
  if (typeof pre?.action === 'string' && pre.action.startsWith('qna-')) {
    await handleQna(pre, res); return
  }
  if (pre?.action === 'chat') {
    const who = await chatCaller(req)
    if (!who.ok) { res.status(who.code).json({ error: who.error }); return }
    const k = process.env.ANTHROPIC_API_KEY
    if (!k) { res.status(503).json({ error: 'AI가 아직 설정되지 않았습니다(ANTHROPIC_API_KEY).' }); return }
    await adminChat(pre, res, k); return
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) { res.status(503).json({ error: 'AI가 아직 설정되지 않았습니다(ANTHROPIC_API_KEY).' }); return }

  const b = pre
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
