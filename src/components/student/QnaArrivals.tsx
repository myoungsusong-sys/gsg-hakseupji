import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { myQuestions, unreadOf, type Question, type QnaStatus } from '../../lib/qna'
import { announceArrival } from '../../lib/qnaNotify'
import { SUPABASE_ON } from '../../lib/supabase'

// ── 📬 해설 도착 — 학생앱 어느 화면에 있든 알린다 (2026-09-28 명수쌤 「바로 확인할 수 있게」) ──
//  · 질문함 탭에 빨간 숫자(안 본 해설 수)
//  · 화면 아래에 「해설이 도착했어요 [지금 보기]」 알림
//  · 앱이 열려 있는 동안 도착하면 딩동 소리·진동·탭 제목 🔔 (탭이 뒤에 있으면 시스템 알림)
// 🔴 서버를 함부로 두드리지 않는다: 처음 한 번 + 화면으로 돌아올 때 + «기다리는 질문이 있을 때만» 주기 확인.
//    질문함 화면에 있을 때는 그 화면이 불러온 목록(qna:list)을 같이 쓴다 — 같은 것을 두 번 부르지 않는다.

const 하루 = 86400_000

export function useQnaArrivals(studentId: string | undefined) {
  const loc = useLocation()
  const onPage = loc.pathname.startsWith('/student/questions')
  const [list, setList] = useState<Question[]>([])
  const [readTick, setReadTick] = useState(0)
  const prev = useRef<Map<string, QnaStatus> | null>(null)

  const take = useCallback((l: Question[]) => {
    const p = prev.current
    // 앱이 열려 있는 동안 «완료로 바뀐» 것만 소리를 낸다(처음 불러온 옛 답에는 울리지 않는다)
    const arrived = p ? l.filter(q => q.status === '완료' && p.has(q.id) && p.get(q.id) !== '완료') : []
    prev.current = new Map(l.map(q => [q.id, q.status]))
    setList(l)
    if (arrived.length) {
      const a = arrived[0]
      void announceArrival(arrived.length, a.card?.정답 ? `정답 ${a.card.정답}` : a.text.slice(0, 40))
    }
  }, [])

  const load = useCallback(async () => {
    if (!studentId || !SUPABASE_ON) return
    try { take(await myQuestions(studentId, 10)) } catch { /* 조용히 — 다음에 다시 */ }
  }, [studentId, take])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const v = () => { if (document.visibilityState === 'visible' && !onPage) void load() }
    document.addEventListener('visibilitychange', v)
    return () => document.removeEventListener('visibilitychange', v)
  }, [load, onPage])

  useEffect(() => {
    const f = (e: Event) => take(((e as CustomEvent<Question[]>).detail ?? []))
    const r = () => setReadTick(t => t + 1)
    window.addEventListener('qna:list', f)
    window.addEventListener('qna:read', r)
    return () => { window.removeEventListener('qna:list', f); window.removeEventListener('qna:read', r) }
  }, [take])

  // 기다리는 질문(최근 하루 안)이 있을 때만 주기 확인 — 만드는 중이면 20초, 선생님 확인·실패는 60초
  const 최근 = list.filter(q => Date.now() - new Date(q.createdAt).getTime() < 하루)
  const active = 최근.some(q => q.status === '대기' || q.status === '만드는중')
  const slow = 최근.some(q => q.status === '보류' || q.status === '실패')
  useEffect(() => {
    if (onPage || (!active && !slow)) return
    const t = setInterval(() => { void load() }, active ? 20_000 : 60_000)
    return () => clearInterval(t)
  }, [onPage, active, slow, load])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const unread = useMemo(() => unreadOf(list), [list, readTick])
  return { unread, onPage }
}

/** 「채원아」 — 성을 떼고 받침에 따라 아/야 */
export function 호칭(name: string): string {
  const n = (name || '').trim()
  const given = n.length >= 3 ? n.slice(1) : n
  const last = given.charCodeAt(given.length - 1)
  if (!(last >= 0xac00 && last <= 0xd7a3)) return given
  return given + ((last - 0xac00) % 28 ? '아' : '야')
}

export function QnaArrivalToast({ unread, onPage, name }: { unread: Question[]; onPage: boolean; name: string }) {
  const nav = useNavigate()
  const latest = unread.reduce((m, q) => ((q.answeredAt ?? '') > m ? (q.answeredAt ?? '') : m), '')
  const [closedAt, setClosedAt] = useState('')
  if (onPage || !unread.length || closedAt === latest) return null
  const 첫 = unread.find(q => q.answeredAt === latest) ?? unread[0]
  return (
    <div className="fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4" role="status" aria-live="polite">
      <div className="flex w-full max-w-xl items-center gap-3 rounded-2xl bg-pine px-4 py-3 text-paper shadow-2xl ring-4 ring-pine/20">
        <span className="text-2xl">📬</span>
        <div className="min-w-0 grow">
          <div className="text-sm font-black">
            {호칭(name)}, 질문한 문제 해설이 도착했어요{unread.length > 1 ? ` (${unread.length}개)` : ''}!
          </div>
          <div className="truncate text-xs text-paper/85">
            {첫.card?.정답 ? `정답 ${첫.card.정답} · ` : ''}{첫.text}
          </div>
        </div>
        <button onClick={() => nav('/student/questions')}
          className="shrink-0 rounded-full bg-paper px-4 py-2 text-sm font-extrabold text-pine-dark hover:brightness-95">지금 보기</button>
        <button onClick={() => setClosedAt(latest)} aria-label="닫기"
          className="shrink-0 rounded-full px-2 py-1 text-paper/80 hover:text-paper">✕</button>
      </div>
    </div>
  )
}

export function QnaBadge({ n }: { n: number }) {
  if (!n) return null
  return (
    <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-clay px-1.5 align-middle text-[11px] font-black leading-none text-white">
      {n}
    </span>
  )
}
