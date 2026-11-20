import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, uid } from '../../lib/store'
import { useBrand } from '../../lib/brand'
import { DEFAULT_SHEET_OPTIONS, type Diff } from '../../types'
import { CURRICULA, curriculumFor } from '../../data/curriculum'
import { POOL_COURSES } from '../../data/pool'
import { pickProblems } from '../../lib/select'

/* 주간 · 단원 · 총괄 TEST — 우리 문제은행에서 범위만 고르면 바로 꾸린다 (2026-11-20)
   · 단원 TEST: 대단원 하나 · 총괄 TEST: 과정 전체(기본/심화) · 주간 TEST: 중단원 하나(그 주 진도)
   만든 학습지는 «내 학습지»에 꼬리표와 함께 들어가고, 자동채점 학습지로 만들어진다. */

type Kind = 'weekly' | 'unit' | 'total'
const TAG: Record<Kind, string> = { weekly: '주간 TEST', unit: '단원 TEST', total: '총괄 TEST' }
const COUNT: Record<Kind, number> = { weekly: 15, unit: 20, total: 25 }

export default function AutoTest({ kind }: { kind: Kind }) {
  const { problems, ensureCourse, poolLoaded, diffMatrix, saveWorksheet } = useStore()
  const brand = useBrand()
  const nav = useNavigate()
  const courses = useMemo(() => CURRICULA.filter(c => (c.subject ?? '수학') === '수학' && !c.book && (POOL_COURSES as readonly string[]).includes(c.id)), [])
  const [courseId, setCourseId] = useState(courses.find(c => c.id === 'm1-1')?.id ?? courses[0]?.id ?? '')
  const cur = curriculumFor(courseId)
  const [level, setLevel] = useState<'기본' | '심화'>('기본')
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => { if (courseId) ensureCourse(courseId) }, [courseId, ensureCourse])
  const loaded = poolLoaded.has(courseId)

  // 꾸릴 수 있는 세트 목록 — 범위(유형 id 묶음)와 이름
  const sets = useMemo(() => {
    const typesOf = (u: typeof cur.units[number]) => u.mids.flatMap(m => m.subs.flatMap(s => s.types.map(t => t.id)))
    if (kind === 'total') return [{ key: 'all', name: '학기 전체', sub: `대단원 ${cur.units.length}개 전체`, types: cur.units.flatMap(typesOf) }]
    if (kind === 'unit') return cur.units.map(u => ({ key: u.id, name: u.name, sub: `중단원 ${u.mids.length}개`, types: typesOf(u) }))
    return cur.units.flatMap(u => u.mids.map(m => ({ key: m.id, name: m.name, sub: u.name, types: m.subs.flatMap(s => s.types.map(t => t.id)) })))
  }, [cur, kind])

  const have = useMemo(() => {
    const byType = new Map<string, number>()
    for (const p of problems) byType.set(p.typeId, (byType.get(p.typeId) ?? 0) + 1)
    return (types: string[]) => types.reduce((n, t) => n + (byType.get(t) ?? 0), 0)
  }, [problems])

  function make(set: typeof sets[number], open: boolean) {
    setBusy(set.key)
    const want = new Set(set.types)
    const pool = problems.filter(p => want.has(p.typeId) && (p.kind === '객관식' || !p.selfGrade))
    const focus: Diff = level === '심화' ? 4 : 3
    const picked = pickProblems(pool, COUNT[kind], focus, 'all', set.types, diffMatrix)
    setBusy(null)
    if (picked.length === 0) { alert('이 범위에는 문제은행에 문제가 없어요. 다른 범위를 골라 주세요.'); return }
    const id = uid('ws')
    saveWorksheet({
      id, title: `${cur.grade} ${set.name} ${TAG[kind]}${kind === 'total' ? ` (${level})` : ''}`, author: brand, grade: cur.grade, subject: '수학',
      tags: [TAG[kind]], theme: 'navy', problemIds: picked.map(p => p.id), conceptIds: [],
      options: { ...DEFAULT_SHEET_OPTIONS, autoGrade: true }, listIds: [], createdAt: new Date().toISOString(), deletedAt: null,
    })
    nav(open ? `/worksheet/${id}` : `/make?edit=${id}`)
  }

  return (
    <div data-auto-test={kind}>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <select value={courseId} onChange={e => setCourseId(e.target.value)} className="rounded-lg border border-line bg-white px-3 py-2 font-semibold">
          {courses.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <div className="flex rounded-xl border border-line bg-white p-1 font-bold">
          {(['기본', '심화'] as const).map(l => (
            <button key={l} onClick={() => setLevel(l)} className={`rounded-lg px-4 py-1.5 ${level === l ? 'bg-pine text-paper' : 'text-ink2'}`}>{l}</button>
          ))}
        </div>
        <span className="text-ink2">{TAG[kind]} · 한 장 {COUNT[kind]}문제 · 자동 채점 · {level === '심화' ? '상 난이도 중심' : '중 난이도 중심'}</span>
      </div>
      {!loaded ? (
        <div className="rounded-2xl border border-line bg-white py-14 text-center text-sm text-ink2">문제은행을 불러오는 중…</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-ink2">
              <th className="px-4 py-2.5">범위</th><th className="py-2.5">묶음</th><th className="py-2.5">유형</th><th className="py-2.5">문제은행</th><th className="py-2.5 pr-4 text-right">만들기</th>
            </tr></thead>
            <tbody>
              {sets.map(s => {
                const n = have(s.types)
                return (
                  <tr key={s.key} className="border-b border-line/60 last:border-0" data-set>
                    <td className="px-4 py-2.5 font-semibold">{s.name}</td>
                    <td className="py-2.5 text-ink2">{s.sub}</td>
                    <td className="py-2.5 tabular-nums text-ink2">{s.types.length}개</td>
                    <td className="py-2.5 tabular-nums text-ink2">{n.toLocaleString()}문제</td>
                    <td className="py-2.5 pr-4 text-right">
                      <button disabled={n === 0 || busy === s.key} onClick={() => make(s, false)} className="mr-2 rounded-lg border border-line px-3 py-1.5 text-xs font-bold hover:bg-paper2 disabled:opacity-40">편집 후 만들기</button>
                      <button disabled={n === 0 || busy === s.key} onClick={() => make(s, true)} className="rounded-lg bg-pine px-3 py-1.5 text-xs font-bold text-paper disabled:opacity-40">바로 만들기</button>
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
