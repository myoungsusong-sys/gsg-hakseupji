// 개념강의 목록 — 과정별 정적 파일(/lectures-<course>.json) 지연 로드
// 매쓰플랫 /lecture/group 수집(2026-07-14). 영상은 video.mathflat.com/concept/<id>/<hash> HLS(공개)
// 파일 형식: [{ u: 대단원, mids: [{ m: 중단원, lec: [[id, hash, title, seconds], ...] }] }]

export type Lecture = {
  id: number
  title: string           // "[1강] 받아올림이 없는 세 자리 수의 덧셈"
  seconds: number
  videoUrl: string        // m3u8
  thumbnailUrl: string
}
export type LectureChapter = { name: string; lectures: Lecture[] }
export type LectureUnit = { unit: string; chapters: LectureChapter[] }

// 개념강의 영상이 있는 과정(매쓰플랫 기준 — 초1·2, 중3-2(22개정)은 강의 없음)
export const LECTURE_COURSES = [
  'e3-1', 'e3-2', 'e4-1', 'e4-2', 'e5-1', 'e5-2', 'e6-1', 'e6-2',
  'm1-1', 'm1-2', 'm2-1', 'm2-2', 'm3-1', 'm3-2-2015',
  'h-cm1', 'h-cm2', 'h-alg', 'h-calc1', 'h-stat', 'h-calc2', 'h-geo',
] as const

type RawLec = [number, string, string, number]   // [id, hash, title, seconds]
type RawMid = { m: string; lec: RawLec[] }
type RawUnit = { u: string; mids: RawMid[] }

const cache = new Map<string, LectureUnit[]>()
const inflight = new Map<string, Promise<LectureUnit[]>>()

export function hasLectures(course: string): boolean {
  return LECTURE_COURSES.includes(course as typeof LECTURE_COURSES[number])
}

function toLecture(r: RawLec): Lecture {
  const [id, hash, title, seconds] = r
  const base = `https://video.mathflat.com/concept/${id}/${hash}`
  return { id, title, seconds, videoUrl: `${base}/video.m3u8`, thumbnailUrl: `${base}/thumbnail.png` }
}

export function loadLectures(course: string): Promise<LectureUnit[]> {
  if (!hasLectures(course)) return Promise.resolve([])
  const hit = cache.get(course)
  if (hit) return Promise.resolve(hit)
  let p = inflight.get(course)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}lectures-${course}.json`)
      .then(r => { if (!r.ok) throw new Error('lectures ' + course + ' ' + r.status); return r.json() })
      .then((raw: RawUnit[]) => {
        const units: LectureUnit[] = raw.map(u => ({
          unit: u.u,
          chapters: u.mids.map(mc => ({ name: mc.m, lectures: mc.lec.map(toLecture) })),
        }))
        cache.set(course, units)
        return units
      })
      .catch(err => { inflight.delete(course); console.warn('lectures', course, String(err).slice(0, 80)); return [] })
    inflight.set(course, p)
  }
  return p
}
