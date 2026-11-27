import { useState } from 'react'
import type { Problem } from '../types'
import MathText from './MathText'
import { autoCorrect, choiceAnswerCount, isImgAnswer, isSelfGraded, toggleChoice } from './student/AnswerInput'
import { FLOOR_NAME, type Floor, type MasteryState } from '../lib/mastery'

/**
 * ✏️ 종이로 푼 답 입력 → 채점 → 승강제 반영 (2026-11-27 윤자혜 선생님 «문제지로 출력해서 답을 승강제에 입력하고 채점할수있게해줘»)
 *
 * 인쇄한 문제지·승강제 종이판의 번호 그대로 학생이 쓴 답을 넣으면
 *  - 객관식·단답은 앱과 같은 채점 함수(autoCorrect)로, 서술형은 선생님이 ○/✗ 를 눌러 채점하고
 *  - 결과를 그 학생의 승강제 기록(log)에 남겨 층을 다시 정한다 → 보고서·학부모 일일 보고에도 그대로 들어간다.
 *
 * 층 정하기 (앱 규칙 «연속 2문제 맞히면 올라감, 틀리면 개념부터»를 종이에 맞춘 것)
 *  - 기본부터 차례로, 그 층 문항을 2문제(그 층 문항이 1개뿐이면 1문제) 이상 맞히고 틀린 것이 없으면 통과
 *  - 처음 통과 못 한 층에서 멈춘다. 그 층에서 틀린 것이 있으면 개념(0층)부터, 덜 풀었으면 그 층부터
 *  - 꼭대기 층까지 통과하면 «마스터»
 */

export interface PaperItem { label: string; p: Problem; floor: Floor }

const CIRCLED = ['①', '②', '③', '④', '⑤']

export function applyPaper(
  start: MasteryState, items: PaperItem[], marks: Record<string, boolean>, top: Floor, now: string,
): MasteryState {
  const done = items.filter((it) => it.p.id in marks)
  const s: MasteryState = {
    ...start,
    servedIds: [...start.servedIds, ...done.map((it) => it.p.id)],
    log: [...start.log, ...done.map((it) => ({ at: now, floor: it.floor, problemId: it.p.id, correct: marks[it.p.id] }))],
    streak: 0, missAtFloor: 0,
  }
  let next: Floor = 1
  let mastered = false
  for (let f = 1 as Floor; f <= top; f = (f + 1) as Floor) {
    const onFloor = items.filter((it) => it.floor === f)
    const tried = onFloor.filter((it) => it.p.id in marks)
    const ok = tried.filter((it) => marks[it.p.id]).length
    const wrong = tried.length - ok
    const need = Math.min(2, Math.max(1, onFloor.length))
    if (wrong === 0 && ok >= need) { if (f === top) mastered = true; continue }
    next = wrong > 0 ? 0 : f
    break
  }
  const wrongN = done.filter((it) => !marks[it.p.id]).length
  s.missStreak = wrongN ? start.missStreak + wrongN : 0
  s.floor = mastered ? top : next
  s.mastered = start.mastered || mastered
  if (wrongN >= 3) s.needsTeacher = true
  return s
}

