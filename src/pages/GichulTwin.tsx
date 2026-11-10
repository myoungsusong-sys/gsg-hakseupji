import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, uid } from '../lib/store'
import { useBrand } from '../lib/brand'
import { useSubject } from '../lib/subject'
import { courseIdOfType, courseTagOfType, curriculumFor, typeName } from '../data/curriculum'
import { DEFAULT_SHEET_OPTIONS, type Problem } from '../types'
import { examTitle, type ExamPaper } from './CsatLibrary'

// 모의고사 쌍둥이·유사 (workerD 11/10) — 기출은 원본 그림이라 숫자를 바꿀 수 없다.
// 대신 문항마다 유형을 정하고(선생님이 «문항 태깅»에서 편입한 유형 → 없으면 자동 추천 유형),
// 우리 문제은행의 **같은 유형 문제**를 뽑아 학습지로 만든다. AI·크레딧 0.
interface Tag { t: string; c: string; s: number }
// tags: 태깅 트리 추천 상위 3 · tw: 과탐용 22개정(문제은행 있는) 트리 추천 1 — scripts/gichul_autotag.py
interface Prob { no: number; img: string; tags?: Tag[]; tw?: Tag }
interface Row { no: number; img: string; typeId: string | null; from: '편입' | '추천' | null; picks: Problem[] }

