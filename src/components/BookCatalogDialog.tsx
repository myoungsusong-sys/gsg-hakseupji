import { useMemo, useState } from 'react'
import { WB_MATCH_BOOKS } from '../data/wbMatch'

// 매쓰플랫 「전체 교재 목록」과 동일한 시중교재 카탈로그 다이얼로그
// 719종(중1-1~중3-2 · 공통수학1 · 공통수학2 · 대수 · 미적분Ⅰ · 확률과 통계 · 미적분Ⅱ · 기하)

const COURSES = [
  '중1-1', '중1-2', '중2-1', '중2-2', '중3-1', '중3-2',
  '공통수학1', '공통수학2', '대수', '미적분Ⅰ', '확률과 통계', '미적분Ⅱ', '기하',
]

export interface CatalogBook { name: string; publisher: string; grade: string; matchKey?: string }

export default function BookCatalogDialog({ defaultGrade, existingKeys, onClose, onAdd }: {
  defaultGrade?: string
  existingKeys: Set<string>
  onClose: () => void
  onAdd: (books: CatalogBook[]) => void
}) {
  const [level, setLevel] = useState<'전체' | '중' | '고'>('전체')
  const [course, setCourse] = useState('전체')
  const [q, setQ] = useState('')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [manual, setManual] = useState(false)
  const [mName, setMName] = useState('')
  const [mPub, setMPub] = useState('')
  const [mGrade, setMGrade] = useState(defaultGrade && COURSES.includes(defaultGrade) ? defaultGrade : '중1-1')

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    const list = WB_MATCH_BOOKS.filter(b => {
      if (level === '중' && !b.grade.startsWith('중')) return false
      if (level === '고' && b.grade.startsWith('중')) return false
      if (course !== '전체' && b.grade !== course) return false
      if (kw && !b.name.toLowerCase().includes(kw) && !b.publisher.toLowerCase().includes(kw)) return false
      return true
    })
    // 학생 학년과 같은 과정 우선 (stable sort)
    if (defaultGrade) return [...list].sort((a, b) => (a.grade === defaultGrade ? 0 : 1) - (b.grade === defaultGrade ? 0 : 1))
    return list
  }, [level, course, q, defaultGrade])

  function toggle(key: string) {
    setChecked(prev => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key); else n.add(key)
      return n
    })
  }

  function submit() {
    const books: CatalogBook[] = WB_MATCH_BOOKS
      .filter(b => checked.has(b.key))
      .map(b => ({ name: b.name, publisher: b.publisher, grade: b.grade, matchKey: b.key }))
    if (books.length === 0) { alert('등록할 교재를 선택하세요.'); return }
    onAdd(books)
  }

  function submitManual() {
    if (!mName.trim()) { alert('교재명을 입력하세요.'); return }
    onAdd([{ name: mName.trim(), publisher: mPub.trim(), grade: mGrade }])
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-lg font-bold">전체 교재 목록</h3>
          <span className="rounded-full bg-pine-soft px-2.5 py-0.5 text-xs font-bold text-pine-dark">{WB_MATCH_BOOKS.length}종 · 문항별 유형 자동 매칭</span>
          <div className="grow" />
          <button onClick={onClose} className="text-ink2 hover:text-ink">✕</button>
        </div>

        {/* 필터: 학교급 칩 + 과정 셀렉트 + 검색 */}
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          {(['전체', '중', '고'] as const).map(l => (
            <button key={l} onClick={() => { setLevel(l); setCourse('전체') }}
              className={`rounded-full px-3 py-1 text-xs font-bold ${level === l ? 'bg-pine text-paper' : 'border border-line text-ink2 hover:bg-paper2'}`}>
              {l}
            </button>
          ))}
          <select value={course} onChange={e => setCourse(e.target.value)}
            className="rounded-lg border border-line px-2 py-1.5 text-sm">
            <option value="전체">전체 과정</option>
            {COURSES
              .filter(c => level === '전체' || (level === '중' ? c.startsWith('중') : !c.startsWith('중')))
              .map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="교재명·출판사 검색 (쎈, RPM…)"
            className="min-w-0 grow rounded-lg border border-line px-3 py-1.5 text-sm" autoFocus />
        </div>

        {/* 교재 표 */}
        <div className="min-h-0 grow overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-paper2">
              <tr className="text-left text-xs text-ink2">
                <th className="w-8 px-3 py-2"></th><th className="py-2">학년</th><th>교재명</th><th>출판사</th>
                <th className="text-right">문항 수</th><th className="px-3 text-right">상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const has = existingKeys.has(b.key)
                const on = checked.has(b.key)
                return (
                  <tr key={b.key} onClick={() => { if (!has) toggle(b.key) }}
                    className={`border-t border-line/50 ${has ? 'opacity-40' : `cursor-pointer ${on ? 'bg-pine-soft/50' : 'hover:bg-paper2'}`}`}>
                    <td className="px-3 py-1.5">
                      <input type="checkbox" checked={on} disabled={has} readOnly className="pointer-events-none accent-[var(--color-pine,#2e6b4f)]" />
                    </td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-xs text-ink2">{b.grade}</td>
                    <td className="py-1.5 pr-2 font-semibold">{b.name}</td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-xs text-ink2">{b.publisher}</td>
                    <td className="whitespace-nowrap py-1.5 text-right text-xs text-ink2">{b.count}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right text-xs text-ink2">{has ? '이미 등록됨' : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="p-8 text-center text-sm text-ink2">검색 결과가 없습니다. 「직접 입력」으로 추가하세요.</p>}
        </div>

        {/* 하단: 선택 요약 + 등록 + 직접 입력 */}
        <div className="mt-3 flex items-center gap-3 text-sm">
          <span className="text-ink2">선택한 교재 <b className="text-ink">{checked.size}</b>권</span>
          <div className="grow" />
          <button onClick={() => setManual(v => !v)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${manual ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2 hover:bg-paper2'}`}>
            직접 입력
          </button>
          <button onClick={submit} disabled={checked.size === 0}
            className="rounded-lg bg-pine px-5 py-2 font-bold text-paper disabled:opacity-40">
            {checked.size}권 등록하기
          </button>
        </div>

        {manual && (
          <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-line bg-paper2 p-3 text-sm">
            <label className="grid gap-1 text-xs font-bold">교재명
              <input value={mName} onChange={e => setMName(e.target.value)} placeholder="쎈 중등수학 1(상)"
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-normal" />
            </label>
            <label className="grid gap-1 text-xs font-bold">출판사
              <input value={mPub} onChange={e => setMPub(e.target.value)} placeholder="좋은책신사고"
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-normal" />
            </label>
            <label className="grid gap-1 text-xs font-bold">학년
              <select value={mGrade} onChange={e => setMGrade(e.target.value)}
                className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm font-normal">
                {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <button onClick={submitManual}
              className="rounded-lg bg-amber px-4 py-2 text-xs font-bold text-white">1권 등록</button>
            <p className="w-full text-[11px] text-ink2">직접 입력한 교재는 유형 자동 매칭이 없어 정답표를 일괄 등록해야 채점할 수 있습니다.</p>
          </div>
        )}
      </div>
    </div>
  )
}
