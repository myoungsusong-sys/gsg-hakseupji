import { supabase } from './supabase'
import type { MasteryState } from './mastery'
import * as outbox from './outbox'
import type { AssignmentCmd } from './assignmentCmds'
import type {
  AcademyProfile, Assignment, Branch, BugReport, Counsel, DailyConfig, DailyNote, DiffMatrix, Grading, LecturePlan, MyBook, MyList, PointEntry, PointSettlement, Problem, SavedReport, SheetTemplate, SolveFeedback, Student, Teacher, StudentAppConfig, UploadRec, Workbook, WBItem, Worksheet,
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
  dailyBooks: Record<string, string>           // 기본과제 학생별 수학 과정 지정 (settings 'dailyBooks', 키=studentId → 과정 id)
  counsels: Counsel[]                          // 🗓 주간 상담 (settings 'counsels')
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
  branches: Branch[]                           // 지점 (settings 'branches') — 당진·내포 등
  ttChecks: Record<string, true>               // 시간표 블록 완료 체크 (settings 'ttChecks', 키=`학생|날짜|블록idx`)
  reviewChecks: Record<string, true>           // 🏫 학교 복습 체크 (settings 'reviewChecks', 키=`학생|날짜|과목|solve|wrong`)
  masteries: Record<string, MasteryState>      // 🪜 유형 마스터 진행상태 (settings 'masteries', 키=`학생id|유형id`)
  schoolBooks: Record<string, Record<string, string>>  // 🏫 학교별 교과서 (settings 'schoolBooks', 키=학교명 → 과목 → 교과서)
  pointEntries: PointEntry[]                   // 포인트 수동/학부모 항목 (settings 'pointEntries')
  pointSettlements: PointSettlement[]
  bugReports: BugReport[]                      // 🛠 AI 점검 오류 보고 (settings 'bugReports')          // 월말 정산 스냅샷 (settings 'pointSettlements')
}

export function noteId(n: DailyNote): string {
  return `${n.studentId}_${n.date}`
}

// Supabase REST는 한 번에 최대 1000행만 반환 → range로 전량 페이지네이션
//
// 🔴 id 까지 같이 읽는다. 아직 클라우드에 못 올린 대기분(outbox)을 이 위에 덮어씌워야
//    하는데, 그러려면 행마다 id 가 필요하다. 덮어씌우지 않으면 저장 못 한 채점이
//    다른 기기의 저장 한 번에 화면에서 지워진다 (자세한 사정은 lib/outbox.ts 머리말).
/**
 * 한 테이블을 통째로 읽는다.
 *
 * 🔴 **실패를 반드시 알린다** (2026-08-21, 김준우 채점내역 유실).
 *    예전에는 페이지 읽기가 실패하면 `break` 하고 **그때까지 받은 것만** 돌려줬다.
 *    호출부는 그게 전부인 줄 알고 state·localStorage 를 덮어썼고,
 *    **멀쩡히 저장돼 있던 채점이 화면에서 통째로 사라졌다.**
 *    (2쪽째가 실패하면 앞 1,000행만 남는 «조용한 잘림»도 같은 사고다.)
 *    → ok:false 면 호출부는 **그 표를 건드리지 않는다.**
 *
 * 🔴 hj_gradings 행에는 학생 풀이 이미지(base64)가 들어 있어 1,000행을 한 번에 받으면
 *    응답이 수십 MB가 되어 실패하기 쉽다. 그 표만 페이지를 잘게 나눈다.
 */
const PAGE_OF: Record<string, number> = { [T.gradings]: 200 }

async function rows(table: string): Promise<{ rows: { id: string; data: unknown }[]; ok: boolean }> {
  if (!supabase) return { rows: [], ok: true }
  const PAGE = PAGE_OF[table] ?? 1000
  const out: { id: string; data: unknown }[] = []
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select('id, data').range(from, from + PAGE - 1)
    // 설정 테이블의 실시간 스냅샷(live_*)·풀이 녹화(replay_*) 행은 크고(이미지·이벤트 로그)
    // 부팅에 불필요하다 — 전용 API(lib/live.ts·lib/replay.ts)로만 읽으므로 부팅 로드에서 제외
    if (table === T.settings) q = q.not('id', 'like', 'live_%').not('id', 'like', 'replay_%').not('id', 'like', 'rubric_%')
    const { data, error } = await q
    if (error) {
      console.warn('[load 실패]', table, error.message, `— ${out.length}행까지 받음. 이 표는 갱신하지 않는다.`)
      return { rows: [], ok: false }
    }
    const batch = data ?? []
    out.push(...batch.map((r: { id: string; data: unknown }) => ({ id: r.id, data: r.data })))
    if (batch.length < PAGE) break
  }
  return { rows: outbox.applyTo(table, out), ok: true }
}

