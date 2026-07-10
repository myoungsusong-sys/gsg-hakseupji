import { useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import { typeName } from '../../data/curriculum'
import MathText from '../MathText'
import type { Student } from '../../types'

function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

// 수업 > 풀이피드백: 학생이 학생앱에서 올린 풀이에 대한 AI 피드백을 선생님이 열람
// (베끼기 의심 = 풀이 과정 없이 답만/낙서 → hasWork=false)
export default function SolveFeedbackPanel({ student }: { student: Student }) {
  const { solveFeedbacks, worksheets, problems } = useStore()

  const mine = useMemo(
    () => solveFeedbacks.filter(f => f.studentId === student.id).sort((a, b) => b.at.localeCompare(a.at)),
    [solveFeedbacks, student.id],
  )
  const suspectCount = mine.filter(f => !f.hasWork).length
  const [onlySuspect, setOnlySuspect] = useState(false)
  const shown = onlySuspect ? mine.filter(f => !f.hasWork) : mine

  const wsName = (id: string) => worksheets.find(w => w.id === id)?.title ?? '학습지'
  const probNo = (wsId: string, pid: string) => {
    const w = worksheets.find(x => x.id === wsId)
    const i = w ? w.problemIds.indexOf(pid) : -1
    return i >= 0 ? i + 1 : null
  }
  const probType = (pid: string) => {
    const p = problems.find(x => x.id === pid)
    return p ? typeName(p.typeId) : ''
  }

  if (mine.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
        아직 <b>{student.name}</b> 학생의 풀이 피드백이 없습니다.<br />
        학생이 학생앱에서 문제별 <b>‘✏️ 풀이 쓰고 AI 피드백 받기’</b>로 풀이(필기·사진)를 올리면 여기에 쌓입니다.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-bold">풀이 피드백 <b className="text-pine">{mine.length}</b>건</span>
        {suspectCount > 0 && (
          <span className="rounded-md bg-amber-soft px-2 py-1 text-xs font-bold text-amber">⚠️ 베끼기 의심 {suspectCount}건 (과정 없이 답만)</span>
        )}
        <div className="grow" />
        <label className="flex items-center gap-1.5 text-xs text-ink2">
          <input type="checkbox" checked={onlySuspect} onChange={e => setOnlySuspect(e.target.checked)} />
          베끼기 의심만 보기
        </label>
      </div>

      <div className="grid gap-2.5">
        {shown.map(f => {
          const no = probNo(f.worksheetId, f.problemId)
          return (
            <div key={f.id} className={`rounded-2xl border p-4 ${f.hasWork ? 'border-line bg-white' : 'border-amber bg-amber-soft/40'}`}>
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-sm">
                <b>{wsName(f.worksheetId)}</b>
                {no != null && <span className="rounded bg-paper2 px-1.5 py-0.5 text-xs font-bold text-ink2">{no}번</span>}
                <span className="text-xs text-ink2">{probType(f.problemId)}</span>
                {!f.hasWork
                  ? <span className="rounded bg-amber px-2 py-0.5 text-[11px] font-bold text-white">⚠️ 베끼기 의심</span>
                  : f.correct === true ? <span className="rounded bg-pine-soft px-2 py-0.5 text-[11px] font-bold text-pine-dark">정답</span>
                  : f.correct === false ? <span className="rounded bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800">오답</span>
                  : <span className="rounded bg-paper2 px-2 py-0.5 text-[11px] font-bold text-ink2">확인</span>}
                <div className="grow" />
                <span className="text-xs text-ink2">{fmtTime(f.at)}</span>
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                <MathText text={f.feedback} />
              </div>
            </div>
          )
        })}
        {shown.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-white/60 p-8 text-center text-sm text-ink2">
            베끼기 의심 건이 없습니다. 👍
          </div>
        )}
      </div>
    </div>
  )
}
