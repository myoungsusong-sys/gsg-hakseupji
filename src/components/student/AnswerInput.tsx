import type { Problem } from '../../types'
import { answerUnit, mathEqual } from '../../lib/mathAnswer'
import { answerParts, joinAnswerParts, splitAnswerParts } from '../../lib/answers'
import MathAnswerField, { type KeypadLevel } from './MathAnswerField'
import ZoomImage from '../ZoomImage'

// ⚠️ 학습지 풀이 화면(StudentSolve.tsx)이 쓰는 입력 컴포넌트다.
//    (아래 옛 주석은 "어디서도 import 안 된다"고 하지만 낡았다 — 2026-07-31 확인)
// 원래 수업>학습지 채점 화면(WorksheetGrade)이 "학생이 답을 입력하는" 방식이던 시절의 UI로,
// 2026-07-08 매쓰플랫 group-scoring 방식(선생님이 정답을 보며 문항별 ○/✕만 마킹)으로
// 교체하면서, 곧 만들 학생앱(학생이 직접 답 입력 → 자동 채점)에서 재활용하기 위해 옮겨 두었다.
// - 객관식: ①~⑤ 클릭 (재클릭 시 해제)
// - 정답이 이미지(서술형 등): 학생이 스스로 대조 후 ○/✕ 표시
// - 그 외 주관식: 단답 텍스트 입력
// - 자동 채점 대조는 autoCorrect() 사용 (normAnswer 정규화 후 비교)

const CIRCLED = ['①', '②', '③', '④', '⑤']

export const isImgAnswer = (a: string) => /^https?:\/\/\S+\.(png|jpe?g|gif|webp)/i.test(a)

// 자동 채점: 학생 답 ↔ 정답 대조. 이미지 정답 문항은 텍스트 대조 불가 → 학생 자기 ○ 표시로 대체
// 대조는 lib/mathAnswer 의 mathEqual — LaTeX·㎠·"루트2"·단위 생략·값 동치를 모두 흡수한다.
/** 기계가 채점할 수 없는 문항 — 이미지 정답, 또는 서술형(selfGrade). 학생이 대조 후 ○/✕ 를 찍는다 */
export const isSelfGraded = (p: Problem) => isImgAnswer(p.answer) || !!p.selfGrade

export function autoCorrect(p: Problem, studentAnswer: string): boolean {
  return isSelfGraded(p)
    ? studentAnswer === '○'
    : mathEqual(p.answer, studentAnswer)
}

/** 객관식 정답 개수 — 「②,④」·「2, 4」처럼 여러 개면 2 이상(보기를 모두 골라야 정답이다).
 *  🔴 2026-09-29 명수쌤: 「승강제 문제 답 두 개 입력하는 거 답 하나만 입력이 된대」 — 보기를 한 개만
 *     받아서 정답이 둘인 객관식(과학 약 800 · 전체 약 1만 3천 문항)은 무엇을 골라도 오답이었다. */
export function choiceAnswerCount(answer: string | undefined | null): number {
  const a = String(answer ?? '')
  const circ = new Set(a.match(/[①-⑤]/g) ?? [])
  if (circ.size) return circ.size
  return Math.max(1, new Set(a.split(',').map(s => s.trim()).filter(s => /^[1-5]$/.test(s))).size)
}

/** 복수 정답 보기 켜고 끄기 — 고른 원문자를 번호순 쉼표로 잇는다(교재 채점 WbAnswerInput 과 같은 형식) */
export function toggleChoice(value: string, c: string): string {
  const sel = (value || '').split(',').filter(x => CIRCLED.includes(x))
  const next = sel.includes(c) ? sel.filter(x => x !== c) : [...sel, c]
  next.sort((a, b) => CIRCLED.indexOf(a) - CIRCLED.indexOf(b))
  return next.join(',')
}

