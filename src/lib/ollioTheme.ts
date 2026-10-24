/**
 * 올리오 셸(관리형학습관 학생 태블릿) iframe 테마 수신 — 2026-10-24
 *
 *  · 진입 주소 `?theme=ollio&embed=1` 은 index.html 의 작은 스크립트가 React 전에 html 속성으로 건다(첫 렌더부터 올리오 색).
 *  · 셸이 iframe load 뒤 postMessage `{type:'ollio:theme', v:1, version, tokens:{…12}, radius:{card,button}}` 를 보낸다.
 *    여기서 origin 허용 목록을 확인하고 CSS 변수를 덮어쓴 뒤 `{type:'ollio:theme-applied', v:1, version}` 으로 답한다.
 *  · 토큰 이름 ↔ CSS 변수 대응은 src/index.css 맨 아래 «올리오 테마» 블록과 같다. 값은 #rrggbb 만 받는다(스타일 주입 방지).
 *  · 단독 화면(iframe 밖, 플래그 없음)에서는 아무것도 하지 않는다.
 */
const ALLOWED_ORIGINS = [
  'https://app.ollio.kr',
  'https://daechisparta.vercel.app',
  'https://fokus-academy-daechi1.vercel.app',
]
const isDevOrigin = (o: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)
const HEX = /^#[0-9a-f]{6}$/i

type Tokens = Partial<Record<'bg' | 'card' | 'line' | 'text' | 'muted' | 'green' | 'deep' | 'lime' | 'amber' | 'red' | 'fontBody' | 'fontHead', string>>
const VAR: Record<keyof Tokens, string[]> = {
  bg: ['--color-paper2'], card: ['--color-paper'], line: ['--color-line', '--color-pine-border'],
  text: ['--color-ink'], muted: ['--color-ink2', '--color-ink3'], green: ['--color-pine'], deep: ['--color-pine-dark'],
  lime: ['--color-pine-soft'], amber: ['--color-amber'], red: ['--color-clay'],
  fontBody: ['--ollio-font-body'], fontHead: ['--ollio-font-head'],
}

export function applyOllioTokens(tokens: Tokens, radius?: { card?: number; button?: number }) {
  const el = document.documentElement
  el.setAttribute('data-theme', 'ollio')
  for (const k of Object.keys(VAR) as (keyof Tokens)[]) {
    const v = tokens[k]
    if (!v) continue
    const isFont = k === 'fontBody' || k === 'fontHead'
    if (!isFont && !HEX.test(v)) continue
    if (isFont && !/^[\w\s가-힣-]{1,40}$/.test(v)) continue
    for (const name of VAR[k]) el.style.setProperty(name, isFont ? `"${v}"` : v)
  }
  if (radius?.button) el.style.setProperty('--radius-mf', `${Math.max(0, Math.min(12, radius.button))}px`)
}

export function installOllioTheme() {
  if (typeof window === 'undefined') return
  window.addEventListener('message', (e: MessageEvent) => {
    const d = e.data as { type?: string; v?: number; version?: number; tokens?: Tokens; radius?: { card?: number; button?: number } } | null
    if (!d || d.type !== 'ollio:theme' || d.v !== 1) return
    if (!ALLOWED_ORIGINS.includes(e.origin) && !isDevOrigin(e.origin)) return
    if (window.parent === window) return               // iframe 밖에서는 받지 않는다
    applyOllioTokens(d.tokens ?? {}, d.radius)
    try { (e.source as Window | null)?.postMessage({ type: 'ollio:theme-applied', v: 1, version: d.version ?? 1 }, e.origin) } catch { /* 무시 */ }
  })
}
