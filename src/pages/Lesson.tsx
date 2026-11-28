import { useEffect, useMemo, useState } from 'react'
import { useUrlParams } from '../lib/urlState'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { teacherByEmail } from '../lib/role'
import { useSubject } from '../lib/subject'
import type { Student } from '../types'
import GradePanel from '../components/lesson/GradePanel'
import LecturePlanPanel from '../components/lesson/LecturePlanPanel'
import SolveFeedbackPanel from '../components/lesson/SolveFeedbackPanel'
import WorksheetPanel from '../components/lesson/WorksheetPanel'
import WrongReviewPanel from '../components/lesson/WrongReviewPanel'
import HistoryPanel from '../components/lesson/HistoryPanel'
import TodayPanel from '../components/lesson/TodayPanel'
import AnalysisPanel from '../components/lesson/AnalysisPanel'
import ReportPanel from '../components/lesson/ReportPanel'
import VocaPanel from '../components/lesson/VocaPanel'
import VocaClassPanel from '../components/lesson/VocaClassPanel'
import EngLessonTest from '../components/lesson/EngLessonTest'
import CounselPanel from '../components/lesson/CounselPanel'
import SchoolReviewPanel from '../components/lesson/SchoolReviewPanel'
import GroupPanel from '../components/lesson/GroupPanel'
import StudentAppPreview from './student/StudentAppPreview'

// 매쓰플랫과 동일한 6탭. 각 탭 구현은 components/lesson/* 모듈 (리마운트로 state 유실 방지)
type Tab = 'history' | 'today' | 'analysis' | 'worksheet' | 'wrong' | 'material' | 'voca' | 'school' | 'counsel' | 'plan' | 'solvefb' | 'report'
const TABS: { key: Tab; label: string }[] = [
  { key: 'history', label: '학습내역' },
  { key: 'today', label: '오늘의 학습' },
  { key: 'analysis', label: '유형분석' },
  { key: 'worksheet', label: '학습지' },
  { key: 'wrong', label: '❌ 틀린 문제' },
  { key: 'material', label: '교재' },
  { key: 'voca', label: '영어단어' },
  { key: 'school', label: '학교복습' },
  { key: 'counsel', label: '주간상담' },
  { key: 'plan', label: '진도표' },
  { key: 'solvefb', label: '풀이피드백' },
  { key: 'report', label: '보고서' },
]

const LEVEL_ORDER: Record<string, number> = { 초: 0, 중: 1, 고: 2 }
// '중1-1' 과정형 → '중1' 짧은 표기 (학년 그룹 라벨)
function shortGrade(g: string): string {
  const m = g.match(/^(초|중|고)\s*(\d)/)
  return m ? `${m[1]}${m[2]}` : g
}
// 초1→고3 정렬키 (초·중·고 우선, 그 안에서 학년 오름차순)
function gradeSortKey(g: string): number {
  const m = g.match(/^(초|중|고)\s*(\d)/)
  if (!m) return 9999
  return LEVEL_ORDER[m[1]] * 10 + Number(m[2])
}

// 📊 영단어 전체 현황 — 반·학년이 아니라 재원생 전체를 한 그룹으로 본다(과목 영어에서만 버튼이 보인다)
const ALL_GROUP = '__all__'

