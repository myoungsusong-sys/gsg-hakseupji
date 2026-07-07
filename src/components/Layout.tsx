import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { SUPABASE_ON } from '../lib/supabase'

// 새 배포 감지 — 탭을 오래 열어두면 옛 번들이 계속 도는 문제 방지
function useUpdateCheck(): boolean {
  const [stale, setStale] = useState(false)
  useEffect(() => {
    const current = [...document.querySelectorAll('script[src]')]
      .map(s => (s as HTMLScriptElement).src)
      .find(s => s.includes('/assets/index-'))
    if (!current) return
    let alive = true
    async function check() {
      try {
        const r = await fetch('/?u=' + Date.now(), { cache: 'no-store' })
        const html = await r.text()
        const served = html.match(/\/assets\/index-[\w-]+\.js/)?.[0]
        if (alive && served && !current!.endsWith(served)) setStale(true)
      } catch { /* 오프라인 등은 무시 */ }
    }
    const t = setInterval(check, 3 * 60 * 1000)
    check()
    return () => { alive = false; clearInterval(t) }
  }, [])
  return stale
}

const topTab = ({ isActive }: { isActive: boolean }) =>
  `px-4 py-2 rounded-full text-[15px] font-bold transition ${
    isActive ? 'text-pine-dark' : 'text-ink2 hover:text-ink'
  }`

// 매쓰플랫 헤더 구성 동일: 로고 | 수업 준비·수업·관리 | (우측) 내신관 · 알림 · 학원명
export default function Layout() {
  const nav = useNavigate()
  const { email, signOut } = useAuth()
  const [bell, setBell] = useState(false)
  const [acct, setAcct] = useState(false)
  const stale = useUpdateCheck()
  return (
    <div className="min-h-screen">
      {stale && (
        <div className="no-print sticky top-0 z-40 flex items-center justify-center gap-3 bg-amber px-4 py-2 text-sm font-bold text-white">
          새 버전이 배포되었습니다 — 새로고침하면 최신 기능이 적용됩니다.
          <button onClick={() => location.reload()}
            className="rounded-lg bg-white/20 px-3 py-1 hover:bg-white/30">지금 새로고침</button>
        </div>
      )}
      <header className="no-print sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3">
          <button onClick={() => nav('/')} className="flex items-baseline gap-2">
            <span className="text-xl font-black tracking-tight text-pine-dark">깊은생각</span>
            <span className="text-xl font-light text-ink">학습지</span>
          </button>
          <nav className="flex gap-1">
            <NavLink to="/prep/worksheet" className={topTab}>수업 준비</NavLink>
            <NavLink to="/lesson" className={topTab}>수업</NavLink>
            <NavLink to="/manage" className={topTab}>관리</NavLink>
          </nav>
          <div className="grow" />
          <button onClick={() => nav('/prep/school-exam')}
            className="rounded-full bg-amber px-4 py-1.5 text-sm font-bold text-white shadow-sm transition hover:brightness-105">
            내신관
          </button>
          <button onClick={() => { setBell(v => !v); setAcct(false) }} title="알림"
            className="rounded-full px-2 py-1.5 text-lg hover:bg-paper2">🔔</button>
          <div className="relative">
            <button onClick={() => { setAcct(v => !v); setBell(false) }}
              className="rounded-lg px-3 py-1.5 text-sm font-bold hover:bg-paper2">깊은생각수학</button>
            {acct && (
              <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-line bg-white p-3 shadow-lg">
                {SUPABASE_ON && email && <div className="mb-2 truncate px-1 text-xs text-ink2">{email}</div>}
                <button onClick={() => signOut()}
                  className="w-full rounded-lg border border-line px-3 py-1.5 text-sm hover:border-clay hover:text-clay">로그아웃</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 알림센터 (매쓰플랫: 우측 슬라이드 패널) */}
      {bell && (
        <div className="no-print fixed inset-0 z-30" onClick={() => setBell(false)}>
          <div className="absolute right-0 top-0 h-full w-80 border-l border-line bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center">
              <h3 className="font-black">알림센터</h3>
              <div className="grow" />
              <button onClick={() => setBell(false)} className="text-ink2 hover:text-ink">✕</button>
            </div>
            <div className="pt-16 text-center text-sm text-ink2">
              <div className="mb-2 text-3xl">🔕</div>
              아직 알림이 없어요.
            </div>
          </div>
        </div>
      )}

      <Outlet />
    </div>
  )
}
