import { useCallback, useEffect, useState } from 'react'
import { allQuestions, type Question, type QnaStatus } from '../lib/qna'
import { SUPABASE_ON } from '../lib/supabase'

// ── 선생님 질문함 — 학생이 올린 질문과 자동 생성된 해설 노트 ─────────
// 자동이 원칙이다(선생님이 먼저 눌러야 하는 일은 없다). 여기는 «보는» 곳이고,
// 자동으로 안 된 건(🔴 실패)만 선생님이 직접 답해 주시면 된다.

const BADGE: Record<QnaStatus, { t: string; c: string }> = {
  대기:    { t: '접수됨',       c: 'bg-paper2 text-ink2' },
  만드는중: { t: '만드는 중',    c: 'bg-amber-soft text-amber' },
  완료:    { t: '보냄',         c: 'bg-pine-soft text-pine-dark' },
  보류:    { t: '🟡 검증 불일치 — 직접 답변', c: 'bg-amber-soft text-amber' },
  실패:    { t: '🔴 직접 답변 필요', c: 'bg-rose-100 text-rose-700' },
}

export default function Questions() {
  const [list, setList] = useState<Question[]>([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [only, setOnly] = useState<'전체' | '처리 중' | '실패'>('전체')
  const [zoom, setZoom] = useState<string>('')

  const load = useCallback(async () => {
    try { setList(await allQuestions(60)); setErr('') }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const t = setInterval(() => { void load() }, 30_000)
    return () => clearInterval(t)
  }, [load])

  const 보임 = list.filter(q =>
    only === '전체' ? true : only === '실패' ? (q.status === '실패' || q.status === '보류') : q.status !== '완료')
  const 실패수 = list.filter(q => q.status === '실패' || q.status === '보류').length
  const 진행수 = list.filter(q => q.status === '대기' || q.status === '만드는중').length

  if (!SUPABASE_ON) return <div className="p-6 text-sm text-ink2">클라우드 모드에서만 볼 수 있어요.</div>

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-black">질문함</h1>
        <span className="text-sm text-ink2">학생이 올린 문제에 해설 노트를 자동으로 만들어 보냅니다</span>
        <div className="grow" />
        {(['전체', '처리 중', '실패'] as const).map(t => (
          <button key={t} onClick={() => setOnly(t)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition ${
              only === t ? 'bg-pine text-paper' : 'border border-line bg-white text-ink2 hover:text-ink'}`}>
            {t}{t === '실패' && 실패수 ? ` ${실패수}` : t === '처리 중' && 진행수 ? ` ${진행수}` : ''}
          </button>
        ))}
      </div>

      {실패수 > 0 && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          🔴 자동 검증을 통과하지 못한 질문이 <b>{실패수}건</b> 있습니다. 학생에게 <b>보내지 않았습니다</b> — 선생님이 직접 답해 주세요.
        </div>
      )}
      {err && <div className="mb-4 rounded-2xl border border-line bg-amber-soft px-4 py-3 text-sm text-amber">{err}</div>}

      {loading ? (
        <div className="rounded-2xl border border-line bg-white px-4 py-14 text-center text-sm text-ink2">불러오는 중…</div>
      ) : 보임.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white px-4 py-14 text-center text-sm text-ink2">
          {only === '전체' ? '아직 올라온 질문이 없습니다.' : '해당하는 질문이 없습니다.'}
        </div>
      ) : (
        <div className="grid gap-3">
          {보임.map(q => {
            const b = BADGE[q.status] ?? BADGE.대기
            return (
              <div key={q.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-start gap-3">
                  <button onClick={() => setZoom(q.shotUrl)} className="shrink-0">
                    <img src={q.shotUrl} alt="문제" className="h-20 w-20 rounded-xl border border-line object-cover" />
                  </button>
                  <div className="min-w-0 grow">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <b className="text-sm">{q.studentName}</b>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${b.c}`}>{b.t}</span>
                      <span className="text-xs text-ink2/70">{fmt(q.createdAt)}</span>
                      {typeof q.tries === 'number' && q.tries > 0 && q.status !== '완료' &&
                        <span className="text-xs text-ink2/70">재시도 {q.tries}</span>}
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm text-ink">{q.text}</p>
                    {q.answerText && <p className="mt-1 text-sm text-pine-dark">💡 {q.answerText}</p>}
                    {q.error && <p className="mt-1 break-words text-xs text-rose-600">{q.error}</p>}
                  </div>
                  {q.answerUrl && (
                    <button onClick={() => setZoom(q.answerUrl!)} className="shrink-0">
                      <img src={q.answerUrl} alt="해설" className="h-20 w-32 rounded-xl border border-line object-cover" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {zoom && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-4" onClick={() => setZoom('')}>
          <img src={zoom} alt="크게 보기" className="mx-auto max-w-6xl rounded-xl bg-white" />
        </div>
      )}
    </div>
  )
}

function fmt(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`
}
