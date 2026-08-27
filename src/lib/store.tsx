import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  AcademyProfile, Assignment, Branch, BugReport, DailyConfig, DailyNote, DiffMatrix, Grading, LecturePlan, MyBook, MyList, PointEntry, PointSettlement, Problem, SavedReport, SheetTemplate, SolveFeedback, Student, Teacher, StudentAppConfig, UploadRec, Workbook, WBItem, Worksheet,
} from '../types'
import { DEFAULT_DIFF_MATRIX, DEFAULT_SHEET_OPTIONS, DEFAULT_STUDENT_APP_CONFIG } from '../types'
import { SEED_PROBLEMS } from '../data/problems'
import { loadWbMatch, deriveWBItems, courseOfGrade, type MatchData } from '../data/wbMatch'
import { loadPool } from '../data/pool'
import { defaultCurriculumForGrade } from '../data/curriculum'
import { cloud, loadAll, noteId, type CloudData, type LoadFail } from './backend'
import { ALL, setBranch, useBranchScope } from './branch'

const LS_KEY = 'gsg-hakseupji-v1'

// 'YYYY-MM-DD' → 요일 라벨 ('월'~'일') — 시간표 블록 조회용
const TT_DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']
function TT_DAY_OF(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return TT_DAY_LABELS[(d.getDay() + 6) % 7]
}

interface Persisted {
  customProblems: Problem[]
  worksheets: Worksheet[]
  favorites: string[]        // 즐겨찾는 문제 id
  myLists: MyList[]
  diffMatrix: DiffMatrix
  workbooks: Workbook[]
  wbItems: WBItem[]
  students: Student[]
  gradings: Grading[]
  dailyNotes: DailyNote[]
  assignments: Assignment[]
  dailyConfigs: Record<string, DailyConfig>
  dailyBooks: Record<string, string>
  studentAppConfig: StudentAppConfig
  klassOrder: string[]
  academyProfile: AcademyProfile
  savedReports: SavedReport[]
  myBooks: MyBook[]
  uploads: UploadRec[]
  sheetTemplates: SheetTemplate[]
  lecturePlans: LecturePlan[]
  solveFeedbacks: SolveFeedback[]
  bugReports: BugReport[]
  teachers: Teacher[]
  branches: Branch[]
  ttChecks: Record<string, true>
  reviewChecks: Record<string, true>
  pointEntries: PointEntry[]
  pointSettlements: PointSettlement[]
}

const EMPTY: Persisted = {
  customProblems: [], worksheets: [], favorites: [], myLists: [],
  diffMatrix: DEFAULT_DIFF_MATRIX,
  workbooks: [], wbItems: [], students: [], gradings: [], dailyNotes: [],
  assignments: [], dailyConfigs: {}, dailyBooks: {},
  studentAppConfig: DEFAULT_STUDENT_APP_CONFIG,
  klassOrder: [],
  academyProfile: {},
  savedReports: [],
  myBooks: [],
  uploads: [],
  sheetTemplates: [],
  lecturePlans: [],
  solveFeedbacks: [],
  bugReports: [],
  teachers: [],
  branches: [],
  ttChecks: {},
  reviewChecks: {},
  pointEntries: [],
  pointSettlements: [],
}

