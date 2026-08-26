// 💬 관리자 채팅이 돌려준 '수정 작업(op)'의 검증·미리보기·실행·되돌리기
//
// 🔴 안전선 (api/diagnose.ts 의 chat 분기와 짝을 이룬다)
//  · AI 가 돌려준 것은 **정해진 4가지 작업**뿐이고, 여기서 한 번 더 화이트리스트로 거른다.
//    문자열을 코드로 실행하는 경로는 없다(selfHeal.ts 와 같은 방식).
//  · 실행은 **선생님이 [적용]을 눌러야** 일어난다. 그 전에 "이전값 → 새값"을 그대로 보여준다.
//  · 정답 수정은 BulkImportModal 과 **같은 병합 경로**를 쓴다 — 수동 문항을 얹어
//    (교재|쪽|번호)가 같은 파생 문항의 정답·형태만 덮으므로 **파생 id가 유지되고
//    이미 채점한 기록이 날아가지 않는다**(19-2 에서 데인 곳).
//  · 채점 엔진(answers.ts·mathAnswer.ts)과 소스 코드는 이 경로로 바뀌지 않는다.
import type { Grading, Student, StudentAppConfig, WBItem, Workbook } from '../types'

// 💬 채팅창을 쓸 수 있는 사람 — **이 둘만** (2026-07-30 명수쌤 지시)
// 데이터를 실제로 고치는 창이라 강사·조교에게는 열지 않는다.
// 서버(api/diagnose.ts 의 chat 분기)에서도 같은 목록으로 세션 이메일을 검증한다 —
// 버튼을 숨기는 것만으로는 API 직접 호출을 막지 못하기 때문.
// 2026-08-26 명수쌤: azzico 관리자가 앱에서 직접 고치게 해 달라 → 주소가 둘 중 어느 것인지
// 확실치 않아 **둘 다** 넣는다(둘 다 명수쌤이 쓰는 계정이다).
export const CHAT_ALLOWED_EMAILS = ['annals@hanmail.net', 'azzico77@naver.com', 'azzico@naver.com'] as const
export const chatAllowed = (email: string | null | undefined) =>
  !!email && (CHAT_ALLOWED_EMAILS as readonly string[]).includes(email.trim().toLowerCase())

export const CONFIG_KEYS = [
  'showAnswer', 'showSolution', 'showVideo',
  'showAnswerBefore', 'showSolutionBefore', 'showVideoBefore',
  'dailyMasterOn', 'solveFeedback', 'aiGrade',
] as const
export type ConfigKey = typeof CONFIG_KEYS[number]

export const CONFIG_LABEL: Record<ConfigKey, string> = {
  showAnswer: '정답 공개(채점 후)',
  showSolution: '해설 공개(채점 후)',
  showVideo: '풀이 영상 공개(채점 후)',
  showAnswerBefore: '정답 공개(채점 전)',
  showSolutionBefore: '해설 공개(채점 전)',
  showVideoBefore: '풀이 영상 공개(채점 전)',
  dailyMasterOn: '오늘의 학습 공개',
  solveFeedback: '풀이 AI 피드백 사용',
  aiGrade: 'AI 1차 채점',
}

const STUDENT_FIELDS = ['name', 'grade', 'klass', 'attendNo', 'school', 'active'] as const
export const STUDENT_LABEL: Record<string, string> = {
  name: '이름', grade: '학년', klass: '반', attendNo: '출결번호', school: '학교', active: '재원',
}

export type Op =
  | { type: 'answer.set'; why: string; workbookId: string; page: number; label: string; answer: string }
  | { type: 'student.update'; why: string; studentId: string; patch: Partial<Student> }
  | { type: 'config.set'; why: string; key: ConfigKey; value: boolean }
  | { type: 'grading.mark'; why: string; gradingId: string; page: number; label: string; mark: 'o' | 'x' | 'unknown' }

/** 미리보기 한 줄 — 무엇이 어떻게 바뀌는지 사람 말로 */
export interface OpPreview {
  op: Op
  what: string          // 대상 (예: "오투 통합과학2 15쪽 8번 정답")
  before: string        // 이전값 (없으면 '(빈 값)')
  after: string         // 새값
  warn?: string         // 주의 (예: 전체 학생 적용)
  blocked?: string      // 실행 불가 이유 — 있으면 적용 대상에서 제외
}

export interface Ctx {
  workbooks: Workbook[]
  wbItems: WBItem[]
  students: Student[]
  gradings: Grading[]
  config: StudentAppConfig
}

const s = (v: unknown) => typeof v === 'string' ? v.trim() : ''
const n = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : NaN

