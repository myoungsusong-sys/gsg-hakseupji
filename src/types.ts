export type Kind = '객관식' | '주관식'

export type Diff = 1 | 2 | 3 | 4 | 5

export const DIFFS: Diff[] = [1, 2, 3, 4, 5]

export const DIFF_LABEL: Record<Diff, string> = {
  1: '하', 2: '중하', 3: '중', 4: '상', 5: '최상',
}

export const DIFF_COLOR: Record<Diff, string> = {
  1: 'bg-stone-200 text-stone-700',
  2: 'bg-pine-soft text-pine-dark',
  3: 'bg-amber-soft text-amber',
  4: 'bg-orange-100 text-clay',
  5: 'bg-red-100 text-red-800',
}

// 난이도 비율 매트릭스: 선택한 난이도 → [하,중하,중,상,최상] 출제 비율(합 100)
export type DiffMatrix = Record<Diff, [number, number, number, number, number]>

export const DEFAULT_DIFF_MATRIX: DiffMatrix = {
  1: [40, 40, 20, 0, 0],
  2: [20, 40, 30, 10, 0],
  3: [5, 30, 30, 25, 10],
  4: [0, 20, 30, 30, 20],
  5: [0, 0, 30, 30, 40],
}

export interface Problem {
  id: string
  typeId: string
  kind: Kind
  diff: Diff
  body: string
  choices?: string[]
  answer: string
  solution: string
  source: string
  twinGroup?: string     // 같은 템플릿(숫자 변형) 그룹
  isNew?: boolean        // 신경향
  correctRate?: number   // 정답률(%) — 출제 데이터가 쌓이면 채워짐
  imageUrl?: string      // 이미지 기반 문제(기출 크롭). 있으면 body/choices 대신 이미지 렌더
  videoUrl?: string      // 문항별 풀이영상 (HLS m3u8)
  subtitleUrl?: string   // 풀이영상 자막 (vtt)
  custom?: boolean
}

export type LayoutMode = 'basic' | 'split2' | 'split4' | 'split6'

export const LAYOUT_LABEL: Record<LayoutMode, string> = {
  basic: '기본', split2: '2분할', split4: '4분할', split6: '6분할',
}

// 문항 간 세로 간격(mm) — spacing 1~5 → 인덱스 spacing-1.
// 기본(3) = 23.4mm: 매쓰플랫 실물 PDF 실측치(문항 이미지 bottom → 다음 번호 top 66.4pt).
export const SPACING_MM = [14, 18, 23.4, 28, 34, 40] as const
export function spacingMmOf(spacing: number): number {
  return SPACING_MM[spacing - 1] ?? 23.4
}

export interface SheetOptions {
  layout: LayoutMode
  spacing: 1 | 2 | 3 | 4 | 5        // 문제 간격 (좁게~넓게)
  showTypeName: boolean              // 문제 위 유형명 캡션
  showDiff: boolean                  // 난이도 캡션
  showCorrectRate: boolean           // 정답률 캡션
  showNew: boolean                   // 신경향 라벨
  wrongNoteArea: boolean             // 오답 노트 영역(기본 분할)
  solutionWithBody: boolean          // 해설지에 문제 포함
  showDate: boolean
  customDate: string | null          // null이면 생성일
  autoGrade?: boolean                // 자동채점 학습지 (수업>학습지 탭에서 답 입력 채점)
}

export const DEFAULT_SHEET_OPTIONS: SheetOptions = {
  layout: 'basic', spacing: 3, showTypeName: true, showDiff: true,
  showCorrectRate: false, showNew: true,
  wrongNoteArea: false, solutionWithBody: false, showDate: true, customDate: null,
  autoGrade: true,
}

export interface Worksheet {
  id: string
  title: string
  author: string
  grade: string
  tags: string[]
  theme: ThemeKey
  problemIds: string[]
  conceptIds: string[]               // 삽입한 개념 정리 블록
  options: SheetOptions
  listIds: string[]                  // 마이 리스트 소속
  createdAt: string
  deletedAt: string | null
}

export interface MyList {
  id: string
  name: string
  createdAt: string
}

// ── 오답 드릴 루프 ────────────────────────────────
// 시중문제집: 문제 원문은 저장하지 않는다. 채점·유형 진단용 정답표만.
export interface Workbook {
  id: string
  name: string          // 예: 쎈 중등수학 1(상)
  publisher: string     // 예: 좋은책신사고
  grade: string
  matchKey?: string     // 시중교재 매칭표 키 → 문항·유형이 자동 파생됨 (문항은 저장하지 않음)
  studentId?: string    // 배정된 학생 (없으면 공용 라이브러리 — 채점판엔 학생 배정분만 표시)
}

export interface WBItem {
  id: string
  workbookId: string
  page: number
  no: number            // 문항 순번 (정렬용)
  label?: string        // 표시용 원문항번호 (예: "1.(1)") — 없으면 no 사용
  typeId: string        // 우리 유형 트리에 매핑 (= 매쓰플랫 conceptId)
  kind: Kind
  answer: string        // 채점 기준 (예: ③ 또는 12) — 매칭 교재는 빈값(OX채점)
  diff?: Diff
}

