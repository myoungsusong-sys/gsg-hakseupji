import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GradeSelect from '../components/GradeSelect'
import MathText from '../components/MathText'
import { curriculumFor } from '../data/curriculum'
import { useStore, uid } from '../lib/store'
import { useBrand } from '../lib/brand'
import { DEFAULT_SHEET_OPTIONS } from '../types'
import { loadEssay, hasEssay, ESSAY_COURSES, essayTier, type EssaySet } from '../data/essay'

// 서술형 — 매쓰플랫 단원별 서술형 세트(기본/일반/심화, 10문제) 그대로. 미리보기 + 학습지 만들기.
// 정답이 이미지(answer.png)인 문항은 이미지로, 텍스트 정답은 그대로 렌더.

const TIER_STYLE: Record<string, string> = {
  기본: 'bg-pine-soft text-pine-dark',
  일반: 'bg-sky-100 text-sky-700',
  심화: 'bg-clay/15 text-clay',
}

const DEFAULT_COURSE = ESSAY_COURSES.includes('m1-1') ? 'm1-1' : ESSAY_COURSES[0]

function isImgAnswer(a: string) { return /\/answer\.png$/.test(a) }

export default function EssayPage() {
  const { addProblem, saveWorksheet, customProblems } = useStore()
  const brand = useBrand()
  const nav = useNavigate()

  const [courseId, setCourseId] = useState<string>(DEFAULT_COURSE)
  const [sets, setSets] = useState<EssaySet[]>([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<EssaySet | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    loadEssay(courseId).then(s => { if (alive) { setSets(s); setLoading(false) } })
    return () => { alive = false }
  }, [courseId])

  // 단원(chapter)별 그룹
  const byChapter = useMemo(() => {
    const m = new Map<string, EssaySet[]>()
    for (const s of sets) { const k = s.chapter || '기타'; (m.get(k) ?? m.set(k, []).get(k)!).push(s) }
    return [...m.entries()]
  }, [sets])

  function makeWorksheet(set: EssaySet) {
    const existing = new Set(customProblems.map(p => p.id))
    const ids: string[] = []
    for (const p of set.problems) {
      if (!existing.has(p.id)) { addProblem(p); existing.add(p.id) }
      ids.push(p.id)
    }
    const now = new Date()
    const wsId = uid('ws')
    saveWorksheet({
      id: wsId,
      title: `서술형 · ${set.title.replace(/^\[[^\]]+\]\s*/, '')}`,
      author: brand,
      grade: curriculumFor(courseId).grade,
      tags: ['서술형'],
      theme: 'pine',
      problemIds: ids,
      conceptIds: [],
      options: { ...DEFAULT_SHEET_OPTIONS },
      listIds: [],
      createdAt: now.toISOString(),
      deletedAt: null,
    })
    nav(`/worksheet/${wsId}`)
  }

  const courseLabel = curriculumFor(courseId).label

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-black">서술형</h1>
        <span className="rounded bg-clay px-1.5 py-0.5 text-[10px] font-bold text-white">N</span>
        <div className="grow" />
        <GradeSelect value={courseId} onChange={setCourseId} />
      </div>
      <p className="mb-3 text-sm text-ink2">
        <b className="text-ink">{courseLabel}</b> · 단원별 서술형 세트(기본·일반·심화, 10문제)
        <span className="ml-2 text-xs text-ink2/70">세트를 골라 바로 학습지로 만드세요.</span>
      </p>

      {loading ? (
        <div className="rounded-2xl border border-line bg-white py-16 text-center text-sm text-ink2">불러오는 중…</div>
      ) : !hasEssay(courseId) || sets.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white py-16 text-center text-sm text-ink2">
          이 과정은 서술형 세트가 없습니다.
          <div className="mt-1.5 text-xs text-ink2/70">매쓰플랫 서술형은 중1·중2·공통수학1·2·중3-2(2015)만 제공됩니다.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {byChapter.map(([chapter, list]) => (
            <div key={chapter} className="overflow-hidden rounded-2xl border border-line bg-white">
              <div className="bg-paper2 px-4 py-2.5 text-sm font-bold">{chapter}</div>
              <ul className="divide-y divide-line/60">
                {list.map((s, i) => {
                  const tier = essayTier(s)
                  return (
                    <li key={i} className="flex items-center gap-3 px-4 py-3">
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${TIER_STYLE[tier]}`}>{tier}</span>
                      <span className="min-w-0 grow truncate text-sm">{s.title.replace(/^\[[^\]]+\]\s*/, '')}</span>
                      <span className="shrink-0 text-xs text-ink2">{s.problems.length}문제</span>
                      <button onClick={() => setPreview(s)}
                        className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-ink2 hover:bg-paper2">미리보기</button>
                      <button onClick={() => makeWorksheet(s)}
                        className="shrink-0 rounded-lg bg-pine px-3 py-1 text-xs font-bold text-paper hover:bg-pine-dark">학습지 만들기</button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/70 p-6" onClick={() => setPreview(null)}>
          <div className="my-6 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-3">
              <b className="text-sm">{preview.title}</b>
              <div className="grow" />
              <button onClick={() => { makeWorksheet(preview) }}
                className="rounded-lg bg-pine px-3 py-1.5 text-xs font-bold text-paper hover:bg-pine-dark">학습지 만들기</button>
              <button onClick={() => setPreview(null)} className="rounded-lg px-2 py-1 text-ink2 hover:bg-paper2">✕</button>
            </div>
            <ol className="space-y-4">
              {preview.problems.map((p, i) => (
                <li key={p.id} className="rounded-xl border border-line p-3">
                  <div className="mb-1.5 text-xs font-bold text-ink2">{i + 1}번</div>
                  <img src={p.imageUrl} alt={`문제 ${i + 1}`} className="max-w-full rounded" />
                  <div className="mt-2 flex items-start gap-2 text-sm">
                    <span className="shrink-0 rounded bg-pine-soft px-1.5 py-0.5 text-xs font-bold text-pine-dark">정답</span>
                    {isImgAnswer(p.answer)
                      ? <img src={p.answer} alt="정답" className="max-h-40 rounded border border-line" />
                      : <MathText text={p.answer} className="pt-0.5 font-semibold" />}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
