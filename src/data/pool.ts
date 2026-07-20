import type { Problem } from '../types'

// 매쓰플랫 문제 풀 — 과정별 정적 파일(/pool-<course>.json) 지연 로드
// 형식: { "mf<pid>": [pid, hash, conceptId, level(1~5), isChoice(0/1), answer, trendy(0/1)] }
// 20만+ 문제를 Supabase에 두지 않고 CDN 정적 파일로 제공 (앱 시작 가볍게, 과정별 필요 시 로드)

export const POOL_COURSES = [
  'e1-1', 'e1-2', 'e2-1', 'e2-2', 'e3-1', 'e3-2', 'e4-1', 'e4-2', 'e5-1', 'e5-2', 'e6-1', 'e6-2',
  'm1-1', 'm1-2', 'm2-1', 'm2-2', 'm3-1', 'm3-2', 'm3-2-2015',
  'h-cm1', 'h-cm2', 'h-alg', 'h-calc1', 'h-stat', 'h-calc2', 'h-geo',
  // 사이언스플랫 과학 — 매쓰플랫형 Raw 문제은행(정답 포함, 자동채점). 이미지 CDN만 다름(SCI_POOL_COURSES)
  'm-sci1-1', 'm-sci2-1', 'h-int1',
] as const

// 사이언스플랫 문제은행을 쓰는 과학 과정 — 이미지 CDN이 scienceflat-contents.scienceflat.com (매쓰플랫과 다름)
export const SCI_POOL_COURSES: readonly string[] = ['m-sci1-1', 'm-sci2-1', 'h-int1']

// 완자(이미지 기반) 문제 풀이 있는 과학 과정 — pool-<course>.json 형식이 다름(아래 WanjaRaw)
export const WANJA_COURSES = ['h-earth', 'h-phy', 'h-chem', 'h-bio', 'h-int2', 'm-sci3-2', 'm-sci2-2', 'm-sci1-2'] as const
// [imageRelPath, typeId, diff(1~5), isChoice(0/1), answer, solutionRelPath?]
//  — 완자 교재 크롭 문항. solution은 정답친해 원본 페이지 이미지(정답·해설, 오류 위험 0)
type WanjaRaw = [string, string, number, number, string, (string | 0)?]

function toWanjaProblem(id: string, r: WanjaRaw): Problem {
  const [img, tid, diff, isC, ans, sol] = r
  return {
    id, typeId: tid, kind: isC ? '객관식' : '주관식',
    diff: (diff >= 1 && diff <= 5 ? diff : 3) as Problem['diff'],
    body: '', answer: ans || '', source: '완자',
    imageUrl: `${import.meta.env.BASE_URL}${img}`,
    solution: typeof sol === 'string' && sol ? `${import.meta.env.BASE_URL}${sol}` : '',
  }
}

// [pid, hash, conceptId, level, isChoice, answer, trendy, videoHash?] — videoHash 있으면 풀이영상(HLS) 연결
type Raw = [number, string, string | number, number, number, string, number, (string | 0)?]

const CIRCLED = ['①', '②', '③', '④', '⑤']
function choiceAnswer(a: string): string {
  return a.split(',').map(s => {
    const n = Number(s.trim())
    return n >= 1 && n <= 5 ? CIRCLED[n - 1] : s.trim()
  }).join(',')
}

function toProblem(id: string, r: Raw, host = 'freewheelin-contents.mathflat.com'): Problem {
  const [pid, hash, cid, level, isC, ans] = r
  const base = `https://${host}/problem/${pid}/${hash}`
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
    source: '기본 제공',
    isNew: !!r[6],
    imageUrl: `${base}/problem.png`,
    ...(typeof r[7] === 'string' && r[7] ? (() => {
      // v[7] = "hash"(구: 영상pid=문제pid) 또는 "영상pid/hash"(신: 별도 영상 번호)
      const [vpid, vhash] = r[7].includes('/') ? r[7].split('/') : [String(pid), r[7]]
      const vbase = `https://video.mathflat.com/problem/${vpid}/${vhash}`
      return { videoUrl: `${vbase}/video.m3u8`, subtitleUrl: `${vbase}/subtitle.vtt` }
    })() : {}),
  }
}

const cache = new Map<string, Problem[]>()
const inflight = new Map<string, Promise<Problem[]>>()

export function loadPool(course: string): Promise<Problem[]> {
  const isMath = POOL_COURSES.includes(course as typeof POOL_COURSES[number])
  const isWanja = WANJA_COURSES.includes(course as typeof WANJA_COURSES[number])
  if (!isMath && !isWanja) return Promise.resolve([])
  const hit = cache.get(course)
  if (hit) return Promise.resolve(hit)
  let p = inflight.get(course)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}pool-${course}.json`)
      .then(r => { if (!r.ok) throw new Error('pool ' + course + ' ' + r.status); return r.json() })
      .then((d: Record<string, Raw | WanjaRaw>) => {
        const host = SCI_POOL_COURSES.includes(course) ? 'scienceflat-contents.scienceflat.com' : 'freewheelin-contents.mathflat.com'
        const arr = isWanja
          ? Object.entries(d).map(([k, r]) => toWanjaProblem(k, r as WanjaRaw))
          // 키 정규화: 'mf' 접두 통일 (기존 학습지 problemIds가 mf<pid> 형식)
          : Object.entries(d).map(([k, r]) => toProblem(k.startsWith('mf') ? k : 'mf' + k, r as Raw, host))
        cache.set(course, arr)
        return arr
      })
      .catch(err => { inflight.delete(course); console.warn('pool', course, String(err).slice(0, 80)); return [] })
    inflight.set(course, p)
  }
  return p
}
