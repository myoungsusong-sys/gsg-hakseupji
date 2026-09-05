import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useBrand } from '../lib/brand'
import { todayKey } from '../lib/dates'
import { loadWbMatch } from '../data/wbMatch'
import { buildByTypeRound, dailyWsId, gradeKey, typeOrderOfBook, unitsOfOrder, typeOrderOfCurriculum } from '../lib/daily'
import { bigUnitNameOfType } from '../data/curriculum'
import { DEFAULT_SHEET_OPTIONS } from '../types'
import type { Problem, Student } from '../types'
import BatchPrint, { vocaAnswerFor, vocaSheetFor, vocaStudySheetFor, type Sheet } from '../components/daily/BatchPrint'

// ── 📤 오늘 기본과제 — 반/전체 학생에게 3세트를 한 번에 내보낸다 ────────────────
//
// 왜 만들었나 (2026-08-21 명수쌤): "선생님한테 애들이 질문을 안 해서 선생님이 하는 일이 없다.
// 매일 기본으로 수학·과학 문제를 풀게 하고 영어는 단어시험을 봐야겠다. 학생들이 와서 풀고
// 질문을 하러 오는 형식으로."
//
// 🔴 지금까지 앱에는 **반 30명을 한 번에 내보내는 코드가 없었다.** 선생님이 학생 한 명씩
//    [출제]를 눌러야 했고 → 아무도 안 눌렀고 → 오답이 안 생겼고 → 「오늘 교실」이 비었고
//    → 결국 선생님이 놀았다. 이 화면이 그 고리의 첫 조각이다.
//
// 🔴 문제는 **교재가 아니라 문제은행에서** 뽑는다. 교재 매칭표는 정답만 있고 문제 이미지가
//    없어서 선생님이 화면에서 문제를 볼 수 없다. 마플시너지의 유형 221개가 문제은행에
//    100% 있고(실측) 그 문항들은 문제·해설 이미지를 갖고 있다 →
//    **유형 순서는 교재를 따르고 문제는 문제은행에서** 가져오면
//    학생 화면·PDF 출력·선생님 지도화면이 한꺼번에 해결된다.

type Made = { student: Student; subject: '수학' | '과학'; wsId: string; n: number; problems: Problem[] }

/** [문제은행키, 교재매칭표키, 교재이름] — 앞 둘이 다를 수 있다(위 RAIL 주석 참고). */
type Rail = [string, string, string]

// 🔴 미적분Ⅰ은 **마플시너지**로 낸다 (명수쌤: "고등은 마플시너지 대표유형부터").
//    한때 「마플시너지 미적분Ⅰ은 정답이 없어 쎈으로 대체」했는데 그 판단이 틀렸다 —
//    매칭표의 정답 칸은 유형 차례를 읽는 데 쓰지 않고, 문제·정답·해설은 문제은행에서 온다.
//    실측(2026-08-21): 마플시너지 미적분Ⅰ 149유형이 문제은행에 149/149 = 100% 있고
//    1·2·3회차 모두 낼 수 있다. 쎈으로 돌아갈 이유가 없다.
const MI1: Rail = ['h-calc1', 'h-mi1', '마플시너지 미적분Ⅰ']

