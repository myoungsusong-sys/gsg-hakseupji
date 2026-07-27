// 카톡 알림 — Vercel 서버리스 (Node). 오류 보고가 오면 명수쌤 카톡으로 보낸다.
//
// 방식: 카카오톡 **"나에게 보내기"**(메모 API). 이걸 고른 이유 —
//   · 알림톡(비즈메시지)은 사업자등록 + 채널 + 템플릿 심사 + 대행사 계약이 필요하다.
//   · "친구에게 보내기"는 별도 검수가 필요하다.
//   · "나에게 보내기"는 **심사도 사업자등록도 없이** 본인에게 보낼 수 있다 — 지금 필요한 건
//     명수쌤 본인 알림이므로 이걸로 충분하다.
//
// 필요한 환경변수 (Vercel):
//   KAKAO_REST_KEY        — 카카오 개발자 앱의 REST API 키
//   KAKAO_REFRESH_TOKEN   — 최초 1회 발급받은 리프레시 토큰
//   KAKAO_CLIENT_SECRET   — (앱에서 client_secret 을 켠 경우에만)
// 셋 중 앞의 둘이 없으면 이 API 는 조용히 꺼진 상태로 동작한다(알림만 안 갈 뿐 보고는 저장됨).
//
// ⚠️ 리프레시 토큰은 **만료 1개월 미만일 때만** 새로 발급된다. 서버가 그 새 토큰을 저장할
// 안전한 곳이 없어(설정 테이블은 학생 앱도 읽어간다) 저장하지 않는다. 대신 남은 기간이
// 14일 아래로 내려가면 **알림 맨 앞에 재발급 안내를 붙여** 명수쌤이 카톡에서 바로 보게 한다.

const TOKEN_URL = 'https://kauth.kakao.com/oauth/token'
const SEND_URL = 'https://kapi.kakao.com/v2/api/talk/memo/default/send'

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

  const restKey = process.env.KAKAO_REST_KEY
  const refreshToken = process.env.KAKAO_REFRESH_TOKEN
  const clientSecret = process.env.KAKAO_CLIENT_SECRET
  if (!restKey || !refreshToken) {
    // 설정 전에는 조용히 꺼둔다 — 보고 저장은 이미 끝났고, 알림만 안 갈 뿐이다
    res.status(503).json({ error: '카톡 알림이 아직 설정되지 않았습니다(KAKAO_REST_KEY / KAKAO_REFRESH_TOKEN).' })
    return
  }

  const { title, text, url } = await readBody(req)

  try {
    // 1) 리프레시 토큰 → 액세스 토큰
    const tokenBody = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: restKey,
      refresh_token: refreshToken,
    })
    if (clientSecret) tokenBody.set('client_secret', clientSecret)

    const tRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: tokenBody,
    })
    const tJson: any = await tRes.json().catch(() => ({}))
    if (!tRes.ok || !tJson?.access_token) {
      res.status(502).json({
        error: '카톡 로그인 토큰이 만료됐습니다. 리프레시 토큰을 다시 발급해 주세요.',
        detail: String(tJson?.error_description ?? tJson?.error ?? tRes.status).slice(0, 200),
      })
      return
    }

    // 남은 기간이 짧으면 본문 맨 앞에 재발급 안내를 붙인다 (놓치면 어느 날 알림이 멈춘다)
    const leftDays = Number(tJson.refresh_token_expires_in ?? 0) / 86400
    const warn = leftDays > 0 && leftDays < 14
      ? `⚠️ 카톡 알림 재설정 필요 (${Math.floor(leftDays)}일 남음)\n`
      : ''

    // 2) 나에게 보내기 — text 는 200자 제한이라 넉넉히 잘라 보낸다
    const body =
      `${warn}${String(title ?? '학습지앱 알림')}\n${String(text ?? '')}`.slice(0, 190)
    const link = url && /^https?:\/\//.test(String(url))
      ? { web_url: String(url), mobile_web_url: String(url) }
      : { web_url: 'https://gsg-hakseupji.vercel.app', mobile_web_url: 'https://gsg-hakseupji.vercel.app' }

    const sendBody = new URLSearchParams({
      template_object: JSON.stringify({
        object_type: 'text',
        text: body,
        link,
        button_title: '열어보기',
      }),
    })

    const sRes = await fetch(SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tJson.access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: sendBody,
    })
    const sJson: any = await sRes.json().catch(() => ({}))
    if (!sRes.ok) {
      res.status(502).json({
        error: '카톡 전송에 실패했습니다.',
        detail: String(sJson?.msg ?? sJson?.error_description ?? sRes.status).slice(0, 200),
      })
      return
    }

    res.status(200).json({ ok: true, warn: warn ? warn.trim() : undefined })
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message ?? e).slice(0, 200) })
  }
}
