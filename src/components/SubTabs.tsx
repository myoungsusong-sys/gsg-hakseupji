// 매쓰플랫식 하위 탭 바
export default function SubTabs({ tabs, value, onChange }: {
  tabs: { key: string; label: string }[]
  value: string
  onChange: (k: string) => void
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-x-6 gap-y-1 border-b border-line px-1">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`-mb-px whitespace-nowrap border-b-2 pb-3 pt-1 text-[15px] font-bold transition ${
            value === t.key ? 'border-pine text-ink' : 'border-transparent text-ink2 hover:text-ink'
          }`}>
          {t.label}
        </button>
      ))}
    </div>
  )
}
