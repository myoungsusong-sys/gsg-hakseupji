// ── 교재·인강 정보 자동 조회 ─────────────────────────────────────
// 교재: Google Books API(키 불필요, 공용 쿼터)로 총 페이지수·표지·출판사 조회.
// 인강: 공개 API가 없어 내장 강좌표 사용(강좌명·총 강수·1강 러닝타임). 없으면 직접 입력.
// 조회값은 "제안"이고 화면에서 수정 가능하다 — 시험 직결 자료라 확정은 사람이 한다.

export interface BookInfo {
  title: string
  publisher?: string
  pageCount?: number
  cover?: string
  source: 'google' | 'manual'
}

export async function searchBook(query: string): Promise<BookInfo[]> {
  const q = query.trim()
  if (!q) return []
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&country=KR&maxResults=8&langRestrict=ko`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`책 정보를 불러오지 못했습니다 (${r.status})`)
  const d = await r.json()
  return (d.items ?? []).map((it: any): BookInfo => ({
    title: it.volumeInfo?.title ?? '',
    publisher: it.volumeInfo?.publisher,
    pageCount: it.volumeInfo?.pageCount,
    cover: it.volumeInfo?.imageLinks?.thumbnail?.replace('http://', 'https://'),
    source: 'google',
  })).filter((b: BookInfo) => b.title)
}

// 내장 인강 강좌표 — 명수쌤 학원에서 실제로 쓰는 강좌 위주. 필요할 때 계속 추가한다.
export interface LectureInfo {
  site: string
  teacher: string
  course: string
  subject: string
  units: number        // 총 강 수
  minutesPerUnit: number   // 1강 평균 러닝타임(분)
}

export const LECTURE_DB: LectureInfo[] = [
  { site: '메가스터디', teacher: '현우진', course: '뉴런 수학1', subject: '수학', units: 100, minutesPerUnit: 55 },
  { site: '메가스터디', teacher: '현우진', course: '시냅스', subject: '수학', units: 80, minutesPerUnit: 50 },
  { site: '메가스터디', teacher: '정승제', course: '개념 수학(상)', subject: '수학', units: 90, minutesPerUnit: 45 },
  { site: '메가스터디', teacher: '김동욱', course: '기출 분석 국어', subject: '국어', units: 60, minutesPerUnit: 60 },
  { site: '메가스터디', teacher: '조정식', course: '조정식 영어 개념', subject: '영어', units: 70, minutesPerUnit: 50 },
  { site: '메가스터디', teacher: '배기범', course: '필수본 물리학', subject: '과학', units: 80, minutesPerUnit: 55 },
  { site: '엠베스트', teacher: '-', course: '중등 국어 개념', subject: '국어', units: 40, minutesPerUnit: 40 },
  { site: '엠베스트', teacher: '-', course: '중등 수학 개념', subject: '수학', units: 50, minutesPerUnit: 40 },
  { site: '엠베스트', teacher: '-', course: '중등 과학 개념', subject: '과학', units: 45, minutesPerUnit: 40 },
  { site: '엠베스트', teacher: '-', course: '중등 역사', subject: '사회', units: 40, minutesPerUnit: 40 },
  { site: '대성마이맥', teacher: '-', course: '세젤쉬 대수', subject: '수학', units: 60, minutesPerUnit: 50 },
  { site: '완자', teacher: '박지향', course: '완자 생명과학', subject: '과학', units: 50, minutesPerUnit: 45 },
  { site: 'EBS', teacher: '-', course: '수능특강', subject: '기타', units: 30, minutesPerUnit: 50 },
]

export function searchLecture(query: string): LectureInfo[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return LECTURE_DB.filter(l =>
    l.teacher.toLowerCase().includes(q) || l.course.toLowerCase().includes(q) ||
    l.site.toLowerCase().includes(q) || l.subject.includes(q))
}

// ── 분량 자동 분배 ───────────────────────────────────────────────
// 총량(쪽/강)과 기간·주당 횟수를 주면 회차별 분량을 나눈다. 남는 분량은 앞쪽 회차에 1씩 더 얹는다.
export interface SplitSession { no: number; from: number; to: number }
export function splitAmount(total: number, sessions: number, startAt = 1): SplitSession[] {
  if (total <= 0 || sessions <= 0) return []
  const base = Math.floor(total / sessions)
  let rest = total - base * sessions
  const out: SplitSession[] = []
  let cur = startAt
  for (let i = 0; i < sessions; i++) {
    const n = base + (rest > 0 ? 1 : 0)
    if (rest > 0) rest--
    if (n <= 0) continue
    out.push({ no: i + 1, from: cur, to: cur + n - 1 })
    cur += n
  }
  return out
}

// 기간(주) × 주당 횟수 → 총 회차
export function sessionCount(startDate: string, endDate: string, perWeek: number): number {
  const s = new Date(startDate + 'T00:00:00'), e = new Date(endDate + 'T00:00:00')
  const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1)
  return Math.max(1, Math.round((days / 7) * perWeek))
}
