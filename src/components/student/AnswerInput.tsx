import type { Problem } from '../../types'
import { normAnswer } from '../../lib/answers'

// ⚠️ 학생앱용 보존 컴포넌트 — 현재 앱 어디에서도 라우팅·import 되지 않는다.
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
export function autoCorrect(p: Problem, studentAnswer: string): boolean {
  return isImgAnswer(p.answer)
    ? studentAnswer === '○'
    : normAnswer(studentAnswer) !== '' && normAnswer(studentAnswer) === normAnswer(p.answer)
}

export default function AnswerInput({ p, value, onChange }: {
  p: Problem
  value: string
  onChange: (v: string) => void
}) {
  if (p.kind === '객관식') {
    return (
      <div className="flex gap-1.5">
        {CIRCLED.map(c => (
          <button key={c} type="button"
            onClick={() => onChange(value === c ? '' : c)}
            className={`h-9 w-9 rounded-full border text-base font-bold ${value === c ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink hover:bg-paper2'}`}>
            {c}
          </button>
        ))}
      </div>
    )
  }
  if (isImgAnswer(p.answer)) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg border border-line bg-paper2/60 p-2">
          <div className="mb-1 text-[10px] text-ink2">정답 (이미지) — 학생 답과 대조 후 표시</div>
          <img src={p.answer} alt="정답" className="max-h-16 w-auto" />
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
  return (
    <input value={value} onChange={e => onChange(e.target.value)}
      placeholder="답 입력"
      className="w-56 rounded-lg border border-line px-3 py-2 text-sm" />
  )
}
