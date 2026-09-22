import { useCallback, useEffect, useState } from 'react'
import { allQuestions, workerBeat, type Question, type QnaStatus, type WorkerBeat } from '../lib/qna'
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
  const [beat, setBeat] = useState<WorkerBeat | null | undefined>(undefined)   // undefined = 아직 못 읽음

  const load = useCallback(async () => {
    try { setList(await allQuestions(60)); setErr('') }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
    try { setBeat(await workerBeat()) } catch { setBeat(null) }
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

      <WorkerStatus beat={beat} />

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


// ── 워커(아이맥) 상태 — 워커가 5분마다·단계가 바뀔 때 보고한다 (2026-09-22) ─────────
// 두 맥을 직접 잇지 않는다. 워커가 서버(wcfg_qna_beat)에 쓰고, 선생님 앱·다른 맥이 읽는다.
function WorkerStatus({ beat }: { beat: WorkerBeat | null | undefined }) {
  const [open, setOpen] = useState(false)
  if (beat === undefined) return null
  const 분 = beat ? Math.floor((Date.now() - Date.parse(beat.at)) / 60_000) : Infinity
  const 톤 = !beat || 분 >= 30 ? 'red' : 분 >= 8 || beat.상태 === '오류' ? 'amber' : 'green'
  const 색 = 톤 === 'red' ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 톤 === 'amber' ? 'border-amber/40 bg-amber-soft/60 text-ink' : 'border-pine/30 bg-pine-soft/50 text-ink'
  const 제목 = !beat ? '🔴 워커가 아직 한 번도 보고하지 않았습니다 (아이맥 워커가 꺼져 있거나 설치 전)'
    : 분 >= 30 ? `🔴 워커 신호가 ${분 >= 120 ? Math.floor(분 / 60) + '시간' : 분 + '분'}째 없습니다 — ${beat.host ?? '워커 맥'}이 꺼졌거나 인터넷이 끊겼을 수 있어요`
    : 분 >= 8 ? `🟡 워커 신호가 ${분}분째 늦습니다 (${beat.host ?? '워커 맥'})`
    : `🟢 워커 정상 · ${beat.host ?? '워커 맥'} · ${분 < 1 ? '방금' : 분 + '분 전'} 신호 · ${beat.상태 ?? ''}`
  const 오늘 = beat?.오늘
  return (
    <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${색}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <b>{제목}</b>
        {beat?.현재?.질문 && <span>· 지금 {beat.현재.학생 ?? ''} 질문 {beat.현재.단계 ?? ''}</span>}
        {오늘 && <span className="text-ink2">· 오늘 보냄 {오늘.완료 ?? 0} · 보류 {오늘.보류 ?? 0} · 실패 {오늘.실패 ?? 0}</span>}
        <div className="grow" />
        {beat && (
          <button onClick={() => setOpen(o => !o)} className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink2 hover:text-ink">
            {open ? '접기' : `기록 보기${beat.최근오류?.length ? ` · 오류 ${beat.최근오류.length}` : ''}`}
          </button>
        )}
      </div>
      {open && beat && (
        <div className="mt-3 grid gap-3 text-xs text-ink">
          {!!beat.최근오류?.length && (
            <div>
              <div className="mb-1 font-bold text-rose-700">최근 오류</div>
              {beat.최근오류.slice().reverse().map((e, i) => (
                <div key={i} className="font-mono"><span className="text-ink2">{e.at.slice(5, 16).replace('T', ' ')}</span> {e.글}</div>
              ))}
            </div>
          )}
          {!!beat.최근기록?.length && (
            <div>
              <div className="mb-1 font-bold">최근 기록</div>
              <pre className="whitespace-pre-wrap rounded-lg bg-white/70 p-2 font-mono text-[11px] leading-relaxed">{beat.최근기록.join('\n')}</pre>
            </div>
          )}
          <div className="text-ink2">워커 시작 {beat.시작?.slice(0, 16).replace('T', ' ') ?? '-'} · 설정 v{beat.설정버전 ?? '-'}</div>
        </div>
      )}
    </div>
  )
}