export default function Lesson() {
  const { students, synced, teachers } = useStore()
  // 권한 «담당 학생만» — 로그인한 선생님의 담당 반 학생만 보인다(관리자·전체 학생·원장 계정은 모두 보임)
  const { email } = useAuth()
  const meT = teacherByEmail(teachers, email)
  const mine = meT?.scope === 'mine' ? new Set(meT.classes ?? []) : null
  const active = students.filter(s => s.active && (!mine || (!!s.klass && mine.has(s.klass))))
  // 🔙 2026-11-23 윤자혜 «전단계로 돌아가려고 하면 항상 위 화면으로» — 학생·그룹·탭·묶음을 주소(#/lesson?s=…&t=…)에 남겨
  //    브라우저 뒤로 가기가 직전에 보던 학생·탭으로 돌아오게 한다. (예전엔 useState 라 다른 화면에 갔다 오면 첫 학생·첫 탭으로 초기화)
  const { qs, patch } = useUrlParams()
  const groupName = qs.get('g')                                   // 학년/반 그룹 선택 — [전체] 클릭 시 학생 대신 그룹 단위 화면 (매쓰플랫 /lesson/*/grade/<학년>)
  const studentId = qs.get('s') ?? (groupName ? null : active[0]?.id ?? null)
  const tabQ = qs.get('t') as Tab | null
  const tab: Tab = tabQ && TABS.some(t => t.key === tabQ) ? tabQ : 'history'
  const groupBy: '학년' | '반' = qs.get('by') === '반' ? '반' : '학년'
  const engView: 'voca' | 'test' = qs.get('ev') === 'test' ? 'test' : 'voca'
  const setStudentId = (id: string) => patch({ s: id, g: null })
  const setGroupName = (n: string | null) => patch({ g: n })
  const setTab = (t: Tab, replace = false) => patch({ t: t === 'history' ? null : t }, replace)
  const setGroupBy = (g: '학년' | '반') => patch({ by: g === '학년' ? null : g, g: null })
  const setEngView = (v: 'voca' | 'test') => patch({ ev: v === 'voca' ? null : v })
  // QR 채점 진입(#/lesson?student=<id>&grade=<학습지 id>) — 그 학생의 학습지 탭을 열고 채점 화면을 바로 띄운다
  const [openGradeId, setOpenGradeId] = useState<string | null>(null)
  useEffect(() => {
    const sid = qs.get('student'), gid = qs.get('grade')
    if (!sid && !gid) return
    if (sid && !students.some(s => s.id === sid)) { if (synced) patch({ student: null, grade: null }, true); return }
    patch({ student: null, grade: null, ...(sid ? { s: sid, g: null } : {}), ...(gid ? { t: 'worksheet' } : {}) }, true)
    if (gid) setOpenGradeId(gid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, students, synced])
  // 🔴 과목 카테고리 — 「영어」를 고르면 영어단어 하나만, 그 밖에는 영어단어를 뺀 나머지.
  //    (명수쌤 2026-08-26: "영어 카테고리를 따로 만들고 영단어를 그 안에")
  const [subject] = useSubject()
  const tabs = useMemo(
    () => subject === '영어' ? TABS.filter(t => t.key === 'voca' || t.key === 'worksheet' || t.key === 'wrong' || t.key === 'report') : TABS.filter(t => t.key !== 'voca'),
    [subject])
  // 과목을 바꾸면 지금 탭이 목록에 없을 수 있다 — 첫 탭으로 돌린다(빈 화면 방지)
  useEffect(() => {
    if (!tabs.some(t => t.key === tab)) setTab(tabs[0].key, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, tab])
  const [q, setQ] = useState('')
  const [closed, setClosed] = useState<Set<string>>(new Set())

  // (학생 기본값 — 명부가 늦게 들어와도 위 studentId 가 그때그때 첫 학생을 가리킨다. 2026-07-26 «아무도 선택 안 됨» 제보 대응을 주소 방식으로 옮김)

  const student = groupName ? null : active.find(s => s.id === studentId) ?? null
  const [appPreview, setAppPreview] = useState<Student | null>(null)
  const groupLabel = groupName === ALL_GROUP ? '전체 학생' : groupName

  // 좌측 학생 패널: 학년/반 그룹 아코디언 + 이름 검색 (매쓰플랫 동일)
  const groups = useMemo(() => {
    const kw = q.trim()
    const filtered = active.filter(s => !kw || s.name.includes(kw))
    const m = new Map<string, Student[]>()
    for (const s of filtered) {
      const key = groupBy === '학년' ? shortGrade(s.grade) : (s.klass?.trim() || '미배정')
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(s)
    }
    for (const arr of m.values()) arr.sort((x, y) => x.name.localeCompare(y.name, 'ko'))  // 그룹 내 이름순
    return [...m.entries()].sort((a, b) => {
      if (groupBy === '학년') {                     // 초1→고3 (초·중·고 순 + 학년 오름차순)
        const d = gradeSortKey(a[0]) - gradeSortKey(b[0])
        if (d !== 0) return d
      }
      if (a[0] === '미배정') return 1               // 반: 미배정은 맨 아래
      if (b[0] === '미배정') return -1
      return a[0].localeCompare(b[0], 'ko')
    })
  }, [active, groupBy, q])

  // 선택된 그룹의 학생들 (검색 필터와 무관하게 전체)
  const groupStudents = useMemo(() => {
    if (!groupName) return []
    if (groupName === ALL_GROUP) return active
    return active.filter(s => (groupBy === '학년' ? shortGrade(s.grade) : (s.klass?.trim() || '미배정')) === groupName)
  }, [active, groupBy, groupName])

  function toggleGroup(name: string) {
    setClosed(prev => { const n = new Set(prev); if (n.has(name)) n.delete(name); else n.add(name); return n })
  }

  const allOpen = groups.every(([name]) => !closed.has(name))

  if (active.length === 0) {
    // 동기화 전이면 "학생을 등록하세요"가 잠깐 스쳐 학생이 없어진 것처럼 보인다 → 불러오는 중으로 구분
    if (!synced) {
      return (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-16 text-center text-ink2">
          학생 명부를 불러오는 중…
        </div>
      )
    }
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white/60 p-16 text-center text-ink2">
        먼저 <b className="text-pine">관리 → 학생 관리</b>에서 학생을 등록하세요.
      </div>
    )
  }

  // 좌측 학생 목록 폭 — 매쓰플랫 실측 180px (2026-08-15). 우리는 230px 이었다.
  return (
    <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
      {appPreview && <StudentAppPreview key={appPreview.id} s={appPreview} onClose={() => setAppPreview(null)} />}
      <aside className="no-print h-fit overflow-hidden rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-4 py-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-black text-ink">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-pine-soft text-pine-dark">{groupName ? '👥' : '👤'}</span>
            {groupName ? `${groupLabel} 수업` : student ? `${student.name} 학생 수업` : '수업'}
          </div>
          {/* [학생앱으로 이동하기] (매쓰플랫 패널 헤더 버튼 — 새 탭으로 학생앱 열기) */}
          {/* 🔴 2026-11-28 점검: 예전엔 새 탭으로 #/student 를 열었는데, 선생님 계정이라 학생앱이 곧바로 선생님 첫 화면으로
              돌려보냈다(아무 학생도 안 보임). → 학생 관리의 [학생앱으로 이동]과 같은 «이 학생 시점 미리보기(보기 전용)»를 연다 */}
          <button onClick={() => { if (student) setAppPreview(student) }} disabled={!student}
            title={student ? `${student.name} 학생 시점의 학생앱을 미리보기로 열어요 (보기 전용)` : '왼쪽에서 학생을 먼저 고르세요'}
            className="mb-2.5 w-full rounded-lg border border-line py-1.5 text-xs font-bold text-ink2 hover:border-pine hover:text-pine-dark disabled:cursor-not-allowed disabled:opacity-40">
            학생앱으로 이동하기 ↗
          </button>
          {/* 📊 과목 영어 — 반마다 [전체]를 누르면 그 반 영단어 현황, 이 버튼은 재원생 전체 */}
          {subject === '영어' && (
            <button onClick={() => setGroupName(ALL_GROUP)}
              className={`mb-2.5 w-full rounded-lg border py-1.5 text-xs font-bold ${groupName === ALL_GROUP
                ? 'border-pine bg-pine text-paper' : 'border-pine/40 text-pine-dark hover:border-pine hover:bg-pine-soft'}`}>
              🔤 영단어 전체 현황
            </button>
          )}
          <div className="flex rounded-lg bg-paper2 p-0.5 text-xs font-bold">
            {(['학년', '반'] as const).map(g => (
              <button key={g} onClick={() => setGroupBy(g)}
                className={`grow rounded-md px-2 py-1.5 transition ${groupBy === g ? 'bg-white text-pine shadow-sm' : 'text-ink2 hover:text-ink'}`}>{g}</button>
            ))}
          </div>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink2">🔍</span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="학생 이름 검색"
              className="w-full rounded-lg border border-line py-1.5 pl-8 pr-2.5 text-sm" />
          </div>
        </div>

        <div className="flex items-center px-4 py-2">
          <span className="text-xs font-bold text-ink2">학생 <b className="text-ink">{active.length}</b>명</span>
          <div className="grow" />
          <button onClick={() => setClosed(allOpen ? new Set(groups.map(g => g[0])) : new Set())}
            className="text-xs font-semibold text-pine hover:underline">{allOpen ? '전체 닫기' : '전체 열기'}</button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-2 pb-2">
          {groups.map(([name, list]) => {
            const open = !closed.has(name)
            return (
              <div key={name} className="mb-0.5">
                <div className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1 ${groupName === name ? 'bg-pine-soft' : 'hover:bg-paper2'}`}>
                  <button onClick={() => toggleGroup(name)} className="flex grow items-center gap-2 py-1 text-left">
                    <span className="text-[10px] text-ink2">{open ? '▾' : '▸'}</span>
                    <span className={`text-sm font-black ${groupName === name ? 'text-pine-dark' : 'text-ink'}`}>{name}</span>
                    <span className="rounded-full bg-paper2 px-1.5 py-0.5 text-[11px] font-bold text-ink2">{list.length}</span>
                  </button>
                  {/* [전체] — 학년/반 그룹 단위 화면으로 (매쓰플랫 그룹 행 [전체] 버튼) */}
                  <button onClick={() => { setGroupName(name); }}
                    className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${groupName === name ? 'border-pine bg-pine text-paper' : 'border-line text-ink2 hover:border-pine hover:text-pine-dark'}`}>
                    전체
                  </button>
                </div>
                {open && (
                  <div className="ml-3 border-l border-line/70 pl-1.5">
                    {list.map(s => (
                      <button key={s.id} onClick={() => setStudentId(s.id)}
                        className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${studentId === s.id && !groupName
                          ? 'bg-pine-soft font-bold text-pine-dark'
                          : 'text-ink hover:bg-paper2'}`}>
                        {s.name}{s.klass && groupBy === '학년' && <span className="ml-1 text-xs font-normal text-ink2">· {s.klass}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {groups.length === 0 && <p className="px-2 py-6 text-center text-xs text-ink2">검색 결과 없음</p>}
        </div>
      </aside>

      <main>
        {groupName && (
          groupStudents.length > 0
            ? subject === '영어'
              // 🔴 과목 영어의 반 화면은 영단어 현황이다(학생 화면도 영어는 영어단어 탭 하나뿐). 이름을 누르면 그 학생 영어단어 탭으로.
              ? (
                <>
                  <div className="mb-4 flex gap-1.5">
                    {([['voca', '🔤 영단어 현황'], ['test', '📝 수업 연계 테스트']] as const).map(([k, t]) => (
                      <button key={k} onClick={() => setEngView(k)}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${engView === k ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink2 hover:border-pine'}`}>{t}</button>
                    ))}
                  </div>
                  {engView === 'voca'
                    ? <VocaClassPanel key={`${groupBy}-${groupName}`} label={groupLabel ?? ''} students={groupStudents}
                        onOpen={id => patch({ s: id, g: null, t: 'voca' })} />
                    : <EngLessonTest key={`${groupBy}-${groupName}`} label={groupLabel ?? ''} students={groupStudents} />}
                </>
              )
              : <GroupPanel key={`${groupBy}-${groupName}`} label={groupLabel ?? ''} students={groupStudents} />
            : <p className="p-10 text-center text-sm text-ink2">이 그룹에 학생이 없습니다.</p>
        )}
        {student && (
          <>
            <div className="no-print mb-5 flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line px-1">
              <h1 className="pb-3 text-lg font-black">{student.name}</h1>
              {tabs.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-[15px] font-bold ${tab === t.key ? 'border-pine text-ink' : 'border-transparent text-ink2 hover:text-ink'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'history' && <HistoryPanel key={student.id} student={student} />}
            {tab === 'today' && <TodayPanel key={student.id} student={student} />}
            {tab === 'analysis' && <AnalysisPanel key={student.id} student={student} />}
            {tab === 'wrong' && <WrongReviewPanel key={student.id} student={student} />}
            {tab === 'worksheet' && <WorksheetPanel key={student.id} student={student} openGradeId={openGradeId} onGradeOpened={() => setOpenGradeId(null)} />}
            {tab === 'material' && <GradePanel key={student.id} student={student} />}
            {tab === 'voca' && <VocaPanel key={student.id} student={student} />}
            {tab === 'school' && <SchoolReviewPanel key={student.id} student={student} />}
            {tab === 'counsel' && <CounselPanel key={student.id} student={student} />}
            {tab === 'plan' && <LecturePlanPanel key={student.id} student={student} />}
            {tab === 'solvefb' && <SolveFeedbackPanel key={student.id} student={student} />}
            {tab === 'report' && <ReportPanel key={student.id} student={student} />}
          </>
        )}
        {!student && !groupName && <p className="p-10 text-center text-sm text-ink2">왼쪽에서 학생을 선택하세요.</p>}
      </main>
    </div>
  )
}
