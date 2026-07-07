import { useState } from 'react'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setInfo(null); setBusy(true)
    const msg = mode === 'in' ? await signIn(email, pw) : await signUp(email, pw)
    setBusy(false)
    if (msg) { setErr(translate(msg)); return }
    if (mode === 'up') setInfo('계정이 만들어졌습니다. 이메일 인증이 필요할 수 있어요. 로그인해 주세요.')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 shadow-sm">
        <div className="mb-1 flex items-baseline gap-2">
          <span className="text-2xl font-black tracking-tight text-pine-dark">깊은생각</span>
          <span className="text-2xl font-light text-ink">학습지</span>
        </div>
        <p className="mb-6 text-sm text-ink2">{mode === 'in' ? '로그인' : '계정 만들기'}</p>

        <form onSubmit={submit} className="grid gap-3">
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="이메일" autoComplete="username"
            className="rounded-lg border border-line px-3 py-2.5 outline-none focus:border-pine" />
          <input type="password" required value={pw} onChange={e => setPw(e.target.value)}
            placeholder="비밀번호" autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            className="rounded-lg border border-line px-3 py-2.5 outline-none focus:border-pine" />
          {err && <p className="text-sm text-clay">{err}</p>}
          {info && <p className="text-sm text-pine-dark">{info}</p>}
          <button disabled={busy} type="submit"
            className="rounded-lg bg-pine py-3 font-bold text-paper transition enabled:hover:bg-pine-dark disabled:opacity-50">
            {busy ? '처리 중…' : (mode === 'in' ? '로그인' : '계정 만들기')}
          </button>
        </form>

        <button onClick={() => { setMode(m => m === 'in' ? 'up' : 'in'); setErr(null); setInfo(null) }}
          className="mt-4 w-full text-center text-sm text-ink2 hover:text-pine">
          {mode === 'in' ? '계정이 없으신가요? 계정 만들기' : '이미 계정이 있으신가요? 로그인'}
        </button>
        <p className="mt-5 text-center text-xs text-ink2">학원관리앱과 같은 계정으로 로그인할 수 있습니다.</p>
      </div>
    </div>
  )
}

function translate(msg: string): string {
  if (/Invalid login credentials/i.test(msg)) return '이메일 또는 비밀번호가 올바르지 않습니다.'
  if (/already registered/i.test(msg)) return '이미 가입된 이메일입니다. 로그인해 주세요.'
  if (/signups? (are )?disabled|not allowed/i.test(msg)) return '신규 가입이 막혀 있습니다. 기존 계정으로 로그인해 주세요.'
  if (/Password should be at least/i.test(msg)) return '비밀번호는 6자 이상이어야 합니다.'
  return msg
}
