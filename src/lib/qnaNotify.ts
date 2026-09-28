// ── 📬 질문함 해설 도착 알림 (2026-09-28) ─────────────────────────────────────
//
// 🔴 명수쌤 2026-09-28: "학생 질문 도착 알림을 넣어서 바로 확인할 수 있게 해줘"
//
// 두 갈래다.
//  ① 푸시 — 질문을 보낼 때 이 기기를 구독해 질문 줄(q.push)에 싣는다. 워커가 해설을 올리는 순간
//     서버(qna-done)가 이 기기로 바로 보낸다 → 앱을 닫아 둬도 폰 알림이 온다.
//     · 아이폰은 사파리 «홈 화면에 추가» 로 연 앱에서만 된다(iOS 16.4+). 그 밖의 사파리 탭은 ②만.
//     · 관리앱(프리미엄) 화면 안 틀(iframe)에서는 브라우저가 알림 권한을 막는다 → 관리앱이 따로 표시한다.
//  ② 앱 안 — 앱이 열려 있으면 상단 배너·질문함 빨간 숫자·딩동 소리·진동(useQnaArrivals).
//     탭이 뒤로 가 있으면 시스템 알림으로도 띄운다(권한이 있을 때).

const SW = '/sw-qna.js'

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const isIOS = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)
export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true)
const inFrame = () => { try { return window.self !== window.top } catch { return true } }

function b64ToU8(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}
const u8eq = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i])

/** 이 기기에서 푸시를 켤 수 있나 — 못 켜면 그 이유(학생에게 보여 줄 말) */
export function pushBlocker(): string | null {
  if (inFrame()) return null            // 틀 안: 조용히 건너뛴다(관리앱이 따로 알린다)
  if (!pushSupported()) {
    return isIOS() && !isStandalone()
      ? '아이폰은 사파리 [공유] → [홈 화면에 추가] 로 설치한 앱에서 알림을 받을 수 있어요.'
      : '이 브라우저는 폰 알림을 지원하지 않아요. 앱을 열어 두면 화면에 알려 드려요.'
  }
  if (Notification.permission === 'denied') return '알림이 꺼져 있어요. 브라우저 설정에서 이 사이트 알림을 허용해 주세요.'
  return null
}

/**
 * 질문을 보낼 때 부른다(버튼 누름 안에서 — 권한 창은 사용자 동작 안에서만 뜬다).
 * 구독 JSON 을 돌려준다. 못 하면 undefined — 질문 보내기는 절대 막지 않는다.
 */
export async function subscribeForAnswer(): Promise<PushSubscriptionJSON | undefined> {
  if (inFrame() || !pushSupported()) return undefined
  try {
    const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
    if (perm !== 'granted') return undefined
    const reg = await navigator.serviceWorker.register(SW)
    await navigator.serviceWorker.ready
    const r = await fetch('/api/diagnose', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'qna-pushkey' }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || !j.key) return undefined
    const key = b64ToU8(String(j.key))
    let sub = await reg.pushManager.getSubscription()
    // 서버 키가 바뀌었으면(서비스 키 교체) 옛 구독은 못 쓴다 → 새로
    const old = sub?.options?.applicationServerKey
    if (sub && old && !u8eq(new Uint8Array(old), key)) { await sub.unsubscribe().catch(() => {}); sub = null }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key as BufferSource })
    return sub.toJSON()
  } catch (e) {
    console.warn('[질문함 알림] 구독 실패', (e as Error)?.message)
    return undefined
  }
}

// ── 앱 안 알림 ─────────────────────────────────────────────

/** 딩동 — 짧은 두 음. 소리가 막힌 기기(사용자 동작 전)에서는 조용히 넘어간다 */
export function ding(): void {
  try {
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined
    if (!AC) return
    const ctx = new AC()
    const tone = (f: number, t0: number) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'sine'; o.frequency.value = f
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t0)
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t0 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + 0.35)
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + 0.4)
    }
    tone(880, 0); tone(1320, 0.18)
    setTimeout(() => { void ctx.close().catch(() => {}) }, 1200)
  } catch { /* 무시 */ }
}

let 원제목: string | null = null
/** 탭 제목을 「🔔 해설 도착」 으로 — 다시 볼 때 원래대로 */
function 제목깜빡(n: number) {
  if (typeof document === 'undefined') return
  if (원제목 === null) 원제목 = document.title
  document.title = `🔔 해설 도착${n > 1 ? ` ${n}` : ''} · ${원제목}`
  const back = () => {
    if (document.visibilityState !== 'visible') return
    if (원제목 !== null) document.title = 원제목
    원제목 = null
    document.removeEventListener('visibilitychange', back)
  }
  document.addEventListener('visibilitychange', back)
  back()
}

/** 방금 해설이 도착했다(앱이 열려 있는 동안 상태가 완료로 바뀜) */
export async function announceArrival(n: number, 요약: string): Promise<void> {
  ding()
  try { navigator.vibrate?.([180, 80, 180]) } catch { /* 무시 */ }
  제목깜빡(n)
  // 탭이 뒤에 있으면 시스템 알림도 — 푸시가 이미 떴을 수 있어 같은 tag 로 덮는다
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible' && pushSupported()
      && Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW)
      await reg?.showNotification('📬 질문한 문제 해설이 도착했어요', {
        body: `${요약}\n눌러서 바로 확인하세요`, icon: '/apple-touch-icon.png', tag: 'qna-arrival',
        data: { url: '/#/student/questions' },
      })
    } catch { /* 무시 */ }
  }
}
