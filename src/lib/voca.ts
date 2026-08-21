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
export const VOCA_BOOK_HIGH = '완자 VOCA PICK 고등필수'

// 🔴 학년마다 단어장이 다르다 (명수쌤 2026-08-21: "학생이 학년이 다 다른 거 알지?").
//    고등학생에게 중등필수를 내면 시험이 되지 않는다.
//    명수쌤은 **능률VOCA 수능필수**를 고르셨는데, 이 맥에는 그 책의 MP3 180개만 있고
//    단어 목록 파일이 없다(02_영어/능률영단어/). 음성에서 철자를 받아쓰면 정답이 틀어지므로
//    쓰지 않는다 — 어휘리스트(엑셀·PDF)를 받으면 이 표만 바꾸면 된다.
export interface VocaBook { key: string; name: string; file: string }
const MID: VocaBook = { key: 'mid', name: VOCA_BOOK, file: 'voca-cheonilmun-mid.json' }
const HIGH: VocaBook = { key: 'high', name: VOCA_BOOK_HIGH, file: 'voca-wanja-high.json' }

/** 학년으로 단어장을 고른다 — '고'로 시작하면 고등, 그 밖에는 중등. */
export function vocaBookOf(grade: string): VocaBook {
  return /^고/.test((grade ?? '').trim()) ? HIGH : MID
}

/** 채점용 정규화 — 대소문자·양끝 공백·연속 공백·마침표만 맞춘다(철자는 그대로 본다). */
export function normWord(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.]+$/, '')
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
  // get[be] used to → get / be 두 갈래
  const br = /^(.*?)\[([^\]]+)\](.*)$/.exec(word)
  if (br) { add(`${br[1]}${br[3]}`); add(`${br[2]}${br[3]}`) }
  return [...out]
}

export function isCorrect(word: string, typed: string): boolean {
  const t = normWord(typed)
  if (!t) return false
  return acceptedAnswers(word).includes(t)
}

/** 오늘 볼 DAY — 이 학생이 이미 본 가장 큰 DAY 다음. 없으면 1. */
export function nextDay(doneDays: number[], lastDay = 40): number {
  const max = doneDays.length ? Math.max(...doneDays) : 0
  return Math.min(lastDay, Math.max(1, max + 1))
}
