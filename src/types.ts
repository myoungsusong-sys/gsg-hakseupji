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
  showRelated?: boolean              // 연관 문항 정보 (같은 쌍둥이 그룹 문항 번호 캡션)
  conceptPlacement?: 'front' | 'unit'  // 개념 정리 배치: 맨 앞(기본) / 각 단원 앞
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
  subject?: '수학' | '과학'   // 출제 과목 (없으면 레거시 = 수학). 헤더 과목 스위처 목록 필터용
  tags: string[]
  theme: ThemeKey
  problemIds: string[]
  conceptIds: string[]               // 삽입한 개념 정리 블록
  options: SheetOptions
  listIds: string[]                  // 마이 리스트 소속
  createdAt: string
  deletedAt: string | null
  // 보충학습 회차 체인 (학생앱 오답학습·심화학습 — 없으면 일반 학습지)
  supplement?: { kind: '오답학습' | '심화학습'; sourceWsId: string; round: number }
  studentHidden?: boolean            // 학생앱 비공개 (일괄 액션바 토글)
}

export interface MyList {
  id: string
  name: string
  createdAt: string
}

// 내 교재 — 학습지들을 교재 단위로 묶은 것 (교재 > 내 교재 / ⋮ 동일 옵션으로 교재 만들기)
export interface MyBook {
  id: string
  title: string
  grade: string
  worksheetIds: string[]
  createdAt: string
}

// 파일 업로드 대기 목록 (나의 DB 업로더·학습지 업로드 화면) —
// 파일 원본은 브라우저에 저장하지 않고 메타만 기록. 변환(전사)은 Claude 수동 파이프라인.
export interface UploadRec {
  id: string
  name: string           // 파일명
  size: number           // bytes
  fileKind: 'pdf' | 'image'
  purpose: '문제' | '학습지'
  uploadedAt: string     // ISO
  status: '변환 대기' | '등록 완료'
  grade?: string
}

// 사용자 저장 학습지 디자인 템플릿 (STEP3 [+ 템플릿 추가])
export interface SheetTemplate {
  id: string
  name: string
  opts: SheetOptions
  theme: ThemeKey
  createdAt: string
}

