import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export interface ExamPaper {
  id: string
  grade: string
  year: string
  month: string
  region: string
  subject?: string
  problemPdf: string
  solutionPdf: string | null
  qPages: number
  sPages: number
}

// 회차 표시명: 수능/예비는 학년도(연도+1)로, 학평은 N월
export function examTitle(p: ExamPaper): string {
  if (p.month === '수능') return `${Number(p.year) + 1}학년도 수능${p.subject ? ` · ${p.subject}` : ''}`
  if (p.month === '예비') return `${Number(p.year) + 1}학년도 예비시행${p.subject ? ` · ${p.subject}` : ''}`
  return `${p.year}년 ${p.month}월 학평`
}

type SubTab = 'exam' | 'twin' | 'ebs' | 'police' | 'policeTwin' | 'kmm'

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'exam', label: '수능·모의고사' },
  { key: 'twin', label: '모의고사 쌍둥이' },
  { key: 'ebs', label: '수능특강·수능완성' },
  { key: 'police', label: '경찰대·사관학교' },
  { key: 'policeTwin', label: '경찰대·사관학교 쌍둥이' },
  { key: 'kmm', label: 'KMM수학경시대회' },
]

// 수능·모의고사 — 매쓰플랫과 동일한 6개 하위 탭. 첫 탭(기출)만 실데이터, 나머지는 구조·계획.
export default function CsatLibrary() {
  const [tab, setTab] = useState<SubTab>('exam')
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-x-6 gap-y-1 border-b border-line px-1">
        {SUB_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`-mb-px whitespace-nowrap border-b-2 pb-3 pt-1 text-[15px] font-bold transition ${
              tab === t.key ? 'border-pine text-ink' : 'border-transparent text-ink2 hover:text-ink'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'exam' && <ExamList />}
      {tab === 'twin' && <Pending title="모의고사 쌍둥이"
        original="선택한 모의고사 문항의 숫자·상황을 바꾼 쌍둥이(변형) 문제 세트."
        plan="기출은 원본 이미지라 숫자 변형이 안 됩니다. 유형별 자체 쌍둥이(AI 생성+검산)가 쌓이면, 기출 문항의 유형에 맞춰 우리 쌍둥이를 뽑아 제공합니다." />}
      {tab === 'ebs' && <Pending title="수능특강·수능완성"
        original="EBS 수능 연계교재(수능특강·수능완성)를 단원·문항 단위로 출제."
        plan="EBS 연계교재는 저작권 자료라 수록하지 않습니다. 보유 교재를 명수쌤이 정답표(문항→유형·정답)로 등록하면 '교재' 채점·드릴에 연동됩니다." />}
      {tab === 'police' && <Pending title="경찰대·사관학교"
        original="경찰대학·사관학교 1차 시험 수학 기출을 회차별로 제공."
        plan="경찰대·사관학교 기출 PDF를 확보하면 학평 기출과 같은 파이프라인(렌더→문항 크롭→태깅)으로 바로 탑재합니다. 현재 EBSi 다운로드분에는 없습니다." />}
      {tab === 'policeTwin' && <Pending title="경찰대·사관학교 쌍둥이"
        original="경찰대·사관학교 기출의 쌍둥이(변형) 문제."
        plan="경찰대·사관학교 기출이 탑재되고 자체 쌍둥이 뱅크가 갖춰지면 유형 매칭으로 제공합니다." />}
      {tab === 'kmm' && <Pending title="KMM수학경시대회"
        original="KMM 수학경시대회 기출·모의 문항."
        plan="KMM 문항 데이터를 확보하면 회차/유형별로 탑재합니다. (별도 라이선스·데이터 필요)" />}
    </div>
  )
}

function ExamList() {
  const [papers, setPapers] = useState<ExamPaper[] | null>(null)
  const [grade, setGrade] = useState('전체')
  const [year, setYear] = useState('전체')
  const [month, setMonth] = useState('전체')  // 전체/학평/수능
  const [subject, setSubject] = useState('전체')
  const [q, setQ] = useState('')
  const nav = useNavigate()

  useEffect(() => {
    fetch('/gichul/index.json').then(r => r.ok ? r.json() : []).then(setPapers).catch(() => setPapers([]))
  }, [])

  const years = useMemo(() => papers ? [...new Set(papers.map(p => p.year))].sort().reverse() : [], [papers])
  const subjects = useMemo(() => papers ? [...new Set(papers.map(p => p.subject).filter(Boolean))] as string[] : [], [papers])

  const list = useMemo(() => (papers ?? []).filter(p =>
    (grade === '전체' || p.grade === grade) &&
    (year === '전체' || p.year === year) &&
    (month === '전체' || (month === '수능' ? (p.month === '수능' || p.month === '예비') : p.month !== '수능' && p.month !== '예비')) &&
    (subject === '전체' || p.subject === subject) &&
    (!q.trim() || examTitle(p).includes(q.trim()) || p.region.includes(q.trim()))),
    [papers, grade, year, month, subject, q])

  if (papers === null) return <div className="text-ink2">기출 목록을 불러오는 중…</div>

  if (papers.length === 0) return (
    <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
      이 배포판에는 <b>기출 이미지(1.3GB)</b>가 포함되지 않았습니다.<br />
      기출 열람·태깅은 로컬 버전(이 맥)에서 이용하거나, 별도 스토리지 연동 후 활성화됩니다.<br />
      학습지 제작·오답 드릴·보고지 등 나머지 기능은 정상 동작합니다.
    </div>
  )

  return (
    <div>
      <p className="mb-4 text-sm text-ink2">
        2006년부터의 학력평가·수능 수학 기출 <b>{papers.length}회차</b>. 원본 이미지 그대로 열람·인쇄하고, 문항을 태깅해 문제은행에 넣습니다. (EBSi · 출처 표기)
      </p>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Seg label="학년" value={grade} setValue={setGrade} options={['전체', '고1', '고2', '고3']} />
        <Seg label="구분" value={month} setValue={setMonth} options={['전체', '학평', '수능']} />
        <Seg label="연도" value={year} setValue={setYear} options={['전체', ...years]} />
        {subjects.length > 0 && <Seg label="과목" value={subject} setValue={setSubject} options={['전체', ...subjects]} />}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="회차·지역 검색"
          className="rounded-full border border-line bg-white px-4 py-2 text-sm outline-none focus:border-pine" />
        <span className="self-center text-sm text-ink2">{list.length}회차</span>
      </div>

      {list.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          조건에 맞는 회차가 없습니다.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(p => {
          const cropped = false // 크롭 여부는 태깅 화면에서 확인
          void cropped
          return (
            <div key={p.id} className="rounded-2xl border border-line bg-white p-5">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded bg-paper2 px-2 py-0.5 text-xs font-bold text-ink2">{p.grade}</span>
                {p.month === '수능' && <span className="rounded bg-clay/15 px-2 py-0.5 text-xs font-bold text-clay">수능</span>}
                <b className="text-base">{examTitle(p)}</b>
              </div>
              <div className="text-sm text-ink2">{p.region} · 수학 · 문제 {p.qPages}p / 해설 {p.sPages}p</div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => nav(`/gichul/${p.id}`)}
                  className="rounded-lg border border-pine px-4 py-2 text-sm font-semibold text-pine hover:bg-pine-soft">열람·인쇄</button>
                <button onClick={() => nav(`/gichul-tag/${p.id}`)}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink2 hover:border-amber hover:text-amber">문항 태깅</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Pending({ title, original, plan }: { title: string; original: string; plan: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-10">
      <div className="mb-2 flex items-center gap-3">
        <h2 className="text-lg font-black">{title}</h2>
        <span className="rounded-full bg-paper2 px-3 py-1 text-xs font-bold text-ink2">구조 확보 · 콘텐츠 대기</span>
      </div>
      <div className="mb-4 rounded-xl bg-paper2 p-4 text-sm text-ink2"><b className="text-ink">원본 기능</b> — {original}</div>
      <div className="rounded-xl border border-dashed border-pine/40 bg-pine-soft/30 p-4 text-sm"><b className="text-pine-dark">활성화 계획</b> — {plan}</div>
    </div>
  )
}

function Seg({ label, value, setValue, options }: {
  label: string; value: string; setValue: (v: string) => void; options: string[]
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-white p-1">
      <span className="px-2 text-xs font-bold text-ink2">{label}</span>
      {options.map(o => (
        <button key={o} onClick={() => setValue(o)}
          className={`rounded-full px-3 py-1 text-sm ${value === o ? 'bg-pine text-paper font-semibold' : 'text-ink2'}`}>{o}</button>
      ))}
    </div>
  )
}
