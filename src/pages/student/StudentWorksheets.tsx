import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../lib/store'
import { dateKey } from '../../lib/dates'
import { useStudentSelf } from './StudentShell'
import { useSupplement } from './supplement'
import {
  latestGradingFor, myWorksheetRows, statusOf, summaryOf, STATUS_CLASS, type StudentWsStatus,
} from './common'

const TABS = ['전체', '학습가능', '풀이중', '학습완료'] as const

// ── 학습지 탭 (매쓰플랫 학생앱 학습지 탭 구조) ──────────────────
// 상태 탭 + 표(출제일|상태|학습지명(N문제)|결과|보충학습[오답학습][심화학습])
export default function StudentWorksheets() {
  const me = useStudentSelf()
  const { assignments, worksheets, gradings } = useStore()
  const nav = useNavigate()
  const createSupplement = useSupplement(me)
  const [tab, setTab] = useState<typeof TABS[number]>('전체')

  const rows = useMemo(() => {
    return myWorksheetRows(assignments, worksheets, me.id).map(r => {
      const g = latestGradingFor(gradings, me.id, r.ws.id)
      return { ...r, g, st: statusOf(r.ws.id, g) as StudentWsStatus }
    })
  }, [assignments, worksheets, gradings, me.id])

  const counts = useMemo(() => {
    const c: Record<string, number> = { 전체: rows.length, 학습가능: 0, 풀이중: 0, 학습완료: 0 }
    for (const r of rows) c[r.st]++
    return c
  }, [rows])

  const shown = tab === '전체' ? rows : rows.filter(r => r.st === tab)

  return (
    <div>
      <h1 className="mb-4 text-xl font-black">학습지</h1>

      {/* 상태 탭 */}
      <div className="mb-4 flex gap-1.5">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              tab === t ? 'bg-pine text-paper' : 'border border-line bg-white text-ink2 hover:text-ink'}`}>
            {t} {counts[t]}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          {rows.length === 0 ? '아직 출제된 학습지가 없어요. 선생님이 학습지를 내주시면 여기에 나타나요.' : '해당 상태의 학습지가 없어요.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink2">
                <th className="px-4 py-2.5">출제일</th>
                <th className="py-2.5">상태</th>
                <th className="py-2.5">학습지명</th>
                <th className="py-2.5">결과</th>
                <th className="py-2.5 pr-4">보충학습</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ ws, date, g, st }) => {
                const sum = g ? summaryOf(ws, g) : null
                const wrongCount = g ? g.results.filter(r => !r.correct).length : 0
                const done = st === '학습완료' && !!g
                return (
                  <tr key={ws.id} className="border-b border-line/50 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-ink2">{dateKey(date).slice(2).replace(/-/g, '.')}</td>
                    <td className="py-3 whitespace-nowrap">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS[st]}`}>{st}</span>
                    </td>
                    <td className="py-3 pr-3">
                      <button onClick={() => nav(done ? `/student/result/${ws.id}` : `/student/solve/${ws.id}`)}
                        className="text-left font-bold hover:text-pine hover:underline">
                        {ws.title}
                      </button>
                      <div className="mt-0.5 text-xs text-pine">{ws.problemIds.length}문제</div>
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      {done && sum ? (
                        <button onClick={() => nav(`/student/result/${ws.id}`)}
                          className="rounded-lg border border-pine px-2.5 py-1 text-xs font-bold text-pine hover:bg-pine-soft">
                          {sum.score}점 <span className="ml-1 font-semibold text-clay">✕ {sum.wrong}</span> <span className="font-semibold text-pine-dark">○ {sum.correct}</span>
                        </button>
                      ) : (
                        <button onClick={() => nav(`/student/solve/${ws.id}`)}
                          className="rounded-lg bg-pine px-3 py-1 text-xs font-bold text-paper hover:brightness-110">
                          {st === '풀이중' ? '이어서 풀기' : '풀기'}
                        </button>
                      )}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {done && g ? (
                        <div className="flex gap-1.5">
                          <button onClick={() => createSupplement('오답학습', ws, g)}
                            disabled={wrongCount === 0}
                            title={wrongCount === 0 ? '오답이 없어요' : '틀린 유형의 쌍둥이·유사 문제로 다시 연습해요'}
                            className="rounded-lg border border-clay/60 px-2.5 py-1 text-xs font-bold text-clay hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent">
                            ⊕ 오답학습
                          </button>
                          <button onClick={() => createSupplement('심화학습', ws, g)}
                            title="같은 유형을 한 단계 어렵게 연습해요"
                            className="rounded-lg border border-pine/60 px-2.5 py-1 text-xs font-bold text-pine hover:bg-pine-soft">
                            📊 심화학습
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-ink2/50">학습 완료 후 가능</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
