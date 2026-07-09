import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  AcademyProfile, Assignment, DailyConfig, DailyNote, DiffMatrix, Grading, MyBook, MyList, Problem, SavedReport, SheetTemplate, Student, StudentAppConfig, UploadRec, Workbook, WBItem, Worksheet,
} from '../types'
import { DEFAULT_DIFF_MATRIX, DEFAULT_SHEET_OPTIONS, DEFAULT_STUDENT_APP_CONFIG } from '../types'
import { SEED_PROBLEMS } from '../data/problems'
import { loadWbMatch, deriveWBItems, courseOfGrade, type MatchData } from '../data/wbMatch'
import { loadPool } from '../data/pool'
import { defaultCurriculumForGrade } from '../data/curriculum'
import { cloud, loadAll, noteId, type CloudData } from './backend'

const LS_KEY = 'gsg-hakseupji-v1'

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
  studentAppConfig: StudentAppConfig
  klassOrder: string[]
  academyProfile: AcademyProfile
  savedReports: SavedReport[]
  myBooks: MyBook[]
  uploads: UploadRec[]
  sheetTemplates: SheetTemplate[]
}

const EMPTY: Persisted = {
  customProblems: [], worksheets: [], favorites: [], myLists: [],
  diffMatrix: DEFAULT_DIFF_MATRIX,
  workbooks: [], wbItems: [], students: [], gradings: [], dailyNotes: [],
  assignments: [], dailyConfigs: {},
  studentAppConfig: DEFAULT_STUDENT_APP_CONFIG,
  klassOrder: [],
  academyProfile: {},
  savedReports: [],
  myBooks: [],
  uploads: [],
  sheetTemplates: [],
}

interface Store extends Persisted {
  problems: Problem[]
  synced: boolean
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
  saveGrading: (g: Omit<Grading, 'id'>) => void
  upsertGrading: (g: Grading) => void   // 같은 id면 교체 — 실시간 자동 저장용
  saveDailyNote: (n: DailyNote) => void
  addAssignment: (worksheetId: string, studentIds: string[], kind?: Assignment['kind']) => void
  removeAssignment: (worksheetId: string, studentId: string, kind?: Assignment['kind']) => void
  setDailyConfig: (studentId: string, cfg: DailyConfig) => void
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
function fromCloud(r: CloudData): Persisted {
  return {
    customProblems: r.customProblems,
    worksheets: r.worksheets.map(normWorksheet).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    favorites: r.favorites,
    myLists: r.myLists,
    diffMatrix: r.diffMatrix ?? DEFAULT_DIFF_MATRIX,
    workbooks: r.workbooks,
    wbItems: r.wbItems,
    students: r.students,
    gradings: r.gradings.sort((a, b) => b.date.localeCompare(a.date)),
    dailyNotes: r.dailyNotes,
    assignments: r.assignments ?? [],
    dailyConfigs: r.dailyConfigs ?? {},
    studentAppConfig: { ...DEFAULT_STUDENT_APP_CONFIG, ...(r.studentAppConfig ?? {}) },
    klassOrder: r.klassOrder ?? [],
    academyProfile: r.academyProfile ?? {},
    savedReports: r.savedReports ?? [],
    myBooks: r.myBooks ?? [],
    uploads: r.uploads ?? [],
    sheetTemplates: r.sheetTemplates ?? [],
  }
}
function toCloud(s: Persisted): CloudData {
  return {
    customProblems: s.customProblems, worksheets: s.worksheets, myLists: s.myLists,
    workbooks: s.workbooks, wbItems: s.wbItems, students: s.students, gradings: s.gradings,
    dailyNotes: s.dailyNotes, favorites: s.favorites, diffMatrix: s.diffMatrix,
    assignments: s.assignments, dailyConfigs: s.dailyConfigs,
    studentAppConfig: s.studentAppConfig,
    klassOrder: s.klassOrder, academyProfile: s.academyProfile,
    savedReports: s.savedReports,
    myBooks: s.myBooks, uploads: s.uploads, sheetTemplates: s.sheetTemplates,
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
      const c = courseOfGrade(w.grade)
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
      const c = courseOfGrade(w.grade)
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
    for (const w of state.workbooks) wanted.add(defaultCurriculumForGrade(w.grade))
    wanted.forEach(c => ensureCourse(c))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.students, state.worksheets, state.workbooks])
  const poolProblems = useMemo(() => Object.values(pools).flat(), [pools])

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
    try {
      const snapshot = cloud.on ? { ...state, customProblems: [] } : state
      localStorage.setItem(LS_KEY, JSON.stringify(snapshot))
    } catch { /* 쿼터 초과 등은 무시 — 클라우드가 원본 */ }
  }, [state])

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
        if (has) setState(fromCloud(remote))
        else await cloud.seedIfEmpty(toCloud(stateRef.current))  // 클라우드 비면 로컬 업로드
      }
      if (alive) {
        setSynced(true)
        unsub = cloud.subscribe(() => { loadAll().then(r => { if (r && alive) setState(fromCloud(r)) }) })
      }
    })()
    return () => { alive = false; unsub() }
  }, [])

  const set = setState
  const store: Store = {
    ...state,
    synced,
    ensureCourse,
    wbItems: [...state.wbItems, ...derivedWbItems],   // 수동 등록분 + 매칭 교재 파생분
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
    addAssignment: (worksheetId, studentIds, kind = '수업') => {
      const now = new Date().toISOString()
      const fresh: Assignment[] = studentIds
        .filter(sid => !stateRef.current.assignments.some(a => a.worksheetId === worksheetId && a.studentId === sid && a.kind === kind))
        .map(sid => ({ id: uid('as'), worksheetId, studentId: sid, date: now, kind }))
      if (fresh.length === 0) return
      const next = [...stateRef.current.assignments, ...fresh]
      set(s => ({ ...s, assignments: next })); cloud.setSetting('assignments', next)
    },
    removeAssignment: (worksheetId, studentId, kind) => {
      // kind 지정 시 그 종류만 제거 (숙제 취소가 수업 출제까지 지우던 버그 방지)
      const next = stateRef.current.assignments.filter(a =>
        !(a.worksheetId === worksheetId && a.studentId === studentId && (kind ? a.kind === kind : true)))
      set(s => ({ ...s, assignments: next })); cloud.setSetting('assignments', next)
    },
    setDailyConfig: (studentId, cfg) => {
      const next = { ...stateRef.current.dailyConfigs, [studentId]: cfg }
      set(s => ({ ...s, dailyConfigs: next })); cloud.setSetting('dailyConfigs', next)
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
      set(s => ({ ...s, gradings: [rec, ...s.gradings] })); cloud.upsert(cloud.T.gradings, rec.id, rec)
    },
    upsertGrading: g => {
      const exists = stateRef.current.gradings.some(x => x.id === g.id)
      set(s => ({ ...s, gradings: exists ? s.gradings.map(x => x.id === g.id ? g : x) : [g, ...s.gradings] }))
      cloud.upsert(cloud.T.gradings, g.id, g)
    },
    saveDailyNote: n => {
      set(s => ({ ...s, dailyNotes: [...s.dailyNotes.filter(x => !(x.studentId === n.studentId && x.date === n.date)), n] }))
      cloud.upsert(cloud.T.dailyNotes, noteId(n), n)
    },
  }

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
