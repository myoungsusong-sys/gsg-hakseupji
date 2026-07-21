import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useBrand } from '../lib/brand'
import SubTabs from '../components/SubTabs'
import { parseStudentForm, parseTimetableForm } from '../lib/formParse'
import { buildTimetable, TT_DAYS } from '../lib/timetable'
import { personaOf } from '../lib/persona'
import { searchBook, searchLecture, splitAmount, type BookInfo, type LectureInfo } from '../lib/bookinfo'
import type { StudentTimetable } from '../types'

// ── 양식지 (수업 준비 > 양식지) ──────────────────────────────────
// ① 인쇄해서 학생·학부모에게 받는 종이 양식 2종
// ② 받아 적은 내용을 그대로 붙여넣으면 학생 등록·시간표가 자동 생성
// ③ 교재·인강 정보 자동 조회 + 분량 자동 분배

const TABS = [
  { key: 'intake', label: '① 신규 등록 양식지' },
  { key: 'tt', label: '② 시간표 양식지' },
  { key: 'lookup', label: '③ 교재·인강 조회' },
]

export default function FormsPage() {
  const [tab, setTab] = useState('intake')
  return (
    <div>
      <div className="note-noprint"><SubTabs tabs={TABS} value={tab} onChange={setTab} /></div>
      {tab === 'intake' && <IntakeTab />}
      {tab === 'tt' && <TimetableTab />}
      {tab === 'lookup' && <LookupTab />}
    </div>
  )
}

const BOX = 'rounded-2xl border border-line bg-white p-5'
const TA = 'w-full rounded-lg border border-line px-3 py-2 font-mono text-sm'

// ── ① 신규 등록 ────────────────────────────────────────────────
const INTAKE_SAMPLE = `이름: 홍길동
학년: 중2
학교: 내포중
출결번호: 1234
학생연락처: 010-0000-0000
학부모연락처: 010-1111-2222
생년월일: 2012.03.15
주소: 홍성군 내포신도시
MBTI: INFP
혈액형: A
수업요일: 월수금
등원시간: 17:00
하원시간: 22:00
최근시험: 1학기 중간 수학 82, 1학기 기말 수학 76
이전학원: OO수학학원 1년, 최근 3개월 공백
현재진도: 학교 중2-2, 선행 없음
목표: 내신 대비
성향: 실수가 잦음, 기초 연산 부족
자기공부시간: 주 3시간
학부모요청: 연산 실수 반복이 걱정, 숙제 관리 요청
특이사항: 밤에 집중이 잘 됨`

