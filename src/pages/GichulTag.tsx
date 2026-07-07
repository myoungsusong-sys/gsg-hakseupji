import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { curriculumFor, defaultCurriculumForGrade } from '../data/curriculum'
import { useStore, uid } from '../lib/store'
import type { Diff, Kind } from '../types'
import { DIFF_LABEL, DIFFS } from '../types'
import GradeSelect from '../components/GradeSelect'
import { examTitle, type ExamPaper } from './CsatLibrary'

interface Prob { no: number; img: string; page: number }
interface Row { typeId: string; kind: Kind; diff: Diff; answer: string }

// 기출 문항 태깅: 자동 크롭 문항에 유형·정답을 달아 문제은행에 편입.
// 빠른 태깅: 유형 아래로 채우기(fill-down) + 전체 일괄 편입.
export default function GichulTag() {
  const { id } = useParams()
  const nav = useNavigate()
  const { problems, addProblem } = useStore()
  const [probs, setProbs] = useState<Prob[] | null>(null)
  const [paper, setPaper] = useState<ExamPaper | null>(null)
  const [gradeId, setGradeId] = useState('m1-1')
  const cur = curriculumFor(gradeId)
  const [rows, setRows] = useState<Row[]>([])
  const [zoom, setZoom] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/gichul/${id}/probs.json`).then(r => r.ok ? r.json() : null).then(setProbs).catch(() => setProbs(null))
    fetch('/gichul/index.json').then(r => r.json()).then((all: ExamPaper[]) => {
      const p = all.find(x => x.id === id) ?? null
      setPaper(p)
      if (p) {
        const bySubj: Record<string, string> = { 기하: 'h-geo', 확률과통계: 'h-stat', 미적분: 'h-calc2' }
        setGradeId((p.subject && bySubj[p.subject]) || defaultCurriculumForGrade(p.grade))
      }
    }).catch(() => {})
  }, [id])

  const firstType = cur.units[0].mids[0].subs[0].types[0].id
  // probs·과정 바뀌면 행 초기화
  useEffect(() => {
    if (!probs) return
    setRows(probs.map(pr => ({ typeId: firstType, kind: pr.no <= 21 ? '객관식' : '주관식', diff: 3, answer: '' })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probs, gradeId])

  const source = paper ? `${paper.grade} ${examTitle(paper)}` : (id ?? '기출')
  const added = useMemo(() => {
    const s = new Set<number>()
    for (const p of problems) {
      if (p.imageUrl && p.imageUrl.includes(`/${id}/`)) {
        const m = p.imageUrl.match(/q(\d+)\.png/); if (m) s.add(Number(m[1]))
      }
    }
    return s
  }, [problems, id])

  if (probs === null) return <Msg nav={nav}>이 회차는 아직 <b>문항 크롭</b>이 안 됐습니다. 터미널에서 <code className="rounded bg-paper2 px-1">crop_problems.py {id}</code> 실행 후 새로고침하세요.</Msg>
  if (probs.length === 0) return <Msg nav={nav}>이 회차는 <b>스캔 이미지 PDF(텍스트 없음)</b>라 문항 자동 분리가 안 됩니다. <b>열람·인쇄</b>로는 원본 그대로 쓸 수 있습니다. (주로 2006~2011년 구형)</Msg>
  if (rows.length !== probs.length) return <div className="text-ink2">준비 중…</div>

  function setRow(i: number, patch: Partial<Row>) {
    setRows(prev => prev.map((r, j) => j === i ? { ...r, ...patch } : r))
  }
  function fillDown(i: number) {
    setRows(prev => prev.map((r, j) => j > i ? { ...r, typeId: prev[i].typeId } : r))
  }
  function commitAll() {
    let n = 0
    probs!.forEach((pr, i) => {
      if (added.has(pr.no)) return
      const r = rows[i]
      addProblem({
        id: uid('gq'), typeId: r.typeId, kind: r.kind, diff: r.diff,
        body: `${source} ${pr.no}번`, answer: r.answer || '—', solution: '(해설지 참고)',
        source, imageUrl: pr.img, custom: true,
      })
      n++
    })
    alert(`${n}문항을 문제은행에 편입했습니다.`)
  }

  const pending = probs.filter(pr => !added.has(pr.no)).length

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button onClick={() => nav('/prep/csat')} className="rounded-lg border border-line px-4 py-2 text-sm">← 기출 목록</button>
        <h1 className="text-lg font-black">{source} — 문항 태깅</h1>
        <span className="rounded-full bg-pine-soft px-3 py-1 text-xs font-bold text-pine-dark">{added.size}/{probs.length} 편입</span>
      </div>

      <div className="sticky top-16 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper/95 p-3 text-sm backdrop-blur">
        <span className="text-ink2">이 시험지의 과정:</span>
        <GradeSelect value={gradeId} onChange={setGradeId} />
        <span className="text-xs text-ink2">문항마다 유형을 고르고, <b className="text-pine">↓아래로 채우기</b>로 같은 유형을 이어 적용하세요.</span>
        <div className="grow" />
        <button onClick={commitAll} disabled={pending === 0}
          className="rounded-lg bg-amber px-5 py-2 font-bold text-white disabled:opacity-40">
          미편입 {pending}문항 전체 편입
        </button>
      </div>

      <div className="grid gap-3">
        {probs.map((pr, i) => {
          const done = added.has(pr.no)
          const r = rows[i]
          return (
            <div key={pr.no} className={`flex flex-wrap items-start gap-4 rounded-2xl border p-4 ${done ? 'border-pine bg-pine-soft/20' : 'border-line bg-white'}`}>
              <button onClick={() => setZoom(pr.img)} className="w-56 shrink-0 overflow-hidden rounded-lg border border-line bg-white" title="확대">
                <img src={pr.img} alt={`${pr.no}번`} className="max-h-40 w-full object-contain object-top" />
              </button>
              <div className="min-w-[260px] grow">
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <b className="text-pine-dark">{pr.no}번</b>
                  {done && <span className="rounded bg-pine px-1.5 py-0.5 text-[10px] font-bold text-paper">편입됨</span>}
                </div>
                {!done && (
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-1.5">
                      <select value={r.typeId} onChange={e => setRow(i, { typeId: e.target.value })} className="min-w-0 grow rounded-lg border border-line px-2 py-1.5">
                        {cur.units.flatMap(u => u.mids.flatMap(m => m.subs.flatMap(s => s.types.map(t => (
                          <option key={t.id} value={t.id}>{u.name} › {t.name}</option>
                        )))))}
                      </select>
                      <button onClick={() => fillDown(i)} title="이 유형을 아래 문항에 모두 적용"
                        className="shrink-0 rounded-lg border border-pine px-2 py-1.5 text-xs font-semibold text-pine hover:bg-pine-soft">↓ 아래로</button>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={r.kind} onChange={e => setRow(i, { kind: e.target.value as Kind })} className="rounded-lg border border-line px-2 py-1.5">
                        <option value="객관식">객관식</option><option value="주관식">주관식</option>
                      </select>
                      <select value={r.diff} onChange={e => setRow(i, { diff: Number(e.target.value) as Diff })} className="rounded-lg border border-line px-2 py-1.5">
                        {DIFFS.map(d => <option key={d} value={d}>{DIFF_LABEL[d]}</option>)}
                      </select>
                      <input value={r.answer} onChange={e => setRow(i, { answer: e.target.value })} placeholder="정답"
                        className="w-24 rounded-lg border border-line px-2 py-1.5" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {zoom && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/60 p-6" onClick={() => setZoom(null)}>
          <img src={zoom} alt="문항 확대" className="max-h-[90vh] max-w-3xl rounded-lg bg-white" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

function Msg({ nav, children }: { nav: (p: string) => void; children: React.ReactNode }) {
  return (
    <div>
      <button onClick={() => nav('/prep/csat')} className="mb-4 rounded-lg border border-line px-4 py-2 text-sm">← 기출 목록</button>
      <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">{children}</div>
    </div>
  )
}

