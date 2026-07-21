import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SubTabs from '../components/SubTabs'
import Placeholder from '../components/Placeholder'
import { useStore, uid } from '../lib/store'
import { useBrand } from '../lib/brand'
import { DEFAULT_SHEET_OPTIONS } from '../types'
import { curriculumFor } from '../data/curriculum'
import { POOL_COURSES, WANJA_COURSES } from '../data/pool'
import { diagnosisCourses, hasPool, pickDiagnosisProblems, planQuota } from '../lib/diagnosis'

// 테스트 — 매쓰플랫과 동일 4탭
const TABS = [
  { key: 'entrance', label: '입학 TEST' },
  { key: 'weekly', label: '주간 TEST' },
  { key: 'unit', label: '단원 TEST' },
  { key: 'total', label: '총괄 TEST' },
]

const DESC: Record<string, string> = {
  weekly: '한 주 학습 범위를 점검하는 주간 테스트',
  unit: '단원 마무리 점검 테스트',
  total: '여러 단원을 아우르는 총괄 테스트',
}

export default function TestPrep() {
  const [tab, setTab] = useState('entrance')
  const label = TABS.find(t => t.key === tab)!.label
  return (
    <div>
      <SubTabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'entrance' ? <EntranceDiagnosis /> : (
        <Placeholder title={label}
          original={[DESC[tab], '학년 필터(초1~고1) + 문제수·난이도 표기 세트 목록']}
          plan="지금은 학습지 만들기에서 태그(주간/단원/총괄 TEST)로 직접 생성 가능." />
      )}
    </div>
  )
}

// ── 입학 진단고사 자동 출제 ────────────────────────────────────────────────
// 현재 학년 과정 + 선수 과정을 대단원 고르게 커버 → 채점하면 유형분석이 취약점 지도가 된다.

const ALL_POOL_COURSES: string[] = [...POOL_COURSES, ...WANJA_COURSES]

