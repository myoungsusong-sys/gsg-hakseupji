// 🏫 학교 → 국어·영어 교과서 (2026-10-28 명수쌤 «해당 학교를 입력하면 출판사 맞게 선택하게 해줘»)
//    학생 「학교」 칸만 있으면 표(schoolBooksSeed.ts)에서 그 학교·학년 교과서를 찾아 국어·영어 과정을 그 교과서로 고른다.
//    선생님이 학생 정보에 국어·영어 교과서(korBook·engBook)를 직접 적었으면 그게 먼저다.
//    🔴 표의 괄호 글자는 저자 «성»만이 아니다 — «천재(수)» = 천재·김수학. 그래서 저자 이름에 «들어 있는지»로 본다.
import { CURRICULA, type Curriculum } from './curriculum'
import { SCHOOL_BOOK_SEED } from './schoolBooksSeed'

const ALIAS: Record<string, string> = { 홍성여중: '홍여중', 홍성삼육고: '삼육고', 홍성삼육중: '삼육중' }

/** 명부 학교 이름 → 표 이름 («당진고등학교» → «당진고», «홍성여자중학교» → «홍여중») */
export function schoolKey(name?: string): string {
  const s = (name ?? '').normalize('NFC').replace(/\s/g, '')
    .replace(/여자고등학교$/, '여고').replace(/여자중학교$/, '여중').replace(/고등학교$/, '고').replace(/중학교$/, '중')
  return ALIAS[s] ?? s
}

/** «고1»·«중2-1»·«중학교 2학년» → «고1»·«중2» */
const gradeKey = (g?: string): string => {
  const m = /^([중고])(\d)/.exec(g ?? '') ?? /^(중|고)\S*\s*(\d)학년/.exec(g ?? '')
  return m ? m[1] + m[2] : ''
}

const pubNorm = (p: string) => p.replace(/^NE/, '').trim()

/** 표 값 → [출판사, 저자 글자] 목록 («1(능률 오)\n2(천재)» 는 둘 다) */
function parseRaw(raw: string): [string, string][] {
  return raw.split(/[\n/|]/).map((x) => x.trim().replace(/^\d\((.*)\)$/, '$1')).filter(Boolean).map((x) => {
    const m = /^([^(\s]+)\s*(?:\(([^)]*)\)|\s+(\S+))?$/.exec(x)
    return m ? [pubNorm(m[1]), (m[2] ?? m[3] ?? '').trim()] : [pubNorm(x), '']
  })
}

/** 과정의 교과서 → [출판사, 저자] (교과서 과정은 book «비상(박영민)», 내신 기출은 이름 끝 «(비상·박영민)») */
function bookOf(c: Pick<Curriculum, 'id' | 'label' | 'book'>): [string, string] | null {
  const raw = c.book ?? (c.id.startsWith('ns-') ? /\(([^)]+)\)\s*$/.exec(c.label)?.[1] : undefined)
  const m = raw ? /^([^(·\s]+)[(·]([^)]+)\)?$/.exec(raw) : null
  return m ? [pubNorm(m[1]), m[2].trim()] : null
}

/** 그 과정이 이 학생 학교의 교과서 과정인가 — 국어·영어만(다른 과목은 출판사 구분 과정이 없다) */
export function isSchoolCourse(c: Curriculum, school?: string, grade?: string): boolean {
  if (c.subject !== '국어' && c.subject !== '영어') return false
  const row = SCHOOL_BOOK_SEED[schoolKey(school)]
  const book = row && bookOf(c)
  if (!book) return false
  const g = gradeKey(c.grade) || gradeKey(c.label) || gradeKey(grade)
  let key = `${c.subject}@${g}`
  if (c.subject === '국어' && g.startsWith('고') && g !== '고1') {
    const t = ['문학', '독서와 작문', '화법과 언어'].find((x) => c.label.includes(x))
    if (!t) return false
    key = `국어@고2:${t}`
  }
  const raw = row[key]
  return !!raw && parseRaw(raw).some(([p, a]) => p === book[0] && (!a || book[1].includes(a)))
}

/** 학생 학교·학년의 국어·영어 교과서 이름(«비상(박영민)»·«NE능률(민병천)») — 학생 정보에 안 적었을 때 쓴다 */
export function schoolBookFor(subject: '국어' | '영어', school?: string, grade?: string): string | undefined {
  const g = gradeKey(grade)
  if (!g || !SCHOOL_BOOK_SEED[schoolKey(school)]) return undefined
  return CURRICULA.find((c) => c.subject === subject && c.book && gradeKey(c.grade) === g && isSchoolCourse(c, school, grade))?.book
}
