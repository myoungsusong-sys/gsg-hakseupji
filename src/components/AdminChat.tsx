import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore, uid } from '../lib/store'
import {
  applyOps, clearLastApplied, previewOp, rememberApplied, takeLastApplied, undoSnapshot, validateOp,
  type Ctx, type Op, type OpPreview, type Snapshot,
} from '../lib/adminOps'

// 💬 클로드에게 말로 고치기 — 선생님(관리자) 화면 전역 플로팅 (2026-07-30 명수쌤 지시)
//
// "오투 통합과학2 15쪽 8번 정답을 ~로 바꿔" 처럼 말하면 클로드가 **수정 작업**으로 바꿔 준다.
//
// 🔴 바로 적용되지 않는다. 항상 "이전값 → 새값"을 보여주고 선생님이 [적용]을 눌러야 실행된다.
//    적용 후에는 [되돌리기]가 한 번 뜬다. 고칠 수 있는 것은 네 가지뿐 —
//    교재 정답 · 학생 정보 · 학생앱 설정 · 채점 기록. (검증·실행은 lib/adminOps.ts)
//    코드 수정·배포는 이 경로로 하지 않는다(17차 결론). 그건 개발 세션이 한다.
//
// ⚠️ 모달은 createPortal 로 body 에 — 헤더의 backdrop-blur 가 containing block 을 만들어
//    헤더 안에서 렌더하면 fixed 가 잘린다(17차에 데였다).

interface Msg { role: 'user' | 'assistant'; text: string }

