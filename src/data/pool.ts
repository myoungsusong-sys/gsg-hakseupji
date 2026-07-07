import type { Problem } from '../types'

// 매쓰플랫 문제 풀 — 과정별 정적 파일(/pool-<course>.json) 지연 로드
// 형식: { "mf<pid>": [pid, hash, conceptId, level(1~5), isChoice(0/1), answer, trendy(0/1)] }
// 20만+ 문제를 Supabase에 두지 않고 CDN 정적 파일로 제공 (앱 시작 가볍게, 과정별 필요 시 로드)

export const POOL_COURSES = [
  'm1-1', 'm1-2', 'm2-1', 'm2-2', 'm3-1', 'm3-2',
  'h-cm1', 'h-cm2', 'h-alg', 'h-calc1', 'h-stat', 'h-calc2', 'h-geo',
] as const

// [pid, hash, conceptId, level, isChoice, answer, trendy, videoHash?] — videoHash 있으면 풀이영상(HLS) 연결
type Raw = [number, string, string | number, number, number, string, number, (string | 0)?]

const CIRCLED = ['①', '②', '③', '④', '⑤']
function choiceAnswer(a: string): string {
  return a.split(',').map(s => {
    const n = Number(s.trim())
    return n >= 1 && n <= 5 ? CIRCLED[n - 1] : s.trim()
  }).join(',')
}

function toProblem(id: string, r: Raw): Problem {
  const [pid, hash, cid, level, isC, ans] = r
  const base = `https://freewheelin-contents.mathflat.com/problem/${pid}/${hash}`
  // 답이 이미지로만 제공되는 문항(수집값 '.'·빈값·'풀이참조') → answer.png (같은 해시)
  const broken = !ans || ['.', '-', '풀이참조'].includes(ans.trim())
  const answer = broken ? `${base}/answer.png` : (isC ? choiceAnswer(ans) : ans)
  return {
    id,
    typeId: String(cid),
    kind: isC ? '객관식' : '주관식',
    diff: (level >= 1 && level <= 5 ? level : 3) as Problem['diff'],
    body: '',
    answer,
    solution: `${base}/solution.png`,
    source: '매쓰플랫',
    isNew: !!r[6],
    imageUrl: `${base}/problem.png`,
    ...(typeof r[7] === 'string' && r[7] ? {
      videoUrl: `https://video.mathflat.com/problem/${pid}/${r[7]}/video.m3u8`,
      subtitleUrl: `https://video.mathflat.com/problem/${pid}/${r[7]}/subtitle.vtt`,
    } : {}),
  }
}

const cache = new Map<string, Problem[]>()
const inflight = new Map<string, Promise<Problem[]>>()

export function loadPool(course: string): Promise<Problem[]> {
  if (!POOL_COURSES.includes(course as typeof POOL_COURSES[number])) return Promise.resolve([])
  const hit = cache.get(course)
  if (hit) return Promise.resolve(hit)
  let p = inflight.get(course)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}pool-${course}.json`)
      .then(r => { if (!r.ok) throw new Error('pool ' + course + ' ' + r.status); return r.json() })
      .then((d: Record<string, Raw>) => {
        // 키 정규화: 'mf' 접두 통일 (기존 학습지 problemIds가 mf<pid> 형식)
        const arr = Object.entries(d).map(([k, r]) => toProblem(k.startsWith('mf') ? k : 'mf' + k, r))
        cache.set(course, arr)
        return arr
      })
      .catch(err => { inflight.delete(course); console.warn('pool', course, String(err).slice(0, 80)); return [] })
    inflight.set(course, p)
  }
  return p
}
