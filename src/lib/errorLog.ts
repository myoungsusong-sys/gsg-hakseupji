// 화면에서 일어난 일 기록 — 🛠 AI 점검이 원인을 찾을 때 쓰는 재료 (2026-07-28 명수쌤 지시)
//
// 학생·선생님이 "화면이 이상해요"를 눌렀을 때, 그 순간의 상태만 봐서는 원인을 알 수 없다.
// 직전에 무슨 오류가 났는지, **어느 화면에서 어느 화면으로 튕겼는지**가 있어야 한다.
// (11차부터 못 잡고 있는 "채점판이 /manage 로 튕김"이 바로 그 순간 주소를 못 받아서였다)
//
// 개인정보는 담지 않는다 — 오류 메시지와 경로만 남기고 학생 이름·답안은 넣지 않는다.

export type LoggedError = { at: string; kind: 'error' | 'promise' | 'console'; msg: string; where?: string }
export type RouteHop = { at: string; from: string; to: string }

const MAX = 30
const errors: LoggedError[] = []
const hops: RouteHop[] = []
let installed = false

function push<T>(arr: T[], v: T) { arr.push(v); if (arr.length > MAX) arr.shift() }
const now = () => new Date().toISOString()
const clip = (s: unknown, n = 300) => String(s ?? '').slice(0, n)

/** 앱 시작 시 한 번 — 전역 오류와 화면 이동을 기록하기 시작한다 */
export function installErrorLog() {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', e => {
    push(errors, {
      at: now(), kind: 'error',
      msg: clip(e.message),
      where: clip(`${e.filename ?? ''}:${e.lineno ?? ''}`, 120),
    })
  })

  window.addEventListener('unhandledrejection', e => {
    const r: any = (e as PromiseRejectionEvent).reason
    push(errors, { at: now(), kind: 'promise', msg: clip(r?.message ?? r) })
  })

  // console.error 도 남긴다 — React 렌더 경고·네트워크 실패가 여기로 많이 나온다
  const orig = console.error
  console.error = (...args: unknown[]) => {
    push(errors, { at: now(), kind: 'console', msg: clip(args.map(a => (a instanceof Error ? a.message : String(a))).join(' ')) })
    orig.apply(console, args as [])
  }

  // 화면 이동 기록 — 저절로 튕기는 문제의 유일한 단서
  let last = location.hash || '#/'
  const mark = () => {
    const to = location.hash || '#/'
    if (to !== last) { push(hops, { at: now(), from: last, to }); last = to }
  }
  window.addEventListener('hashchange', mark)
  window.addEventListener('popstate', mark)
  // pushState/replaceState 로 바뀌는 것도 잡는다 (react-router 가 쓴다)
  for (const m of ['pushState', 'replaceState'] as const) {
    const fn = history[m]
    history[m] = function (this: History, ...a: unknown[]) {
      const r = (fn as any).apply(this, a)
      setTimeout(mark, 0)
      return r
    } as typeof history[typeof m]
  }
}

export function recentErrors(n = 12): LoggedError[] { return errors.slice(-n) }
export function recentHops(n = 10): RouteHop[] { return hops.slice(-n) }

/** localStorage 사용량 — 쿼터 초과는 "화면이 안 뜬다"의 흔한 원인이라 따로 잰다 */
export function storageUsage(): { totalKB: number; items: { key: string; kb: number }[] } {
  const items: { key: string; kb: number }[] = []
  let total = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      const kb = Math.round(((localStorage.getItem(k)?.length ?? 0) * 2) / 1024)
      total += kb
      items.push({ key: k, kb })
    }
  } catch { /* 접근 불가 브라우저 */ }
  items.sort((a, b) => b.kb - a.kb)
  return { totalKB: total, items: items.slice(0, 8) }
}
