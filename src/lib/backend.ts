import { supabase } from './supabase'
import type {
  AcademyProfile, Assignment, DailyConfig, DailyNote, DiffMatrix, Grading, LecturePlan, MyBook, MyList, Problem, SavedReport, SheetTemplate, SolveFeedback, Student, Teacher, StudentAppConfig, UploadRec, Workbook, WBItem, Worksheet,
} from '../types'

// 각 컬렉션 ↔ Supabase 테이블 (테이블 = id text + data jsonb)
const T = {
  problems: 'hj_problems',
  worksheets: 'hj_worksheets',
  lists: 'hj_lists',
  workbooks: 'hj_workbooks',
  wbItems: 'hj_wb_items',
  students: 'hj_students',
  gradings: 'hj_gradings',
  dailyNotes: 'hj_daily_notes',
  settings: 'hj_settings',
} as const

const ALL_TABLES = Object.values(T)

export interface CloudData {
  customProblems: Problem[]
  worksheets: Worksheet[]
  myLists: MyList[]
  workbooks: Workbook[]
  wbItems: WBItem[]
  students: Student[]
  gradings: Grading[]
  dailyNotes: DailyNote[]
  favorites: string[]
  diffMatrix: DiffMatrix | null
  assignments: Assignment[]                    // 학습지 출제 (settings 'assignments')
  dailyConfigs: Record<string, DailyConfig>    // 오늘의 학습 설정 (settings 'dailyConfigs', 키=studentId)
  studentAppConfig: StudentAppConfig | null    // 학생앱 공개 설정 (settings 'studentAppConfig')
  klassOrder: string[]                         // 반 표시 순서 (settings 'klassOrder')
  academyProfile: AcademyProfile | null        // 마이페이지 내 정보 (settings 'academyProfile')
  savedReports: SavedReport[]                  // 저장된 보고서 목록 (settings 'savedReports')
  myBooks: MyBook[]                            // 내 교재 (settings 'myBooks')
  uploads: UploadRec[]                         // 파일 업로드 대기 목록 (settings 'uploads')
  sheetTemplates: SheetTemplate[]              // 사용자 디자인 템플릿 (settings 'sheetTemplates')
  lecturePlans: LecturePlan[]                  // 강의 진도표 (settings 'lecturePlans')
  solveFeedbacks: SolveFeedback[]              // 학생 풀이 AI 피드백 (settings 'solveFeedbacks')
  teachers: Teacher[]                         // 강사 (settings 'teachers')
  ttChecks: Record<string, true>               // 시간표 블록 완료 체크 (settings 'ttChecks', 키=`학생|날짜|블록idx`)
}

export function noteId(n: DailyNote): string {
  return `${n.studentId}_${n.date}`
}

// Supabase REST는 한 번에 최대 1000행만 반환 → range로 전량 페이지네이션
async function rows(table: string): Promise<any[]> {
  if (!supabase) return []
  const PAGE = 1000
  const out: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('data').range(from, from + PAGE - 1)
    if (error) { console.warn('load', table, error.message); break }
    const batch = data ?? []
    out.push(...batch.map((r: { data: unknown }) => r.data))
    if (batch.length < PAGE) break
  }
  return out
}

export async function loadAll(): Promise<CloudData | null> {
  if (!supabase) return null
  const [problems, worksheets, lists, workbooks, wbItems, students, gradings, dailyNotes, settings] =
    await Promise.all(ALL_TABLES.map(rows))
  const settingsMap = new Map<string, any>()
  for (const s of settings) if (s && s.__id) settingsMap.set(s.__id, s.value)
  return {
    customProblems: problems as Problem[],
    worksheets: worksheets as Worksheet[],
    myLists: lists as MyList[],
    workbooks: workbooks as Workbook[],
    wbItems: wbItems as WBItem[],
    students: students as Student[],
    gradings: gradings as Grading[],
    dailyNotes: dailyNotes as DailyNote[],
    favorites: (settingsMap.get('favorites') as string[]) ?? [],
    diffMatrix: (settingsMap.get('diffMatrix') as DiffMatrix) ?? null,
    assignments: (settingsMap.get('assignments') as Assignment[]) ?? [],
    dailyConfigs: (settingsMap.get('dailyConfigs') as Record<string, DailyConfig>) ?? {},
    studentAppConfig: (settingsMap.get('studentAppConfig') as StudentAppConfig) ?? null,
    klassOrder: (settingsMap.get('klassOrder') as string[]) ?? [],
    academyProfile: (settingsMap.get('academyProfile') as AcademyProfile) ?? null,
    savedReports: (settingsMap.get('savedReports') as SavedReport[]) ?? [],
    myBooks: (settingsMap.get('myBooks') as MyBook[]) ?? [],
    uploads: (settingsMap.get('uploads') as UploadRec[]) ?? [],
    sheetTemplates: (settingsMap.get('sheetTemplates') as SheetTemplate[]) ?? [],
    lecturePlans: (settingsMap.get('lecturePlans') as LecturePlan[]) ?? [],
    solveFeedbacks: (settingsMap.get('solveFeedbacks') as SolveFeedback[]) ?? [],
    teachers: (settingsMap.get('teachers') as Teacher[]) ?? [],
    ttChecks: (settingsMap.get('ttChecks') as Record<string, true>) ?? {},
  }
}