function EntranceDiagnosis() {
  const { students, problems, ensureCourse, saveWorksheet, addAssignment } = useStore()
  const brand = useBrand()
  const nav = useNavigate()

  const active = useMemo(() => students.filter(s => s.active), [students])
  const [studentId, setStudentId] = useState('')
  const student = active.find(s => s.id === studentId)
  const [grade, setGrade] = useState('중1')          // 학생 미선택 시 수동 학년
  const effGrade = student?.grade ?? grade
  const [courses, setCourses] = useState<string[]>(() => diagnosisCourses('중1'))
  const [total, setTotal] = useState(25)
  const [assignNow, setAssignNow] = useState(true)

  // 학년이 바뀌면 진단 범위 재계산 (현재 + 선수 2과정)
  useEffect(() => { setCourses(diagnosisCourses(effGrade)) }, [effGrade])
  // 선택 과정 문제 풀 지연 로드
  useEffect(() => { courses.forEach(c => ensureCourse(c)) }, [courses, ensureCourse])

  // 과정별 후보 문항 수 (풀 로드 진행 표시 겸)
  const poolByCourse = useMemo(() => {
    const m = new Map<string, typeof problems>()
    for (const c of courses) {
      const typeIds = new Set(
        curriculumFor(c).units.flatMap(u => u.mids.flatMap(mm => mm.subs.flatMap(s => s.types.map(t => t.id)))))
      m.set(c, problems.filter(p => typeIds.has(p.typeId)))
    }
    return m
  }, [courses, problems])

  const plan = useMemo(() => planQuota(courses, total), [courses, total])
  const preview = useMemo(() =>
    plan.map(({ courseId, count }) => ({
      courseId, count,
      picked: pickDiagnosisProblems(courseId, count, poolByCourse.get(courseId) ?? []),
    })), [plan, poolByCourse])
  const pickedTotal = preview.reduce((a, x) => a + x.picked.length, 0)
  const loading = courses.some(c => (poolByCourse.get(c)?.length ?? 0) === 0)

  function create() {
    const problemIds = preview.flatMap(x => x.picked.map(p => p.id))
    if (problemIds.length === 0) { alert('선택한 범위의 문제가 문제은행에 없습니다.'); return }
    const id = uid('ws')
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.')
    saveWorksheet({
      id,
      title: `입학 진단 — ${student?.name ?? effGrade} (${today})`,
      author: brand,
      grade: effGrade,
      tags: ['입학 TEST'],
      theme: 'amber',
      problemIds,
      conceptIds: [],
      options: { ...DEFAULT_SHEET_OPTIONS, showTypeName: true, autoGrade: true },
      listIds: [],
      createdAt: new Date().toISOString(),
      deletedAt: null,
    })
    if (student && assignNow) addAssignment(id, [student.id], '수업')
    nav(`/worksheet/${id}`)
  }

  const SELECT = 'rounded-lg border border-line bg-white px-2 py-1.5 text-sm'
  return (
    <div className="mt-4 grid gap-4">
      <div className="rounded-2xl border border-line bg-white p-5">
        <p className="text-sm font-black">🧭 입학 진단고사 자동 출제</p>
        <p className="mt-1 text-xs leading-relaxed text-ink2">
          현재 학년 과정과 선수 과정을 대단원별로 고르게 출제합니다. 채점하면 수업 &gt; 유형분석에서
          유형별 성취도(취약점 지도)가 바로 표시되고, 입학 상담 리포트의 근거가 됩니다.
        </p>

        <div className="mt-4 grid gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-24 font-bold">학생</span>
            <select value={studentId} onChange={e => setStudentId(e.target.value)} className={SELECT}>
              <option value="">(학생 미지정 — 학년만 선택)</option>
              {active.map(s => <option key={s.id} value={s.id}>{s.name} ({s.grade})</option>)}
            </select>
            {!student && (
              <select value={grade} onChange={e => setGrade(e.target.value)} className={SELECT}>
                {['초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2'].map(g =>
                  <option key={g} value={g}>{g}</option>)}
              </select>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-24 shrink-0 font-bold">진단 범위</span>
            {courses.map((c, i) => (
              <span key={c} className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold">
                {curriculumFor(c).label.replace(/ \(.*\)$/, '')}
                <span className="text-ink2">{i === 0 ? '현재' : '선수'}</span>
                <button type="button" className="text-ink2 hover:text-ink"
                  onClick={() => setCourses(courses.filter(x => x !== c))}>✕</button>
              </span>
            ))}
            <select value="" className={SELECT}
              onChange={e => { if (e.target.value && !courses.includes(e.target.value)) setCourses([...courses, e.target.value]) }}>
              <option value="">＋ 과정 추가</option>
              {ALL_POOL_COURSES.filter(c => !courses.includes(c) && hasPool(c)).map(c =>
                <option key={c} value={c}>{curriculumFor(c).label}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-24 font-bold">문항 수</span>
            {[20, 25, 30].map(n => (
              <button key={n} type="button" onClick={() => setTotal(n)}
                className={`rounded-md border px-3 py-1 text-sm font-semibold ${total === n ? 'border-pine bg-pine text-paper' : 'border-line text-ink2 hover:border-pine'}`}>
                {n}
              </button>
            ))}
            <span className="text-xs text-ink2">난이도는 중 50%·중하 25%·상 25%로 자동 배분</span>
          </div>

          {student && (
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={assignNow} onChange={e => setAssignNow(e.target.checked)} />
              생성 후 {student.name} 학생에게 바로 출제 (학생앱에서 풀이 가능)
            </label>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white p-5">
        <p className="text-sm font-black">출제 미리보기 — 총 {pickedTotal}문항{loading ? ' (문제 풀 로딩 중…)' : ''}</p>
        <div className="mt-2 grid gap-1.5">
          {preview.map(x => (
            <div key={x.courseId} className="flex items-center gap-2 text-sm">
              <span className="w-56 shrink-0">{curriculumFor(x.courseId).label.replace(/ \(.*\)$/, '')}</span>
              <span className="font-bold">{x.picked.length}문항</span>
              <span className="text-xs text-ink2">
                (목표 {x.count} · 후보 {poolByCourse.get(x.courseId)?.length ?? 0}문제)
              </span>
            </div>
          ))}
        </div>
        <button type="button" onClick={create} disabled={pickedTotal === 0}
          className="mt-4 rounded-lg bg-pine px-6 py-2.5 text-sm font-bold text-paper disabled:opacity-40">
          진단고사 만들기
        </button>
      </div>
    </div>
  )
}
