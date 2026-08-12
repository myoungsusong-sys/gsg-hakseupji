import { useEffect, useRef, useState } from 'react'
import { fetchCall, pushCall, type TeacherCall } from '../../lib/live'

// 📢 선생님 호출 배너 (학생앱 상단 고정)
//
// 왜 만들었나: 학생이 질문을 안 해서 선생님이 먼저 부른다(2026-08-12 명수쌤 지시).
// 학생이 어느 화면에 있든 보여야 하므로 StudentShell 헤더 아래에 상시 마운트한다.
//
// 🔴 도달성의 한계를 알고 쓸 것 — 이 앱에는 웹푸시·소리·진동이 없다(서비스워커 없음).
//    **학생이 앱 화면을 보고 있어야** 배너가 보인다. 태블릿을 덮어 뒀으면 다시 열 때 뜬다.
//    그래서 ①5초 폴링 ②탭이 다시 보이면 즉시 재조회 두 갈래로 받는다.
export default function TeacherCallOverlay({ studentId, name }: { studentId: string; name?: string }) {
  const [call, setCall] = useState<TeacherCall | null>(null)
  const busy = useRef(false)

  useEffect(() => {
    if (!studentId) return
    let alive = true
    const poll = async () => {
      if (busy.current) return
      busy.current = true
      try { const c = await fetchCall(studentId); if (alive) setCall(c) } finally { busy.current = false }
    }
    poll()
    const t = setInterval(poll, 5000)
    // 화면을 다시 켰을 때 5초를 기다리지 않게 — 태블릿을 덮어 뒀다 여는 것이 기본 사용 패턴이다
    const onVis = () => { if (document.visibilityState === 'visible') poll() }
    document.addEventListener('visibilitychange', onVis)
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [studentId])

  if (!call || call.state === 'done') return null

  async function answer(state: 'coming') {
    if (!call) return
    const next: TeacherCall = { ...call, state, ackAt: Date.now() }
    setCall(next)                       // 먼저 화면부터 바꾼다(네트워크가 느려도 학생은 눌린 걸 안다)
    await pushCall(next)
  }

  const coming = call.state === 'coming'
  return (
    <div className={`no-print sticky top-0 z-40 border-b px-4 py-3 ${
      coming ? 'border-pine/40 bg-pine-soft' : 'border-clay/40 bg-red-50'}`}>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
        <span className="text-xl">{coming ? '🙋' : '📢'}</span>
        <div className="min-w-0 grow">
          <div className={`text-sm font-black ${coming ? 'text-pine-dark' : 'text-clay'}`}>
            {coming
              ? '선생님께 가는 중이라고 알렸어요'
              : `${call.by || '선생님'}이 ${name ? `${name} 학생을 ` : ''}부르셨어요`}
          </div>
          <div className="truncate text-sm text-ink">{call.text}</div>
        </div>
        {!coming && (
          <button type="button" onClick={() => answer('coming')}
            className="rounded-lg bg-clay px-4 py-2 text-sm font-bold text-white hover:brightness-110">
            네, 갈게요
          </button>
        )}
      </div>
    </div>
  )
}