interface Store extends Persisted {
  problems: Problem[]
  synced: boolean
  /** 클라우드 읽기에 실패한 표 — 있으면 그 표는 **갱신하지 않은 것**이지 비어 있는 게 아니다. */
  loadFail: LoadFail | null
  ensureCourse: (courseId: string) => void   // 매쓰플랫 문제 풀 과정별 지연 로드
  addProblem: (p: Problem) => void
  removeProblem: (id: string) => void
  saveWorksheet: (w: Worksheet) => void
  updateWorksheet: (id: string, patch: Partial<Worksheet>) => void
  trashWorksheet: (id: string) => void
  restoreWorksheet: (id: string) => void
  purgeWorksheet: (id: string) => void
  duplicateWorksheet: (id: string) => string | null
  toggleFavorite: (problemId: string) => void
  addList: (name: string) => string
  renameList: (id: string, name: string) => void
  removeList: (id: string) => void
  setWorksheetLists: (wsId: string, listIds: string[]) => void
  setDiffMatrix: (m: DiffMatrix) => void
  addWorkbook: (w: Omit<Workbook, 'id'>) => string
  removeWorkbook: (id: string) => void
  setWBItems: (workbookId: string, items: WBItem[]) => void
  addStudent: (s: Omit<Student, 'id' | 'active'>) => string
  setStudentActive: (id: string, active: boolean) => void
  updateStudent: (id: string, patch: Partial<Student>) => void
  importBulk: (students: Student[], gradings: Grading[]) => void   // 매쓰플랫 이관 (id 지정 upsert)
  // 🔴 반환값 = 클라우드까지 올라갔는가. 화면이 「저장됨」이라고 말하려면 이 값을 봐야 한다.
  //    (못 올라가도 outbox 가 계속 재시도하므로 데이터는 잃지 않는다 — lib/outbox.ts)
  saveGrading: (g: Omit<Grading, 'id'>) => Promise<boolean>
  upsertGrading: (g: Grading) => Promise<boolean>   // 같은 id면 교체 — 실시간 자동 저장용
  saveDailyNote: (n: DailyNote) => void
  setLecturePlan: (p: LecturePlan) => void          // 진도표 저장/갱신 (학생×교재 1개)
  removeLecturePlan: (id: string) => void
  saveSolveFeedback: (f: SolveFeedback) => void      // 학생 풀이 AI 피드백 저장 (학생×학습지×문항 최신 1개)
  saveBugReport: (r: BugReport) => void              // 🛠 AI 점검 오류 보고 접수/갱신 (최근 200건 유지)
  // ── 지점(Branch) — 당진·내포처럼 나눠 운영하는 단위. 자세한 설계는 types.ts Branch 주석 ──
  allStudents: Student[]        // 🔴 지점 스코프 **미적용** 원본. 학생앱 본인매칭·계정 중복검사 전용
  branchScope: string           // 지금 보고 있는 지점 id ('all' = 전체)
  multiBranch: boolean          // 지점이 2개 이상 — false면 지점 UI가 화면에 없다
  setBranchScope: (v: string) => void
  addBranch: (b: Omit<Branch, 'id'>) => string
  updateBranch: (id: string, patch: Partial<Branch>) => void
  removeBranch: (id: string) => void
  setBranches: (next: Branch[]) => void                        // 순서 변경(배열 자체가 표시 순서)
  addTeacher: (t: Omit<Teacher, 'id' | 'active'>) => string   // 강사 등록
  updateTeacher: (id: string, patch: Partial<Teacher>) => void
  removeTeacher: (id: string) => void
  addAssignment: (worksheetId: string, studentIds: string[], kind?: Assignment['kind'], reveal?: Assignment['reveal'], exam?: Assignment['exam']) => void
  syncAssignments: (worksheetId: string, studentIds: string[], kind?: Assignment['kind'], reveal?: Assignment['reveal'], exam?: Assignment['exam']) => void
  removeAssignment: (worksheetId: string, studentId: string, kind?: Assignment['kind']) => void
  setDailyConfig: (studentId: string, cfg: DailyConfig) => void
  // 기본과제 학생별 수학 과정 지정 — 학년표와 진도가 다른 학생용(빈 문자열이면 학년 규칙)
  setDailyBook: (studentId: string, courseId: string) => void
  // 시간표 블록 완료 체크 (학생앱) — 연결된 교재가 있으면 그날 진도표 세션 done도 같이 갱신
  toggleTTCheck: (studentId: string, date: string, blockIdx: number, workbookId?: string) => void
  // 🏫 학교 복습 체크 (문제풀이·오답작성) — 키는 lib/schoolReview.ts reviewKey()
  toggleReviewCheck: (key: string) => void
  // 포인트 — 수동 가감(선생님)·학부모 용돈 등록, 월말 정산 저장
  addPointEntry: (e: Omit<PointEntry, 'id'>) => void
  removePointEntry: (id: string) => void
  savePointSettlement: (s: PointSettlement) => void
  setStudentAppConfig: (cfg: StudentAppConfig) => void   // 학생앱 공개 설정 (선생님용 UI는 2단계)
  setKlassOrder: (order: string[]) => void               // 반 표시 순서
  setAcademyProfile: (p: AcademyProfile) => void         // 마이페이지 내 정보
  addSavedReport: (r: Omit<SavedReport, 'id' | 'createdAt'>) => void   // 보고서 저장 목록
  removeSavedReport: (id: string) => void
  addMyBook: (b: Omit<MyBook, 'id' | 'createdAt'>) => string           // 내 교재
  removeMyBook: (id: string) => void
  addUpload: (u: Omit<UploadRec, 'id' | 'uploadedAt' | 'status'>) => string  // 파일 업로드 대기
  setUploadStatus: (id: string, status: UploadRec['status']) => void
  removeUpload: (id: string) => void
  addSheetTemplate: (t: Omit<SheetTemplate, 'id' | 'createdAt'>) => void     // STEP3 디자인 템플릿
  removeSheetTemplate: (id: string) => void
}

const Ctx = createContext<Store | null>(null)

// 교과서 wb-match 과정키 → 문제 풀 과정키(pool-*.json). 22개정 고등은 풀 명칭이 다름(대수=h-alg 등).
// 초등 e*·중등 m*는 풀 과정키 동일.
// 🔴 2026-08-15: 15개정 고등 4과정(h-hs1/h-s1/h-s2/h-calc15)은 여기 매핑이 없어서 **풀 없음 →
//    채점은 되는데 오답학습지가 안 만들어졌다.** 매쓰플랫 전 과정 수확으로 풀을 만들어 연결했다.
//    (그 전까지 「문제 없음 0개」의 가장 큰 원인이 이 네 과정이었다 — 부족 유형 1,404개)
const POOL_OF_WBCOURSE: Record<string, string> = {
  'h-dae': 'h-alg', 'h-mi1': 'h-calc1', 'h-prob': 'h-stat', 'h-mi2': 'h-calc2',
  'h-hs1': 'h-hs1', 'h-s1': 'h-s1', 'h-s2': 'h-s2', 'h-calc15': 'h-calc15',
}
function poolCourseOfWb(c?: string): string | undefined {
  if (!c) return undefined
  if (c.startsWith('m') || c.startsWith('e')) return c  // 중등·초등: 풀 과정키 동일
  if (c === 'h-cm1' || c === 'h-cm2' || c === 'h-geo') return c
  return POOL_OF_WBCOURSE[c]                             // 나머지 고등은 매핑, 없으면 undefined
}

function normWorksheet(w: Worksheet): Worksheet {
  return { ...w, options: { ...DEFAULT_SHEET_OPTIONS, ...w.options }, listIds: w.listIds ?? [], conceptIds: w.conceptIds ?? [] }
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<Persisted>
      return { ...EMPTY, ...p, worksheets: (p.worksheets ?? []).map(normWorksheet) }
    }
  } catch { /* 손상된 저장분은 무시 */ }
  return EMPTY
}

// CloudData → Persisted (정렬·정규화)
/**
 * 클라우드 응답 → 앱 상태.
 *
 * 🔴 `prev` 를 반드시 넘겨라 (2026-08-21, 김준우 채점내역 유실).
 *    읽기에 실패한 표(r.__failed)는 **덮어쓰지 않고 이전 값을 그대로 둔다.**
 *    예전에는 실패가 빈 배열로 내려와 그대로 덮어써서, 멀쩡히 저장된 채점이
 *    화면에서도 localStorage 에서도 사라졌다. 「또 없어졌다」의 구조적 원인이다.
 */