/** 서버가 준 op 을 우리 타입으로 좁힌다 — 필수 필드가 하나라도 없으면 버린다 */
export function validateOp(raw: any): Op | null {
  const why = s(raw?.why).slice(0, 300)
  switch (raw?.type) {
    case 'answer.set': {
      const workbookId = s(raw.workbookId), label = s(raw.label), answer = s(raw.answer), page = n(raw.page)
      if (!workbookId || !label || !answer || Number.isNaN(page)) return null
      return { type: 'answer.set', why, workbookId, page, label, answer: answer.slice(0, 500) }
    }
    case 'student.update': {
      const studentId = s(raw.studentId)
      if (!studentId || !raw.patch || typeof raw.patch !== 'object') return null
      const patch: any = {}
      for (const f of STUDENT_FIELDS) {
        const v = (raw.patch as any)[f]
        if (f === 'active') { if (typeof v === 'boolean') patch.active = v }
        else if (typeof v === 'string' && v.trim()) patch[f] = v.trim().slice(0, 100)
      }
      if (!Object.keys(patch).length) return null
      return { type: 'student.update', why, studentId, patch }
    }
    case 'config.set': {
      const key = s(raw.key) as ConfigKey
      if (!CONFIG_KEYS.includes(key) || typeof raw.value !== 'boolean') return null
      return { type: 'config.set', why, key, value: raw.value }
    }
    case 'grading.mark': {
      const gradingId = s(raw.gradingId), label = s(raw.label), page = n(raw.page), mark = s(raw.mark)
      if (!gradingId || !label || Number.isNaN(page)) return null
      if (mark !== 'o' && mark !== 'x' && mark !== 'unknown') return null
      return { type: 'grading.mark', why, gradingId, page, label, mark }
    }
    default: return null
  }
}

const itemKey = (workbookId: string, page: number, label: string) => `${workbookId}|${page}|${label}`
const keyOf = (i: WBItem) => itemKey(i.workbookId, i.page, i.label ?? String(i.no))
const markLabel = (m: 'o' | 'x' | 'unknown') => m === 'o' ? '○ 정답' : m === 'x' ? '✕ 오답' : '모름'

export function previewOp(op: Op, ctx: Ctx): OpPreview {
  switch (op.type) {
    case 'answer.set': {
      const wb = ctx.workbooks.find(w => w.id === op.workbookId)
      const cur = ctx.wbItems.find(i => keyOf(i) === itemKey(op.workbookId, op.page, op.label))
      return {
        op,
        what: `${wb?.name ?? '(모르는 교재)'} ${op.page}쪽 ${op.label}번 정답`,
        before: cur?.answer?.trim() || '(빈 값)',
        after: op.answer,
        blocked: !wb ? '그 교재가 없습니다.'
          : !cur ? `${op.page}쪽 ${op.label}번 문항이 이 교재에 없습니다.` : undefined,
      }
    }
    case 'student.update': {
      const st = ctx.students.find(x => x.id === op.studentId)
      const fields = Object.keys(op.patch)
      const val = (o: any) => fields.map(f => {
        const v = o?.[f]
        return `${STUDENT_LABEL[f] ?? f} ${f === 'active' ? (v ? '재원' : '퇴원') : (v ?? '—')}`
      }).join(' · ')
      return {
        op,
        what: `${st?.name ?? '(모르는 학생)'} 학생 정보`,
        before: st ? val(st) : '—',
        after: val({ ...st, ...op.patch }),
        blocked: st ? undefined : '그 학생이 없습니다.',
      }
    }
    case 'config.set': {
      const before = (ctx.config as any)[op.key]
      return {
        op,
        what: `학생앱 설정 — ${CONFIG_LABEL[op.key]}`,
        before: before === undefined ? '(기본값)' : before ? '켜짐' : '꺼짐',
        after: op.value ? '켜짐' : '꺼짐',
        warn: '이 설정은 학생별이 아니라 재원생 전체에게 한 번에 적용됩니다.',
      }
    }
    case 'grading.mark': {
      const g = ctx.gradings.find(x => x.id === op.gradingId)
      const st = ctx.students.find(x => x.id === g?.studentId)
      const wb = ctx.workbooks.find(w => w.id === g?.workbookId)
      const item = ctx.wbItems.find(i => keyOf(i) === itemKey(g?.workbookId ?? '', op.page, op.label))
      const r = g?.results.find(x => x.itemId && x.itemId === item?.id)
      return {
        op,
        what: `${st?.name ?? '?'} · ${wb?.name ?? '?'} ${op.page}쪽 ${op.label}번 채점`,
        before: r ? (r.unknown ? '모름' : r.correct ? '○ 정답' : '✕ 오답') : '(채점 기록 없음)',
        after: markLabel(op.mark),
        warn: '성적·보고서 집계에 바로 반영됩니다.',
        blocked: !g ? '그 채점 기록이 없습니다.'
          : !item ? '그 문항을 교재에서 찾지 못했습니다.'
            : !r ? '그 문항은 아직 채점되지 않았습니다.' : undefined,
      }
    }
  }
}

/** 적용 직전 상태 — [되돌리기] 한 번으로 복구한다 */
export interface Snapshot {
  wbItems?: { workbookId: string; items: WBItem[] }[]
  students?: Student[]
  config?: StudentAppConfig
  gradings?: Grading[]
}

export interface StoreApi {
  setWBItems: (workbookId: string, items: WBItem[]) => void
  updateStudent: (id: string, patch: Partial<Student>) => void
  setStudentAppConfig: (cfg: StudentAppConfig) => void
  upsertGrading: (g: Grading) => void
  uid: (p: string) => string
}