// ── 학생별 수학 교재 후보 ────────────────────────────────────────────
// 🔴 학년표(RAIL)가 안 맞는 학생이 있다 (2026-08-24 명수쌤: "유정무는 대수야,
//    원현정은 미적분1이고"). 유정무는 고1로 등록돼 있지만 대수를 하고 있고,
//    원현정은 고2지만 미적분Ⅰ이다. 학년으로 정한 책을 **학생 단위로 덮어쓴다.**
//    (전에는 「고2 과목」 토글 하나뿐이라 고2 전원이 같이 움직였고, 고1 학생은
//     아예 바꿀 방법이 없었다.)
// 매칭표에 마플시너지가 있는 고등 4권 + 중등 진도용 3권. 값은 문제은행 과정 id.
const BOOK_CHOICES: { course: string; rail: Rail; label: string }[] = [
  { course: 'h-cm1', rail: ['h-cm1', 'h-cm1', '마플시너지 공통수학1'], label: '마플시너지 공통수학1' },
  { course: 'h-cm2', rail: ['h-cm2', 'h-cm2', '마플시너지 공통수학2'], label: '마플시너지 공통수학2' },
  { course: 'h-alg', rail: ['h-alg', 'h-dae', '마플시너지 대수'], label: '마플시너지 대수' },
  { course: 'h-calc1', rail: MI1, label: '마플시너지 미적분Ⅰ' },
  // 🔴 확률과 통계 (2026-09-05 명수쌤: "기본과제 교재 후보에 확통·통합사회·통합과학도 넣어줘").
  //    2028 수능(22개정 첫 수능) 수학 = 대수·미적분Ⅰ·확률과 통계 셋 다. 매칭표(wb-match-h-prob)에
  //    마플시너지가 없어 **베이직쎈**으로 낸다 — 실측: 104유형 전부 문제은행(pool-h-stat)에 있고
  //    3회차까지 가능(1,079문항). 쎈은 102/102, RPM 99/99 — 베이직쎈이 가장 많이 덮는다.
  { course: 'h-stat', rail: ['h-stat', 'h-prob', '베이직쎈 확률과 통계'], label: '베이직쎈 확률과 통계' },
  { course: 'm1-2', rail: ['m1-2', 'm1-2', '수학의 바이블 유형ON 중등수학1(하)'], label: '바이블 유형ON 중1(하)' },
  { course: 'm2-2', rail: ['m2-2', 'm2-2', '쎈 중등수학2(하)'], label: '쎈 중등수학2(하)' },
  { course: 'm3-2', rail: ['m3-2', 'm3-2', '쎈 중등수학3(하)'], label: '쎈 중등수학3(하)' },
]
const bookRailOf = (course: string): Rail | undefined =>
  BOOK_CHOICES.find(b => b.course === course)?.rail

// ── 학생별 과학 교재 후보 (2026-09-05 명수쌤: "기본과제 교재 후보에 확통·통합사회·통합과학도 넣어줘") ──
// 🔴 2028 수능(22개정 첫 수능) 탐구 = 통합사회 + 통합과학 둘 다 필수. 고2 정시 학생은 통합과학1·2를 여기서 고른다.
//    · 통합과학2 = 오투 매칭표(유형 58) 그대로 — 고1 규칙과 같은 책.
//    · 통합과학1 = 매칭표(wb-match)가 없다 → 매칭표키 '' = **교육과정 트리 차례**로 낸다
//      (실측: 문제은행 69유형 = 트리 69유형, id 동일. lib/daily.ts typeOrderOfCurriculum).
//    · 통합사회 = 과정·문제은행·매칭표가 **전부 없다.** 후보에 넣으면 빈 학습지가 나가므로 넣지 않는다 —
//      화면에는 「준비 중」으로만 보인다. 문제은행부터 만들어야 한다(자체 문항 씨앗 패밀리 방식).
const SCI_CHOICES: { course: string; rail: Rail; label: string }[] = [
  { course: 'h-int1', rail: ['h-int1', '', '통합과학1 (교육과정 차례)'], label: '통합과학1 (교육과정 차례)' },
  { course: 'h-int2', rail: ['h-int2', 'h-int2', '오투 통합과학2'], label: '오투 통합과학2' },
  { course: 'm-sci1-2', rail: ['m-sci1-2', 'm-sci1-2', '오투 중등과학 1-2'], label: '오투 중등과학 1-2' },
  { course: 'm-sci2-2', rail: ['m-sci2-2', 'm-sci2-2', '오투 중등과학 2-2'], label: '오투 중등과학 2-2' },
  { course: 'm-sci3-2', rail: ['m-sci3-2', 'm-sci3-2', '오투 중등과학 3-2'], label: '오투 중등과학 3-2' },
]
const sciBookRailOf = (course: string): Rail | undefined =>
  SCI_CHOICES.find(b => b.course === course)?.rail
/** 학생별 과학 지정은 같은 settings 표(dailyBooks)에 `<학생id>|sci` 키로 둔다 — 새 표·새 컬럼 없이. */
const sciKey = (studentId: string) => `${studentId}|sci`

/** 유형 차례 — 매칭표키가 있으면 그 책의 차례, '' 이면 교육과정 트리 차례 */
async function typeOrderOfRail(wbKey: string, bookName: string, course: string): Promise<string[]> {
  if (!wbKey) return typeOrderOfCurriculum(course)
  const data = await loadWbMatch(wbKey)
  const key = Object.keys(data).find(k => k.startsWith(bookName + '|')) ?? Object.keys(data)[0]
  return key ? typeOrderOfBook(data[key] as unknown[][]) : []
}

