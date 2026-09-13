// ── 영어 단어시험 — 천일문 VOCA 중등필수 ────────────────────────────────
//
// 명수쌤(2026-08-21): "영어는 단어시험을 봐야 할 것 같애."
// 원본은 02_영어/대치스파르타(영어단어)/ 의 DAY별 xlsx 40개 — DAY당 정확히 25단어, 총 1,000개.
//
// 🔴 방향은 **뜻 → 영단어**(한→영)다. 반대로 하면 자동채점이 안 된다 —
//    뜻 문자열이 "[명] 1. 뇌 2. 지능" 처럼 품사·다의어·동의어가 섞여 있어 정답이 여럿이다.
//    한→영은 정답이 영단어 하나라 소문자·공백만 맞추면 정확히 채점된다.
//
// 🔴 단어를 Problem 으로 만들지 않는다. Problem.typeId 가 필수인데 유형 트리 전체
//    (오답드릴·유형분석·보고서)가 그걸 전제하고, 가짜 유형을 넣으면 보고서에 raw id 가 찍힌다.
//    시험 **결과만** 평범한 Grading 으로 남긴다 → 「오늘 교실」·호출·지도 패널이 공짜로 붙는다.

export interface VocaWord { w: string; mean: string }

const cache = new Map<string, Record<string, [string, string][]>>()

/** 단어장을 받아 온다. file 을 안 주면 중등(천일문) — 기존 호출부와 호환. */
export async function loadVoca(file = 'voca-cheonilmun-mid.json'): Promise<Record<string, [string, string][]>> {
  const hit = cache.get(file)
  if (hit) return hit
  const r = await fetch(`${import.meta.env.BASE_URL}${file}`)
  if (!r.ok) throw new Error('단어 파일을 불러오지 못했습니다')
  const d = await r.json()
  cache.set(file, d)
  return d
}

export const VOCA_BOOK = '천일문VOCA 중등필수'

// ── 🎓 학년별 단어장 ──────────────────────────────────────────────────────
//
// 🔴 명수쌤(2026-08-21): "학생이 학년이 다 다른 거 알지?" · "02_영어 여기에 파일있어"
//    → 학원 정본 단어장이 `02_영어/대치스파르타(영어단어)/` 에 통째로 있었다.
//      처음에 못 찾은 것은 **한글 파일명이 NFD 라 find 가 못 걸었기 때문**이다
//      (드라이브 한글 이름의 99%가 NFD. 찾을 때는 `00_도구/찾기.py` 를 쓸 것).
//
//    쎄듀 사다리를 그대로 따른다 — 책 이름이 곧 대상 학년이다.
//      중1~중3  천일문 VOCA 중등필수   1,000단어 · 40일치
//      고1      어휘끝 고교기본        1,260단어 · 51일치
//      고2~고3  어휘끝 수능           1,855단어 · 75일치
//
//    ※ 명수쌤이 처음 고르신 **능률VOCA 수능필수**는 이 맥에 MP3 180개뿐이고 단어 목록이
//      없다(드라이브 전체를 NFD 안전 검색으로 재확인). 음성에서 철자를 받아쓰면 정답이
//      틀어지므로 쓰지 않았다. 어휘리스트를 받으면 아래 표만 바꾸면 된다.
//    ※ 어휘끝 블랙(고난도)은 엑셀 서식이 달라(열 순서 뒤바뀜) 아직 안 넣었다.
import { gradeKey } from './grade'
import { dateKey } from './dates'
import type { Grading, GradeResult, Student, Workbook } from '../types'

// days = 그 책의 DAY 수. 학생 홈이 **단어 파일을 받지 않고도** 오늘 볼 DAY를 계산하려고 둔다
//   (홈에서 1~2MB 짜리 단어장을 받게 하면 첫 화면이 느려진다).
export interface VocaBook { key: string; name: string; file: string; days: number }

const MID: VocaBook = { key: 'mid', name: VOCA_BOOK, file: 'voca-cheonilmun-mid.json', days: 40 }
const GOGYO: VocaBook = { key: 'gogyo', name: '어휘끝 고교기본', file: 'voca-eohwikkeut-gogyo.json', days: 51 }
const SUNEUNG: VocaBook = { key: 'suneung', name: '어휘끝 수능', file: 'voca-eohwikkeut-suneung.json', days: 75 }

