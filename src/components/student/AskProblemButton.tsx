// ── ❓ 이 문제 질문하기 — 사진 없이 앱 문제를 바로 질문함으로 (2026-09-29 명수쌤) ─────────────
// 「학습지 문제를 풀다가 사진 찍지 않고 그 문제를 바로 질문할 수 있게」
// 문제 화면(풀이 중·채점 결과·승강제) 어디에 붙여도 된다. 학생 화면이 아니면(선생님 화면의 승강제 등) 아무것도 안 그린다.
// 보내는 것: 앱이 그린 문제 그림(problemShot) + 문제 원문·정답(problem 칸) + 막힌 곳 한 줄 + 학생 맥락.

import { useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Problem } from '../../types'
import { StudentSelfCtx, usePreview, PREVIEW_LOCK_TITLE } from '../../pages/student/common'
import { useStoreMaybe } from '../../lib/store'
import { askQuestion, type QnaProblem } from '../../lib/qna'
import { problemShot } from '../../lib/problemShot'
import { studentQnaContext } from '../../lib/qnaContext'
import { pushBlocker, pushSupported, subscribeForAnswer } from '../../lib/qnaNotify'
import { SUPABASE_ON } from '../../lib/supabase'
import { courseIdOfType, courseTagOfType, subjectOfType, typeName } from '../../data/curriculum'

/** 막힌 곳을 한 번에 고르는 칩 — 폰에서 긴 글을 안 써도 되게 */
export const QUICK_ASKS = [
  '처음에 어떻게 시작할지 모르겠어요',
  '풀이 중간에서 막혔어요',
  '정답이 왜 이건지 모르겠어요',
  '내 답이 왜 틀렸는지 알고 싶어요',
  '개념이 헷갈려요',
] as const

export function QuickChips({ picked, onToggle }: { picked: string[]; onToggle: (s: string) => void }) {
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {QUICK_ASKS.map(s => {
        const on = picked.includes(s)
        return (
          <button key={s} type="button" onClick={() => onToggle(s)}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${on ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink2 hover:bg-paper2'}`}>
            {on ? '✓ ' : ''}{s}
          </button>
        )
      })}
    </div>
  )
}

/** 칩 + 직접 쓴 글 → 질문 글 */
export function joinAsk(picked: string[], text: string): string {
  return [...picked, text.trim()].filter(Boolean).join('\n')
}

export default function AskProblemButton({ p, studentAnswer, correct, where, label, variant = 'chip' }: {
  p: Problem
  studentAnswer?: string       // 학생이 낸 답(있으면 해설이 «네 답의 어디가» 를 짚는다)
  correct?: boolean            // 채점 뒤면 맞았는지
  where: '풀이 중' | '채점 결과' | '승강제'
  label?: string               // 학습지 이름 · 번호
  variant?: 'chip' | 'block' | 'link'
}) {
  const me = useContext(StudentSelfCtx)
  const preview = usePreview()
  const [open, setOpen] = useState(false)
  if (!me || !SUPABASE_ON) return null
  const cls = variant === 'block'
    ? 'w-full rounded-xl border border-pine/40 bg-white py-2.5 text-sm font-bold text-pine-dark hover:bg-pine-soft/50'
    : variant === 'link'
    ? 'text-xs font-bold text-pine-dark underline-offset-2 hover:underline'
    : 'rounded-lg border border-pine/40 bg-white px-2.5 py-1 text-xs font-bold text-pine-dark hover:bg-pine-soft/50'
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={preview.on}
        title={preview.on ? PREVIEW_LOCK_TITLE : '사진 찍지 않고 이 문제를 바로 질문해요'}
        className={`${cls} disabled:opacity-40`}>
        ❓ {variant === 'chip' ? '질문' : '이 문제 질문하기'}
      </button>
      {open && <AskProblemModal p={p} me={me} studentAnswer={studentAnswer} correct={correct} where={where} label={label}
                                onClose={() => setOpen(false)} />}
    </>
  )
}

