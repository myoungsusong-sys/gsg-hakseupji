import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useStore } from '../lib/store'
import type { Grading, GradeResult, Student, StudentAppConfig, Teacher } from '../types'
import { studentEmailOf, teacherEmailOf } from '../lib/role'
import { SUPABASE_ON, supabase } from '../lib/supabase'
import StudentAppPreview from './student/StudentAppPreview'

const TABS = ['학생 관리', '반 관리', '선생님 관리', '학생앱', '실험실', '추가 관리'] as const
type Tab = typeof TABS[number]

const SCHOOL_FILTERS = ['전체', '초', '중', '고'] as const
type SchoolFilter = typeof SCHOOL_FILTERS[number]

type School = '초' | '중' | '고'
const SCHOOLS: School[] = ['초', '중', '고']
const GRADE_NUMS: Record<School, number[]> = {
  초: [1, 2, 3, 4, 5, 6], 중: [1, 2, 3], 고: [1, 2, 3],
}

// '중1-1' 과정형 → '중1' 짧은 표기
function shortenGrade(g: string): string {
  const m = g.match(/^(초|중|고)(\d)/)
  return m ? `${m[1]}${m[2]}` : g
}

function parseGrade(g: string): { sk: School; gn: number } {
  const m = g.match(/^(초|중|고)(\d)/)
  if (m) return { sk: m[1] as School, gn: Number(m[2]) }
  return { sk: '중', gn: 1 }
}

// 학년 정렬용 순위: 초1(1) … 초6(6) < 중1(11) … < 고3(23)
function gradeRank(g: string): number {
  const { sk, gn } = parseGrade(g)
  return ({ 초: 0, 중: 1, 고: 2 }[sk]) * 10 + gn
}

// 미사용 4자리 출결 번호 자동 생성 (기존 출결번호·loginId와 중복 회피)
function genAttendNo(used: Set<string>): string {
  for (let i = 0; i < 300; i++) {
    const n = String(Math.floor(1000 + Math.random() * 9000))
    if (!used.has(n)) return n
  }
  for (let n = 0; n < 10000; n++) {
    const s = String(n).padStart(4, '0')
    if (!used.has(s)) return s
  }
  return ''
}