export const VOCA_BOOK_HIGH = SUNEUNG.name

/** 학년으로 단어장을 고른다. 고1은 고교기본, 고2·고3은 수능, 그 밖에는 중등필수. */
export function vocaBookOf(grade: string): VocaBook {
  // 🔴 gradeKey 를 거쳐야 '고1-2'·'공통수학2'·'대수' 로 저장된 고등학생이 중등 단어장으로
  //    떨어지지 않는다 (실측 2026-08-21: 거치지 않으면 그렇게 떨어졌다).
  const gk = gradeKey(grade)
  if (gk === '고1') return GOGYO
  if (gk.startsWith('고')) return SUNEUNG
  return MID
}


/** 채점용 정규화 — 대소문자·양끝 공백·연속 공백·마침표만 맞춘다(철자는 그대로 본다). */
export function normWord(s: string): string {
  // 둥근 따옴표(’)는 키보드의 ' 로 맞춘다 — 블랙 'come to one’s senses' 실측
  return s.trim().toLowerCase().replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ').replace(/[.]+$/, '')
}

/**
 * 한 단어가 인정하는 정답들.
 * 🔴 원본에 `blond / blonde`, `until/till` 처럼 **철자가 둘인 항목**이 있다(실측 2건).
 *    통째로만 비교하면 학생이 `blond` 라고 맞게 써도 오답이 된다 → 갈라서 모두 인정한다.
 *    `look forward to (v-ing)` 같은 항목은 괄호를 뺀 형태도 인정한다.
 */
export function acceptedAnswers(word: string): string[] {
  const out = new Set<string>()
  const add = (s: string) => { const n = normWord(s); if (n) out.add(n) }
  add(word)
  for (const part of word.split(/\s*[/,]\s*|\s+or\s+/)) add(part)
  // 괄호 안은 선택 — 있어도 없어도 인정
  add(word.replace(/\([^)]*\)/g, ' '))
  // 🔴 괄호가 낱말에 **붙은** 접미사형(biotech(nology)·wage(s)·botanic(al)·afterward(s))은
  //    괄호만 떼고 **붙여 쓴 꼴**도 인정해야 한다. 위 줄은 괄호 안을 지운 꼴(biotech)만 만들어서
  //    학생이 biotechnology·wages 라고 맞게 써도 오답이었다(2026-09-13 실측, 단어장 7개 항목).
  add(word.replace(/\(([^)]*)\)/g, '$1'))
  // get[be] used to → get / be 두 갈래
  const br = /^(.*?)\[([^\]]+)\](.*)$/.exec(word)
  if (br) { add(`${br[1]}${br[3]}`); add(`${br[2]}${br[3]}`) }
  return [...out]
}

export function isCorrect(word: string, typed: string): boolean {
  const t = normWord(typed)
  if (!t) return false
  // 🔴 띄어쓰기·하이픈 차이는 봐준다 — 원본부터 'rightangle'·'comearound' 처럼 붙어 있거나
  //    well-being/wellbeing 처럼 표기가 갈리는 항목이 있어, 철자를 알아도 오답이 됐다(2026-09-14).
  const loose = (x: string) => x.replace(/[\s-]+/g, '')
  return acceptedAnswers(word).some(a => a === t || loose(a) === loose(t))
}

/** 오늘 볼 DAY — 이 학생이 이미 본 가장 큰 DAY 다음. 없으면 1. */
export function nextDay(doneDays: number[], lastDay = 40): number {
  const max = doneDays.length ? Math.max(...doneDays) : 0
  return Math.min(lastDay, Math.max(1, max + 1))
}


