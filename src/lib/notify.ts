// 카톡 알림 보내기 (클라이언트 쪽) — /api/notify-kakao 호출
//
// 알림은 **보고 저장을 방해하면 안 된다.** 실패해도 조용히 넘기고, 보고는 이미 클라우드에
// 저장돼 선생님 화면 보고함에 남는다. 알림은 "빨리 알아채게" 하는 보조 수단일 뿐이다.

const SENT_KEY = 'gsg-kakao-sent'

export type NotifyResult = { ok: boolean; error?: string; warn?: string }

/**
 * 같은 문제로 카톡이 도배되는 걸 막는다 — 같은 열쇠(보통 화면+원인)로는 지정 시간 안에 한 번만.
 * 학생 여럿이 같은 오류를 만나면 알림이 수십 개 올 수 있어서 필요하다.
 */
export function shouldNotify(key: string, minutes = 30): boolean {
  try {
    const raw = localStorage.getItem(SENT_KEY)
    const map: Record<string, number> = raw ? JSON.parse(raw) : {}
    const now = Date.now()
    // 오래된 기록은 버린다
    for (const k of Object.keys(map)) if (now - map[k] > 24 * 3600_000) delete map[k]
    if (map[key] && now - map[key] < minutes * 60_000) return false
    map[key] = now
    localStorage.setItem(SENT_KEY, JSON.stringify(map))
    return true
  } catch {
    return true       // 저장을 못 해도 알림은 보내는 편이 낫다
  }
}

export async function notifyKakao(a: { title: string; text: string; url?: string }): Promise<NotifyResult> {
  try {
    const res = await fetch('/api/notify-kakao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(a),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: String(j?.error ?? `전송 실패 (${res.status})`) }
    return { ok: true, warn: j?.warn }
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) }
  }
}
