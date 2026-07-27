import { useState } from 'react'
import { createPortal } from 'react-dom'
import { recentErrors, recentHops, storageUsage } from '../lib/errorLog'
import { runHealAction, ACTION_LABEL, type HealAction } from '../lib/selfHeal'

// 🛠 화면이 이상해요 — AI 점검 (학생앱·선생님 화면 공통) (2026-07-28 명수쌤 지시)
//
// 누르면 그 순간의 상태(주소·직전 오류·화면 이동 기록·저장 공간)를 /api/diagnose 로 보내
// 원인을 찾고, 브라우저에서 고칠 수 있는 것은 그 자리에서 고친다.
// 고칠 수 없는 것(=코드를 손봐야 하는 것)은 **재현 정보가 담긴 보고서**로 넘긴다 —
// 명수쌤이 그걸 보고 고친다. AI가 앱 코드를 바꾸지는 않는다.

type Diag = {
  cause: string
  userMessage: string
  fixable: boolean
  actions: { type: HealAction; why: string }[]
  report: string
}

const REPORT_KEY = 'gsg-bug-reports'

export default function FixItButton({ app, appVersion, synced, className = '' }: {
  app: 'student' | 'teacher'
  appVersion?: string
  synced?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="화면이 이상할 때 눌러요"
        className={className || 'rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink2 hover:bg-paper2'}>
        🛠 <span className="hidden sm:inline">화면이 이상해요</span>
      </button>
      {open && createPortal(
        <FixItModal app={app} appVersion={appVersion} synced={synced} onClose={() => setOpen(false)} />,
        document.body,
      )}
    </>
  )
}

