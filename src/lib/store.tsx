import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  DailyNote, DiffMatrix, Grading, MyList, Problem, Student, Workbook, WBItem, Worksheet,
} from '../types'
import { DEFAULT_DIFF_MATRIX, DEFAULT_SHEET_OPTIONS } from '../types'
import { SEED_PROBLEMS } from '../data/problems'
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
}

const EMPTY: Persisted = {
  customProblems: [], worksheets: [], favorites: [], myLists: [],
  diffMatrix: DEFAULT_DIFF_MATRIX,
  workbooks: [], wbItems: [], students: [], gradings: [], dailyNotes: [],
}

interface Store extends Persisted {
  problems: Problem[]
  synced: boolean
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
  saveGrading: (g: Omit<Grading, 'id'>) => void
  saveDailyNote: (n: DailyNote) => void
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
  }
}
function toCloud(s: Persisted): CloudData {
  return {
    customProblems: s.customProblems, worksheets: s.worksheets, myLists: s.myLists,
    workbooks: s.workbooks, wbItems: s.wbItems, students: s.students, gradings: s.gradings,
    dailyNotes: s.dailyNotes, favorites: s.favorites, diffMatrix: s.diffMatrix,
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(load)
  const [synced, setSynced] = useState(!cloud.on)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => { localStorage.setItem(LS_KEY, JSON.stringify(state)) }, [state])

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
    problems: [...SEED_PROBLEMS, ...state.customProblems],

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
    saveGrading: g => {
      const rec = { ...g, id: uid('gr') }
      set(s => ({ ...s, gradings: [rec, ...s.gradings] })); cloud.upsert(cloud.T.gradings, rec.id, rec)
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
