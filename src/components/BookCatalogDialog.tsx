import { useMemo, useState } from 'react'
import { WB_MATCH_BOOKS } from '../data/wbMatch'
import { TEXTBOOK_BOOKS } from '../data/textbooks'
import { OTU_BOOKS } from '../data/otuBooks'
import type { Subject } from '../lib/subject'

// 매쓰플랫 「전체 교재 목록」과 동일한 카탈로그 다이얼로그
// 시중교재 719종(중1-1~중3-2 · 공통수학1 · 공통수학2 · 대수 · 미적분Ⅰ · 확률과 통계 · 미적분Ⅱ · 기하)
// 교과서 405종(초 268 · 중 48 · 고 89, 15/22개정) — 매쓰플랫 type=SCHOOL 전량

const COURSES = [
  '초1-1', '초1-2', '초2-1', '초2-2', '초3-1', '초3-2', '초4-1', '초4-2', '초5-1', '초5-2', '초6-1', '초6-2',
  '중1-1', '중1-2', '중2-1', '중2-2', '중3-1', '중3-2', '중3-2(2015)',
  '공통수학1', '공통수학2', '대수', '미적분Ⅰ', '확률과 통계', '미적분Ⅱ', '기하',
]

const LEVELS = ['전체', '초', '중', '고'] as const
const TABS = ['내 교재', '시그니처 교재', '시중교재', '교과서'] as const
type Tab = typeof TABS[number]

// 2차 필터 (매쓰플랫 동일): 중=학년·학기 드롭다운, 고=과목 드롭다운
const MID_TERMS = ['중1-1', '중1-2', '중2-1', '중2-2', '중3-1', '중3-2', '중3-2(2015)']
const HIGH_SUBJECTS = ['공통수학1', '공통수학2', '대수', '미적분Ⅰ', '확률과 통계', '미적분Ⅱ', '기하']
const ELEM_TERMS = ['초1-1', '초1-2', '초2-1', '초2-2', '초3-1', '초3-2', '초4-1', '초4-2', '초5-1', '초5-2', '초6-1', '초6-2']

// 학년 표기 (매쓰플랫 동일): 초등 "초 3-1", 중등 "중 1-1", 고등은 과목명 그대로. '(2015)' 표식은 개정 부라벨로 분리.
function gradeLabel(grade: string): string {
  const g = grade.replace('(2015)', '')
  if (g.startsWith('중')) return `중 ${g.slice(1)}`
  if (g.startsWith('초')) return `초 ${g.slice(1)}`
  return g
}
function gradeRev(grade: string): string {
  return grade.endsWith('(2015)') ? '(2015개정)' : '(22개정)'
}

// 교과서 학년 표기: 초 3-1 / 중 1 / 공통수학1 …
function tbGradeLabel(schoolType: 'E' | 'M' | 'H', grade: string, semester?: number): string {
  if (schoolType === 'E') return `초 ${grade}${semester ? `-${semester}` : ''}`
  if (schoolType === 'M') return `중 ${grade}`
  return grade
}
const LEVEL_OF_ST = { E: '초', M: '중', H: '고' } as const

export interface CatalogBook { name: string; publisher: string; grade: string; matchKey?: string; course?: string; subject?: Subject }