export default function DailySet() {
  const {
    students, problems, saveWorksheet, addAssignment, ensureCourse, dailyBooks, setDailyBook,
  } = useStore()
  const brand = useBrand()
  const day = todayKey()

  const [onlyMgmt, setOnlyMgmt] = useState(true)   // 프리미엄 관리앱 등록 학생만
  const [round, setRound] = useState(1)            // 1=대표유형 · 2=유형별 2번째
  // 🔴 진도 범위는 **단원**으로 고른다 (명수쌤: "4단원이면 1,2단원").
  //    과정마다 단원이 다르므로 과정키별로 따로 기억한다.
  const [unitPick, setUnitPick] = useState<Record<string, string[]>>({})
  const [unitList, setUnitList] = useState<{ course: string; label: string; units: string[] }[]>([])
  const [mathN, setMathN] = useState(15)
  const [sciN, setSciN] = useState(18)
  const [busy, setBusy] = useState('')
  const [made, setMade] = useState<Made[]>([])
  const [skipped, setSkipped] = useState<string[]>([])
  // 🔴 일괄 PDF — 만든 학습지를 학생 이름이 박힌 한 파일로 (명수쌤 2026-08-21)
  const [sheets, setSheets] = useState<Sheet[] | null>(null)
  const [vocaDay, setVocaDay] = useState(1)
  const [hi2, setHi2] = useState<'대수' | '미적분'>('대수')   // 고2는 두 과목 중 오늘 낼 것
  // 🔴 problems 는 지연 로드로 나중에 채워진다. 함수 안에서 잡은 값은 낡은 값이라
  //    ref 로 **지금 값**을 본다(안 그러면 늘 "문제은행이 안 들어왔어요" 가 뜬다).
  const problemsRef = useRef(problems)
  useEffect(() => { problemsRef.current = problems }, [problems])

  const targets = useMemo(() => {
    const act = students.filter(s => s.active)
    return onlyMgmt ? act.filter(s => s.mgmtId) : act
  }, [students, onlyMgmt])

  const mgmtCount = students.filter(s => s.active && s.mgmtId).length

  // ── 학년 → 과정·교재 ─────────────────────────────────────────────
  // 🔴 명수쌤 확정(2026-08-21): **중학교는 2학기 · 고등은 공통수학2·미적분·대수.**
  //    학생 학년은 '중2' 같은 학년 표기인데 과정은 'm2-2' 같은 학기 표기라 그냥은 안 맞는다.
  //    그래서 여기서 명시적으로 잇는다 — 추측하지 않는다.
  // 🔴 유형 순서는 **교재 매칭표(책 차례)** 에서 뽑는다. 교육과정 트리는 과학 과정이 아예 없고,
  //    무엇보다 "마플시너지 대표유형부터" 라는 요구가 곧 '책 차례대로' 라는 뜻이다.
  // 🔴 과정키가 **두 벌**이다. 문제은행(pool-<키>.json)과 교재 매칭표(wb-match-<키>.json)의
  //    파일 이름이 고등 일부에서 서로 다르다. 한 키로 둘 다 부르면 매칭표가 404 로 죽는데,
  //    화면에는 「교재 차례를 못 읽음」 한 줄만 뜨고 그 학년은 **학습지가 0장** 나간다.
  //      대수    pool=h-alg    wb-match=h-dae
  //      미적분1 pool=h-calc1  wb-match=h-mi1
  //    (2026-08-21 실측: 이 어긋남으로 고2·고3이 통째로 빠지고 있었다.)
  const RAIL: Record<string, { math?: Rail; sci?: Rail }> = {
    //            [문제은행키, 매칭표키, 교재이름(유형 차례를 가져올 책)]
    중1: { math: ['m1-2', 'm1-2', '수학의 바이블 유형ON 중등수학1(하)'], sci: ['m-sci1-2', 'm-sci1-2', '오투 중등과학 1-2'] },
    중2: { math: ['m2-2', 'm2-2', '쎈 중등수학2(하)'],                sci: ['m-sci2-2', 'm-sci2-2', '오투 중등과학 2-2'] },
    중3: { math: ['m3-2', 'm3-2', '쎈 중등수학3(하)'],                sci: ['m-sci3-2', 'm-sci3-2', '오투 중등과학 3-2'] },
    고1: { math: ['h-cm2', 'h-cm2', '마플시너지 공통수학2'],           sci: ['h-int2', 'h-int2', '오투 통합과학2'] },
    고2: { math: ['h-alg', 'h-dae', '마플시너지 대수'] },              // 미적분은 hi2 토글로 바꾼다
    고3: { math: MI1 },
  }

  // ── 학년 갈래 미리보기 ───────────────────────────────────────────
  // 🔴 명수쌤(2026-08-21): "학생이 학년이 다 다른 거 알지?"
  //    맞다 — 그래서 **누르기 전에** 학년이 어떻게 갈리는지, 학년마다 무슨 책으로 나가는지,
  //    못 내는 학생이 누구인지 화면에 보인다. 만들고 나서 「건너뛴 것」으로 알게 되면 늦다.
  const GRADE_SORT = (g: string) =>
    ({ 초: 0, 중: 10, 고: 20 }[g[0]] ?? 90) + (Number(g[1]) || 0)

  const byGrade = useMemo(() => {
    const m = new Map<string, { gk: string; raw: string; names: string[] }>()
    for (const s of targets) {
      const gk = gradeKey(s.grade)
      const key = gk || `?${s.grade || '(학년 없음)'}`
      const cur = m.get(key) ?? { gk, raw: s.grade || '(학년 없음)', names: [] }
      // 학생별 교재를 따로 지정했으면 이름 옆에 그 책을 적는다 — 학년 줄만 보고
      // 「이 학년은 다 같은 책」이라고 오해하지 않게.
      const pick = dailyBooks[s.id]
      const spick = dailyBooks[sciKey(s.id)]
      const picked = [
        pick ? BOOK_CHOICES.find(b => b.course === pick)?.label : '',
        spick ? SCI_CHOICES.find(b => b.course === spick)?.label : '',
      ].filter(Boolean).join(' · ')
      cur.names.push(picked ? `${s.name}(${picked})` : s.name)
      m.set(key, cur)
    }
    return [...m.values()]
      .map(v => {
        const rail = RAIL[v.gk]
        const math = (v.gk === '고2' && hi2 === '미적분' ? MI1 : rail?.math)?.[2]
        return { ...v, math, sci: rail?.sci?.[2], ok: !!rail }
      })
      .sort((a, b) => (a.ok === b.ok ? GRADE_SORT(a.gk) - GRADE_SORT(b.gk) : a.ok ? -1 : 1))
  }, [targets, hi2, dailyBooks])

  // 그 학생의 수학 교재 — **학생별 지정이 있으면 그것**, 없으면 학년 규칙(고2는 토글)
  function mathRailOf(s: Student): Rail | undefined {
    const pick = dailyBooks[s.id]
    if (pick) return bookRailOf(pick)
    const gk = gradeKey(s.grade)
    const rail = RAIL[gk]
    return gk === '고2' && hi2 === '미적분' ? MI1 : rail?.math
  }

  // 그 학생의 과학 교재 — 학생별 지정이 있으면 그것, 없으면 학년 규칙(고2·고3은 기본이 없어 지정해야 나간다)
  function sciRailOf(s: Student): Rail | undefined {
    const pick = dailyBooks[sciKey(s.id)]
    if (pick) return sciBookRailOf(pick)
    return RAIL[gradeKey(s.grade)]?.sci
  }

  // 대상 학생들이 쓰는 과정 목록 — [과정키, [과정키, 교재명, 화면라벨]]
  function railsOf(list: Student[]) {
    const need = new Map<string, { rail: Rail; label: string }>()
    for (const s of list) {
      const gk = gradeKey(s.grade)          // 🔴 '중2-2'·'공통수학2' 도 여기서 학년 키가 된다
      const rail = RAIL[gk]
      if (!rail) continue
      const mm = mathRailOf(s)
      if (mm) need.set(mm[0], { rail: mm, label: `${mm[2]}` })
      const ss = sciRailOf(s)
      if (ss) need.set(ss[0], { rail: ss, label: ss[2] })
    }
    return need
  }

  // 유형 → 대단원 이름. 교육과정 트리에 없으면 유형 id 규칙으로 되찾는다
  // (중2 과학·고1 과학이 이것 때문에 단원 목록에 아예 안 떴다 — curriculum.ts 주석 참고)
  const bigUnitOf = (t: string) => bigUnitNameOfType(t)

  // 대상 학생의 과정들을 읽어 단원 목록을 화면에 띄운다(단원을 골라야 범위를 정할 수 있다)
  async function loadUnits() {
    setBusy('단원 읽는 중…')
    const need = railsOf(targets)
    const out: { course: string; label: string; units: string[] }[] = []
    for (const [course, { rail: [, wbKey, bookName], label }] of need) {
      try {
        const order = await typeOrderOfRail(wbKey, bookName, course)
        if (!order.length) continue
        const units = unitsOfOrder(order, bigUnitOf)
        if (units.length) out.push({ course, label, units })
      } catch { /* 매칭표 없음 */ }
    }
    setUnitList(out)
    // 기본값: 앞의 절반 단원 (4단원이면 1,2단원)
    setUnitPick(p => {
      const n = { ...p }
      for (const u of out) if (!n[u.course]) n[u.course] = u.units.slice(0, Math.ceil(u.units.length / 2))
      return n
    })
    setBusy('')
  }

  async function makeAll() {
    if (!targets.length) return
    setBusy('준비 중…'); setMade([]); setSkipped([])
    const out: Made[] = []
    const skip: string[] = []

    // 과정별로 ①문제은행 로드 ②교재 매칭표에서 유형 순서 뽑기 — 한 번씩만 한다
    const need = railsOf(targets)
    need.forEach((_, c) => ensureCourse(c))

    setBusy('교재 차례 읽는 중…')
    const orders = new Map<string, string[]>()
    for (const [course, { rail: [, wbKey, bookName] }] of need) {
      try {
        const o = await typeOrderOfRail(wbKey, bookName, course)
        if (o.length) orders.set(course, o)
      } catch { /* 매칭표가 없으면 아래에서 건너뛴다 */ }
    }

    // 🔴 문제은행은 지연 로드라 setState 반영을 기다려야 한다. 고정 시간으로 자면 느린 날
    //    통째로 실패하므로, **실제로 들어왔는지 확인하며** 최대 30초까지 기다린다.
    setBusy('문제은행 불러오는 중… (처음 한 번만 오래 걸려요)')
    const wanted = new Set<string>()
    orders.forEach(o => o.slice(0, 40).forEach(t => wanted.add(t)))
    for (let i = 0; i < 60; i++) {
      const have = problemsRef.current.some(p => wanted.has(p.typeId))
      if (have) break
      await new Promise(r => setTimeout(r, 500))
    }

    const pool = problemsRef.current
    for (const s of targets) {
      const gk = gradeKey(s.grade)
      const rail = RAIL[gk]
      if (!rail) {
        skip.push(`${s.name}(${s.grade || '학년 없음'}) — ${
          gk ? '기본과제를 내지 않는 학년' : '학년을 읽지 못했습니다'}`)
        continue
      }
      setBusy(`${s.name} 학생 만드는 중…`)
      const plan: [string, Rail | undefined][] = [
        ['수학', mathRailOf(s)],
        ['과학', sciRailOf(s)],
      ]
      for (const [subject, entry] of plan) {
        if (!entry) { skip.push(`${s.name}(${gk}) ${subject} — 해당 과정 없음`); continue }
        const [course] = entry
        const typeOrder = orders.get(course)
        if (!typeOrder?.length) { skip.push(`${s.name} ${subject} — 교재 차례를 못 읽음(${course})`); continue }
        const tset = new Set(typeOrder)
        const inCourse = pool.filter(p => tset.has(p.typeId))
        if (!inCourse.length) { skip.push(`${s.name} ${subject} — 문제은행이 안 들어왔어요(${course})`); continue }
        const picks = buildByTypeRound(inCourse, {
          typeOrder, round,
          count: subject === '수학' ? mathN : sciN,
          units: unitPick[course], unitOf: bigUnitOf,
        })
        if (!picks.length) { skip.push(`${s.name} ${subject} — 이 범위·회차에 문제가 없어요`); continue }
        const id = dailyWsId(s.id, subject, day)
        saveWorksheet({
          id,
          title: `${subject} 기본과제 ${round}회차 - ${s.name} (${day.slice(5).replace('-', '.')})`,
          author: brand, grade: gk, subject: subject as '수학' | '과학',
          tags: ['오늘의 학습', '기본과제'], theme: subject === '수학' ? 'amber' : 'pine',
          problemIds: picks.map((p: Problem) => p.id), conceptIds: [],
          // 🔴 자동채점을 켠다 (명수쌤 2026-08-24: "학생이 답을 입력하면 자동 채점되게 해주고,
          //    고친 후 박성우 선생님한테 가지고 가면 선생님이 설명을 할 수 있게 해줘").
          //    08-21 에는 선생님이 직접 채점하기로 해서 꺼 뒀는데, 그러면 학생이 자기가 뭘
          //    틀렸는지 그 자리에서 모른다. 이제 학생이 앱에서 답을 넣으면 즉시 O/X 가 뜨고,
          //    틀린 것을 고쳐 본 뒤 선생님께 들고 간다.
          //    ※ 선생님 화면은 그대로다 — 「오늘 교실 > 기본과제 채점」줄에 채점 결과가
          //      채워진 채로 뜨고, 열면 문제·정답·해설이 다 보여 설명할 수 있다.
          options: { ...DEFAULT_SHEET_OPTIONS, autoGrade: true },
          listIds: [], createdAt: new Date().toISOString(), deletedAt: null,
        })
        addAssignment(id, [s.id], '수업')
        out.push({ student: s, subject: subject as '수학' | '과학', wsId: id, n: picks.length, problems: picks })
      }
    }
    setMade(out); setSkipped(skip); setBusy('')
  }

  // 만든 것 + 학년별 단어시험지를 모아 인쇄 화면으로 넘긴다
  async function openBatch() {
    setBusy('인쇄본 준비 중…')
    const list: Sheet[] = []
    // ① 학생별 문제지
    for (const m of made) list.push({ kind: '문제', student: m.student, subject: m.subject, problems: m.problems })
    // ② 학생별 단어장(외우기) → 단어시험지 순서.
    //    🔴 명수쌤 2026-08-25: "영어 단어장을 먼저 만들어줘야 할 것 같애."
    //       시험지만 주면 학생이 외울 것이 없다. 같은 DAY 를 단어장으로 먼저 준다.
    const stus = [...new Map(made.map(m => [m.student.id, m.student])).values()]
    for (const st of stus) {
      const b0 = await vocaStudySheetFor(st, vocaDay)
      if (b0) list.push(b0)
      const v = await vocaSheetFor(st, vocaDay)
      if (v) list.push(v)
    }
    // 🔴 ③ 정답·해설은 **학년·과목당 한 벌**. buildByTypeRound 에 학생 인자가 없어
    //    같은 학년·과목이면 문항이 완전히 같다 — 학생 수만큼 찍으면 20배로 불어난다.
    const keyOf = (m: Made) => `${gradeKey(m.student.grade)}|${m.subject}`
    const uniq = new Map<string, Made>()
    for (const m of made) if (!uniq.has(keyOf(m))) uniq.set(keyOf(m), m)
    for (const [k, m] of uniq) {
      const label = `${k.split('|')[0]} ${m.subject}`
      list.push({ kind: '정답', label, problems: m.problems })
      list.push({ kind: '해설', label, problems: m.problems })
    }
    // ④ 단어시험 정답 — 쓰는 책마다 한 벌 (중등필수·고교기본·수능)
    const seen = new Set<string>()
    for (const st of stus) {
      const a = await vocaAnswerFor(st.grade, vocaDay)
      if (a && a.kind === '단어정답' && !seen.has(a.label)) { seen.add(a.label); list.push(a) }
    }
    setSheets(list); setBusy('')
  }

  if (sheets) return <BatchPrint sheets={sheets} brand={brand} onClose={() => setSheets(null)} />

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-1 text-xl font-black">📤 오늘 기본과제</h1>
      <p className="mb-5 text-sm text-ink2">
        평일마다 학생별로 <b className="text-ink">수학·과학</b> 학습지를 한 번에 만듭니다.
        만든 뒤 <Link to="/today" className="font-bold text-pine underline">오늘 교실</Link>에
        <b className="text-ink"> ✏️ 기본과제 채점</b> 줄이 생깁니다. 거기서 <b className="text-ink">선생님이 직접 채점</b>하고,
        화면에 문제·정답·해설이 다 떠서 그 자리에서 설명할 수 있어요.
      </p>

      <div className="mb-5 grid gap-3 rounded-2xl border border-line bg-white p-4">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={onlyMgmt} onChange={e => setOnlyMgmt(e.target.checked)} />
          프리미엄 관리앱 등록 학생만
          <span className="font-normal text-ink2">({mgmtCount}명 / 재원생 {students.filter(s => s.active).length}명)</span>
        </label>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <span className="font-semibold">회차</span>
            <select value={round} onChange={e => setRound(Number(e.target.value))}
              className="rounded-lg border border-line px-2 py-1 font-bold">
              <option value={1}>1회차 — 유형 대표문제</option>
              <option value={2}>2회차 — 유형별 2번째</option>
              <option value={3}>3회차 — 유형별 3번째</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="font-semibold">고2 과목</span>
            <select value={hi2} onChange={e => setHi2(e.target.value as '대수' | '미적분')}
              className="rounded-lg border border-line px-2 py-1 font-bold">
              <option value="대수">대수</option>
              <option value="미적분">미적분</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="font-semibold">수학</span>
            <input type="number" min={5} max={40} value={mathN} onChange={e => setMathN(Number(e.target.value))}
              className="w-14 rounded-lg border border-line px-2 py-1 text-right font-bold" />
            <span className="text-ink2">문항</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="font-semibold">과학</span>
            <input type="number" min={5} max={40} value={sciN} onChange={e => setSciN(Number(e.target.value))}
              className="w-14 rounded-lg border border-line px-2 py-1 text-right font-bold" />
            <span className="text-ink2">문항</span>
          </label>
        </div>

        {/* 학년 갈래 — 학생마다 학년이 달라서, 학년별로 다른 책·다른 문제가 나간다 */}
        {byGrade.length > 0 && (
          <div className="grid gap-1.5 rounded-xl bg-paper2/60 p-3">
            <b className="text-sm">학년 갈래 <span className="font-normal text-ink2">— 학년마다 다른 책으로 나갑니다</span></b>
            {byGrade.map(g => (
              <div key={g.gk || g.raw}
                className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2.5 py-1.5 text-xs ${
                  g.ok ? 'bg-white' : 'border border-amber/50 bg-amber/10'}`}>
                <b className={`w-10 shrink-0 ${g.ok ? '' : 'text-clay'}`}>{g.ok ? g.gk : g.raw}</b>
                <span className="w-12 shrink-0 text-ink2">{g.names.length}명</span>
                {g.ok ? (
                  <>
                    <span className="rounded bg-amber/20 px-1.5 py-0.5 font-semibold">수학 {g.math}</span>
                    {g.sci
                      ? <span className="rounded bg-pine-soft px-1.5 py-0.5 font-semibold text-pine-dark">과학 {g.sci}</span>
                      : <span className="text-ink2">과학 교재 없음 — 수학만 나갑니다</span>}
                  </>
                ) : (
                  <span className="font-semibold text-clay">기본과제 대상이 아닙니다 — 이 학생들은 빠집니다</span>
                )}
                <div className="grow" />
                <span className="truncate text-ink2" title={g.names.join(', ')}>{g.names.join(' · ')}</span>
              </div>
            ))}
          </div>
        )}

        {/* 학생별 교재 지정 — 학년표가 안 맞는 학생을 여기서 바로잡는다 */}
        {targets.length > 0 && (
          <details className="rounded-xl bg-paper2/60 p-3" open={Object.keys(dailyBooks).length > 0}>
            <summary className="cursor-pointer text-sm font-bold">
              학생별 교재 지정{' '}
              <span className="font-normal text-ink2">
                — 학년과 진도가 다른 학생만 바꾸세요 (안 바꾸면 위 학년 규칙대로) · 고2 정시는 확률과 통계·통합과학을 여기서 고릅니다
              </span>
            </summary>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {targets.map(st => {
                const gk = gradeKey(st.grade)
                const def = (gk === '고2' && hi2 === '미적분' ? MI1 : RAIL[gk]?.math)?.[2]
                return (
                  <label key={st.id} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs">
                    <b className="w-16 shrink-0 truncate">{st.name}</b>
                    <span className="w-8 shrink-0 text-ink2">{gk || st.grade}</span>
                    <select value={dailyBooks[st.id] ?? ''}
                      onChange={e => setDailyBook(st.id, e.target.value)}
                      className="grow rounded-lg border border-line px-2 py-1 font-semibold">
                      <option value="">학년 규칙 — {def ?? '대상 아님'}</option>
                      {BOOK_CHOICES.map(b => <option key={b.course} value={b.course}>{b.label}</option>)}
                    </select>
                    <select value={dailyBooks[sciKey(st.id)] ?? ''}
                      onChange={e => setDailyBook(sciKey(st.id), e.target.value)}
                      className="grow rounded-lg border border-line px-2 py-1 font-semibold">
                      <option value="">과학 학년 규칙 — {RAIL[gk]?.sci?.[2] ?? '없음(과학 안 나감)'}</option>
                      {SCI_CHOICES.map(b => <option key={b.course} value={b.course}>{b.label}</option>)}
                      <option value="__soc" disabled>통합사회 — 문제은행 준비 중 (아직 못 냅니다)</option>
                    </select>
                  </label>
                )
              })}
            </div>
          </details>
        )}

        {/* 🔴 진도 범위 = 단원. "4단원이면 1,2단원" — 선생님이 쓰는 단위로 고른다 */}
        <div className="grid gap-2 rounded-xl bg-paper2/60 p-3">
          <div className="flex items-center gap-2">
            <b className="text-sm">진도 범위 (단원)</b>
            <button onClick={loadUnits} disabled={!!busy || !targets.length}
              className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-bold text-ink2 hover:border-pine disabled:opacity-50">
              {unitList.length ? '단원 다시 읽기' : '📖 단원 불러오기'}
            </button>
            {!unitList.length && <span className="text-xs text-ink2">먼저 눌러 단원을 고르세요 (안 고르면 전체 범위)</span>}
          </div>
          {unitList.map(u => (
            <div key={u.course} className="grid gap-1">
              <span className="text-xs font-bold text-ink2">{u.label} <span className="font-normal">— 총 {u.units.length}단원</span></span>
              <div className="flex flex-wrap gap-1.5">
                {u.units.map((name, i) => {
                  const on = (unitPick[u.course] ?? []).includes(name)
                  return (
                    <button key={name} type="button"
                      onClick={() => setUnitPick(p => {
                        const cur = p[u.course] ?? []
                        return { ...p, [u.course]: on ? cur.filter(x => x !== name) : [...cur, name] }
                      })}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        on ? 'bg-pine text-paper' : 'border border-line bg-white text-ink2'}`}>
                      {i + 1}. {name}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <button onClick={makeAll} disabled={!!busy || !targets.length}
          className="rounded-lg bg-pine px-5 py-2.5 text-sm font-bold text-paper hover:brightness-110 disabled:opacity-50">
          {busy || `📤 ${targets.length}명에게 만들기 (수학 + 과학)`}
        </button>
        {!targets.length && (
          <p className="text-xs text-clay">
            대상 학생이 없습니다. 프리미엄 관리앱 등록 학생이 0명이면 위 체크를 풀어 전체 재원생으로 만드세요.
          </p>
        )}
      </div>

      {made.length > 0 && (
        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <b className="text-sm">✅ {made.length}장 만들었습니다</b>
            <span className="text-xs text-ink2">
              학생 {new Set(made.map(m => m.student.id)).size}명 · 문항 합계 {made.reduce((a, m) => a + m.n, 0)}
            </span>
          </div>
          {/* 🔴 한 파일로 뽑는 길 — 학생마다 [🖨 인쇄]를 누르면 20명이면 20개 파일이 생긴다 */}
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-pine-soft px-3 py-2.5">
            <b className="text-sm text-pine-dark">📄 전부 한 파일로</b>
            <span className="text-xs text-ink2">학생 이름이 박힌 문제지 + 영어 단어시험지</span>
            <label className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold">단어 DAY</span>
              <input type="number" min={1} max={40} value={vocaDay} onChange={e => setVocaDay(Number(e.target.value))}
                className="w-14 rounded-lg border border-line px-2 py-1 text-right font-bold" />
            </label>
            <div className="grow" />
            <button onClick={openBatch} disabled={!!busy}
              className="rounded-lg bg-pine px-4 py-2 text-xs font-bold text-paper hover:brightness-110 disabled:opacity-50">
              {busy || '📄 일괄 PDF 만들기'}
            </button>
          </div>

          <div className="grid gap-1.5">
            {made.map(m => (
              <div key={m.wsId} className="flex items-center gap-2 rounded-lg border border-line/70 px-3 py-2 text-sm">
                <b className="w-20">{m.student.name}</b>
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                  m.subject === '수학' ? 'bg-amber/20 text-ink' : 'bg-pine-soft text-pine-dark'}`}>{m.subject}</span>
                <span className="text-ink2">{m.n}문항</span>
                <div className="grow" />
                <Link to={`/worksheet/${m.wsId}?out=문제지&name=${encodeURIComponent(m.student.name)}`}
                  className="rounded-lg border border-line px-2.5 py-1 text-xs font-bold text-ink2 hover:border-pine">
                  🖨 인쇄
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {skipped.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber/50 bg-amber/10 px-4 py-3 text-xs leading-relaxed">
          <b>건너뛴 것 {skipped.length}건</b>
          <ul className="mt-1 grid gap-0.5 text-ink2">{skipped.map((s, i) => <li key={i}>· {s}</li>)}</ul>
        </div>
      )}
    </div>
  )
}
