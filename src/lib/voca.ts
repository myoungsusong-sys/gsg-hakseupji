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
