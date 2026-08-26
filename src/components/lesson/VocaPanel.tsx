import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import { dateKey } from '../../lib/dates'
import { loadVoca, nextDay, vocaBookOf } from '../../lib/voca'
import type { Student } from '../../types'

// ── 🔤 영어단어 (수업 > 학생 탭) ─────────────────────────────────────────────
//
// 명수쌤 2026-08-25: "학습지앱에 영어단어 항목 만들어줘."
// 학생앱에는 단어시험이 있었는데 **선생님 화면에는 아무것도 없었다.** 누가 어디까지 외웠는지,
// 무엇을 틀렸는지 볼 데가 없으니 지도할 수가 없다.
//
// 🔴 새 저장소를 만들지 않는다. 학생앱 단어시험은 결과를 평범한 Grading 으로 남긴다
//    (교재 = 학년별 단어장, pageFrom = DAY, itemId = `voca-<day>-<번호>`).
//    여기서는 그걸 읽어 보여 주기만 한다 — 기록이 두 벌이 되면 반드시 어긋난다.

export default function VocaPanel({ student }: { student: Student }) {
  const { gradings, workbooks } = useStore()
  const book = useMemo(() => vocaBookOf(student.grade), [student.grade])
  const [all, setAll] = useState<Record<string, [string, string][]> | null>(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    setAll(null); setErr('')
    loadVoca(book.file).then(setAll).catch(e => setErr(String(e?.message ?? e)))
  }, [book.file])

  // 이 학생의 단어장 교재 (학생앱이 학생당 1권 만든다)
  const wb = useMemo(
    () => workbooks.find(w => w.studentId === student.id && w.name === book.name),
    [workbooks, student.id, book.name])

  const rows = useMemo(() => {
    if (!wb) return []
    return gradings
      .filter(g => g.studentId === student.id && g.workbookId === wb.id && g.pageFrom != null)
      .map(g => {
        const total = g.results.length
        const right = g.results.filter(r => r.correct).length
        const careless = g.results.filter(r => r.careless).length
        return { day: g.pageFrom as number, date: dateKey(g.date), total, right, careless, results: g.results }
      })
      .sort((a, b) => b.day - a.day)
  }, [gradings, wb, student.id])

  const doneDays = rows.map(r => r.day)
  const today = nextDay(doneDays, book.days)
  const avg = rows.length
    ? Math.round(rows.reduce((s, r) => s + (r.total ? r.right / r.total : 0), 0) / rows.length * 100)
    : null

  const card = 'rounded-2xl border border-line bg-white p-5'

  return (
    <div className="grid gap-4">
      <div className={card}>
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-black">🔤 영어단어</h2>
          <span className="rounded-full bg-paper2 px-2.5 py-1 text-xs font-semibold text-ink2">{book.name}</span>
          <span className="text-xs text-ink2">학년에 맞는 단어장이 자동으로 정해집니다 (중등 / 고1 / 고2·3)</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['본 DAY', `${rows.length} / ${book.days}`],
            ['다음 DAY', `DAY ${today}`],
            ['평균 점수', avg == null ? '—' : `${avg}점`],
            ['외운 단어', `${rows.reduce((s, r) => s + r.right, 0)}개`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-paper2/60 px-3 py-2.5">
              <div className="text-[11px] font-semibold text-ink2">{k}</div>
              <div className="text-lg font-black tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink2">
          학생은 <b className="text-ink">학생앱 → 영단어</b>에서 뜻을 보고 영단어를 씁니다(25개, 자동채점 + 틀린 것 재시험).
          종이 단어장·시험지는 <b className="text-ink">기본과제 → 일괄 PDF</b>에서 함께 나옵니다.
        </p>
      </div>

      {err && <div className={`${card} text-sm text-clay`}>단어장을 불러오지 못했습니다 — {err}</div>}

      <div className={card}>
        <b className="text-sm">DAY별 기록</b>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-ink2">아직 본 단어시험이 없습니다. 학생앱 영단어에서 DAY {today}부터 시작합니다.</p>
        ) : (
          <div className="mt-3 grid gap-1.5">
            {rows.map(r => {
              const words = all?.[String(r.day)] ?? []
              const wrong = r.results
                .map((x, i) => ({ x, i }))
                .filter(({ x }) => !x.correct || x.careless)
              const score = r.total ? Math.round(r.right / r.total * 100) : 0
              const on = open === r.day
              return (
                <div key={r.day} className="rounded-xl border border-line/70">
                  <button onClick={() => setOpen(on ? null : r.day)}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left text-sm">
                    <b className="w-[4.5rem] shrink-0">DAY {r.day}</b>
                    <span className="w-20 shrink-0 text-xs text-ink2">{r.date.slice(5)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-black ${
                      score >= 90 ? 'bg-pine-soft text-pine-dark' : score >= 70 ? 'bg-amber-soft text-amber' : 'bg-red-100 text-red-800'}`}>
                      {r.right} / {r.total} · {score}점
                    </span>
                    {r.careless > 0 && (
                      <span className="rounded bg-paper2 px-1.5 py-0.5 text-[11px] font-bold text-ink2">
                        다시 풀어 맞힘 {r.careless}
                      </span>
                    )}
                    <div className="grow" />
                    <span className="text-xs font-bold text-pine">{on ? '접기 ▲' : `틀린 단어 ${wrong.length}개 보기 ▼`}</span>
                  </button>
                  {on && (
                    <div className="border-t border-line/70 px-3 py-3">
                      {wrong.length === 0 ? (
                        <p className="text-sm text-ink2">다 맞혔습니다.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-ink2">
                              <th className="w-8 pb-1.5">#</th>
                              <th className="pb-1.5">뜻</th>
                              <th className="w-32 pb-1.5">정답</th>
                              <th className="w-32 pb-1.5">학생이 쓴 답</th>
                              <th className="w-24 pb-1.5">다시 풀기</th>
                            </tr>
                          </thead>
                          <tbody>
                            {wrong.map(({ x, i }) => {
                              const [w, mean] = words[i] ?? ['', '']
                              return (
                                <tr key={i} className="border-t border-line/60">
                                  <td className="py-1.5 text-xs text-ink2">{i + 1}</td>
                                  <td className="py-1.5">{mean || <span className="text-ink2">—</span>}</td>
                                  <td className="py-1.5 font-bold">{w}</td>
                                  <td className="py-1.5 text-clay">{x.studentAnswer || <span className="text-ink2">(빈칸)</span>}</td>
                                  <td className="py-1.5">
                                    {x.careless
                                      ? <span className="rounded bg-pine-soft px-1.5 py-0.5 text-[11px] font-bold text-pine-dark">맞힘 {x.retryAnswer ? `(${x.retryAnswer})` : ''}</span>
                                      : <span className="text-xs text-ink2">—</span>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )}
                      {!all && !err && <p className="mt-2 text-xs text-ink2">단어를 불러오는 중…</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
