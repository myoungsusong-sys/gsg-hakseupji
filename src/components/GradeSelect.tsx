import { CURRICULA, type Curriculum } from '../data/curriculum'
import { SUBJECTS } from '../lib/subject'

function optionLabel(c: Curriculum): string {
  return c.grade.startsWith('고')
    ? `${c.grade} · ${c.label.replace(/ \(\d+개정\)/, '')}`
    : c.label.replace('학교', '').replace(/ \(\d+개정\)/, '')
}

// 학년·과정 선택 (전학년 트리, 과목별 그룹) — 과목이 늘면 SUBJECTS를 따라 그룹이 자동으로 생긴다
export default function GradeSelect({ value, onChange, className }: {
  value: string; onChange: (id: string) => void; className?: string
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={className ?? 'rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold'}>
      {SUBJECTS.map(s => {
        // subject 미지정 과정은 레거시 수학 데이터
        const list = CURRICULA.filter(c => (c.subject ?? '수학') === s)
        if (list.length === 0) return null
        return (
          <optgroup key={s} label={s}>
            {list.map(c => <option key={c.id} value={c.id}>{optionLabel(c)}</option>)}
          </optgroup>
        )
      })}
    </select>
  )
}
