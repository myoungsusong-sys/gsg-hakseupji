import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useStore } from '../lib/store'
import { SUPABASE_ON } from '../lib/supabase'
import { getLocalStudentId, isStudentEmail } from '../lib/role'
import { latestGradingFor } from './student/common'

/* 종이 학습지 머리말의 QR 을 찍으면 오는 곳 (#/qr/<학습지 id>[?s=<학생 id>])
   · 학생으로 들어와 있으면 → 그 학습지 답 입력 화면
   · 선생님이면 → 이름이 찍힌 학습지(s 있음)는 그 학생 채점 화면,
                  이름 없는 학습지는 출제받은 학생 목록(채점 완료·채점 중·채점 전)에서 고른다 */
export default function QrEntry() {
  const { wsId = '' } = useParams()
  const [sp] = useSearchParams()
  const { email } = useAuth()
  const { worksheets, assignments, gradings, students, synced } = useStore()
  const studentMode = SUPABASE_ON ? isStudentEmail(email) : !!getLocalStudentId()

  if (studentMode) return <Navigate to={`/student/solve/${wsId}`} replace />

  const sid = sp.get('s')
  if (sid) return <Navigate to={`/lesson?student=${encodeURIComponent(sid)}&grade=${encodeURIComponent(wsId)}`} replace />

  const ws = worksheets.find(w => w.id === wsId)
  if (!ws) {
    return (
      <Shell>
        <p className="text-sm text-ink2">{synced ? '이 학습지를 찾지 못했어요. 지워졌거나 다른 학원의 학습지일 수 있어요.' : '불러오는 중…'}</p>
        <Link to="/" className="mt-4 inline-block text-sm font-bold text-pine">첫 화면으로</Link>
      </Shell>
    )
  }

  const ids = [...new Set(assignments.filter(a => a.worksheetId === wsId).map(a => a.studentId))]
  const rows = ids
    .map(id => students.find(s => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map(s => {
      const g = latestGradingFor(gradings, s.id, wsId)
      const done = g ? g.results.length : 0
      const total = ws.problemIds.length
      const state = !g || done === 0 ? '채점 전' : done >= total ? '채점 완료' : '채점 중'
      return { s, state, done, total }
    })
    .sort((a, b) => a.s.name.localeCompare(b.s.name, 'ko'))

  return (
    <Shell>
      <h1 className="text-lg font-extrabold">{ws.title}</h1>
      <p className="mt-1 text-sm text-ink2">채점할 학생을 골라 주세요 · 출제받은 학생 {rows.length}명</p>
      {rows.length === 0 && (
        <p className="mt-6 rounded-xl bg-paper2 p-4 text-sm text-ink2">아직 이 학습지를 출제받은 학생이 없어요. 먼저 학생에게 출제해 주세요.</p>
      )}
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-white">
        {rows.map(({ s, state, done, total }) => (
          <li key={s.id}>
            <Link to={`/lesson?student=${encodeURIComponent(s.id)}&grade=${encodeURIComponent(wsId)}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-paper2">
              <span className="font-bold">{s.name}</span>
              <span className="text-xs text-ink2">{s.grade}</span>
              <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold ${
                state === '채점 완료' ? 'bg-pine-soft text-pine-dark' : state === '채점 중' ? 'bg-amber-soft text-amber' : 'bg-paper2 text-ink2'}`}>
                {state}{state === '채점 중' && ` ${done}/${total}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-screen w-full max-w-lg px-5 py-8">{children}</div>
}
