import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SUPABASE_ON } from '../../lib/supabase'
import { useStore } from '../../lib/store'
import { fetchChildRemote, matchChildLocal, setParentSession } from '../../lib/parent'

// 학부모 입장 — 학생 이름 + 학부모 연락처(끝 4자리 이상)로 자녀 확인.
// 별도 계정 없이 자녀의 학습 보고서를 열람. (프로덕션: 서버리스가 검증)
export default function ParentLogin() {
  const nav = useNavigate()
  const store = useStore()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setBusy(true)
    try {
      if (SUPABASE_ON) {
        await fetchChildRemote(name, phone)   // 검증만 — 실패 시 throw
      } else {
        const b = matchChildLocal(store.students, store.dailyNotes, store.gradings, store.academyProfile.academyName ?? '', name, phone)
        if (!b) throw new Error('이름 또는 학부모 연락처가 일치하는 학생이 없습니다.')
      }
      setParentSession({ name: name.trim(), phone: phone.trim() })
      nav('/parent', { replace: true })
    } catch (e: any) {
      setErr(e?.message || '조회에 실패했습니다.')
    } finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper2 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 shadow-sm">
        <div className="mb-1 flex items-baseline gap-2">
          <span className="text-2xl font-black tracking-tight text-pine-dark">깊은생각</span>
          <span className="text-2xl font-light text-ink">학습지</span>
        </div>
        <p className="mb-1 text-sm font-bold text-ink">학부모 입장</p>
        <p className="mb-6 text-xs text-ink2">자녀의 학습 보고서를 확인하실 수 있어요. 자녀 이름과 등록된 학부모 연락처를 입력하세요.</p>

        <form onSubmit={submit} className="grid gap-3">
          <input required value={name} onChange={e => setName(e.target.value)}
            placeholder="자녀 이름" autoComplete="off"
            className="rounded-lg border border-line px-3 py-2.5 outline-none focus:border-pine" />
          <input required value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="학부모 연락처 (끝 4자리 이상)" inputMode="numeric" autoComplete="off"
            className="rounded-lg border border-line px-3 py-2.5 outline-none focus:border-pine" />
          {err && <p className="text-sm text-clay">{err}</p>}
          <button type="submit" disabled={busy}
            className="rounded-lg bg-pine py-3 font-bold text-paper transition hover:bg-pine-dark disabled:opacity-60">
            {busy ? '확인 중…' : '보고서 보기'}
          </button>
        </form>

        <button onClick={() => { window.location.hash = '#/'; window.location.reload() }}
          className="mt-4 w-full text-center text-sm text-ink2 hover:text-pine">
          선생님/학생 화면으로
        </button>
      </div>
    </div>
  )
}