function fromCloud(r: CloudData & { __failed?: LoadFail }, prev?: Persisted): Persisted {
  const f = r.__failed ?? {}
  const keep = <K extends keyof Persisted>(k: K, next: Persisted[K], failed?: true): Persisted[K] =>
    (failed && prev ? prev[k] : next)
  return {
    customProblems: keep('customProblems', r.customProblems, f.customProblems),
    worksheets: keep('worksheets', r.worksheets.map(normWorksheet).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), f.worksheets),
    favorites: keep('favorites', r.favorites, f.settings),
    myLists: keep('myLists', r.myLists, f.myLists),
    diffMatrix: keep('diffMatrix', r.diffMatrix ?? DEFAULT_DIFF_MATRIX, f.settings),
    workbooks: keep('workbooks', r.workbooks, f.workbooks),
    wbItems: keep('wbItems', r.wbItems, f.wbItems),
    students: keep('students', r.students, f.students),
    gradings: keep('gradings', r.gradings.sort((a, b) => b.date.localeCompare(a.date)), f.gradings),
    dailyNotes: keep('dailyNotes', r.dailyNotes, f.dailyNotes),
    assignments: keep('assignments', r.assignments ?? [], f.settings),
    dailyConfigs: keep('dailyConfigs', r.dailyConfigs ?? {}, f.settings),
    dailyBooks: keep('dailyBooks', r.dailyBooks ?? {}, f.settings),
    studentAppConfig: keep('studentAppConfig', { ...DEFAULT_STUDENT_APP_CONFIG, ...(r.studentAppConfig ?? {}) }, f.settings),
    klassOrder: keep('klassOrder', r.klassOrder ?? [], f.settings),
    academyProfile: keep('academyProfile', r.academyProfile ?? {}, f.settings),
    savedReports: keep('savedReports', r.savedReports ?? [], f.settings),
    myBooks: keep('myBooks', r.myBooks ?? [], f.settings),
    uploads: keep('uploads', r.uploads ?? [], f.settings),
    sheetTemplates: keep('sheetTemplates', r.sheetTemplates ?? [], f.settings),
    lecturePlans: keep('lecturePlans', r.lecturePlans ?? [], f.settings),
    solveFeedbacks: keep('solveFeedbacks', r.solveFeedbacks ?? [], f.settings),
    bugReports: keep('bugReports', r.bugReports ?? [], f.settings),
    teachers: keep('teachers', r.teachers ?? [], f.settings),
    branches: keep('branches', r.branches ?? [], f.settings),
    ttChecks: keep('ttChecks', r.ttChecks ?? {}, f.settings),
    reviewChecks: keep('reviewChecks', r.reviewChecks ?? {}, f.settings),
    pointEntries: keep('pointEntries', r.pointEntries ?? [], f.settings),
    pointSettlements: keep('pointSettlements', r.pointSettlements ?? [], f.settings),
  }
}
/**
 * 매칭 교재의 정답이 실제 책과 다를 때, 선생님이 직접 넣은 정답으로 덮어쓴다.
 * (2026-07-28 명수쌤 지시 — 개정판이 달라 정답이 안 맞는 교재가 있었다)
 *
 * 짝은 (교재·쪽·문항번호)로 맞춘다. 덮어쓸 때도 **파생 문항의 id를 그대로 둔다** —
 * 채점 기록이 문항 id로 저장돼 있어서 id가 바뀌면 이미 채점한 것이 전부 날아간다.
 * 짝이 없는 수동 문항은 그대로 뒤에 붙인다(매칭표가 없는 교재의 기존 동작).
 */
const wbKey = (i: WBItem) => `${i.workbookId}|${i.page}|${i.label ?? i.no}`
function mergeWbItems(manual: WBItem[], derived: WBItem[]): WBItem[] {
  if (!manual.length) return derived
  if (!derived.length) return manual
  const fix = new Map(manual.map(i => [wbKey(i), i]))
  const used = new Set<string>()
  const merged = derived.map(d => {
    const m = fix.get(wbKey(d))
    if (!m) return d
    used.add(wbKey(d))
    return { ...d, answer: m.answer, kind: m.kind }   // 정답·형태만 교체, 유형·난이도·id는 유지
  })
  return [...merged, ...manual.filter(i => !used.has(wbKey(i)))]
}

