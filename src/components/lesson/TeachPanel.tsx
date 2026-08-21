import { useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import { dateKey, todayKey } from '../../lib/dates'
import { typeName } from '../../data/curriculum'
import MathText, { isImageUrl } from '../MathText'
import type { Grading, GradeResult, Problem, Student } from '../../types'

// ── 👨‍🏫 지도 패널 — 호출한 학생의 「틀린 문제」를 문제·해설과 함께 바로 본다 ──────
//
// 왜 만들었나 (2026-08-21 명수쌤): "선생님이 틀린 문제 바로 보고 가르쳐줄 수 있게 문제도 다 넣어줘."
// 지금까지 「오늘 교실」은 **오답 개수만** 보여줬다. 선생님은 몇 개 틀렸는지는 알아도
// 무엇을 틀렸는지 몰라서, 학생을 부른 뒤 그제야 종이를 받아 들여다봐야 했다.
//
// 🔴 이게 되는 이유: 기본과제를 **문제은행에서** 뽑기 때문이다. 문제은행 문항은
//    problem.png(문제)·solution.png(해설) 이미지를 갖고 있다. 교재 매칭표로 냈으면
//    정답 글자만 있어서 이 화면 자체가 불가능하다.

type Wrong = {
  p?: Problem
  r: GradeResult
  label: string        // 어느 학습지·교재 몇 번
  no: number
}

export default function TeachPanel({ student, onClose }: { student: Student; onClose: () => void }) {
  const { gradings, worksheets, problems, workbooks, wbItems, upsertGrading } = useStore()
  const [openSol, setOpenSol] = useState<Set<string>>(new Set())
  const today = todayKey()

  const pMap = useMemo(() => new Map(problems.map(p => [p.id, p])), [problems])
  const wsMap = useMemo(() => new Map(worksheets.map(w => [w.id, w])), [worksheets])
  const wbMap = useMemo(() => new Map(workbooks.map(w => [w.id, w])), [workbooks])
  const itemMap = useMemo(() => new Map(wbItems.map(i => [i.id, i])), [wbItems])

  // 오늘 이 학생이 틀린 것만 — 실수(careless)로 다시 맞힌 것과 승인 대기는 뺀다
  const wrongs = useMemo(() => {
    const out: Wrong[] = []
    for (const g of gradings as Grading[]) {
      if (g.studentId !== student.id || dateKey(g.date) !== today) continue
      const ws = g.worksheetId ? wsMap.get(g.worksheetId) : undefined
      const wb = g.workbookId ? wbMap.get(g.workbookId) : undefined
      const base = ws?.title ?? wb?.name ?? '교재'
      g.results.forEach((r, i) => {
        if (r.pending || r.correct || r.careless) return
        const pid = r.itemId ?? ws?.problemIds[i]
        const p = pid ? pMap.get(pid) : undefined
        const it = pid ? itemMap.get(pid) : undefined
        const no = it?.no ?? i + 1
        out.push({ p, r, label: base, no })
      })
    }
    return out
  }, [gradings, student.id, today, wsMap, wbMap, pMap, itemMap])

  // 이 자리에서 「설명 끝」을 눌러 오답을 해결 처리한다 — careless 로 표시해 통계에서 실수로 분리
  function markTaught(w: Wrong) {
    for (const g of gradings as Grading[]) {
      if (g.studentId !== student.id || dateKey(g.date) !== today) continue
      const idx = g.results.findIndex(r => r === w.r)
      if (idx < 0) continue
      const results = g.results.map((r, i) => i === idx
        ? { ...r, careless: true, taughtAt: new Date().toISOString() } : r)
      upsertGrading({ ...g, results })
      return
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-auto bg-black/40 p-4"
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="my-4 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-base font-black">👨‍🏫 {student.name} 학생 — 틀린 문제 {wrongs.length}개</h2>
          <div className="grow" />
          <button onClick={onClose} className="text-xl leading-none text-ink2 hover:text-ink">×</button>
        </div>

        {wrongs.length === 0 ? (
          <div className="rounded-xl bg-paper2 px-4 py-8 text-center text-sm text-ink2">
            오늘 틀린 문제가 없습니다. (실수로 다시 맞힌 것·승인 대기는 빼고 셉니다)
          </div>
        ) : (
          <div className="grid gap-3">
            {wrongs.map((w, i) => {
              const key = `${w.label}#${w.no}#${i}`
              const solOpen = openSol.has(key)
              return (
                <div key={key} className="rounded-xl border border-line p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-clay px-2 py-0.5 font-bold text-white">{w.no}번</span>
                    <span className="text-ink2">{w.label}</span>
                    {w.p && <span className="text-ink2">· {typeName(w.p.typeId)}</span>}
                    <div className="grow" />
                    {w.r.studentAnswer && (
                      <span className="text-ink2">쓴 답 <b className="text-clay">{w.r.studentAnswer}</b></span>
                    )}
                    {w.r.unknown && <span className="rounded bg-amber/20 px-1.5 py-0.5 font-bold text-ink">모름</span>}
                  </div>

                  {/* 문제 — 문제은행 문항이면 이미지가 있다 */}
                  {w.p?.imageUrl
                    ? <img src={w.p.imageUrl} alt={`${w.no}번 문제`} className="w-full rounded-lg border border-line/60" />
                    : w.p?.body
                      ? <div className="rounded-lg bg-paper2/60 p-3 text-sm"><MathText text={w.p.body} /></div>
                      : <div className="rounded-lg bg-paper2/60 p-3 text-xs text-ink2">
                          교재 문항이라 앱에 문제가 없어요 — 책 {w.no}번을 펴세요.
                        </div>}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {w.p && (
                      <span className="text-xs">
                        정답 <b className="text-pine-dark">
                          {isImageUrl(w.p.answer) ? '(해설 참조)' : w.p.answer}
                        </b>
                      </span>
                    )}
                    <div className="grow" />
                    {w.p?.solution && (
                      <button onClick={() => setOpenSol(s => {
                        const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n
                      })}
                        className="rounded-lg border border-line px-2.5 py-1 text-xs font-bold text-ink2 hover:border-pine">
                        {solOpen ? '해설 접기' : '📝 해설 보기'}
                      </button>
                    )}
                    <button onClick={() => markTaught(w)}
                      className="rounded-lg bg-pine px-3 py-1 text-xs font-bold text-paper hover:brightness-110">
                      ✓ 설명함
                    </button>
                  </div>

                  {solOpen && w.p?.solution && (
                    isImageUrl(w.p.solution)
                      ? <img src={w.p.solution} alt="해설" className="mt-2 w-full rounded-lg border border-line/60" />
                      : <div className="mt-2 rounded-lg bg-paper2/60 p-3 text-sm"><MathText text={w.p.solution} /></div>
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