function IntakeTab() {
  const { students, addStudent } = useStore()
  const brand = useBrand()
  const nav = useNavigate()
  const [text, setText] = useState('')
  const parsed = useMemo(() => (text.trim() ? parseStudentForm(text) : null), [text])

  function register() {
    if (!parsed?.patch.name) { alert('이름을 찾지 못했습니다. "이름: 홍길동" 형식으로 적어주세요.'); return }
    const used = new Set(students.map(s => s.attendNo).filter(Boolean) as string[])
    let no = parsed.patch.attendNo
    if (!no || used.has(no)) {
      do { no = String(Math.floor(1000 + Math.random() * 9000)) } while (used.has(no))
    }
    const id = addStudent({ ...parsed.patch, name: parsed.patch.name!, grade: parsed.patch.grade ?? '중1', attendNo: no })
    alert(`${parsed.patch.name} 학생을 등록했습니다. (출결번호 ${no})`)
    nav(`/timetable/${id}`)
  }

  return (
    <div className="mt-4 grid gap-4">
      <div className={`${BOX} note-noprint`}>
        <p className="text-sm font-black">받아 적은 내용 붙여넣기</p>
        <p className="mt-1 text-xs text-ink2">
          아래 양식지를 인쇄해 학생·학부모에게 받은 뒤, 적힌 대로 옮겨 적으면 자동으로 등록됩니다.
          모르는 항목은 빼도 되고 순서도 상관없습니다.
        </p>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={12} className={`${TA} mt-2`}
          placeholder={INTAKE_SAMPLE} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button onClick={() => setText(INTAKE_SAMPLE)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink2 hover:border-pine">예시 채우기</button>
          <button onClick={register} disabled={!parsed?.patch.name}
            className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper disabled:opacity-40">
            이 내용으로 학생 등록 → 시간표 만들기
          </button>
          {parsed && (
            <span className="text-xs text-ink2">
              인식 {parsed.found.length}항목{parsed.unknownLines.length > 0 ? ` · 못 읽은 줄 ${parsed.unknownLines.length}` : ''}
            </span>
          )}
        </div>
        {parsed && parsed.found.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {parsed.found.map((f, i) => <span key={i} className="rounded bg-pine-soft px-1.5 py-0.5 text-[11px] font-bold text-pine-dark">{f}</span>)}
          </div>
        )}
        {parsed && parsed.unknownLines.length > 0 && (
          <p className="mt-2 text-xs text-red-600">못 읽은 줄: {parsed.unknownLines.slice(0, 3).join(' / ')}{parsed.unknownLines.length > 3 ? ' …' : ''}</p>
        )}
        {parsed?.patch.mbti && (() => {
          const p = personaOf(parsed.patch.mbti, parsed.patch.bloodType)
          return p ? <p className="mt-2 rounded-lg bg-paper2/60 px-3 py-2 text-xs text-ink2">성향 참고 — 권장 블록 {p.slotMin}분. {p.planStyle}</p> : null
        })()}
      </div>

      {/* 인쇄용 양식지 */}
      <div className={`${BOX} note-print`}>
        <div className="mb-4 flex items-end justify-between border-b-2 border-ink pb-2">
          <h1 className="text-xl font-black">신규 학생 등록 양식지</h1>
          <span className="text-xs text-ink2">{brand}</span>
        </div>
        <p className="mb-3 text-xs text-ink2">학생·학부모님께서 아는 만큼만 적어주세요. 빈칸이 있어도 괜찮습니다.</p>
        <FormGrid rows={[
          ['이름', ''], ['학년', '초·중·고    학년'], ['학교', ''], ['생년월일', '        년      월      일'],
          ['학생 연락처', ''], ['학부모 연락처', ''], ['집 주소', ''],
        ]} />
        <SectionTitle>학습 배경</SectionTitle>
        <FormGrid rows={[
          ['최근 학교시험', '예) 1학기 중간 수학 82점 / 기말 수학 76점'],
          ['이전 학원·과외', '예) OO학원 1년 다니다 3개월 쉬었음'],
          ['현재 진도', '예) 학교는 중2-2 진행, 선행 없음'],
          ['학습 목표', '내신 대비 / 수능 대비 / 선행 / 기초 보강 / 특목·자사고'],
          ['자기공부 시간', '학원 외 주      시간'],
          ['학부모님 요청', '가장 걱정되는 점, 요청하실 점'],
        ]} tall />
        <SectionTitle>성향 (참고용 — 모르면 비워두세요)</SectionTitle>
        <FormGrid rows={[
          ['MBTI', 'E/I   N/S   T/F   J/P    →              (모르면 공란)'],
          ['혈액형', 'A / B / O / AB'],
          ['공부 성향 (해당에 ○)', '실수 잦음 · 개념 부족 · 속도 느림 · 서술형 약함 · 기초연산 부족 · 응용 약함 · 집중력 짧음 · 숙제 미이행 · 시험 불안 · 성실'],
          ['집중 잘 되는 시간대', '아침 / 오후 / 저녁 / 밤'],
        ]} tall />
        <SectionTitle>등원</SectionTitle>
        <FormGrid rows={[
          ['수업 요일', '월  화  수  목  금  토  일   (해당 요일에 ○)'],
          ['등원 시간', '       :          ~   하원      :'],
          ['특이사항', '건강·통학·기타 알려주실 점'],
        ]} tall />
        <p className="mt-6 text-center text-xs text-ink2">{brand} · 작성일 ____년 ____월 ____일 · 작성자 ____________</p>
      </div>
      <PrintButton />
    </div>
  )
}

// ── ② 시간표 양식지 ────────────────────────────────────────────
const TT_SAMPLE = `블록: 60분
월: 16:00~22:00
화: 16:00~22:00
수: 16:00~22:00
목: 16:00~22:00
금: 16:00~22:00
토: 10:00~16:00
일: 휴무
교재: 쎈 중등수학 1(상) / 수학 / 주5
교재: 오투 중등과학 / 과학 / 주3
인강: 엠베스트 국어 / 국어 / 주3`