// ═══════════════════════════════════════════════════════════════════════════════
// 🎚️ 학생별 단어장 · 하루 분량 · 시험 종류  (2026-09-14 명수쌤)
//
//   "하루분량은 선택하게 해주고 2번(중등필수 책)도 선택하게 해주고 3번(뜻시험)도 해주고"
//   · 학년 대신 **영단어 수준진단 테스트** 결과로 책을 정한다 → 선생님이 학생마다 고른다.
//   · 🔴 하루 분량을 고르게 하면 'DAY' 번호가 흔들린다(25개씩 보다 40개로 바꾸면 번호가 어긋난다).
//     그래서 진도를 **몇 번째 단어까지 했는가**로 센다. 분량·책을 바꿔도 마지막 단어 다음부터 잇는다.
//   · 저장 규약
//       예전 기록: itemId `voca-<DAY>-<i>` · pageFrom = DAY       → 단어 번호로 환산해 보여 준다
//       새 기록  : itemId `vw-<번호>`(단어시험) · `vm-<번호>`(뜻시험) · pageFrom~pageTo = 단어 번호(1부터)
//     같은 날 같은 범위를 두 시험으로 보면 **채점 기록 하나**에 결과를 합친다.
// ═══════════════════════════════════════════════════════════════════════════════

const START: VocaBook = { key: 'start', name: '천일문 중등스타트', file: 'voca-cheonilmun-start.json', days: 40 }
const MID2: VocaBook = { key: 'mid2', name: '어휘끝 중학필수', file: 'voca-eohwikkeut-mid.json', days: 40 }
const BLACK: VocaBook = { key: 'black', name: '어휘끝 블랙', file: 'voca-eohwikkeut-black.json', days: 35 }

/** 쉬운 책 → 어려운 책. 단계 이름은 영단어 수준진단 테스트의 PART 와 같다. */
export const VOCA_BOOKS: readonly { book: VocaBook; level: string }[] = [
  { book: START, level: '1단계 · 중등 기초' },
  { book: MID2, level: '2단계 · 중등 필수' },
  { book: MID, level: '2단계 · 중등 필수' },
  { book: GOGYO, level: '3단계 · 고교 기본' },
  { book: SUNEUNG, level: '4단계 · 수능' },
  { book: BLACK, level: '5단계 · 수능 심화' },
]
export const PER_DAY_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 50] as const
export const DEFAULT_PER_DAY = 25
export type VocaMode = 'word' | 'meaning'
export const MODE_LABEL: Record<VocaMode, string> = { word: '단어시험 (뜻 → 영어)', meaning: '뜻시험 (영어 → 뜻)' }

export interface VocaSettings { book: VocaBook; perDay: number; modes: VocaMode[]; custom: boolean }

/** 학생 설정 → 실제로 쓸 값. 비어 있으면 예전 동작(학년별 책 · 25개 · 단어시험)과 같다. */
export function vocaSettingsOf(st: Pick<Student, 'grade' | 'voca'>): VocaSettings {
  const v = st.voca ?? {}
  const book = VOCA_BOOKS.find(b => b.book.key === v.book)?.book ?? vocaBookOf(st.grade)
  const perDay = v.perDay && v.perDay > 0 ? Math.round(v.perDay) : DEFAULT_PER_DAY
  const modes: VocaMode[] = v.modes && v.modes.length ? [...v.modes] : ['word']
  return { book, perDay, modes, custom: !!(v.book || v.perDay || (v.modes && v.modes.length)) }
}
export function vocaLevelOf(book: VocaBook): string { return VOCA_BOOKS.find(b => b.book.key === book.key)?.level ?? '' }
/** 채점 기록의 교재가 단어장인가 — 교재 진도·쪽수 표시에서 단어장을 가려낼 때 쓴다 */
export function isVocaWorkbookName(name: string | undefined): boolean { return !!name && VOCA_BOOKS.some(b => b.book.name === name) }
export function vocaWorkbookOf(workbooks: Workbook[], studentId: string, book: VocaBook): Workbook | undefined {
  return workbooks.find(w => w.studentId === studentId && w.name === book.name)
}

// ── 책 전체를 한 줄로 편다 (단어 번호 = 1부터) ─────────────────────────────────
export interface VocaWordAt { no: number; w: string; mean: string; ch: string }
export interface VocaFlat { words: VocaWordAt[]; dayStart: Record<string, number> }
const flatCache = new Map<string, VocaFlat>()
export function flattenVoca(file: string, all: Record<string, [string, string][]>): VocaFlat {
  const hit = flatCache.get(file)
  if (hit) return hit
  const keys = Object.keys(all).sort((a, b) => Number(a) - Number(b))
  const words: VocaWordAt[] = []
  const dayStart: Record<string, number> = {}
  for (const k of keys) {
    dayStart[k] = words.length
    for (const [w, mean] of all[k]) words.push({ no: words.length + 1, w, mean, ch: k })
  }
  const out = { words, dayStart }
  flatCache.set(file, out)
  return out
}