export default function AnswerInput({ p, value, onChange, level = '중등' }: {
  p: Problem
  value: string
  onChange: (v: string) => void
  level?: KeypadLevel
}) {
  if (p.kind === '객관식') {
    const multi = choiceAnswerCount(p.answer) > 1
    const sel = (value || '').split(',')
    return (
      <div className="grid gap-1">
        <div className="flex gap-1.5">
          {CIRCLED.map(c => {
            const on = multi ? sel.includes(c) : value === c
            return (
              <button key={c} type="button"
                onClick={() => onChange(multi ? toggleChoice(value, c) : (value === c ? '' : c))}
                className={`h-9 w-9 rounded-full border text-base font-bold ${on ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink hover:bg-paper2'}`}>
                {c}
              </button>
            )
          })}
        </div>
        {multi && <span className="text-[10px] text-ink2/70">정답이 여러 개인 문제예요 — 해당 번호를 모두 눌러요</span>}
      </div>
    )
  }
  if (isSelfGraded(p)) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg border border-line bg-paper2/60 p-2">
          <div className="mb-1 text-[10px] text-ink2">정답 — 학생 답과 대조 후 표시</div>
          {isImgAnswer(p.answer)
            ? <img src={p.answer} alt="정답" className="max-h-16 w-auto" />
            : p.answer
              ? <div className="max-w-[420px] whitespace-pre-wrap text-sm">{p.answer}</div>
              // 정답표에 '해설 참조'뿐인 서술형(완자·오투) — 해설 페이지를 눌러 크게 보고 맞춘다
              : p.solution
                ? <ZoomImage src={p.solution} alt="해설" title="해설 — 모범답안" className="max-h-24 w-auto rounded border border-line bg-white" />
                : <div className="text-xs text-ink2">앱에 정답이 없는 문항 — 선생님과 확인해요</div>}
        </div>
        {(['○', '✕'] as const).map(m => (
          <button key={m} type="button" onClick={() => onChange(value === m ? '' : m)}
            className={`h-9 w-9 rounded-full border text-base font-black ${value === m ? (m === '○' ? 'border-pine bg-pine text-paper' : 'border-clay bg-clay text-white') : 'border-line bg-white text-ink hover:bg-paper2'}`}>
            {m}
          </button>
        ))}
      </div>
    )
  }
  // (가)·(나)를 함께 묻는 주관식 — 칸을 나눠 받는다 (교재 채점 화면과 같은 규칙)
  const parts = answerParts(p.answer)
  if (parts) {
    const cur = splitAnswerParts(value, parts.length)
    const setPart = (idx: number, v: string) =>
      onChange(joinAnswerParts(parts.map((_, i) => (i === idx ? v : cur[i] ?? '')), p.answer))
    return (
      <div className="grid gap-1.5">
        <span className="text-[10px] text-ink2/70">답이 {parts.length}개인 문제예요 — 칸마다 하나씩 적어요</span>
        {parts.map((part, idx) => (
          <div key={part.label} className="flex items-start gap-2">
            <span className="mt-2 w-7 shrink-0 text-sm font-bold text-ink2">({part.label})</span>
            <MathAnswerField value={cur[idx] ?? ''} onChange={v => setPart(idx, v)} level={level} width="w-40" />
          </div>
        ))}
      </div>
    )
  }
  // 정답이 단위로 끝나면 단위는 칸 밖에 적어 주고 값만 받는다 (교재 화면과 같은 규칙).
  // 🔴 이 파일과 StudentWorkbooks 의 WbAnswerInput 은 별개 컴포넌트다 — 한쪽만 고치면 어긋난다.
  const u = isImgAnswer(p.answer) ? null : answerUnit(p.answer)
  if (u) {
    return (
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <MathAnswerField value={value} onChange={onChange} level={level} width="w-44" hideUnits />
          <span className="text-sm font-bold text-ink">{u.label}</span>
        </div>
        <span className="text-[10px] text-ink2/70">단위 {u.label}는 이미 적혀 있어요 — 숫자(값)만 넣으면 돼요</span>
      </div>
    )
  }
  return <MathAnswerField value={value} onChange={onChange} level={level} width="w-56" />
}