export default function BookCatalogDialog({ defaultGrade, existingKeys, subject = '수학', onClose, onAdd }: {
  defaultGrade?: string
  existingKeys: Set<string>
  subject?: Subject
  onClose: () => void
  onAdd: (books: CatalogBook[]) => void
}) {
  const sci = subject === '과학'
  const [level, setLevel] = useState<typeof LEVELS[number]>('전체')
  const [sub, setSub] = useState('전체')   // 2차 필터: 학년·학기(중) / 과목(고)
  const [tab, setTab] = useState<Tab>('시중교재')
  const [q, setQ] = useState('')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [manual, setManual] = useState(false)
  const [mName, setMName] = useState('')
  const [mPub, setMPub] = useState('')
  const [mGrade, setMGrade] = useState(defaultGrade && COURSES.includes(defaultGrade) ? defaultGrade : '중1-1')

  const isTextbook = tab === '교과서'

  // 교과서 2차 드롭다운 옵션 (선택한 학교급의 실제 학년·과목에서 동적 생성)
  const tbSubOptions = useMemo(() => {
    if (!isTextbook || (level !== '중' && level !== '고' && level !== '초')) return []
    const st = level === '초' ? 'E' : level === '중' ? 'M' : 'H'
    const seen = new Set<string>()
    const opts: string[] = []
    for (const b of TEXTBOOK_BOOKS) {
      if (b.schoolType !== st) continue
      const key = tbGradeLabel(b.schoolType, b.grade, b.semester)
      if (!seen.has(key)) { seen.add(key); opts.push(key) }
    }
    return opts
  }, [isTextbook, level])

  // 시중교재 필터 (기존 로직)
  const filteredMatch = useMemo(() => {
    if (isTextbook) return []
    if (tab !== '시중교재') return []
    const kw = q.trim().toLowerCase()
    const list = WB_MATCH_BOOKS.filter(b => {
      if (level === '초' && !b.grade.startsWith('초')) return false
      if (level === '중' && !b.grade.startsWith('중')) return false
      if (level === '고' && (b.grade.startsWith('중') || b.grade.startsWith('초'))) return false
      if (sub !== '전체' && b.grade !== sub) return false   // 2차 필터(학년·학기/과목)
      if (kw && !b.name.toLowerCase().includes(kw)) return false
      return true
    })
    // 매쓰플랫 동일 정렬: ① 이미 배정된 교재 최상단 고정 ② 과정 오름차순(중1-1→…→기하) ③ 교재명순
    return [...list].sort((a, b) => {
      const aHas = existingKeys.has(a.key) ? 0 : 1
      const bHas = existingKeys.has(b.key) ? 0 : 1
      if (aHas !== bHas) return aHas - bHas
      const ac = COURSES.indexOf(a.grade), bc = COURSES.indexOf(b.grade)
      if (ac !== bc) return ac - bc
      return a.name.localeCompare(b.name, 'ko')
    })
  }, [isTextbook, tab, level, sub, q, existingKeys])

  // 교과서 필터
  const filteredTb = useMemo(() => {
    if (!isTextbook) return []
    const kw = q.trim().toLowerCase()
    return TEXTBOOK_BOOKS.filter(b => {
      if (level !== '전체' && LEVEL_OF_ST[b.schoolType] !== level) return false
      if (sub !== '전체' && tbGradeLabel(b.schoolType, b.grade, b.semester) !== sub) return false
      if (kw && !b.name.toLowerCase().includes(kw) && !b.publisher.toLowerCase().includes(kw)) return false
      return true
    })
    // TEXTBOOK_BOOKS는 이미 학교급→개정→학년→출판사 순으로 정렬돼 있음
  }, [isTextbook, level, sub, q])

  // 과학(오투) 필터 — 교재명·학년 검색만 (오투 중등과학 5권)
  const filteredOtu = useMemo(() => {
    if (!sci) return []
    const kw = q.trim().toLowerCase()
    return OTU_BOOKS.filter(b =>
      !kw || b.name.toLowerCase().includes(kw) || b.grade.includes(kw) || b.publisher.toLowerCase().includes(kw))
  }, [sci, q])

  function toggle(key: string) {
    setChecked(prev => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key); else n.add(key)
      return n
    })
  }

  function submit() {
    let books: CatalogBook[]
    if (sci) {
      books = OTU_BOOKS
        .filter(b => checked.has(b.key))
        .map(b => ({ name: b.name, publisher: b.publisher, grade: b.grade, matchKey: b.key, course: b.course, subject: '과학' as Subject }))
    } else if (isTextbook) {
      // 정답표(wb-match) 보유 교과서(393권)는 matchKey·course를 실어 등록 → 시중교재와 동일하게
      // 채점판 번호·정답이 자동 파생. 미보유(정답 미지원)는 matchKey 없이 등록(정답표 수동 등록 필요).
      books = TEXTBOOK_BOOKS
        .filter(b => checked.has(b.key))
        .map(b => ({
          name: b.name, publisher: b.publisher, grade: tbGradeLabel(b.schoolType, b.grade, b.semester),
          ...(b.hasAnswers ? { matchKey: b.matchKey, course: b.course } : {}),
        }))
    } else {
      books = WB_MATCH_BOOKS
        .filter(b => checked.has(b.key))
        .map(b => ({ name: b.name, publisher: b.publisher, grade: b.grade, matchKey: b.key }))
    }
    if (books.length === 0) { alert('출제할 교재를 선택하세요.'); return }
    onAdd(books)
  }

  function submitManual() {
    if (!mName.trim()) { alert('교재명을 입력하세요.'); return }
    onAdd([{ name: mName.trim(), publisher: mPub.trim(), grade: mGrade }])
  }

  const showEmpty = sci ? filteredOtu.length === 0 : isTextbook ? filteredTb.length === 0 : (tab === '시중교재' && filteredMatch.length === 0)

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-lg font-bold">{sci ? '오투 중등과학 교재' : '전체 교재 목록'}</h3>
          <div className="grow" />
          <button onClick={onClose} className="text-ink2 hover:text-ink">✕</button>
        </div>

        {/* 필터: 학교급 칩 + 검색 */}
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          {!sci && LEVELS.map(l => (
            <button key={l} onClick={() => { setLevel(l); setSub('전체') }}
              className={`rounded-full px-3 py-1 text-xs font-bold ${level === l ? 'bg-pine text-paper' : 'border border-line text-ink2 hover:bg-paper2'}`}>
              {l}
            </button>
          ))}
          {/* 2차 드롭다운 (매쓰플랫 동일): 중=학년·학기, 고=과목 전체 */}
          {!isTextbook && (level === '초' || level === '중' || level === '고') && (
            <select value={sub} onChange={e => setSub(e.target.value)}
              className="rounded-lg border border-line px-2 py-1.5 text-xs font-semibold text-ink">
              <option value="전체">{level === '고' ? '과목 전체' : '학년·학기'}</option>
              {(level === '초' ? ELEM_TERMS : level === '중' ? MID_TERMS : HIGH_SUBJECTS).map(s => (
                <option key={s} value={s}>{s.endsWith('(2015)') ? s.replace('(2015)', '(2015개정)') : `${s}(22개정)`}</option>
              ))}
            </select>
          )}
          {isTextbook && level !== '전체' && (
            <select value={sub} onChange={e => setSub(e.target.value)}
              className="rounded-lg border border-line px-2 py-1.5 text-xs font-semibold text-ink">
              <option value="전체">{level === '고' ? '과목 전체' : '학년 전체'}</option>
              {tbSubOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <div className="grow" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="교재명 검색"
            className="w-56 rounded-lg border border-line px-3 py-1.5 text-sm" autoFocus />
        </div>

        {/* 탭: 내 교재 | 시그니처 교재 | 시중교재 | 교과서 (기본: 시중교재) — 과학은 오투만이라 탭 없음 */}
        {!sci && <div className="mb-3 flex gap-1 border-b border-line text-sm">
          {TABS.map(t => (
            <button key={t} onClick={() => { setTab(t); setSub('전체') }}
              className={`-mb-px px-3 py-2 font-semibold ${tab === t ? 'border-b-2 border-ink font-bold text-ink' : 'text-ink2 hover:text-ink'}`}>
              {t}
            </button>
          ))}
        </div>}

        {/* 교재 표 */}
        <div className="min-h-0 grow overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-paper2">
              <tr className="text-left text-xs text-ink2">
                <th className="w-10 px-3 py-2">선택</th><th className="py-2">학년</th><th>교재명</th>
                <th>정답</th>
                <th>출판사</th><th>최근진도</th><th className="px-3">출제여부</th>
              </tr>
            </thead>
            <tbody>
              {/* 시중교재 */}
              {!sci && !isTextbook && filteredMatch.map(b => {
                const has = existingKeys.has(b.key)
                const on = checked.has(b.key)
                return (
                  <tr key={b.key} onClick={() => { if (!has) toggle(b.key) }}
                    className={`border-t border-line/50 ${has ? '' : `cursor-pointer ${on ? 'bg-pine-soft/50' : 'hover:bg-paper2'}`}`}>
                    <td className="px-3 py-1.5">
                      <input type="checkbox" checked={on || has} disabled={has} readOnly
                        className="pointer-events-none accent-[var(--color-pine,#2e6b4f)] disabled:opacity-40" />
                    </td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-xs text-ink2">
                      <div>{gradeLabel(b.grade)}</div>
                      <div className="text-[10px]">{gradeRev(b.grade)}</div>
                    </td>
                    <td className="py-1.5 pr-2 font-semibold">{b.name}</td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-xs text-ink2">지원</td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-xs text-ink2">{b.publisher}</td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-xs text-ink2">-</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-xs text-ink2">
                      {has ? <><span className="text-green-500">●</span> 이미 배정됨</> : '-'}
                    </td>
                  </tr>
                )
              })}
              {/* 교과서 */}
              {!sci && isTextbook && filteredTb.map(b => {
                const on = checked.has(b.key)
                return (
                  <tr key={b.key} onClick={() => toggle(b.key)}
                    className={`cursor-pointer border-t border-line/50 ${on ? 'bg-pine-soft/50' : 'hover:bg-paper2'}`}>
                    <td className="px-3 py-1.5">
                      <input type="checkbox" checked={on} readOnly
                        className="pointer-events-none accent-[var(--color-pine,#2e6b4f)]" />
                    </td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-xs text-ink2">
                      <div>{tbGradeLabel(b.schoolType, b.grade, b.semester)}</div>
                      <div className="text-[10px]">({b.rev}개정)</div>
                    </td>
                    <td className="py-1.5 pr-2 font-semibold">{b.name}</td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-xs">
                      {b.hasAnswers ? <span className="font-semibold text-green-600">정답 지원</span> : <span className="text-ink2">-</span>}
                    </td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-xs text-ink2">{b.publisher}</td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-xs text-ink2">-</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-xs text-ink2">-</td>
                  </tr>
                )
              })}
              {/* 과학: 오투 중등과학 교재 */}
              {sci && filteredOtu.map(b => {
                const has = existingKeys.has(b.key)
                const on = checked.has(b.key)
                return (
                  <tr key={b.key} onClick={() => { if (!has) toggle(b.key) }}
                    className={`border-t border-line/50 ${has ? '' : `cursor-pointer ${on ? 'bg-pine-soft/50' : 'hover:bg-paper2'}`}`}>
                    <td className="px-3 py-1.5">
                      <input type="checkbox" checked={on || has} disabled={has} readOnly
                        className="pointer-events-none accent-[var(--color-pine,#2e6b4f)] disabled:opacity-40" />
                    </td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-xs text-ink2">
                      <div>{gradeLabel(b.grade)}</div>
                      <div className="text-[10px]">과학 · {b.count}문항</div>
                    </td>
                    <td className="py-1.5 pr-2 font-semibold">{b.name}</td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-xs text-ink2">OX채점</td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-xs text-ink2">{b.publisher}</td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-xs text-ink2">-</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-xs text-ink2">
                      {has ? <><span className="text-green-500">●</span> 이미 배정됨</> : '-'}
                    </td>
                  </tr>
                )
              })}
              {/* 내 교재 · 시그니처 교재: 데이터 없음 */}
            </tbody>
          </table>
          {showEmpty && (
            <p className="whitespace-pre-line p-8 text-center text-sm text-ink2">{'검색 결과가 없습니다.\n다시 입력해주세요.'}</p>
          )}
          {!sci && (tab === '내 교재' || tab === '시그니처 교재') && (
            <p className="whitespace-pre-line p-8 text-center text-sm text-ink2">{'표시할 교재가 없습니다.'}</p>
          )}
        </div>

        {/* 하단 바: 이전 | 선택한 교재 수 | 출제하기 */}
        <div className="mt-3 flex items-center gap-3 text-sm">
          <button onClick={onClose}
            className="rounded-lg border border-line px-4 py-2 font-semibold text-ink2 hover:bg-paper2">
            이전
          </button>
          {isTextbook && <span className="text-[11px] text-ink2">'정답 지원' 교과서는 등록 즉시 자동 채점됩니다. 그 외는 정답표 일괄 등록 후 채점됩니다.</span>}
          <div className="grow" />
          <span className="text-ink2">선택한 교재 수 <b className="text-pine">{checked.size}</b>권</span>
          <button onClick={submit} disabled={checked.size === 0}
            className="rounded-lg bg-pine px-5 py-2 font-bold text-paper disabled:opacity-40">
            출제하기
          </button>
        </div>

        {/* 직접 입력 폴백 (작은 링크) — 과학(오투)은 매칭 교재만이라 숨김 */}
        {!sci && <div className="mt-2 text-right">
          <button onClick={() => setManual(v => !v)}
            className="text-xs text-ink2 underline hover:text-ink">직접 입력</button>
        </div>}

        {!sci && manual && (
          <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl border border-line bg-paper2 p-3 text-sm">
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