// ── 채점 기록 → 범위별 시험 결과 ──────────────────────────────────────────────
export interface VocaModeResult { right: number; total: number; careless: number; self: number; items: { no: number; r: GradeResult }[] }
export interface VocaSession {
  gradingId: string; date: string; from: number; to: number
  legacyDay?: number                 // 예전 DAY 방식 기록이면 그 DAY
  word?: VocaModeResult; meaning?: VocaModeResult
}
function summarize(items: { no: number; r: GradeResult }[]): VocaModeResult | undefined {
  if (!items.length) return undefined
  return {
    right: items.filter(x => x.r.correct).length, total: items.length,
    careless: items.filter(x => x.r.careless).length, self: items.filter(x => x.r.self).length, items,
  }
}
export function vocaSessions(gradings: Grading[], workbookId: string | undefined, flat: VocaFlat): VocaSession[] {
  if (!workbookId) return []
  const out: VocaSession[] = []
  for (const g of gradings) {
    if (g.workbookId !== workbookId || g.pageFrom == null) continue
    if (g.results.some(r => r.itemId?.startsWith('voca-'))) {
      const day = g.pageFrom
      const start = flat.dayStart[String(day)] ?? 0
      const items = g.results.map((r, i) => {
        const m = /^voca-\d+-(\d+)$/.exec(r.itemId ?? '')
        return { no: start + 1 + (m ? Number(m[1]) : i), r }
      })
      out.push({ gradingId: g.id, date: g.date, from: start + 1, to: start + g.results.length, legacyDay: day, word: summarize(items) })
      continue
    }
    const pick = (pre: string) => g.results.filter(r => r.itemId?.startsWith(pre))
      .map(r => ({ no: Number((r.itemId ?? '').slice(pre.length)), r })).sort((a, b) => a.no - b.no)
    out.push({
      gradingId: g.id, date: g.date, from: g.pageFrom, to: g.pageTo ?? g.pageFrom,
      word: summarize(pick('vw-')), meaning: summarize(pick('vm-')),
    })
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.from - a.from)
}

// ── 오늘 볼 범위 ─────────────────────────────────────────────────────────────
export interface VocaPlan {
  from: number; to: number
  pending: VocaMode[]          // 이 범위에서 아직 안 본 시험
  doneToday: boolean           // 오늘 설정한 시험을 다 끝냈다 (from~to 는 '다음 범위')
  finished: boolean            // 책을 끝까지 다 봤다
  todaySession?: VocaSession
}
export function nextWordNo(sessions: VocaSession[]): number {
  return sessions.reduce((m, s) => Math.max(m, s.to), 0) + 1
}
/**
 * 오늘 할 일.
 * · 오늘 시작한 범위에서 설정한 시험이 남았으면 → 그 범위의 남은 시험
 * · 아니면 → 지금까지 본 마지막 단어 다음부터 하루 분량
 * 🔴 진도는 '어떤 시험이든 한 번 본 범위'까지로 센다. 설정을 나중에 '단어+뜻'으로 바꿨다고
 *    예전에 단어시험만 본 범위들이 미완료로 되살아나 진도가 막히면 안 되기 때문이다.
 */
export function planVoca(settings: VocaSettings, sessions: VocaSession[], total: number, today: string): VocaPlan {
  const ts = sessions.filter(s => dateKey(s.date) === today).sort((a, b) => b.from - a.from)[0]
  if (ts) {
    const pending = settings.modes.filter(m => !ts[m])
    if (pending.length) return { from: ts.from, to: ts.to, pending, doneToday: false, finished: false, todaySession: ts }
  }
  const from = nextWordNo(sessions)
  if (from > total) return { from: total + 1, to: total, pending: [], doneToday: !!ts, finished: true, todaySession: ts }
  return { from, to: Math.min(total, from + settings.perDay - 1), pending: [...settings.modes], doneToday: !!ts, finished: false, todaySession: ts }
}

