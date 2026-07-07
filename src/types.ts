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
  custom?: boolean
}

export type LayoutMode = 'basic' | 'split2' | 'split4' | 'split6'

export const LAYOUT_LABEL: Record<LayoutMode, string> = {
  basic: '기본', split2: '2분할', split4: '4분할', split6: '6분할',
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
}

export const DEFAULT_SHEET_OPTIONS: SheetOptions = {
  layout: 'basic', spacing: 3, showTypeName: true, showDiff: true,
  showCorrectRate: false, showNew: true,
  wrongNoteArea: false, solutionWithBody: false, showDate: true, customDate: null,
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
}

export interface WBItem {
  id: string
  workbookId: string
  page: number
  no: number            // 문항 번호
  typeId: string        // 우리 유형 트리에 매핑
  kind: Kind
  answer: string        // 채점 기준 (예: ③ 또는 12)
  diff?: Diff
}

export interface Student {
  id: string
  name: string
  grade: string
  klass?: string
  active: boolean
}

export interface GradeResult {
  itemId: string
  studentAnswer: string
  correct: boolean
}

export interface Grading {
  id: string
  studentId: string
  workbookId: string
  date: string
  pageFrom: number
  pageTo: number
  results: GradeResult[]
}

// 일일 보고지 메모 (학생×날짜)
export interface DailyNote {
  studentId: string
  date: string          // YYYY-MM-DD
  comment: string       // 선생님 한마디
  nextPlan: string      // 다음 학습 계획
}

export type ThemeKey = 'pine' | 'amber' | 'navy' | 'plum' | 'slate'

export const THEMES: Record<ThemeKey, { name: string; main: string; soft: string }> = {
  pine:  { name: '딥그린', main: '#2e6b4f', soft: '#e2ede6' },
  amber: { name: '앰버',   main: '#c9862b', soft: '#f6e8d2' },
  navy:  { name: '네이비', main: '#2f4a6b', soft: '#e2e8f0' },
  plum:  { name: '플럼',   main: '#6b2f4f', soft: '#f0e2ea' },
  slate: { name: '차콜',   main: '#44493f', soft: '#e8e8e4' },
}

export const TAG_PRESETS = [
  '기본', '연습문제', '숙제', '복습', '연산',
  '입학 TEST', '일일 TEST', '주간 TEST', '단원 TEST', '총괄 TEST',
  '내신대비', '모의고사', '수능대비', '기출 유사',
  '유형별 학습', '유형별 오답', '취약유형', '단원별 취약',
  '기간별 오답', '학습지 오답', '원본', '직접 입력',
]
