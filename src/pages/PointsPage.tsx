import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { useBrand } from '../lib/brand'
import { todayKey } from '../lib/dates'
import { computeMonth, MONTHLY_CAP, POINT_RULES, won, type MonthPoint } from '../lib/points'
import type { Student } from '../types'

// ── 포인트 리워드 (관리 > 포인트) — 1포인트 = 1원, 월말 현금 정산 ──
// 자동 적립·차감은 학습 기록에서 파생 계산(저장 없음). 선생님 수동 가감과 정산만 저장한다.

const INPUT = 'rounded-lg border border-line px-2 py-1.5 text-sm'

export default function PointsPage() {
  const { students, gradings, ttChecks, pointEntries, pointSettlements, addPointEntry, removePointEntry, savePointSettlement } = useStore()
  const brand = useBrand()
  const today = todayKey()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [openId, setOpenId] = useState<string | null>(null)

  const active = useMemo(() => students.filter(s => s.active), [students])
  const rows = useMemo(() => active.map(s => ({
    s, mp: computeMonth(s.id, month, today, s.timetable, ttChecks, gradings, pointEntries),
    paid: pointSettlements.find(x => x.id === `${s.id}_${month}`),
  })), [active, month, today, ttChecks, gradings, pointEntries, pointSettlements])

  const sum = rows.reduce((a, r) => a + r.mp.total, 0)
  const unpaid = rows.filter(r => !r.paid && r.mp.total > 0)

  function settle(s: Student, mp: MonthPoint) {
    if (!confirm(`${s.name} 학생 ${month} 정산\n\n학원 적립 ${won(mp.academyAmount)}${mp.capped ? ' (월 한도 적용)' : ''}\n부모님 용돈 ${won(mp.parentAmount)}\n────────────\n지급액 ${won(mp.total)}\n\n지급 완료로 기록할까요?`)) return
    savePointSettlement({
      id: `${s.id}_${month}`, studentId: s.id, month,
      academyAmount: mp.academyAmount, parentAmount: mp.parentAmount, total: mp.total,
      paidAt: new Date().toISOString(),
    })
  }

  return (
    <div>
      <div className="note-noprint mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-black">💰 포인트 리워드</h1>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className={INPUT} />
        <span className="text-sm text-ink2">
          1포인트 = 1원 · 학원 지급 월 한도 {won(MONTHLY_CAP)} (부모님 용돈은 한도 없음)
        </span>
        <div className="grow" />
        <span className="rounded-full bg-pine-soft px-3 py-1.5 text-sm font-black text-pine-dark">
          이번 달 총 {won(sum)}
        </span>
        <button onClick={() => window.print()} className="rounded-lg border border-line px-3 py-1.5 text-sm font-bold text-ink2 hover:border-pine">🖨 정산서 인쇄</button>
      </div>

      <div className="note-noprint mb-3 rounded-xl border border-line bg-white px-4 py-3 text-xs text-ink2">
        <b className="text-ink">자동 적립</b> 시간표 1칸 완료 +{POINT_RULES.block} · 그날 전부 완료 보너스 +{POINT_RULES.perfectDay} ·
        학습지 100점 +{POINT_RULES.sheet100} · 80점 이상 +{POINT_RULES.sheet80}
        <span className="mx-2">|</span>
        <b className="text-ink">차감</b> 못 한 시간 1칸 {POINT_RULES.blockMissed} (지난 날짜만)
        <span className="mx-2">|</span>
        하루 합계는 0원 밑으로 내려가지 않습니다.
      </div>

      {unpaid.length > 0 && (
        <p className="note-noprint mb-3 text-sm text-ink2">미지급 {unpaid.length}명 · 합계 {won(unpaid.reduce((a, r) => a + r.mp.total, 0))}</p>
      )}

      <div className="note-print overflow-hidden rounded-2xl border border-line bg-white">
        <div className="hidden border-b-2 border-ink px-5 py-3 print:block">
          <b className="text-lg">{brand} · {month} 포인트 정산서</b>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-paper2/60 text-left">
            <tr className="border-b border-line">
              <th className="px-4 py-2.5 font-bold">학생</th>
              <th className="px-4 py-2.5 font-bold">학원 적립</th>
              <th className="px-4 py-2.5 font-bold">부모님 용돈</th>
              <th className="px-4 py-2.5 font-bold">지급액</th>
              <th className="px-4 py-2.5 font-bold">상태</th>
              <th className="note-noprint px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, mp, paid }) => (
              <tr key={s.id} className="border-b border-line/60 align-middle">
                <td className="px-4 py-2.5">
                  <b>{s.name}</b> <span className="text-xs text-ink2">{s.grade}</span>
                </td>
                <td className="px-4 py-2.5 tabular-nums">
                  {won(mp.academyAmount)}
                  {mp.capped && <span className="ml-1 rounded bg-amber-soft px-1.5 py-0.5 text-[10px] font-bold text-amber">한도</span>}
                </td>
                <td className="px-4 py-2.5 tabular-nums">{mp.parentAmount > 0 ? `💝 ${won(mp.parentAmount)}` : '—'}</td>
                <td className="px-4 py-2.5 font-black tabular-nums text-pine-dark">{won(mp.total)}</td>
                <td className="px-4 py-2.5">
                  {paid
                    ? <span className="rounded bg-pine-soft px-2 py-0.5 text-xs font-bold text-pine-dark">지급 완료</span>
                    : <span className="text-xs text-ink2">미지급</span>}
                </td>
                <td className="note-noprint px-4 py-2.5 text-right">
                  <button onClick={() => setOpenId(openId === s.id ? null : s.id)}
                    className="mr-2 text-xs font-bold text-pine hover:underline">{openId === s.id ? '접기' : '내역·조정'}</button>
                  {!paid && mp.total > 0 && (
                    <button onClick={() => settle(s, mp)}
                      className="rounded-lg bg-pine px-3 py-1 text-xs font-bold text-paper">지급 처리</button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-ink2">재원생이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {openId && (() => {
        const row = rows.find(r => r.s.id === openId)
        if (!row) return null
        return <Detail key={openId} student={row.s} mp={row.mp} month={month} today={today}
          onAdd={addPointEntry} onRemove={removePointEntry} />
      })()}
    </div>
  )
}

