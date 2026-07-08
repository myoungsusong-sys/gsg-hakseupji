import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { SUPABASE_ON } from '../../lib/supabase'
import { useStore } from '../../lib/store'
import { setLocalStudentId } from '../../lib/role'

// 로컬 모드(supabase 없음) 학생 입장 — 개발·검증용.
// 등록된 학생 이름 + 출결번호가 일치하면 학생 모드로 들어간다.
// supabase 모드에선 이 화면을 쓰지 않는다(로그인 화면의 [학생] 탭 사용).
export default function StudentLocalLogin() {
  const { students } = useStore()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [attendNo, setAttendNo] = useState('')
  const [err, setErr] = useState<string | null>(null)

  if (SUPABASE_ON) return <Navigate to="/" replace />

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const n = name.trim()
    const a = attendNo.trim()
    const me = students.find(s => s.active && s.name === n &&
      ((s.attendNo ?? '').trim() === a || (s.loginId ?? '').trim() === a))
    if (!me) { setErr('이름 또는 출결번호가 일치하는 학생이 없습니다.'); return }
    setLocalStudentId(me.id)
    nav('/student', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper2 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 shadow-sm">
        <div className="mb-1 flex items-baseline gap-2">
          <span className="text-2xl font-black tracking-tight text-pine-dark">깊은생각</span>
          <span className="text-2xl font-light text-ink">학습지</span>
        </div>
        <p className="mb-6 text-sm text-ink2">학생 입장 (로컬 모드)</p>

        <form onSubmit={submit} className="grid gap-3">
          <input required value={name} onChange={e => setName(e.target.value)}
            placeholder="이름" autoComplete="off"
            className="rounded-lg border border-line px-3 py-2.5 outline-none focus:border-pine" />
          <input required value={attendNo} onChange={e => setAttendNo(e.target.value)}
            placeholder="출결번호" autoComplete="off"
            className="rounded-lg border border-line px-3 py-2.5 outline-none focus:border-pine" />
          {err && <p className="text-sm text-clay">{err}</p>}
          <button type="submit"
            className="rounded-lg bg-pine py-3 font-bold text-paper transition hover:bg-pine-dark">
            학생앱 들어가기
          </button>
        </form>

        <button onClick={() => nav('/', { replace: true })}
          className="mt-4 w-full text-center text-sm text-ink2 hover:text-pine">
          선생님 화면으로
        </button>
      </div>
    </div>
  )
}
