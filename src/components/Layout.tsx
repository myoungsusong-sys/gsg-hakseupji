import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { SUPABASE_ON } from '../lib/supabase'

const topTab = ({ isActive }: { isActive: boolean }) =>
  `px-4 py-2 rounded-full text-[15px] font-bold transition ${
    isActive ? 'text-pine-dark' : 'text-ink2 hover:text-ink'
  }`

export default function Layout() {
  const nav = useNavigate()
  const { email, signOut } = useAuth()
  return (
    <div className="min-h-screen">
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
          <button
            onClick={() => nav('/make')}
            className="rounded-full bg-amber px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-105"
          >
            + 학습지 만들기
          </button>
          {SUPABASE_ON && email && (
            <div className="flex items-center gap-2 text-sm text-ink2">
              <span className="hidden sm:inline">{email}</span>
              <button onClick={() => signOut()} className="rounded-lg border border-line px-3 py-1.5 hover:border-clay hover:text-clay">로그아웃</button>
            </div>
          )}
        </div>
      </header>
      <Outlet />
    </div>
  )
}