export default function Students() {
  const [tab, setTab] = useState<Tab>('학생 관리')

  return (
    <div>
      <h1 className="mb-4 text-xl font-black">관리</h1>

      <div className="mb-6 flex gap-1 border-b border-line">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`-mb-px px-4 py-2.5 text-sm font-bold ${tab === t
              ? 'border-b-2 border-pine text-pine'
              : 'text-ink2 hover:text-ink'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === '학생 관리' && <StudentsTab />}
      {tab === '반 관리' && <KlassTab />}
      {tab === '선생님 관리' && <TeachersTab />}
      {tab === '학생앱' && <StudentAppTab />}
      {tab === '실험실' && <LabTab />}
      {tab === '추가 관리' && <ExtraTab onGoLab={() => setTab('실험실')} />}
    </div>
  )
}

// ── 공용 소품 ─────────────────────────────────────

function Switch({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={() => !disabled && onChange(!on)} aria-pressed={on}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-pine' : 'bg-line'} ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  )
}

function ScrollTopButton() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 240)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (!show) return null
  return (
    <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} title="맨 위로"
      className="no-print fixed bottom-6 right-6 z-30 rounded-full border border-line bg-white px-4 py-3 text-sm font-bold text-ink2 shadow-lg hover:border-pine hover:text-pine">
      ↑ 맨 위로
    </button>
  )
}

function Pagination({ page, count, onPage }: { page: number; count: number; onPage: (n: number) => void }) {
  if (count <= 1) return null
  const start = Math.max(1, Math.min(page - 2, count - 4))
  const nums = []
  for (let n = start; n <= Math.min(count, start + 4); n++) nums.push(n)
  const btn = 'min-w-8 rounded-lg border px-2 py-1 text-sm font-bold'
  return (
    <div className="mt-4 flex items-center justify-center gap-1">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}
        className={`${btn} border-line text-ink2 disabled:opacity-30`}>‹</button>
      {nums.map(n => (
        <button key={n} onClick={() => onPage(n)}
          className={`${btn} ${n === page ? 'border-pine bg-pine text-paper' : 'border-line text-ink2 hover:text-ink'}`}>
          {n}
        </button>
      ))}
      <button disabled={page >= count} onClick={() => onPage(page + 1)}
        className={`${btn} border-line text-ink2 disabled:opacity-30`}>›</button>
    </div>
  )
}

// ── 학생 관리 ─────────────────────────────────────

type Sort = 'latest' | 'nameAsc' | 'nameDesc' | 'gradeAsc' | 'gradeDesc'
const PAGE_SIZE = 20

function StudentsTab() {
  const { students, setStudentActive } = useStore()
  const [sort, setSort] = useState<Sort>('latest')
  const [filter, setFilter] = useState<SchoolFilter>('전체')
  const [query, setQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showMgmt, setShowMgmt] = useState(false)
  const [detail, setDetail] = useState<Student | null>(null)
  const [appPreview, setAppPreview] = useState<Student | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)

  const activeCount = students.filter(s => s.active).length
  const list = useMemo(() => {
    const q = query.trim()
    const filtered = students
      .filter(s => (showInactive ? true : s.active))
      .filter(s => filter === '전체' || s.grade.startsWith(filter))
      .filter(s => !q || s.name.includes(q))
    switch (sort) {
      case 'nameAsc': return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      case 'nameDesc': return [...filtered].sort((a, b) => b.name.localeCompare(a.name, 'ko'))
      case 'gradeAsc': return [...filtered].sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade) || a.name.localeCompare(b.name, 'ko'))
      case 'gradeDesc': return [...filtered].sort((a, b) => gradeRank(b.grade) - gradeRank(a.grade) || a.name.localeCompare(b.name, 'ko'))
      default: return [...filtered].reverse()
    }
  }, [students, showInactive, filter, sort, query])

  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const cur = Math.min(page, pageCount)
  const paged = list.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE)
  useEffect(() => { setPage(1) }, [filter, query, showInactive, sort])

  const pageAllChecked = paged.length > 0 && paged.every(s => sel.has(s.id))
  const togglePageAll = () => setSel(prev => {
    const next = new Set(prev)
    if (pageAllChecked) paged.forEach(s => next.delete(s.id))
    else paged.forEach(s => next.add(s.id))
    return next
  })
  const toggleOne = (id: string) => setSel(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const bulkActive = (active: boolean) => {
    if (sel.size === 0) return
    if (!confirm(`선택한 학생 ${sel.size}명을 ${active ? '재원' : '퇴원'} 처리할까요?`)) return
    for (const id of sel) setStudentActive(id, active)
    setSel(new Set())
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={sort} onChange={e => setSort(e.target.value as Sort)}
          className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm font-bold text-ink">
          <option value="latest">최신 등록순</option>
          <option value="nameAsc">이름 오름차순</option>
          <option value="nameDesc">이름 내림차순</option>
          <option value="gradeAsc">학년 오름차순</option>
          <option value="gradeDesc">학년 내림차순</option>
        </select>
        <div className="flex gap-1">
          {SCHOOL_FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-sm font-bold ${filter === f
                ? 'bg-pine text-paper'
                : 'border border-line bg-white text-ink2 hover:text-ink'}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0">
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="학생 이름 검색"
            className="w-40 rounded-l-lg border border-line bg-white px-3 py-1.5 text-sm" />
          <button title="검색" aria-label="검색"
            className="rounded-r-lg border border-l-0 border-line bg-white px-2.5 py-1.5 text-sm text-ink2">🔍</button>
        </div>
        <span className="text-sm font-bold text-ink2">재원생 <b className="text-pine">{activeCount}</b>명</span>
        <label className="flex items-center gap-1.5 text-sm text-ink2">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          퇴원생 보기
        </label>
        <div className="grow" />
        <button onClick={() => setShowMgmt(true)}
          className="rounded-lg border border-indigo-500 bg-white px-4 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50">🏫 학원관리앱 가져오기</button>
        <button onClick={() => setShowImport(true)}
          className="rounded-lg border border-pine bg-white px-4 py-2 text-sm font-bold text-pine hover:bg-pine-soft">매쓰플랫 가져오기</button>
        <button onClick={() => setShowBulk(true)}
          className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-bold text-ink2 hover:text-ink">학생 일괄 등록</button>
        <button onClick={() => setShowForm(true)}
          className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper">학생 개별 등록</button>
      </div>

      {sel.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-pine/40 bg-pine-soft px-4 py-2 text-sm">
          <b className="text-pine-dark">{sel.size}명 선택됨</b>
          <button onClick={() => bulkActive(true)}
            className="rounded-lg border border-line bg-white px-3 py-1 font-bold text-ink2 hover:text-pine">재원 처리</button>
          <button onClick={() => bulkActive(false)}
            className="rounded-lg border border-line bg-white px-3 py-1 font-bold text-ink2 hover:text-clay">퇴원 처리</button>
          <div className="grow" />
          <button onClick={() => setSel(new Set())} className="text-ink2 hover:text-ink">선택 해제 ✕</button>
        </div>
      )}

      {showForm && <RegisterModal onClose={() => setShowForm(false)} />}
      {showBulk && <BulkModal onClose={() => setShowBulk(false)} />}
      {showImport && <MathflatImportModal onClose={() => setShowImport(false)} />}
      {showMgmt && <MgmtImportModal onClose={() => setShowMgmt(false)} />}
      {detail && <DetailModal key={detail.id} s={detail} onClose={() => setDetail(null)} />}
      {appPreview && <StudentAppPreview key={appPreview.id} s={appPreview} onClose={() => setAppPreview(null)} />}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-ink2">
          {students.length === 0 ? '등록된 학생이 없습니다. 위에서 추가하세요.' : '조건에 맞는 학생이 없습니다.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper2 text-left text-xs text-ink2">
                <th className="w-8 px-3 py-2.5">
                  <input type="checkbox" checked={pageAllChecked} onChange={togglePageAll} title="이 페이지 전체 선택" />
                </th>
                <th className="px-2 py-2.5 font-bold">학년</th>
                <th className="px-3 py-2.5 font-bold">상태</th>
                <th className="px-3 py-2.5 font-bold">학생 이름</th>
                <th className="px-3 py-2.5 font-bold">학부모 연락처</th>
                <th className="px-3 py-2.5 font-bold">반</th>
                <th className="px-3 py-2.5 font-bold">학생 계정</th>
                <th className="px-3 py-2.5 font-bold">학생앱</th>
                <th className="px-3 py-2.5 font-bold">상세</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(s => {
                const acctId = s.loginId ?? s.attendNo
                return (
                  <tr key={s.id} className={`border-b border-line last:border-0 ${s.active ? '' : 'bg-paper2'}`}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={sel.has(s.id)} onChange={() => toggleOne(s.id)} />
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="rounded bg-paper2 px-2 py-0.5 text-xs font-bold text-ink2">{shortenGrade(s.grade)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {s.active
                        ? <span className="font-bold text-pine">재원</span>
                        : <span className="text-ink2">퇴원</span>}
                    </td>
                    <td className="px-3 py-2.5 font-bold">{s.name}</td>
                    <td className="px-3 py-2.5">{s.parentPhone ?? <span className="text-ink2">—</span>}</td>
                    <td className="px-3 py-2.5">{s.klass ?? <span className="text-ink2">—</span>}</td>
                    <td className="px-3 py-2.5">
                      {acctId ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-mono text-xs">{acctId}</span>
                          {SUPABASE_ON ? (
                            s.authEmail
                              ? <span className="rounded bg-pine-soft px-1.5 py-0.5 text-[10px] font-bold text-pine-dark">계정 생성됨</span>
                              : <span className="rounded bg-paper2 px-1.5 py-0.5 text-[10px] font-bold text-ink2">미생성</span>
                          ) : (
                            <span className="rounded bg-paper2 px-1.5 py-0.5 text-[10px] font-bold text-ink2">로컬 입장</span>
                          )}
                        </span>
                      ) : <span className="text-ink2">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => setAppPreview(s)}
                        title="이 학생 시점의 학생앱을 미리보기로 열어요 (보기 전용)"
                        className="rounded-lg border border-line px-2.5 py-1 text-xs font-bold text-ink2 hover:border-pine hover:text-pine">
                        학생앱으로 이동
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => setDetail(s)}
                        className="text-xs font-bold text-pine hover:underline">상세보기</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={cur} count={pageCount} onPage={setPage} />
      <ScrollTopButton />
    </div>
  )
}

// ── 학생 폼 공통 (개별 등록 · 상세 정보) ─────────────

interface FormState {
  name: string
  sk: School
  gn: number
  attendNo: string
  studentPhone: string
  parentPhone: string
  school: string
  startDate: string
  birth: string
  email: string
  address: string
  homePhone: string
  memo: string
  klass: string
  classDays: string[]
  arriveTime: string
  leaveTime: string
}

function emptyForm(): FormState {
  return {
    name: '', sk: '중', gn: 1, attendNo: '',
    studentPhone: '', parentPhone: '', school: '', startDate: '', birth: '',
    email: '', address: '', homePhone: '', memo: '', klass: '',
    classDays: [], arriveTime: '', leaveTime: '',
  }
}

function formFromStudent(s: Student): FormState {
  const { sk, gn } = parseGrade(s.grade)
  return {
    name: s.name, sk, gn, attendNo: s.attendNo ?? '',
    studentPhone: s.studentPhone ?? '', parentPhone: s.parentPhone ?? '',
    school: s.school ?? '', startDate: s.startDate ?? '', birth: s.birth ?? '',
    email: s.email ?? '', address: s.address ?? '', homePhone: s.homePhone ?? '',
    memo: s.memo ?? '', klass: s.klass ?? '',
    classDays: s.classDays ?? [], arriveTime: s.arriveTime ?? '', leaveTime: s.leaveTime ?? '',
  }
}

function validateForm(f: FormState, requireAttendNo: boolean): string | null {
  if (!f.name.trim()) return '이름을 입력하세요'
  const no = f.attendNo.trim()
  if (requireAttendNo && !/^\d{4}$/.test(no)) return '출결 번호는 4자리 숫자로 입력하세요'
  if (!requireAttendNo && no && !/^\d{4}$/.test(no)) return '출결 번호는 4자리 숫자로 입력하세요'
  return null
}

function formPayload(f: FormState): Omit<Student, 'id' | 'active'> {
  const t = (v: string) => v.trim() || undefined
  return {
    name: f.name.trim(),
    grade: `${f.sk}${f.gn}`,
    attendNo: t(f.attendNo),
    klass: t(f.klass),
    parentPhone: t(f.parentPhone),
    school: t(f.school),
    memo: t(f.memo),
    studentPhone: t(f.studentPhone),
    startDate: t(f.startDate),
    birth: t(f.birth),
    email: t(f.email),
    address: t(f.address),
    homePhone: t(f.homePhone),
    classDays: f.classDays.length ? f.classDays : undefined,
    arriveTime: t(f.arriveTime),
    leaveTime: t(f.leaveTime),
  }
}

const INPUT = 'w-full rounded-lg border border-line px-3 py-2 text-sm'

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">{title}</h2>
          <button onClick={onClose} aria-label="닫기"
            className="text-xl leading-none text-ink2 hover:text-ink">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] items-center gap-2 text-sm">
      <span className="font-bold">{label}</span>
      {children}
    </div>
  )
}

function StudentFields({ f, set, onRegenAttendNo }: {
  f: FormState; set: (p: Partial<FormState>) => void; onRegenAttendNo?: () => void
}) {
  return (
    <div className="grid gap-2.5">
      <p className="border-b border-line pb-1.5 text-sm font-black">필수 입력 사항</p>
      <Field label="학생 이름 (필수)">
        <input value={f.name} onChange={e => set({ name: e.target.value })} autoFocus
          placeholder="이름을 입력해주세요." className={INPUT} />
      </Field>
      <Field label="학년 (필수)">
        <div className="flex flex-wrap items-center gap-3">
          {SCHOOLS.map(k => (
            <label key={k} className="flex items-center gap-1">
              <input type="radio" name="school-kind" checked={f.sk === k}
                onChange={() => set({ sk: k, gn: Math.min(f.gn, GRADE_NUMS[k].length) })} />
              {k}
            </label>
          ))}
          <select value={f.gn} onChange={e => set({ gn: Number(e.target.value) })}
            className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm">
            {GRADE_NUMS[f.sk].map(n => <option key={n} value={n}>{n}학년</option>)}
          </select>
        </div>
      </Field>
      <Field label="출결 번호 (필수)">
        <div className="flex items-center gap-1.5">
          <input value={f.attendNo} onChange={e => set({ attendNo: e.target.value })}
            placeholder="4자리 숫자만 입력해주세요." maxLength={4} className={INPUT} />
          {onRegenAttendNo && (
            <button type="button" onClick={onRegenAttendNo} title="재생성 — 미사용 4자리 번호 자동 채움"
              className="shrink-0 rounded-lg border border-line px-2.5 py-2 text-sm hover:border-pine">🔄</button>
          )}
        </div>
      </Field>

      <p className="mt-2 border-b border-line pb-1.5 text-sm font-black">선택 입력 사항</p>
      <Field label="수업 요일">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1">
            {['월', '화', '수', '목', '금', '토', '일'].map(d => {
              const on = f.classDays.includes(d)
              return (
                <button key={d} type="button"
                  onClick={() => set({ classDays: on ? f.classDays.filter(x => x !== d) : [...f.classDays, d] })}
                  className={`h-8 w-8 rounded-full text-sm font-bold ${on ? 'bg-pine text-paper' : 'border border-line text-ink2 hover:border-pine'}`}>{d}</button>
              )
            })}
            <span className="ml-1 flex gap-1">
              <button type="button" onClick={() => set({ classDays: ['월', '수', '금'] })}
                className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-ink2 hover:border-pine">월·수·금</button>
              <button type="button" onClick={() => set({ classDays: ['화', '목', '토'] })}
                className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-ink2 hover:border-pine">화·목·토</button>
            </span>
          </div>
          <span className="text-xs text-ink2">보고서의 &lsquo;다음 수업일&rsquo;이 이 요일 기준으로 자동 계산됩니다.</span>
        </div>
      </Field>
      <Field label="기본 등·하원 시간">
        <div className="flex items-center gap-2 text-sm">
          <input type="time" value={f.arriveTime} onChange={e => set({ arriveTime: e.target.value })}
            className="rounded-lg border border-line px-2 py-1.5" />
          <span className="text-ink2">~</span>
          <input type="time" value={f.leaveTime} onChange={e => set({ leaveTime: e.target.value })}
            className="rounded-lg border border-line px-2 py-1.5" />
          <span className="text-xs text-ink2">등원 체크 시 기본값</span>
        </div>
      </Field>
      <Field label="학생 연락처">
        <input value={f.studentPhone} onChange={e => set({ studentPhone: e.target.value })}
          placeholder="숫자만 입력해주세요." className={INPUT} />
      </Field>
      <Field label="학부모 연락처">
        <input value={f.parentPhone} onChange={e => set({ parentPhone: e.target.value })}
          placeholder="숫자만 입력해주세요." className={INPUT} />
      </Field>
      <Field label="학교">
        <input value={f.school} onChange={e => set({ school: e.target.value })}
          placeholder="학교명을 입력해주세요." className={INPUT} />
      </Field>
      <Field label="수업 시작일">
        <input value={f.startDate} onChange={e => set({ startDate: e.target.value })}
          placeholder="YYYY.MM.DD" className={INPUT} />
      </Field>
      <Field label="학생 생년월일">
        <input value={f.birth} onChange={e => set({ birth: e.target.value })}
          placeholder="YYYY.MM.DD" className={INPUT} />
      </Field>
      <Field label="학생 이메일">
        <input value={f.email} onChange={e => set({ email: e.target.value })}
          placeholder="예시 : student@math.com" className={INPUT} />
      </Field>
      <Field label="집 주소">
        <input value={f.address} onChange={e => set({ address: e.target.value })}
          placeholder="주소를 입력해주세요." className={INPUT} />
      </Field>
      <Field label="집 전화">
        <input value={f.homePhone} onChange={e => set({ homePhone: e.target.value })}
          placeholder="숫자만 입력해주세요." className={INPUT} />
      </Field>
      <label className="grid grid-cols-[8.5rem_1fr] items-start gap-2 text-sm">
        <span className="pt-2 font-bold">비고 및 학생 특이사항</span>
        <textarea value={f.memo} onChange={e => set({ memo: e.target.value })} rows={3}
          placeholder={'내용을 입력해주세요.\n예시) 문제를 빨리 풀어서 실수가 잦음, 분수 계산이 약함, 중간고사-70점 / 기말고사-94점 등'}
          className={INPUT} />
      </label>
      <Field label="반">
        <input value={f.klass} onChange={e => set({ klass: e.target.value })}
          placeholder="반 이름을 입력해주세요." className={INPUT} />
      </Field>
    </div>
  )
}

// ── 학생 개별 등록 모달 ────────────────────────────

function RegisterModal({ onClose }: { onClose: () => void }) {
  const { students, addStudent } = useStore()
  const usedNos = useMemo(
    () => new Set(students.flatMap(s => [s.attendNo, s.loginId].filter(Boolean) as string[])),
    [students])
  const [f, setF] = useState<FormState>(() => ({ ...emptyForm(), attendNo: genAttendNo(usedNos) }))
  const [keepOpen, setKeepOpen] = useState(false)
  const set = (p: Partial<FormState>) => setF(prev => ({ ...prev, ...p }))

  const submit = () => {
    const err = validateForm(f, true)
    if (err) { alert(err); return }
    const no = f.attendNo.trim()
    if (usedNos.has(no)) { alert(`출결 번호 ${no}는 이미 사용 중입니다. 🔄 버튼으로 다시 생성하세요.`); return }
    addStudent(formPayload(f))
    if (keepOpen) setF({ ...emptyForm(), attendNo: genAttendNo(new Set([...usedNos, no])) })
    else onClose()
  }

  return (
    <Modal title="학생 개별 등록" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); submit() }}>
        <StudentFields f={f} set={set}
          onRegenAttendNo={() => set({ attendNo: genAttendNo(usedNos) })} />
        <div className="mt-5 flex items-center justify-between gap-3">
          <label className="flex items-center gap-1.5 text-sm text-ink2">
            <input type="checkbox" checked={keepOpen} onChange={e => setKeepOpen(e.target.checked)} />
            계속 학생 등록하기
          </label>
          <button type="submit" className="rounded-lg bg-pine px-6 py-2.5 text-sm font-bold text-paper">등록하기</button>
        </div>
      </form>
    </Modal>
  )
}

// ── 학생 상세 정보 모달 ────────────────────────────

function DetailModal({ s, onClose }: { s: Student; onClose: () => void }) {
  const { students, updateStudent, setStudentActive } = useStore()
  const [f, setF] = useState<FormState>(() => formFromStudent(s))
  const [active, setActive] = useState(s.active)
  const [showReset, setShowReset] = useState(false)
  const [showSibling, setShowSibling] = useState(false)
  const [copied, setCopied] = useState(false)
  const set = (p: Partial<FormState>) => setF(prev => ({ ...prev, ...p }))

  // 형제 연결 등 스토어 변경분 반영 (모달 열려 있는 동안)
  const live = students.find(x => x.id === s.id) ?? s
  const acctId = (live.loginId ?? f.attendNo.trim()) || undefined
  const siblings = (live.siblingIds ?? [])
    .map(id => students.find(x => x.id === id))
    .filter((x): x is Student => !!x)

  const save = () => {
    const err = validateForm(f, false)
    if (err) { alert(err); return }
    const patch = formPayload(f)
    // 학교급·학년을 바꾸지 않았으면 원본 grade('중1-1' 과정형 포함)를 보존
    if (patch.grade === shortenGrade(s.grade)) patch.grade = s.grade
    updateStudent(s.id, patch)
    if (active !== s.active) setStudentActive(s.id, active)
    onClose()
  }

  const disconnect = (other: Student) => {
    updateStudent(live.id, { siblingIds: (live.siblingIds ?? []).filter(id => id !== other.id) })
    updateStudent(other.id, { siblingIds: (other.siblingIds ?? []).filter(id => id !== live.id) })
  }

  const resetCmd = `node scripts/create-student-accounts.mjs --reset ${acctId ?? ''}`
  const copyCmd = () => {
    navigator.clipboard?.writeText(resetCmd).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Modal title="학생 상세 정보" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); save() }}>
        <div className="mb-2.5">
          <Field label="상태">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1">
                <input type="radio" name="student-active" checked={active} onChange={() => setActive(true)} />
                재원
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" name="student-active" checked={!active} onChange={() => setActive(false)} />
                퇴원
              </label>
            </div>
          </Field>
        </div>
        <StudentFields f={f} set={set} />

        {/* 학생앱 계정 (원본 '학생/학부모앱ID' 등가 — 학부모 계정은 미보유, 문자 전송은 학원관리앱 담당) */}
        <div className="mt-4 rounded-xl bg-paper2/70 px-4 py-3 text-sm">
          <div className="mb-0.5 text-xs font-bold text-ink2">학생앱 계정</div>
          {acctId ? (
            <div>
              아이디 <b className="font-mono">{acctId}</b> ㅣ 기본 비밀번호 <b className="font-mono">gsg{acctId}</b>
              {SUPABASE_ON
                ? (live.authEmail
                  ? <span className="ml-2 rounded bg-pine-soft px-1.5 py-0.5 text-[10px] font-bold text-pine-dark">계정 생성됨</span>
                  : <span className="ml-2 rounded bg-paper2 px-1.5 py-0.5 text-[10px] font-bold text-ink2">미생성 — 계정 일괄 생성 스크립트로 생성</span>)
                : <span className="ml-2 rounded bg-paper2 px-1.5 py-0.5 text-[10px] font-bold text-ink2">로컬 모드 — 이름+출결번호로 입장</span>}
            </div>
          ) : (
            <div className="text-ink2">출결 번호가 없어 학생앱 계정을 만들 수 없어요. 출결 번호를 입력해주세요.</div>
          )}
          {siblings.length > 0 && (
            <div className="mt-2 border-t border-line pt-2">
              <div className="mb-1 text-xs font-bold text-ink2">연결된 형제 (학부모 연락처 공유)</div>
              <div className="flex flex-wrap gap-1.5">
                {siblings.map(sib => (
                  <span key={sib.id} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-0.5 text-xs">
                    <b>{sib.name}</b> <span className="text-ink2">{shortenGrade(sib.grade)}</span>
                    <button type="button" onClick={() => disconnect(sib)} title="형제 연결 해제"
                      className="ml-0.5 text-ink2 hover:text-clay">✕</button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {showReset && (
          <div className="mt-3 rounded-xl border border-amber/40 bg-amber-soft px-4 py-3 text-sm">
            {!acctId ? (
              <p>출결 번호(아이디)가 없어 초기화할 계정이 없습니다.</p>
            ) : !SUPABASE_ON ? (
              <p>로컬 모드에서는 학생앱이 이름+출결번호로 입장하므로 비밀번호가 없습니다. (Supabase 모드에서 사용하는 기능이에요.)</p>
            ) : (
              <div>
                <p className="mb-1.5">
                  비밀번호를 기본값 <b className="font-mono">gsg{acctId}</b>로 초기화하려면 아래 명령을 실행하세요.
                  (보안상 브라우저에서는 다른 계정의 비밀번호를 바꿀 수 없어요 — service key 스크립트로 처리합니다.)
                </p>
                <div className="flex items-center gap-2">
                  <code className="grow rounded-lg bg-white px-2 py-1.5 font-mono text-xs">{resetCmd}</code>
                  <button type="button" onClick={copyCmd}
                    className="shrink-0 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink2 hover:text-pine">
                    {copied ? '✓ 복사됨' : '복사'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setShowReset(v => !v)}
            className="rounded-lg border border-line px-3.5 py-2.5 text-sm font-bold text-ink2 hover:border-pine hover:text-pine">
            학생 비밀번호 초기화
          </button>
          <button type="button" onClick={() => setShowSibling(true)}
            title="형제 학생과 연결하면 학부모 연락처를 공유해요"
            className="rounded-lg border border-line px-3.5 py-2.5 text-sm font-bold text-ink2 hover:border-pine hover:text-pine">
            형제 연결
          </button>
          <div className="grow" />
          <button type="button" onClick={onClose}
            className="rounded-lg border border-line px-5 py-2.5 text-sm text-ink2">닫기</button>
          <button type="submit" className="rounded-lg bg-pine px-6 py-2.5 text-sm font-bold text-paper">저장</button>
        </div>
      </form>
      {showSibling && (
        <SiblingModal s={live} formPhone={f.parentPhone}
          onShared={phone => { if (!f.parentPhone.trim() && phone) set({ parentPhone: phone }) }}
          onClose={() => setShowSibling(false)} />
      )}
    </Modal>
  )
}

// ── 형제 연결 모달 — 형제 학생 선택 → 상호 기록 + 학부모 연락처 공유 ─────

function SiblingModal({ s, formPhone, onShared, onClose }: {
  s: Student; formPhone: string; onShared: (phone: string | undefined) => void; onClose: () => void
}) {
  const { students, updateStudent } = useStore()
  const [query, setQuery] = useState('')

  const linked = new Set(s.siblingIds ?? [])
  const candidates = students.filter(x =>
    x.id !== s.id && x.active && !linked.has(x.id) &&
    (!query.trim() || x.name.includes(query.trim())))

  const connect = (other: Student) => {
    const myPhone = formPhone.trim() || s.parentPhone
    const sharedPhone = myPhone || other.parentPhone
    updateStudent(s.id, {
      siblingIds: [...new Set([...(s.siblingIds ?? []), other.id])],
      ...(!s.parentPhone && sharedPhone ? { parentPhone: sharedPhone } : {}),
    })
    updateStudent(other.id, {
      siblingIds: [...new Set([...(other.siblingIds ?? []), s.id])],
      ...(!other.parentPhone && sharedPhone ? { parentPhone: sharedPhone } : {}),
    })
    onShared(sharedPhone)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[70vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-black">형제 연결 — {s.name}</h3>
          <button onClick={onClose} aria-label="닫기" className="text-xl leading-none text-ink2 hover:text-ink">✕</button>
        </div>
        <p className="mb-3 rounded-lg bg-paper2 px-3 py-2 text-xs text-ink2">
          형제로 연결하면 두 학생이 <b>학부모 연락처를 공유</b>해요. (비어 있는 쪽에 자동으로 채워집니다)
        </p>
        <input value={query} onChange={e => setQuery(e.target.value)} autoFocus
          placeholder="학생 이름 검색" className={`${INPUT} mb-2`} />
        {candidates.length === 0 ? (
          <div className="py-8 text-center text-sm text-ink2">연결할 수 있는 학생이 없습니다.</div>
        ) : (
          <div className="grid gap-1">
            {candidates.map(x => (
              <button key={x.id} onClick={() => connect(x)}
                className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm hover:border-pine hover:bg-pine-soft/40">
                <span className="rounded bg-paper2 px-1.5 py-0.5 text-xs font-bold text-ink2">{shortenGrade(x.grade)}</span>
                <b>{x.name}</b>
                <span className="ml-auto text-xs text-ink2">{x.parentPhone ?? '연락처 없음'}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 학생 일괄 등록 모달 (STEP 구조) ─────────────────

interface BulkRow {
  line: string
  name?: string
  grade?: string
  attendNo?: string
  klass?: string
  parentPhone?: string
  school?: string
  error?: string
}

const BULK_GRADE_RE = /^(초[1-6]|중[1-3]|고[1-3])$/

function parseBulk(text: string): BulkRow[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean)
    .filter((l, i) => !(i === 0 && l.startsWith('이름')))   // 양식 헤더 줄 무시
    .map(line => {
      const [name, grade, attendNo, klass, parentPhone, school] = line.split(/[,\t]/).map(c => c.trim())
      if (!name || !grade) return { line, error: '이름과 학년은 필수입니다' }
      if (!BULK_GRADE_RE.test(grade)) return { line, error: `학년 '${grade}' 형식 오류 (예: 중2, 초5, 고1)` }
      if (attendNo && !/^\d{4}$/.test(attendNo)) return { line, error: '출결번호는 4자리 숫자여야 합니다' }
      return {
        line, name, grade,
        attendNo: attendNo || undefined,
        klass: klass || undefined,
        parentPhone: parentPhone || undefined,
        school: school || undefined,
      }
    })
}

function downloadTemplate() {
  const csv = '\uFEFF이름,학년,출결번호,반,학부모연락처,학교\n홍길동,중2,0001,A반,01012345678,대치중\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = '학생일괄등록_양식.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}

function BulkModal({ onClose }: { onClose: () => void }) {
  const { addStudent } = useStore()
  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const rows = useMemo(() => parseBulk(text), [text])
  const valid = rows.filter(r => !r.error)

  const onFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  const submit = () => {
    for (const r of valid) {
      addStudent({
        name: r.name!, grade: r.grade!,
        attendNo: r.attendNo, klass: r.klass, parentPhone: r.parentPhone, school: r.school,
      })
    }
    onClose()
  }

  return (
    <Modal title="학생 일괄 등록" onClose={onClose}>
      <div className="mb-4 rounded-xl border border-line bg-paper2 p-4">
        <p className="mb-2 text-sm">
          <b className="mr-2 text-pine">STEP 01</b>
          양식 파일을 다운로드하여 학생 정보를 입력해주세요. (내용 형식을 수정하면 등록이 불가능합니다.)
        </p>
        <button onClick={downloadTemplate}
          className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-bold text-ink2 hover:text-ink">파일 다운로드</button>
      </div>

      <div className="mb-4 rounded-xl border border-line bg-paper2 p-4">
        <p className="mb-2 text-sm">
          <b className="mr-2 text-pine">STEP 02</b>
          내용 입력된 파일을 첨부해 주세요.
        </p>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
          onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }} />
        <button onClick={() => fileRef.current?.click()}
          className="mb-3 rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper">파일첨부</button>
        <p className="mb-1 text-xs text-ink2">또는 아래에 붙여넣기</p>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={5}
          placeholder={'이름,학년,출결번호,반,학부모연락처,학교\n홍길동,중2,0001,A반,01012345678,대치중'}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
      </div>

      {rows.length > 0 && (
        <div className="mb-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper2 text-left text-xs text-ink2">
                <th className="px-3 py-2 font-bold">이름</th>
                <th className="px-3 py-2 font-bold">학년</th>
                <th className="px-3 py-2 font-bold">출결번호</th>
                <th className="px-3 py-2 font-bold">반</th>
                <th className="px-3 py-2 font-bold">연락처</th>
                <th className="px-3 py-2 font-bold">학교</th>
                <th className="px-3 py-2 font-bold">오류</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => r.error ? (
                <tr key={i} className="border-b border-line bg-amber-soft last:border-0">
                  <td colSpan={7} className="px-3 py-2 text-clay">
                    <b>{r.line}</b> — {r.error}
                  </td>
                </tr>
              ) : (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 font-bold">{r.name}</td>
                  <td className="px-3 py-2">{r.grade}</td>
                  <td className="px-3 py-2">{r.attendNo ?? '—'}</td>
                  <td className="px-3 py-2">{r.klass ?? '—'}</td>
                  <td className="px-3 py-2">{r.parentPhone ?? '—'}</td>
                  <td className="px-3 py-2">{r.school ?? '—'}</td>
                  <td className="px-3 py-2 text-ink2">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm text-ink2">취소</button>
        <button onClick={submit} disabled={valid.length === 0}
          className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper disabled:opacity-40">
          등록하기{valid.length > 0 ? ` (${valid.length}명)` : ''}
        </button>
      </div>
    </Modal>
  )
}

// ── 매쓰플랫 가져오기 (내보낸 JSON 파일 → 학생 + 학습이력) ─────────

interface ImportedFile {
  source?: string
  students?: { mfId: string; name: string; grade: string; studentPhone?: string; parentPhone?: string; attendNo?: string; memo?: string }[]
  history?: { mfId: string; records?: { id: number | string; date: string; title?: string; correct?: number; wrong?: number; category?: string }[] }[]
}

const IMPORT_CATS = new Set(['학습지', '교재', '오답', '챌린지'])

function buildImport(json: ImportedFile): { students: Student[]; gradings: Grading[]; recordCount: number } {
  const t = (v: unknown) => (v != null && String(v).trim()) || undefined
  const students: Student[] = (json.students ?? []).map(st => ({
    id: 'st-mf-' + st.mfId,
    name: st.name,
    grade: st.grade,
    active: true,
    studentPhone: t(st.studentPhone),
    parentPhone: t(st.parentPhone),
    attendNo: t(st.attendNo),
    memo: t(st.memo),
  }))
  const gradings: Grading[] = []
  for (const h of json.history ?? []) {
    const sid = 'st-mf-' + h.mfId
    for (const rec of h.records ?? []) {
      const correct = Math.max(0, Math.floor(rec.correct ?? 0))
      const wrong = Math.max(0, Math.floor(rec.wrong ?? 0))
      const results: GradeResult[] = [
        ...Array.from({ length: correct }, () => ({ correct: true } as GradeResult)),
        ...Array.from({ length: wrong }, () => ({ correct: false } as GradeResult)),
      ]
      const category = (rec.category && IMPORT_CATS.has(rec.category) ? rec.category : '학습지') as Grading['category']
      gradings.push({
        id: 'gr-mf-' + rec.id,
        studentId: sid,
        source: '학습지',
        date: rec.date,
        results,
        imported: true,
        title: rec.title,
        category,
      })
    }
  }
  return { students, gradings, recordCount: gradings.length }
}

// 학원관리앱(전과목) → 학습지앱 학생 명부 가져오기. 관리앱을 마스터로 삼아 공유.
type MgmtStudent = { mgmtId: string; name: string; grade: string; school: string; studentPhone: string; parentPhone: string; memo: string; active: boolean }

function normPhone(p?: string): string { return (p ?? '').replace(/\D/g, '') }

function MgmtImportModal({ onClose }: { onClose: () => void }) {
  const { students, addStudent, updateStudent } = useStore()
  const [rows, setRows] = useState<MgmtStudent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [onlyActive, setOnlyActive] = useState(true)
  const [q, setQ] = useState('')
  const [done, setDone] = useState<{ imported: number; linked: number } | null>(null)

  // 관리앱 학생 ↔ 기존 학습지앱 학생 대응: mgmtId 매칭 우선, 없으면 이름+연락처 매칭
  const byMgmt = useMemo(() => new Map(students.filter(s => s.mgmtId).map(s => [s.mgmtId!, s])), [students])
  const byNamePhone = useMemo(() => {
    const m = new Map<string, Student>()
    for (const s of students) m.set(`${s.name}|${normPhone(s.parentPhone) || normPhone(s.studentPhone)}`, s)
    return m
  }, [students])
  const matchOf = (m: MgmtStudent): Student | undefined =>
    byMgmt.get(m.mgmtId) || byNamePhone.get(`${m.name}|${normPhone(m.parentPhone) || normPhone(m.studentPhone)}`)
  // 'linked' 이미 연결됨(스킵) · 'link' 기존 학생에 연결 · 'import' 신규 추가
  const statusOf = (m: MgmtStudent): 'linked' | 'link' | 'import' => {
    const ex = matchOf(m)
    if (!ex) return 'import'
    return ex.mgmtId === m.mgmtId ? 'linked' : 'link'
  }
  const isLinked = (m: MgmtStudent) => statusOf(m) === 'linked'

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        if (!SUPABASE_ON) { setError('학원관리앱 연동은 클라우드(Supabase) 모드에서만 됩니다.'); setLoading(false); return }
        const { data: sess } = await supabase!.auth.getSession()
        const token = sess.session?.access_token
        if (!token) { setError('로그인 후 이용해 주세요.'); setLoading(false); return }
        const r = await fetch('/api/mgmt-students', { headers: { Authorization: `Bearer ${token}` } })
        const d = await r.json().catch(() => ({}))
        if (!alive) return
        if (!r.ok) { setError(d.error || '학생을 불러오지 못했습니다.'); setLoading(false); return }
        setRows((d.students as MgmtStudent[]) ?? [])
        setLoading(false)
      } catch { if (alive) { setError('네트워크 오류로 불러오지 못했습니다.'); setLoading(false) } }
    })()
    return () => { alive = false }
  }, [])

  const view = useMemo(() => {
    const t = q.trim()
    return (rows ?? [])
      .filter(m => (onlyActive ? m.active : true))
      .filter(m => !t || m.name.includes(t) || m.school.includes(t))
      .sort((a, b) => Number(isLinked(a)) - Number(isLinked(b)) || a.name.localeCompare(b.name, 'ko'))
  }, [rows, onlyActive, q, byMgmt, byNamePhone])

  const importable = view.filter(m => !isLinked(m))   // 연결하기 + 가져오기 (선택 가능)
  const allChecked = importable.length > 0 && importable.every(m => sel.has(m.mgmtId))
  const toggleAll = () => setSel(prev => {
    const n = new Set(prev)
    if (allChecked) importable.forEach(m => n.delete(m.mgmtId))
    else importable.forEach(m => n.add(m.mgmtId))
    return n
  })

  function doImport() {
    const pick = (rows ?? []).filter(m => sel.has(m.mgmtId) && !isLinked(m))
    let imported = 0, linkedN = 0
    for (const m of pick) {
      const st = statusOf(m)
      if (st === 'link') {
        const ex = matchOf(m)
        if (ex) { updateStudent(ex.id, { mgmtId: m.mgmtId }); linkedN++ }
      } else {
        addStudent({
          name: m.name,
          grade: m.grade || '중1',
          school: m.school || undefined,
          studentPhone: m.studentPhone || undefined,
          parentPhone: m.parentPhone || undefined,
          memo: m.memo || undefined,
          mgmtId: m.mgmtId,
        })
        imported++
      }
    }
    setSel(new Set())
    setDone({ imported, linked: linkedN })
  }

  return (
    <Modal title="🏫 학원관리앱에서 학생 가져오기" onClose={onClose}>
      {done !== null ? (
        <div className="grid gap-4 py-4 text-center">
          <div className="text-4xl">✅</div>
          <div className="text-sm text-ink">
            {done.imported > 0 && <>신규 {done.imported}명 가져오기</>}
            {done.imported > 0 && done.linked > 0 && ' · '}
            {done.linked > 0 && <>기존 {done.linked}명 연결</>}
            {done.imported === 0 && done.linked === 0 && '처리된 학생이 없습니다.'}
            {(done.imported > 0 || done.linked > 0) && ' 완료'}
          </div>
          <div className="text-xs text-ink2">전과목 학생은 학원관리앱에서 관리되고, 여기선 연결만 됩니다. 학습지앱 단과 학생은 그대로 유지됩니다.</div>
          <button onClick={onClose} className="mx-auto rounded-lg bg-pine px-6 py-2 text-sm font-bold text-paper">확인</button>
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="text-xs text-ink2">학원관리앱(전과목)의 학생을 학습지앱으로 공유합니다. 이름·연락처가 같은 <b>기존 학습지앱 학생은 자동으로 연결</b>되고, 없는 학생만 새로 가져옵니다. 이미 연결된 학생은 회색으로 표시됩니다.</p>
          {loading ? (
            <div className="py-10 text-center text-sm text-ink2">불러오는 중…</div>
          ) : error ? (
            <div className="rounded-lg border border-clay/40 bg-red-50 px-4 py-3 text-sm text-clay">{error}</div>
          ) : (rows && rows.length === 0) ? (
            <div className="rounded-lg border border-dashed border-line bg-paper2/50 px-4 py-8 text-center text-sm text-ink2">학원관리앱에 등록된 학생이 없습니다.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="이름·학교 검색"
                  className="w-40 rounded-lg border border-line px-3 py-1.5 text-sm" />
                <label className="flex items-center gap-1.5 text-sm text-ink2">
                  <input type="checkbox" checked={onlyActive} onChange={e => setOnlyActive(e.target.checked)} /> 재원생만
                </label>
                <div className="grow" />
                <span className="text-sm text-ink2">연결/가져올 수 있는 학생 <b className="text-indigo-600">{importable.length}</b>명</span>
              </div>
              <div className="max-h-80 overflow-y-auto rounded-lg border border-line">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-paper2 text-left text-xs text-ink2">
                    <tr>
                      <th className="w-8 px-3 py-2"><input type="checkbox" checked={allChecked} onChange={toggleAll} title="가져올 수 있는 전체 선택" /></th>
                      <th className="px-2 py-2">이름</th><th className="px-2 py-2">학년</th><th className="px-2 py-2">학교</th><th className="px-2 py-2">학부모 연락처</th><th className="px-2 py-2">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.map(m => {
                      const st = statusOf(m)
                      const isDone = st === 'linked'
                      return (
                        <tr key={m.mgmtId} className={`border-t border-line ${isDone ? 'bg-paper2/40 text-ink2' : 'hover:bg-pine-soft/30'}`}>
                          <td className="px-3 py-2">
                            <input type="checkbox" disabled={isDone} checked={sel.has(m.mgmtId)}
                              onChange={() => setSel(p => { const n = new Set(p); n.has(m.mgmtId) ? n.delete(m.mgmtId) : n.add(m.mgmtId); return n })} />
                          </td>
                          <td className="px-2 py-2 font-bold text-ink">{m.name || '—'}</td>
                          <td className="px-2 py-2">{m.grade || '—'}</td>
                          <td className="px-2 py-2">{m.school || '—'}</td>
                          <td className="px-2 py-2">{m.parentPhone || '—'}</td>
                          <td className="px-2 py-2">
                            {st === 'linked' ? <span className="text-xs text-ink2">연결됨</span>
                              : st === 'link' ? <span className="text-xs font-bold text-pine" title="이름·연락처가 같은 기존 학습지앱 학생에 연결됩니다">🔗 연결하기</span>
                              : <span className="text-xs font-bold text-indigo-600">가져오기</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink2">취소</button>
                <button onClick={doImport} disabled={sel.size === 0}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-bold text-paper disabled:opacity-40">{sel.size}명 연결/가져오기</button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

function MathflatImportModal({ onClose }: { onClose: () => void }) {
  const { importBulk } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<{ students: Student[]; gradings: Grading[]; recordCount: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(0)

  const onFile = (file: File | undefined) => {
    setError(null); setParsed(null)
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result ?? '')) as ImportedFile
        if (!Array.isArray(json.students) || json.students.length === 0) {
          setError('학생 정보가 없는 파일입니다. 매쓰플랫에서 내보낸 파일이 맞는지 확인해주세요.'); return
        }
        setParsed(buildImport(json))
      } catch {
        setError('파일을 읽지 못했습니다. 매쓰플랫에서 내보낸 JSON 파일을 첨부해주세요.')
      }
    }
    reader.readAsText(file)
  }

  const run = () => {
    if (!parsed) return
    importBulk(parsed.students, parsed.gradings)
    setDone(parsed.students.length)
  }

  const dates = parsed?.gradings.map(g => g.date.slice(0, 10)).filter(Boolean).sort() ?? []
  const dateRange = dates.length ? `${dates[0]} ~ ${dates[dates.length - 1]}` : '—'

  return (
    <Modal title="매쓰플랫 가져오기" onClose={onClose}>
      {done > 0 ? (
        <div className="grid gap-4 py-2 text-center">
          <div className="text-4xl">✅</div>
          <p className="text-sm">
            학생 <b className="text-pine">{done}</b>명과 학습이력 <b className="text-pine">{parsed?.recordCount ?? 0}</b>건을 가져왔습니다.<br />
            수업 &gt; 학습내역에서 각 학생의 기록을 확인할 수 있어요.
          </p>
          <button onClick={onClose} className="mx-auto rounded-lg bg-pine px-6 py-2.5 text-sm font-bold text-paper">확인</button>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="rounded-xl border border-line bg-paper2 p-4 text-sm leading-relaxed text-ink2">
            <p className="mb-1"><b className="text-pine">매쓰플랫 재원생 명단 + 학습이력</b>을 한 번에 가져옵니다.</p>
            <p>매쓰플랫에서 내보낸 <b>JSON 파일</b>을 첨부하면, 학생과 각자의 학습 기록(학습지·오답, 정답/오답·점수)이 앱에 등록됩니다. 같은 학생·기록은 여러 번 가져와도 중복되지 않습니다.</p>
          </div>

          <input ref={fileRef} type="file" className="hidden"
            onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }} />
          <button onClick={() => fileRef.current?.click()}
            className="rounded-lg bg-pine px-4 py-2.5 text-sm font-bold text-paper">파일 첨부</button>

          {error && <p className="rounded-lg bg-amber-soft px-3 py-2 text-sm text-clay">{error}</p>}

          {parsed && (
            <div className="rounded-xl border border-line p-4 text-sm">
              <div className="mb-2 font-black">미리보기</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-paper2 px-3 py-2">학생 <b className="text-pine">{parsed.students.length}</b>명</div>
                <div className="rounded-lg bg-paper2 px-3 py-2">학습이력 <b className="text-pine">{parsed.recordCount}</b>건</div>
              </div>
              <div className="mt-2 text-xs text-ink2">기록 기간: {dateRange}</div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm text-ink2">취소</button>
            <button onClick={run} disabled={!parsed}
              className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper disabled:opacity-40">
              가져오기{parsed ? ` (학생 ${parsed.students.length}명)` : ''}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── 반 관리 ───────────────────────────────────────
// 원본(매쓰플랫) 구조: 반 만들기/상세는 전체 화면 + 학생 듀얼 리스트.
// 학생 폼의 "반" 문자열 방식과 양방향 호환 — 저장 시 Student.klass를 갱신한다.

function KlassTab() {
  const { students, updateStudent, klassOrder, setKlassOrder, academyProfile, teachers } = useStore()
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<{ name?: string } | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())

  const teacherName = academyProfile.teacherName?.trim() || '명수쌤'
  const teacherOfClass = (k: string) => teachers.find(t => t.classes?.includes(k))?.name ?? teacherName
  const active = students.filter(s => s.active)
  const groups = useMemo(() => {
    const m = new Map<string, Student[]>()
    for (const s of active) if (s.klass) {
      if (!m.has(s.klass)) m.set(s.klass, [])
      m.get(s.klass)!.push(s)
    }
    // 표시 순서: klassOrder 우선, 나머지는 가나다
    const names = [...m.keys()]
    const inOrder = klassOrder.filter(k => m.has(k))
    const rest = names.filter(k => !inOrder.includes(k)).sort((a, b) => a.localeCompare(b, 'ko'))
    return [...inOrder, ...rest].map(name => ({ name, members: m.get(name)! }))
  }, [students, klassOrder])
  const unassigned = active.filter(s => !s.klass).length

  const shown = groups.filter(g => !query.trim() || g.name.includes(query.trim()))

  const move = (name: string, dir: -1 | 1) => {
    const names = groups.map(g => g.name)
    const i = names.indexOf(name)
    const j = i + dir
    if (i < 0 || j < 0 || j >= names.length) return
    const next = [...names]
    ;[next[i], next[j]] = [next[j], next[i]]
    setKlassOrder(next)
  }

  const removeSelected = () => {
    if (sel.size === 0) return
    if (!confirm(`선택한 반 ${sel.size}개를 삭제할까요? 반 학생은 미배정으로 이동합니다.`)) return
    for (const name of sel) {
      for (const s of students) if (s.klass === name) updateStudent(s.id, { klass: undefined })
    }
    setKlassOrder(klassOrder.filter(k => !sel.has(k)))
    setSel(new Set())
  }

  if (editor) return <KlassEditor name={editor.name} onClose={() => setEditor(null)} />

  return (
    <div>
      <div className="mb-2 text-xs text-ink2">반 정렬 순서(이동 ↑↓)는 이 목록의 표시 순서에 반영됩니다.</div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-0">
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="반 이름 검색"
            className="w-40 rounded-l-lg border border-line bg-white px-3 py-1.5 text-sm" />
          <button title="검색" aria-label="검색"
            className="rounded-r-lg border border-l-0 border-line bg-white px-2.5 py-1.5 text-sm text-ink2">🔍</button>
        </div>
        <span className="text-sm font-bold text-ink2">반 <b className="text-pine">{groups.length}</b>개 · 미배정 <b className="text-clay">{unassigned}</b>명</span>
        {sel.size > 0 && (
          <button onClick={removeSelected}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-bold text-clay hover:border-clay">
            선택 반 삭제 ({sel.size})
          </button>
        )}
        <div className="grow" />
        <button onClick={() => setEditor({})}
          className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper">⊕ 반 만들기</button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-ink2">
          아직 반이 없습니다. [⊕ 반 만들기]로 반을 만들거나, 학생 등록/상세에서 반 이름을 입력하면 자동 생성됩니다.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper2 text-left text-xs text-ink2">
                <th className="w-8 px-3 py-2.5" />
                <th className="px-2 py-2.5 font-bold">순서</th>
                <th className="px-3 py-2.5 font-bold">반 이름</th>
                <th className="px-3 py-2.5 font-bold">반 학생</th>
                <th className="px-3 py-2.5 font-bold">담당 선생님</th>
                <th className="px-3 py-2.5 font-bold">상세</th>
                <th className="px-3 py-2.5 font-bold">이동</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ name, members }) => {
                const order = groups.findIndex(g => g.name === name) + 1
                return (
                  <tr key={name} className="border-b border-line last:border-0">
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={sel.has(name)}
                        onChange={() => setSel(prev => {
                          const next = new Set(prev)
                          if (next.has(name)) next.delete(name); else next.add(name)
                          return next
                        })} />
                    </td>
                    <td className="px-2 py-2.5 text-ink2">{order}</td>
                    <td className="px-3 py-2.5 font-bold">{name}</td>
                    <td className="px-3 py-2.5">
                      {members.length === 0 ? '0명'
                        : members.length === 1 ? members[0].name
                        : `${members[0].name} 외 ${members.length - 1}명`}
                      <span className="ml-1 text-xs text-ink2">({members.length}명)</span>
                    </td>
                    <td className="px-3 py-2.5">{teacherOfClass(name)}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => setEditor({ name })}
                        className="rounded border border-line px-3 py-1 text-xs text-ink2 hover:border-pine hover:text-pine">상세</button>
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => move(name, -1)} disabled={order === 1} title="위로"
                        className="rounded border border-line px-2 py-1 text-xs text-ink2 hover:border-pine hover:text-pine disabled:opacity-30">↑</button>
                      <button onClick={() => move(name, 1)} disabled={order === groups.length} title="아래로"
                        className="ml-1 rounded border border-line px-2 py-1 text-xs text-ink2 hover:border-pine hover:text-pine disabled:opacity-30">↓</button>
                    </td>
                  </tr>
                )
              })}
              {unassigned > 0 && (
                <tr className="bg-paper2 text-ink2">
                  <td />
                  <td />
                  <td className="px-3 py-2.5">미배정</td>
                  <td className="px-3 py-2.5">{unassigned}명</td>
                  <td colSpan={3} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── 반 만들기 / 반 상세 (전체 화면 + 학생 듀얼 리스트) ─────────────

function KlassEditor({ name, onClose }: { name?: string; onClose: () => void }) {
  const { students, updateStudent, klassOrder, setKlassOrder, academyProfile, teachers, updateTeacher } = useStore()
  const isEdit = !!name
  const teacherName = academyProfile.teacherName?.trim() || '명수쌤'
  const [klassName, setKlassName] = useState(name ?? '')
  // 담당 강사 — 이 반을 classes에 가진 강사 (없으면 원장 자동)
  const [teacherId, setTeacherId] = useState<string>(() => (name ? teachers.find(t => t.classes?.includes(name))?.id ?? '' : ''))
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(name ? students.filter(s => s.active && s.klass === name).map(s => s.id) : []))
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())

  const active = students.filter(s => s.active)
  const byId = new Map(active.map(s => [s.id, s]))

  // 좌측(선택 안 된 학생) — 학년 그룹, 검색 필터
  const leftGroups = useMemo(() => {
    const q = query.trim()
    const rest = active.filter(s => !selected.has(s.id) && (!q || s.name.includes(q)))
    const m = new Map<string, Student[]>()
    for (const s of rest) {
      const g = shortenGrade(s.grade)
      if (!m.has(g)) m.set(g, [])
      m.get(g)!.push(s)
    }
    return [...m.entries()].sort((a, b) => gradeRank(a[0]) - gradeRank(b[0]))
  }, [students, selected, query])

  // 우측(선택된 학생) — 학년 그룹
  const rightGroups = useMemo(() => {
    const m = new Map<string, Student[]>()
    for (const id of selected) {
      const s = byId.get(id)
      if (!s) continue
      const g = shortenGrade(s.grade)
      if (!m.has(g)) m.set(g, [])
      m.get(g)!.push(s)
    }
    return [...m.entries()].sort((a, b) => gradeRank(a[0]) - gradeRank(b[0]))
  }, [students, selected])

  const add = (ids: string[]) => setSelected(prev => new Set([...prev, ...ids]))
  const remove = (id: string) => setSelected(prev => {
    const next = new Set(prev); next.delete(id); return next
  })
  const toggleOpen = (g: string) => setOpen(prev => {
    const next = new Set(prev)
    if (next.has(g)) next.delete(g); else next.add(g)
    return next
  })

  const save = () => {
    const nn = klassName.trim()
    if (!nn) { alert('반 이름을 입력해주세요.'); return }
    const existing = new Set(active.filter(s => s.klass).map(s => s.klass!))
    if (nn !== name && existing.has(nn)) { alert(`'${nn}' 반이 이미 있습니다. 다른 이름을 입력해주세요.`); return }

    // 선택 학생 → 이 반으로
    for (const id of selected) {
      const st = byId.get(id)
      if (st && st.klass !== nn) updateStudent(id, { klass: nn })
    }
    if (isEdit) {
      // 빠진 학생 → 미배정
      for (const st of active) {
        if (st.klass === name && !selected.has(st.id)) updateStudent(st.id, { klass: undefined })
      }
      // 이름 변경 시: 퇴원생 등 남은 소속도 새 이름으로, 순서 목록 갱신
      if (nn !== name) {
        for (const st of students) {
          if (!st.active && st.klass === name) updateStudent(st.id, { klass: nn })
        }
        setKlassOrder(klassOrder.map(k => (k === name ? nn : k)))
      }
    } else if (!klassOrder.includes(nn)) {
      setKlassOrder([...klassOrder, nn])
    }
    // 담당 강사 재배정 — 이 반(이름 변경 시 옛 이름 포함)을 모든 강사에서 제거 후 선택 강사에 추가
    for (const t of teachers) {
      const has = t.classes?.includes(nn) || (name && t.classes?.includes(name))
      const shouldHave = t.id === teacherId
      if (has || shouldHave) {
        const base = (t.classes ?? []).filter(c => c !== nn && c !== name)
        const nextClasses = shouldHave ? [...base, nn] : base
        if (JSON.stringify(nextClasses) !== JSON.stringify(t.classes ?? [])) updateTeacher(t.id, { classes: nextClasses })
      }
    }
    onClose()
  }

  const gradeRow = (g: string, list: Student[], side: 'left' | 'right') => (
    <div key={g} className="border-b border-line/60 last:border-0">
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" onClick={() => toggleOpen(side + g)}
          className="text-xs text-ink2 hover:text-ink">{open.has(side + g) ? '▼' : '▶'}</button>
        <span className="text-sm font-bold">{g} <span className="font-normal text-ink2">{list.length}명</span></span>
        <div className="grow" />
        {side === 'left' && (
          <button type="button" onClick={() => add(list.map(s => s.id))} title={`${g} 전체 추가`}
            className="rounded border border-line px-2 py-0.5 text-sm text-pine hover:border-pine">⊕</button>
        )}
      </div>
      {open.has(side + g) && list.map(s => (
        <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 pl-9 text-sm hover:bg-paper2/50">
          <span>{s.name}</span>
          {side === 'left' && s.klass && s.klass !== name && (
            <span className="rounded bg-paper2 px-1.5 py-0.5 text-[10px] text-ink2" title="저장 시 이 반으로 이동합니다">{s.klass}</span>
          )}
          <div className="grow" />
          {side === 'left'
            ? <button type="button" onClick={() => add([s.id])} className="rounded border border-line px-2 py-0.5 text-sm text-pine hover:border-pine">⊕</button>
            : <button type="button" onClick={() => remove(s.id)} className="rounded border border-line px-2 py-0.5 text-sm text-clay hover:border-clay">⊖</button>}
        </div>
      ))}
    </div>
  )

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-black">{isEdit ? '반 상세 정보' : '반 만들기'}</h2>
        <button onClick={onClose} aria-label="닫기" className="text-xl leading-none text-ink2 hover:text-ink">✕</button>
      </div>

      <div className="mb-4 grid max-w-xl gap-2.5">
        <Field label="반 이름">
          <input value={klassName} onChange={e => setKlassName(e.target.value)} autoFocus
            placeholder="반 이름을 입력해주세요." className={INPUT} />
        </Field>
        <Field label="반 선생님">
          {teachers.length === 0 ? (
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-pine-soft px-3 py-1.5 text-sm font-bold text-pine-dark">{teacherName}</span>
              <span className="text-xs text-ink2">등록된 강사가 없으면 원장 자동 지정 — [선생님 관리]에서 강사 추가</span>
            </div>
          ) : (
            <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className={INPUT}>
              <option value="">{teacherName} (원장)</option>
              {teachers.filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </Field>
      </div>

      <p className="mb-2 text-sm font-black">반 학생</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 좌: 전체 학생 */}
        <div className="rounded-2xl border border-line bg-white">
          <div className="flex items-center gap-2 border-b border-line p-3">
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="학생 이름 검색" className={INPUT} />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="검색어 지우기"
                className="shrink-0 text-ink2 hover:text-ink">✕</button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            <div className="px-3 py-2 text-xs font-bold text-ink2">
              전체 {active.filter(s => !selected.has(s.id)).length}명
            </div>
            {leftGroups.length === 0
              ? <div className="px-3 py-8 text-center text-sm text-ink2">학생이 없습니다.</div>
              : leftGroups.map(([g, list]) => gradeRow(g, list, 'left'))}
          </div>
        </div>

        {/* 우: 선택된 학생 */}
        <div className="rounded-2xl border border-line bg-white">
          <div className="border-b border-line p-3 text-sm font-bold">선택된 학생 {selected.size}명</div>
          <div className="max-h-96 overflow-y-auto">
            {selected.size === 0 ? (
              <div className="px-3 py-12 text-center text-sm text-ink2">
                <div className="mb-1 font-bold">선택된 학생 없음</div>
                왼쪽의 ⊕ 를 눌러 학생을 선택해 주세요.
              </div>
            ) : rightGroups.map(([g, list]) => gradeRow(g, list, 'right'))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button onClick={save} className="rounded-lg bg-pine px-8 py-2.5 text-sm font-bold text-paper">
          {isEdit ? '저장하기' : '등록하기'}
        </button>
      </div>
    </div>
  )
}

// ── 선생님 관리 ────────────────────────────────────

const TEACHER_SUBJECTS = ['수학', '과학', '국어', '영어', '사회'] as const

function TeachersTab() {
  const { teachers, klassOrder, addTeacher, updateTeacher, removeTeacher } = useStore()
  const [editor, setEditor] = useState<{ t?: Teacher } | null>(null)
  const [acct, setAcct] = useState<Teacher | null>(null)

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div>
          <h3 className="font-black">선생님(강사) 관리</h3>
          <p className="text-sm text-ink2">강사를 등록하고 계정(아이디)을 발급하며, 반을 배정합니다.</p>
        </div>
        <div className="grow" />
        <button onClick={() => setEditor({})}
          className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper hover:brightness-105">＋ 강사 등록</button>
      </div>

      {teachers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          등록된 강사가 없습니다. <b>＋ 강사 등록</b>으로 추가하세요.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper2 text-left text-xs text-ink2">
                <th className="px-4 py-2.5">이름</th><th>담당 과목</th><th>담당 반</th><th>연락처</th><th>계정</th><th className="text-right pr-4">관리</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map(t => (
                <tr key={t.id} className="border-b border-line/50">
                  <td className="px-4 py-2.5 font-bold">{t.name}{!t.active && <span className="ml-1 text-xs text-ink2">(비활성)</span>}</td>
                  <td className="text-ink2">{t.subjects?.join('·') || '—'}</td>
                  <td className="text-ink2">{t.classes?.length ? t.classes.join(', ') : '—'}</td>
                  <td className="text-ink2">{t.phone || '—'}</td>
                  <td>
                    {t.accountCreated
                      ? <span className="rounded bg-pine-soft px-2 py-0.5 text-xs font-bold text-pine-dark">발급됨 · {t.loginId}</span>
                      : <button onClick={() => setAcct(t)} className="rounded border border-pine px-2 py-0.5 text-xs font-bold text-pine hover:bg-pine-soft">계정 만들기</button>}
                  </td>
                  <td className="pr-4 text-right">
                    <button onClick={() => setEditor({ t })} className="text-xs font-semibold text-ink2 hover:text-pine">수정</button>
                    <button onClick={() => { if (confirm(`${t.name} 강사를 삭제할까요? (계정은 남습니다)`)) removeTeacher(t.id) }}
                      className="ml-3 text-xs font-semibold text-clay hover:underline">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editor && (
        <TeacherEditor teacher={editor.t} klassOptions={klassOrder}
          onSave={(patch) => {
            if (editor.t) updateTeacher(editor.t.id, patch)
            else addTeacher(patch)
            setEditor(null)
          }}
          onClose={() => setEditor(null)} />
      )}
      {acct && (
        <TeacherAccountModal teacher={acct}
          onDone={(loginId) => { updateTeacher(acct.id, { loginId, accountCreated: true }); setAcct(null) }}
          onClose={() => setAcct(null)} />
      )}
    </div>
  )
}

function TeacherEditor({ teacher, klassOptions, onSave, onClose }: {
  teacher?: Teacher; klassOptions: string[]
  onSave: (patch: Omit<Teacher, 'id' | 'active'>) => void; onClose: () => void
}) {
  const [name, setName] = useState(teacher?.name ?? '')
  const [phone, setPhone] = useState(teacher?.phone ?? '')
  const [subjects, setSubjects] = useState<Set<string>>(new Set(teacher?.subjects ?? []))
  const [classes, setClasses] = useState<Set<string>>(new Set(teacher?.classes ?? []))
  const [memo, setMemo] = useState(teacher?.memo ?? '')
  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, v: string) =>
    set(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n })

  return (
    <Modal title={teacher ? '강사 수정' : '강사 등록'} onClose={onClose}>
      <div className="grid gap-3">
        <Field label="이름"><input value={name} onChange={e => setName(e.target.value)} autoFocus className={INPUT} placeholder="강사 이름" /></Field>
        <Field label="연락처"><input value={phone} onChange={e => setPhone(e.target.value)} className={INPUT} placeholder="010-0000-0000" /></Field>
        <Field label="담당 과목">
          <div className="flex flex-wrap gap-1.5">
            {TEACHER_SUBJECTS.map(s => (
              <button key={s} onClick={() => toggle(setSubjects, s)}
                className={`rounded-full px-3 py-1.5 text-sm font-bold ${subjects.has(s) ? 'bg-pine text-paper' : 'border border-line text-ink2'}`}>{s}</button>
            ))}
          </div>
        </Field>
        <Field label="담당 반">
          {klassOptions.length === 0
            ? <span className="text-xs text-ink2">먼저 [반 관리]에서 반을 만들면 여기서 배정할 수 있어요.</span>
            : <div className="flex flex-wrap gap-1.5">
                {klassOptions.map(k => (
                  <button key={k} onClick={() => toggle(setClasses, k)}
                    className={`rounded-full px-3 py-1.5 text-sm font-bold ${classes.has(k) ? 'bg-pine text-paper' : 'border border-line text-ink2'}`}>{k}</button>
                ))}
              </div>}
        </Field>
        <Field label="메모"><input value={memo} onChange={e => setMemo(e.target.value)} className={INPUT} placeholder="선택" /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-paper2">취소</button>
        <button onClick={() => { if (!name.trim()) { alert('이름을 입력하세요.'); return } onSave({ name: name.trim(), phone: phone.trim() || undefined, subjects: [...subjects], classes: [...classes], memo: memo.trim() || undefined, loginId: teacher?.loginId, accountCreated: teacher?.accountCreated }) }}
          className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper">저장</button>
      </div>
    </Modal>
  )
}

function TeacherAccountModal({ teacher, onDone, onClose }: {
  teacher: Teacher; onDone: (loginId: string) => void; onClose: () => void
}) {
  const [loginId, setLoginId] = useState(teacher.loginId ?? '')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<{ email: string } | null>(null)

  async function create() {
    setErr(null)
    const id = loginId.trim().toLowerCase()
    if (!/^[a-z0-9._-]{3,}$/.test(id)) { setErr('아이디는 영문·숫자 3자 이상(공백 없이).'); return }
    if (pw.length < 6) { setErr('비밀번호는 6자 이상.'); return }
    setBusy(true)
    try {
      if (SUPABASE_ON) {
        const { data: sess } = await supabase!.auth.getSession()
        const token = sess.session?.access_token
        const r = await fetch('/api/create-teacher-account', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
          body: JSON.stringify({ loginId: id, password: pw, name: teacher.name }),
        })
        if (!r.ok) { const e = await r.json().catch(() => ({})); setErr(e.error || '계정 생성 실패'); setBusy(false); return }
      }
      setDone({ email: teacherEmailOf(id) })
      setBusy(false)
    } catch { setErr('네트워크 오류'); setBusy(false) }
  }

  return (
    <Modal title={`${teacher.name} 강사 계정 만들기`} onClose={onClose}>
      {done ? (
        <div className="grid gap-3">
          <div className="rounded-xl bg-pine-soft/50 p-4 text-sm">
            <p className="mb-2 font-bold text-pine-dark">✅ 계정이 만들어졌어요. 강사에게 아래 정보를 전달하세요.</p>
            <div className="rounded-lg bg-white px-3 py-2">아이디: <b>{loginId.trim().toLowerCase()}</b></div>
            <div className="mt-1 rounded-lg bg-white px-3 py-2">비밀번호: <b>{pw}</b></div>
            <p className="mt-2 text-xs text-ink2">강사는 로그인 화면 [선생님] 탭에서 <b>아이디</b>(또는 {done.email})와 비밀번호로 로그인합니다.</p>
          </div>
          <div className="flex justify-end"><button onClick={() => onDone(loginId.trim().toLowerCase())} className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper">완료</button></div>
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm text-ink2">강사가 로그인할 아이디와 초기 비밀번호를 정하세요. {SUPABASE_ON ? '실제 로그인 계정이 만들어집니다.' : '(로컬 모드: 아이디만 기록)'}</p>
          <Field label="아이디 (영문·숫자)"><input value={loginId} onChange={e => setLoginId(e.target.value)} autoFocus className={INPUT} placeholder="예: teacher1" /></Field>
          <Field label="초기 비밀번호 (6자 이상)"><input value={pw} onChange={e => setPw(e.target.value)} className={INPUT} placeholder="강사에게 전달할 비밀번호" /></Field>
          {err && <p className="text-sm text-clay">{err}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-paper2">취소</button>
            <button onClick={create} disabled={busy} className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper disabled:opacity-60">{busy ? '만드는 중…' : '계정 만들기'}</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── 학생앱 (매쓰플랫 관리 > 학생앱 설정 등가: 3탭 + 학생 계정 안내) ────

const APP_SUBTABS = ['오늘의 학습 설정', '정답 · 해설 공개', '풀이 영상 공개', '학생 계정 안내'] as const
type AppSubTab = typeof APP_SUBTABS[number]

function StudentAppTab() {
  const [sub, setSub] = useState<AppSubTab>('오늘의 학습 설정')
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {APP_SUBTABS.map(t => (
          <button key={t} onClick={() => setSub(t)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${sub === t
              ? 'bg-pine text-paper'
              : 'border border-line bg-white text-ink2 hover:text-ink'}`}>
            {t}
          </button>
        ))}
      </div>
      {sub === '오늘의 학습 설정' && <DailyLearningSettings />}
      {sub === '정답 · 해설 공개' && <AnswerRevealSettings />}
      {sub === '풀이 영상 공개' && <VideoRevealSettings />}
      {sub === '학생 계정 안내' && <StudentAccountGuide />}
    </div>
  )
}

