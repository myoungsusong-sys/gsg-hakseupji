import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Problem } from '../../types'
import { DEFAULT_SHEET_OPTIONS } from '../../types'
import { useStore, uid } from '../../lib/store'
import { CURRICULA, curriculumFor, defaultCurriculumForGrade, typeName, typeSubUnitId } from '../../data/curriculum'
import { POOL_COURSES } from '../../data/pool'
import { CONCEPTS } from '../../data/concepts'
import { wrongByType } from '../../lib/drill'
import MathText from '../../components/MathText'
import { useStudentSelf, usePreview, PREVIEW_LOCK_TITLE } from './common'

// ── 챌린지 탭 (매쓰플랫 학생앱 챌린지 구조, 자기주도 학습) ─────────
// 과정 선택(학생 학년 기본, 초등~고등 전 과정) + 추천유형만 토글 + 단원 검색
// 소단원 아코디언 → 유형 카드 = [개념 익히기] + 개념(하~중하)|기본(중)|심화(상~최상) 3밴드 슬롯 그리드
//   (슬롯 = 그 유형·밴드 문제 풀, 최대 10칸 표시. 내가 푼 문항은 채움 — 정답 파랑/오답 빨강)
// [학습하기] → 그 유형·밴드에서 아직 안 푼 문항 최대 5개로 즉석 학습지 생성(태그 '챌린지') → 바로 풀기
// 우측 추천: 취약 유형 탈출(오답률 TOP3) · 최고 등급 도전(정답률 80%+)
// TODO(Wave 2): 슬롯 채움을 정오 2색 대신 매쓰플랫 성취도 7단계 컬러 체계(화이트·그레이·새드·
//   레드·옐로우·그린·스마일 — 유형 단위 등급 산정)로 확장. 공통 체계가 lib에 생기면 여기에 적용
//   (성취도 필터 모달·설명 모달도 그때 함께).

const BANDS = [
  { key: '개념', desc: '하·중하', diffs: [1, 2] as number[] },
  { key: '기본', desc: '중', diffs: [3] as number[] },
  { key: '심화', desc: '상·최상', diffs: [4, 5] as number[] },
] as const
type BandKey = typeof BANDS[number]['key']

const SLOT_MAX = 10
const PICK_N = 5