/**
 * 적용. 막힌(blocked) op 은 건너뛴다. 되돌리기용 스냅샷을 함께 돌려준다.
 * 정답 수정은 교재별로 모아 **수동 문항 목록 전체**를 한 번에 저장한다(setWBItems 규약).
 */
export function applyOps(previews: OpPreview[], ctx: Ctx, api: StoreApi): { done: number; snapshot: Snapshot } {
  const ok = previews.filter(p => !p.blocked)
  const snapshot: Snapshot = {}
  let done = 0

  // ── 정답: 교재별 묶음 ──
  const byWb = new Map<string, Op[]>()
  for (const p of ok) if (p.op.type === 'answer.set') {
    const arr = byWb.get(p.op.workbookId) ?? []
    arr.push(p.op); byWb.set(p.op.workbookId, arr)
  }
  if (byWb.size) {
    snapshot.wbItems = []
    for (const [workbookId, ops] of byWb) {
      // 파생 문항(id 에 '#')은 건드리지 않는다 — 수동 등록분만 넘겨야 클라우드에 파생 1천여 개가
      // 통째로 복사되지 않는다(19-2). 병합은 store 가 (교재|쪽|번호)로 알아서 얹는다.
      const manual = ctx.wbItems.filter(i => i.workbookId === workbookId && !i.id.includes('#'))
      snapshot.wbItems.push({ workbookId, items: manual })
      const next = [...manual]
      for (const op of ops as Extract<Op, { type: 'answer.set' }>[]) {
        const k = itemKey(workbookId, op.page, op.label)
        const derived = ctx.wbItems.find(i => keyOf(i) === k)
        const kind = /^[①②③④⑤]$/.test(op.answer) ? '객관식' : (derived?.kind ?? '주관식')
        const at = next.findIndex(i => keyOf(i) === k)
        if (at >= 0) next[at] = { ...next[at], answer: op.answer, kind }
        else next.push({
          id: api.uid('wi'), workbookId, page: op.page, no: next.length + 1,
          label: op.label, typeId: derived?.typeId ?? '', kind, answer: op.answer,
        })
        done++
      }
      api.setWBItems(workbookId, next)
    }
  }

  // ── 학생 정보 ──
  const stOps = ok.filter(p => p.op.type === 'student.update')
  if (stOps.length) {
    snapshot.students = stOps
      .map(p => ctx.students.find(x => x.id === (p.op as any).studentId))
      .filter((x): x is Student => !!x)
    for (const p of stOps) {
      const op = p.op as Extract<Op, { type: 'student.update' }>
      api.updateStudent(op.studentId, op.patch); done++
    }
  }

  // ── 학생앱 설정 (여러 개면 한 번에 합쳐 저장) ──
  const cfgOps = ok.filter(p => p.op.type === 'config.set')
  if (cfgOps.length) {
    snapshot.config = { ...ctx.config }
    const next: any = { ...ctx.config }
    for (const p of cfgOps) {
      const op = p.op as Extract<Op, { type: 'config.set' }>
      next[op.key] = op.value; done++
    }
    api.setStudentAppConfig(next)
  }

  // ── 채점 기록 ──
  const grOps = ok.filter(p => p.op.type === 'grading.mark')
  if (grOps.length) {
    snapshot.gradings = []
    const edited = new Map<string, Grading>()
    for (const p of grOps) {
      const op = p.op as Extract<Op, { type: 'grading.mark' }>
      const base = edited.get(op.gradingId) ?? ctx.gradings.find(g => g.id === op.gradingId)
      if (!base) continue
      if (!edited.has(op.gradingId)) snapshot.gradings.push(base)
      const item = ctx.wbItems.find(i => keyOf(i) === itemKey(base.workbookId ?? '', op.page, op.label))
      const next: Grading = {
        ...base,
        results: base.results.map(r => r.itemId && r.itemId === item?.id
          ? { ...r, correct: op.mark === 'o', unknown: op.mark === 'unknown' ? true : undefined }
          : r),
      }
      edited.set(op.gradingId, next); done++
    }
    for (const g of edited.values()) api.upsertGrading(g)
  }

  return { done, snapshot }
}

// 마지막 적용분은 **모듈에 남긴다** — 창을 닫으면 컴포넌트 상태가 사라져 되돌릴 방법이
// 없어지기 때문(창을 닫고 화면을 확인한 뒤 되돌리고 싶은 게 보통이다).
let lastApplied: { snapshot: Snapshot; done: number; at: number } | null = null
export const takeLastApplied = () => lastApplied
export const clearLastApplied = () => { lastApplied = null }
export const rememberApplied = (snapshot: Snapshot, done: number) => {
  lastApplied = { snapshot, done, at: Date.now() }
}

export function undoSnapshot(snap: Snapshot, api: StoreApi) {
  for (const w of snap.wbItems ?? []) api.setWBItems(w.workbookId, w.items)
  for (const st of snap.students ?? []) api.updateStudent(st.id, st)
  if (snap.config) api.setStudentAppConfig(snap.config)
  for (const g of snap.gradings ?? []) api.upsertGrading(g)
}
