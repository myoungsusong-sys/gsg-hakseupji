import type { Problem } from '../types'

// 매쓰플랫 문제 풀 — 과정별 정적 파일(/pool-<course>.json) 지연 로드
// 형식: { "mf<pid>": [pid, hash, conceptId, level(1~5), isChoice(0/1), answer, trendy(0/1)] }
// 20만+ 문제를 Supabase에 두지 않고 CDN 정적 파일로 제공 (앱 시작 가볍게, 과정별 필요 시 로드)

export const POOL_COURSES = [
  'e1-1', 'e1-2', 'e2-1', 'e2-2', 'e3-1', 'e3-2', 'e4-1', 'e4-2', 'e5-1', 'e5-2', 'e6-1', 'e6-2',
  'm1-1', 'm1-2', 'm2-1', 'm2-2', 'm3-1', 'm3-2', 'm3-2-2015',
  'h-cm1', 'h-cm2', 'h-alg', 'h-calc1', 'h-stat', 'h-calc2', 'h-geo',
  // 15개정 고등 — 2026-08-15 이전에는 풀이 아예 없어서 **채점만 되고 드릴(오답학습지)이 불가**했다.
  // 매쓰플랫 전 과정 수확으로 채웠다. h-hs2(고등수학 하)는 아직 우리 교재 과정이 없어 파일만 둔다.
  'h-hs1', 'h-hs2', 'h-s1', 'h-s2', 'h-calc15',
  // 사이언스플랫 과학 — 매쓰플랫형 Raw 문제은행(정답 포함, 자동채점). 이미지 CDN만 다름(SCI_POOL_COURSES)
  // 2026-08-15: 사이언스플랫 전 과정(중1-1~중3-2 · 통합과학1·2 = 개념 441개) 수확으로 8과정 모두 채움
  'm-sci1-1', 'm-sci1-2', 'm-sci2-1', 'm-sci2-2', 'm-sci3', 'm-sci3-2', 'h-int1', 'h-int2',
] as const

// 사이언스플랫 문제은행을 쓰는 과학 과정 — 이미지 CDN이 scienceflat-contents.scienceflat.com (매쓰플랫과 다름)
// 🔴 여기 빠지면 그 과정의 Raw 문항은 매쓰플랫 CDN 을 보게 돼 **이미지가 전부 깨진다.**
//    완자 문항은 BASE_URL 상대경로라 이 목록과 무관하다 — 한 파일에 둘이 섞여 있어도 안전하다.
export const SCI_POOL_COURSES: readonly string[] = [
  'm-sci1-1', 'm-sci1-2', 'm-sci2-1', 'm-sci2-2', 'm-sci3', 'm-sci3-2', 'h-int1', 'h-int2',
]

// 완자(이미지 기반) 문제 풀이 있는 과학 과정 — pool-<course>.json 형식이 다름(아래 WanjaRaw)
// (사이언스플랫 Raw 와 같은 파일에 섞여 있다. 로더가 행 단위로 첫 필드 타입을 보고 가른다)
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
  // 🔴 '해설 참조' 를 빠뜨리면 그 문항은 자동채점을 타서 **학생이 뭘 써도 오답**이 된다.
  //    전수 실측 2,857건이 이 상태였다 (2026-08-13 발견). essay.ts:22 와 목록을 맞춰 둔다.
  const broken = !ans || ['.', '-', '풀이참조', '해설 참조', '해설참조'].includes(ans.trim())
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
        // 한 과정에 두 포맷이 섞일 수 있다(예: 중1-1 = 사이언스플랫 + 오투 편입분).
        // 판별: WanjaRaw[0]은 이미지 상대경로(문자열), Raw[0]은 매쓰플랫 pid(숫자).
        const arr = Object.entries(d).map(([k, r]) =>
          typeof r[0] === 'string'
            ? toWanjaProblem(k, r as WanjaRaw)
            // 키 정규화: 'mf' 접두 통일 (기존 학습지 problemIds가 mf<pid> 형식)
            : toProblem(k.startsWith('mf') ? k : 'mf' + k, r as Raw, host))
        return arr
      })
      .catch(err => { inflight.delete(course); console.warn('pool', course, String(err).slice(0, 80)); return [] as Problem[] })
      // 🆕 자체 생성 문항 — public/gen-<course>.json (Problem 객체 배열, custom:true). 없으면(404) 조용히 넘어간다.
      //    2026-09-04: 유형마다 새로 지은 문제(정답을 독립 풀이자 2명이 교차검증한 것만)를 여기로 넣는다.
      //    문항 권리가 우리 것이라 어디에 내놔도 되는 풀이다.
      .then(async arr => {
        try {
          const g = await fetch(`${import.meta.env.BASE_URL}gen-${course}.json`)
          if (g.ok) {
            const gen = (await g.json()) as Problem[]
            const seen = new Set(arr.map(p => p.id))
            for (const q of gen) if (q && q.id && !seen.has(q.id)) arr.push({ ...q, custom: true, source: q.source || '자체 생성' })
          }
        } catch { /* 생성 파일이 없거나 깨져도 기본 풀은 그대로 */ }
        cache.set(course, arr)
        return arr
      })
    inflight.set(course, p)
  }
  return p
}