function TimetableTab() {
  const { students, updateStudent } = useStore()
  const brand = useBrand()
  const nav = useNavigate()
  const [studentId, setStudentId] = useState('')
  const [text, setText] = useState('')
  const parsed = useMemo(() => (text.trim() ? parseTimetableForm(text) : null), [text])
  const active = useMemo(() => students.filter(s => s.active), [students])

  function apply() {
    const st = active.find(s => s.id === studentId)
    if (!st) { alert('학생을 선택하세요.'); return }
    if (!parsed || parsed.resources.length === 0) { alert('교재·인강을 한 개 이상 적어주세요.'); return }
    const persona = personaOf(st.mbti, st.bloodType)
    const slotMin = parsed.slotMin ?? persona?.slotMin ?? 60
    const days: StudentTimetable['days'] = Object.fromEntries(TT_DAYS.map(d => [d, parsed.days[d] ?? null]))
    const blocks = buildTimetable(days, slotMin, parsed.resources)
    const tt: StudentTimetable = { days, slotMin, resources: parsed.resources, blocks, updatedAt: new Date().toISOString() }
    updateStudent(st.id, { timetable: tt })
    nav(`/timetable/${st.id}`)
  }

  return (
    <div className="mt-4 grid gap-4">
      <div className={`${BOX} note-noprint`}>
        <p className="text-sm font-black">받아 적은 시간표 붙여넣기</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={studentId} onChange={e => setStudentId(e.target.value)}
            className="rounded-lg border border-line px-2 py-1.5 text-sm">
            <option value="">학생 선택</option>
            {active.map(s => <option key={s.id} value={s.id}>{s.name} ({s.grade})</option>)}
          </select>
          <button onClick={() => setText(TT_SAMPLE)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink2 hover:border-pine">예시 채우기</button>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={12} className={`${TA} mt-2`} placeholder={TT_SAMPLE} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button onClick={apply} disabled={!studentId || !parsed?.resources.length}
            className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper disabled:opacity-40">
            이 내용으로 시간표 만들기
          </button>
          {parsed && <span className="text-xs text-ink2">인식 {parsed.found.length}항목 · 교재/인강 {parsed.resources.length}개</span>}
        </div>
        {parsed && parsed.found.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {parsed.found.map((f, i) => <span key={i} className="rounded bg-pine-soft px-1.5 py-0.5 text-[11px] font-bold text-pine-dark">{f}</span>)}
          </div>
        )}
      </div>

      <div className={`${BOX} note-print`}>
        <div className="mb-4 flex items-end justify-between border-b-2 border-ink pb-2">
          <h1 className="text-xl font-black">시간표 설계 양식지</h1>
          <span className="text-xs text-ink2">{brand}</span>
        </div>
        <p className="mb-1 text-sm font-bold">1. 공부 가능한 시간 (요일별로 적어주세요)</p>
        <table className="mb-4 w-full border-collapse text-sm">
          <thead><tr className="bg-paper2/60">
            <th className="border border-line px-2 py-1.5 w-16">요일</th>
            <th className="border border-line px-2 py-1.5">시작 ~ 끝</th>
            <th className="border border-line px-2 py-1.5">비고 (학원·과외 등 못 하는 시간)</th>
          </tr></thead>
          <tbody>
            {TT_DAYS.map(d => (
              <tr key={d}>
                <td className="border border-line px-2 py-3 text-center font-bold">{d}</td>
                <td className="border border-line px-2 py-3">        :        ~        :</td>
                <td className="border border-line px-2 py-3" />
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mb-1 text-sm font-bold">2. 공부할 교재·인강 (아는 만큼)</p>
        <table className="mb-4 w-full border-collapse text-sm">
          <thead><tr className="bg-paper2/60">
            <th className="border border-line px-2 py-1.5 w-20">교재/인강</th>
            <th className="border border-line px-2 py-1.5">이름</th>
            <th className="border border-line px-2 py-1.5 w-20">과목</th>
            <th className="border border-line px-2 py-1.5 w-24">주 몇 회</th>
            <th className="border border-line px-2 py-1.5 w-28">끝낼 목표일</th>
          </tr></thead>
          <tbody>
            {Array.from({ length: 6 }, (_, i) => (
              <tr key={i}>
                <td className="border border-line px-2 py-3 text-center text-xs text-ink2">교재 / 인강</td>
                <td className="border border-line px-2 py-3" />
                <td className="border border-line px-2 py-3" />
                <td className="border border-line px-2 py-3" />
                <td className="border border-line px-2 py-3" />
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-ink2">
          ※ 교재의 전체 쪽수·인강의 총 강수는 몰라도 됩니다 — 앱이 자동으로 찾아 분량을 나눠줍니다.
          한 번에 집중되는 시간(예: 50분/60분/90분)이 있으면 여기 적어주세요: ____________
        </p>
        <p className="mt-6 text-center text-xs text-ink2">{brand} · 학생 ____________ · 작성일 ____년 ____월 ____일</p>
      </div>
      <PrintButton />
    </div>
  )
}

// ── ③ 교재·인강 조회 + 분량 분배 ──────────────────────────────
function LookupTab() {
  const { workbooks, wbItems } = useStore()
  const [q, setQ] = useState('')
  const [books, setBooks] = useState<BookInfo[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const lectures = useMemo(() => searchLecture(q), [q])
  // 앱에 등록된 교재 — wbItems의 실제 최대 페이지라 웹 조회보다 정확하다
  const myBooks = useMemo(() => {
    const t = q.trim()
    if (!t) return []
    return workbooks.filter(w => w.name.includes(t) || (w.publisher ?? '').includes(t)).map(w => {
      const items = wbItems.filter(i => i.workbookId === w.id)
      const maxPage = items.reduce((a, i) => Math.max(a, i.page || 0), 0)
      return { w, count: items.length, maxPage }
    }).filter(x => x.count > 0)
  }, [q, workbooks, wbItems])

  const [total, setTotal] = useState(0)
  const [unit, setUnit] = useState<'쪽' | '강'>('쪽')
  const [sessions, setSessions] = useState(20)
  const split = useMemo(() => splitAmount(total, sessions), [total, sessions])

  async function find() {
    if (!q.trim()) return
    setBusy(true); setErr(null); setBooks(null)
    try { setBooks(await searchBook(q)) }
    catch (e: any) { setErr(e?.message ?? '조회 실패') }
    finally { setBusy(false) }
  }

  return (
    <div className="mt-4 grid gap-4">
      <div className={BOX}>
        <p className="text-sm font-black">교재·인강 이름으로 찾기</p>
        <p className="mt-1 text-xs text-ink2">
          교재는 웹(구글 도서)에서 <b>전체 쪽수</b>를, 인강은 내장 강좌표에서 <b>총 강수·1강 시간</b>을 찾아옵니다.
          찾은 값은 아래에서 수정할 수 있습니다.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && find()}
            placeholder="예: 쎈 중등수학 1(상) · 현우진 · 엠베스트 국어"
            className="w-0 min-w-64 flex-1 rounded-lg border border-line px-3 py-2 text-sm" />
          <button onClick={find} disabled={busy} className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper disabled:opacity-40">
            {busy ? '찾는 중…' : '🔎 교재 찾기'}
          </button>
        </div>
        {err && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {err.includes('429') ? '구글 도서 조회가 일시적으로 막혔습니다(무료 공용 한도). 잠시 뒤 다시 시도하거나, 아래에서 쪽수를 직접 입력하세요.' : err}
          </p>
        )}

        {myBooks.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-bold text-ink2">📘 우리 앱에 등록된 교재 (실제 데이터라 가장 정확)</p>
            <div className="grid gap-1">
              {myBooks.map(({ w, count, maxPage }) => (
                <button key={w.id} onClick={() => { setTotal(maxPage || count); setUnit(maxPage ? '쪽' : '강') }}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-pine/40 bg-pine-soft/20 px-3 py-2 text-left text-sm hover:border-pine">
                  <b>{w.name}</b>
                  <span className="text-xs text-ink2">{w.publisher} · {w.grade} · 문항 {count}개{maxPage ? ` · 마지막 ${maxPage}쪽` : ''}</span>
                  <span className="ml-auto shrink-0 text-xs font-bold text-pine">{maxPage ? '쪽수 쓰기' : '문항수 쓰기'}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {lectures.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-bold text-ink2">🎧 인강 (내장 강좌표)</p>
            <div className="grid gap-1">
              {lectures.map((l, i) => (
                <LectureRow key={i} l={l} onPick={() => { if (l.units) { setTotal(l.units); setUnit('강') } }} />
              ))}
            </div>
          </div>
        )}
        {books && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-bold text-ink2">📗 교재 (구글 도서)</p>
            {books.length === 0 && <p className="text-sm text-ink2">검색 결과가 없습니다. 쪽수를 아래에 직접 입력하세요.</p>}
            <div className="grid gap-1">
              {books.map((b, i) => (
                <button key={i} onClick={() => { if (b.pageCount) { setTotal(b.pageCount); setUnit('쪽') } }}
                  className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-left text-sm hover:border-pine">
                  {b.cover && <img src={b.cover} alt="" className="h-12 w-9 shrink-0 rounded object-cover" />}
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{b.title}</span>
                    <span className="text-xs text-ink2">{b.publisher ?? ''}{b.pageCount ? ` · 총 ${b.pageCount}쪽` : ' · 쪽수 정보 없음'}</span>
                  </span>
                  {b.pageCount != null && <span className="ml-auto shrink-0 text-xs font-bold text-pine">쪽수 쓰기</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={BOX}>
        <p className="text-sm font-black">분량 자동 나누기</p>
        <div className="mt-2 flex flex-wrap items-end gap-2 text-sm">
          <label className="grid gap-1 text-xs font-bold text-ink2">
            전체 분량
            <span className="flex items-center gap-1">
              <input type="number" min={0} value={total || ''} onChange={e => setTotal(Number(e.target.value) || 0)}
                className="w-24 rounded-lg border border-line px-2 py-1.5 text-sm" />
              <select value={unit} onChange={e => setUnit(e.target.value as '쪽' | '강')} className="rounded-lg border border-line px-2 py-1.5 text-sm">
                <option value="쪽">쪽</option><option value="강">강</option>
              </select>
            </span>
          </label>
          <label className="grid gap-1 text-xs font-bold text-ink2">
            회차 수
            <input type="number" min={1} value={sessions} onChange={e => setSessions(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 rounded-lg border border-line px-2 py-1.5 text-sm" />
          </label>
          {split.length > 0 && (
            <span className="pb-2 text-xs text-ink2">
              회당 약 <b className="text-ink">{Math.ceil(total / sessions)}{unit}</b>
            </span>
          )}
        </div>
        {split.length > 0 && (
          <div className="mt-3 grid max-h-72 gap-1 overflow-y-auto">
            {split.map(s => (
              <div key={s.no} className="flex items-center gap-3 rounded-lg border border-line/60 px-3 py-1.5 text-sm">
                <span className="w-14 shrink-0 text-xs font-bold text-ink2">{s.no}회차</span>
                <span className="font-semibold">{s.from}~{s.to}{unit}</span>
                <span className="ml-auto text-xs text-ink2">{s.to - s.from + 1}{unit}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-ink2">
          ※ 이 분배표는 <b>진도표</b>(수업 &gt; 진도표)에 그대로 옮겨 쓰면 시간표 블록에 쪽수로 표시됩니다.
        </p>
      </div>
    </div>
  )
}

function LectureRow({ l, onPick }: { l: LectureInfo; onPick: () => void }) {
  return (
    <button onClick={onPick} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 text-left text-sm hover:border-pine">
      <span className="shrink-0 rounded bg-paper2 px-1.5 py-0.5 text-[11px] font-bold text-ink2">{l.site}</span>
      <b>{l.course}</b>
      <span className="text-xs text-ink2">
        {l.teacher && l.teacher !== '-' ? `${l.teacher} · ` : ''}{l.subject}
        {l.grade ? ` · ${l.grade}` : ''}
        {l.units ? ` · 총 ${l.units}강` : ' · 강수 미확인'}
        {l.minutesPerUnit ? ` · 1강 ${l.minutesPerUnit}분` : ''}
        {l.year ? ` · ${l.year}` : ''}
      </span>
      {l.units
        ? <span className="ml-auto shrink-0 text-xs font-bold text-pine">강수 쓰기</span>
        : <span className="ml-auto shrink-0 text-xs text-ink2">직접 입력 필요</span>}
    </button>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 mt-4 border-l-4 border-pine pl-2 text-sm font-black">{children}</p>
}

function FormGrid({ rows, tall }: { rows: [string, string][]; tall?: boolean }) {
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {rows.map(([k, hint], i) => (
          <tr key={i}>
            <td className="w-40 border border-line bg-paper2/40 px-2 py-2 font-bold">{k}</td>
            <td className={`border border-line px-2 ${tall ? 'py-4' : 'py-3'} text-xs text-ink2`}>{hint}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PrintButton() {
  return (
    <div className="note-noprint">
      <button onClick={() => window.print()} className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper">🖨 이 양식지 인쇄 / PDF</button>
    </div>
  )
}
