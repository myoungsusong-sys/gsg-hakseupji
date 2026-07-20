import type { Problem } from '../types'

// 서술형 세트 — 과정별 정적 파일(/essay-<course>.json) 지연 로드
// 매쓰플랫 school-prepare-essay 수집(2026-07-14). 단원별 기본/일반/심화 10문제 세트.
// 파일 형식: [{ title, chapter, level, probs: [[pid, hash, conceptId, level, answer], ...] }]
// answer 가 '.'/빈값이면 정답은 이미지(answer.png) — 매쓰플랫 서술형 정답 처리와 동일

export const ESSAY_COURSES = ['m1-1', 'm1-2', 'm2-1', 'h-cm1', 'h-cm2', 'm3-2-2015'] as const

export type EssaySet = { title: string; chapter: string; level: number; problems: Problem[] }

type RawProb = [number, string, string | number, number, string]
type RawSet = { title: string; chapter: string; level: number; probs: RawProb[] }

export function hasEssay(course: string): boolean {
  return ESSAY_COURSES.includes(course as typeof ESSAY_COURSES[number])
}

function toProblem(r: RawProb): Problem {
  const [pid, hash, cid, level, ans] = r
  const base = `https://freewheelin-contents.mathflat.com/problem/${pid}/${hash}`
  const broken = !ans || ['.', '-', '풀이참조', '해설 참조'].includes(String(ans).trim())
  return {
    // 'mf' 접두는 store 통합 problems에서 pool 전용으로 걸러짐 → 서술형은 'es' 접두로 customProblems에 유지
    id: `es${pid}`,
    typeId: String(cid),
    kind: '주관식',            // 서술형 = 주관식
    diff: (level >= 1 && level <= 5 ? level : 3) as Problem['diff'],
    body: '',
    answer: broken ? `${base}/answer.png` : String(ans),
    solution: `${base}/solution.png`,
    source: '기본 제공',
    imageUrl: `${base}/problem.png`,
  }
}

const cache = new Map<string, EssaySet[]>()
const inflight = new Map<string, Promise<EssaySet[]>>()

export function loadEssay(course: string): Promise<EssaySet[]> {
  if (!hasEssay(course)) return Promise.resolve([])
  const hit = cache.get(course)
  if (hit) return Promise.resolve(hit)
  let p = inflight.get(course)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}essay-${course}.json`)
      .then(r => { if (!r.ok) throw new Error('essay ' + course + ' ' + r.status); return r.json() })
      .then((raw: RawSet[]) => {
        const sets: EssaySet[] = raw.map(s => ({
          title: s.title, chapter: s.chapter, level: s.level,
          problems: s.probs.map(toProblem),
        }))
        cache.set(course, sets)
        return sets
      })
      .catch(err => { inflight.delete(course); console.warn('essay', course, String(err).slice(0, 80)); return [] })
    inflight.set(course, p)
  }
  return p
}

// 난이도 라벨(기본/일반/심화) — 세트 제목 끝의 (기본)/(일반)/(심화), 없으면 level로 추정
export function essayTier(set: EssaySet): '기본' | '일반' | '심화' {
  const m = set.title.match(/\((기본|일반|심화)\)/)
  if (m) return m[1] as '기본' | '일반' | '심화'
  return set.level <= 2 ? '기본' : set.level >= 4 ? '심화' : '일반'
}
