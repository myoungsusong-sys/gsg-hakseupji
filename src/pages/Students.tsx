import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useStore } from '../lib/store'
import type { Grading, GradeResult, Student } from '../types'

const TABS = ['학생 관리', '반 관리', '선생님 관리', '추가 관리'] as const
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
      {tab === '추가 관리' && <ExtraTab />}
    </div>
  )
}

// ── 학생 관리 ─────────────────────────────────────

type Sort = 'latest' | 'name'

function StudentsTab() {
  const { students } = useStore()
  const [sort, setSort] = useState<Sort>('latest')
  const [filter, setFilter] = useState<SchoolFilter>('전체')
  const [showInactive, setShowInactive] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [detail, setDetail] = useState<Student | null>(null)

  const activeCount = students.filter(s => s.active).length
  const list = useMemo(() => {
    const filtered = students
      .filter(s => (showInactive ? true : s.active))
      .filter(s => filter === '전체' || s.grade.startsWith(filter))
    return sort === 'name'
      ? [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      : [...filtered].reverse()
  }, [students, showInactive, filter, sort])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={sort} onChange={e => setSort(e.target.value as Sort)}
          className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm font-bold text-ink">
          <option value="latest">최신 등록순</option>
          <option value="name">이름순</option>
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
        <span className="text-sm font-bold text-ink2">재원생 <b className="text-pine">{activeCount}</b>명</span>
        <label className="flex items-center gap-1.5 text-sm text-ink2">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          퇴원생 보기
        </label>
        <div className="grow" />
        <button onClick={() => setShowImport(true)}
          className="rounded-lg border border-pine bg-white px-4 py-2 text-sm font-bold text-pine hover:bg-pine-soft">매쓰플랫 가져오기</button>
        <button onClick={() => setShowBulk(true)}
          className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-bold text-ink2 hover:text-ink">학생 일괄 등록</button>
        <button onClick={() => setShowForm(true)}
          className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper">학생 개별 등록</button>
      </div>

      {showForm && <RegisterModal onClose={() => setShowForm(false)} />}
      {showBulk && <BulkModal onClose={() => setShowBulk(false)} />}
      {showImport && <MathflatImportModal onClose={() => setShowImport(false)} />}
      {detail && <DetailModal key={detail.id} s={detail} onClose={() => setDetail(null)} />}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-ink2">
          {students.length === 0 ? '등록된 학생이 없습니다. 위에서 추가하세요.' : '조건에 맞는 학생이 없습니다.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper2 text-left text-xs text-ink2">
                <th className="px-4 py-2.5 font-bold">학년</th>
                <th className="px-3 py-2.5 font-bold">상태</th>
                <th className="px-3 py-2.5 font-bold">학생 이름</th>
                <th className="px-3 py-2.5 font-bold">학부모 연락처</th>
                <th className="px-3 py-2.5 font-bold">반</th>
                <th className="px-3 py-2.5 font-bold">상세</th>
              </tr>
            </thead>
            <tbody>
              {list.map(s => (
                <tr key={s.id} className={`border-b border-line last:border-0 ${s.active ? '' : 'bg-paper2'}`}>
                  <td className="px-4 py-2.5">
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
                    <button onClick={() => setDetail(s)}
                      className="text-xs font-bold text-pine hover:underline">상세보기</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
}

function emptyForm(): FormState {
  return {
    name: '', sk: '중', gn: 1, attendNo: '',
    studentPhone: '', parentPhone: '', school: '', startDate: '', birth: '',
    email: '', address: '', homePhone: '', memo: '', klass: '',
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

function StudentFields({ f, set }: { f: FormState; set: (p: Partial<FormState>) => void }) {
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
        <input value={f.attendNo} onChange={e => set({ attendNo: e.target.value })}
          placeholder="4자리 숫자만 입력해주세요." maxLength={4} className={INPUT} />
      </Field>

      <p className="mt-2 border-b border-line pb-1.5 text-sm font-black">선택 입력 사항</p>
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
  const { addStudent } = useStore()
  const [f, setF] = useState<FormState>(emptyForm)
  const [keepOpen, setKeepOpen] = useState(false)
  const set = (p: Partial<FormState>) => setF(prev => ({ ...prev, ...p }))

  const submit = () => {
    const err = validateForm(f, true)
    if (err) { alert(err); return }
    addStudent(formPayload(f))
    if (keepOpen) setF(emptyForm())
    else onClose()
  }

  return (
    <Modal title="학생 개별 등록" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); submit() }}>
        <StudentFields f={f} set={set} />
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
  const { updateStudent, setStudentActive } = useStore()
  const [f, setF] = useState<FormState>(() => formFromStudent(s))
  const [active, setActive] = useState(s.active)
  const set = (p: Partial<FormState>) => setF(prev => ({ ...prev, ...p }))

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
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-line px-5 py-2.5 text-sm text-ink2">닫기</button>
          <button type="submit" className="rounded-lg bg-pine px-6 py-2.5 text-sm font-bold text-paper">저장</button>
        </div>
      </form>
    </Modal>
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

function KlassTab() {
  const { students, updateStudent } = useStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [showHint, setShowHint] = useState(false)

  const active = students.filter(s => s.active)
  const groups = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of active) if (s.klass) m.set(s.klass, (m.get(s.klass) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko'))
  }, [students])
  const unassigned = active.filter(s => !s.klass).length

  const rename = (old: string) => {
    const nn = newName.trim()
    if (nn && nn !== old) {
      for (const s of students) if (s.klass === old) updateStudent(s.id, { klass: nn })
    }
    setEditing(null)
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm font-bold text-ink2">반 <b className="text-pine">{groups.length}</b>개 · 미배정 <b className="text-clay">{unassigned}</b>명</span>
        <div className="grow" />
        <button onClick={() => setShowHint(v => !v)}
          className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper">+ 반 만들기</button>
      </div>

      {showHint && (
        <div className="mb-4 rounded-xl border border-line bg-pine-soft px-4 py-3 text-sm text-pine-dark">
          학생 등록/상세에서 반 이름을 입력하면 자동 생성됩니다.
        </div>
      )}

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-ink2">
          아직 반이 없습니다. 학생 등록/상세에서 반 이름을 입력하면 자동 생성됩니다.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper2 text-left text-xs text-ink2">
                <th className="px-4 py-2.5 font-bold">반 이름</th>
                <th className="px-3 py-2.5 font-bold">학생 수</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {groups.map(([name, count]) => (
                <tr key={name} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-bold">
                    {editing === name ? (
                      <form className="inline" onSubmit={e => { e.preventDefault(); rename(name) }}>
                        <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus
                          className="w-40 rounded border border-line px-2 py-1 font-normal" />
                        <button type="submit" className="ml-1 rounded bg-pine px-3 py-1 text-xs font-bold text-paper">저장</button>
                        <button type="button" onClick={() => setEditing(null)}
                          className="ml-1 rounded border border-line px-3 py-1 text-xs font-normal text-ink2">취소</button>
                      </form>
                    ) : name}
                  </td>
                  <td className="px-3 py-2.5">{count}명</td>
                  <td className="px-3 py-2.5 text-right">
                    {editing !== name && (
                      <button onClick={() => { setEditing(name); setNewName(name) }}
                        className="rounded border border-line px-3 py-1 text-xs text-ink2 hover:border-pine hover:text-pine">이름 변경</button>
                    )}
                  </td>
                </tr>
              ))}
              {unassigned > 0 && (
                <tr className="bg-paper2 text-ink2">
                  <td className="px-4 py-2.5">미배정</td>
                  <td className="px-3 py-2.5">{unassigned}명</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── 선생님 관리 ────────────────────────────────────

function TeachersTab() {
  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <h3 className="mb-1 font-black">선생님 관리</h3>
      <p className="text-sm text-ink2">단일 강사 운영 중 — 강사가 늘어나면 활성화합니다.</p>
    </div>
  )
}

// ── 추가 관리 ─────────────────────────────────────

const EXTRA_CARDS: { title: string; sparta: boolean }[] = [
  { title: '문자', sparta: true },
  { title: '출결', sparta: true },
  { title: '교육비', sparta: true },
  { title: '학부모앱 공지 설정', sparta: false },
  { title: '학생앱 설정', sparta: false },
  { title: '실험실', sparta: false },
]

function ExtraTab() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {EXTRA_CARDS.map(c => (
        <div key={c.title} className="rounded-2xl border border-line bg-white p-5">
          <h3 className="mb-2 font-black">{c.title}</h3>
          {c.sparta ? (
            <>
              <p className="mb-3 rounded-lg bg-paper2 px-3 py-2 text-sm text-ink2">
                학원관리앱(대치스파르타)에서 담당합니다.
              </p>
              <a href="https://daechisparta.vercel.app" target="_blank" rel="noreferrer"
                className="text-sm font-bold text-pine hover:underline">대치스파르타 열기 →</a>
            </>
          ) : (
            <p className="rounded-lg bg-paper2 px-3 py-2 text-sm text-ink2">
              학생앱 없음 — 해당 없음
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
