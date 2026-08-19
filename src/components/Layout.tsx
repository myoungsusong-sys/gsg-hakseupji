import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { SUBJECTS, useSubject } from '../lib/subject'
import { brandFor, DEFAULT_ACADEMY } from '../lib/brand'
import { useChangelog, UpdateBanner, UpdateLogModal } from './UpdateLog'
import FixItButton from './FixItButton'
import { useAuth } from '../lib/auth'
import { teacherEmailOf } from '../lib/role'
import { BrandLogo } from './BrandMark'
import AiApprovalPanel from './lesson/AiApprovalPanel'
import AdminChat from './AdminChat'

// ── 알림센터: 최근 채점(학생 제출)·출제 이벤트를 알림으로 파생 ─────────
interface Notif {
  id: string
  date: string   // ISO
  text: string
}

const NOTIF_READ_KEY = 'gsg-notif-read-at'

function useNotifications(): { items: Notif[]; unread: number; markRead: () => void } {
  const { gradings, assignments, students, worksheets } = useStore()
  const [readAt, setReadAt] = useState<string>(() => {
    try { return localStorage.getItem(NOTIF_READ_KEY) ?? '' } catch { return '' }
  })

  const items = useMemo(() => {
    const nameOf = new Map(students.map(s => [s.id, s.name]))
    const wsOf = new Map(worksheets.map(w => [w.id, w.title]))
    const out: Notif[] = []
    for (const g of gradings) {
      if (g.imported) continue
      const name = nameOf.get(g.studentId)
      if (!name) continue
      const total = g.results.length
      const correct = g.results.filter(r => r.correct).length
      const title = g.title ?? (g.worksheetId ? wsOf.get(g.worksheetId) : undefined)
      out.push({
        id: 'n-gr-' + g.id,
        date: g.date,
        text: g.by === 'student'
          ? `${name} 학생 제출 — ${title ?? '학습지'} (${correct}/${total})`
          : `${name} 채점 완료 — ${title ?? (g.source ?? '교재')} (${correct}/${total})`,
      })
    }
    for (const a of assignments) {
      const name = nameOf.get(a.studentId)
      if (!name) continue
      out.push({
        id: 'n-as-' + a.id,
        date: a.date,
        text: `${name} 학생에게 ${a.kind} 출제 — ${wsOf.get(a.worksheetId) ?? '학습지'}`,
      })
    }
    return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)
  }, [gradings, assignments, students, worksheets])

  const unread = readAt ? items.filter(n => n.date > readAt).length : items.length
  const markRead = () => {
    const now = new Date().toISOString()
    setReadAt(now)
    try { localStorage.setItem(NOTIF_READ_KEY, now) } catch { /* 무시 */ }
  }
  return { items, unread, markRead }
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return iso
  const min = Math.floor((Date.now() - t) / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  return d < 7 ? `${d}일 전` : iso.slice(0, 10)
}

// ── 🏫 지점 선택 (헤더 우측 학원명 자리) ───────────────────────────────
//
// 🔴 지점이 1개 이하면 이 컴포넌트는 **아예 렌더되지 않는다**(Layout의 multiBranch 분기).
//    지점을 안 쓰는 학원에서는 헤더가 예전과 글자 하나까지 같아야 한다.
//
// 왜 과목 스위처(세그먼트) 옆이 아닌가: 헤더 한 줄에 로고+5탭+과목4버튼+내신관+아이콘3개가
// 이미 들어차 있다. 지점명은 사용자가 짓는 가변 길이라 세그먼트로 두면 이름을 길게 지은 날
// 헤더가 깨진다. 학원명 버튼을 드롭다운으로 바꾸는 편이 자리를 안 먹는다.
function BranchMenu({ academyName }: { academyName: string }) {
  const nav = useNavigate()
  const { branches, branchScope, setBranchScope } = useStore()
  const [open, setOpen] = useState(false)
  const cur = branches.find(b => b.id === branchScope)

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} title="지점 선택 · 마이페이지"
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold hover:bg-paper2">
        <span>{academyName}</span>
        <span className={cur ? 'text-pine' : 'text-ink2'}>· {cur?.name ?? '전체 지점'}</span>
        <span className="text-[10px] text-ink2">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-1 w-52 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-xl">
            <div className="px-3 py-1.5 text-[11px] font-bold text-ink2">지점</div>
            {branches.map(b => (
              <button key={b.id} onClick={() => { setBranchScope(b.id); setOpen(false) }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-paper2 ${
                  branchScope === b.id ? 'font-bold text-pine' : ''}`}>
                <span className="w-3">{branchScope === b.id ? '✓' : ''}</span>{b.name}
              </button>
            ))}
            <button onClick={() => { setBranchScope('all'); setOpen(false) }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-paper2 ${
                !cur ? 'font-bold text-pine' : ''}`}>
              <span className="w-3">{!cur ? '✓' : ''}</span>전체 지점 보기
            </button>
            <div className="my-1 border-t border-line/70" />
            <button onClick={() => { setOpen(false); nav('/mypage') }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-paper2">마이페이지</button>
          </div>
        </>
      )}
    </div>
  )
}

