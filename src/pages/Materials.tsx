import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SubTabs from '../components/SubTabs'
import Placeholder from '../components/Placeholder'
import Workbooks from './Workbooks'
import { WB_MATCH_BOOKS, loadWbMatch, courseOfGrade, type MatchData, type WbMatchBook } from '../data/wbMatch'
import { TEXTBOOK_BOOKS } from '../data/textbooks'
import { typeName, subjectOfCourse } from '../data/curriculum'
import { useStore, uid } from '../lib/store'
import { useBrand } from '../lib/brand'
import { useSubject } from '../lib/subject'
import type { Problem } from '../types'
import { DEFAULT_SHEET_OPTIONS, DIFF_LABEL } from '../types'

// 교재 — 매쓰플랫과 동일한 탭(시그니처/내 교재/시중교재) + 우리 오답 드릴용 '정답표' 흡수
const TABS = [
  { key: 'signature', label: '시그니처 교재' },
  { key: 'mine', label: '내 교재' },
  { key: 'market', label: '시중교재' },
  { key: 'answerkey', label: '정답표(채점용)' },
]

export default function Materials() {
  const [tab, setTab] = useState('answerkey')
  return (
    <div>
      <SubTabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'signature' && <Placeholder title="시그니처 교재"
        original={['학원 로고를 담은 커스텀 교재(개념서·연산서 등) 제작·표지 편집·구매']}
        plan="자체 교재(수력충전·명수쌤 노트)를 표지 커스텀으로 묶어 인쇄본으로 낼 때 활성화." />}
      {tab === 'mine' && <MyBooksPanel />}
      {tab === 'market' && <MarketCatalog />}
      {tab === 'answerkey' && <Workbooks />}
    </div>
  )
}