export default function StudentChallenge() {
  const me = useStudentSelf()
  const { problems, worksheets, assignments, gradings, wbItems, ensureCourse, saveWorksheet, addAssignment } = useStore()
  const nav = useNavigate()
  const pv = usePreview()

  // 과정: 학생 학년 기본 — 초등~고등 전 과정 선택 가능 (문제 풀 없는 과정은 유형 트리만)
  const courses = CURRICULA
  const [courseId, setCourseId] = useState(() => defaultCurriculumForGrade(me.grade) || 'm1-1')
  const [recoOnly, setRecoOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set())
  const [highlight, setHighlight] = useState<string | null>(null)
  const [concept, setConcept] = useState<string | null>(null)   // [개념 익히기] 대상 유형 id

  useEffect(() => { ensureCourse(courseId) }, [courseId, ensureCourse])

  const cur = curriculumFor(courseId)

  // 소단원 평탄화: [{대단원, 소단원, 유형들}]
  const subs = useMemo(() => {
    const out: { subId: string; unit: string; sub: string; types: { id: string; name: string }[] }[] = []
    for (const u of cur.units)
      for (const m of u.mids)
        for (const s of m.subs)
          out.push({ subId: s.id, unit: u.name, sub: s.name, types: s.types })
    return out
  }, [cur])
  const courseTypeIds = useMemo(() => new Set(subs.flatMap(s => s.types.map(t => t.id))), [subs])

  // 유형→문제 풀
  const byType = useMemo(() => {
    const m = new Map<string, Problem[]>()
    for (const p of problems) {
      if (!courseTypeIds.has(p.typeId)) continue
      const arr = m.get(p.typeId)
      if (arr) arr.push(p); else m.set(p.typeId, [p])
    }
    return m
  }, [problems, courseTypeIds])

  // 내가 푼 문항 → 최신 정오 (학습지·챌린지 채점 기록의 itemId = 문제 id)
  const solvedByProblem = useMemo(() => {
    const m = new Map<string, { correct: boolean; date: string }>()
    for (const g of gradings) {
      if (g.studentId !== me.id) continue
      for (const r of g.results) {
        if (!r.itemId) continue
        const prev = m.get(r.itemId)
        if (prev && prev.date > g.date) continue
        m.set(r.itemId, { correct: r.correct, date: g.date })
      }
    }
    return m
  }, [gradings, me.id])

  // 이미 나에게 출제된 문항 (재출제 방지)
  const assignedIds = useMemo(() => {
    const wsIds = new Set(assignments.filter(a => a.studentId === me.id).map(a => a.worksheetId))
    const s = new Set<string>()
    for (const w of worksheets) if (wsIds.has(w.id) && !w.deletedAt) for (const pid of w.problemIds) s.add(pid)
    return s
  }, [assignments, worksheets, me.id])

  // 추천: 이 과정 유형 중 취약(오답률순 TOP3) / 최고 등급 도전(정답률 80%+)
  const stats = useMemo(
    () => wrongByType(me.id, gradings, wbItems).filter(s => courseTypeIds.has(s.typeId)),
    [me.id, gradings, wbItems, courseTypeIds],
  )
  const weak = useMemo(() =>
    stats.filter(s => s.wrong > 0)
      .sort((a, b) => (b.wrong / b.total) - (a.wrong / a.total) || b.wrong - a.wrong)
      .slice(0, 3), [stats])
  const best = useMemo(() =>
    stats.filter(s => s.total > 0 && 1 - s.wrong / s.total >= 0.8)
      .sort((a, b) => b.total - a.total)
      .slice(0, 3), [stats])
  const recoIds = useMemo(() => new Set([...weak, ...best].map(s => s.typeId)), [weak, best])

  // 아코디언 기본: 첫 소단원 열기
  useEffect(() => {
    setOpenSubs(new Set(subs.length ? [subs[0].subId] : []))
    setHighlight(null)
  }, [courseId, subs])

  function toggleSub(id: string) {
    setOpenSubs(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  // 추천 칩 클릭 → 해당 유형 카드로 스크롤 + 하이라이트
  function jumpTo(typeId: string) {
    const holder = subs.find(s => s.types.some(t => t.id === typeId))
    if (holder) setOpenSubs(prev => new Set([...prev, holder.subId]))
    setHighlight(typeId)
    setTimeout(() => document.getElementById(`tp-${typeId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
  }

  // [학습하기] — 그 유형·밴드에서 아직 안 푼 문항 5개로 즉석 학습지
  function startLearning(typeId: string, band: BandKey) {
    if (pv.on) return
    const b = BANDS.find(x => x.key === band)!
    const pool = (byType.get(typeId) ?? []).filter(p => b.diffs.includes(p.diff))
    const cands = pool.filter(p => !solvedByProblem.has(p.id) && !assignedIds.has(p.id))
    if (cands.length === 0) { alert('이 밴드에서 새로 풀 문제가 없어요. 다른 밴드에 도전해보세요!'); return }
    const picked = cands.slice(0, PICK_N)
    const id = uid('ws')
    saveWorksheet({
      id,
      title: `[챌린지] ${typeName(typeId)} · ${band}`,
      author: me.name,
      grade: cur.grade,
      tags: ['챌린지'],
      theme: 'teal',
      problemIds: picked.map(p => p.id),
      conceptIds: [],
      options: { ...DEFAULT_SHEET_OPTIONS, autoGrade: true },
      listIds: [],
      createdAt: new Date().toISOString(),
      deletedAt: null,
    })
    addAssignment(id, [me.id], '숙제')
    nav(`/student/solve/${id}`)
  }

  // 검색·추천 필터
  const q = query.trim()
  const visibleSubs = useMemo(() => {
    return subs.map(s => {
      let types = s.types
      if (recoOnly) types = types.filter(t => recoIds.has(t.id))
      if (q && !(`${s.unit} ${s.sub}`.includes(q))) types = types.filter(t => t.name.includes(q))
      return { ...s, types }
    }).filter(s => s.types.length > 0)
  }, [subs, recoOnly, recoIds, q])

  const hasPool = (POOL_COURSES as readonly string[]).includes(courseId)
  const loaded = !hasPool || [...byType.values()].some(arr => arr.length > 0)

  return (
    <div>
      <h1 className="mb-1 text-xl font-black">챌린지</h1>
      <p className="mb-4 text-sm text-ink2">유형별로 개념 → 기본 → 심화 문제를 스스로 풀어 실력을 올려요.</p>

      {/* 추천 (스마일 챌린지) */}
      <section className="mb-5 rounded-2xl border border-line bg-white p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-sm font-black text-clay">🔥 취약 유형 탈출</div>
            {weak.length === 0 ? (
              <p className="text-xs text-ink2">아직 추천할 취약 유형이 없어요. 학습을 진행하면 추천해드려요.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {weak.map(s => (
                  <button key={s.typeId} onClick={() => jumpTo(s.typeId)}
                    className="rounded-full border border-clay/50 bg-red-50/60 px-3 py-1.5 text-xs font-bold text-clay hover:bg-red-50">
                    {typeName(s.typeId)} <span className="font-semibold opacity-70">오답 {s.wrong}/{s.total}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="mb-2 text-sm font-black text-pine-dark">🏆 최고 등급 도전</div>
            {best.length === 0 ? (
              <p className="text-xs text-ink2">정답률 80% 이상인 유형이 생기면 여기에 나타나요.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {best.map(s => (
                  <button key={s.typeId} onClick={() => jumpTo(s.typeId)}
                    className="rounded-full border border-pine/50 bg-pine-soft/60 px-3 py-1.5 text-xs font-bold text-pine-dark hover:bg-pine-soft">
                    {typeName(s.typeId)} <span className="font-semibold opacity-70">정답률 {Math.round((1 - s.wrong / s.total) * 100)}%</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 필터 바 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={courseId} onChange={e => setCourseId(e.target.value)}
          className="rounded-lg border border-line bg-white px-2.5 py-2 text-sm font-bold">
          {courses.map(c => <option key={c.id} value={c.id}>{c.label.replace(' (22개정)', '')}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={recoOnly} onChange={e => setRecoOnly(e.target.checked)}
            className="h-4 w-4 accent-pine" />
          추천유형만
        </label>
        <div className="grow" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="단원 · 유형 검색 🔍"
          className="w-56 rounded-lg border border-line px-3 py-2 text-sm" />
      </div>

      {!loaded && (
        <div className="mb-4 rounded-xl border border-dashed border-line bg-white/60 p-6 text-center text-sm text-ink2">
          문제 풀을 불러오는 중이에요…
        </div>
      )}
      {!hasPool && (
        <div className="mb-4 rounded-xl border border-dashed border-line bg-white/60 p-4 text-center text-xs text-ink2">
          이 과정은 문제 풀 준비 중이에요 — 단원·유형 목록만 볼 수 있어요.
        </div>
      )}

      {/* 소단원 아코디언 */}
      <div className="grid gap-2.5">
        {visibleSubs.length === 0 && loaded && (
          <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
            {recoOnly ? '추천 유형이 없어요. 학습을 진행하면 추천이 쌓여요.' : '검색 결과가 없어요.'}
          </div>
        )}
        {visibleSubs.map(s => {
          const opened = openSubs.has(s.subId) || !!q || recoOnly
          return (
            <section key={s.subId} className="overflow-hidden rounded-2xl border border-line bg-white">
              <button onClick={() => toggleSub(s.subId)}
                className="flex w-full items-center gap-2.5 px-5 py-3.5 text-left hover:bg-paper2/50">
                <span className={`text-xs text-ink2 transition ${opened ? '' : '-rotate-90'}`}>▼</span>
                <span className="text-xs font-bold text-ink2">{s.unit}</span>
                <span className="text-ink2/40">|</span>
                <b>{s.sub}</b>
                <span className="text-xs text-ink2">유형 {s.types.length}</span>
              </button>
              {opened && (
                <div className="grid gap-2.5 border-t border-line/60 p-4">
                  {s.types.map(t => {
                    const pool = byType.get(t.id) ?? []
                    return (
                      <div key={t.id} id={`tp-${t.id}`}
                        className={`rounded-xl border p-4 transition ${highlight === t.id ? 'border-pine ring-2 ring-pine/30' : 'border-line/70'}`}>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <b className="text-[15px]">{t.name}</b>
                          {weak.some(w => w.typeId === t.id) && (
                            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-clay">취약 유형</span>
                          )}
                          {best.some(w => w.typeId === t.id) && (
                            <span className="rounded bg-pine-soft px-1.5 py-0.5 text-[10px] font-bold text-pine-dark">최고 등급 도전</span>
                          )}
                          <div className="grow" />
                          <span className="text-xs text-ink2">풀 {pool.length}문제</span>
                        </div>
                        <div className="grid gap-3 lg:grid-cols-[150px_1fr]">
                          {/* 좌측: 개념 익히기 (원본 "소단원 기초 학습을 위한 강의보고 예제 풀기" — 개념 정리로 등가) */}
                          <div className="flex flex-col justify-center gap-2 rounded-lg bg-violet-50 p-3">
                            <span className="text-[11px] leading-snug text-violet-700">
                              소단원 기초 학습을 위한 개념 정리 보고 문제 풀기
                            </span>
                            <button onClick={() => setConcept(t.id)}
                              disabled={!CONCEPTS.some(c => c.subId === typeSubUnitId(t.id))}
                              title={CONCEPTS.some(c => c.subId === typeSubUnitId(t.id)) ? undefined : '이 소단원의 개념 정리가 아직 없어요'}
                              className="rounded-lg bg-violet-100 px-2.5 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-200 disabled:opacity-40">
                              개념 익히기
                            </button>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                          {BANDS.map(b => {
                            const bandPool = pool.filter(p => b.diffs.includes(p.diff))
                            const solved = bandPool
                              .filter(p => solvedByProblem.has(p.id))
                              .map(p => solvedByProblem.get(p.id)!)
                            const slotN = Math.min(bandPool.length, SLOT_MAX)
                            const startable = !pv.on && bandPool.some(p => !solvedByProblem.has(p.id) && !assignedIds.has(p.id))
                            return (
                              <div key={b.key} className="rounded-lg bg-paper2/50 p-3">
                                <div className="mb-2 flex items-baseline gap-1.5">
                                  <b className="text-sm">{b.key}</b>
                                  <span className="text-[10px] text-ink2">{b.desc}</span>
                                  <div className="grow" />
                                  <span className="text-[10px] text-ink2">{solved.length}/{bandPool.length}</span>
                                </div>
                                <div className="mb-2.5 flex min-h-4 flex-wrap gap-1">
                                  {bandPool.length === 0 ? (
                                    <span className="text-[11px] text-ink2/50">문제 없음</span>
                                  ) : Array.from({ length: slotN }, (_, i) => {
                                    const sv = solved[i]
                                    return (
                                      <span key={i} title={sv ? (sv.correct ? '정답' : '오답') : '아직 안 푼 슬롯'}
                                        className={`h-3.5 w-3.5 rounded ${sv
                                          ? sv.correct ? 'bg-blue-500' : 'bg-red-400'
                                          : 'border border-line bg-white'}`} />
                                    )
                                  })}
                                  {bandPool.length > SLOT_MAX && <span className="text-[10px] text-ink2">+{bandPool.length - SLOT_MAX}</span>}
                                </div>
                                <button onClick={() => startLearning(t.id, b.key)}
                                  disabled={!startable}
                                  title={pv.on ? PREVIEW_LOCK_TITLE : bandPool.length === 0 ? '이 밴드에는 문제가 없어요' : undefined}
                                  className="w-full rounded-lg bg-pine py-1.5 text-xs font-bold text-paper hover:brightness-110 disabled:opacity-30">
                                  학습하기 ({PICK_N}문제)
                                </button>
                              </div>
                            )
                          })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>

      {/* [개념 익히기] 모달 — 유형이 속한 소단원의 개념 정리 */}
      {concept && <ConceptModal typeId={concept} onClose={() => setConcept(null)} />}
    </div>
  )
}

// ── 개념 익히기 모달 (concepts.ts 소단원 개념 정리 표시) ─────────
function ConceptModal({ typeId, onClose }: { typeId: string; onClose: () => void }) {
  const subId = typeSubUnitId(typeId)
  const list = CONCEPTS.filter(c => c.subId === subId)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-start gap-3">
          <h2 className="text-lg font-black">개념 익히기 <span className="text-sm font-semibold text-ink2">— {typeName(typeId)}</span></h2>
          <div className="grow" />
          <button onClick={onClose} className="rounded-lg px-2 py-0.5 text-lg text-ink2 hover:bg-paper2">✕</button>
        </div>
        {list.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink2">이 소단원의 개념 정리가 아직 없어요.</p>
        ) : (
          <div className="grid gap-4">
            {list.map(c => (
              <section key={c.id} className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
                <div className="mb-2 font-black text-violet-700">📚 {c.title}</div>
                <ul className="grid gap-1.5 pl-4 text-sm leading-relaxed">
                  {c.lines.map((l, i) => (
                    <li key={i} className="list-disc"><MathText text={l} /></li>
                  ))}
                </ul>
              </section>
            ))}
            <p className="text-center text-xs text-ink2">개념을 익혔다면 아래 밴드에서 [학습하기]로 문제를 풀어봐요!</p>
          </div>
        )}
      </div>
    </div>
  )
}