// ── 뜻시험 채점 ───────────────────────────────────────────────────────────────
const normKo = (s: string) => s.replace(/\([^)]*\)/g, '').replace(/[~∼.·\s'"]/g, '').trim()
/**
 * 책에 적힌 뜻을 **인정할 답들**로 가른다.
 *   "[명] 1. 외모, (겉)모습 2. 출현, 등장" → 외모 · 겉모습 · 모습 · 출현 · 등장
 *   "사용[적용]할 수 없는"                  → 사용할수없는 · 적용할수없는
 * 🔴 뜻은 여러 개가 한 칸에 들어 있어 통째로 비교하면 학생이 무엇을 써도 틀린다.
 */
export function meaningSenses(mean: string): string[] {
  const base = mean.replace(/\[(명|형|동|부|전|접|대|감|조|숙)\]/g, ' ').replace(/\(=[^)]*\)/g, ' ')
  const out = new Set<string>()
  for (const part of base.split(/\s*\d+\.\s*|[;,/]/)) {
    const t = part.trim()
    if (!t) continue
    const variants = [t]
    const br = /(\S*)\[([^\]]+)\](.*)$/.exec(t)                   // 사용[적용]할 → 사용할 / 적용할
    if (br) variants.splice(0, 1, t.replace(/\[[^\]]*\]/g, ''), t.slice(0, br.index) + br[2] + br[3])
    for (const v of variants) {
      const a = normKo(v); if (a) out.add(a)                                    // 괄호 안 지운 꼴
      const b = v.replace(/[()]/g, '').replace(/[~∼.·\s'"]/g, ''); if (b) out.add(b)   // 괄호만 뗀 꼴
    }
  }
  return [...out]
}
export function isMeaningCorrect(mean: string, typed: string): boolean {
  const t = typed.replace(/[()]/g, '').replace(/[~∼.·\s'"]/g, '').trim()
  if (!t) return false
  const t2 = normKo(typed)
  return meaningSenses(mean).some(s => s === t || s === t2)
}

// ── 저장 도우미 ───────────────────────────────────────────────────────────────
export function vocaItemId(mode: VocaMode, no: number): string { return `${mode === 'word' ? 'vw' : 'vm'}-${no}` }
/** 같은 범위 기록에 다른 시험 결과를 합친다 — 같은 시험을 다시 보면 그 시험 결과만 바꾼다 */
export function mergeVocaResults(prev: GradeResult[], mode: VocaMode, next: GradeResult[]): GradeResult[] {
  const pre = mode === 'word' ? 'vw-' : 'vm-'
  return [...prev.filter(r => !r.itemId?.startsWith(pre) && !r.itemId?.startsWith('voca-')), ...next]
}
/** 쪽수 대신 보여 줄 범위 이름 — 예전 기록은 'DAY 5', 새 기록은 '151~180번 단어' */
export function vocaRangeLabel(g: Pick<Grading, 'pageFrom' | 'pageTo' | 'results'>): string {
  if (g.results.some(r => r.itemId?.startsWith('voca-'))) return `DAY ${g.pageFrom}`
  return `${g.pageFrom}~${g.pageTo ?? g.pageFrom}번 단어`
}

/** 종이 단어장·시험지용 — 학생 설정과 기록으로 '오늘 볼 범위'의 단어를 꺼낸다(오늘 다 봤으면 다음 범위) */
export async function vocaPlanFor(st: Student, gradings: Grading[], workbooks: Workbook[], today: string) {
  const settings = vocaSettingsOf(st)
  const all = await loadVoca(settings.book.file)
  const flat = flattenVoca(settings.book.file, all)
  const wb = vocaWorkbookOf(workbooks, st.id, settings.book)
  const sessions = vocaSessions(gradings.filter(g => g.studentId === st.id), wb?.id, flat)
  const plan = planVoca(settings, sessions, flat.words.length, today)
  return { settings, plan, total: flat.words.length, words: plan.finished ? [] : flat.words.slice(plan.from - 1, plan.to) }
}

/** 이 채점 기록이 영단어 시험인가 — 쪽수 대신 단어 범위로 보여 줄 때 쓴다 */
export function isVocaGrading(g: Pick<Grading, 'results'>): boolean {
  return g.results.some(r => /^(vw|vm|voca)-/.test(r.itemId ?? ''))
}