/** 읽기에 실패한 테이블 목록 — 호출부(store)는 여기 든 표를 **덮어쓰지 않는다.** */
export type LoadFail = Partial<Record<
  'customProblems' | 'worksheets' | 'myLists' | 'workbooks' | 'wbItems' |
  'students' | 'gradings' | 'dailyNotes' | 'settings', true>>

export async function loadAll(): Promise<(CloudData & { __failed: LoadFail }) | null> {
  if (!supabase) return null
  const raw = await Promise.all(ALL_TABLES.map(rows))
  const [problems, worksheets, lists, workbooks, wbItems, students, gradings, dailyNotes, settings] =
    raw.map(rs => rs.rows.map(r => r.data as any))
  // 어느 표가 실패했나 — ALL_TABLES 순서와 아래 이름 순서가 같아야 한다
  const NAMES = ['customProblems', 'worksheets', 'myLists', 'workbooks', 'wbItems',
    'students', 'gradings', 'dailyNotes', 'settings'] as const
  const __failed: LoadFail = {}
  raw.forEach((r, i) => { if (!r.ok && NAMES[i]) __failed[NAMES[i]] = true })
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
    dailyBooks: (settingsMap.get('dailyBooks') as Record<string, string>) ?? {},
    counsels: (settingsMap.get('counsels') as Counsel[]) ?? [],
    studentAppConfig: (settingsMap.get('studentAppConfig') as StudentAppConfig) ?? null,
    klassOrder: (settingsMap.get('klassOrder') as string[]) ?? [],
    academyProfile: (settingsMap.get('academyProfile') as AcademyProfile) ?? null,
    savedReports: (settingsMap.get('savedReports') as SavedReport[]) ?? [],
    myBooks: (settingsMap.get('myBooks') as MyBook[]) ?? [],
    uploads: (settingsMap.get('uploads') as UploadRec[]) ?? [],
    sheetTemplates: (settingsMap.get('sheetTemplates') as SheetTemplate[]) ?? [],
    lecturePlans: (settingsMap.get('lecturePlans') as LecturePlan[]) ?? [],
    solveFeedbacks: (settingsMap.get('solveFeedbacks') as SolveFeedback[]) ?? [],
    bugReports: (settingsMap.get('bugReports') as BugReport[]) ?? [],
    teachers: (settingsMap.get('teachers') as Teacher[]) ?? [],
    branches: (settingsMap.get('branches') as Branch[]) ?? [],
    ttChecks: (settingsMap.get('ttChecks') as Record<string, true>) ?? {},
    reviewChecks: (settingsMap.get('reviewChecks') as Record<string, true>) ?? {},
    masteries: (settingsMap.get('masteries') as CloudData['masteries']) ?? {},
    schoolBooks: (settingsMap.get('schoolBooks') as CloudData['schoolBooks']) ?? {},
    pointEntries: (settingsMap.get('pointEntries') as PointEntry[]) ?? [],
    pointSettlements: (settingsMap.get('pointSettlements') as PointSettlement[]) ?? [],
    __failed,
  }
}