// 매쓰플랫 실측(2026-08-15, 1440창): 폰트 18px · 패딩 12/16 · whitespace-nowrap ·
// **활성만 700, 나머지는 500**. 우리는 15px·전부 700·줄바꿈 허용이라
// 1280 화면에서 「수업 준비」가 두 줄로 접히며 헤더가 86px 로 부풀었다(매쓰플랫 61px).
const topTab = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-full px-4 py-3 text-[18px] leading-[24px] transition ${
    isActive ? 'font-bold text-pine-dark' : 'font-medium text-ink2 hover:text-ink'
  }`

// 매쓰플랫 헤더 구성 동일: 로고 | 수업 준비·수업·관리 | (우측) 내신관 · 알림 · 학원명(→마이페이지)
export default function Layout() {
  const nav = useNavigate()
  const { academyProfile, multiBranch, teachers } = useStore()
  const { email } = useAuth()
  const [subject, setSubject] = useSubject()   // 전역 과목 (수업 준비 화면 공용)
  const [bell, setBell] = useState(false)
  const { entries: changelog, stale, unseen } = useChangelog()
  const [logOpen, setLogOpen] = useState(false)
  const { items, unread, markRead } = useNotifications()
  // 🔴 선생님 오류·요청 보고에 **누가 올렸는지**를 싣는다. 예전엔 who 를 안 넘겨서
  //    선생님 보고가 전원 익명이었다 — 누가 부탁했는지 모르면 되물을 수도, 자동 처리할 수도 없다.
  //    강사 계정은 t-<loginId>@teacher.gsg.app 규약이라 teachers 에서 이름을 찾고,
  //    원장 계정은 실제 이메일이라 teachers 에 없다 → 이메일을 그대로 쓴다.
  const meTeacher = teachers.find(t => t.loginId && teacherEmailOf(t.loginId) === (email ?? '').toLowerCase())

  // 세션 중 새 알림 도착 시 우하단 토스트 "새로운 알림 N건이 있어요"
  const [toast, setToast] = useState(0)
  const prevTop = useRef<string | null>(null)
  useEffect(() => {
    const top = items[0]?.id ?? null
    if (prevTop.current !== null && top && top !== prevTop.current) {
      const idx = items.findIndex(n => n.id === prevTop.current)
      setToast(idx === -1 ? items.length : idx)
    }
    prevTop.current = top
  }, [items])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(0), 6000)
    return () => clearTimeout(t)
  }, [toast])

  const academyName = brandFor(academyProfile.academyName?.trim() || DEFAULT_ACADEMY, subject)

  // [맨 위로] 플로팅 버튼 — 스크롤이 내려가면 표시 (매쓰플랫 동일)
  const [showTop, setShowTop] = useState(false)
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen">
      {/* 선생님 화면은 자동 새로고침 금지 — 채점 도중 리로드되면 채점하던 학생·진행이 날아간다 */}
      {stale && <UpdateBanner auto={false} items={unseen.length ? unseen : changelog.slice(0, 1)} />}
      <header className="no-print sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex w-full items-center gap-6 px-6 py-1.5">
          <button onClick={() => nav('/')} className="flex items-center">
            <BrandLogo />
          </button>
          <nav className="flex gap-1">
            <NavLink to="/prep/worksheet" className={topTab}>수업 준비</NavLink>
            <NavLink to="/lesson" className={topTab}>수업</NavLink>
            <NavLink to="/today" className={topTab}>오늘 교실</NavLink>
            <NavLink to="/manage" className={topTab}>관리</NavLink>
            <NavLink to="/points" className={topTab}>포인트</NavLink>
          </nav>
          {/* 전역 과목 스위처 — 출제·문제은행·기출·채점·보고서가 이 과목을 따른다 (확장: lib/subject.ts SUBJECTS에 추가) */}
          <div className="flex gap-0.5 rounded-lg bg-paper2 p-0.5" title="과목 — 수업 준비·채점·보고서에 적용됩니다">
            {SUBJECTS.map(s => (
              <button key={s} onClick={() => setSubject(s)}
                className={`whitespace-nowrap rounded-md px-3.5 py-1 text-sm font-bold transition ${subject === s ? 'bg-pine text-paper shadow-sm' : 'text-ink2 hover:text-ink'}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="grow" />
          <button onClick={() => nav('/prep/school-exam')}
            className="whitespace-nowrap rounded-full bg-amber px-4 py-1.5 text-sm font-bold text-white shadow-sm transition hover:brightness-105">
            내신관
          </button>
          <FixItButton app="teacher" who={meTeacher?.name ?? email ?? undefined} appVersion={changelog[0]?.ts} />
          <button onClick={() => setLogOpen(true)} title="업데이트 이력"
            className="relative rounded-full px-2 py-1.5 text-lg hover:bg-paper2">
            📋
            {stale && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-clay" />}
          </button>
          <button onClick={() => { setBell(v => !v); if (!bell) markRead() }} title="알림"
            className="relative rounded-full px-2 py-1.5 text-lg hover:bg-paper2">
            🔔
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          {multiBranch
            ? <BranchMenu academyName={academyName} />
            : <button onClick={() => nav('/mypage')} title="마이페이지"
                className="max-w-[14rem] truncate whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-bold hover:bg-paper2">{academyName}</button>}
        </div>
      </header>

      {/* 알림센터 (매쓰플랫: 우측 슬라이드 패널) */}
      {bell && (
        <div className="no-print fixed inset-0 z-30" onClick={() => setBell(false)}>
          <div className="absolute right-0 top-0 h-full w-80 border-l border-line bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center">
              <h3 className="font-black">알림센터</h3>
              <div className="grow" />
              <button onClick={() => setBell(false)} className="text-ink2 hover:text-ink">✕</button>
            </div>
            {items.length === 0 ? (
              <div className="pt-16 text-center text-sm text-ink2">
                <div className="mb-2 text-3xl">🔕</div>
                아직 알림이 없어요.
              </div>
            ) : (
              <div className="grid max-h-[calc(100vh-6rem)] gap-2 overflow-y-auto pr-1">
                {items.map(n => (
                  <div key={n.id} className="rounded-xl border border-line/70 px-3 py-2.5 text-sm">
                    <div className="leading-snug">{n.text}</div>
                    <div className="mt-0.5 text-xs text-ink2">{timeAgo(n.date)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 업데이트 이력 창 */}
      {logOpen && <UpdateLogModal entries={changelog} onClose={() => setLogOpen(false)} />}

      {/* 새 알림 토스트 (우하단) */}
      {toast > 0 && (
        <button onClick={() => { setToast(0); setBell(true); markRead() }}
          className="no-print fixed bottom-6 right-6 z-40 rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold shadow-lg hover:border-pine">
          🔔 새로운 알림 {toast}건이 있어요
        </button>
      )}

      {/* [맨 위로] 플로팅 버튼 (우하단) */}
      {showTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} title="맨 위로"
          className={`no-print fixed right-6 z-40 h-11 w-11 rounded-full border border-line bg-white text-lg shadow-lg hover:border-pine ${toast > 0 ? 'bottom-24' : 'bottom-6'}`}>
          ↑
        </button>
      )}

      {/* AI 1차 채점 승인 큐 — 대기 문항 있을 때만 플로팅 뱃지 (모든 선생님 화면) */}
      <AiApprovalPanel />

      {/* 💬 클로드에게 말로 고치기 (좌하단 — 우하단은 [맨 위로]·승인 큐가 쓴다) */}
      <AdminChat />

      <Outlet />
    </div>
  )
}