// ⚠️ 반드시 createPortal 로 body 에 띄운다. 학생앱·선생님 헤더에 backdrop-blur 가 걸려 있어
// (backdrop-filter 가 containing block 을 만든다) 헤더 안에서 렌더하면 fixed 모달이 헤더
// 박스 기준으로 배치돼 화면 위로 잘린다.
function FixItModal({ app, appVersion, synced, onClose }: {
  app: 'student' | 'teacher'; appVersion?: string; synced?: boolean; onClose: () => void
}) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [diag, setDiag] = useState<Diag | null>(null)
  const [outcome, setOutcome] = useState('')
  const [copied, setCopied] = useState(false)

  async function diagnose() {
    setBusy(true); setErr(''); setDiag(null); setOutcome('')
    try {
      const usage = storageUsage()
      const res = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app,
          route: location.hash || '#/',
          routeHistory: recentHops(),
          errors: recentErrors(),
          storageKB: usage.totalKB,
          storageItems: usage.items,
          appVersion, synced,
          online: navigator.onLine,
          ua: navigator.userAgent,
          note,
        }),
      })
      if (!res.ok) {
        let m = `점검에 실패했어요 (${res.status})`
        try { const j = await res.json(); if (j?.error) m = String(j.error) } catch { /* 그대로 */ }
        throw new Error(m)
      }
      const d: Diag = await res.json()
      setDiag(d)
      saveReport(d)
    } catch (e: any) {
      setErr(String(e?.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  // 보고서는 이 기기 수신함에도 남긴다 (선생님이 본인 화면에서 누른 경우 다시 볼 수 있게)
  function saveReport(d: Diag) {
    try {
      const raw = localStorage.getItem(REPORT_KEY)
      const list = raw ? (JSON.parse(raw) as unknown[]) : []
      list.push({
        at: new Date().toISOString(), app, route: location.hash,
        cause: d.cause, report: d.report, note, appVersion,
      })
      localStorage.setItem(REPORT_KEY, JSON.stringify(list.slice(-30)))
    } catch { /* 쿼터 초과면 굳이 남기지 않는다 */ }
  }

  function reportText(d: Diag) {
    return [
      '[학습지앱 오류 보고]',
      `언제: ${new Date().toLocaleString('ko-KR')}`,
      `어디: ${app === 'teacher' ? '선생님 화면' : '학생앱'} ${location.hash || '#/'}`,
      appVersion ? `앱 버전: ${appVersion}` : '',
      note ? `증상(사용자): ${note}` : '',
      '',
      `원인 추정: ${d.cause}`,
      '',
      d.report,
      '',
      `화면 이동: ${recentHops().map(h => `${h.from}→${h.to}`).join(' , ') || '없음'}`,
      `직전 오류: ${recentErrors(5).map(e => e.msg).join(' | ') || '없음'}`,
    ].filter(Boolean).join('\n')
  }

  async function fixNow(d: Diag) {
    setOutcome('')
    for (const a of d.actions) {
      const r = await runHealAction(a.type, app)
      setOutcome(prev => (prev ? `${prev}\n${r.note}` : r.note))
      if (r.reloads) break          // 새로고침이 걸리면 나머지는 의미 없다
      if (!r.done) break
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-black">🛠 화면이 이상해요 — AI 점검</h2>
          <button onClick={onClose} className="text-xl leading-none text-ink2 hover:text-ink">×</button>
        </div>

        {!diag && (
          <>
            <p className="mb-2 text-sm text-ink2">
              무엇이 이상한지 한 줄로 적어주면 더 잘 찾아요. (안 적어도 괜찮아요)
            </p>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} disabled={busy}
              placeholder="예) 채점하려고 하는데 화면이 갑자기 바뀌어요 / 문제가 안 보여요"
              className="w-full rounded-xl border border-line p-3 text-sm" />
            <button onClick={diagnose} disabled={busy}
              className="mt-3 w-full rounded-lg bg-pine py-2.5 text-sm font-bold text-paper hover:brightness-110 disabled:opacity-50">
              {busy ? 'AI가 이 화면을 살펴보는 중…' : 'AI 점검 시작'}
            </button>
            <p className="mt-2 text-[11px] text-ink2/70">
              이 화면의 주소·오류 기록·저장 공간만 보내요. 이름이나 답안은 보내지 않아요.
            </p>
            {err && <p className="mt-2 text-xs font-semibold text-clay">{err}</p>}
          </>
        )}

        {diag && (
          <div className="grid gap-3">
            <div className="rounded-xl bg-paper2 px-3.5 py-3">
              <div className="text-sm font-bold leading-relaxed">{diag.userMessage}</div>
              {diag.cause && <div className="mt-1.5 text-[11px] text-ink2">원인 추정: {diag.cause}</div>}
            </div>

            {diag.fixable ? (
              <>
                <div className="grid gap-1">
                  <span className="text-[11px] font-semibold text-ink2">할 수 있는 조치</span>
                  {diag.actions.filter(a => a.type !== 'none').map((a, i) => (
                    <div key={i} className="rounded-lg border border-line px-3 py-2 text-xs">
                      <b>{ACTION_LABEL[a.type] ?? a.type}</b> — {a.why}
                    </div>
                  ))}
                </div>
                <button onClick={() => fixNow(diag)}
                  className="w-full rounded-lg bg-pine py-2.5 text-sm font-bold text-paper hover:brightness-110">
                  이대로 고치기
                </button>
              </>
            ) : (
              <div className="rounded-lg border border-amber bg-amber-soft px-3 py-2 text-xs text-ink">
                이건 화면에서 바로 고칠 수 없어요. 아래 내용을 <b>선생님께 그대로 보내주세요</b> —
                무엇이 문제인지 다 담겨 있어요.
              </div>
            )}

            {outcome && <div className="rounded-lg bg-pine-soft px-3 py-2 text-xs font-semibold text-pine-dark">{outcome}</div>}

            <details className="rounded-lg border border-line px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold text-ink2">선생님께 보낼 내용 보기</summary>
              <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-ink2">
                {reportText(diag)}
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(reportText(diag))
                    .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
                    .catch(() => setCopied(false))
                }}
                className="mt-2 rounded-lg border border-pine px-3 py-1.5 text-xs font-bold text-pine hover:bg-pine-soft">
                {copied ? '✓ 복사했어요' : '📋 복사하기'}
              </button>
            </details>

            <button onClick={onClose} className="w-full rounded-lg border border-line py-2 text-sm font-semibold text-ink2 hover:bg-paper2">
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
