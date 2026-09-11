import { useMemo } from 'react'
import { useStore } from '../lib/store'
import { CURRICULA } from '../data/curriculum'
import { FLOOR_NAME } from '../lib/mastery'
import { wrongTypesOf, type WrongTypeRow } from '../lib/wrongTypes'

/**
 * 🪜 정복 대기 큐 — 교재·학습지에서 틀린 유형이 저절로 줄을 선다 (2026-09-08)
 * 선생님이 배정하지 않아도 뜬다. 학생은 위에서부터 누르면 된다(순서는 규칙: 선생님 호출 → 재정복 → 진행중 → 대기).
 */
export function typeNameOf(typeId: string): { name: string; course: string; sub: string } | null {
  for (const c of CURRICULA) for (const u of c.units) for (const m of u.mids)
    for (const s of m.subs) for (const t of s.types) if (t.id === typeId) return { name: t.name, course: c.id, sub: s.name }
  return null
}

const BADGE: Record<WrongTypeRow['status'], string> = {
  선생님: 'bg-red-100 text-red-700', 재정복: 'bg-amber-100 text-amber-800', 진행중: 'bg-sky-100 text-sky-800', 대기: 'bg-paper2 text-ink2',
}

export function useWrongTypes(studentId: string, days = 30): WrongTypeRow[] {
  const { gradings, wbItems, problems, masteries } = useStore()
  return useMemo(
    () => (studentId ? wrongTypesOf({ studentId, gradings, wbItems, problems, masteries, days }) : []),
    [studentId, gradings, wbItems, problems, masteries, days],
  )
}

export default function MasteryQueue({ studentId, onPick, limit = 12, compact = false }: {
  studentId: string
  onPick: (row: WrongTypeRow) => void
  limit?: number
  compact?: boolean
}) {
  const rows = useWrongTypes(studentId)
  if (!rows.length) {
    return compact ? null : (
      <div className="rounded-2xl border border-line bg-white p-5 text-sm text-ink2">
        최근 30일 안에 틀린 유형이 없어요. 교재·학습지를 채점하면 틀린 유형이 여기에 저절로 줄을 섭니다.
      </div>
    )
  }
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <h2 className="font-black">🪜 정복할 유형 {rows.length}개</h2>
        <span className="text-xs text-ink2">교재·학습지에서 틀린 유형이 저절로 줄을 섰어요 · 위에서부터</span>
      </div>
      <ul className="divide-y divide-line">
        {rows.slice(0, limit).map((r) => {
          const t = typeNameOf(r.typeId)
          return (
            <li key={r.typeId} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${BADGE[r.status]}`}>{r.status}</span>
              {/* 커리큘럼에 이름이 없는 유형도 사다리는 돈다 — 번호라도 보여 준다 (2026-09-12) */}
              <span className="font-bold">{t?.name ?? `유형 ${r.typeId}`}</span>
              {t?.sub && <span className="text-xs text-ink2">{t.sub}</span>}
              <span className="text-xs text-ink2">
                오답 {r.wrong} · {r.sources.join('+')} · {r.lastAt.slice(5).replace('-', '/')}
                {r.state && !r.state.mastered ? ` · 지금 ${FLOOR_NAME[r.state.floor]}층` : ` · ${FLOOR_NAME[r.startFloor]}부터`}
              </span>
              <button
                type="button"
                onClick={() => onPick(r)}
                className="ml-auto rounded-xl bg-pine px-3 py-1.5 text-xs font-black text-paper hover:opacity-90"
              >
                {r.status === '진행중' ? '이어서' : r.status === '재정복' ? '다시 정복' : '정복 시작'} →
              </button>
            </li>
          )
        })}
      </ul>
      {rows.length > limit && <div className="mt-2 text-xs text-ink2">외 {rows.length - limit}개</div>}
    </section>
  )
}