export default function AdminChat() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="클로드에게 말로 고치기"
        className="no-print fixed bottom-6 left-6 z-40 flex h-12 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-bold text-ink shadow-lg hover:border-pine">
        💬 <span className="hidden sm:inline">클로드에게 말하기</span>
      </button>
      {open && createPortal(<ChatPanel onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const st = useStore()
  const [msgs, setMsgs] = useState<Msg[]>([{
    role: 'assistant',
    text: '무엇을 고칠까요? 예) "오투 통합과학2 15쪽 8번 정답을 «물이 증발할 때 주위에서 열을 흡수하기 때문이다.»로 바꿔"\n\n고칠 수 있는 것: 교재 정답 · 학생 정보 · 학생앱 설정 · 채점 기록. 적용 전에 바뀔 내용을 먼저 보여드립니다.',
  }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [previews, setPreviews] = useState<OpPreview[] | null>(null)
  // 창을 닫았다 다시 열어도 직전 적용분은 되돌릴 수 있다 (모듈에 남겨 둔다)
  const [undo, setUndo] = useState<Snapshot | null>(takeLastApplied()?.snapshot ?? null)
  const [doneNote, setDoneNote] = useState(() => {
    const l = takeLastApplied()
    return l ? `직전에 ${l.done}건 적용했습니다.` : ''
  })
  const endRef = useRef<HTMLDivElement>(null)

  const ctx: Ctx = useMemo(() => ({
    workbooks: st.workbooks, wbItems: st.wbItems, students: st.students,
    gradings: st.gradings, config: st.studentAppConfig,
  }), [st.workbooks, st.wbItems, st.students, st.gradings, st.studentAppConfig])

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [msgs, previews, busy])

  // AI 에 보내는 목록 — 정답표 수십만 문항은 보내지 않는다. 이름과 id, 쪽 범위만.
  function catalog() {
    return {
      workbooks: st.workbooks.map(w => {
        const its = st.wbItems.filter(i => i.workbookId === w.id)
        const pages = its.map(i => i.page)
        return {
          id: w.id, name: w.name, grade: w.grade, 문항수: its.length,
          쪽: pages.length ? `${Math.min(...pages)}~${Math.max(...pages)}` : '',
        }
      }),
      students: st.students.map(x => ({
        id: x.id, name: x.name, grade: x.grade, klass: x.klass, attendNo: x.attendNo, 재원: x.active,
      })),
      config: st.studentAppConfig,
      gradings: [...st.gradings]
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
        .slice(0, 30)
        .map(g => ({
          id: g.id, 학생: st.students.find(s => s.id === g.studentId)?.name ?? '?',
          교재: st.workbooks.find(w => w.id === g.workbookId)?.name ?? '',
          날짜: g.date, 쪽: g.pageFrom && g.pageTo ? `${g.pageFrom}~${g.pageTo}` : '', 문항수: g.results.length,
        })),
      route: location.hash || '#/',
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    const next = [...msgs, { role: 'user' as const, text }]
    setMsgs(next); setInput(''); setBusy(true); setErr(''); setPreviews(null); setDoneNote('')
    try {
      const res = await fetch('/api/diagnose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', history: next.filter(m => m.text), ...catalog() }),
      })
      if (!res.ok) {
        let m = `답을 받지 못했어요 (${res.status})`
        try { const j = await res.json(); if (j?.error) m = String(j.error) } catch { /* 그대로 */ }
        throw new Error(m)
      }
      const out: { reply: string; ops: any[] } = await res.json()
      setMsgs(m => [...m, { role: 'assistant', text: out.reply || '(답이 비어 있어요)' }])
      const ops = (Array.isArray(out.ops) ? out.ops : [])
        .map(validateOp).filter((o): o is Op => !!o)
      setPreviews(ops.length ? ops.map(o => previewOp(o, ctx)) : null)
    } catch (e: any) {
      setErr(String(e?.message ?? e))
    } finally { setBusy(false) }
  }

  function apply() {
    if (!previews) return
    const { done, snapshot } = applyOps(previews, ctx, {
      setWBItems: st.setWBItems, updateStudent: st.updateStudent,
      setStudentAppConfig: st.setStudentAppConfig, upsertGrading: st.upsertGrading, uid,
    })
    rememberApplied(snapshot, done)
    setUndo(snapshot)
    setDoneNote(`${done}건 적용했습니다.`)
    setPreviews(null)
  }

  const okCount = previews?.filter(p => !p.blocked).length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-start bg-ink/30 p-4 sm:p-6" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="flex h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <h3 className="text-base font-bold">💬 클로드에게 말로 고치기</h3>
          <span className="text-xs text-ink2">정답 · 학생 · 설정 · 채점</span>
          <div className="grow" />
          <button onClick={onClose} className="text-ink2 hover:text-ink">✕</button>
        </div>

        <div className="min-h-0 grow space-y-3 overflow-y-auto px-4 py-3">
          {msgs.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
              <div className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                m.role === 'user' ? 'bg-pine text-paper' : 'bg-paper2 text-ink'}`}>
                {m.text}
              </div>
            </div>
          ))}

          {previews && (
            <div className="rounded-xl border border-pine/40 bg-pine-soft/30 p-3">
              <div className="mb-2 text-xs font-bold text-ink">이렇게 바꿉니다 — 확인하고 적용하세요</div>
              <div className="space-y-2">
                {previews.map((p, i) => (
                  <div key={i} className="rounded-lg border border-line bg-white p-2.5 text-xs">
                    <div className="font-bold text-ink">{p.what}</div>
                    <div className="mt-1 text-ink2">
                      <span className="line-through">{p.before}</span>
                      <span className="mx-1.5">→</span>
                      <b className="text-ink">{p.after}</b>
                    </div>
                    {p.warn && !p.blocked && <div className="mt-1 font-semibold text-amber">⚠ {p.warn}</div>}
                    {p.blocked && <div className="mt-1 font-semibold text-clay">✕ 적용 못 함 — {p.blocked}</div>}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-ink2">{okCount}건 적용 가능</span>
                <div className="grow" />
                <button onClick={() => setPreviews(null)} className="rounded-lg border border-line px-3 py-1.5 text-xs">취소</button>
                <button onClick={apply} disabled={okCount === 0}
                  className="rounded-lg bg-pine px-4 py-1.5 text-xs font-bold text-paper disabled:opacity-40">
                  {okCount}건 적용
                </button>
              </div>
            </div>
          )}

          {doneNote && (
            <div className="flex items-center gap-2 rounded-xl border border-line bg-paper2 p-3 text-xs">
              <b>✓ {doneNote}</b>
              <div className="grow" />
              {undo && (
                <button onClick={() => { undoSnapshot(undo, {
                  setWBItems: st.setWBItems, updateStudent: st.updateStudent,
                  setStudentAppConfig: st.setStudentAppConfig, upsertGrading: st.upsertGrading, uid,
                }); clearLastApplied(); setUndo(null); setDoneNote('되돌렸습니다.') }}
                  className="rounded-lg border border-line bg-white px-3 py-1.5 font-semibold">↩ 되돌리기</button>
              )}
            </div>
          )}

          {busy && <div className="text-xs text-ink2">클로드가 보고 있어요…</div>}
          {err && <div className="rounded-xl border border-clay/40 bg-red-50 p-3 text-xs text-clay">{err}</div>}
          <div ref={endRef} />
        </div>

        <div className="border-t border-line p-3">
          <div className="flex items-end gap-2">
            <textarea value={input} onChange={e => setInput(e.target.value)} rows={2}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="무엇을 고칠까요? (Enter 보내기 · Shift+Enter 줄바꿈)"
              className="grow rounded-xl border border-line px-3 py-2 text-sm" />
            <button onClick={send} disabled={busy || !input.trim()}
              className="rounded-xl bg-pine px-4 py-2.5 text-sm font-bold text-paper disabled:opacity-40">보내기</button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink2">
            코드 수정·배포는 여기서 하지 않습니다(개발 세션 몫). 채점 방식 자체도 바뀌지 않습니다.
          </p>
        </div>
      </div>
    </div>
  )
}