export const cloud = {
  on: !!supabase,
  async upsert(table: string, id: string, data: unknown) {
    if (!supabase) return
    const { error } = await supabase.from(table).upsert({ id, data, updated_at: new Date().toISOString() })
    if (error) console.warn('upsert', table, error.message)
  },
  async upsertMany(table: string, items: { id: string; data: unknown }[]) {
    if (!supabase || items.length === 0) return
    const now = new Date().toISOString()
    const CHUNK = 500
    for (let i = 0; i < items.length; i += CHUNK) {
      const batch = items.slice(i, i + CHUNK).map(x => ({ id: x.id, data: x.data, updated_at: now }))
      const { error } = await supabase.from(table).upsert(batch)
      if (error) console.warn('upsertMany', table, error.message)
    }
  },
  async del(table: string, id: string) {
    if (!supabase) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) console.warn('del', table, error.message)
  },
  async setSetting(key: string, value: unknown) {
    if (!supabase) return
    const { error } = await supabase.from(T.settings).upsert({ id: key, data: { __id: key, value }, updated_at: new Date().toISOString() })
    if (error) console.warn('setting', key, error.message)
  },
  T,
  // 최초 진입 시 클라우드가 비어 있으면 로컬 데이터를 밀어 올림
  async seedIfEmpty(local: CloudData) {
    if (!supabase) return
    const put = (table: string, arr: { id?: string }[], idOf?: (x: any) => string) =>
      Promise.all(arr.map(o => this.upsert(table, idOf ? idOf(o) : (o as { id: string }).id, o)))
    await Promise.all([
      put(T.problems, local.customProblems),
      put(T.worksheets, local.worksheets),
      put(T.lists, local.myLists),
      put(T.workbooks, local.workbooks),
      put(T.wbItems, local.wbItems),
      put(T.students, local.students),
      put(T.gradings, local.gradings),
      put(T.dailyNotes, local.dailyNotes as any[], (n: DailyNote) => noteId(n)),
      this.setSetting('favorites', local.favorites),
      local.diffMatrix ? this.setSetting('diffMatrix', local.diffMatrix) : Promise.resolve(),
      local.assignments.length ? this.setSetting('assignments', local.assignments) : Promise.resolve(),
      Object.keys(local.dailyConfigs).length ? this.setSetting('dailyConfigs', local.dailyConfigs) : Promise.resolve(),
      local.studentAppConfig ? this.setSetting('studentAppConfig', local.studentAppConfig) : Promise.resolve(),
      local.klassOrder.length ? this.setSetting('klassOrder', local.klassOrder) : Promise.resolve(),
      local.academyProfile ? this.setSetting('academyProfile', local.academyProfile) : Promise.resolve(),
      local.savedReports.length ? this.setSetting('savedReports', local.savedReports) : Promise.resolve(),
      local.myBooks.length ? this.setSetting('myBooks', local.myBooks) : Promise.resolve(),
      local.uploads.length ? this.setSetting('uploads', local.uploads) : Promise.resolve(),
      local.sheetTemplates.length ? this.setSetting('sheetTemplates', local.sheetTemplates) : Promise.resolve(),
      local.lecturePlans.length ? this.setSetting('lecturePlans', local.lecturePlans) : Promise.resolve(),
      local.solveFeedbacks.length ? this.setSetting('solveFeedbacks', local.solveFeedbacks) : Promise.resolve(),
      local.teachers.length ? this.setSetting('teachers', local.teachers) : Promise.resolve(),
      Object.keys(local.ttChecks ?? {}).length ? this.setSetting('ttChecks', local.ttChecks) : Promise.resolve(),
    ])
  },
  // 다른 기기의 변경을 실시간 수신 → onChange(전체 리로드)
  // ⚠️ 실시간 풀이 모니터링 스냅샷(settings id=`live_*`)은 앱 전체 리로드를 유발하지 않도록 무시한다.
  subscribe(onChange: () => void) {
    const sb = supabase
    if (!sb) return () => {}
    const ch = sb.channel('hj-sync')
    for (const t of ALL_TABLES)
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, (payload: any) => {
        const id = payload?.new?.id ?? payload?.old?.id
        if (t === T.settings && typeof id === 'string' && id.startsWith('live_')) return
        onChange()
      })
    ch.subscribe()
    return () => { sb.removeChannel(ch) }
  },
}