function toCloud(s: Persisted): CloudData {
  return {
    customProblems: s.customProblems, worksheets: s.worksheets, myLists: s.myLists,
    workbooks: s.workbooks, wbItems: s.wbItems, students: s.students, gradings: s.gradings,
    dailyNotes: s.dailyNotes, favorites: s.favorites, diffMatrix: s.diffMatrix,
    assignments: s.assignments, dailyConfigs: s.dailyConfigs, dailyBooks: s.dailyBooks,
    studentAppConfig: s.studentAppConfig,
    klassOrder: s.klassOrder, academyProfile: s.academyProfile,
    savedReports: s.savedReports,
    myBooks: s.myBooks, uploads: s.uploads, sheetTemplates: s.sheetTemplates,
    lecturePlans: s.lecturePlans, solveFeedbacks: s.solveFeedbacks, teachers: s.teachers, branches: s.branches,
    bugReports: s.bugReports,
    ttChecks: s.ttChecks, reviewChecks: s.reviewChecks,
    pointEntries: s.pointEntries, pointSettlements: s.pointSettlements,
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(load)
  const [synced, setSynced] = useState(!cloud.on)
  const stateRef = useRef(state)
  stateRef.current = state

  // 시중교재 매칭: matchKey가 붙은 교재의 문항(conceptId 포함)을 과정 파일에서 런타임 파생 (Supabase엔 저장 안 함)
  const [matchDataByCourse, setMatchDataByCourse] = useState<Record<string, MatchData>>({})
  const neededCourses = useMemo(() => {
    const set = new Set<string>()
    for (const w of state.workbooks) {
      if (!w.matchKey) continue
      const c = w.course ?? courseOfGrade(w.grade)   // 교과서는 명시적 course, 시중교재는 grade→과정
      if (c) set.add(c)
    }
    return [...set]
  }, [state.workbooks])
  useEffect(() => {
    for (const c of neededCourses) {
      if (matchDataByCourse[c]) continue
      loadWbMatch(c)
        .then(d => setMatchDataByCourse(prev => prev[c] ? prev : { ...prev, [c]: d }))
        .catch(e => console.warn('wb-match', c, e.message))
    }
  }, [neededCourses, matchDataByCourse])
  const derivedWbItems = useMemo(() => {
    return state.workbooks.filter(w => w.matchKey).flatMap(w => {
      const c = w.course ?? courseOfGrade(w.grade)
      const data = c ? matchDataByCourse[c] : undefined
      return data ? deriveWBItems(w.id, w.matchKey!, data) : []
    })
  }, [state.workbooks, matchDataByCourse])

  // ── 매쓰플랫 문제 풀: 과정별 정적 파일 지연 로드 ────────────────────
  const [pools, setPools] = useState<Record<string, Problem[]>>({})
  const poolReqRef = useRef<Set<string>>(new Set())
  function ensureCourse(courseId: string) {
    if (!courseId || poolReqRef.current.has(courseId)) return
    poolReqRef.current.add(courseId)
    loadPool(courseId).then(arr => {
      if (arr.length) setPools(prev => prev[courseId] ? prev : { ...prev, [courseId]: arr })
    })
  }
  // 사용 흔적이 있는 과정 자동 로드 (학생 학년·학습지·교재)
  useEffect(() => {
    const wanted = new Set<string>()
    for (const s of state.students) if (s.active) wanted.add(defaultCurriculumForGrade(s.grade))
    for (const w of state.worksheets) if (!w.deletedAt) wanted.add(defaultCurriculumForGrade(w.grade))
    for (const w of state.workbooks) wanted.add(poolCourseOfWb(w.course) ?? defaultCurriculumForGrade(w.grade))
    wanted.forEach(c => ensureCourse(c))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.students, state.worksheets, state.workbooks])
  // 🔴 과정 파일 사이에 **같은 문항이 겹친다** (실측 2026-08-25: mf1131040 이
  //    pool-m2-1.json 과 pool-m2-2.json 양쪽에 있다). 그냥 flat 하면 문제은행에
  //    같은 문항이 두 벌 들어가고, 그러면 유형별 문항 목록이 [A, A, B, …] 가 된다.
  //    → 「유형별 2번째 문제」(기본과제 2회차)가 1번째와 **같은 문제**로 나갔다.
  //      중2 15문항 중 14개, 고1 15문항 중 9개가 어제 것과 똑같이 나간 사고의 원인.
  //    id 기준으로 한 벌만 남긴다. 뽑기·오답드릴 등 문제은행을 쓰는 모든 곳이 같이 낫는다.
  const poolProblems = useMemo(() => {
    const seen = new Set<string>()
    const out: Problem[] = []
    for (const p of Object.values(pools).flat()) {
      if (seen.has(p.id)) continue
      seen.add(p.id); out.push(p)
    }
    return out
  }, [pools])

  // 1회 마이그레이션: studentId 없는 옛 교재를 채점 기록으로 학생에게 귀속
  // (교재가 학생별로 안 나뉘어 채점판에 모든 학생 교재가 섞여 나오던 문제 해결)
  const migratedRef = useRef(false)
  useEffect(() => {
    if (!synced || migratedRef.current) return
    const orphans = state.workbooks.filter(w => !w.studentId)
    if (orphans.length === 0) { migratedRef.current = true; return }
    const updates: Workbook[] = []
    for (const wb of orphans) {
      const counts = new Map<string, number>()
      for (const g of state.gradings) if (g.workbookId === wb.id) counts.set(g.studentId, (counts.get(g.studentId) ?? 0) + 1)
      if (counts.size === 0) continue   // 미채점 교재 → 귀속 불가, 그대로 둠(채점판엔 안 보임)
      const owner = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      updates.push({ ...wb, studentId: owner })
    }
    migratedRef.current = true
    if (updates.length) {
      setState(s => ({ ...s, workbooks: s.workbooks.map(w => updates.find(u => u.id === w.id) ?? w) }))
      for (const u of updates) cloud.upsert(cloud.T.workbooks, u.id, u)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synced, state.workbooks, state.gradings])

  // 클라우드 모드면 원본은 Supabase → 대량 문제(customProblems)를 localStorage에 미러링하지 않음
  // (수천 문제 이미지 URL이 localStorage 5MB 쿼터를 초과해 렌더가 깨지던 문제 방지)
  useEffect(() => {
    const snapshot = cloud.on ? { ...state, customProblems: [] } : state
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(snapshot))
    } catch {
      // 🔴 쿼터 초과 (2026-08-26: 오류 보고 7건이 전부 저장 공간 9MB대였다).
      //    그냥 넘기면 이 기기 백업이 통째로 멈춘 채로 굴러가고, 인터넷이 끊긴 날
      //    화면이 비어 보인다. **가장 무거운 표(교재 문항)를 덜어 한 번 더 시도**한다 —
      //    wbItems 는 클라우드에서 다시 받으면 되는 파생 데이터라 버려도 안전하다.
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ ...snapshot, wbItems: [] }))
      } catch { /* 그래도 안 되면 포기 — 클라우드가 원본이다 */ }
    }
  }, [state])

  // 🔴 읽기에 실패한 표 — 화면에 띄워 선생님이 «없어진 게 아니라 못 읽은 것»임을 알게 한다.
  //    조용히 넘기면 선생님이 다시 채점하게 되고, 그게 진짜 유실을 만든다.
  const [loadFail, setLoadFail] = useState<LoadFail | null>(null)

  // 클라우드 동기화: 최초 로드 + 실시간 구독
  useEffect(() => {
    if (!cloud.on) return
    let unsub = () => {}
    let alive = true
    ;(async () => {
      const remote = await loadAll()
      if (remote && alive) {
        const has = remote.customProblems.length || remote.worksheets.length || remote.students.length ||
          remote.workbooks.length || remote.wbItems.length || remote.gradings.length ||
          remote.dailyNotes.length || remote.myLists.length || remote.favorites.length || remote.diffMatrix
        // 🔴 fromCloud 에 **직전 상태를 넘긴다** — 읽기에 실패한 표는 덮어쓰지 않는다.
        //    (2026-08-21 김준우 채점내역 유실: 실패가 빈 배열로 내려와 그대로 덮어썼다)
        if (has) setState(prev => fromCloud(remote, prev))
        else if (!Object.keys(remote.__failed).length) {
          // 🔴 「비었다」와 「못 읽었다」는 다르다. 하나라도 실패했으면 시드하지 않는다 —
          //    그대로 두면 로컬 상태를 빈 클라우드에 덮어쓰는 반대 방향 사고가 난다.
          await cloud.seedIfEmpty(toCloud(stateRef.current))
        }
        if (Object.keys(remote.__failed).length) setLoadFail(remote.__failed)
      }
      if (alive) {
        setSynced(true)
        unsub = cloud.subscribe(() => {
          loadAll().then(r => {
            if (!r || !alive) return
            setState(prev => fromCloud(r, prev))
            setLoadFail(Object.keys(r.__failed).length ? r.__failed : null)
          })
        })
      }
    })()
    return () => { alive = false; unsub() }
  }, [])

  const set = setState

  // ── 지점 스코프 필터 ────────────────────────────────────────────────
  // 🔴 store.students 를 **여기서 통째로 덮는다**. 화면 20여 곳을 각각 고치는 대신
  //    파생 한 줄로 거는 이유는, 새 화면이 생겨도 자동으로 지점을 따르게 하기 위해서다.
  //    전원이 필요한 곳(학생앱 본인매칭·출결번호 중복검사)만 allStudents 를 쓴다.
  const rawScope = useBranchScope()
  // 저장된 id가 삭제된 지점이면 조용히 전체로 떨어뜨린다 (학생 0명 화면 방지)
  const branchScope = state.branches.some(b => b.id === rawScope) ? rawScope : ALL
  const multiBranch = state.branches.length >= 2
  const scopedStudents = useMemo(
    () => (!multiBranch || branchScope === ALL)
      ? state.students
      // 미배정(!branchId)은 어느 지점에서도 보인다 — branch.ts 규칙 ③
      : state.students.filter(s => !s.branchId || s.branchId === branchScope),
    [state.students, multiBranch, branchScope])

  const store: Store = {
    ...state,
    synced,
    loadFail,
    students: scopedStudents,
    allStudents: state.students,
    branchScope, multiBranch,
    setBranchScope: setBranch,
    ensureCourse,
    wbItems: mergeWbItems(state.wbItems, derivedWbItems),   // 수동 등록분이 매칭 교재 파생분을 덮어씀
    // 자체 시드 + 직접 등록분(mf 정적분 제외 — 풀 파일이 대체) + 과정별 매쓰플랫 풀
    problems: [...SEED_PROBLEMS, ...state.customProblems.filter(p => !p.id.startsWith('mf')), ...poolProblems],

    addProblem: p => { set(s => ({ ...s, customProblems: [...s.customProblems, p] })); cloud.upsert(cloud.T.problems, p.id, p) },
    removeProblem: id => { set(s => ({ ...s, customProblems: s.customProblems.filter(p => p.id !== id) })); cloud.del(cloud.T.problems, id) },

    saveWorksheet: w => { set(s => ({ ...s, worksheets: [w, ...s.worksheets] })); cloud.upsert(cloud.T.worksheets, w.id, w) },
    updateWorksheet: (id, patch) => {
      const cur = stateRef.current.worksheets.find(w => w.id === id)
      if (cur) { const next = { ...cur, ...patch }; set(s => ({ ...s, worksheets: s.worksheets.map(w => w.id === id ? next : w) })); cloud.upsert(cloud.T.worksheets, id, next) }
    },
    trashWorksheet: id => {
      const cur = stateRef.current.worksheets.find(w => w.id === id); if (!cur) return
      const next = { ...cur, deletedAt: new Date().toISOString() }
      set(s => ({ ...s, worksheets: s.worksheets.map(w => w.id === id ? next : w) })); cloud.upsert(cloud.T.worksheets, id, next)
    },
    restoreWorksheet: id => {
      const cur = stateRef.current.worksheets.find(w => w.id === id); if (!cur) return
      const next = { ...cur, deletedAt: null }
      set(s => ({ ...s, worksheets: s.worksheets.map(w => w.id === id ? next : w) })); cloud.upsert(cloud.T.worksheets, id, next)
    },
    purgeWorksheet: id => { set(s => ({ ...s, worksheets: s.worksheets.filter(w => w.id !== id) })); cloud.del(cloud.T.worksheets, id) },
    duplicateWorksheet: id => {
      const src = stateRef.current.worksheets.find(w => w.id === id)
      if (!src) return null
      const nid = uid('ws')
      const copy: Worksheet = { ...src, id: nid, title: `${src.title} (복제)`, createdAt: new Date().toISOString(), deletedAt: null }
      set(s => ({ ...s, worksheets: [copy, ...s.worksheets] })); cloud.upsert(cloud.T.worksheets, nid, copy)
      return nid
    },

    toggleFavorite: pid => {
      const cur = stateRef.current.favorites
      const next = cur.includes(pid) ? cur.filter(f => f !== pid) : [...cur, pid]
      set(s => ({ ...s, favorites: next })); cloud.setSetting('favorites', next)
    },
    addList: name => {
      const id = uid('list'); const l = { id, name, createdAt: new Date().toISOString() }
      set(s => ({ ...s, myLists: [...s.myLists, l] })); cloud.upsert(cloud.T.lists, id, l)
      return id
    },
    renameList: (id, name) => {
      const cur = stateRef.current.myLists.find(l => l.id === id); if (!cur) return
      const next = { ...cur, name }
      set(s => ({ ...s, myLists: s.myLists.map(l => l.id === id ? next : l) })); cloud.upsert(cloud.T.lists, id, next)
    },
    removeList: id => {
      const affected = stateRef.current.worksheets.filter(w => w.listIds.includes(id))
      set(s => ({
        ...s,
        myLists: s.myLists.filter(l => l.id !== id),
        worksheets: s.worksheets.map(w => ({ ...w, listIds: w.listIds.filter(x => x !== id) })),
      }))
      cloud.del(cloud.T.lists, id)
      for (const w of affected) cloud.upsert(cloud.T.worksheets, w.id, { ...w, listIds: w.listIds.filter(x => x !== id) })
    },
    setWorksheetLists: (wsId, listIds) => {
      const cur = stateRef.current.worksheets.find(w => w.id === wsId); if (!cur) return
      const next = { ...cur, listIds }
      set(s => ({ ...s, worksheets: s.worksheets.map(w => w.id === wsId ? next : w) })); cloud.upsert(cloud.T.worksheets, wsId, next)
    },
    setDiffMatrix: m => { set(s => ({ ...s, diffMatrix: m })); cloud.setSetting('diffMatrix', m) },

    addWorkbook: w => {
      const id = uid('wb'); const wb = { ...w, id }
      set(s => ({ ...s, workbooks: [...s.workbooks, wb] })); cloud.upsert(cloud.T.workbooks, id, wb)
      return id
    },
    removeWorkbook: id => {
      const its = stateRef.current.wbItems.filter(i => i.workbookId === id)
      const grs = stateRef.current.gradings.filter(g => g.workbookId === id)
      set(s => ({
        ...s,
        workbooks: s.workbooks.filter(w => w.id !== id),
        wbItems: s.wbItems.filter(i => i.workbookId !== id),
        gradings: s.gradings.filter(g => g.workbookId !== id),
      }))
      cloud.del(cloud.T.workbooks, id)
      for (const i of its) cloud.del(cloud.T.wbItems, i.id)
      for (const g of grs) cloud.del(cloud.T.gradings, g.id)
    },
    setWBItems: (workbookId, items) => {
      const old = stateRef.current.wbItems.filter(i => i.workbookId === workbookId)
      const keep = new Set(items.map(i => i.id))
      set(s => ({ ...s, wbItems: [...s.wbItems.filter(i => i.workbookId !== workbookId), ...items] }))
      for (const i of old) if (!keep.has(i.id)) cloud.del(cloud.T.wbItems, i.id)
      for (const i of items) cloud.upsert(cloud.T.wbItems, i.id, i)
    },
    addStudent: st => {
      const id = uid('st'); const stu = { ...st, id, active: true }
      set(s => ({ ...s, students: [...s.students, stu] })); cloud.upsert(cloud.T.students, id, stu)
      return id
    },
    setStudentActive: (id, active) => {
      const cur = stateRef.current.students.find(x => x.id === id); if (!cur) return
      const next = { ...cur, active }
      set(s => ({ ...s, students: s.students.map(x => x.id === id ? next : x) })); cloud.upsert(cloud.T.students, id, next)
    },
    updateStudent: (id, patch) => {
      const cur = stateRef.current.students.find(x => x.id === id); if (!cur) return
      const next = { ...cur, ...patch }
      set(s => ({ ...s, students: s.students.map(x => x.id === id ? next : x) })); cloud.upsert(cloud.T.students, id, next)
    },
    importBulk: (students, gradings) => {
      // 매쓰플랫 이관: 학생은 id로 병합(기존 상세필드 보존), 채점기록은 id로 교체(재실행 중복 방지)
      const cur = stateRef.current
      const smap = new Map(cur.students.map(x => [x.id, x]))
      const mergedStudents = students.map(st => ({ ...smap.get(st.id), ...st }))
      set(s => {
        const sm = new Map(s.students.map(x => [x.id, x]))
        for (const st of mergedStudents) sm.set(st.id, st)
        const gm = new Map(s.gradings.map(x => [x.id, x]))
        for (const g of gradings) gm.set(g.id, g)
        return { ...s, students: [...sm.values()], gradings: [...gm.values()] }
      })
      cloud.upsertMany(cloud.T.students, mergedStudents.map(st => ({ id: st.id, data: st })))
      cloud.upsertMany(cloud.T.gradings, gradings.map(g => ({ id: g.id, data: g })))
    },
    // 🔴 배정 3형제(add/sync/remove)는 setSetting(통짜 배열, 마지막 쓰기가 이김) 금지 —
    //    자동 오답학습지가 학생 제출마다 학생 기기에서 배정을 만들어, 반 전체 제출이면
    //    여러 기기가 같은 순간에 쓴다. 통짜로 쓰면 한쪽 배정이 통째로 사라진다
    //    (2026-08-15 강리원 실사고). 명령(cmd)을 넘기면 서버 최신에 병합돼 저장된다.
    addAssignment: (worksheetId, studentIds, kind = '수업', reveal, exam) => {
      const now = new Date().toISOString()
      const fresh: Assignment[] = studentIds
        .filter(sid => !stateRef.current.assignments.some(a => a.worksheetId === worksheetId && a.studentId === sid && a.kind === kind))
        .map(sid => ({ id: uid('as'), worksheetId, studentId: sid, date: now, kind, reveal, exam }))
      if (fresh.length === 0) return
      set(s => ({ ...s, assignments: [...s.assignments, ...fresh] }))
      cloud.assignmentOps([{ type: 'add', items: fresh }])
    },
    // 출제 다이얼로그 「선택 완료」 — 이 학습지를 받는 학생을 통째로 맞춘다.
    // 🔴 add/remove 를 연달아 부르면 안 된다. stateRef 는 렌더 뒤에야 갱신돼서
    //    두 번째 호출이 첫 번째의 결과를 지운다 (2026-08-07 실측). 한 번에 계산한다.
    syncAssignments: (worksheetId, studentIds, kind = '수업', reveal, exam) => {
      const keep = new Set(studentIds)
      const now = new Date().toISOString()
      const kept = stateRef.current.assignments
        .filter(a => a.worksheetId !== worksheetId || keep.has(a.studentId))
        .map(a => (a.worksheetId === worksheetId ? { ...a, reveal, exam } : a))   // 공개 설정·시험 규칙은 이 학습지 전체에 같게
      const has = new Set(kept.filter(a => a.worksheetId === worksheetId && a.kind === kind).map(a => a.studentId))
      const fresh: Assignment[] = studentIds.filter(sid => !has.has(sid))
        .map(sid => ({ id: uid('as'), worksheetId, studentId: sid, date: now, kind, reveal, exam }))
      set(s => ({ ...s, assignments: [...kept, ...fresh] }))
      cloud.assignmentOps([{ type: 'sync', worksheetId, studentIds, kind, reveal, exam, items: fresh }])
    },
    removeAssignment: (worksheetId, studentId, kind) => {
      // kind 지정 시 그 종류만 제거 (숙제 취소가 수업 출제까지 지우던 버그 방지)
      set(s => ({ ...s, assignments: s.assignments.filter(a =>
        !(a.worksheetId === worksheetId && a.studentId === studentId && (kind ? a.kind === kind : true))) }))
      cloud.assignmentOps([{ type: 'remove', worksheetId, studentId, kind }])
    },
    toggleReviewCheck: key => {
      const cur = stateRef.current.reviewChecks
      const next = { ...cur }
      if (next[key]) delete next[key]; else next[key] = true
      set(s => ({ ...s, reviewChecks: next })); cloud.setSetting('reviewChecks', next)
    },
    toggleTTCheck: (studentId, date, blockIdx, workbookId) => {
      const key = `${studentId}|${date}|${blockIdx}`
      const cur = stateRef.current.ttChecks
      const on = !cur[key]
      const next = { ...cur }
      if (on) next[key] = true
      else delete next[key]
      set(s => ({ ...s, ttChecks: next })); cloud.setSetting('ttChecks', next)

      // 진도표 반영 — 연결 교재의 그날 세션 done. 그날 세션이 없으면 밀린(과거 미완) 세션을 완료 처리.
      if (!workbookId) return
      const plan = stateRef.current.lecturePlans.find(p => p.studentId === studentId && p.workbookId === workbookId)
      if (!plan) return
      let idx = plan.sessions.findIndex(s2 => s2.date === date)
      if (idx < 0) {
        // 밀린 진도: 지난 미완료 중 가장 최근 것 (체크 해제 시엔 방금 완료 처리한 것 = 지난 완료 중 최신)
        const cands = plan.sessions
          .map((s2, i) => ({ s2, i }))
          .filter(({ s2 }) => s2.date < date && (on ? !s2.done : !!s2.done))
          .sort((a, b) => b.s2.date.localeCompare(a.s2.date))
        if (cands.length === 0) return
        idx = cands[0].i
      }
      // 같은 교재 블록이 하루 여러 개면 남은 체크가 있는 동안은 done 유지
      if (!on) {
        const tt = stateRef.current.students.find(s2 => s2.id === studentId)?.timetable
        const day = TT_DAY_OF(date)
        const others = (tt?.blocks?.[day] ?? []).some((b, i) =>
          i !== blockIdx && b.workbookId === workbookId && next[`${studentId}|${date}|${i}`])
        if (others) return
      }
      const updated = {
        ...plan,
        sessions: plan.sessions.map((s2, i) => (i === idx ? { ...s2, done: on } : s2)),
        updatedAt: new Date().toISOString(),
      }
      const plans = [...stateRef.current.lecturePlans.filter(p => p.id !== plan.id), updated]
      set(s => ({ ...s, lecturePlans: plans })); cloud.setSetting('lecturePlans', plans)
    },
    addPointEntry: e => {
      const rec: PointEntry = { ...e, id: uid('pt') }
      const next = [...stateRef.current.pointEntries, rec]
      set(s => ({ ...s, pointEntries: next })); cloud.setSetting('pointEntries', next)
    },
    removePointEntry: id => {
      const next = stateRef.current.pointEntries.filter(x => x.id !== id)
      set(s => ({ ...s, pointEntries: next })); cloud.setSetting('pointEntries', next)
    },
    savePointSettlement: st => {
      const next = [...stateRef.current.pointSettlements.filter(x => x.id !== st.id), st]
      set(s => ({ ...s, pointSettlements: next })); cloud.setSetting('pointSettlements', next)
    },
    setDailyConfig: (studentId, cfg) => {
      const next = { ...stateRef.current.dailyConfigs, [studentId]: cfg }
      set(s => ({ ...s, dailyConfigs: next })); cloud.setSetting('dailyConfigs', next)
    },
    setDailyBook: (studentId, courseId) => {
      // 🔴 학년표(RAIL)가 안 맞는 학생이 있다 (2026-08-24 명수쌤: "유정무는 대수야,
      //    원현정은 미적분1이고"). 학년으로 정한 교재를 학생 단위로 덮어쓴다.
      //    빈 문자열이면 지정을 지우고 학년 규칙으로 돌아간다.
      const next = { ...stateRef.current.dailyBooks }
      if (courseId) next[studentId] = courseId; else delete next[studentId]
      set(s => ({ ...s, dailyBooks: next })); cloud.setSetting('dailyBooks', next)
    },
    setStudentAppConfig: cfg => {
      set(s => ({ ...s, studentAppConfig: cfg })); cloud.setSetting('studentAppConfig', cfg)
    },
    setKlassOrder: order => {
      set(s => ({ ...s, klassOrder: order })); cloud.setSetting('klassOrder', order)
    },
    setAcademyProfile: p => {
      set(s => ({ ...s, academyProfile: p })); cloud.setSetting('academyProfile', p)
    },
    addSavedReport: r => {
      const rec: SavedReport = { ...r, id: uid('rp'), createdAt: new Date().toISOString() }
      const next = [rec, ...stateRef.current.savedReports]
      set(s => ({ ...s, savedReports: next })); cloud.setSetting('savedReports', next)
    },
    removeSavedReport: id => {
      const next = stateRef.current.savedReports.filter(x => x.id !== id)
      set(s => ({ ...s, savedReports: next })); cloud.setSetting('savedReports', next)
    },
    addMyBook: b => {
      const rec: MyBook = { ...b, id: uid('bk'), createdAt: new Date().toISOString() }
      const next = [rec, ...stateRef.current.myBooks]
      set(s => ({ ...s, myBooks: next })); cloud.setSetting('myBooks', next)
      return rec.id
    },
    removeMyBook: id => {
      const next = stateRef.current.myBooks.filter(x => x.id !== id)
      set(s => ({ ...s, myBooks: next })); cloud.setSetting('myBooks', next)
    },
    addUpload: u => {
      const rec: UploadRec = { ...u, id: uid('up'), uploadedAt: new Date().toISOString(), status: '변환 대기' }
      const next = [rec, ...stateRef.current.uploads]
      set(s => ({ ...s, uploads: next })); cloud.setSetting('uploads', next)
      return rec.id
    },
    setUploadStatus: (id, status) => {
      const next = stateRef.current.uploads.map(x => x.id === id ? { ...x, status } : x)
      set(s => ({ ...s, uploads: next })); cloud.setSetting('uploads', next)
    },
    removeUpload: id => {
      const next = stateRef.current.uploads.filter(x => x.id !== id)
      set(s => ({ ...s, uploads: next })); cloud.setSetting('uploads', next)
    },
    addSheetTemplate: t => {
      const rec: SheetTemplate = { ...t, id: uid('tpl'), createdAt: new Date().toISOString() }
      const next = [...stateRef.current.sheetTemplates, rec]
      set(s => ({ ...s, sheetTemplates: next })); cloud.setSetting('sheetTemplates', next)
    },
    removeSheetTemplate: id => {
      const next = stateRef.current.sheetTemplates.filter(x => x.id !== id)
      set(s => ({ ...s, sheetTemplates: next })); cloud.setSetting('sheetTemplates', next)
    },
    saveGrading: g => {
      const rec = { ...g, id: uid('gr') }
      set(s => ({ ...s, gradings: [rec, ...s.gradings] }))
      return cloud.upsert(cloud.T.gradings, rec.id, rec)
    },
    upsertGrading: g => {
      const exists = stateRef.current.gradings.some(x => x.id === g.id)
      set(s => ({ ...s, gradings: exists ? s.gradings.map(x => x.id === g.id ? g : x) : [g, ...s.gradings] }))
      return cloud.upsert(cloud.T.gradings, g.id, g)
    },
    saveDailyNote: n => {
      set(s => ({ ...s, dailyNotes: [...s.dailyNotes.filter(x => !(x.studentId === n.studentId && x.date === n.date)), n] }))
      cloud.upsert(cloud.T.dailyNotes, noteId(n), n)
    },
    setLecturePlan: p => {
      const next = [...stateRef.current.lecturePlans.filter(x => x.id !== p.id), p]
      set(s => ({ ...s, lecturePlans: next })); cloud.setSetting('lecturePlans', next)
    },
    removeLecturePlan: id => {
      const next = stateRef.current.lecturePlans.filter(x => x.id !== id)
      set(s => ({ ...s, lecturePlans: next })); cloud.setSetting('lecturePlans', next)
    },
    saveBugReport: r => {
      // 보고는 쌓이기만 하면 못 본다 — 클라우드 한곳에 모아 선생님 화면에서 확인·처리한다
      const next = [...stateRef.current.bugReports.filter(x => x.id !== r.id), r].slice(-200)
      set(s => ({ ...s, bugReports: next })); cloud.setSetting('bugReports', next)
    },
    saveSolveFeedback: f => {
      const next = [...stateRef.current.solveFeedbacks.filter(x => x.id !== f.id), f]
      set(s => ({ ...s, solveFeedbacks: next })); cloud.setSetting('solveFeedbacks', next)
    },
    addBranch: b => {
      const id = uid('br')
      const next = [...stateRef.current.branches, { ...b, id }]
      set(s => ({ ...s, branches: next })); cloud.setSetting('branches', next)
      return id
    },
    updateBranch: (id, patch) => {
      const next = stateRef.current.branches.map(b => b.id === id ? { ...b, ...patch } : b)
      set(s => ({ ...s, branches: next })); cloud.setSetting('branches', next)
    },
    removeBranch: id => {
      const next = stateRef.current.branches.filter(b => b.id !== id)
      set(s => ({ ...s, branches: next })); cloud.setSetting('branches', next)
    },
    setBranches: next => {
      set(s => ({ ...s, branches: next })); cloud.setSetting('branches', next)
    },
    addTeacher: t => {
      const id = uid('tc')
      const next = [...stateRef.current.teachers, { ...t, id, active: true }]
      set(s => ({ ...s, teachers: next })); cloud.setSetting('teachers', next)
      return id
    },
    updateTeacher: (id, patch) => {
      const next = stateRef.current.teachers.map(t => t.id === id ? { ...t, ...patch } : t)
      set(s => ({ ...s, teachers: next })); cloud.setSetting('teachers', next)
    },
    removeTeacher: id => {
      const next = stateRef.current.teachers.filter(t => t.id !== id)
      set(s => ({ ...s, teachers: next })); cloud.setSetting('teachers', next)
    },
  }

  // dev 전용 콘솔 핸들 — 로컬 검증(두 탭 동시 배정 재현 등)에서 store 를 직접 부를 수 있게.
  // 프로덕션 빌드에서는 DEV 가 false 로 치환돼 이 줄이 통째로 제거된다.
  if (import.meta.env.DEV) (window as unknown as { __store: Store }).__store = store

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider missing')
  return s
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