export default function GichulTwin() {
  const nav = useNavigate()
  const brand = useBrand()
  const [area] = useSubject()
  const { problems, ensureCourse, saveWorksheet } = useStore()
  const [papers, setPapers] = useState<ExamPaper[] | null>(null)
  const [pid, setPid] = useState('')
  const [probs, setProbs] = useState<Prob[] | null>(null)
  const [per, setPer] = useState(2)
  const [withOrig, setWithOrig] = useState(true)

  useEffect(() => {
    fetch('/gichul/index.json').then(r => r.json())
      .then((all: ExamPaper[]) => setPapers(all.filter(p => (p.area ?? '수학') === (area === '과학' ? '과학' : '수학'))))
      .catch(() => setPapers([]))
  }, [area])
  const paper = papers?.find(p => p.id === pid) ?? null

  useEffect(() => {
    setProbs(null)
    if (!pid) return
    fetch(`/gichul/${pid}/probs.json`).then(r => r.ok ? r.json() : []).then(setProbs).catch(() => setProbs([]))
  }, [pid])

  // 추천 유형이 속한 과정 문제를 불러온다
  useEffect(() => {
    if (!probs) return
    const cs = new Set<string>()
    for (const pr of probs) for (const tg of [...(pr.tags ?? []), ...(pr.tw ? [pr.tw] : [])]) cs.add(tg.c)
    cs.forEach(c => ensureCourse(c))
  }, [probs, ensureCourse])

  const rows: Row[] = useMemo(() => {
    if (!probs) return []
    // 선생님이 이미 편입한 원문항(이미지 주소가 이 회차) → 그 유형이 우선
    const committed = new Map<number, Problem>()
    for (const p of problems) {
      if (!p.imageUrl?.includes(`/${pid}/`)) continue
      const m = p.imageUrl.match(/q(\d+)\.(?:png|jpg)/); if (m) committed.set(Number(m[1]), p)
    }
    const byType = new Map<string, Problem[]>()
    for (const p of problems) {
      if (p.imageUrl?.includes('/gichul/')) continue   // 기출 원문항끼리는 쌍둥이로 안 쓴다
      const a = byType.get(p.typeId); if (a) a.push(p); else byType.set(p.typeId, [p])
    }
    const used = new Set<string>()
    return probs.map(pr => {
      const c = committed.get(pr.no)
      // 편입한 유형 → 22개정 쌍둥이 유형(tw) → 추천 1~3순위 중 문제은행에 문제가 있는 첫 유형
      const order = [c?.typeId, pr.tw?.t, ...(pr.tags ?? []).map(t => t.t)].filter(Boolean) as string[]
      const typeId = order.find(t => byType.get(t)?.length) ?? order[0] ?? null
      const pool = typeId ? (byType.get(typeId) ?? []) : []
      // 난이도 3(중) 가까운 것부터, 한 학습지에 같은 문제 두 번 안 나오게
      const picks = [...pool].sort((a, b) => Math.abs(a.diff - (c?.diff ?? 3)) - Math.abs(b.diff - (c?.diff ?? 3)))
        .filter(p => !used.has(p.id)).slice(0, per)
      picks.forEach(p => used.add(p.id))
      return { no: pr.no, img: pr.img, typeId, from: c && typeId === c.typeId ? '편입' : typeId ? '추천' : null, picks }
    })
  }, [probs, problems, pid, per])

  const total = rows.reduce((n, r) => n + r.picks.length, 0)
  const committedIds = useMemo(() => {
    const ids: string[] = []
    for (const p of problems) if (p.imageUrl?.includes(`/${pid}/`)) ids.push(p.id)
    return ids
  }, [problems, pid])

  function make() {
    if (!paper || total === 0) return
    const ids: string[] = []
    for (const r of rows) {
      if (withOrig) {
        const o = problems.find(p => p.imageUrl?.includes(`/${pid}/`) && new RegExp(`q${r.no}\\.(png|jpg)`).test(p.imageUrl))
        if (o) ids.push(o.id)
      }
      ids.push(...r.picks.map(p => p.id))
    }
    const id = uid('ws')
    const first = rows.find(r => r.typeId)?.typeId ?? ''
    saveWorksheet({
      id, title: `${examTitle(paper)} 쌍둥이·유사`, author: brand,
      grade: (first && courseTagOfType(first)) || paper.grade,
      tags: ['모의고사 쌍둥이'], theme: 'amber', problemIds: ids, conceptIds: [],
      options: { ...DEFAULT_SHEET_OPTIONS }, listIds: [], createdAt: new Date().toISOString(), deletedAt: null,
    })
    nav(`/worksheet/${id}`)
  }

  if (!papers) return <div className="text-ink2">불러오는 중…</div>
  return (
    <div>
      <div className="mb-4 rounded-2xl border border-line bg-white p-5 text-sm text-ink2">
        <b className="text-ink">모의고사 쌍둥이·유사</b> — 기출 회차를 고르면 문항마다 유형을 찾아 <b>우리 문제은행의 같은 유형 문제</b>를 뽑아 학습지로 만듭니다.
        유형은 «문항 태깅»에서 편입한 것이 먼저, 없으면 자동 추천(⭐)을 씁니다.
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <select value={pid} onChange={e => setPid(e.target.value)} className="min-w-[280px] rounded-lg border border-line px-3 py-2">
          <option value="">회차 고르기 ({papers.length}회차)</option>
          {papers.map(p => <option key={p.id} value={p.id}>{p.grade} {examTitle(p)}</option>)}
        </select>
        <span className="text-ink2">문항당</span>
        <select value={per} onChange={e => setPer(Number(e.target.value))} className="rounded-lg border border-line px-2 py-2">
          {[1, 2, 3].map(n => <option key={n} value={n}>{n}문제</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-ink2">
          <input type="checkbox" checked={withOrig} onChange={e => setWithOrig(e.target.checked)} className="accent-pine" />
          편입한 원문항도 넣기 ({committedIds.length})
        </label>
        <div className="grow" />
        <button onClick={make} disabled={total === 0} className="rounded-lg bg-amber px-5 py-2 font-bold text-white disabled:opacity-40">
          학습지로 만들기 ({total}문제)
        </button>
      </div>

      {pid && probs === null && <div className="text-ink2">불러오는 중…</div>}
      {probs && probs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-10 text-center text-sm text-ink2">
          이 회차는 문항 자르기가 안 된 스캔본이라 쌍둥이를 찾을 수 없습니다. «열람·인쇄»로 원본을 쓰세요.
        </div>
      )}
      <div className="grid gap-2">
        {rows.map(r => (
          <div key={r.no} className="flex flex-wrap items-start gap-3 rounded-xl border border-line bg-white p-3">
            <img src={r.img} alt={`${r.no}번`} className="max-h-28 w-44 shrink-0 rounded border border-line object-contain object-top" />
            <div className="min-w-[220px] grow text-sm">
              <div className="mb-1"><b className="text-pine-dark">{r.no}번</b>{' '}
                {r.typeId ? <span className="text-ink2">{r.from === '추천' ? '⭐ ' : '✅ '}{typeName(r.typeId)}
                  <span className="text-xs"> · {curriculumFor(courseIdOfType(r.typeId)).label}</span></span> : <span className="text-ink2">유형 없음</span>}
              </div>
              <div className="text-xs text-ink2">
                {r.picks.length ? `같은 유형 ${r.picks.length}문제 뽑음` : r.typeId ? '이 유형 문제가 아직 문제은행에 없습니다(불러오는 중일 수 있음)' : '—'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
