import { useState } from 'react'
import { createPortal } from 'react-dom'
import { recentErrors, recentHops, storageUsage } from '../lib/errorLog'
import { useStore, uid } from '../lib/store'
import type { BugReport } from '../types'
import { notifyKakao, shouldNotify } from '../lib/notify'
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

// 🔴 "아직 안 끝난 것" 판정을 한 곳에 모은다. 예전엔 r.status === 'open' 비교가 네 군데에
//    흩어져 있어서, 상태를 늘리면(doing·shipped·declined) 배지 숫자와 목록 건수가
//    크래시 없이 조용히 어긋난다 — 이 코드베이스에서 가장 흔한 결함 유형이다.
const isOpen = (r: BugReport) => r.status === 'open' || r.status === 'doing'

const STATUS_LABEL: Record<string, string> = {
  open: '접수됨', doing: '작업중', shipped: '반영됨', declined: '안 하기로', done: '처리됨',
}

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
  const openCount = app === 'teacher' ? bugReports.filter(isOpen).length : 0
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        title={openCount ? `안 본 오류 보고 ${openCount}건` : '화면이 이상할 때 눌러요'}
        className={`relative whitespace-nowrap ${className || 'rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink2 hover:bg-paper2'}`}>
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
  // ── ✏️ 개선 요청 (선생님 전용) ──
  // 🔴 학생앱에는 열지 않는다. 72명 × 잡담이 인박스를 덮으면 선생님 요청이 묻힌다.
  const [mode, setMode] = useState<'diag' | 'request'>('diag')
  const [why, setWhy] = useState<'수업막힘' | '오래걸림' | '학생혼란' | '있으면편함'>('있으면편함')
  const [scope, setScope] = useState<'나만' | '선생님전체' | '학생화면'>('나만')
  const [sent, setSent] = useState<string>('')        // 접수번호 — 그냥 닫으면 같은 요청이 또 온다
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

  // ✏️ 개선 요청 제출 — 저장 + 즉시 텔레그램. AI 진단을 거치지 않는다(오류가 아니라 요청이므로).
  async function submitRequest() {
    const t = note.trim()
    if (!t) { setErr('무엇을 바꾸면 좋을지 한 줄 적어주세요.'); return }
    setBusy(true); setErr('')
    const r: BugReport = {
      id: uid('req'), at: new Date().toISOString(), app: 'teacher',
      route: location.hash || '#/', routeTitle: document.title,
      who, note: t, kind: 'request', why, scope,
      cause: '', report: '', fixable: false, status: 'open', appVersion,
    }
    try { saveBugReport(r) } catch { /* 저장 실패해도 알림은 보낸다 */ }
    // 🔴 shouldNotify(30분 중복 억제)를 걸지 않는다 — 그건 같은 오류 도배를 막는 장치이고,
    //    요청은 한 건도 빠지면 안 된다.
    notifyKakao({
      title: `✏️ 개선 요청 — ${who ?? '선생님'}`,
      text: [
        `화면: ${r.routeTitle ?? ''} ${r.route}`,
        `왜: ${why} · 범위: ${scope}`,
        `"${t}"`,
        scope === '학생화면' ? '🔴 학생 화면이 바뀌는 요청 — 확인 필요' : '',
        `접수번호 ${r.id}`,
      ].filter(Boolean).join('\n'),
      url: 'https://gsg-hakseupji.vercel.app/#/lesson',
    }).catch(() => { /* 알림 실패는 접수를 무르지 않는다 */ })
    setSent(r.id); setNote(''); setBusy(false)
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

    // 카톡 알림 — **화면에서 못 고친 건(코드 확인 필요)만** 보낸다. 자동으로 해결된 것까지
    // 보내면 알림 피로로 정작 중요한 걸 놓친다. 같은 화면·같은 원인은 30분에 한 번만.
    if (!d.fixable && shouldNotify(`${r.route}|${d.cause.slice(0, 40)}`)) {
      notifyKakao({
        title: '🛠 학습지앱 오류 보고',
        text: `${r.who ?? (app === 'teacher' ? '선생님' : '학생')} · ${r.route}\n`
          + `${note ? `"${note}"\n` : ''}${d.cause}`,
        url: 'https://gsg-hakseupji.vercel.app/#/lesson',
      }).catch(() => { /* 알림 실패는 무시 — 보고는 이미 저장됐다 */ })
    }
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
          <h2 className="text-base font-black">🛠 무엇을 도와드릴까요</h2>
          <button onClick={onClose} className="text-xl leading-none text-ink2 hover:text-ink">×</button>
        </div>

        {!diag && mode === 'diag' && !sent && (
          <>
            <p className="mb-2 text-sm text-ink2">
              무엇이 이상한지 한 줄로 적어주면 더 잘 찾아요. (안 적어도 괜찮아요)
            </p>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} disabled={busy}
              placeholder="예) 채점하려고 하는데 화면이 갑자기 바뀌어요 / 문제가 안 보여요"
              className="w-full rounded-xl border border-line p-3 text-sm" />
            <button onClick={diagnose} disabled={busy}
              className="mt-3 w-full rounded-lg bg-pine py-2.5 text-sm font-bold text-paper hover:brightness-110 disabled:opacity-50">
              {busy ? 'AI가 이 화면을 살펴보는 중…' : '🔧 지금 고쳐주세요 (AI 점검)'}
            </button>
            {/* 선생님만 — 오류가 아니라 "이렇게 바꿔주세요"를 올리는 창구 */}
            {app === 'teacher' && (
              <button onClick={() => { setMode('request'); setErr('') }} disabled={busy}
                className="mt-2 w-full rounded-lg border border-pine py-2.5 text-sm font-bold text-pine hover:bg-pine-soft disabled:opacity-50">
                ✏️ 이렇게 바꿔주세요 (개선 요청)
              </button>
            )}
            <p className="mt-2 text-[11px] text-ink2/70">
              이 화면의 주소·오류 기록·저장 공간만 보내요. 이름이나 답안은 보내지 않아요.
            </p>
            {err && <p className="mt-2 text-xs font-semibold text-clay">{err}</p>}
            {app === 'teacher' && <TeacherInbox reports={bugReports} onUpdate={saveBugReport} />}
          </>
        )}

        {/* ✏️ 개선 요청 작성 */}
        {mode === 'request' && !sent && (
          <div className="grid gap-3">
            <p className="text-sm text-ink2">
              이 화면(<b className="text-ink">{document.title}</b>)에서 무엇을 바꾸면 좋을까요?
            </p>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} disabled={busy}
              placeholder="예) 이 목록을 반별로 묶어서 보여주세요 / 오답 개수 옆에 학년도 같이 보이면 좋겠어요"
              className="w-full rounded-xl border border-line p-3 text-sm" />
            <div className="grid gap-1.5">
              <span className="text-xs font-bold text-ink2">왜 필요한가요?</span>
              <div className="flex flex-wrap gap-1.5">
                {(['수업막힘', '오래걸림', '학생혼란', '있으면편함'] as const).map(v => (
                  <button key={v} type="button" onClick={() => setWhy(v)}
                    className={`rounded-full px-3 py-1 text-xs font-bold ${why === v ? 'bg-pine text-paper' : 'border border-line text-ink2'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs font-bold text-ink2">누구에게 적용되나요?</span>
              <div className="flex flex-wrap gap-1.5">
                {(['나만', '선생님전체', '학생화면'] as const).map(v => (
                  <button key={v} type="button" onClick={() => setScope(v)}
                    className={`rounded-full px-3 py-1 text-xs font-bold ${scope === v ? 'bg-pine text-paper' : 'border border-line text-ink2'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            {err && <p className="text-xs font-semibold text-clay">{err}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setMode('diag'); setErr('') }} disabled={busy}
                className="rounded-lg border border-line px-4 py-2.5 text-sm font-bold text-ink2">← 뒤로</button>
              <button onClick={submitRequest} disabled={busy}
                className="grow rounded-lg bg-pine py-2.5 text-sm font-bold text-paper hover:brightness-110 disabled:opacity-50">
                {busy ? '보내는 중…' : '요청 보내기'}
              </button>
            </div>
          </div>
        )}

        {/* 접수 확인 — 그냥 닫으면 며칠 뒤 같은 요청이 다시 올라온다 */}
        {sent && (
          <div className="grid gap-3">
            <div className="rounded-xl bg-pine-soft px-4 py-3">
              <div className="text-sm font-black text-pine-dark">✅ 접수했어요</div>
              <div className="mt-1 text-xs text-ink2">접수번호 <b className="text-ink">{sent}</b></div>
              <div className="mt-1.5 text-xs leading-relaxed text-ink2">
                명수쌤께 바로 전달됐어요. 어디까지 왔는지는 아래 <b>보고함</b>에서 볼 수 있어요.
              </div>
            </div>
            <button onClick={() => { setSent(''); setMode('diag') }}
              className="w-full rounded-lg border border-line py-2.5 text-sm font-bold text-ink2">확인</button>
            <TeacherInbox reports={bugReports} onUpdate={saveBugReport} />
          </div>
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
  const list = [...reports].reverse().filter(r => (showDone ? true : isOpen(r)))
  if (!reports.length) return null
  return (
    <div className="mt-4 border-t border-line pt-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-black">
          받은 보고·요청 {reports.filter(isOpen).length}건
        </span>
        <div className="flex items-center gap-2">
          <KakaoTest />
          <button onClick={() => setShowDone(v => !v)} className="text-[11px] font-semibold text-ink2 underline">
            {showDone ? '안 본 것만' : '처리한 것도 보기'}
          </button>
        </div>
      </div>
      {!list.length && <p className="py-2 text-xs text-ink2">안 본 보고가 없어요.</p>}
      <div className="grid max-h-64 gap-1.5 overflow-auto">
        {list.map(r => (
          <details key={r.id} className={`rounded-lg border px-3 py-2 ${isOpen(r) ? 'border-line' : 'border-line/50 opacity-60'}`}>
            <summary className="cursor-pointer text-[11px]">
              {/* 요청과 오류를 한눈에 구분 — 같은 통에 들어오지만 다른 물건이다 */}
              <span className="mr-1">{r.kind === 'request' ? '✏️' : '🔧'}</span>
              <b>{r.who ?? (r.app === 'teacher' ? '선생님' : '학생')}</b>
              <span className="text-ink2"> · {fmtWhen(r.at)} · {r.routeTitle || r.route}</span>
              <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                isOpen(r) ? 'bg-amber/20 text-ink' : 'bg-paper2 text-ink2'}`}>
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
              {r.kind === 'request' && r.why && (
                <span className="ml-1 text-[10px] text-ink2">{r.why} · {r.scope}</span>
              )}
              {r.kind !== 'request' && !r.fixable && <span className="ml-1 font-bold text-clay">코드 확인 필요</span>}
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
                onClick={() => onUpdate({ ...r, status: isOpen(r) ? 'shipped' : 'open' })}
                className="rounded border border-pine px-2 py-1 text-[11px] font-bold text-pine hover:bg-pine-soft">
                {isOpen(r) ? '✓ 반영됨으로' : '↩ 다시 열기'}
              </button>
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}

/** 카톡 알림이 실제로 오는지 확인하는 버튼 — 설정을 바꾼 뒤 여기서 바로 검증한다 */
function KakaoTest() {
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle')
  const [msg, setMsg] = useState('')
  async function go() {
    setState('busy'); setMsg('')
    const r = await notifyKakao({
      title: '🛠 학습지앱 알림 테스트',
      text: '이 메시지가 보이면 카톡 알림이 정상입니다.',
      url: 'https://gsg-hakseupji.vercel.app/#/lesson',
    })
    setState(r.ok ? 'ok' : 'fail')
    setMsg(r.ok ? (r.warn ?? '카톡을 확인해 보세요.') : (r.error ?? '전송 실패'))
  }
  return (
    <span className="flex items-center gap-1.5">
      <button onClick={go} disabled={state === 'busy'}
        className="text-[11px] font-semibold text-ink2 underline disabled:opacity-50">
        {state === 'busy' ? '보내는 중…' : '카톡 알림 테스트'}
      </button>
      {msg && <span className={`text-[10px] font-semibold ${state === 'ok' ? 'text-pine' : 'text-clay'}`}>{msg}</span>}
    </span>
  )
}
