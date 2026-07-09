import { CURRICULA, type Curriculum } from '../data/curriculum'

function optionLabel(c: Curriculum): string {
  return c.grade.startsWith('고')
    ? `${c.grade} · ${c.label.replace(/ \(\d+개정\)/, '')}`
    : c.label.replace('학교', '').replace(/ \(\d+개정\)/, '')
}

// 학년·과정 선택 (전학년 트리, 과목별 그룹)
export default function GradeSelect({ value, onChange, className }: {
  value: string; onChange: (id: string) => void; className?: string
}) {
  const math = CURRICULA.filter(c => (c.subject ?? '수학') === '수학')
  const sci = CURRICULA.filter(c => c.subject === '과학')
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={className ?? 'rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold'}>
      <optgroup label="수학">
        {math.map(c => <option key={c.id} value={c.id}>{optionLabel(c)}</option>)}
      </optgroup>
      {sci.length > 0 && (
        <optgroup label="과학">
          {sci.map(c => <option key={c.id} value={c.id}>{optionLabel(c)}</option>)}
        </optgroup>
      )}
    </select>
  )
}