export default function MasteryPaperGrade({ items, top, current, onApply }: {
  items: PaperItem[]
  top: Floor
  current: MasteryState
  onApply: (st: MasteryState, wrong: PaperItem[]) => void
}) {
  const [ans, setAns] = useState<Record<string, string>>({})
  const [marks, setMarks] = useState<Record<string, boolean> | null>(null)
  const [result, setResult] = useState<MasteryState | null>(null)
  // 고쳐서 다시 채점해도 기록이 두 번 쌓이지 않게 — 이 화면을 연 때의 상태에서 늘 다시 계산한다
  const [start] = useState(current)

  const set = (id: string, v: string) => { setAns((a) => ({ ...a, [id]: v })); setMarks(null); setResult(null) }
  const filled = items.filter((it) => (ans[it.p.id] ?? '').trim() !== '')

  const grade = () => {
    const m: Record<string, boolean> = {}
    for (const it of filled) m[it.p.id] = autoCorrect(it.p, ans[it.p.id].trim())
    setMarks(m)
    const st = applyPaper(start, items, m, top, new Date().toISOString())
    setResult(st)
    onApply(st, items.filter((it) => m[it.p.id] === false))
  }

  return (
    <section className="no-print mt-8 rounded-2xl border-2 border-pine bg-pine-soft/30 p-4">
      <h2 className="text-base font-black text-pine-dark">✏️ 종이에 쓴 답 입력 → 채점 · 승강제 반영</h2>
      <p className="mt-1 text-[13px] text-ink2">
        학생이 종이에 쓴 답을 번호대로 넣고 <b>채점</b>을 누르세요. 안 푼 문제는 비워 두면 됩니다.
        채점 결과는 이 학생의 승강제 기록과 보고서에 들어갑니다.
      </p>
      <div className="mt-3 grid gap-2">
        {items.map((it) => {
          const v = ans[it.p.id] ?? ''
          // 보기가 그림 속에 있어 choices 칸이 비어도 답이 ①~⑤ 꼴이면 객관식 단추를 낸다
          const nChoice = Array.isArray(it.p.choices) && it.p.choices.length ? it.p.choices.length : /^[①-⑤](\s*,\s*[①-⑤])*$/.test(String(it.p.answer ?? '').trim()) ? 5 : 0
          const self = isSelfGraded(it.p)
          const multi = nChoice > 0 && choiceAnswerCount(it.p.answer) > 1
          const mk = marks?.[it.p.id]
          return (
            <div key={it.p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white px-3 py-2">
              <b className="w-10 shrink-0 text-sm text-ink">{it.label}</b>
              <span className="w-12 shrink-0 text-[11px] text-ink2">{FLOOR_NAME[it.floor]}</span>
              {self ? (
                <>
                  {['○', '✗'].map((c) => (
                    <button key={c} type="button" onClick={() => set(it.p.id, v === c ? '' : c)}
                      className={`h-8 w-10 rounded-md border text-sm font-bold ${v === c ? 'border-pine bg-pine text-paper' : 'border-line hover:bg-paper2'}`}>{c}</button>
                  ))}
                  <span className="text-[11px] text-ink2">서술형 — 뒷장 해설 보고 ○/✗</span>
                </>
              ) : nChoice > 0 ? (
                CIRCLED.slice(0, Math.min(5, nChoice)).map((c) => {
                  const on = v.split(',').includes(c)
                  return (
                    <button key={c} type="button" onClick={() => set(it.p.id, multi ? toggleChoice(v, c) : (on ? '' : c))}
                      className={`h-8 w-9 rounded-md border text-base font-bold ${on ? 'border-pine bg-pine text-paper' : 'border-line hover:bg-paper2'}`}>{c}</button>
                  )
                })
              ) : (
                <input value={v} onChange={(e) => set(it.p.id, e.target.value)} placeholder="학생이 쓴 답"
                  className="min-w-[8rem] flex-1 rounded-md border border-line px-2 py-1 text-sm" />
              )}
              <div className="grow" />
              {mk !== undefined && (
                <span className={`flex items-center gap-1 text-sm font-black ${mk ? 'text-pine-dark' : 'text-red-600'}`}>
                  {mk ? '⭕ 정답' : '❌ 오답'}
                  {!mk && !self && (
                    <span className="ml-1 flex items-center gap-1 text-xs font-semibold text-ink2">정답
                      {isImgAnswer(it.p.answer) ? <img src={it.p.answer} alt="정답" className="max-h-6" /> : <MathText text={it.p.answer} />}
                    </span>
                  )}
                </span>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={grade} disabled={!filled.length}
          className="rounded-lg bg-pine px-5 py-2 text-sm font-black text-paper disabled:opacity-40">
          채점하고 승강제에 반영 ({filled.length}문항)
        </button>
        {result && marks && (
          <span className="text-sm font-bold text-ink">
            {Object.values(marks).filter(Boolean).length} / {Object.keys(marks).length} 정답 →{' '}
            {result.mastered && result.floor === top ? '🎉 이 유형 마스터!' : `다음은 «${FLOOR_NAME[result.floor]}» 단계부터`}
            {result.needsTeacher ? ' · 선생님 설명 필요' : ''}
          </span>
        )}
      </div>
    </section>
  )
}
