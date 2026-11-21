// 🔤 영어 문법 개념 — 문항 글(문제·해설)에서 문법 개념을 찾아 붙인다 (2026-11-10 workerE)
//
// 잉글리시플랫의 «문법 성장 리포트»·«오답 추천 학습지(문법)» 는 문항마다 문법 개념(conceptId)이 달려 있다.
// 우리 영어 문항은 유형 트리(독해·어법·어휘·서술형)만 있고 문법 개념 칸이 없다 → AI 호출 없이
// 해설에 적힌 문법 낱말(«관계대명사», «현재완료» …)로 개념을 붙인다. 한 문항에 여러 개념이 붙을 수 있다.
// 🔴 개념 목록 순서 = 리포트에 보이는 순서(교과 진도 순). id 는 저장되지 않으니 바꿔도 기록이 안 깨진다.
import type { Problem } from '../types'

export interface GrammarConcept { id: string; name: string; keys: RegExp }

export const GRAMMAR_CONCEPTS: GrammarConcept[] = [
  { id: 'tense', name: '시제(완료·진행)', keys: /현재\s?완료|과거\s?완료|미래\s?완료|진행\s?형|시제/ },
  { id: 'modal', name: '조동사', keys: /조동사|had better|used to|would rather/ },
  { id: 'passive', name: '수동태', keys: /수동태|능동태/ },
  { id: 'toinf', name: 'to부정사', keys: /to\s?-?부정사|원형\s?부정사|부정사/ },
  { id: 'gerund', name: '동명사', keys: /동명사/ },
  { id: 'participle', name: '분사·분사구문', keys: /분사/ },
  { id: 'relpron', name: '관계대명사', keys: /관계\s?대명사|관계사\s?what|선행사/ },
  { id: 'reladv', name: '관계부사·복합관계사', keys: /관계\s?부사|복합\s?관계/ },
  { id: 'conj', name: '접속사', keys: /접속사|상관\s?접속|명사절|부사절/ },
  { id: 'subj', name: '가정법', keys: /가정법|I wish|as if/ },
  { id: 'compare', name: '비교', keys: /비교급|최상급|원급|비교\s?구문/ },
  { id: 'clause5', name: '문장 형식(사역·지각)', keys: /[1-5]\s?형식|사역\s?동사|지각\s?동사|목적격\s?보어|수여\s?동사/ },
  { id: 'agree', name: '수 일치·화법', keys: /수\s?일치|일치시|단수\s?동사|복수\s?동사|화법|간접\s?의문문/ },
  { id: 'pron', name: '대명사·it 구문', keys: /재귀\s?대명사|부정\s?대명사|가주어|가목적어|강조\s?구문|지시\s?대명사/ },
  { id: 'adj', name: '형용사·부사', keys: /형용사|(?<!관계\s?|복합\s?관계\s?)부사(?!절|적)/ },
  { id: 'invert', name: '도치·생략', keys: /도치|생략/ },
]

const byId = new Map(GRAMMAR_CONCEPTS.map(c => [c.id, c]))
export const grammarName = (id: string) => byId.get(id)?.name ?? id

const cache = new Map<string, string[]>()
/** 이 문항의 문법 개념 id 들 (없으면 []) — 영어 문항만 본다 */
export function grammarOf(p: Problem | undefined): string[] {
  if (!p || !/^(eng-|b-eng|e4u|zb-eng)/.test(p.typeId) && !p.typeId.includes('eng')) return []
  const hit = cache.get(p.id); if (hit) return hit
  const text = `${p.solution ?? ''}\n${p.body ?? ''}`
  const out = GRAMMAR_CONCEPTS.filter(c => c.keys.test(text)).map(c => c.id)
  cache.set(p.id, out)
  return out
}

export interface GrammarStat { id: string; name: string; total: number; wrong: number; prevTotal: number; prevWrong: number }

/**
 * 학생의 영어 채점 결과를 문법 개념별로 모은다. since 앞은 «지난 기간», 뒤는 «이번 기간».
 * 정답률 = (total-wrong)/total. '모름' 은 오답과 같이 센다(다른 리포트와 같은 규칙).
 */
export function grammarStats(results: { problem?: Problem; correct: boolean; date: string }[], since: string): GrammarStat[] {
  const acc = new Map<string, GrammarStat>()
  for (const r of results) {
    for (const id of grammarOf(r.problem)) {
      const s = acc.get(id) ?? { id, name: grammarName(id), total: 0, wrong: 0, prevTotal: 0, prevWrong: 0 }
      if (r.date >= since) { s.total++; if (!r.correct) s.wrong++ } else { s.prevTotal++; if (!r.correct) s.prevWrong++ }
      acc.set(id, s)
    }
  }
  const order = new Map(GRAMMAR_CONCEPTS.map((c, i) => [c.id, i]))
  return [...acc.values()].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
}

export const rate = (total: number, wrong: number) => total ? Math.round((total - wrong) / total * 100) : null

/**
 * 오답 추천 — 약한 문법 개념·약한 유형(독해·교과서) 에서 아직 안 푼 문항을 고른다.
 * weakGrammar: 개념 id 들(약한 순) · weakTypes: 유형 id 들(약한 순) · book: 학생 교과서(있으면 그 교과서 문항 먼저)
 */
export function recommendEng(opts: {
  pool: Problem[]; weakGrammar: string[]; weakTypes: string[]; solved: Set<string>; book?: string; count: number
}): Problem[] {
  const { pool, weakGrammar, weakTypes, solved, book, count } = opts
  const fresh = pool.filter(p => !solved.has(p.id) && !p.noAnswer && !p.selfGrade)
  const bookFirst = (a: Problem, b: Problem) => (book ? Number(b.book === book) - Number(a.book === book) : 0)
  const picked: Problem[] = []; const seen = new Set<string>()
  const take = (list: Problem[], n: number) => {
    for (const p of list) { if (n <= 0 || picked.length >= count) break; if (seen.has(p.id)) continue; seen.add(p.id); picked.push(p); n-- }
  }
  // 문법 개념 몫 2/3, 유형 몫 1/3 — 약한 것부터 고르게 나눠 담는다
  const gShare = weakGrammar.length ? Math.ceil(count * (weakTypes.length ? 2 / 3 : 1)) : 0
  const perG = weakGrammar.length ? Math.max(1, Math.ceil(gShare / weakGrammar.length)) : 0
  for (const g of weakGrammar) take(fresh.filter(p => grammarOf(p).includes(g)).sort(bookFirst), perG)
  const rest = count - picked.length
  const perT = weakTypes.length ? Math.max(1, Math.ceil(rest / weakTypes.length)) : 0
  for (const t of weakTypes) take(fresh.filter(p => p.typeId === t).sort(bookFirst), perT)
  return picked
}