export const cloud = {
  on: !!supabase,
  // 🔴 아래 쓰기들은 실패해도 조용히 지나가지 않는다. 못 올린 것은 outbox 에 남아
  //    될 때까지 재시도되고, 그때까지 loadAll() 결과 위에 덮어씌워져 화면에서도 안 사라진다.
  //    반환값 true = 저장이 끝났다. 화면이 「저장됨」이라고 말하려면 이 값을 봐야 한다.
  //    ⚠️ 클라우드 설정이 아예 없는 로컬 단독 모드(supabase=null)에서는 localStorage 저장이
  //       곧 완료다 — 올릴 곳이 없으므로 true. 여기서 false 를 주면 멀쩡한 저장마다
  //       「아직 안 올라감」이 뜨는 오탐이 된다.
  async upsert(table: string, id: string, data: unknown): Promise<boolean> {
    if (!supabase) return true
    return outbox.write({ kind: 'upsert', table, id, data, at: new Date().toISOString() })
  },
  async upsertMany(table: string, items: { id: string; data: unknown }[]): Promise<boolean> {
    if (!supabase || items.length === 0) return true
    const now = new Date().toISOString()
    const CHUNK = 500
    let ok = true
    for (let i = 0; i < items.length; i += CHUNK) {
      const batch = items.slice(i, i + CHUNK).map(x => ({ id: x.id, data: x.data, updated_at: now }))
      const { error } = await supabase.from(table).upsert(batch)
      if (error) {
        console.warn('upsertMany', table, error.message)
        // 뭉치 전송이 막히면 낱개로 큐에 넣어 둔다 — 이관·일괄 저장이 통째로 사라지지 않게
        ok = false
        for (const x of items.slice(i, i + CHUNK))
          void outbox.write({ kind: 'upsert', table, id: x.id, data: x.data, at: now })
      }
    }
    return ok
  },
  async del(table: string, id: string): Promise<boolean> {
    if (!supabase) return true
    return outbox.write({ kind: 'del', table, id, at: new Date().toISOString() })
  },
  async setSetting(key: string, value: unknown): Promise<boolean> {
    if (!supabase) return true
    return outbox.write({ kind: 'upsert', table: T.settings, id: key, data: { __id: key, value }, at: new Date().toISOString() })
  },
  // 🔴 배정(assignments)만은 setSetting(통짜 배열, 마지막 쓰기가 이김)을 쓰면 안 된다 —
  //    두 기기가 동시에 배정하면 한쪽이 통째로 사라진다(2026-08-15 강리원 배정 유실).
  //    명령을 넘기면 서버 최신에 병합(CAS)해 저장한다. 자세한 사정은 lib/assignmentCmds.ts.
  async assignmentOps(cmds: AssignmentCmd[]): Promise<boolean> {
    if (!supabase) return true
    return outbox.writeAssignmentOps(cmds)
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
      Object.keys(local.dailyBooks).length ? this.setSetting('dailyBooks', local.dailyBooks) : Promise.resolve(),
      local.counsels.length ? this.setSetting('counsels', local.counsels) : Promise.resolve(),
      local.studentAppConfig ? this.setSetting('studentAppConfig', local.studentAppConfig) : Promise.resolve(),
      local.klassOrder.length ? this.setSetting('klassOrder', local.klassOrder) : Promise.resolve(),
      local.academyProfile ? this.setSetting('academyProfile', local.academyProfile) : Promise.resolve(),
      local.savedReports.length ? this.setSetting('savedReports', local.savedReports) : Promise.resolve(),
      local.myBooks.length ? this.setSetting('myBooks', local.myBooks) : Promise.resolve(),
      local.uploads.length ? this.setSetting('uploads', local.uploads) : Promise.resolve(),
      local.sheetTemplates.length ? this.setSetting('sheetTemplates', local.sheetTemplates) : Promise.resolve(),
      local.lecturePlans.length ? this.setSetting('lecturePlans', local.lecturePlans) : Promise.resolve(),
      local.solveFeedbacks.length ? this.setSetting('solveFeedbacks', local.solveFeedbacks) : Promise.resolve(),
      local.bugReports.length ? this.setSetting('bugReports', local.bugReports) : Promise.resolve(),
      local.teachers.length ? this.setSetting('teachers', local.teachers) : Promise.resolve(),
      local.branches.length ? this.setSetting('branches', local.branches) : Promise.resolve(),
      Object.keys(local.ttChecks ?? {}).length ? this.setSetting('ttChecks', local.ttChecks) : Promise.resolve(),
      Object.keys(local.reviewChecks ?? {}).length ? this.setSetting('reviewChecks', local.reviewChecks) : Promise.resolve(),
      Object.keys(local.masteries ?? {}).length ? this.setSetting('masteries', local.masteries) : Promise.resolve(),
      Object.keys(local.schoolBooks ?? {}).length ? this.setSetting('schoolBooks', local.schoolBooks) : Promise.resolve(),
      (local.pointEntries ?? []).length ? this.setSetting('pointEntries', local.pointEntries) : Promise.resolve(),
      (local.pointSettlements ?? []).length ? this.setSetting('pointSettlements', local.pointSettlements) : Promise.resolve(),
    ])
  },
  // 다른 기기의 변경을 실시간 수신 → onChange(전체 리로드)
  // ⚠️ 실시간 풀이 스냅샷(live_*)·풀이 녹화(replay_*)는 초 단위로 upsert되므로
  //    앱 전체 리로드를 유발하지 않도록 무시한다 (전용 폴링/조회로만 읽는다).
  subscribe(onChange: () => void) {
    const sb = supabase
    if (!sb) return () => {}
    const ch = sb.channel('hj-sync')
    for (const t of ALL_TABLES)
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, (payload: any) => {
        const id = payload?.new?.id ?? payload?.old?.id
        if (t === T.settings && typeof id === 'string' && (id.startsWith('live_') || id.startsWith('replay_') || id.startsWith('rubric_'))) return
        onChange()
      })
    ch.subscribe()
    return () => { sb.removeChannel(ch) }
  },
}