/* ── 내 교재: 학습지들을 교재 단위로 묶어 저장 (매쓰플랫 내 교재 등가) ── */
function MyBooksPanel() {
  const { myBooks, removeMyBook, addMyBook, worksheets, wbItems } = useStore()
  void wbItems
  const nav = useNavigate()
  const [making, setMaking] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const activeWs = worksheets.filter(w => !w.deletedAt)

  return (
    <div>
      <div className="mb-4 flex items-center">
        <span className="text-sm text-ink2">학습지를 묶어 교재로 저장하고, 교재 단위로 열람·인쇄합니다.</span>
        <div className="grow" />
        <button onClick={() => setMaking(true)}
          className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper hover:bg-pine-dark">＋ 교재 만들기</button>
      </div>

      {myBooks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-16 text-center text-ink2">
          <p className="mb-4">학원 교재가 존재하지 않습니다.</p>
          <button onClick={() => setMaking(true)}
            className="rounded-lg bg-pine px-5 py-2.5 text-sm font-bold text-paper hover:bg-pine-dark">교재 만들기</button>
        </div>
      ) : (
        <div className="grid gap-3">
          {myBooks.map(b => {
            const wss = b.worksheetIds.map(id => worksheets.find(w => w.id === id)).filter(w => w != null)
            const nProblems = wss.reduce((a, w) => a + w.problemIds.length, 0)
            const on = open === b.id
            return (
              <div key={b.id} className="rounded-2xl border border-line bg-white">
                <div className="flex items-center gap-3 px-5 py-4">
                  <button onClick={() => setOpen(on ? null : b.id)} className="flex grow items-center gap-3 text-left">
                    <span className="text-xs text-ink2">{on ? '▾' : '▸'}</span>
                    <span className="rounded bg-amber-soft px-1.5 py-0.5 text-[10px] font-black text-amber">교재</span>
                    <b>{b.title}</b>
                    <span className="text-xs text-ink2">{b.grade} · 학습지 {wss.length}개 · {nProblems}문항 · {b.createdAt.slice(0, 10)}</span>
                  </button>
                  <button onClick={() => { if (confirm(`"${b.title}" 교재를 삭제할까요? (학습지는 삭제되지 않습니다)`)) removeMyBook(b.id) }}
                    className="rounded border border-line px-2.5 py-1 text-xs text-ink2 hover:border-clay hover:text-clay">삭제</button>
                </div>
                {on && (
                  <div className="border-t border-line px-6 py-3">
                    {wss.length === 0 && <p className="text-sm text-ink2">구성 학습지가 삭제되어 비어 있습니다.</p>}
                    {wss.map((w, i) => (
                      <div key={w.id} className="flex items-center gap-2 py-1.5 text-sm">
                        <span className="w-6 text-right text-xs text-ink2">{i + 1}.</span>
                        <button onClick={() => nav(`/worksheet/${w.id}`)} className="font-semibold hover:underline">{w.title}</button>
                        <span className="text-xs text-ink2">{w.problemIds.length}문제</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 교재 만들기: 학습지(문제은행에서 만든) 선택 → 교재 저장 */}
      {making && (
        <MakeBookModal worksheets={activeWs}
          onClose={() => setMaking(false)}
          onSave={(name, ids) => {
            const grade = activeWs.find(w => w.id === ids[0])?.grade ?? ''
            addMyBook({ title: name, grade, worksheetIds: ids })
            setMaking(false)
          }} />
      )}
    </div>
  )
}

function MakeBookModal({ worksheets, onClose, onSave }: {
  worksheets: { id: string; title: string; grade: string; problemIds: string[] }[]
  onClose: () => void
  onSave: (name: string, wsIds: string[]) => void
}) {
  const [name, setName] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
        <h3 className="mb-1 font-bold">교재 만들기</h3>
        <p className="mb-4 text-sm text-ink2">묶을 학습지를 선택하세요. (문제은행에서 만든 학습지 → 교재)</p>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="교재 이름 (예: 중2-1 여름방학 특강)"
          className="mb-3 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-pine" />
        {worksheets.length === 0 ? (
          <div className="mb-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink2">
            학습지가 없습니다. 수업 준비 &gt; 학습지에서 먼저 만들어 주세요.
          </div>
        ) : (
          <div className="grid max-h-72 gap-2 overflow-y-auto">
            {worksheets.map(w => {
              const on = sel.has(w.id)
              return (
                <label key={w.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${on ? 'border-pine bg-pine-soft/40' : 'border-line'}`}>
                  <input type="checkbox" checked={on} className="h-4 w-4 accent-pine"
                    onChange={() => setSel(prev => { const n = new Set(prev); if (n.has(w.id)) n.delete(w.id); else n.add(w.id); return n })} />
                  <b>{w.title}</b>
                  <span className="text-xs text-ink2">{w.grade} · {w.problemIds.length}문제</span>
                </label>
              )
            })}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm">취소</button>
          <button disabled={!name.trim() || sel.size === 0}
            onClick={() => onSave(name.trim(), [...sel])}
            className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper disabled:opacity-40">
            교재 만들기 ({sel.size}개)
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── 시중교재 라이브러리 — [전체|초|중|고] [과정▾] ⦿전체 ○시중교재 ○교과서 [검색]
     표: 학년|교재명|정답|출판사|출제. 교재명 클릭 → 상세(페이지·문항 그리드 → 쌍둥이·유사 학습지) ── */
type MarketRow = {
  key: string; name: string; publisher: string; grade: string
  kind: '시중교재' | '교과서'; count: number; answer: boolean
  course?: string                          // 과목 판별용 과정 id
  matchBook?: WbMatchBook
  tbMatchKey?: string; tbCourse?: string   // 교과서 정답표(wb-match) 매칭 — 등록 시 자동 채점
  sciCourse?: string                       // 과학 교재(오투 등) — 클릭 시 그 과정으로 학습지 만들기
}

// 오투 과학 교재 — 이미지 문제풀로 편입된 과정(WANJA_COURSES). 교재 검색에서 찾아 바로 출제.
const OTU_BOOKS: { name: string; grade: string; course: string; count: number }[] = [
  { name: '오투 중등과학 1-1 (22개정)', grade: '중1', course: 'm-sci1-1', count: 379 },
  { name: '오투 중등과학 1-2 (22개정)', grade: '중1', course: 'm-sci1-2', count: 336 },
  { name: '오투 중등과학 2-1 (22개정)', grade: '중2', course: 'm-sci2-1', count: 432 },
  { name: '오투 중등과학 2-2 (22개정)', grade: '중2', course: 'm-sci2-2', count: 419 },
  { name: '오투 중등과학 3-2 (15개정)', grade: '중3', course: 'm-sci3-2', count: 359 },
  { name: '오투 고등 통합과학1 (22개정)', grade: '고1', course: 'h-int1', count: 361 },
  { name: '오투 고등 통합과학2 (22개정)', grade: '고1', course: 'h-int2', count: 335 },
]

function MarketCatalog() {
  const { workbooks, addWorkbook } = useStore()
  const [subject] = useSubject()
  const nav = useNavigate()
  const [level, setLevel] = useState<'전체' | '초' | '중' | '고'>('전체')
  const [course, setCourse] = useState('전체')
  const [kind, setKind] = useState<'전체' | '시중교재' | '교과서'>('전체')
  const [q, setQ] = useState('')
  const [detail, setDetail] = useState<WbMatchBook | null>(null)
  const registered = useMemo(() => new Set(workbooks.map(w => w.matchKey).filter(Boolean)), [workbooks])
  const courses = useMemo(() => [...new Set(WB_MATCH_BOOKS.map(b => b.grade))], [])

  const rows = useMemo<MarketRow[]>(() => {
    const market: MarketRow[] = WB_MATCH_BOOKS.map(b => ({
      key: `m|${b.key}`, name: b.name, publisher: b.publisher, grade: b.grade,
      kind: '시중교재', count: b.count, answer: true, course: b.course, matchBook: b,
    }))
    // 교과서 405종 (BookCatalogDialog와 동일 카탈로그 재사용) — 정답표는 수동 등록
    const tb: MarketRow[] = TEXTBOOK_BOOKS.map(b => ({
      key: `t|${b.key}`,
      name: `${b.name}${b.rev === '15' ? ' (15개정)' : ''}`,
      publisher: b.publisher,
      grade: b.schoolType === 'E' ? `초${b.grade}${b.semester ? `-${b.semester}` : ''}` : b.schoolType === 'M' ? `중${b.grade}` : b.grade,
      kind: '교과서', count: b.count, answer: !!b.hasAnswers, course: b.course,
      ...(b.hasAnswers ? { tbMatchKey: b.matchKey, tbCourse: b.course } : {}),
    }))
    // 오투 과학 교재 — 클릭 시 그 과정으로 학습지 만들기
    const sci: MarketRow[] = OTU_BOOKS.map(b => ({
      key: `s|${b.course}`, name: b.name, publisher: '비상교육', grade: b.grade,
      kind: '시중교재', count: b.count, answer: false, course: b.course, sciCourse: b.course,
    }))
    return [...market, ...tb, ...sci]
  }, [])

  // 교재 과목: 과정으로 유도(과학 과정이면 과학, 그 외/무과정=수학)
  const rowSubject = (r: MarketRow) => subjectOfCourse(r.course) ?? '수학'

  const list = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return rows.filter(r => {
      if (rowSubject(r) !== subject) return false
      if (kind !== '전체' && r.kind !== kind) return false
      if (level === '초' && !r.grade.startsWith('초')) return false
      if (level === '중' && !r.grade.startsWith('중')) return false
      if (level === '고' && (r.grade.startsWith('초') || r.grade.startsWith('중'))) return false
      if (course !== '전체' && r.grade !== course) return false
      if (kw && !r.name.toLowerCase().includes(kw) && !r.publisher.toLowerCase().includes(kw)) return false
      return true
    })
  }, [rows, level, course, kind, q, subject])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {(['전체', '초', '중', '고'] as const).map(l => (
            <button key={l} onClick={() => setLevel(l)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${level === l ? 'bg-pine text-paper' : 'border border-line text-ink2 hover:bg-paper2'}`}>{l}</button>
          ))}
        </div>
        <select value={course} onChange={e => setCourse(e.target.value)} className="rounded-lg border border-line px-2 py-1.5 text-sm">
          <option value="전체">전체</option>
          {courses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(['전체', '시중교재', '교과서'] as const).map(k => (
          <label key={k} className="flex items-center gap-1 text-sm">
            <input type="radio" checked={kind === k} onChange={() => setKind(k)} /> {k}
          </label>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="교재명 검색"
          className="w-56 rounded-lg border border-line px-3 py-2 text-sm" />
        <span className="text-sm text-ink2">{list.length}종</span>
      </div>
      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          검색 결과가 없습니다.<br />다시 입력해주세요.
          {level === '초' && kind !== '교과서' && (
            <div className="mt-2 text-xs">※ 초등 시중교재 문항 매칭 데이터는 아직 없습니다 — 초등은 교과서 목록을 이용하세요.</div>
          )}
        </div>
      ) : (
        <div className="max-h-[65vh] overflow-y-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-paper2">
              <tr className="text-left text-xs text-ink2">
                <th className="px-4 py-2.5">학년</th><th>교재명</th><th>정답</th><th>출판사</th><th className="pr-4 text-right">출제</th>
              </tr>
            </thead>
            <tbody>
              {list.map(r => {
                const has = r.matchBook ? registered.has(r.matchBook.key) : (r.tbMatchKey ? registered.has(r.tbMatchKey) : false)
                return (
                  <tr key={r.key} className="border-t border-line/60">
                    <td className="px-4 py-2 text-ink2">{r.grade}<br /><span className="text-[10px]">{r.name.includes('(15개정)') ? '(15개정)' : '(22개정)'}</span></td>
                    <td className="font-semibold">
                      {r.sciCourse ? (
                        <button onClick={() => nav(`/make?course=${r.sciCourse}`)} className="text-left hover:underline" title="이 교재의 문제로 학습지 만들기">
                          {r.name}
                        </button>
                      ) : r.matchBook ? (
                        <button onClick={() => setDetail(r.matchBook!)} className="text-left hover:underline" title="페이지·문항 상세 보기">
                          {r.name}
                        </button>
                      ) : r.name.replace(' (15개정)', '')}
                      {r.matchBook && <span className="ml-1.5 rounded bg-lime-100 px-1.5 py-0.5 text-[10px] font-bold text-lime-700">쌍둥이 지원</span>}
                      {r.sciCourse && <span className="ml-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">문제은행</span>}
                      <div className="text-[11px] font-normal text-ink2">{r.count.toLocaleString()}문항</div>
                    </td>
                    <td className="text-ink2">{r.answer ? '지원' : '미지원'}</td>
                    <td className="text-ink2">{r.publisher}</td>
                    <td className="pr-4 text-right">
                      {r.sciCourse ? (
                        <button onClick={() => nav(`/make?course=${r.sciCourse}`)}
                          className="rounded-lg border border-indigo-500 px-3 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50">학습지 만들기</button>
                      ) : r.matchBook ? (
                        has ? <span className="text-xs text-ink2">등록됨</span> : (
                          <button onClick={() => addWorkbook({ name: r.name, publisher: r.publisher, grade: r.grade, matchKey: r.matchBook!.key })}
                            className="rounded-lg border border-pine px-3 py-1 text-xs font-bold text-pine hover:bg-pine-soft">출제하기</button>
                        )
                      ) : has ? <span className="text-xs text-ink2">등록됨</span> : (
                        <button onClick={() => {
                          if (r.tbMatchKey) {
                            addWorkbook({ name: r.name.replace(' (15개정)', ''), publisher: r.publisher, grade: r.grade, matchKey: r.tbMatchKey, course: r.tbCourse })
                            alert('교과서를 등록했습니다. 정답표가 자동 연동되어 채점판에 번호·정답이 표시됩니다.' + (r.tbCourse?.startsWith('e') ? ' (초등은 채점 전용 — 오답 드릴 없음)' : ''))
                          } else {
                            addWorkbook({ name: r.name.replace(' (15개정)', ''), publisher: r.publisher, grade: r.grade })
                            alert('교과서를 등록했습니다. 정답표(채점용) 탭에서 문항·정답을 입력하면 채점·드릴에 연동됩니다.')
                          }
                        }} className="rounded-lg border border-line px-3 py-1 text-xs font-bold text-ink2 hover:border-pine hover:text-pine">출제하기</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-ink2">
        출제(등록)하면 수업 → 교재에서 바로 OX채점할 수 있고, 틀린 유형의 쌍둥이·유사 문제로 오답 학습지가 만들어집니다. (문제 원문·정답은 저장하지 않습니다)
        시중교재는 <b>교재명 클릭</b> → 페이지·문항을 골라 쌍둥이·유사 학습지를 바로 만들 수 있습니다.
      </p>

      {detail && <WorkbookDetailDialog book={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

/* ── 교재 상세: 좌 페이지 목록 · 중앙 문항 그리드 · 쌍둥이/유사 구성 문장 → 학습지 생성
     (매쓰플랫 STEP1·시중교재 상세와 동일 구조 — wb-match 데이터 기반) ── */
type RawItem = [string, number, string, number, string?, string?]   // [label, page, conceptId, diff, answer?, kind?]

function WorkbookDetailDialog({ book, onClose }: { book: WbMatchBook; onClose: () => void }) {
  const store = useStore()
  const brand = useBrand()
  const { problems, saveWorksheet } = store
  const nav = useNavigate()
  const course = courseOfGrade(book.grade)
  const [data, setData] = useState<MatchData | null>(null)
  const [selPages, setSelPages] = useState<Set<number>>(new Set())
  const [selItems, setSelItems] = useState<Set<number>>(new Set())   // raw index
  const [twinN, setTwinN] = useState(1)
  const [simN, setSimN] = useState(1)
  const [diffOpt, setDiffOpt] = useState<'easier' | 'same' | 'harder'>('same')

  useEffect(() => {
    if (course) {
      store.ensureCourse(course)   // 문제 풀 지연 로드 (쌍둥이·유사 후보)
      loadWbMatch(course).then(setData).catch(() => setData({}))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course])

  const raw: RawItem[] = useMemo(() => (data?.[book.key] ?? []) as RawItem[], [data, book.key])

  // 페이지 목록 (좌) — 페이지별 문항 수 + 대표 유형명
  const pages = useMemo(() => {
    const m = new Map<number, { n: number; type: string }>()
    raw.forEach(([, page, cid]) => {
      const cur = m.get(page)
      if (cur) cur.n++
      else m.set(page, { n: 1, type: typeName(cid) })
    })
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [raw])

  // 중앙 그리드: 선택 페이지의 문항, 유형명 그룹
  const gridGroups = useMemo(() => {
    const groups = new Map<string, { idx: number; label: string; page: number; diff: number }[]>()
    raw.forEach(([label, page, cid, lv], idx) => {
      if (!selPages.has(page)) return
      const t = typeName(cid)
      const arr = groups.get(t) ?? []
      arr.push({ idx, label, page, diff: lv })
      groups.set(t, arr)
    })
    return [...groups.entries()]
  }, [raw, selPages])

  function togglePage(p: number) {
    setSelPages(prev => {
      const n = new Set(prev)
      if (n.has(p)) {
        n.delete(p)
        // 해제된 페이지의 문항 선택도 해제
        setSelItems(items => new Set([...items].filter(i => raw[i][1] !== p)))
      } else n.add(p)
      return n
    })
  }
  function selectAllPages(on: boolean) {
    if (on) setSelPages(new Set(pages.map(([p]) => p)))
    else { setSelPages(new Set()); setSelItems(new Set()) }
  }

  const estCount = selItems.size * (twinN + simN)

  // 학습지 생성: 선택 문항의 유형에서 쌍둥이(같은 난이도)·유사(난이도 옵션 반영) 문제 선발
  function makeSheet() {
    if (selItems.size === 0 || estCount === 0) return
    const used = new Set<string>()
    const picked: Problem[] = []
    const shift = diffOpt === 'easier' ? -1 : diffOpt === 'harder' ? 1 : 0
    for (const i of [...selItems].sort((a, b) => a - b)) {
      const [, , cid, lv] = raw[i]
      const cands = problems.filter(p => p.typeId === cid && !used.has(p.id))
      // 쌍둥이: 원 문항과 같은 난이도 우선
      const twins = [...cands].sort((a, b) => Math.abs(a.diff - lv) - Math.abs(b.diff - lv)).slice(0, twinN)
      twins.forEach(p => { used.add(p.id); picked.push(p) })
      // 유사: 난이도 옵션(더 쉽게/그대로/더 어렵게) 기준
      const target = Math.min(5, Math.max(1, lv + shift))
      const sims = problems.filter(p => p.typeId === cid && !used.has(p.id))
        .sort((a, b) => Math.abs(a.diff - target) - Math.abs(b.diff - target)).slice(0, simN)
      sims.forEach(p => { used.add(p.id); picked.push(p) })
    }
    if (picked.length === 0) {
      alert('이 유형의 보유 문제가 아직 없습니다. (문제 풀 로딩 중이면 잠시 후 다시 시도)')
      return
    }
    const pgs = [...selPages].sort((a, b) => a - b)
    const id = uid('ws')
    saveWorksheet({
      id,
      title: `${book.name} p.${pgs[0]}~${pgs[pgs.length - 1]} 쌍둥이·유사`,
      author: brand,
      grade: book.grade,
      tags: ['기타자료 유사'],
      theme: 'pine',
      problemIds: picked.map(p => p.id),
      conceptIds: [],
      options: DEFAULT_SHEET_OPTIONS,
      listIds: [],
      createdAt: new Date().toISOString(),
      deletedAt: null,
    })
    onClose()
    nav(`/make?edit=${id}`)   // STEP2 상세 편집으로
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4" onClick={onClose}>
      <div className="flex h-[86vh] w-full max-w-5xl flex-col rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          <h3 className="text-lg font-black">{book.name}</h3>
          <span className="text-sm text-ink2">{book.publisher} · {book.grade} · {book.count.toLocaleString()}문항</span>
          <div className="grow" />
          <button onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink2 hover:bg-paper2">다른 교재 선택 ✕</button>
        </div>

        {!data ? (
          <div className="flex grow items-center justify-center text-sm text-ink2">문항 매칭 데이터를 불러오는 중…</div>
        ) : raw.length === 0 ? (
          <div className="flex grow items-center justify-center text-sm text-ink2">이 교재의 문항 매칭 데이터가 없습니다.</div>
        ) : (
          <div className="grid min-h-0 grow grid-cols-[220px_1fr] gap-4">
            {/* 좌: 페이지 목록 */}
            <div className="flex min-h-0 flex-col rounded-xl border border-line">
              <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-xs font-bold">
                페이지
                <div className="grow" />
                <button onClick={() => selectAllPages(true)} className="text-pine hover:underline">전체 선택</button>
                <button onClick={() => selectAllPages(false)} className="text-ink2 hover:underline">해제</button>
              </div>
              <div className="min-h-0 grow overflow-y-auto p-2">
                {pages.map(([p, info]) => (
                  <label key={p} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-paper2">
                    <input type="checkbox" checked={selPages.has(p)} onChange={() => togglePage(p)} className="h-3.5 w-3.5 accent-pine" />
                    <b>{p}p</b>
                    <span className="truncate text-xs text-ink2" title={info.type}>{info.type}</span>
                    <span className="ml-auto text-xs text-ink2">{info.n}</span>
                  </label>
                ))}
              </div>
            </div>
            {/* 중앙: 문항 그리드 */}
            <div className="min-h-0 overflow-y-auto rounded-xl border border-line p-4">
              {selPages.size === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-ink2">페이지를 선택해주세요.</div>
              ) : gridGroups.map(([type, arr]) => {
                const idxs = arr.map(x => x.idx)
                const allOn = idxs.every(i => selItems.has(i))
                return (
                  <div key={type} className="mb-4">
                    <div className="mb-1.5 flex items-center gap-2 rounded bg-paper2 px-2.5 py-1.5 text-xs font-bold text-ink2">
                      {type}
                      <button onClick={() => setSelItems(prev => {
                        const n = new Set(prev)
                        idxs.forEach(i => { if (allOn) n.delete(i); else n.add(i) })
                        return n
                      })} className="ml-auto font-semibold text-pine hover:underline">{allOn ? '해제' : '전체 선택'}</button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {arr.map(x => {
                        const on = selItems.has(x.idx)
                        return (
                          <button key={x.idx}
                            onClick={() => setSelItems(prev => { const n = new Set(prev); if (n.has(x.idx)) n.delete(x.idx); else n.add(x.idx); return n })}
                            title={`${x.page}p · ${DIFF_LABEL[(x.diff >= 1 && x.diff <= 5 ? x.diff : 3) as 1 | 2 | 3 | 4 | 5]}`}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${on ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2 hover:text-ink'}`}>
                            {x.label} 번
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {selPages.size > 0 && gridGroups.length === 0 && (
                <div className="flex h-full items-center justify-center text-sm text-ink2">문제를 선택해주세요.</div>
              )}
            </div>
          </div>
        )}

        {/* 구성 문장 + 푸터 */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4 text-sm">
          <span>대상 문제의</span>
          <b className="text-pine-dark">쌍둥이 문제</b>
          <select value={twinN} onChange={e => setTwinN(Number(e.target.value))} className="rounded border border-line px-1.5 py-1">
            {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span>개와</span>
          <b className="text-amber">유사문제</b>
          <select value={simN} onChange={e => setSimN(Number(e.target.value))} className="rounded border border-line px-1.5 py-1">
            {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span>개로 학습지를 만듭니다. 유사문제 난이도는</span>
          <select value={diffOpt} onChange={e => setDiffOpt(e.target.value as typeof diffOpt)} className="rounded border border-line px-1.5 py-1">
            <option value="easier">더 쉽게</option>
            <option value="same">그대로</option>
            <option value="harder">더 어렵게</option>
          </select>
          <span>출제합니다.</span>
          <div className="grow" />
          <span>선택 문항 <b>{selItems.size}</b>개 · 학습지 문제 수 <b className="text-pine-dark">{estCount}</b> 개</span>
          <button disabled={estCount === 0} onClick={makeSheet}
            className="rounded-lg bg-pine px-5 py-2.5 text-sm font-bold text-paper disabled:opacity-40">학습지 만들기 →</button>
        </div>
      </div>
    </div>
  )
}