function AskProblemModal({ p, me, studentAnswer, correct, where, label, onClose }: {
  p: Problem; me: { id: string; name: string; grade?: string }
  studentAnswer?: string; correct?: boolean; where: string; label?: string
  onClose: () => void
}) {
  const store = useStoreMaybe()
  const [shot, setShot] = useState('')            // JPEG base64
  const [shotErr, setShotErr] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const 막힘 = pushBlocker()
  const 켤수있음 = pushSupported() && !막힘 && (() => { try { return window.self === window.top } catch { return false } })()
  const [alarm, setAlarm] = useState(켤수있음)

  const tag = courseTagOfType(p.typeId)
  const head = [tag, typeName(p.typeId)].filter(Boolean).join(' · ')

  // 창이 열리자마자 문제 그림을 만든다 — 학생이 글을 고르는 동안 끝난다
  useEffect(() => {
    let alive = true
    problemShot(p, head || '학습지 문제')
      .then(b => { if (alive) setShot(b) })
      .catch(e => { if (alive) setShotErr(e instanceof Error ? e.message : String(e)) })
    return () => { alive = false }
  }, [p, head])

  function toggle(s: string) {
    setPicked(v => v.includes(s) ? v.filter(x => x !== s) : [...v, s])
  }

  async function send() {
    const 글 = joinAsk(picked, text)
    if (글.length < 2) { setErr('막힌 곳을 하나 고르거나 한 줄 적어 주세요. 그래야 그 부분을 짚어 드려요.'); return }
    if (!shot) { setErr(shotErr || '문제 그림을 만드는 중이에요. 잠깐만 기다려 주세요.'); return }
    setBusy(true); setErr('')
    try {
      // 권한 창은 «누른 순간» 안에서만 뜬다 → 다른 await 보다 먼저 부른다. 8초 안에 안 되면 알림 없이 보낸다
      const push = alarm
        ? await Promise.race([subscribeForAnswer(), new Promise<undefined>(ok => setTimeout(() => ok(undefined), 8000))])
        : undefined
      const 한것: string[] = []
      if (studentAnswer) 한것.push(`학생이 낸 답: ${studentAnswer}${correct === true ? ' (맞음)' : correct === false ? ' (틀림)' : ' (아직 채점 전)'}`)
      else 한것.push('학생은 아직 답을 내지 않았다')
      한것.push(`질문한 곳: ${where}${label ? ` · ${label}` : ''}`)
      const problem: QnaProblem = {
        src: 'app', pid: p.id, typeId: p.typeId, typeName: typeName(p.typeId),
        course: courseIdOfType(p.typeId) || undefined, subject: subjectOfType(p.typeId) ?? '수학',
        body: p.imageUrl ? '' : p.body, choices: p.imageUrl ? undefined : p.choices,
        answer: p.answer, solution: /^https?:|\.(png|jpe?g|webp)$/i.test(p.solution || '') ? undefined : p.solution,
        imageUrl: p.imageUrl, studentAnswer, correct, where, label,
      }
      await askQuestion({
        studentId: me.id, studentName: me.name, text: 글, shotB64: shot, problem,
        context: studentQnaContext(me, store, 한것), push,
      })
      setDone(true)
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center">
          <h2 className="text-lg font-black">❓ 이 문제 질문하기</h2>
          <div className="grow" />
          <button onClick={onClose} className="rounded-full px-3 py-1 text-sm text-ink2 hover:bg-paper2">닫기</button>
        </div>

        {done ? (
          <div className="py-6 text-center">
            <div className="mb-2 text-4xl">📮</div>
            <p className="mb-1 text-base font-black">질문을 보냈어요!</p>
            <p className="mb-5 text-sm text-ink2">해설 노트가 만들어지면 <b>질문함</b>에 도착해요.{alarm ? ' 📲 이 기기로 알림도 보내 드려요.' : ''}<br />그동안 다음 문제를 계속 풀어도 돼요.</p>
            <div className="flex justify-center gap-2">
              <button onClick={onClose} className="rounded-full border border-line px-4 py-2 text-sm font-bold text-ink2">계속 풀기</button>
              <Link to="/student/questions" className="rounded-full bg-pine px-4 py-2 text-sm font-bold text-paper">질문함 보기</Link>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-2 text-xs text-ink2">📷 사진은 필요 없어요 — 이 문제가 그대로 선생님께 가요.</p>
            <div className="mb-3 overflow-hidden rounded-2xl border border-line bg-paper2">
              {shot
                ? <img src={`data:image/jpeg;base64,${shot}`} alt="보낼 문제" className="max-h-60 w-full object-contain" />
                : <div className="flex h-28 items-center justify-center text-sm text-ink2">{shotErr ? `문제 그림을 만들지 못했어요 — ${shotErr}` : '문제를 옮기는 중…'}</div>}
            </div>
            {studentAnswer && (
              <p className="mb-3 text-xs text-ink2">내 답 <b className="text-ink">{studentAnswer}</b>{correct === false ? ' (틀림)' : correct === true ? ' (맞음)' : ''} 도 같이 보내요 — 어디서 헷갈렸는지 짚어 드려요.</p>
            )}

            <label className="mb-1.5 block text-sm font-bold">어디가 막히나요?</label>
            <QuickChips picked={picked} onToggle={toggle} />
            <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
              placeholder="더 적고 싶은 게 있으면 적어 주세요. 예) (나)에서 왜 곱하기가 아니라 더하기예요?"
              className="mb-3 w-full resize-y rounded-2xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-pine" />

            {켤수있음 ? (
              <label className="mb-3 flex items-center gap-2 rounded-xl bg-pine-soft/40 px-3 py-2.5 text-sm">
                <input type="checkbox" checked={alarm} onChange={e => setAlarm(e.target.checked)} className="h-4 w-4 accent-pine" />
                <span><b>📲 해설이 오면 폰 알림 받기</b> <span className="text-xs text-ink2/70">(앱을 닫아 둬도 와요)</span></span>
              </label>
            ) : 막힘 ? (
              <p className="mb-3 text-xs text-ink2/70">📲 {막힘} 질문함을 열어 두면 도착할 때 바로 알려 드려요.</p>
            ) : null}

            {err && <div className="mb-3 rounded-xl bg-amber-soft px-3 py-2.5 text-sm text-amber">{err}</div>}

            <button onClick={send} disabled={busy || !shot}
              className="w-full rounded-full bg-pine py-3 text-sm font-bold text-paper transition hover:brightness-110 disabled:opacity-40">
              {busy ? '보내는 중…' : !shot && !shotErr ? '문제 옮기는 중…' : '질문 보내기'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
