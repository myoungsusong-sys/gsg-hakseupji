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

// 내장 인강 강좌표 — 웹에서 확인한 실제 강좌 데이터.
// ⚠️ 원칙: 확인 못 한 값은 추측해 채우지 않고 undefined로 둔다(잘못된 강의 수는 학습계획을 망친다).
//    화면에서는 "확인 필요"로 표시되고 사용자가 직접 입력한다. 연도·개정에 따라 강좌가 바뀌므로 year를 남긴다.
export interface LectureInfo {
  site: string
  teacher: string
  course: string
  subject: string
  units?: number           // 총 강 수 (미확인이면 undefined)
  minutesPerUnit?: number  // 1강 평균 러닝타임(분) — 대개 비공개
  grade?: string           // 대상 학년
  year?: string            // 기준 연도
  note?: string            // 주의점 (개정·시리즈 구성 등)
}

export const LECTURE_DB: LectureInfo[] = [
  // ── 메가스터디 (megastudy.net) — 2026-07-21 수집. 강좌 상세의 공식 표기 "평균 N분씩, 총 M강".
  //    ⚠️ 시냅스는 독립 강좌가 아니라 뉴런의 복습 교재다(강좌로 등록하지 말 것).
  { site: '메가스터디', teacher: '현우진', course: '2027 현우진의 뉴런 - 수학Ⅰ (공통)', subject: '수학', grade: '고3', units: 46, minutesPerUnit: 53, year: '2027' },
  { site: '메가스터디', teacher: '현우진', course: '2027 현우진의 뉴런 - 수학Ⅱ (공통)', subject: '수학', grade: '고3', units: 52, minutesPerUnit: 57, year: '2027' },
  { site: '메가스터디', teacher: '현우진', course: '2027 현우진의 뉴런 - 확률과 통계 (선택)', subject: '수학', grade: '고3', units: 39, minutesPerUnit: 54, year: '2027' },
  { site: '메가스터디', teacher: '현우진', course: '2027 현우진의 뉴런 - 미적분 (선택)', subject: '수학', grade: '고3', units: 47, minutesPerUnit: 56, year: '2027' },
  { site: '메가스터디', teacher: '현우진', course: '2023 현우진의 뉴런 - 기하 (선택)', subject: '수학', grade: '고3', units: 38, minutesPerUnit: 56, year: '2023' },
  { site: '메가스터디', teacher: '현우진', course: '2027 현우진의 수분감 - 수학I (공통)', subject: '수학', grade: '고3', units: 46, minutesPerUnit: 59, year: '2027' },
  { site: '메가스터디', teacher: '현우진', course: '2027 현우진의 수분감 - 수학II (공통)', subject: '수학', grade: '고3', units: 66, minutesPerUnit: 48, year: '2027' },
  { site: '메가스터디', teacher: '현우진', course: '2027 현우진의 수분감 - 확률과 통계 (선택)', subject: '수학', grade: '고3', units: 31, minutesPerUnit: 57, year: '2027' },
  { site: '메가스터디', teacher: '현우진', course: '2027 현우진의 수분감 - 미적분 (선택)', subject: '수학', grade: '고3', units: 99, minutesPerUnit: 41, year: '2027' },
  { site: '메가스터디', teacher: '현우진', course: '2027 현우진의 드릴 - 수학Ⅰ (공통)', subject: '수학', grade: '고3', units: 11, minutesPerUnit: 64, year: '2027', note: '강수 적고 1강이 김' },
  { site: '메가스터디', teacher: '현우진', course: '2027 현우진의 드릴 - 수학Ⅱ (공통)', subject: '수학', grade: '고3', units: 12, minutesPerUnit: 59, year: '2027' },
  { site: '메가스터디', teacher: '현우진', course: '2027 현우진의 드릴 - 미적분 (선택)', subject: '수학', grade: '고3', units: 9, minutesPerUnit: 56, year: '2027' },
  { site: '메가스터디', teacher: '현우진', course: '현우진의 Drill ZERO 1 - 대수', subject: '수학', grade: '고2', units: 12, minutesPerUnit: 53 },
  { site: '메가스터디', teacher: '현우진', course: '현우진의 Drill ZERO 1 - 미적분Ⅰ', subject: '수학', grade: '고2', units: 11, minutesPerUnit: 61 },
  { site: '메가스터디', teacher: '현우진', course: '현우진의 Drill ZERO 1 - 확률과 통계', subject: '수학', grade: '고2', units: 10, minutesPerUnit: 58 },
  { site: '메가스터디', teacher: '현우진', course: '2027ver. 현우진의 Killing Camp 실전 모의고사 시즌1', subject: '수학', grade: '고3', units: 18, minutesPerUnit: 43, year: '2027' },
  { site: '메가스터디', teacher: '김성은', course: '2027 2등급을 향한 불꽃 N제 〈시즌1〉', subject: '수학', grade: '고3', units: 42, minutesPerUnit: 47, year: '2027' },
  { site: '메가스터디', teacher: '김성은', course: '2027 2등급을 뚫는 불꽃 N제 〈시즌2〉', subject: '수학', grade: '고3', units: 42, minutesPerUnit: 52, year: '2027' },
  { site: '메가스터디', teacher: '김성은', course: '[수학ll] 2027 선별력&강의력 기출 무기백', subject: '수학', grade: '고3', units: 33, minutesPerUnit: 56, year: '2027' },
  { site: '메가스터디', teacher: '김성은', course: '[확률과 통계] 2027 선별력&강의력 기출 무기백', subject: '수학', grade: '고3', units: 23, minutesPerUnit: 60, year: '2027' },
  { site: '메가스터디', teacher: '김성은', course: '[수학l] 2027 시작하는 기출100제', subject: '수학', grade: '고3', units: 14, minutesPerUnit: 59, year: '2027' },
  { site: '메가스터디', teacher: '김성은', course: '[수학ll] 2027 시작하는 기출100제', subject: '수학', grade: '고3', units: 14, minutesPerUnit: 58, year: '2027' },
  { site: '메가스터디', teacher: '강민철', course: '2027 강민철의 기출 분석 [독서]', subject: '국어', grade: '고3', units: 55, minutesPerUnit: 42, year: '2027' },
  { site: '메가스터디', teacher: '강민철', course: '2027 강민철의 기출 분석 [문학]', subject: '국어', grade: '고3', units: 59, minutesPerUnit: 37, year: '2027' },
  { site: '메가스터디', teacher: '강민철', course: '2027 강민철의 기출 분석 [언어와 매체]', subject: '국어', grade: '고3', units: 73, minutesPerUnit: 42, year: '2027' },
  { site: '메가스터디', teacher: '강민철', course: '2027 강민철의 기출 분석 [화법과 작문]', subject: '국어', grade: '고3', units: 23, minutesPerUnit: 48, year: '2027' },
  { site: '메가스터디', teacher: '강민철', course: '2027 새로운 기출 분석 [독서]', subject: '국어', grade: '고3', units: 48, minutesPerUnit: 44, year: '2027' },
  { site: '메가스터디', teacher: '강민철', course: '2027 새로운 기출 분석 [문학]', subject: '국어', grade: '고3', units: 44, minutesPerUnit: 33, year: '2027' },
  { site: '메가스터디', teacher: '강민철', course: '2027 인(in)강민철', subject: '국어', grade: '고3', units: 33, minutesPerUnit: 59, year: '2027' },
  { site: '메가스터디', teacher: '강민철', course: '2027 강민철의 EBS 분석 [수특 문학]', subject: '국어', grade: '고3', units: 78, minutesPerUnit: 30, year: '2027' },
  { site: '메가스터디', teacher: '김동욱', course: '2027 김동욱클래스, 일Class', subject: '국어', grade: '고3', units: 22, minutesPerUnit: 84, year: '2027', note: '1강 평균 84분으로 긺' },
  { site: '메가스터디', teacher: '김동욱', course: '2027 김동욱클래스, 취Class', subject: '국어', grade: '고3', units: 16, minutesPerUnit: 86, year: '2027', note: '1강 평균 86분으로 긺' },
  { site: '메가스터디', teacher: '김동욱', course: '2027 김동욱의 EBS CLASS - 수특편', subject: '국어', grade: '고3', units: 15, minutesPerUnit: 46, year: '2027' },
  { site: '메가스터디', teacher: '김동욱', course: '2027 수능 국어는 김동욱입니다', subject: '국어', grade: '고3', units: 15, minutesPerUnit: 49, year: '2027' },
  { site: '메가스터디', teacher: '김동욱', course: '김동욱의 CHECKMATE_언어와 매체', subject: '국어', grade: '고3', units: 27, minutesPerUnit: 67 },
  { site: '메가스터디', teacher: '조정식', course: '[2027] THE 정식종합영문법', subject: '영어', grade: '고3', units: 72, minutesPerUnit: 28, year: '2027' },
  { site: '메가스터디', teacher: '조정식', course: '[2027] 시작해! 수능 영어의 처음부터', subject: '영어', grade: '고3', units: 31, minutesPerUnit: 37, year: '2027' },
  { site: '메가스터디', teacher: '조정식', course: '[2027] 믿어봐! 문장 읽는 법을 알려줄게', subject: '영어', grade: '고3', units: 30, minutesPerUnit: 34, year: '2027' },
  { site: '메가스터디', teacher: '조정식', course: '[2027] 믿어봐! 글 읽는 법을 알려줄게', subject: '영어', grade: '고3', units: 15, minutesPerUnit: 53, year: '2027' },
  { site: '메가스터디', teacher: '조정식', course: '[2027] 확실해! 이게 맞는 전략이야! - 빈칸편', subject: '영어', grade: '고3', units: 20, minutesPerUnit: 62, year: '2027' },
  { site: '메가스터디', teacher: '조정식', course: '[2027] 확실해! 이게 맞는 전략이야! - 순서/삽입편', subject: '영어', grade: '고3', units: 19, minutesPerUnit: 60, year: '2027' },
  { site: '메가스터디', teacher: '김기철', course: '2027 문장 해석의 원리', subject: '영어', grade: '고3', units: 30, minutesPerUnit: 25, year: '2027' },
  { site: '메가스터디', teacher: '김기철', course: '2027 No Base 문장 해석의 원리', subject: '영어', grade: '고3', units: 30, minutesPerUnit: 15, year: '2027' },
  { site: '메가스터디', teacher: '김기철', course: '2027 문장 해석의 완성', subject: '영어', grade: '고3', units: 18, minutesPerUnit: 40, year: '2027' },
  { site: '메가스터디', teacher: '김기철', course: '2027 기출완성! 지문 이해의 원리', subject: '영어', grade: '고3', units: 21, minutesPerUnit: 51, year: '2027' },
  { site: '메가스터디', teacher: '김기철', course: '2027 문제 접근의 원리 중난도 핵심유형 편', subject: '영어', grade: '고3', units: 12, minutesPerUnit: 50, year: '2027' },
  { site: '메가스터디', teacher: '김기철', course: '2027 문제 접근의 원리 빈순삽 편', subject: '영어', grade: '고3', units: 12, minutesPerUnit: 47, year: '2027' },
  { site: '메가스터디', teacher: '배기범', course: '[물리학I] 일당백 수능 Master', subject: '과학', grade: '고3', units: 47, minutesPerUnit: 38 },
  { site: '메가스터디', teacher: '배기범', course: '[22개정 물리학] FIRST 개념완성', subject: '과학', grade: '고2', units: 60, minutesPerUnit: 44 },
  { site: '메가스터디', teacher: '배기범', course: '[22개정 물리학] FIRST 문제풀이', subject: '과학', grade: '고2', units: 33, minutesPerUnit: 30 },
  { site: '메가스터디', teacher: '배기범', course: '[통합과학] NEW AXIS 개념완성', subject: '과학', grade: '고1', units: 70, minutesPerUnit: 43 },
  { site: '메가스터디', teacher: '백호', course: '[생명과학l] Renewal 섬세한 개념완성 (기본 기출)', subject: '과학', grade: '고3', units: 66, minutesPerUnit: 49 },
  { site: '메가스터디', teacher: '백호', course: '[생명과학l] Renewal 스피드 개념완성 (기본 기출)', subject: '과학', grade: '고3', units: 45, minutesPerUnit: 54 },
  { site: '메가스터디', teacher: '백호', course: '[생명과학l] 상위권을 위한 크리티컬 스킬', subject: '과학', grade: '고3', units: 74, minutesPerUnit: 48, year: '2027' },
  { site: '메가스터디', teacher: '백호', course: '[생명과학l] All Bio in One', subject: '과학', grade: '고3', units: 50, minutesPerUnit: 53, year: '2027' },
  { site: '메가스터디', teacher: '백호', course: '[생명과학ll] 섬세한 개념&스킬 완성 (기출 분석)', subject: '과학', grade: '고3', units: 95, minutesPerUnit: 47 },
  { site: '메가스터디', teacher: '오지훈', course: '[지구과학I] MAGIC 개념완성', subject: '과학', grade: '고3', units: 78, minutesPerUnit: 56 },
  { site: '메가스터디', teacher: '오지훈', course: '[지구과학I] MAGIC SPEED 개념완성', subject: '과학', grade: '고3', units: 38, minutesPerUnit: 62 },
  { site: '메가스터디', teacher: '오지훈', course: '[지구과학I] MAGIC 기출분석', subject: '과학', grade: '고3', units: 51, minutesPerUnit: 52 },
  { site: '메가스터디', teacher: '오지훈', course: '[지구과학I] 유형별 자료 분석 (STEP3)', subject: '과학', grade: '고3', units: 26, minutesPerUnit: 49 },
  { site: '메가스터디', teacher: '오지훈', course: '[지구과학l] MAGIC 실전 문제 (STEP4)', subject: '과학', grade: '고3', units: 35, minutesPerUnit: 48 },
  { site: '메가스터디', teacher: '한종철', course: '[통합과학] 철두철미 완자 통합과학', subject: '과학', grade: '고1', units: 95, minutesPerUnit: 37 },
  { site: '메가스터디', teacher: '한종철', course: '[통합과학1] 철두철미 완자 통합과학1', subject: '과학', grade: '고1', units: 51, minutesPerUnit: 39 },
  { site: '메가스터디', teacher: '한종철', course: '[통합과학2] 철두철미 완자 통합과학2', subject: '과학', grade: '고1', units: 44, minutesPerUnit: 36 },
  { site: '메가스터디', teacher: '한종철', course: '[22개정 생명과학] 철두철미 완자', subject: '과학', grade: '고2', units: 48, minutesPerUnit: 36 },
  { site: '메가스터디', teacher: '고석용', course: '[22개정 화학] 고2를 위한 베테랑의 일반선택 화학 개념완성', subject: '과학', grade: '고2', units: 48, minutesPerUnit: 43 },
  { site: '메가스터디', teacher: '고석용', course: '[통합과학] 베테랑의 통합과학1 개념완성+완자', subject: '과학', grade: '고1', units: 52, minutesPerUnit: 45 },
  { site: '메가스터디', teacher: '고석용', course: '[통합과학] 베테랑의 통합과학2 개념완성+완자', subject: '과학', grade: '고1', units: 46, minutesPerUnit: 40 },
  { site: '메가스터디', teacher: '최적', course: '[정치와법] 2027 SYSTEM 개념완성', subject: '사회', grade: '고3', units: 47, minutesPerUnit: 60, year: '2027' },
  { site: '메가스터디', teacher: '최적', course: '[정치와법] 2027 SYSTEM 개념완성 CORE', subject: '사회', grade: '고3', units: 33, minutesPerUnit: 66, year: '2027' },
  { site: '메가스터디', teacher: '최적', course: '[정치와법] 2027 기출어람', subject: '사회', grade: '고3', units: 20, minutesPerUnit: 64, year: '2027' },
  { site: '메가스터디', teacher: '최적', course: '[통합사회1] 최적 열.끝. 완자', subject: '사회', grade: '고1', units: 22, minutesPerUnit: 51 },
  { site: '메가스터디', teacher: '최적', course: '[통합사회2] 최적 열.끝. 완자', subject: '사회', grade: '고1', units: 33, minutesPerUnit: 53 },
  { site: '메가스터디', teacher: '이다지', course: '[세계사] 이다지도 설레는 세계사 개념완성', subject: '사회', grade: '고3', units: 45, minutesPerUnit: 48 },
  { site: '메가스터디', teacher: '이다지', course: '[동아시아사] 이다지도 설레는 동아시아사 개념완성', subject: '사회', grade: '고3', units: 39, minutesPerUnit: 50 },
  { site: '메가스터디', teacher: '이다지', course: '[통합사회1&2] 이다지도 확실한 통합사회 개념완성 (스튜디오)', subject: '사회', grade: '고1', units: 40, minutesPerUnit: 50 },
  { site: '메가스터디', teacher: '이다지', course: 'NEW [통합사회1&2] 이다지도 확실한 통합사회 개념완성 (현장)', subject: '사회', grade: '고1', units: 41, minutesPerUnit: 51 },

  // ── 대성마이맥 (mimacstudy.com) — 2027학년도판. 매년 강좌명·강수가 전면 개편되므로 연 1회(2~3월) 갱신 필요.
  { site: '대성마이맥', teacher: '김승리', course: '[2027] All Of KICE [Origin]', subject: '국어', grade: '전체', units: 14, minutesPerUnit: 54, year: '2027' },
  { site: '대성마이맥', teacher: '김승리', course: '[2027] All Of KICE [Predator : 독서]', subject: '국어', grade: '전체', units: 32, minutesPerUnit: 49, year: '2027' },
  { site: '대성마이맥', teacher: '김승리', course: '[2027] All Of KICE [Predator : 문학]', subject: '국어', grade: '전체', units: 38, minutesPerUnit: 49, year: '2027' },
  { site: '대성마이맥', teacher: '정석민', course: '[2027] 비문학 독해의 원리 베이스', subject: '국어', grade: '고3', units: 18, minutesPerUnit: 64, year: '2027' },
  { site: '대성마이맥', teacher: '정석민', course: '[2027] 문학 기출의 정석 베이스', subject: '국어', grade: '고3', units: 17, year: '2027' },
  { site: '대성마이맥', teacher: '이미지', course: '[2027] 세젤쉬 [수학Ⅰ]', subject: '수학', grade: '고3', units: 31, minutesPerUnit: 49, year: '2027' },
  { site: '대성마이맥', teacher: '이미지', course: '[2027] 세젤쉬 [수학Ⅱ]', subject: '수학', grade: '고3', units: 26, minutesPerUnit: 54, year: '2027' },
  { site: '대성마이맥', teacher: '이미지', course: '[2027] 세젤쉬 [미적분]', subject: '수학', grade: '고3', units: 26, year: '2027' },
  { site: '대성마이맥', teacher: '이미지', course: '[2027] 세젤쉬 [확률과 통계]', subject: '수학', grade: '고3', units: 22, year: '2027' },
  { site: '대성마이맥', teacher: '이미지', course: '[22개정] 세젤쉬 - 공통수학1', subject: '수학', grade: '고1', units: 45, minutesPerUnit: 46 },
  { site: '대성마이맥', teacher: '이미지', course: '[22개정] 세젤쉬 - 공통수학2', subject: '수학', grade: '고1', units: 48 },
  { site: '대성마이맥', teacher: '이미지', course: '[22개정] 세젤쉬 [대수]', subject: '수학', grade: '고2', units: 31, minutesPerUnit: 49 },
  { site: '대성마이맥', teacher: '이미지', course: '[22개정] 세젤쉬 [미적분Ⅰ]', subject: '수학', grade: '고2', units: 26 },
  { site: '대성마이맥', teacher: '이미지', course: '[22개정] 세젤쉬 [확률과 통계]', subject: '수학', grade: '고2', units: 22 },
  { site: '대성마이맥', teacher: '이미지', course: '[2027] N티켓 시즌1 [수학Ⅰ]', subject: '수학', grade: '고3', units: 12, minutesPerUnit: 69, year: '2027' },
  { site: '대성마이맥', teacher: '정상모', course: '[2027] Nswer 시즌1 - 수학Ⅰ', subject: '수학', grade: '고3', units: 10, year: '2027' },
  { site: '대성마이맥', teacher: '정상모', course: '[2027] Nswer 시즌2 - 수학Ⅰ', subject: '수학', grade: '고3', units: 17, year: '2027' },
  { site: '대성마이맥', teacher: '한석원', course: '[2027] 화룡점정 - 수학Ⅰ', subject: '수학', grade: '고3', units: 10, minutesPerUnit: 73, year: '2027' },
  { site: '대성마이맥', teacher: '김범준', course: '[NEW] Starting Block 수학Ⅰ', subject: '수학', grade: '고3', units: 32, minutesPerUnit: 64 },
  { site: '대성마이맥', teacher: '김범준', course: '[NEW] Starting Block 수학Ⅱ', subject: '수학', grade: '고3', units: 41 },
  { site: '대성마이맥', teacher: '이영수', course: '[2027] Foundation', subject: '영어', grade: '고2·고3', units: 23, minutesPerUnit: 57, year: '2027' },
  { site: '대성마이맥', teacher: '이영수', course: '[2027] Elevation', subject: '영어', grade: '고2·고3', units: 38, year: '2027' },
  { site: '대성마이맥', teacher: '이영수', course: '[2027] Culmination', subject: '영어', grade: '고3', units: 21, year: '2027' },
  { site: '대성마이맥', teacher: '션티', course: '[2027] KISSAVE', subject: '영어', grade: '전체', units: 22, minutesPerUnit: 56, year: '2027' },
  { site: '대성마이맥', teacher: '션티', course: '[2027] 키스키마', subject: '영어', grade: '고3', units: 16, year: '2027' },
  { site: '대성마이맥', teacher: '이명학', course: '[2027] Syntax 1.0 [평가원 구문독해]', subject: '영어', grade: '전체', units: 31, minutesPerUnit: 43, year: '2027', note: '1강분 개략치' },
  { site: '대성마이맥', teacher: '이명학', course: "[2027] R'gorithm [독해 알고리즘]", subject: '영어', grade: '전체', units: 24, year: '2027' },
  { site: '대성마이맥', teacher: '임정환', course: '[2027] LIM IT - 사회문화', subject: '사회', grade: '고3', units: 30, minutesPerUnit: 59, year: '2027' },
  { site: '대성마이맥', teacher: '임정환', course: '[2027] LIM IT - 생활과 윤리', subject: '사회', grade: '고3', units: 32, year: '2027' },
  { site: '대성마이맥', teacher: '임정환', course: '[2027] LIM IT - 윤리와 사상', subject: '사회', grade: '고3', units: 45, year: '2027' },
  { site: '대성마이맥', teacher: '방인혁', course: '2027 물리학Ⅰ 개념완성 The Fundamentals', subject: '과학', grade: '고3', units: 51, minutesPerUnit: 45, year: '2027' },
  { site: '대성마이맥', teacher: '방인혁', course: '2027 물리학Ⅰ 기초입문 The Beginner', subject: '과학', grade: '전체', units: 16, year: '2027' },
  { site: '대성마이맥', teacher: '홍준용', course: '[2027] 생명과학I 개념완성 PIN/SET', subject: '과학', grade: '고3', units: 44, minutesPerUnit: 46, year: '2027' },
  { site: '대성마이맥', teacher: '김준', course: '[2027] 화학Ⅰ CHEMISTORY 기출 문제풀이', subject: '과학', grade: '고3', units: 51, year: '2027' },
  { site: '대성마이맥', teacher: '이훈식', course: '2027 지구과학I 솔루션 Tech Tree part1', subject: '과학', grade: '고3', units: 24, year: '2027' },

  // ── 엠베스트 (mbest.co.kr, 중등) — 2022개정. ⚠️ 같은 학년이라도 학교 교과서 출판사에 따라 강수가 크게 다르다(37~66강).
  { site: '엠베스트', teacher: '유현진', course: '[2022개정] 중1-2 국어 (전범위)_비상(박영민)', subject: '국어', grade: '중1', units: 52, minutesPerUnit: 26, note: '교과서 출판사별로 강수 다름' },
  { site: '엠베스트', teacher: '박영아', course: '[2022개정] 중1-2 영어 (전범위)_동아(이)', subject: '영어', grade: '중1', units: 54, minutesPerUnit: 23 },
  { site: '엠베스트', teacher: '박영아', course: '중3-2 영어 (전범위)_능률(김)', subject: '영어', grade: '중3', units: 40, minutesPerUnit: 32 },
  { site: '엠베스트', teacher: '민정범', course: '[2022개정] 중1-1 수학 (전범위)_개념원리', subject: '수학', grade: '중1', units: 120 },
  { site: '엠베스트', teacher: '이지연', course: '[2022개정] 중1-1 수학 (전범위)_개념원리RPM', subject: '수학', grade: '중1', units: 81, minutesPerUnit: 35 },
  { site: '엠베스트', teacher: '김나미', course: '[2022개정] 중1-1 수학 (전범위)_수력충전', subject: '수학', grade: '중1', units: 78, minutesPerUnit: 34 },
  { site: '엠베스트', teacher: '강현정', course: '[2022개정] 중1-1 수학 (전범위)_수력충전', subject: '수학', grade: '중1', units: 83, minutesPerUnit: 27 },
  { site: '엠베스트', teacher: '박자연', course: '[2022개정] 중1-1 수학 (전범위)_블랙라벨', subject: '수학', grade: '중1', units: 40, minutesPerUnit: 39 },
  { site: '엠베스트', teacher: '강현정', course: '중학수학 한권으로 끝장내기 (수와 연산)', subject: '수학', grade: '중1~고1', units: 39, minutesPerUnit: 17 },
  { site: '엠베스트', teacher: '민정범', course: '개념원리 공통수학1', subject: '수학', grade: '중3·고1', units: 120, minutesPerUnit: 28 },
  { site: '엠베스트', teacher: '김나미', course: '기초부터 탄탄한 공통수학1', subject: '수학', grade: '중3·고1', units: 140, minutesPerUnit: 32 },
  { site: '엠베스트', teacher: '민정범', course: '세계로 수학 여행 (뉴욕 & 뉴질랜드)', subject: '수학', grade: '예비중~고1', units: 50, minutesPerUnit: 10 },
  { site: '엠베스트', teacher: '민정범', course: '[2022개정] 중2-1 수학 (전범위)_개념원리', subject: '수학', grade: '중2', units: 120, minutesPerUnit: 23, note: '1강분 개략치' },
  { site: '엠베스트', teacher: '민정범', course: '중3-1 수학 (전범위)_개념엔 유형학습', subject: '수학', grade: '중3', units: 60, minutesPerUnit: 32, note: '1강분 개략치' },
  { site: '엠베스트', teacher: '장풍', course: '[2022개정] 중1-2 과학 (전범위)_YBM', subject: '과학', grade: '중1', units: 47, minutesPerUnit: 37, note: '1강분 개략치' },
  { site: '엠베스트', teacher: '곽주현', course: '[2022개정] 사회①-2 (전범위)_천재', subject: '사회', grade: '중1', units: 52, minutesPerUnit: 32, note: '1강분 개략치' },
  { site: '엠베스트', teacher: '장풍', course: '[2022개정] 중2-2 과학 (전범위)_YBM', subject: '과학', grade: '중2', units: 62, note: '제작 중(49강 공개)' },
  { site: '엠베스트', teacher: '양신모', course: '[2022개정] 중2-2 수학 (전범위)_에이급', subject: '수학', grade: '중2', units: 59, note: '제작 중(37강 공개)' },

  // ── EBSi (ebsi.co.kr) — 2026-07-21 실측. 강좌 페이지의 강의별 러닝타임을 전수 평균낸 값이라 신뢰도 높음.
  //    ⚠️ 총강수는 OT 제외. EBSi 최신 커리큘럼은 2027학년도 수능 대비다(2026 강좌는 구버전).
  { site: 'EBSi', teacher: '한병훈', course: '[2027 수능특강] 한병훈의 문학 - 전 문항', subject: '국어', grade: '고3', units: 45, minutesPerUnit: 73, year: '2027' },
  { site: 'EBSi', teacher: '윤혜정', course: '[2027 수능특강] 윤혜정의 독서 - 전 문항', subject: '국어', grade: '고3', units: 46, minutesPerUnit: 74, year: '2027', note: '강의별 편차 큼(52~100분)' },
  { site: 'EBSi', teacher: '이현진', course: '[2027 수능특강] 이현진의 화법과 작문 - 전 문항', subject: '국어', grade: '고3', units: 20, minutesPerUnit: 66, year: '2027' },
  { site: 'EBSi', teacher: '김상태', course: '[2027 수능특강] 김상태의 언어와 매체 - 전 문항', subject: '국어', grade: '고3', units: 20, minutesPerUnit: 61, year: '2027' },
  { site: 'EBSi', teacher: '최경훈', course: '[2027 수능특강] 최경훈의 수학Ⅰ - 전 문항', subject: '수학', grade: '고3', units: 45, minutesPerUnit: 51, year: '2027' },
  { site: 'EBSi', teacher: '김지송', course: '[2027 수능특강] 김지송의 수학Ⅱ - 전 문항', subject: '수학', grade: '고3', units: 49, minutesPerUnit: 49, year: '2027', note: '목록 표기 47강이나 실제 49강(보충 추가)' },
  { site: 'EBSi', teacher: '정유빈', course: '[2027 수능특강] 정유빈의 확률과 통계 - 전 문항', subject: '수학', grade: '고3', units: 44, minutesPerUnit: 47, year: '2027', note: '목록 표기 43강이나 실제 44강' },
  { site: 'EBSi', teacher: '남치열', course: '[2027 수능특강] 남치열의 미적분 - 전 문항', subject: '수학', grade: '고3', units: 45, minutesPerUnit: 48, year: '2027' },
  { site: 'EBSi', teacher: '안국선', course: '[2027 수능특강] 안국선의 기하 - 전 문항', subject: '수학', grade: '고3', units: 45, minutesPerUnit: 49, year: '2027' },
  { site: 'EBSi', teacher: '주혜연', course: '[2027 수능특강] 주혜연의 영어 - 전 문항', subject: '영어', grade: '고3', units: 44, minutesPerUnit: 55, year: '2027' },
  { site: 'EBSi', teacher: '김수연', course: '[2027 수능특강] 김수연의 영어독해연습 - 전 문항', subject: '영어', grade: '고3', units: 45, minutesPerUnit: 59, year: '2027' },
  { site: 'EBSi', teacher: '차영', course: '[2027 수능특강] 차영의 물리학Ⅰ - 전 문항', subject: '과학', grade: '고3', units: 35, minutesPerUnit: 49, year: '2027' },
  { site: 'EBSi', teacher: '정유니', course: '[2027 수능특강] 정유니의 화학Ⅰ - 전 문항', subject: '과학', grade: '고3', units: 35, minutesPerUnit: 49, year: '2027' },
  { site: 'EBSi', teacher: '박소현', course: '[2027 수능특강] 박소현의 생명과학Ⅰ - 전 문항', subject: '과학', grade: '고3', units: 35, minutesPerUnit: 49, year: '2027' },
  { site: 'EBSi', teacher: '박용', course: '[2027 수능특강] 박용의 지구과학Ⅰ - 전 문항', subject: '과학', grade: '고3', units: 35, minutesPerUnit: 48, year: '2027' },
  { site: 'EBSi', teacher: '강승희', course: '[2027 수능특강] 강승희의 생활과 윤리 - 전 문항', subject: '사회', grade: '고3', units: 40, minutesPerUnit: 56, year: '2027' },
  { site: 'EBSi', teacher: '박봄', course: '[2027 수능특강] 박봄의 사회문화 - 전 문항', subject: '사회', grade: '고3', units: 40, minutesPerUnit: 48, year: '2027' },
  { site: 'EBSi', teacher: '최서희', course: '[2027 수능완성] 최서희의 국어 - 화법과 작문 선택', subject: '국어', grade: '고3', units: 35, minutesPerUnit: 73, year: '2027' },
  { site: 'EBSi', teacher: '정종영', course: '[2027 수능완성] 정종영의 수학 Ⅰ+Ⅱ - 전 문항', subject: '수학', grade: '고3', units: 48, minutesPerUnit: 49, year: '2027' },
  { site: 'EBSi', teacher: '김제희', course: '[2027 수능완성] 김제희의 영어 - 전 문항', subject: '영어', grade: '고3', units: 40, minutesPerUnit: 50, year: '2027', note: '제작 중 — 2026-07-21 기준 33강 공개(총 40강 예정)' },
  { site: 'EBSi', teacher: '윤혜정', course: '윤혜정의 개념의 나비효과 입문 편', subject: '국어', grade: '고1·고2', units: 60, minutesPerUnit: 68 },
  { site: 'EBSi', teacher: '윤혜정', course: '[2027 수능개념] 윤혜정의 개념의 나비효과 수능 편', subject: '국어', grade: '고2·고3', units: 40, minutesPerUnit: 77, year: '2027' },
  { site: 'EBSi', teacher: '최서희', course: '[올림포스] 공통국어1 (2022 개정)', subject: '국어', grade: '고1', units: 33, minutesPerUnit: 59 },
  { site: 'EBSi', teacher: '김민정', course: '[2026 올림포스 전국연합학력평가 기출문제집] 국어(고1)', subject: '국어', grade: '고1', units: 55, minutesPerUnit: 56, year: '2026' },
  { site: 'EBSi', teacher: '이국희', course: '[올림포스] 공통수학1 (2022 개정)', subject: '수학', grade: '고1', units: 47, minutesPerUnit: 49 },
  { site: 'EBSi', teacher: '정상모', course: '[수학의 왕도] 공통수학1 (2022 개정)', subject: '수학', grade: '고1·고2', units: 70, minutesPerUnit: 47 },
  { site: 'EBSi', teacher: '이하영', course: '[2026 올림포스 전국연합학력평가 기출문제집] 수학(고1)', subject: '수학', grade: '고1', units: 50, minutesPerUnit: 49, year: '2026' },
  { site: 'EBSi', teacher: '김예령', course: '[올림포스] 영어독해 기본1 (2022 개정)', subject: '영어', grade: '고1·고2', units: 40, minutesPerUnit: 49 },
  { site: 'EBSi', teacher: '박재창', course: '[2026 올림포스 전국연합학력평가 기출문제집] 영어독해(고1)', subject: '영어', grade: '고1', units: 50, minutesPerUnit: 60, year: '2026' },
  { site: 'EBSi', teacher: '정승익', course: '[2027 수능개념] 정승익의 수능 잡는 대박노트', subject: '영어', grade: '고3', units: 30, minutesPerUnit: 49, year: '2027' },

  // ── EBS 중학프리미엄 (mid.ebs.co.kr) — 강의 시간은 사이트가 공개하지 않아 미확인(직접 입력)
  { site: 'EBS 중학', teacher: '채지영', course: 'EBS 중학 뉴런 수학3(상)', subject: '수학', grade: '중3', units: 56, note: 'OT 별도' },
  { site: 'EBS 중학', teacher: '', course: 'EBS 중학 뉴런 수학3(하)', subject: '수학', grade: '중3', units: 42 },
  { site: 'EBS 중학', teacher: '', course: 'EBS 중학 뉴런 과학3', subject: '과학', grade: '중3', units: 50 },
  { site: 'EBS 중학', teacher: '', course: '필독 중학 국어 문학 1', subject: '국어', grade: '중1', units: 32 },
  { site: 'EBS 중학', teacher: '', course: 'MY GRAMMAR COACH 기초편', subject: '영어', grade: '중1~', units: 12 },
  { site: 'EBS 중학', teacher: '', course: 'MY GRAMMAR COACH 표준편', subject: '영어', grade: '중1~', units: 28 },
  { site: 'EBS 중학', teacher: '', course: '비욘드 중학 과학 3-2', subject: '과학', grade: '중3', units: 32 },
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