// 오늘의 학습 설정 — 마스터 토글 + 학년 그룹 ▶펼침 + 학생별 토글
function DailyLearningSettings() {
  const { students, studentAppConfig, setStudentAppConfig } = useStore()
  const [masterOn, setMasterOn] = useState(studentAppConfig.dailyMasterOn ?? true)
  const [offIds, setOffIds] = useState<Set<string>>(new Set(studentAppConfig.dailyOffIds ?? []))
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const active = students.filter(s => s.active)
  const groups = useMemo(() => {
    const m = new Map<string, Student[]>()
    for (const s of active) {
      const g = shortenGrade(s.grade)
      if (!m.has(g)) m.set(g, [])
      m.get(g)!.push(s)
    }
    return [...m.entries()].sort((a, b) => gradeRank(a[0]) - gradeRank(b[0]))
  }, [students])

  const savedMaster = studentAppConfig.dailyMasterOn ?? true
  const savedOff = new Set(studentAppConfig.dailyOffIds ?? [])
  const dirty = masterOn !== savedMaster
    || offIds.size !== savedOff.size
    || [...offIds].some(id => !savedOff.has(id))

  const save = () => {
    setStudentAppConfig({ ...studentAppConfig, dailyMasterOn: masterOn, dailyOffIds: [...offIds] })
    setSavedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
  }

  const setStudent = (id: string, on: boolean) => setOffIds(prev => {
    const next = new Set(prev)
    if (on) next.delete(id); else next.add(id)
    return next
  })
  const setGroup = (list: Student[], on: boolean) => setOffIds(prev => {
    const next = new Set(prev)
    for (const s of list) { if (on) next.delete(s.id); else next.add(s.id) }
    return next
  })

  return (
    <section className="max-w-3xl rounded-2xl border border-line bg-white p-6">
      <div className="mb-1 flex items-center gap-3">
        <h3 className="font-black">오늘의 학습 설정</h3>
        <div className="grow" />
        <button onClick={save} disabled={!dirty}
          className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper disabled:opacity-40">저장하기</button>
      </div>
      <p className="mb-1 text-sm text-ink2">
        학생별로 '오늘의 학습' 사용 여부를 설정할 수 있어요. (off로 설정한 학생은 오늘의 학습 문제를 풀 수 없어요)
      </p>
      {savedAt && !dirty && <p className="mb-2 text-xs text-pine-dark">✓ 저장됨 {savedAt}</p>}
      {dirty && <p className="mb-2 text-xs text-clay">저장하지 않은 변경이 있어요</p>}

      <label className="mb-4 flex items-center gap-3 rounded-xl border border-line/70 px-4 py-3">
        <Switch on={masterOn} onChange={setMasterOn} />
        <span className="text-sm font-bold">전체 학생 공개 여부</span>
        {!masterOn && <span className="text-xs text-clay">전체 OFF — 학생별 설정과 무관하게 오늘의 학습이 숨겨져요.</span>}
      </label>

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink2">재원생이 없습니다.</div>
      ) : (
        <div className="rounded-xl border border-line">
          <div className="flex items-center border-b border-line bg-paper2 px-4 py-2 text-xs font-bold text-ink2">
            <span>학생앱에서 공개</span>
          </div>
          {groups.map(([g, list]) => {
            const onCount = list.filter(s => !offIds.has(s.id)).length
            return (
              <div key={g} className="border-b border-line/60 last:border-0">
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <button type="button" onClick={() => setOpen(prev => {
                    const next = new Set(prev)
                    if (next.has(g)) next.delete(g); else next.add(g)
                    return next
                  })} className="text-xs text-ink2 hover:text-ink">{open.has(g) ? '▼' : '▶'}</button>
                  <span className="text-sm font-bold">{g} <span className="font-normal text-ink2">{list.length}명</span></span>
                  <span className="text-xs text-ink2">(ON {onCount})</span>
                  <div className="grow" />
                  <Switch on={onCount === list.length} disabled={!masterOn}
                    onChange={v => setGroup(list, v)} />
                </div>
                {open.has(g) && list.map(s => (
                  <div key={s.id} className="flex items-center gap-2 px-4 py-2 pl-10 text-sm">
                    <span>{s.name}</span>
                    <div className="grow" />
                    <Switch on={!offIds.has(s.id)} disabled={!masterOn}
                      onChange={v => setStudent(s.id, v)} />
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// 채점 전/후 체크 행 (정답·해설·풀이영상 공용)
function RevealRow({ label, desc, before, after, onBefore, onAfter }: {
  label: string; desc: string
  before: boolean; after: boolean
  onBefore: (v: boolean) => void; onAfter: (v: boolean) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line/70 px-4 py-3">
      <div className="min-w-40">
        <div className="text-sm font-bold">{label}
          <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${(before || after) ? 'bg-pine-soft text-pine-dark' : 'bg-paper2 text-ink2'}`}>
            {(before || after) ? '공개' : '비공개'}
          </span>
        </div>
        <div className="text-xs text-ink2">{desc}</div>
      </div>
      <div className="grow" />
      <label className="flex items-center gap-1.5 text-sm" title="학생이 풀이 중에도 볼 수 있어요">
        <input type="checkbox" checked={before} onChange={e => onBefore(e.target.checked)} className="accent-pine" />
        채점 전
      </label>
      <label className="flex items-center gap-1.5 text-sm" title="제출(채점) 후 결과 화면에서 볼 수 있어요">
        <input type="checkbox" checked={after} onChange={e => onAfter(e.target.checked)} className="accent-pine" />
        채점 후
      </label>
    </div>
  )
}

function useRevealConfig() {
  const { studentAppConfig, setStudentAppConfig } = useStore()
  const [cfg, setCfg] = useState<StudentAppConfig>(studentAppConfig)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const KEYS: (keyof StudentAppConfig)[] = [
    'showAnswer', 'showSolution', 'showVideo', 'showAnswerBefore', 'showSolutionBefore', 'showVideoBefore',
  ]
  const dirty = KEYS.some(k => (cfg[k] ?? false) !== (studentAppConfig[k] ?? false))
    || (cfg.solveFeedback ?? true) !== (studentAppConfig.solveFeedback ?? true)   // 기본 ON
  const save = () => {
    setStudentAppConfig({ ...studentAppConfig, ...cfg })
    setSavedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
  }
  return { cfg, setCfg, dirty, save, savedAt }
}

function SaveState({ dirty, savedAt }: { dirty: boolean; savedAt: string | null }) {
  if (dirty) return <p className="mb-3 text-xs text-clay">저장하지 않은 변경이 있어요</p>
  if (savedAt) return <p className="mb-3 text-xs text-pine-dark">✓ 저장됨 {savedAt}</p>
  return <div className="mb-3" />
}

// 정답 및 해설 공개 설정 — 채점 전/후 구분 (기존 boolean = 채점 후, 하위호환)
function AnswerRevealSettings() {
  const { cfg, setCfg, dirty, save, savedAt } = useRevealConfig()
  return (
    <section className="max-w-3xl rounded-2xl border border-line bg-white p-6">
      <div className="mb-1 flex items-center gap-3">
        <h3 className="font-black">정답 및 해설 공개 설정</h3>
        <div className="grow" />
        <button onClick={save} disabled={!dirty}
          className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper disabled:opacity-40">저장하기</button>
      </div>
      <p className="mb-1 text-sm text-ink2">
        정답 확인은 선생님 설정에 따라 제공되며 정답이 등록된 문제·교재에서만 사용할 수 있어요.
      </p>
      <SaveState dirty={dirty} savedAt={savedAt} />
      <div className="grid gap-2.5">
        <RevealRow label="정답 공개" desc="각 문제의 정답을 볼 수 있어요."
          before={cfg.showAnswerBefore ?? false} after={cfg.showAnswer}
          onBefore={v => setCfg(p => ({ ...p, showAnswerBefore: v }))}
          onAfter={v => setCfg(p => ({ ...p, showAnswer: v }))} />
        <RevealRow label="해설 공개" desc="문제별 해설을 펼쳐볼 수 있어요."
          before={cfg.showSolutionBefore ?? false} after={cfg.showSolution}
          onBefore={v => setCfg(p => ({ ...p, showSolutionBefore: v }))}
          onAfter={v => setCfg(p => ({ ...p, showSolution: v }))} />
        {/* 풀이 AI 피드백 사용 여부 (단일 on/off, 기본 사용) */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line/70 px-4 py-3">
          <div className="min-w-40">
            <div className="text-sm font-bold">풀이 AI 피드백
              <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${(cfg.solveFeedback ?? true) ? 'bg-pine-soft text-pine-dark' : 'bg-paper2 text-ink2'}`}>
                {(cfg.solveFeedback ?? true) ? '사용' : '사용 안 함'}
              </span>
            </div>
            <div className="text-xs text-ink2">학생이 문제별로 필기·사진 풀이를 올리면 AI가 과정을 채점·피드백해요. (끄면 학생앱에서 숨김)</div>
          </div>
          <div className="grow" />
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={cfg.solveFeedback ?? true}
              onChange={e => setCfg(p => ({ ...p, solveFeedback: e.target.checked }))} className="accent-pine" />
            사용
          </label>
        </div>
      </div>
      <p className="mt-3 text-xs text-ink2">
        현재 전체 학생 공통 적용 — 학년·학생별 세분화는 준비 중이에요. '채점 후'를 끄면 결과 화면에 🔒 비공개로 표시됩니다.
      </p>
    </section>
  )
}

// 풀이 영상 공개 설정
function VideoRevealSettings() {
  const { cfg, setCfg, dirty, save, savedAt } = useRevealConfig()
  return (
    <section className="max-w-3xl rounded-2xl border border-line bg-white p-6">
      <div className="mb-1 flex items-center gap-3">
        <h3 className="font-black">풀이 영상 공개 설정</h3>
        <div className="grow" />
        <button onClick={save} disabled={!dirty}
          className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper disabled:opacity-40">저장하기</button>
      </div>
      <p className="mb-1 text-sm text-ink2">
        선생님이 설정한 풀이 영상 공개 여부에 따라 학생들이 풀이 영상을 확인할 수 있습니다.
      </p>
      <SaveState dirty={dirty} savedAt={savedAt} />
      <div className="grid gap-2.5">
        <RevealRow label="풀이영상 공개" desc="풀이영상이 있는 문제에서 영상을 볼 수 있어요."
          before={cfg.showVideoBefore ?? false} after={cfg.showVideo}
          onBefore={v => setCfg(p => ({ ...p, showVideoBefore: v }))}
          onAfter={v => setCfg(p => ({ ...p, showVideo: v }))} />
      </div>
      <p className="mt-3 text-xs text-ink2">현재 전체 학생 공통 적용 — 학년별 세분화는 준비 중이에요.</p>
    </section>
  )
}

// 학생 계정 안내 (우리 규약)
function StudentAccountGuide() {
  const { students } = useStore()
  const withAccount = students.filter(s => s.active && (s.loginId ?? s.attendNo)).length
  const sample = students.find(s => s.active && (s.loginId ?? s.attendNo))
  const sampleId = sample ? (sample.loginId ?? sample.attendNo)! : '0412'

  return (
    <section className="max-w-3xl rounded-2xl border border-line bg-white p-6">
      <h3 className="mb-1 font-black">학생 계정 안내</h3>
      <p className="mb-4 text-sm text-ink2">
        학생은 로그인 화면의 <b>[학생]</b> 탭에서 아이디·비밀번호로 들어와요.
        재원생 중 아이디(출결번호) 보유 <b className="text-pine">{withAccount}</b>명.
      </p>
      <div className="grid gap-2 text-sm">
        <div className="rounded-xl bg-paper2/70 px-4 py-3">
          <div className="text-xs font-bold text-ink2">아이디</div>
          <div>학생의 <b>출결번호</b> (또는 별도 지정한 loginId)</div>
        </div>
        <div className="rounded-xl bg-paper2/70 px-4 py-3">
          <div className="text-xs font-bold text-ink2">기본 비밀번호</div>
          <div><b>gsg&lt;출결번호&gt;</b> <span className="text-xs text-ink2">(예: 출결번호 {sampleId} → gsg{sampleId})</span></div>
        </div>
        <div className="rounded-xl bg-paper2/70 px-4 py-3">
          <div className="text-xs font-bold text-ink2">계정 이메일 규약 (내부)</div>
          <div className="break-all font-mono text-xs">{studentEmailOf(sampleId)}</div>
          <div className="mt-0.5 text-xs text-ink2">아이디가 자동으로 이 규약의 Supabase 계정으로 변환돼요.</div>
        </div>
        <div className="rounded-xl bg-paper2/70 px-4 py-3">
          <div className="text-xs font-bold text-ink2">계정 일괄 생성 · 비밀번호 초기화</div>
          <div className="font-mono text-xs">node scripts/create-student-accounts.mjs</div>
          <div className="mt-0.5 text-xs text-ink2">
            앱 저장소의 스크립트로 재원생 전원의 계정을 만들어요 (Supabase service key 필요).
            새 학생이 들어오면 다시 실행 — 기존 계정은 건너뛰어요.
            비밀번호 초기화는 <span className="font-mono">--reset &lt;아이디&gt;</span> (학생 상세보기의 [학생 비밀번호 초기화]에서 명령 복사).
          </div>
        </div>
        <div className="rounded-xl bg-paper2/70 px-4 py-3">
          <div className="text-xs font-bold text-ink2">학생 시점 확인</div>
          <div className="text-xs text-ink2">
            학생 관리 표의 <b className="text-ink">[학생앱으로 이동]</b> 버튼으로 그 학생 시점의
            학생앱을 보기 전용으로 미리볼 수 있어요.
          </div>
        </div>
      </div>
    </section>
  )
}

// ── 실험실 (매쓰플랫 관리 > 실험실 등가 — 우리 실정에 맞는 항목만 활성) ──

const LAB_TABS = ['AI 튜터', '원클릭 복습 학습지', 'KMM수학경시대회'] as const
type LabSubTab = typeof LAB_TABS[number]

function LabTab() {
  const [sub, setSub] = useState<LabSubTab>('원클릭 복습 학습지')
  return (
    <div>
      <div className="mb-4 rounded-2xl border border-pine/30 bg-pine-soft px-5 py-4 text-sm text-pine-dark">
        <b>깊은생각 실험실에 오신 것을 환영합니다.</b> 실험실을 통해 출시 준비 중인 새로운 기능을 먼저 이용하실 수 있습니다! 😎
      </div>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {LAB_TABS.map(t => (
          <button key={t} onClick={() => setSub(t)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${sub === t
              ? 'bg-pine text-paper'
              : 'border border-line bg-white text-ink2 hover:text-ink'}`}>
            {t}
          </button>
        ))}
      </div>
      {sub === 'AI 튜터' && <LabAiTutor />}
      {sub === '원클릭 복습 학습지' && <LabOneClick />}
      {sub === 'KMM수학경시대회' && <LabKmm />}
    </div>
  )
}

function LabAiTutor() {
  return (
    <section className="max-w-3xl rounded-2xl border border-line bg-white p-6">
      <h3 className="mb-1 font-black">🤖 AI 튜터</h3>
      <p className="mb-4 text-sm text-ink2">
        AI 튜터가 학생의 풀이를 분석해 피드백을 주거나, 개념에 대한 힌트를 제공합니다.
      </p>
      <div className="rounded-xl border border-dashed border-line bg-paper2/50 p-6 text-sm text-ink2">
        <b className="text-ink">준비 중</b> — Claude 연동으로 <b>개념 힌트 · 풀이 분석 · 풀이 확인</b>을
        학년별로 켜고 끄는 구조로 제공할 예정이에요. 문제 데이터와 학생 풀이 입력이 쌓이면 활성화합니다.
      </div>
    </section>
  )
}

// 원클릭 복습 학습지 — 오늘의 학습 '오답 복습'을 학년별 ON/OFF로 노출 (등가 구현)
function LabOneClick() {
  const { students, studentAppConfig, setStudentAppConfig } = useStore()
  const lab = studentAppConfig.lab ?? {}
  const [on, setOn] = useState(lab.oneClickOn ?? true)
  const [offGrades, setOffGrades] = useState<Set<string>>(new Set(lab.oneClickGradesOff ?? []))
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const grades = useMemo(() => {
    const set = new Set(students.filter(s => s.active).map(s => shortenGrade(s.grade)))
    return [...set].sort((a, b) => gradeRank(a) - gradeRank(b))
  }, [students])

  const savedOn = lab.oneClickOn ?? true
  const savedOffG = new Set(lab.oneClickGradesOff ?? [])
  const dirty = on !== savedOn
    || offGrades.size !== savedOffG.size
    || [...offGrades].some(g => !savedOffG.has(g))

  const save = () => {
    setStudentAppConfig({
      ...studentAppConfig,
      lab: { ...lab, oneClickOn: on, oneClickGradesOff: [...offGrades] },
    })
    setSavedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
  }

  return (
    <section className="max-w-3xl rounded-2xl border border-line bg-white p-6">
      <div className="mb-1 flex items-center gap-3">
        <h3 className="font-black">🪄 원클릭 복습 학습지</h3>
        <div className="grow" />
        <button onClick={save} disabled={!dirty}
          className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper disabled:opacity-40">저장하기</button>
      </div>
      <p className="mb-1 text-sm text-ink2">
        오늘의 학습 <b>오답 복습</b>(최근 틀린 문제 자동 재출제)을 학년별로 켜고 끕니다.
        수업 시작 전 5분 복습 학습지를 따로 만들 필요 없이, 학생이 오늘의 학습에서 자동으로 다시 풀어요.
      </p>
      {savedAt && !dirty && <p className="mb-3 text-xs text-pine-dark">✓ 저장됨 {savedAt}</p>}
      {dirty && <p className="mb-3 text-xs text-clay">저장하지 않은 변경이 있어요</p>}

      <label className="mb-4 flex items-center gap-3 rounded-xl border border-line/70 px-4 py-3">
        <Switch on={on} onChange={setOn} />
        <span className="text-sm font-bold">✨ 원클릭 복습 학습지 기능을 사용하고 싶다면?</span>
      </label>

      {grades.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink2">재원생이 없습니다.</div>
      ) : (
        <div className="rounded-xl border border-line">
          <div className="border-b border-line bg-paper2 px-4 py-2 text-xs font-bold text-ink2">학년별 사용</div>
          {grades.map(g => (
            <div key={g} className="flex items-center gap-2 border-b border-line/60 px-4 py-2.5 last:border-0">
              <span className="text-sm font-bold">{g}</span>
              <div className="grow" />
              <Switch on={!offGrades.has(g)} disabled={!on}
                onChange={v => setOffGrades(prev => {
                  const next = new Set(prev)
                  if (v) next.delete(g); else next.add(g)
                  return next
                })} />
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-ink2">
        복습 출제 방식(그대로/유사)·문항 수 등 세부 옵션은 수업 &gt; 오늘의 학습 &gt; 학생별 설정에서 조정해요.
      </p>
    </section>
  )
}

function LabKmm() {
  return (
    <section className="max-w-3xl rounded-2xl border border-line bg-white p-6">
      <h3 className="mb-1 font-black">KMM수학경시대회</h3>
      <p className="mb-4 text-sm text-ink2">
        매월 1회, 자동 출제되는 수학경시 시험을 활성화하거나 비활성화할 수 있는 옵션을 제공합니다.
      </p>
      <div className="rounded-xl border border-dashed border-line bg-paper2/50 p-6 text-sm text-ink2">
        <b className="text-ink">콘텐츠 대기</b> — KMM은 매쓰플랫 주관 대회라 자체 등가 콘텐츠(월간 경시 모의)를
        확보한 뒤 <b>매월 자동출제 토글 × 학년별 설정</b> 구조로 활성화할 예정이에요.
      </div>
    </section>
  )
}

// ── 추가 관리 ─────────────────────────────────────

interface ExtraCard {
  title: string
  kind: 'sparta' | 'sparta-parents' | 'lab'
}

const EXTRA_CARDS: ExtraCard[] = [
  { title: '문자', kind: 'sparta' },
  { title: '출결', kind: 'sparta' },
  { title: '교육비', kind: 'sparta' },
  { title: '학부모앱 공지 설정', kind: 'sparta-parents' },
  { title: '실험실', kind: 'lab' },
]

function ExtraTab({ onGoLab }: { onGoLab: () => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {EXTRA_CARDS.map(c => (
        <div key={c.title} className="rounded-2xl border border-line bg-white p-5">
          <h3 className="mb-2 font-black">{c.title}</h3>
          {c.kind === 'lab' ? (
            <>
              <p className="mb-3 rounded-lg bg-paper2 px-3 py-2 text-sm text-ink2">
                관리 &gt; 실험실 탭으로 이동했어요. 출시 준비 기능을 먼저 사용해보세요.
              </p>
              <button onClick={onGoLab}
                className="text-sm font-bold text-pine hover:underline">실험실 탭 열기 →</button>
            </>
          ) : (
            <>
              <p className="mb-3 rounded-lg bg-paper2 px-3 py-2 text-sm text-ink2">
                {c.kind === 'sparta-parents'
                  ? '학부모앱 미보유 — 학부모 공지·소통은 학원관리앱(대치스파르타)에서 담당합니다.'
                  : '학원관리앱(대치스파르타)에서 담당합니다.'}
              </p>
              <a href="https://daechisparta.vercel.app" target="_blank" rel="noreferrer"
                className="text-sm font-bold text-pine hover:underline">대치스파르타 열기 →</a>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
