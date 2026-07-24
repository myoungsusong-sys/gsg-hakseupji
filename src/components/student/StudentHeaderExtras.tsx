import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Student } from '../../types'
import { useStore } from '../../lib/store'
import { SUPABASE_ON, supabase } from '../../lib/supabase'
import { PREVIEW_LOCK_TITLE } from '../../pages/student/common'

// ── 학생앱 헤더 부가 기능 (매쓰플랫 헤더: 💬 의견 남기기 · 🔔 알림 · ❓ 도움말 · 👤 마이페이지) ──
// StudentShell(실사용)과 StudentAppPreview(선생님 미리보기) 공용. preview=true면 쓰기 동작 잠금.

interface Notif { id: string; date: string; icon: string; text: string }

const seenKey = (sid: string) => `stu-notif-seen-${sid}`

export default function StudentHeaderExtras({ me, preview = false, onLogout }: {
  me: Student; preview?: boolean; onLogout?: () => void
}) {
  const { assignments, worksheets, gradings, workbooks } = useStore()
  const [open, setOpen] = useState<null | 'feedback' | 'notif' | 'guide' | 'my'>(null)

  // ── 알림 목록: 새 학습지 배정 + 선생님 채점 완료 (최근 30일, 최신순 15건) ──
  const notifs = useMemo<Notif[]>(() => {
    const cut = new Date(Date.now() - 30 * 864e5).toISOString()
    const out: Notif[] = []
    const wsMap = new Map(worksheets.map(w => [w.id, w]))
    for (const a of assignments) {
      if (a.studentId !== me.id || a.date < cut) continue
      const ws = wsMap.get(a.worksheetId)
      if (!ws || ws.deletedAt) continue
      out.push({ id: `as-${a.id}`, date: a.date, icon: '📄', text: `새 ${a.kind === '숙제' ? '숙제' : '학습지'}가 도착했어요 — ${ws.title}` })
    }
    for (const g of gradings) {
      if (g.studentId !== me.id || g.by === 'student' || g.date < cut) continue
      const label = g.worksheetId ? wsMap.get(g.worksheetId)?.title
        : g.workbookId ? workbooks.find(w => w.id === g.workbookId)?.name : g.title
      if (!label) continue
      out.push({ id: `gr-${g.id}`, date: g.date, icon: '✅', text: `선생님이 채점을 완료했어요 — ${label}` })
    }
    return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15)
  }, [assignments, worksheets, gradings, workbooks, me.id])

  const hasNew = useMemo(() => {
    if (notifs.length === 0) return false
    const seen = localStorage.getItem(seenKey(me.id)) ?? ''
    return notifs[0].date > seen
  }, [notifs, me.id])

  function openNotif() {
    try { localStorage.setItem(seenKey(me.id), new Date().toISOString()) } catch { /* 무시 */ }
    setOpen('notif')
  }

  const btn = 'rounded-lg border border-line px-2.5 py-1.5 text-sm font-semibold text-ink2 hover:bg-paper2'

  return (
    <>
      <button onClick={() => setOpen('feedback')} className={btn} title="의견 남기기">💬 <span className="hidden lg:inline">의견 남기기</span></button>
      <button onClick={openNotif} className={`relative ${btn}`} title="알림">
        🔔{hasNew && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-clay" />}
      </button>
      <button onClick={() => setOpen('guide')} className={btn} title="사용가이드">❓</button>
      <button onClick={() => setOpen('my')} className="text-sm font-bold hover:text-pine" title="마이페이지">
        👤 {me.name}<span className="ml-1 font-normal text-ink2">학생</span>
      </button>
      {onLogout && (
        <button
          onClick={() => { if (!preview && confirm(`${me.name} 학생, 로그아웃할까요?`)) onLogout() }}
          disabled={preview} title={preview ? PREVIEW_LOCK_TITLE : '로그아웃'}
          className="rounded-lg border border-line px-2.5 py-1.5 text-sm font-semibold text-clay hover:bg-red-50 disabled:opacity-40">
          🔒 <span className="hidden lg:inline">로그아웃</span>
        </button>
      )}

      {open === 'feedback' && <FeedbackModal me={me} preview={preview} onClose={() => setOpen(null)} />}
      {open === 'notif' && <NotifModal notifs={notifs} onClose={() => setOpen(null)} />}
      {open === 'guide' && <GuideModal onClose={() => setOpen(null)} />}
      {open === 'my' && <MyPageModal me={me} preview={preview} onLogout={onLogout} onClose={() => setOpen(null)} />}
    </>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-start gap-3">
          <h2 className="text-lg font-black">{title}</h2>
          <div className="grow" />
          <button onClick={onClose} className="rounded-lg px-2 py-0.5 text-lg text-ink2 hover:bg-paper2">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── 💬 의견 남기기 (원본 모달 구조 — 제출은 로컬 수신함에 저장, 단일 학원이라 선생님이 확인) ──
function FeedbackModal({ me, preview, onClose }: { me: Student; preview: boolean; onClose: () => void }) {
  const [text, setText] = useState('')
  function submit() {
    if (!text.trim() || preview) return
    try {
      const raw = localStorage.getItem('stu-feedbacks')
      const list = raw ? JSON.parse(raw) as unknown[] : []
      list.push({ studentId: me.id, name: me.name, text: text.trim(), at: new Date().toISOString() })
      localStorage.setItem('stu-feedbacks', JSON.stringify(list))
    } catch { /* 쿼터 초과 무시 */ }
    alert('의견이 전달되었어요. 감사합니다!')
    onClose()
  }
  return (
    <Modal title="의견 남기기" onClose={onClose}>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={5}
        placeholder="학생앱을 사용해보고 느낀 점, 불편한 점 등 자유롭게 의견을 남겨주세요 (욕설 및 비속어는 지양해주세요.)"
        className="w-full rounded-xl border border-line p-3 text-sm" />
      <button onClick={submit} disabled={!text.trim() || preview}
        title={preview ? PREVIEW_LOCK_TITLE : undefined}
        className="mt-3 w-full rounded-lg bg-pine py-2.5 text-sm font-bold text-paper hover:brightness-110 disabled:opacity-40">
        제출하기
      </button>
    </Modal>
  )
}

// ── 🔔 알림 ──
function NotifModal({ notifs, onClose }: { notifs: Notif[]; onClose: () => void }) {
  return (
    <Modal title="알림" onClose={onClose}>
      {notifs.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink2">아직 알림이 없어요.</p>
      ) : (
        <div className="grid gap-2">
          {notifs.map(n => (
            <div key={n.id} className="flex items-start gap-2.5 rounded-xl border border-line/70 px-3.5 py-2.5">
              <span className="text-base leading-none">{n.icon}</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-snug">{n.text}</div>
                <div className="mt-0.5 text-[11px] text-ink2">
                  {n.date.slice(0, 10).replace(/-/g, '.')} {n.date.slice(11, 16)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ── ❓ 사용가이드 (가이드 영상은 자체 제작 대기 — 우선 텍스트 안내) ──
function GuideModal({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ['학습 홈', '오늘의 학습·이번주 학습정보와 선생님이 내준 학습지·교재를 한눈에 봐요.'],
    ['챌린지', '유형별로 개념 → 기본 → 심화 문제를 스스로 골라 풀어요.'],
    ['교재', '수업 시간에 선생님이 채점한 교재 결과를 페이지별로 확인해요.'],
    ['학습지', '선생님이 내준 학습지를 풀고 제출하면 바로 자동 채점돼요. 완료 후 오답학습·심화학습으로 반복 연습!'],
    ['강의', '선생님이 출제한 강의(풀이 영상 숙제)를 보는 곳이에요. 지금 준비 중이에요.'],
  ]
  return (
    <Modal title="사용가이드" onClose={onClose}>
      <div className="grid gap-2.5">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-paper2/60 px-3.5 py-2.5">
            <b className="text-sm text-pine-dark">{k}</b>
            <p className="mt-0.5 text-xs leading-relaxed text-ink2">{v}</p>
          </div>
        ))}
        <p className="text-center text-[11px] text-ink2/70">🎬 가이드 영상은 준비 중이에요.</p>
      </div>
    </Modal>
  )
}

// ── 👤 마이페이지 (계정 카드: 학년·아이디·출석 번호 + 비밀번호 변경 + 로그아웃) ──
function MyPageModal({ me, preview, onLogout, onClose }: {
  me: Student; preview: boolean; onLogout?: () => void; onClose: () => void
}) {
  const [pwMode, setPwMode] = useState(false)
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)

  async function changePw() {
    if (preview || !supabase) return
    if (pw1.length < 6) { alert('비밀번호는 6자 이상이어야 해요.'); return }
    if (pw1 !== pw2) { alert('두 비밀번호가 서로 달라요. 다시 확인해주세요.'); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw1 })
    setBusy(false)
    if (error) { alert(`비밀번호 변경에 실패했어요: ${error.message}`); return }
    alert('비밀번호가 변경되었어요.')
    setPwMode(false); setPw1(''); setPw2('')
  }

  return (
    <Modal title="마이페이지" onClose={onClose}>
      <div className="rounded-2xl border border-line p-5">
        <div className="text-lg font-black">{me.name}</div>
        <dl className="mt-3 grid gap-1.5 text-sm">
          <div className="flex gap-3"><dt className="w-16 text-ink2">학년</dt><dd className="font-semibold">{me.grade}</dd></div>
          <div className="flex gap-3"><dt className="w-16 text-ink2">아이디</dt><dd className="font-semibold">{me.loginId ?? me.attendNo ?? '—'}</dd></div>
          <div className="flex gap-3"><dt className="w-16 text-ink2">출석 번호</dt><dd className="font-semibold">{me.attendNo ?? '—'}</dd></div>
        </dl>

        {!pwMode ? (
          <div className="mt-4 flex gap-2">
            <button onClick={() => SUPABASE_ON
              ? setPwMode(true)
              : alert('로컬 모드에서는 비밀번호가 없어요 — 이름과 출결 번호로 입장해요.\n(비밀번호 변경은 계정 모드에서만 가능해요.)')}
              disabled={preview} title={preview ? PREVIEW_LOCK_TITLE : undefined}
              className="grow rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-paper2 disabled:opacity-40">
              ✏️ 비밀번호 변경
            </button>
            {onLogout && (
              <button onClick={onLogout} disabled={preview} title={preview ? PREVIEW_LOCK_TITLE : undefined}
                className="grow rounded-lg border border-line px-3 py-2 text-sm font-semibold text-clay hover:bg-red-50 disabled:opacity-40">
                🔒 로그아웃
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 grid gap-2">
            <input type="password" value={pw1} onChange={e => setPw1(e.target.value)} placeholder="새 비밀번호 (6자 이상)"
              className="rounded-lg border border-line px-3 py-2 text-sm" />
            <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder="새 비밀번호 확인"
              className="rounded-lg border border-line px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button onClick={changePw} disabled={busy || !pw1 || !pw2}
                className="grow rounded-lg bg-pine py-2 text-sm font-bold text-paper hover:brightness-110 disabled:opacity-40">
                {busy ? '변경 중…' : '변경하기'}
              </button>
              <button onClick={() => { setPwMode(false); setPw1(''); setPw2('') }}
                className="rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-paper2">취소</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