// ── 오답 드릴 루프 ────────────────────────────────
// 시중문제집: 문제 원문은 저장하지 않는다. 채점·유형 진단용 정답표만.
export interface Workbook {
  id: string
  subject?: '수학' | '과학'   // 과목 (없으면 course로 유도, 그래도 없으면 수학)
  name: string          // 예: 쎈 중등수학 1(상)
  publisher: string     // 예: 좋은책신사고
  grade: string
  matchKey?: string     // 시중교재·교과서 매칭표 키 → 문항·유형이 자동 파생됨 (문항은 저장하지 않음)
  course?: string       // 교과서 등 grade→과정 매핑이 애매한 교재의 명시적 wb-match/풀 과정키
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

// 강사 — 다중 강사 운영(매쓰플랫 선생님 관리 등가). 계정 발급 시 t-<loginId>@teacher.gsg.app 로그인.
export interface Teacher {
  id: string
  name: string
  phone?: string
  subjects?: string[]        // 담당 과목
  classes?: string[]         // 담당 반 이름
  loginId?: string           // 강사 계정 아이디
  accountCreated?: boolean   // Supabase 계정 발급됨
  active: boolean
  memo?: string
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
  classDays?: string[]   // 수업 요일 (예: ['월','수','금']) — 다음 수업일 자동 계산에 사용
  arriveTime?: string    // 기본 등원 시간 HH:MM (등원 체크 시 기본값)
  leaveTime?: string     // 기본 하원 시간 HH:MM
  loginId?: string       // 학생앱 로그인 아이디 (없으면 attendNo 사용)
  authEmail?: string     // 학생앱 Supabase 계정 이메일 (계정 생성 스크립트가 기록)
  siblingIds?: string[]  // 형제 연결 — 학부모 연락처를 공유하는 형제 학생 id (상호 기록)
  mgmtId?: string        // 학원관리앱(전과목) 학생 id — 명부 공유로 연결됨. 있으면 관리앱에서 가져온 학생
  // 학습 배경 — 입학 상담·진단 리포트가 인용한다
  recentExams?: { name: string; subject: string; score: string }[]  // 최근 학교시험 (예: 1학기 중간·수학·82)
  prevEdu?: string       // 이전 학원·과외 이력
  progressNow?: string   // 현행·선행 진도 (예: 학교는 중2-2, 공통수학1 선행 중)
  goal?: string          // 학습 목표 (내신/수능/특목 등)
  traits?: string[]      // 학습 성향 태그 (실수 잦음·개념 부족 등)
  weeklyHours?: string   // 주당 자기공부 시간
  parentConcern?: string // 학부모 관심·우려 포인트
}

export interface GradeResult {
  itemId?: string        // 문항 식별자 — 교재 채점: WBItem id · 학습지 채점: Problem id
                         //   (구버전 학습지 기록은 없음 → results 순서 = ws.problemIds 순서로 해석)
  typeId?: string        // 학습지 채점: 유형 직접 기록
  studentAnswer?: string
  correct: boolean
  unknown?: boolean      // '모름' — 집계는 오답과 동일, 표시만 구분
  // ── AI 1차 채점 + 선생님 승인 (자동채점 불가 문항: 서술형·이미지정답·답없음 과학) ──
  workImg?: string       // 학생 풀이 이미지 (축소 JPEG dataURL — 문제이미지+필기 합성 or 사진)
  pending?: 'ai' | 'teacher'   // 'ai'=AI 판정 대기 · 'teacher'=선생님 승인 대기 · 없으면 확정
  ai?: { verdict: boolean | null; reason: string; confidence: 'high' | 'mid' | 'low'; at: string }
  approvedAt?: string    // 선생님 확정 시각 (승인/수정 완료)
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
  midIds?: string[]      // 출제 범위 중단원 (대단원 아래 세부 선택 — 빈/없음 = 대단원 전체)
  count: number          // 문제 수
  diff: Diff             // 난이도 중심
  kind: 'all' | Kind     // 문제 형태
  mock?: 'include' | 'exclude' | 'only'   // 모의고사 포함 여부 (기본 include)
  excludePrev?: boolean           // 추가 옵션: 기존 출제 문제 제외
  outOfCurriculumOff?: boolean    // 추가 옵션: 교육 과정 외 문제 제외 (경시·올림피아드 등 출처 기준)
  evenBy?: 'unit' | 'mid' | 'sub' | 'type' | null  // 추가 옵션: 문제수 균등 배분 단위
  review: boolean        // 오답 복습 토글 (최근 7일 틀린 문제)
  reviewDays?: number[]           // 복습 요일 (0=일 ~ 6=토, 매쓰플랫 요일 선택)
  reviewMode?: 'same' | 'twin' | 'both'  // 출제 방식: 틀린 문제 그대로/쌍둥이·유사/둘 다
  reviewCap?: number              // 복습 문제 수 제한 (기본 50)
}

// 저장된 보고서 목록 (hj_settings 'savedReports') — 즉석 생성 보고서 위 "저장 레이어".
// 실제 내용은 항상 채점 기록에서 실시간 재생성 — 여기엔 이름·기간·종류만 저장.
export interface SavedReport {
  id: string
  kind: 'daily' | 'monthly' | 'analysis'   // 일일 보고지 / 월간 보고서 / 유형분석 보고서
  subject?: '수학' | '과학'   // 과목 (없으면 레거시 = 수학). 같은 날짜라도 과목별로 별개 보고서다
  studentId: string
  name: string          // 보고서명 (예: "2026년 07월 보고서")
  period: string        // 'YYYY-MM-DD' | 'YYYY-MM' | 과정 라벨(유형분석)
  createdAt: string     // ISO
}

// 학생앱 공개 설정 (hj_settings 'studentAppConfig') — 결과 화면의 정답·해설·풀이영상 노출 제어
// showAnswer/showSolution/showVideo = "채점 후" 공개 (기존 값 하위호환).
// *_Before = "채점 전"(풀이 중) 공개 — 기본 false. dailyMasterOn/dailyOffIds = 오늘의 학습 학생별 사용 설정.
export interface StudentAppConfig {
  showAnswer: boolean
  showSolution: boolean
  showVideo: boolean
  showAnswerBefore?: boolean     // 채점 전 정답 공개
  showSolutionBefore?: boolean   // 채점 전 해설 공개
  showVideoBefore?: boolean      // 채점 전 풀이영상 공개
  dailyMasterOn?: boolean        // 오늘의 학습 — 전체 학생 공개 여부 (기본 true)
  dailyOffIds?: string[]         // 오늘의 학습 OFF 학생 id 목록
  solveFeedback?: boolean        // 학생앱 문항별 '풀이 AI 피드백' 사용 (기본 true=사용)
  aiGrade?: boolean              // AI 1차 채점 + 선생님 승인 (서술형·과학 등 자동채점 불가 문항, 기본 false)
  lab?: LabConfig                // 실험실 설정
}

// 실험실 (관리 > 실험실) — 출시 준비 기능 설정
export interface LabConfig {
  oneClickOn?: boolean           // 원클릭 복습 학습지(오늘의 학습 오답 복습) 사용
  oneClickGradesOff?: string[]   // 원클릭 복습 OFF 학년 (예: '중1')
}

export const DEFAULT_STUDENT_APP_CONFIG: StudentAppConfig = {
  showAnswer: true, showSolution: true, showVideo: true,
}

// 학원(계정) 프로필 — 마이페이지 > 내 정보 (hj_settings 'academyProfile')
export interface AcademyProfile {
  academyName?: string    // 교육기관 명 (헤더·학생앱 표시)
  teacherName?: string    // 선생님 이름 (학습지·반 담당 표시)
  phone?: string          // 연락처
  contactEmail?: string   // 대표 이메일
}

// 강의 진도표 — 학생×교재 1개. 수업일별로 진도(쪽 범위·단원)를 배분한 계획
export interface PlanSession {
  date: string          // YYYY-MM-DD 수업일
  pageFrom: number
  pageTo: number
  unit: string          // 대표 단원명 (여러 단원이면 "…외 N")
  done?: boolean        // 진행 완료 체크
  note?: string         // 수업 메모(선택)
}
export interface LecturePlan {
  id: string            // `${studentId}_${workbookId}`
  studentId: string
  workbookId: string
  startDate: string     // YYYY-MM-DD
  endDate: string       // YYYY-MM-DD
  sessions: PlanSession[]
  updatedAt: string
}

// 학생 풀이 AI 피드백 (학생×학습지×문항) — 태블릿 풀이 사진/필기에 대한 단계별 피드백
export interface SolveFeedback {
  id: string            // `${studentId}_${worksheetId}_${problemId}`
  studentId: string
  worksheetId: string
  problemId: string
  hasWork: boolean      // 풀이 과정이 있었는지 (false=답만/낙서 → 베끼기 의심)
  correct: boolean | null
  feedback: string      // 학생에게 보여줄 피드백
  at: string            // ISO
  img?: string          // 제출한 풀이 이미지 (축소 JPEG dataURL — 빨간펜 표시 오버레이용)
  marks?: { x: number; y: number; w: number; h: number; label: string }[]   // 틀린 부분 빨간펜 (0~1 정규화)
}

// 일일 보고지 메모 (학생×날짜)
export interface DailyNote {
  studentId: string
  date: string          // YYYY-MM-DD
  comment: string       // 선생님 한마디 (레거시 필드 = 수학 값. 과목별 값은 bySubject)
  nextPlan: string      // 다음 학습 계획 (동상)
  // 과목별 선생님 한마디·다음 학습 계획 — 수학 보고서에 쓴 코멘트가 과학 보고서에 그대로 뜨지 않도록 분리.
  // 등원·하원·보강일은 과목과 무관하므로 이 레코드에 공용으로 둔다(과목을 바꿔도 그대로 보인다).
  // 이 필드가 없는 레거시 기록은 comment/nextPlan을 수학 값으로 읽는다.
  bySubject?: Record<string, { comment: string; nextPlan: string }>
  checkIn?: string       // 등원 시간 HH:MM — 버튼으로 체크했을 때만 기록(없으면 보고서 미표시)
  checkOut?: string      // 하원 시간 HH:MM
  makeupDate?: string    // 보강일 YYYY-MM-DD — 있으면 '다음 수업'을 이 날짜로 우선 반영(수업 변경)
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

// 태그 필터 셀렉트 옵션 — 매쓰플랫 원본 27종 상시 노출 (내 학습지·휴지통)
// TEST 표기는 STEP3 태그 칩(TAG_PRESETS)과 동일하게 띄어쓰기 유지 → 저장된 태그와 필터가 일치.
export const TAG_FILTER_OPTIONS = [
  '기본', '연습문제', '숙제', '복습', '연산',
  '입학 TEST', '일일 TEST', '주간 TEST', '단원 TEST', '총괄 TEST',
  '내신대비', '서술형', '모의고사', '모의고사 쌍둥이', '수능대비',
  '원본', '기출 유사', '기타자료 유사',
  '유형별 학습', '유형별 오답', '취약유형', '그룹취약유형', '단원별 취약',
  '기간별 오답', '학습지 오답', '교재 오답', '기타',
]
