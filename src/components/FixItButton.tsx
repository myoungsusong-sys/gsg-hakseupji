import { useState } from 'react'
import { createPortal } from 'react-dom'
import { recentErrors, recentHops, storageUsage } from '../lib/errorLog'
import { useStore, uid } from '../lib/store'
import type { BugReport } from '../types'
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

export default function FixItButton({ app, appVersion, synced, who, className = '' }: {
  app: 'student' | 'teacher'
  appVersion?: string
  synced?: boolean
  who?: string                    // 학생 이름 (선생님 화면이면 비움)
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const { bugReports } = useStore()
  // 선생님에게는 아직 처리 안 한 보고 건수를 배지로 보여준다 (쌓이기만 하면 아무도 안 본다)
  const openCount = app === 'teacher' ? bugReports.filter(r => r.status === 'open').length : 0
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        title={openCount ? `안 본 오류 보고 ${openCount}건` : '화면이 이상할 때 눌러요'}
        className={`relative ${className || 'rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink2 hover:bg-paper2'}`}>
        🛠 <span className="hidden sm:inline">화면이 이상해요</span>
        {openCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-clay px-1 text-[10px] font-black leading-[18px] text-white">
            {openCount}
          </span>
        )}
      </button>
      {open && createPortal(
        <FixItModal app={app} appVersion={appVersion} synced={synced} who={who} onClose={() => setOpen(false)} />,
        document.body,
      )}
    </>
  )
}

// ⚠️ 반드시 createPortal 로 body 에 띄운다. 학생앱·선생님 헤더에 backdrop-blur 가 걸려 있어
// (backdrop-filter 가 containing block 을 만든다) 헤더 안에서 렌더하면 fixed 모달이 헤더
// 박스 기준으로 배치돼 화면 위로 잘린다.
function FixItModal({ app, appVersion, synced, who, onClose }: {
  app: 'student' | 'teacher'; appVersion?: string; synced?: boolean; who?: string; onClose: () => void
}) {
  const { bugReports, saveBugReport } = useStore()
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

  // 보고서는 **클라우드 한곳(hj_settings.bugReports)** 에 모은다 — 학생 기기에만 남으면
  // 선생님이 영영 못 본다. 실패해도(오프라인 등) 이 기기에 남겨 두었다가 다음에 올라간다.
  function saveReport(d: Diag) {
    const r: BugReport = {
      id: uid('bug'), at: new Date().toISOString(), app,
      route: location.hash || '#/', who, note: note || undefined,
      cause: d.cause, report: d.report, fixable: d.fixable,
      actions: d.actions.map(a => a.type), status: 'open', appVersion,
    }
    try { saveBugReport(r) } catch { /* 아래 로컬 백업으로 */ }
    try {
      const raw = localStorage.getItem(REPORT_KEY)
      const list = raw ? (JSON.parse(raw) as unknown[]) : []
      list.push(r)
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
            {app === 'teacher' && <TeacherInbox reports={bugReports} onUpdate={saveBugReport} />}
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

/** 보고 시각은 한국 시간으로 보여준다 (저장은 ISO/UTC — 그대로 찍으면 하루 전으로 보인다) */
function fmtWhen(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ── 선생님 화면에서만: 받은 오류 보고함 ──────────────────────────────────
// 학생 기기에서 올라온 보고를 한곳에서 보고 처리한다. 같은 화면·같은 원인이 반복되면
// 건수로 드러나므로 무엇부터 고쳐야 하는지 바로 보인다.
function TeacherInbox({ reports, onUpdate }: { reports: BugReport[]; onUpdate: (r: BugReport) => void }) {
  const [showDone, setShowDone] = useState(false)
  const list = [...reports].reverse().filter(r => (showDone ? true : r.status === 'open'))
  if (!reports.length) return null
  return (
    <div className="mt-4 border-t border-line pt-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-black">
          받은 오류 보고 {reports.filter(r => r.status === 'open').length}건
        </span>
        <button onClick={() => setShowDone(v => !v)} className="text-[11px] font-semibold text-ink2 underline">
          {showDone ? '안 본 것만' : '처리한 것도 보기'}
        </button>
      </div>
      {!list.length && <p className="py-2 text-xs text-ink2">안 본 보고가 없어요.</p>}
      <div className="grid max-h-64 gap-1.5 overflow-auto">
        {list.map(r => (
          <details key={r.id} className={`rounded-lg border px-3 py-2 ${r.status === 'open' ? 'border-line' : 'border-line/50 opacity-60'}`}>
            <summary className="cursor-pointer text-[11px]">
              <b>{r.who ?? (r.app === 'teacher' ? '선생님' : '학생')}</b>
              <span className="text-ink2"> · {fmtWhen(r.at)} · {r.route}</span>
              {!r.fixable && <span className="ml-1 font-bold text-clay">코드 확인 필요</span>}
              {r.note && <div className="mt-0.5 truncate text-ink2">“{r.note}”</div>}
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-ink2">
              {r.cause}{'\n\n'}{r.report}
            </pre>
            <div className="mt-2 flex gap-1.5">
              <button
                onClick={() => navigator.clipboard?.writeText(`${r.route}\n${r.note ?? ''}\n\n${r.cause}\n\n${r.report}`)}
                className="rounded border border-line px-2 py-1 text-[11px] font-bold text-ink2 hover:bg-paper2">
                📋 복사
              </button>
              <button
                onClick={() => onUpdate({ ...r, status: r.status === 'open' ? 'done' : 'open' })}
                className="rounded border border-pine px-2 py-1 text-[11px] font-bold text-pine hover:bg-pine-soft">
                {r.status === 'open' ? '✓ 처리됨으로' : '↩ 다시 열기'}
              </button>
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
