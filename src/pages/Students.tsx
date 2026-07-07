import { useMemo, useState } from 'react'
import { CURRICULA } from '../data/curriculum'
import { useStore } from '../lib/store'
import type { Student } from '../types'

const GRADES = [...new Set(CURRICULA.map(c => c.grade))]

const SCHOOL_FILTERS = ['전체', '초', '중', '고'] as const
type SchoolFilter = typeof SCHOOL_FILTERS[number]

const TABS = ['학생 관리', '반 관리', '기타'] as const
type Tab = typeof TABS[number]

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
      {tab === '기타' && <EtcTab />}
    </div>
  )
}

// ── 학생 관리 ─────────────────────────────────────

function StudentsTab() {
  const { students } = useStore()
  const [filter, setFilter] = useState<SchoolFilter>('전체')
  const [query, setQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showBulk, setShowBulk] = useState(false)

  const activeCount = students.filter(s => s.active).length
  const list = students
    .filter(s => (showInactive ? true : s.active))
    .filter(s => filter === '전체' || s.grade.startsWith(filter))
    .filter(s => !query.trim() || s.name.includes(query.trim()))

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
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
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="이름 검색"
          className="w-40 rounded-lg border border-line bg-white px-3 py-1.5 text-sm" />
        <span className="text-sm font-bold text-ink2">재원생 <b className="text-pine">{activeCount}</b>명</span>
        <label className="flex items-center gap-1.5 text-sm text-ink2">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          퇴원생 보기
        </label>
        <div className="grow" />
        <button onClick={() => setShowForm(v => !v)}
          className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper">+ 학생 개별 등록</button>
        <button onClick={() => setShowBulk(true)}
          className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-bold text-ink2 hover:text-ink">학생 일괄 등록</button>
      </div>

      {showForm && <RegisterForm />}
      {showBulk && <BulkModal onClose={() => setShowBulk(false)} />}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-ink2">
          {students.length === 0 ? '등록된 학생이 없습니다. 위에서 추가하세요.' : '조건에 맞는 학생이 없습니다.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper2 text-left text-xs text-ink2">
                <th className="px-4 py-2.5 font-bold">이름</th>
                <th className="px-3 py-2.5 font-bold">학년</th>
                <th className="px-3 py-2.5 font-bold">반</th>
                <th className="px-3 py-2.5 font-bold">학교</th>
                <th className="px-3 py-2.5 font-bold">학부모 연락처</th>
                <th className="px-3 py-2.5 font-bold">메모</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {list.map(s => <StudentRow key={s.id} s={s} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RegisterForm() {
  const { addStudent } = useStore()
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('중1-1')
  const [klass, setKlass] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [school, setSchool] = useState('')

  const submit = () => {
    if (!name.trim()) { alert('이름을 입력하세요'); return }
    addStudent({
      name: name.trim(),
      grade,
      klass: klass.trim() || undefined,
      parentPhone: parentPhone.trim() || undefined,
      school: school.trim() || undefined,
    })
    setName(''); setKlass(''); setParentPhone(''); setSchool('')
  }

  return (
    <form onSubmit={e => { e.preventDefault(); submit() }}
      className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-5">
      <label className="grid gap-1 text-sm font-bold">이름
        <input value={name} onChange={e => setName(e.target.value)} autoFocus
          className="w-32 rounded-lg border border-line px-3 py-2 font-normal" /></label>
      <label className="grid gap-1 text-sm font-bold">학년
        <select value={grade} onChange={e => setGrade(e.target.value)}
          className="rounded-lg border border-line bg-white px-2 py-2 font-normal">
          {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
        </select></label>
      <label className="grid gap-1 text-sm font-bold">반
        <input value={klass} onChange={e => setKlass(e.target.value)} placeholder="중1 A반"
          className="w-32 rounded-lg border border-line px-3 py-2 font-normal" /></label>
      <label className="grid gap-1 text-sm font-bold">학부모 연락처
        <input value={parentPhone} onChange={e => setParentPhone(e.target.value)} placeholder="010-0000-0000"
          className="w-40 rounded-lg border border-line px-3 py-2 font-normal" /></label>
      <label className="grid gap-1 text-sm font-bold">학교
        <input value={school} onChange={e => setSchool(e.target.value)}
          className="w-32 rounded-lg border border-line px-3 py-2 font-normal" /></label>
      <button type="submit" className="rounded-lg bg-pine px-5 py-2.5 text-sm font-bold text-paper">등록</button>
    </form>
  )
}

function StudentRow({ s }: { s: Student }) {
  const { updateStudent, setStudentActive } = useStore()
  const [editing, setEditing] = useState(false)
  const [d, setD] = useState({ name: '', grade: '', klass: '', school: '', parentPhone: '', memo: '' })

  const startEdit = () => {
    setD({
      name: s.name, grade: s.grade, klass: s.klass ?? '',
      school: s.school ?? '', parentPhone: s.parentPhone ?? '', memo: s.memo ?? '',
    })
    setEditing(true)
  }
  const save = () => {
    if (!d.name.trim()) { alert('이름을 입력하세요'); return }
    updateStudent(s.id, {
      name: d.name.trim(),
      grade: d.grade,
      klass: d.klass.trim() || undefined,
      school: d.school.trim() || undefined,
      parentPhone: d.parentPhone.trim() || undefined,
      memo: d.memo.trim() || undefined,
    })
    setEditing(false)
  }

  const cell = 'w-full rounded border border-line px-2 py-1'

  if (editing) return (
    <tr className="border-b border-line bg-pine-soft/40 last:border-0">
      <td className="px-4 py-2"><input value={d.name} onChange={e => setD({ ...d, name: e.target.value })} className={`${cell} min-w-20`} /></td>
      <td className="px-3 py-2">
        <select value={d.grade} onChange={e => setD({ ...d, grade: e.target.value })}
          className="rounded border border-line bg-white px-1 py-1">
          {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </td>
      <td className="px-3 py-2"><input value={d.klass} onChange={e => setD({ ...d, klass: e.target.value })} className={`${cell} min-w-20`} /></td>
      <td className="px-3 py-2"><input value={d.school} onChange={e => setD({ ...d, school: e.target.value })} className={`${cell} min-w-20`} /></td>
      <td className="px-3 py-2"><input value={d.parentPhone} onChange={e => setD({ ...d, parentPhone: e.target.value })} className={`${cell} min-w-28`} /></td>
      <td className="px-3 py-2"><input value={d.memo} onChange={e => setD({ ...d, memo: e.target.value })} className={`${cell} min-w-24`} /></td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        <button onClick={save} className="mr-1 rounded bg-pine px-3 py-1 text-xs font-bold text-paper">저장</button>
        <button onClick={() => setEditing(false)} className="rounded border border-line px-3 py-1 text-xs text-ink2">취소</button>
      </td>
    </tr>
  )

  return (
    <tr className={`border-b border-line last:border-0 ${s.active ? '' : 'bg-paper2 text-ink2'}`}>
      <td className="px-4 py-2.5 font-bold">
        {s.name}
        {!s.active && <span className="ml-1.5 rounded bg-white px-1.5 py-0.5 text-[11px] font-bold text-clay">퇴원</span>}
      </td>
      <td className="px-3 py-2.5">
        <span className="rounded bg-paper2 px-2 py-0.5 text-xs font-bold text-ink2">{s.grade}</span>
      </td>
      <td className="px-3 py-2.5">{s.klass ?? <span className="text-ink2">—</span>}</td>
      <td className="px-3 py-2.5">{s.school ?? <span className="text-ink2">—</span>}</td>
      <td className="px-3 py-2.5">{s.parentPhone ?? <span className="text-ink2">—</span>}</td>
      <td className="max-w-40 truncate px-3 py-2.5 text-ink2">{s.memo ?? ''}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right">
        {s.active ? (
          <>
            <button onClick={startEdit}
              className="mr-1 rounded border border-line px-3 py-1 text-xs text-ink2 hover:border-pine hover:text-pine">수정</button>
            <button onClick={() => { if (confirm(`${s.name} 학생을 퇴원 처리할까요?`)) setStudentActive(s.id, false) }}
              className="rounded border border-line px-3 py-1 text-xs text-ink2 hover:border-clay hover:text-clay">퇴원</button>
          </>
        ) : (
          <button onClick={() => setStudentActive(s.id, true)}
            className="rounded border border-line bg-white px-3 py-1 text-xs font-bold text-pine hover:bg-pine-soft">복원</button>
        )}
      </td>
    </tr>
  )
}

// ── 학생 일괄 등록 ─────────────────────────────────

interface BulkRow {
  line: string
  name?: string
  grade?: string
  klass?: string
  parentPhone?: string
  error?: string
}

function parseBulk(text: string): BulkRow[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const parts = line.split(/\s+/)
    if (parts.length < 2) return { line, error: '이름과 학년을 공백으로 구분해 입력하세요' }
    const [name, grade, ...rest] = parts
    if (!GRADES.includes(grade)) return { line, error: `학년 '${grade}' 인식 불가 (예: 중1-1)` }
    let klass: string | undefined
    let parentPhone: string | undefined
    for (const p of rest) {
      if (/^[\d-]+$/.test(p)) parentPhone = p
      else klass = p
    }
    return { line, name, grade, klass, parentPhone }
  })
}

function BulkModal({ onClose }: { onClose: () => void }) {
  const { addStudent } = useStore()
  const [text, setText] = useState('')

  const rows = useMemo(() => parseBulk(text), [text])
  const valid = rows.filter(r => !r.error)

  const submit = () => {
    for (const r of valid) {
      addStudent({ name: r.name!, grade: r.grade!, klass: r.klass, parentPhone: r.parentPhone })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
        <h2 className="mb-1 text-lg font-black">학생 일괄 등록</h2>
        <p className="mb-3 text-sm text-ink2">
          한 줄에 한 명씩 <b>이름 학년 [반] [연락처]</b> 순서로 공백 구분해 입력하세요.
          (예: <span className="rounded bg-paper2 px-1">김철수 중1-1 A반 010-1234-5678</span>)
        </p>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={6} autoFocus
          placeholder={'김철수 중1-1 A반 010-1234-5678\n이영희 초6-2'}
          className="mb-3 w-full rounded-lg border border-line px-3 py-2 text-sm" />

        {rows.length > 0 && (
          <div className="mb-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper2 text-left text-xs text-ink2">
                  <th className="px-3 py-2 font-bold">이름</th>
                  <th className="px-3 py-2 font-bold">학년</th>
                  <th className="px-3 py-2 font-bold">반</th>
                  <th className="px-3 py-2 font-bold">연락처</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => r.error ? (
                  <tr key={i} className="border-b border-line bg-amber-soft last:border-0">
                    <td colSpan={4} className="px-3 py-2 text-clay">
                      <b>{r.line}</b> — {r.error}
                    </td>
                  </tr>
                ) : (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 font-bold">{r.name}</td>
                    <td className="px-3 py-2">{r.grade}</td>
                    <td className="px-3 py-2">{r.klass ?? '—'}</td>
                    <td className="px-3 py-2">{r.parentPhone ?? '—'}</td>
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
            {valid.length}명 등록
          </button>
        </div>
      </div>
    </div>
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
          학생 등록/수정에서 반 이름을 입력하면 자동 생성됩니다.
        </div>
      )}

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-ink2">
          아직 반이 없습니다. 학생 등록/수정에서 반 이름을 입력하면 자동 생성됩니다.
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

// ── 기타 ─────────────────────────────────────────

const ETC_CARDS = [
  { title: '문자 발송', desc: '학부모·학생 대상 안내 문자' },
  { title: '출결 관리', desc: '등원·하원 출결 기록' },
  { title: '교육비 관리', desc: '수강료 청구·수납 내역' },
]

function EtcTab() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {ETC_CARDS.map(c => (
        <div key={c.title} className="rounded-2xl border border-line bg-white p-5">
          <h3 className="mb-1 font-black">{c.title}</h3>
          <p className="mb-3 text-sm text-ink2">{c.desc}</p>
          <p className="mb-3 rounded-lg bg-paper2 px-3 py-2 text-sm text-ink2">
            학원관리앱(대치스파르타)에서 담당합니다.
          </p>
          <a href="https://daechisparta.vercel.app" target="_blank" rel="noreferrer"
            className="text-sm font-bold text-pine hover:underline">대치스파르타 열기 →</a>
        </div>
      ))}
    </div>
  )
}
