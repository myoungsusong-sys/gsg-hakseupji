import { CURRICULA } from '../data/curriculum'

// 학년·과정 선택 (전학년 트리)
export default function GradeSelect({ value, onChange, className }: {
  value: string; onChange: (id: string) => void; className?: string
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={className ?? 'rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold'}>
      {CURRICULA.map(c => (
        <option key={c.id} value={c.id}>
          {c.grade.startsWith('고') ? `${c.grade} · ${c.label.replace(' (22개정)', '')}` : c.label.replace('학교', '').replace(' (22개정)', '')}
        </option>
      ))}
    </select>
  )
}
