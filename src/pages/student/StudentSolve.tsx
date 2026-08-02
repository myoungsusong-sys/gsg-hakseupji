import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { GradeResult, Grading, Problem } from '../../types'
import { useStore, uid } from '../../lib/store'
import { isMachineGradable } from '../../lib/aiGrade'
import { coursesForWorksheet, typeName } from '../../data/curriculum'
import AnswerInput, { autoCorrect } from '../../components/student/AnswerInput'
import { levelFromGrade } from '../../components/student/MathAnswerField'
import ProblemContent from '../../components/ProblemContent'
import SolveFeedback from '../../components/student/SolveFeedback'
import VideoModal from '../../components/VideoModal'
import MathText from '../../components/MathText'
import { useStudentSelf } from './StudentShell'
import { clearDraft, readDraft, writeDraft, AnswerText, isImgAnswer } from './common'
import { fetchNote, clearNote, pushLive, type TeacherNote } from '../../lib/live'
import { pushReplay, type ReplaySession } from '../../lib/replay'

// ── 학습지 풀기 — 매쓰플랫 학생앱 풀이 화면 구조 ──────────────────
// · 1문제씩 페이징: [←] N번 문제 / 총 M 문제 [→] + 문제 풀이 현황 토글(번호 칩 점프)
// · 문제 위 필기: 👁(필기 보기)·undo·redo·펜·지우개·전체지우기 + 펜 설정(굵기 5종·색 5종·손으로 쓰기)
// · 하단 고정 답 바: 객관식 1~5 원형 버튼 / 주관식 입력 + [모름] + [다음]([제출하기])
// · ≡ 빠른채점: 전 문항 답 한 화면 입력 모달
// · 우리만의 것(원본에 없음): ✏️ 풀이 쓰고 AI 피드백 받기, 선생님 실시간 첨삭, 임시저장, 채점 전 공개
// · 답이 바뀔 때마다 localStorage 임시저장 (stu-draft-<wsId>) → 새로고침해도 유지
// · 제출: confirm → autoCorrect 자동채점('모름'은 unknown 처리) → hj_gradings 저장 → 결과 화면
// · 서술형 등 기계채점 불가 문항(!isMachineGradable): 공책에 풀고 [다 풀었어요]로 모범답안을 연 뒤
//   스스로 ○/✕/? 표시(자기채점, 명수쌤 지시 2026-08-01). 교재 탭과 같은 규약(self:true)으로 저장하고,
//   문제 위 필기가 있으면 workImg로 함께 남겨 선생님이 나중에 볼 수 있게 한다. AI 1차 채점은 폐지.
// · 🤖 AI 실시간 코치(2026-08-02): 필기를 멈추고 18초가 지나면 AI가 풀이를 자동 점검해 틀린 부분을
//   첨삭 배너로 알려준다(문항당 최대 2회, 새 필기가 있을 때만 재검사 — API 비용 통제).
// · 🎬 풀이 과정 자동 녹화(2026-08-02): 필기·답 입력·문제 이동을 시간과 함께 기록해 20초마다 서버에
//   올린다 → 선생님이 [실시간 풀이 > 풀이 다시보기]에서 영상처럼 재생.

const DONT_KNOW = '모름'
// 자기채점 마크 — answers 맵에 센티널로 저장해 임시저장·진행 카운트·초시계가 그대로 따라오게 한다
const SELF_PREFIX = 'SELF:'
type SelfMark = '정답' | '오답' | '모름'
function selfMarkOf(v: string): SelfMark | null {
  return v.startsWith(SELF_PREFIX) ? (v.slice(SELF_PREFIX.length) as SelfMark) : null
}
const DIFF_LABEL: Record<number, string> = { 1: '하', 2: '중하', 3: '중', 4: '상', 5: '최상' }

// 펜 설정 (매쓰플랫 동일 — 굵기 5·색 5)
const PEN_SIZES = [1.5, 2.5, 3.5, 5, 7]
const PEN_COLORS = ['#1c1917', '#3b82f6', '#22c55e', '#f59e0b', '#f472b6']

interface Stroke { color: string; size: number; erase?: boolean; pts: [number, number][] }  // pts는 0~1 정규화