function Detail({ student, mp, month, today, onAdd, onRemove }: {
  student: Student; mp: MonthPoint; month: string; today: string
  onAdd: ReturnType<typeof useStore>['addPointEntry']
  onRemove: (id: string) => void
}) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [minus, setMinus] = useState(false)
  const defaultDate = month === today.slice(0, 7) ? today : `${month}-01`
  const [date, setDate] = useState(defaultDate)

  function add() {
    const n = Math.abs(Number(amount) || 0)
    if (n <= 0) { alert('금액을 입력하세요.'); return }
    onAdd({ studentId: student.id, date, amount: minus ? -n : n, reason: reason.trim() || (minus ? '선생님 차감' : '선생님 보너스'), kind: 'manual', by: '선생님' })
    setAmount(''); setReason('')
  }

  return (
    <div className="note-noprint mt-4 rounded-2xl border border-line bg-white p-5">
      <p className="mb-3 font-black">{student.name} — {month} 상세</p>

      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl bg-paper2/50 p-3">
        <label className="grid gap-1 text-xs font-bold text-ink2">
          날짜<input type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT} />
        </label>
        <label className="grid gap-1 text-xs font-bold text-ink2">
          금액(원)<input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="1000" className={`${INPUT} w-28`} />
        </label>
        <label className="grid gap-1 text-xs font-bold text-ink2">
          사유<input value={reason} onChange={e => setReason(e.target.value)} placeholder="예: 수업 태도 우수" className={`${INPUT} w-56`} />
        </label>
        <label className="flex items-center gap-1.5 pb-2 text-sm">
          <input type="checkbox" checked={minus} onChange={e => setMinus(e.target.checked)} /> 차감
        </label>
        <button onClick={add} className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper">추가</button>
      </div>

      {(mp.manual.length > 0 || mp.parent.length > 0) && (
        <div className="mb-4 grid gap-1">
          {[...mp.manual, ...mp.parent].sort((a, b) => b.date.localeCompare(a.date)).map(e => (
            <div key={e.id} className="flex items-center gap-2 rounded-lg border border-line/60 px-3 py-1.5 text-sm">
              <span className="w-24 shrink-0 text-xs text-ink2">{e.date}</span>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${e.kind === 'parent' ? 'bg-amber-soft text-amber' : 'bg-paper2 text-ink2'}`}>
                {e.kind === 'parent' ? '💝 부모님' : '선생님'}
              </span>
              <span className="min-w-0 truncate">{e.reason}</span>
              <span className={`ml-auto shrink-0 font-black tabular-nums ${e.amount < 0 ? 'text-red-600' : 'text-pine-dark'}`}>
                {e.amount > 0 ? '+' : ''}{e.amount.toLocaleString('ko-KR')}
              </span>
              <button onClick={() => onRemove(e.id)} className="shrink-0 text-ink2 hover:text-ink" aria-label="삭제">✕</button>
            </div>
          ))}
        </div>
      )}

      <p className="mb-2 text-sm font-bold">일자별 적립</p>
      <div className="grid gap-1.5">
        {mp.days.map(d => (
          <div key={d.date} className="rounded-xl border border-line/60 px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-bold">{d.date.slice(5)}</span>
              <div className="grow" />
              <span className="font-black tabular-nums text-pine-dark">+{won(d.net)}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-ink2">
              {d.items.map((it, i) => (
                <span key={i} className={it.amount < 0 ? 'text-red-600' : ''}>
                  {it.label} {it.amount > 0 ? '+' : ''}{it.amount.toLocaleString('ko-KR')}
                </span>
              ))}
            </div>
          </div>
        ))}
        {mp.days.length === 0 && <p className="text-sm text-ink2">이번 달 적립 내역이 없습니다.</p>}
      </div>
    </div>
  )
}