export interface Student {
  id: string
  name: string
  grade: string          // '중2' 또는 '중1-1' 과정형 (둘 다 허용)
  klass?: string
  active: boolean
  parentPhone?: string   // 학부모 연락처
  school?: string        // 학교
  memo?: string          // 비고 및 학생 특이사항
  attendNo?: string      // 출결 번호 (4자리)
  studentPhone?: string  // 학생 연락처
  startDate?: string     // 수업 시작일 YYYY.MM.DD
  birth?: string         // 생년월일 YYYY.MM.DD
  email?: string         // 학생 이메일
  address?: string       // 집 주소
  homePhone?: string     // 집 전화
  loginId?: string       // 학생앱 로그인 아이디 (없으면 attendNo 사용)
  authEmail?: string     // 학생앱 Supabase 계정 이메일 (계정 생성 스크립트가 기록)
}

export interface GradeResult {
  itemId?: string        // 문항 식별자 — 교재 채점: WBItem id · 학습지 채점: Problem id
                         //   (구버전 학습지 기록은 없음 → results 순서 = ws.problemIds 순서로 해석)
  typeId?: string        // 학습지 채점: 유형 직접 기록
  studentAnswer?: string
  correct: boolean
  unknown?: boolean      // '모름' — 집계는 오답과 동일, 표시만 구분
}

export interface Grading {
  id: string
  studentId: string
  source?: '교재' | '학습지'   // 없으면 교재(구버전 데이터 호환)
  workbookId?: string
  worksheetId?: string
  date: string
  pageFrom?: number
  pageTo?: number
  results: GradeResult[]
  // ── 외부 이관 이력(매쓰플랫 등) — 원본 학습지/문제를 참조하지 않는 '표시 전용' 기록.
  //    재풀이·재채점은 불가하고, 학습내역·오늘의학습·보고서 집계에만 반영된다.
  imported?: boolean
  title?: string                                // 원본 학습지/교재명 (표시용 라벨)
  category?: '학습지' | '교재' | '오답' | '챌린지'   // 학습내역 진도 카드 분류
  by?: 'student'                                // 학생앱 자기 채점(제출) 기록 — 없으면 선생님 채점
}

// 학습지 출제 (수업/숙제) — hj_settings 'assignments' 키에 배열로 저장
export interface Assignment {
  id: string
  worksheetId: string
  studentId: string
  date: string           // ISO
  kind: '수업' | '숙제'
}

// 오늘의 학습 — 학생별 자동 출제 설정 (hj_settings 'dailyConfigs')
export interface DailyConfig {
  courseId: string       // 과정 (CURRICULA id)
  unitIds: string[]      // 출제 범위 대단원 (빈 배열 = 전체)
  count: number          // 문제 수
  diff: Diff             // 난이도 중심
  kind: 'all' | Kind     // 문제 형태
  review: boolean        // 오답 복습 토글 (최근 7일 틀린 문제)
  reviewDays?: number[]           // 복습 요일 (0=일 ~ 6=토, 매쓰플랫 요일 선택)
  reviewMode?: 'same' | 'twin' | 'both'  // 출제 방식: 틀린 문제 그대로/쌍둥이·유사/둘 다
  reviewCap?: number              // 복습 문제 수 제한 (기본 50)
}

// 학생앱 공개 설정 (hj_settings 'studentAppConfig') — 결과 화면의 정답·해설·풀이영상 노출 제어
export interface StudentAppConfig {
  showAnswer: boolean
  showSolution: boolean
  showVideo: boolean
}

export const DEFAULT_STUDENT_APP_CONFIG: StudentAppConfig = {
  showAnswer: true, showSolution: true, showVideo: true,
}

// 일일 보고지 메모 (학생×날짜)
export interface DailyNote {
  studentId: string
  date: string          // YYYY-MM-DD
  comment: string       // 선생님 한마디
  nextPlan: string      // 다음 학습 계획
}

export type ThemeKey = 'pine' | 'amber' | 'navy' | 'plum' | 'slate' | 'blue' | 'teal' | 'coral'

export const THEMES: Record<ThemeKey, { name: string; main: string; soft: string }> = {
  pine:  { name: '딥그린', main: '#2e6b4f', soft: '#e2ede6' },
  amber: { name: '앰버',   main: '#c9862b', soft: '#f6e8d2' },
  navy:  { name: '네이비', main: '#2f4a6b', soft: '#e2e8f0' },
  plum:  { name: '플럼',   main: '#6b2f4f', soft: '#f0e2ea' },
  slate: { name: '차콜',   main: '#44493f', soft: '#e8e8e4' },
  blue:  { name: '블루',   main: '#2b7de9', soft: '#e9f2fe' },
  teal:  { name: '틸',     main: '#0f766e', soft: '#dcf2f0' },
  coral: { name: '코랄',   main: '#e0563f', soft: '#fbe7e2' },
}

export const TAG_PRESETS = [
  '기본', '연습문제', '숙제', '복습', '연산',
  '입학 TEST', '일일 TEST', '주간 TEST', '단원 TEST', '총괄 TEST',
  '내신대비', '모의고사', '수능대비', '기출 유사',
  '유형별 학습', '유형별 오답', '취약유형', '단원별 취약',
  '기간별 오답', '학습지 오답', '원본', '직접 입력',
]