export default function StudentSolve() {
  const me = useStudentSelf()
  const { wsId } = useParams()
  const { worksheets, assignments, problems, ensureCourse, upsertGrading, studentAppConfig: cfg } = useStore()
  const nav = useNavigate()
  const [openSolution, setOpenSolution] = useState<Set<string>>(new Set())
  const [video, setVideo] = useState<{ src: string; subtitle?: string; title: string } | null>(null)

  const ws = worksheets.find(w => w.id === wsId && !w.deletedAt)
  const mine = !!ws && assignments.some(a => a.worksheetId === ws.id && a.studentId === me.id)

  useEffect(() => {
    if (ws) for (const c of coursesForWorksheet(ws.grade, ws.subject)) ensureCourse(c)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws?.grade])

  const list = useMemo(() => {
    if (!ws) return []
    const m = new Map(problems.map(p => [p.id, p]))
    return ws.problemIds.map(id => m.get(id)).filter((p): p is Problem => !!p)
  }, [problems, ws])

  const [answers, setAnswers] = useState<Record<string, string>>(() => (wsId && readDraft(wsId)?.answers) || {})
  const [savedAt, setSavedAt] = useState<string | null>(() => (wsId && readDraft(wsId)?.at) || null)
  const [idx, setIdx] = useState(0)
  const [statusOn, setStatusOn] = useState(false)   // 문제 풀이 현황 토글
  const [quick, setQuick] = useState(false)         // ≡ 빠른채점 모달

  // 필기 도구 상태 (문항별 스트로크 — 세션 메모리 보관)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [inkOn, setInkOn] = useState(true)          // 👁 필기 표시/숨김(숨기면 그리기도 잠금)
  const [penSize, setPenSize] = useState(1)         // PEN_SIZES 인덱스
  const [penColor, setPenColor] = useState(PEN_COLORS[0])
  const [handWrite, setHandWrite] = useState(true)  // 손으로 쓰기 — OFF면 스타일러스(pen 포인터)만
  const [penPop, setPenPop] = useState(false)
  const [inks, setInks] = useState<Record<string, Stroke[]>>({})
  const [redos, setRedos] = useState<Record<string, Stroke[]>>({})

  // ── ⏱ 문항별 풀이 초시계 ─────────────────────────────────────────
  // 그 문항이 화면에 떠 있고 **아직 답을 입력하지 않은 동안**만 카운트한다.
  // 답을 넣으면 멈추고(그 값이 '푸는 데 걸린 시간'), 답을 지우면 이어서 다시 간다.
  // 탭을 벗어나 있는 동안은 세지 않는다(딴짓 시간이 섞이지 않게).
  const [secs, setSecs] = useState<Record<string, number>>({})   // 문항 id → 누적 초
  const [, setTick] = useState(0)                                // 1초마다 리렌더(값 자체는 미사용)
  const runStart = useRef<number | null>(null)                   // 현재 구간 시작(ms)
  const runPid = useRef<string | null>(null)

  useEffect(() => {
    const d = wsId ? readDraft(wsId) : null
    setAnswers(d?.answers ?? {})
    setSavedAt(d?.at ?? null)
    setIdx(0); setInks({}); setRedos({}); setSecs({})
    runStart.current = null; runPid.current = null
  }, [wsId])

  // 진행 중 구간을 secs에 확정(문항 이동·답 입력·화면 이탈 시 호출)
  function flushRun() {
    const pid = runPid.current, st = runStart.current
    runStart.current = null; runPid.current = null
    if (!pid || st == null) return
    const add = Math.round((Date.now() - st) / 1000)
    if (add > 0) setSecs(prev => ({ ...prev, [pid]: (prev[pid] ?? 0) + add }))
  }

  // 선생님 실시간 첨삭 수신 — 4초마다 확인 (우리만의 기능)
  const [note, setNote] = useState<TeacherNote | null>(null)
  useEffect(() => {
    let alive = true
    const poll = async () => { const n = await fetchNote(me.id); if (alive) setNote(n) }
    poll()
    const t = setInterval(poll, 4000)
    return () => { alive = false; clearInterval(t) }
  }, [me.id])
  function ackNote() { clearNote(me.id); setNote(null) }

  // ── 🎬 풀이 과정 자동 녹화 ──────────────────────────────────────
  // 필기·답 입력·문제 이동을 세션 시작 기준 ms와 함께 기록. 좌표는 소수 3자리로 축소(용량↓).
  const recRef = useRef<ReplaySession | null>(null)
  const recDirty = useRef(false)
  const recBytes = useRef(0)
  const REC_MAX = 4000                // 이벤트 수 한도 — 초과 시 기록만 멈춘다(풀이는 계속)
  const REC_MAX_BYTES = 1_500_000     // 직렬화 용량 한도 — 'set' 이벤트(전체 획 복사)가 커질 수 있어 바이트도 제한
  const roundStroke = (s: Stroke): Stroke => ({
    ...s, pts: s.pts.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000] as [number, number]),
  })
  function recEvent(ev: { type: 'stroke' | 'set' | 'nav' | 'answer'; stroke?: Stroke; strokes?: Stroke[]; v?: string }, qIdx?: number) {
    const r = recRef.current
    if (!r || r.cut) return
    if (r.events.length >= REC_MAX || recBytes.current >= REC_MAX_BYTES) { r.cut = true; recDirty.current = true; return }
    const e = {
      t: Date.now() - r.startedAt, q: qIdx ?? idx, type: ev.type,
      ...(ev.stroke ? { stroke: roundStroke(ev.stroke) } : {}),
      ...(ev.strokes ? { strokes: ev.strokes.map(roundStroke) } : {}),
      ...(ev.v != null ? { v: ev.v } : {}),
    }
    r.events.push(e)
    recBytes.current += JSON.stringify(e).length
    recDirty.current = true
  }
  // 세션 시작 — 학습지·문제가 준비되면 1회. 행 id에 startedAt이 들어가므로(lib/replay.ts)
  // 새로고침·재입장으로 새 세션이 시작돼도 이전 녹화를 덮어쓰지 않는다.
  useEffect(() => {
    if (!ws || list.length === 0) return
    if (recRef.current?.wsId === ws.id) return
    recRef.current = { studentId: me.id, name: me.name, wsId: ws.id, title: ws.title, startedAt: Date.now(), events: [] }
    recDirty.current = false; recBytes.current = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws?.id, list.length])
  // 문항 이동 기록 (첫 진입 0번은 제외)
  useEffect(() => {
    if (idx === 0 && (recRef.current?.events.length ?? 0) === 0) return
    recEvent({ type: 'nav' }, idx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])
  // 20초마다(+화면 이탈·언마운트 시) 서버로 흘려보낸다.
  // pushReplay는 성공 여부를 반환 — 실패하면 dirty를 복원해 다음 틱에 재시도(손실 최대 20초 보장).
  useEffect(() => {
    const flush = () => {
      const r = recRef.current
      if (!r || !recDirty.current) return
      recDirty.current = false
      pushReplay(r).then(ok => { if (!ok) recDirty.current = true })
    }
    const t = setInterval(flush, 20_000)
    const onVis = () => { if (document.hidden) flush() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); flush() }
  }, [])

  // ── 🤖 AI 실시간 코치 — 필기를 멈추면 AI가 풀이를 점검해 자동 첨삭 ──
  // 비용 통제: 필기 18초 멈춤 + 획 2개 이상 + 문항당 최대 2회 + 잉크 세대가 바뀌었을 때만 재검사.
  // 답을 이미 넣은 문항은 건드리지 않는다('모름'은 예외 — 힌트가 가장 필요한 순간).
  type AiNote = { img?: string; feedback: string; marks: { x: number; y: number; w: number; h: number; label: string }[]; at: number }
  const [aiNotes, setAiNotes] = useState<Record<string, AiNote | null>>({})
  const lastInkAt = useRef<Record<string, number>>({})
  const inkRev = useRef<Record<string, number>>({})    // 문항별 잉크 세대 — 획 추가·undo·redo·전체지우기마다 +1
  const coachCalls = useRef<Record<string, number>>({})
  const coachRev = useRef<Record<string, number>>({})  // 마지막 검사 시점의 잉크 세대 (획 '개수' 비교는
  //   전체지우기 후 더 적은 획으로 다시 푼 경우를 새 필기로 못 보는 버그가 있어 세대 방식으로 판정)
  const coachBusy = useRef(false)
  // 최신 answers 미러 — 비전 API 응답(수 초)이 도착한 뒤 재검증할 때 낡은 state 대신 이걸 본다
  const answersRef = useRef(answers)
  answersRef.current = answers
  // ⚠️ document.hidden을 하드 가드로 쓰지 않는다 — 태블릿 웹뷰·키오스크는 항상 hidden으로 보고돼
  //    (초시계에서 겪은 실사고) 코치가 영영 안 도는 사고가 난다. visibilitychange 전환이
  //    실제로 관측됐을 때만 멈추고, 돌아오면 다시 돈다.
  const coachHidden = useRef(false)
  const AI_IDLE_MS = 18_000, AI_MAX_CALLS = 2, AI_MIN_STROKES = 2
  useEffect(() => {
    if ((cfg.aiCoach ?? true) === false) return
    const onVis = () => { coachHidden.current = document.hidden }
    document.addEventListener('visibilitychange', onVis)
    const t = setInterval(async () => {
      const q = list[idx]; if (!q || coachHidden.current || coachBusy.current) return
      const id = q.id
      const strokes = inks[id] ?? []
      const last = lastInkAt.current[id] ?? 0
      if (strokes.length < AI_MIN_STROKES) return
      if (!last || Date.now() - last < AI_IDLE_MS) return
      if ((coachCalls.current[id] ?? 0) >= AI_MAX_CALLS) return
      const rev = inkRev.current[id] ?? 0
      if ((coachRev.current[id] ?? -1) >= rev) return   // 마지막 검사 이후 새 필기 없음
      const a = (answers[id] ?? '').trim()
      if (a && a !== DONT_KNOW) return
      coachBusy.current = true
      // 실패해도 호출 횟수는 소모 — 서버 미설정(503) 등에서 3초마다 재호출되는 낭비를 막는다
      coachCalls.current[id] = (coachCalls.current[id] ?? 0) + 1
      coachRev.current[id] = rev
      try {
        const img = await exportWork(q, strokes)
        if (img) {
          const r = await fetch('/api/solve-feedback', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: img, mediaType: 'image/jpeg',
              problemText: q.body?.trim()
                ? q.body + (q.choices?.length ? '\n' + q.choices.join(' / ') : '')
                : undefined,                       // 이미지 문항은 body가 비어 있다 — 이미지만으로 판단
              answer: q.answer,
            }),
          })
          if (r.ok) {
            const j = await r.json()
            const marks = Array.isArray(j.marks) ? j.marks : []
            // 응답 도착 후 재검증 — 기다리는 수 초 사이 답을 넣었거나 필기를 바꿨으면 낡은 지적은 버린다
            const a2 = (answersRef.current[id] ?? '').trim()
            const fresh = (inkRev.current[id] ?? 0) === rev && (!a2 || a2 === DONT_KNOW)
            // 말을 거는 경우: 풀이가 틀렸거나(marks 포함), 답만 찍고 과정이 없을 때(hasWork=false —
            // "과정을 써 보자"는 지도도 코치의 역할). 제대로 풀고 있으면 방해하지 않는다.
            if (fresh && (j.hasWork === false || j.correct === false || marks.length > 0))
              setAiNotes(prev => ({ ...prev, [id]: { img, feedback: String(j.feedback ?? ''), marks, at: Date.now() } }))
          }
        }
      } catch { /* 네트워크 오류 — 다음 검사 기회에 */ }
      finally { coachBusy.current = false }
    }, 3000)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, list, inks, answers, cfg.aiCoach])

  // 현재 문항·답 여부에 따라 초시계 시작/정지 + 1초 갱신
  const curPid = list[idx]?.id
  const curAnswered = !!(curPid && (answers[curPid] ?? '').trim())
  useEffect(() => {
    // 대상이 바뀌었거나 답이 채워졌으면 진행 구간을 확정
    if (runPid.current && (runPid.current !== curPid || curAnswered)) flushRun()
    // ⚠️ 시작 조건에 document.hidden을 넣지 않는다 — 태블릿 웹뷰·키오스크·미리보기처럼
    //    항상 hidden으로 보고되는 환경에서 초시계가 아예 안 도는 사고가 난다.
    //    대신 visibilitychange로 '벗어날 때만' 멈추고 돌아오면 이어서 센다.
    const shouldRun = !!curPid && !curAnswered
    if (shouldRun && runStart.current == null) { runStart.current = Date.now(); runPid.current = curPid! }
    if (!shouldRun) return
    const t = setInterval(() => setTick(n => n + 1), 1000)
    const onVis = () => { if (document.hidden) flushRun(); else if (runStart.current == null) { runStart.current = Date.now(); runPid.current = curPid! } }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curPid, curAnswered])

  // 화면을 벗어날 때 마지막 구간 확정
  useEffect(() => () => { flushRun() }, [])

  if (!ws || !mine) return <Navigate to="/student/worksheets" replace />

  const p = list[idx]

  // 표시용 경과 초 = 확정분 + 진행 중 구간
  function elapsed(pid: string): number {
    const base = secs[pid] ?? 0
    if (runPid.current === pid && runStart.current != null) return base + Math.floor((Date.now() - runStart.current) / 1000)
    return base
  }
  const fmtMS = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  function setAnswer(pid: string, v: string) {
    if (v.trim()) flushRun()          // 답을 넣는 순간 초시계 정지
    recEvent({ type: 'answer', v }, Math.max(0, list.findIndex(x => x.id === pid)))
    // 답(자기채점 포함)을 넣으면 그 문항의 AI 코치 배너는 치운다 — 끝낸 문제에 낡은 지적 금지
    if (v.trim() && v !== DONT_KNOW) setAiNotes(prev => (prev[pid] ? { ...prev, [pid]: null } : prev))
    setAnswers(prev => {
      const next = { ...prev, [pid]: v }
      setSavedAt(writeDraft(ws!.id, next))
      return next
    })
  }

  const answered = list.filter(q => (answers[q.id] ?? '').trim() !== '')

  // 필기(잉크) → 풀이 이미지 합성 (문제 이미지 위에 필기 얹기, 768px JPEG). CORS 오염 등 실패 시 undefined.
  function exportWork(q: Problem, strokes: Stroke[]): Promise<string | undefined> {
    if (strokes.length === 0) return Promise.resolve(undefined)
    return new Promise(resolve => {
      const compose = (img: HTMLImageElement | null) => {
        try {
          const W = 768
          const H = img ? Math.round(W * img.naturalHeight / img.naturalWidth) : Math.round(W * 0.75)
          const c = document.createElement('canvas'); c.width = W; c.height = H
          const g = c.getContext('2d')!
          g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H)
          if (img) g.drawImage(img, 0, 0, W, H)
          // 잉크 레이어(지우개 반영) 별도 캔버스에 그린 뒤 합성
          const ink = document.createElement('canvas'); ink.width = W; ink.height = H
          const ig = ink.getContext('2d')!
          for (const s of strokes) {
            ig.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over'
            ig.strokeStyle = s.color; ig.lineWidth = s.erase ? s.size * 5 : s.size
            ig.lineCap = 'round'; ig.lineJoin = 'round'
            ig.beginPath()
            s.pts.forEach(([x, y], i) => { const px = x * W, py = y * H; if (i === 0) ig.moveTo(px, py); else ig.lineTo(px, py) })
            ig.stroke()
          }
          g.drawImage(ink, 0, 0)
          resolve(c.toDataURL('image/jpeg', 0.7))
        } catch { resolve(undefined) }
      }
      if (q.imageUrl) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => compose(img)
        img.onerror = () => compose(null)
        img.src = q.imageUrl
      } else compose(null)
    })
  }

  // (AI 1차 채점 파이프라인은 폐지 — 서술형은 자기채점으로 확정 저장한다. 2026-08-01)

  async function submit() {
    if (answered.length === 0) { alert('답을 한 문제 이상 입력해주세요.'); return }
    const blank = list.length - answered.length
    const msg = blank > 0
      ? `아직 답을 입력하지 않은 문제가 ${blank}개 있어요.\n답을 입력한 문제만 채점됩니다. 제출할까요?`
      : '제출할까요? 제출하면 바로 자동 채점됩니다.'
    if (!confirm(msg)) return
    const results: GradeResult[] = []
    for (const q of answered) {
      const a = answers[q.id].trim()
      const sec = secs[q.id] || undefined          // ⏱ 그 문항 풀이 시간(초)
      const sm = selfMarkOf(a)
      if (sm) {
        // 자기채점(서술형 등) — 교재 탭과 같은 규약(self:true). 필기가 있으면 이미지로 함께 보존.
        let workImg: string | undefined
        try { workImg = await exportWork(q, inks[q.id] ?? []) } catch { /* 필기 없이 저장 */ }
        results.push({ itemId: q.id, typeId: q.typeId, correct: sm === '정답', unknown: sm === '모름' || undefined, self: true, workImg, sec })
        continue
      }
      if (a === DONT_KNOW) { results.push({ itemId: q.id, typeId: q.typeId, studentAnswer: a, correct: false, unknown: true, sec }); continue }
      results.push({ itemId: q.id, typeId: q.typeId, studentAnswer: a, correct: autoCorrect(q, a), sec })
    }
    const rec: Grading = {
      id: uid('gr'), studentId: me.id, source: '학습지', worksheetId: ws!.id,
      date: new Date().toISOString(), results, by: 'student',
    }
    upsertGrading(rec)
    // 🎬 녹화 마감 — 제출 표시 후 업로드 완료까지 기다린다(실패 시 1회 재시도).
    // 화면 전환 후에는 재시도 기회가 없어서 여기서 확정해야 한다.
    const rep = recRef.current
    if (rep) {
      rep.done = true; recDirty.current = false
      if (!(await pushReplay(rep))) await pushReplay(rep)
    }
    clearDraft(ws!.id)
    nav(`/student/result/${ws!.id}`, { replace: true })
  }

  // 필기 조작 (현재 문항)
  const pid = p?.id ?? ''
  const myInk = inks[pid] ?? []
  const myRedo = redos[pid] ?? []
  // 문제 위 메인 필기도 실시간 모니터링에 올린다 (명수쌤 지시 2026-08-01).
  // 기존엔 '✏️ 풀이 쓰기' 캔버스만 올라가서, 문제 위에만 필기하는 학생은 선생님 화면에 안 보였다.
  // 스트로크가 끝날 때마다 스로틀(2초)로 exportWork(문제이미지+잉크 합성)를 올린다.
  const lastLive = useRef(0)
  function pushLiveInk(q: Problem, strokes: Stroke[]) {
    const now = Date.now()
    if (now - lastLive.current < 2000) return
    lastLive.current = now
    exportWork(q, strokes).then(img => {
      if (img) pushLive({ studentId: me.id, name: me.name, label: `${ws!.title} · ${idx + 1}번`, img, at: Date.now() })
    }).catch(() => { /* 스냅샷 실패는 무시(다음 스트로크에 재시도) */ })
  }
  // 잉크가 바뀔 때마다 세대·시각 갱신 (AI 코치의 '새 필기' 판정 근거)
  function touchInk() {
    lastInkAt.current[pid] = Date.now()
    inkRev.current[pid] = (inkRev.current[pid] ?? 0) + 1
  }
  function pushStroke(s: Stroke) {
    setInks(prev => ({ ...prev, [pid]: [...(prev[pid] ?? []), s] }))
    setRedos(prev => ({ ...prev, [pid]: [] }))
    touchInk()
    recEvent({ type: 'stroke', stroke: s })
    if (p) pushLiveInk(p, [...myInk, s])
  }
  function undoInk() {
    if (myInk.length === 0) return
    setInks(prev => ({ ...prev, [pid]: myInk.slice(0, -1) }))
    setRedos(prev => ({ ...prev, [pid]: [...myRedo, myInk[myInk.length - 1]] }))
    touchInk()
    recEvent({ type: 'set', strokes: myInk.slice(0, -1) })
  }
  function redoInk() {
    if (myRedo.length === 0) return
    setRedos(prev => ({ ...prev, [pid]: myRedo.slice(0, -1) }))
    setInks(prev => ({ ...prev, [pid]: [...myInk, myRedo[myRedo.length - 1]] }))
    touchInk()
    recEvent({ type: 'set', strokes: [...myInk, myRedo[myRedo.length - 1]] })
  }
  function clearInk() {
    if (myInk.length === 0) return
    if (!confirm('이 문제의 필기를 모두 지울까요?')) return
    setInks(prev => ({ ...prev, [pid]: [] }))
    setRedos(prev => ({ ...prev, [pid]: [] }))
    touchInk()
    recEvent({ type: 'set', strokes: [] })
  }

  const cur = (answers[pid] ?? '').trim()
  const isLast = idx >= list.length - 1

  const toolBtn = (on: boolean) =>
    `flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-bold transition ${
      on ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink2 hover:text-ink'}`

  return (
    <div>
      {/* 헤더: ← | 제목 | ≡ 빠른채점 (매쓰플랫 동일 배치) */}
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => nav('/student/worksheets')}
          className="rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-paper2">←</button>
        <h1 className="grow text-center text-lg font-black">{ws.title}</h1>
        <button onClick={() => setQuick(true)}
          className="rounded-lg border border-line px-3 py-2 text-sm font-bold text-ink2 hover:text-ink">
          ≡ 빠른채점
        </button>
      </div>

      {/* 선생님 실시간 첨삭 배너 (우리만) */}
      {note && (note.text || note.img) && (
        <div className="mb-5 rounded-2xl border-2 border-clay bg-red-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <b className="text-clay">🖍 선생님 첨삭이 도착했어요!</b>
            <div className="grow" />
            <button onClick={ackNote}
              className="rounded-lg bg-clay px-4 py-1.5 text-xs font-bold text-white hover:brightness-105">확인했어요</button>
          </div>
          {note.text && <p className="mb-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed">{note.text}</p>}
          {note.img && <img src={note.img} alt="선생님 첨삭" className="w-full max-w-xl rounded-xl border border-clay/40 bg-white" />}
        </div>
      )}

      {/* 🤖 AI 실시간 코치 첨삭 배너 — 현재 문항에서 필기를 멈추면 자동으로 온다 */}
      {p && aiNotes[p.id] && (
        <div className="mb-5 rounded-2xl border-2 border-violet-400 bg-violet-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <b className="text-violet-700">🤖 AI 선생님이 풀이를 봤어요!</b>
            <div className="grow" />
            <button onClick={() => setAiNotes(prev => ({ ...prev, [p.id]: null }))}
              className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-bold text-white hover:brightness-105">확인했어요</button>
          </div>
          {aiNotes[p.id]!.feedback && (
            <p className="mb-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed">{aiNotes[p.id]!.feedback}</p>
          )}
          {aiNotes[p.id]!.img && aiNotes[p.id]!.marks.length > 0 && (
            <div className="relative inline-block w-full max-w-xl">
              <img src={aiNotes[p.id]!.img} alt="내 풀이 (AI 표시)" className="w-full rounded-xl border border-violet-300 bg-white" />
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {aiNotes[p.id]!.marks.map((m, i) => (
                  <ellipse key={i}
                    cx={(m.x + m.w / 2) * 100} cy={(m.y + m.h / 2) * 100}
                    rx={Math.max(m.w * 55, 4)} ry={Math.max(m.h * 60, 4)}
                    fill="none" stroke="#dc2626" strokeWidth="0.8"
                    strokeDasharray="2.5 1.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                ))}
              </svg>
              {aiNotes[p.id]!.marks.map((m, i) => (
                <span key={i}
                  className="absolute -translate-y-full rounded bg-red-600 px-1 py-0.5 text-[10px] font-bold leading-none text-white"
                  style={{ left: `${Math.min(m.x * 100, 82)}%`, top: `${Math.max(m.y * 100, 6)}%` }}>
                  {m.label || '확인'}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          문제를 불러오는 중이에요… 잠시 후에도 나오지 않으면 선생님께 문의해주세요.
        </div>
      ) : (
        <>
          {/* 문항 네비: [←] N번 문제 / 총 M 문제 [→] + 문제 풀이 현황 토글 */}
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-lg text-ink2 hover:bg-paper2 disabled:opacity-30">←</button>
              <b className="text-[15px]"><span className="text-pine-dark">{idx + 1}번 문제</span> <span className="font-semibold text-ink2">/ 총 {list.length} 문제</span></b>
              <button onClick={() => setIdx(i => Math.min(list.length - 1, i + 1))} disabled={isLast}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-lg text-ink2 hover:bg-paper2 disabled:opacity-30">→</button>
            </div>
            {/* ⏱ 이 문제 풀이 초시계 — 답을 넣으면 멈춘다 */}
            {p && (
              <span title={curAnswered ? '답을 입력해서 멈췄어요' : '이 문제를 푸는 중이에요'}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-black tabular-nums ${
                  curAnswered ? 'bg-pine-soft text-pine-dark' : 'bg-amber-soft text-amber'}`}>
                {curAnswered ? '✓' : '⏱'} {fmtMS(elapsed(p.id))}
                <span className="text-[10px] font-semibold opacity-70">{curAnswered ? '걸림' : '풀이 중'}</span>
              </span>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink2">
              문제 풀이 현황
              <button onClick={() => setStatusOn(v => !v)} role="switch" aria-checked={statusOn}
                className={`h-6 w-11 rounded-full p-0.5 transition ${statusOn ? 'bg-pine' : 'bg-line'}`}>
                <span className={`block h-5 w-5 rounded-full bg-white shadow transition ${statusOn ? 'translate-x-5' : ''}`} />
              </button>
            </label>
            {savedAt && (
              <span className="text-xs text-ink2">
                ✓ 임시저장 {new Date(savedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* 문제 풀이 현황 — 번호 칩(입력 파랑·모름 노랑), 클릭 점프 */}
          {statusOn && (
            <div className="mb-4 flex flex-wrap gap-1.5 rounded-2xl border border-line bg-white p-3.5">
              {list.map((q, i) => {
                const a = (answers[q.id] ?? '').trim()
                const t = elapsed(q.id)
                return (
                  <button key={q.id} onClick={() => setIdx(i)}
                    title={t ? `풀이 ${fmtMS(t)}` : '아직 풀지 않았어요'}
                    className={`flex flex-col items-center rounded-xl border px-2 py-1 transition ${
                      i === idx ? 'border-pine ring-2 ring-pine/30' : 'border-line'} ${
                      a === DONT_KNOW ? 'bg-amber-soft text-amber'
                        : a ? 'bg-pine text-paper' : 'bg-white text-ink2 hover:bg-paper2'}`}>
                    <span className="text-sm font-bold leading-5">{i + 1}</span>
                    <span className="text-[9px] font-semibold tabular-nums opacity-80">{t ? fmtMS(t) : '—'}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* 문제 카드 */}
          <div className="rounded-2xl border border-line bg-white p-5">
            {/* 메타 + 필기 툴바 */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <b className="text-pine-dark">{idx + 1}번</b>
              <span className="text-xs text-ink2">{typeName(p.typeId)}</span>
              <span className="text-ink2/40">|</span>
              <span className="text-xs text-ink2">난이도 <b>{DIFF_LABEL[p.diff] ?? '중'}</b></span>
              {cur !== '' && (
                <span className="rounded bg-pine-soft px-1.5 py-0.5 text-[10px] font-bold text-pine-dark">
                  {cur === DONT_KNOW ? '모름 표시'
                    : selfMarkOf(cur) ? `자기채점 ${{ 정답: '○', 오답: '✕', 모름: '?' }[selfMarkOf(cur)!]}`
                    : '답 입력됨'}
                </span>
              )}
              <div className="grow" />
              {/* 필기 툴바 (매쓰플랫 동일: 👁 ↶ ↷ 펜 지우개 🗑 + 펜 설정) */}
              <div className="relative flex items-center gap-1.5">
                <button onClick={() => setInkOn(v => !v)} title={inkOn ? '필기 숨기기' : '필기 보기'} className={toolBtn(inkOn)}>👁</button>
                <button onClick={undoInk} disabled={myInk.length === 0} title="되돌리기"
                  className={`${toolBtn(false)} disabled:opacity-30`}>↶</button>
                <button onClick={redoInk} disabled={myRedo.length === 0} title="다시하기"
                  className={`${toolBtn(false)} disabled:opacity-30`}>↷</button>
                <button onClick={() => { setTool('pen'); setPenPop(v => tool === 'pen' ? !v : true) }} title="펜 (다시 누르면 펜 설정)"
                  className={toolBtn(tool === 'pen')}>
                  <span style={tool === 'pen' ? undefined : { color: penColor }}>✏️</span>
                </button>
                <button onClick={() => setTool('eraser')} title="지우개" className={toolBtn(tool === 'eraser')}>◻</button>
                <button onClick={clearInk} disabled={myInk.length === 0} title="전체 지우기"
                  className={`${toolBtn(false)} disabled:opacity-30`}>🗑</button>

                {/* 펜 설정 팝오버 — 손으로 쓰기 · 굵기 5 · 색 5 */}
                {penPop && (
                  <div className="absolute right-0 top-11 z-40 w-64 rounded-2xl border border-line bg-white p-4 shadow-xl">
                    <div className="mb-3 flex items-center justify-between">
                      <b className="text-sm">펜 설정</b>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-ink2">
                        손으로 쓰기
                        <button onClick={() => setHandWrite(v => !v)} role="switch" aria-checked={handWrite}
                          title="끄면 스타일러스 펜으로만 필기돼요"
                          className={`h-5 w-9 rounded-full p-0.5 transition ${handWrite ? 'bg-pine' : 'bg-line'}`}>
                          <span className={`block h-4 w-4 rounded-full bg-white shadow transition ${handWrite ? 'translate-x-4' : ''}`} />
                        </button>
                      </label>
                    </div>
                    <div className="mb-3 flex items-center justify-between px-1">
                      {PEN_SIZES.map((s, i) => (
                        <button key={i} onClick={() => setPenSize(i)}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${penSize === i ? 'bg-paper2 ring-1 ring-pine' : 'hover:bg-paper2/60'}`}>
                          <span className="rounded-full bg-ink" style={{ width: s * 2, height: s * 2 }} />
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between px-1">
                      {PEN_COLORS.map(c => (
                        <button key={c} onClick={() => setPenColor(c)}
                          className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white ${penColor === c ? 'ring-2 ring-pine' : ''}`}
                          style={{ background: c }}>
                          {penColor === c ? '✓' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 문제 본문 + 필기 캔버스 오버레이 */}
            <InkCanvas
              strokes={inkOn ? myInk : []}
              live={inkOn}
              tool={tool}
              color={penColor}
              size={PEN_SIZES[penSize]}
              handWrite={handWrite}
              onCommit={pushStroke}>
              <ProblemContent p={p} />
            </InkCanvas>

            {/* ✏️ 풀이 쓰기 풀이창 (기본 펼침) — AI 피드백은 안에서 선택 */}
            {(cfg.solveFeedback ?? true) && (
              <div className="mt-4 border-t border-line/60 pt-3">
                <SolveFeedback studentId={me.id} studentName={me.name} worksheetId={ws.id} label={`${ws.title} · ${idx + 1}번`} problem={p} />
              </div>
            )}

            {/* 채점 전 공개 (선생님 설정) — 정답/해설/풀이영상 */}
            {(cfg.showAnswerBefore || cfg.showSolutionBefore || (cfg.showVideoBefore && p.videoUrl)) && (
              <div className="mt-3 grid gap-2 border-t border-line/60 pt-3 text-sm">
                {cfg.showAnswerBefore && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-ink2">답 :</span>
                    <AnswerText p={p} />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {cfg.showSolutionBefore && p.solution && (
                    <button onClick={() => setOpenSolution(prev => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n })}
                      className="rounded-lg border border-line px-2.5 py-1 text-xs font-bold text-ink2 hover:bg-paper2">
                      {openSolution.has(p.id) ? '해설 접기' : '해설'}
                    </button>
                  )}
                  {cfg.showVideoBefore && p.videoUrl && (
                    <button onClick={() => setVideo({ src: p.videoUrl!, subtitle: p.subtitleUrl, title: `${idx + 1}번 풀이영상` })}
                      className="rounded-lg border border-pine px-2.5 py-1 text-xs font-bold text-pine hover:bg-pine-soft">
                      ▶ 풀이영상
                    </button>
                  )}
                </div>
                {cfg.showSolutionBefore && openSolution.has(p.id) && (
                  <div className="rounded-xl bg-paper2/50 p-3">
                    {isImgAnswer(p.solution) || /^https?:/.test(p.solution)
                      ? <img src={p.solution} alt="해설" className="w-full max-w-[465px]" />
                      : <MathText text={p.solution} className="text-[13px] leading-relaxed" />}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* 하단 고정 답 바 — 객관식 1~5 원형 / 주관식 입력 + [모름] + [다음]([제출하기]) */}
      <div className="h-24" />
      {p && (
        <div className="fixed inset-x-0 bottom-0 z-30">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 rounded-t-2xl border border-b-0 border-line bg-white px-6 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.12)]">
            <span className="text-sm">
              <b className="text-pine-dark">{answered.length}</b><span className="text-ink2"> / {list.length}</span>
            </span>
            <div className="grow-0" />
            {!isMachineGradable(p) ? (
              /* 서술형 등 기계채점 불가 — 모범답안 열람 후 스스로 ○/✕/? (자기채점) */
              <WsSelfCheck key={p.id} p={p} value={cur}
                onMark={m => setAnswer(p.id, m ? SELF_PREFIX + m : '')} />
            ) : p.kind === '객관식' ? (
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => {
                  const c = ['①', '②', '③', '④', '⑤'][n - 1]
                  const on = cur === c
                  return (
                    <button key={n} onClick={() => setAnswer(p.id, on ? '' : c)}
                      className={`h-11 w-11 rounded-full border text-base font-bold transition ${
                        on ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink hover:bg-paper2'}`}>
                      {n}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="min-w-0 max-w-md grow">
                <AnswerInput p={p} value={cur === DONT_KNOW ? '' : cur} level={levelFromGrade(ws?.grade)} onChange={v => setAnswer(p.id, v)} />
              </div>
            )}
            {isMachineGradable(p) && (
              <button onClick={() => setAnswer(p.id, cur === DONT_KNOW ? '' : DONT_KNOW)}
                className={`h-11 rounded-full border px-4 text-sm font-bold transition ${
                  cur === DONT_KNOW ? 'border-amber bg-amber-soft text-amber' : 'border-line bg-white text-ink2 hover:bg-paper2'}`}>
                모름
              </button>
            )}
            <div className="grow" />
            {!isLast && (
              <button onClick={() => setIdx(i => i + 1)}
                className="rounded-lg bg-pine px-8 py-2.5 text-sm font-bold text-paper hover:brightness-110">
                다음
              </button>
            )}
            {(isLast || answered.length === list.length) && (
              <button onClick={submit}
                className={`rounded-lg px-8 py-2.5 text-sm font-bold ${
                  isLast ? 'bg-pine text-paper hover:brightness-110' : 'border border-pine text-pine hover:bg-pine-soft'}`}>
                제출하기
              </button>
            )}
          </div>
        </div>
      )}

      {/* ≡ 빠른채점 — 전 문항 답 한 화면 입력 */}
      {quick && ws && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => setQuick(false)}>
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-line p-4">
              <h2 className="text-base font-black">빠른채점 <span className="text-xs font-semibold text-ink2">— 답만 빠르게 입력해요</span></h2>
              <div className="grow" />
              <button onClick={() => setQuick(false)} className="rounded-lg px-2 py-0.5 text-lg text-ink2 hover:bg-paper2">✕</button>
            </div>
            <div className="min-h-0 grow overflow-y-auto p-4">
              <div className="grid gap-3">
                {list.map((q, i) => (
                  <div key={q.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line/70 p-3">
                    <b className="w-10 text-sm text-pine-dark">{i + 1}번</b>
                    {!isMachineGradable(q) ? (
                      <WsSelfCheck key={q.id} p={q} value={answers[q.id] ?? ''}
                        onMark={m => setAnswer(q.id, m ? SELF_PREFIX + m : '')} />
                    ) : (
                      <>
                        <div className="min-w-0 grow">
                          <AnswerInput p={q} value={(answers[q.id] ?? '') === DONT_KNOW ? '' : (answers[q.id] ?? '')} level={levelFromGrade(ws?.grade)} onChange={v => setAnswer(q.id, v)} />
                        </div>
                        <button onClick={() => setAnswer(q.id, (answers[q.id] ?? '') === DONT_KNOW ? '' : DONT_KNOW)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                            (answers[q.id] ?? '') === DONT_KNOW ? 'border-amber bg-amber-soft text-amber' : 'border-line text-ink2 hover:bg-paper2'}`}>
                          모름
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-line p-4">
              <span className="text-sm"><b className="text-pine-dark">{answered.length}</b><span className="text-ink2"> / {list.length}문제 입력</span></span>
              <div className="grow" />
              <button onClick={() => { setQuick(false); submit() }}
                className="rounded-lg bg-pine px-6 py-2.5 text-sm font-bold text-paper hover:brightness-110">제출하기</button>
            </div>
          </div>
        </div>
      )}

      {video && <VideoModal src={video.src} subtitle={video.subtitle} title={video.title} onClose={() => setVideo(null)} />}
    </div>
  )
}

// ── 필기 캔버스 — 문제 본문 위 오버레이 (스트로크 0~1 정규화 좌표로 저장 → 리사이즈에도 유지) ──
function InkCanvas({ strokes, live, tool, color, size, handWrite, onCommit, children }: {
  strokes: Stroke[]
  live: boolean                      // false면 표시·입력 모두 잠금(👁 숨김)
  tool: 'pen' | 'eraser'
  color: string
  size: number
  handWrite: boolean                 // false면 스타일러스(pointerType 'pen')만
  onCommit: (s: Stroke) => void
  children: React.ReactNode
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<Stroke | null>(null)

  function redraw() {
    const canvas = canvasRef.current, box = boxRef.current
    if (!canvas || !box) return
    const w = box.clientWidth, h = box.clientHeight
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr; canvas.height = h * dpr
    }
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const paint = (s: Stroke) => {
      ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over'
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.erase ? s.size * 5 : s.size
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath()
      s.pts.forEach(([x, y], i) => { const px = x * w, py = y * h; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py) })
      ctx.stroke()
    }
    for (const s of strokes) paint(s)
    if (drawing.current) paint(drawing.current)
    ctx.globalCompositeOperation = 'source-over'
  }

  useEffect(() => { redraw() })
  useEffect(() => {
    const ro = new ResizeObserver(() => redraw())
    if (boxRef.current) ro.observe(boxRef.current)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function norm(e: React.PointerEvent): [number, number] {
    const r = boxRef.current!.getBoundingClientRect()
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]
  }
  const allowed = (e: React.PointerEvent) => live && (handWrite || e.pointerType === 'pen')

  return (
    <div ref={boxRef} className="relative">
      {children}
      <canvas ref={canvasRef}
        className={`absolute inset-0 h-full w-full ${live ? 'touch-none' : 'pointer-events-none'}`}
        onPointerDown={e => {
          if (!allowed(e)) return
          e.currentTarget.setPointerCapture(e.pointerId)
          drawing.current = { color, size, erase: tool === 'eraser', pts: [norm(e)] }
          redraw()
        }}
        onPointerMove={e => {
          if (!drawing.current) return
          drawing.current.pts.push(norm(e))
          redraw()
        }}
        onPointerUp={() => {
          if (!drawing.current) return
          const s = drawing.current
          drawing.current = null
          if (s.pts.length > 1) onCommit(s)
        }}
        onPointerCancel={() => { drawing.current = null; redraw() }}
      />
    </div>
  )
}

// 자기채점 (서술형 등 기계채점 불가 문항) — 공책·필기로 풀고, 모범답안을 연 뒤 스스로 ○/✕/? 표시.
// 정답을 먼저 보고 베끼는 걸 막으려고 [다 풀었어요]를 눌러야 모범답안이 열린다 (교재 탭과 동일).
// key={p.id} 로 마운트해 문항 이동 시 열람 상태가 리셋된다.
function WsSelfCheck({ p, value, onMark }: { p: Problem; value: string; onMark: (m: SelfMark | null) => void }) {
  const [revealed, setRevealed] = useState(false)
  const mark = selfMarkOf(value)
  const open = revealed || !!mark            // 이미 표시한 문항은 다시 와도 열린 상태
  const a = (p.answer ?? '').trim()
  const hasAnswer = !!a && !['.', '-'].includes(a)
  const [showSol, setShowSol] = useState(false)
  const MARKS: [SelfMark, string, string][] = [
    ['정답', '○ 맞았어요', 'border-pine bg-pine text-paper'],
    ['오답', '✕ 틀렸어요', 'border-clay bg-clay text-white'],
    ['모름', '? 모르겠어요', 'border-amber bg-amber text-white'],
  ]
  return (
    /* 하단 고정 답 바 안에서 열리므로 화면을 다 가리지 않게 높이를 제한한다 */
    <div className="grid max-h-[45vh] min-w-0 grow gap-2 overflow-y-auto rounded-xl bg-paper2/60 px-3 py-2.5">
      <span className="text-xs font-semibold text-ink2">
        ✍️ 서술형이에요 — 공책이나 문제 위 필기로 풀고, 모범답안과 맞춰본 뒤 직접 표시해요
      </span>
      {!open ? (
        <button type="button" onClick={() => setRevealed(true)}
          className="w-fit rounded-lg border border-pine px-3 py-1.5 text-xs font-bold text-pine hover:bg-pine-soft">
          다 풀었어요 — {hasAnswer ? '모범답안 보기' : '해설 보기'}
        </button>
      ) : (
        <div className="grid gap-2">
          {hasAnswer ? (
            <div className="grid gap-1">
              <span className="text-[11px] font-semibold text-ink2">모범답안 — 표현이 달라도 뜻이 같으면 정답이에요</span>
              <div className="rounded-lg bg-white px-2.5 py-2 text-sm leading-relaxed"><AnswerText p={p} /></div>
            </div>
          ) : p.solution ? (
            <div className="grid gap-1">
              <span className="text-[11px] font-semibold text-ink2">해설을 보고 내 풀이와 맞춰보세요</span>
              {showSol
                ? <img src={p.solution} alt="해설" className="max-h-64 w-auto rounded-lg bg-white p-1" />
                : <button type="button" onClick={() => setShowSol(true)}
                    className="w-fit rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink2 hover:bg-paper2">해설 이미지 열기</button>}
            </div>
          ) : (
            <span className="text-[11px] text-ink2">앱에 정답이 없는 문항이에요 — 선생님과 함께 확인해요.</span>
          )}
          <div className="flex flex-wrap gap-1.5">
            {MARKS.map(([m, label, on]) => (
              <button key={m} type="button" onClick={() => onMark(mark === m ? null : m)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  mark === m ? on : 'border-line bg-white text-ink2 hover:bg-paper2'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
