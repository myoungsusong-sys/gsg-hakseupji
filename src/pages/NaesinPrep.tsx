import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SubTabs from '../components/SubTabs'
import { useStore, uid } from '../lib/store'
import { useBrand } from '../lib/brand'
import { DEFAULT_SHEET_OPTIONS, DIFF_LABEL, type Problem } from '../types'
import ProblemContent from '../components/ProblemContent'
import { AssignModal } from './WorksheetList'
import {
  TEXTBOOK_GRADE_FILTERS, RECOMMEND_GRADE_FILTERS, PUBLISHERS,
  naesinCurricula, textbookSets, recommendSets, pickNaesinProblems, naesinCount, indexPool,
  type NaesinSet,
} from '../lib/naesin'

/**
 * 🏫 내신 대비 — 매쓰플랫 「내신관」과 **같은 3탭·같은 문구·같은 칸** (2026-09-04 명수쌤 "매쓰플랫과 동일하게")
 *
 * 원본(teacher.mathflat.com/lesson-preparation/school-exam) 2026-09-04 실측 문구를 그대로 쓴다.
 * 다른 점은 딱 하나 — 교과서(출판사별) 문항 원본이 없어서 탭2 세트의 출판사가 「공통」이고,
 * 출판사를 고르면 표가 비면서 "준비 중"이라고 말한다. 있는 척하지 않는다.
 * 세트는 저장해 두지 않고 매번 계산한다. [출제하기]를 누를 때만 학습지로 굳힌다 (lib/naesin.ts).
 */

const TABS = [
  { key: 'hall', label: '내신관' },
  { key: 'textbook', label: '내신 대비 교과서' },
  { key: 'recommend', label: '내신 대비 추천' },
]

export default function NaesinPrep() {
  const [tab, setTab] = useState('hall')
  return (
    <div>
      <SubTabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'hall' && <Hall onGo={setTab} />}
      {tab === 'textbook' && <SetTable mode="textbook" />}
      {tab === 'recommend' && <SetTable mode="recommend" />}
    </div>
  )
}

// ── 탭1 내신관 — 원본 3구역·문구 그대로 ─────────────────────────────────────

function Hall({ onGo }: { onGo: (tab: string) => void }) {
  const Chip = ({ t, tone }: { t: string; tone: string }) =>
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${tone}`}>{t}</span>
  const TONE = { 학습지: 'bg-pine-soft text-pine-dark', 교재: 'bg-sky-100 text-sky-800', '내가 만드는': 'bg-rose-100 text-rose-800' } as const
  const Row = ({ tag, label, sub, to, onClick }: { tag: keyof typeof TONE; label: string; sub?: string; to?: string; onClick?: () => void }) => {
    const inner = (
      <div className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-paper2/60">
        <Chip t={tag} tone={TONE[tag]} />
        <span className="text-sm font-semibold">{label}</span>
        {sub && <span className="text-xs text-ink2">| {sub}</span>}
        <span className="ml-auto text-ink2">›</span>
      </div>
    )
    return to ? <Link to={to}>{inner}</Link> : <button type="button" onClick={onClick} className="w-full text-left">{inner}</button>
  }

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <Link to="/prep/essay" className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white">
        <div>
          <p className="text-2xl font-black leading-snug">2학기 중간고사<br />서술형부터 잡자!</p>
          <p className="mt-3 text-sm text-white/80">학생이 쓴 풀이를 사진으로 올리면 채점·첨삭이 붙습니다.</p>
        </div>
        <span className="mt-6 inline-block rounded-lg bg-white/15 px-4 py-2 text-sm font-bold">서술형 AI 채점 · 첨삭 사용하기 ›</span>
      </Link>

      <div className="grid gap-3">
        <section className="rounded-2xl border border-line bg-white p-4">
          <p className="mb-1 text-sm font-black">학교별 기출</p>
          <Row tag="학습지" label="단원별 학습지" to="/make" />
          <Row tag="학습지" label="학교별 기출 축보" sub="시험지 업로드 → 문제은행" to="/prep/worksheet-upload" />
          <Row tag="학습지" label="학교별 기출 학습지" sub="중등, 고1 전체 지원" to="/prep/worksheet" />
          <Row tag="교재" label="학교별 기출 교재" sub="중등, 고1 전체 지원" to="/prep/workbook" />
        </section>

        <section className="rounded-2xl border border-line bg-white p-4">
          <p className="mb-1 text-sm font-black">교과서 종별 대비</p>
          <Row tag="학습지" label="교과서 빈출 기반 학습지" onClick={() => onGo('textbook')} />
          <Row tag="내가 만드는" label="교과서 내신 대비 문제" to="/make" />
        </section>

        <section className="rounded-2xl border border-line bg-white p-4">
          <p className="mb-1 text-sm font-black">시그니처 교재</p>
          <Row tag="교재" label="내신대비 시그니처 교재" to="/prep/workbook" />
          <Row tag="학습지" label="내신 대비 추천 학습지" onClick={() => onGo('recommend')} />
        </section>
      </div>
    </div>
  )
}

// ── 탭2·탭3 공용 표 — 원본과 같은 칸 구성 ───────────────────────────────────

function SetTable({ mode }: { mode: 'textbook' | 'recommend' }) {
  const { problems, ensureCourse, saveWorksheet, addAssignment, students, klassOrder } = useStore()
  const brand = useBrand()
  const nav = useNavigate()

  const FILTERS = mode === 'textbook' ? TEXTBOOK_GRADE_FILTERS : RECOMMEND_GRADE_FILTERS
  const [gradeIdx, setGradeIdx] = useState(0)
  const [publisher, setPublisher] = useState<string>('전체')
  const [q, setQ] = useState('')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [assignSet, setAssignSet] = useState<NaesinSet | null>(null)
  const [assignMany, setAssignMany] = useState<NaesinSet[] | null>(null)   // 선택한 세트 일괄 출제
  const [previewSet, setPreviewSet] = useState<NaesinSet | null>(null)    // 저장 없이 보기

  const filter = FILTERS[gradeIdx]
  // 「전체」(추천 탭) = 우리 과정 전부
  const courseIds = filter.courses.length ? filter.courses : FILTERS.flatMap((f) => f.courses)
  const curricula = useMemo(() => naesinCurricula(courseIds), [courseIds.join(',')])

  useEffect(() => { curricula.forEach((c) => ensureCourse(c.id)) }, [curricula, ensureCourse])
  useEffect(() => { setChecked(new Set()) }, [gradeIdx, publisher, q, mode])

  const sets = useMemo(() => {
    if (mode === 'textbook' && publisher !== '전체') return []      // 그 출판사 문항은 없다 — 아래에서 "준비 중"
    const all = curricula.flatMap((c) => (mode === 'textbook' ? textbookSets(c) : recommendSets(c)))
    const needle = q.trim()
    return needle ? all.filter((s) => s.title.includes(needle) || s.subtitle.includes(needle)) : all
  }, [curricula, mode, publisher, q])

  // 이 화면이 다루는 과정의 풀만 걸러 둔다 — 세트마다 전체 풀을 훑지 않게
  const pool = useMemo<Problem[]>(() => {
    const ids = new Set(curricula.flatMap((c) => c.units.flatMap((u) => u.mids.flatMap((m) => m.subs.flatMap((s) => s.types.map((t) => t.id))))))
    return problems.filter((p) => ids.has(p.typeId))
  }, [curricula, problems])
  const loading = curricula.length > 0 && pool.length === 0
  const index = useMemo(() => indexPool(pool), [pool])
  const counts = useMemo(() => new Map(sets.map((s) => [s.key, naesinCount(s, index)])), [sets, index])
  // 원본처럼 한 페이지씩 — 「전체」는 세트가 천 개를 넘어 한 번에 그리면 느리다
  const PAGE = 30
  const [page, setPage] = useState(0)
  useEffect(() => { setPage(0) }, [gradeIdx, publisher, q, mode])
  const pageSets = sets.slice(page * PAGE, page * PAGE + PAGE)
  const pages = Math.max(1, Math.ceil(sets.length / PAGE))

  /** 세트를 학습지로 굳힌다 — 원본도 목록의 세트는 출제 순간에 학습지가 된다 */
  function materialize(set: NaesinSet): string | null {
    const picked = pickNaesinProblems(set, index)
    if (picked.length === 0) { alert('이 범위의 문제가 문제은행에 아직 없습니다.'); return null }
    const id = uid('ws')
    saveWorksheet({
      id, title: set.title, author: brand, grade: set.semester, subject: '수학',
      tags: ['내신대비', set.level], theme: 'amber',
      problemIds: picked.map((p) => p.id), conceptIds: [],
      options: { ...DEFAULT_SHEET_OPTIONS, showTypeName: true, autoGrade: true },
      listIds: [], createdAt: new Date().toISOString(), deletedAt: null,
    })
    return id
  }
  /** 🔍 미리보기 — 원본처럼 **저장하지 않고** 본다. 훑어보기만 해도 학습지 목록이 쌓이던 문제를 막는다 */
  const preview = (set: NaesinSet) => setPreviewSet(set)
  /** ✎ 수정 — 원본의 ✎ 처럼 편집기로 간다. 우리 마법사는 과정·유형을 URL로 받아 STEP1을 채운다(저장 없음) */
  const edit = (set: NaesinSet) => nav(`/make?course=${encodeURIComponent(set.courseId)}&types=${encodeURIComponent(set.typeIds.join(','))}`)

  const pill = (on: boolean, empty = false) =>
    `whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold ${on ? 'border-pine bg-pine text-paper' : 'border-line text-ink2 hover:border-pine'} ${empty ? 'opacity-50' : ''}`
  const cols = mode === 'textbook' ? 8 : 8

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black">{mode === 'textbook' ? '내신 대비 교과서란?' : '내신 대비 추천이란?'}</p>
          <p className="mt-0.5 text-xs text-ink2">
            {mode === 'textbook'
              ? '교과서 별 단원정리에 해당되는 문제의 쌍둥이문제로 구성한 학습지입니다.'
              : <>각종 교과서에서 자주 출제되는 유형을 토대로 내신 대비에 최적화된 문제들로 구성한 학습지입니다. <Link to="/prep/worksheet" className="underline">자동 채점이란?</Link></>}
          </p>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="학습지명 검색"
          className="w-56 rounded-lg border border-line bg-white px-3 py-1.5 text-sm" />
      </div>

      {/* 학년 필터 — 원본 문구·순서 그대로. 우리 과정이 안 이어진 칩은 흐리게 */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {FILTERS.map((f, i) => (
          <button key={f.label} type="button" onClick={() => setGradeIdx(i)}
            className={pill(i === gradeIdx, f.courses.length === 0 && f.label !== '전체')}>{f.label}</button>
        ))}
      </div>
      {/* 출판사 필터 — 탭2에만. 원본 10개 그대로 */}
      {mode === 'textbook' && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PUBLISHERS.map((p) => (
            <button key={p} type="button" onClick={() => setPublisher(p)} className={pill(p === publisher, p !== '전체')}>{p}</button>
          ))}
          {loading && <span className="ml-2 self-center text-xs text-ink2">문제 풀 불러오는 중…</span>}
        </div>
      )}
      {mode === 'recommend' && loading && <p className="mb-2 text-xs text-ink2">문제 풀 불러오는 중…</p>}

      {checked.size > 0 && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-pine/40 bg-pine-soft/40 px-4 py-2 text-sm">
          <span className="font-bold">{checked.size}개 선택</span>
          <button type="button" onClick={() => setAssignMany(sets.filter((x) => checked.has(x.key) && (counts.get(x.key) ?? 0) > 0))}
            className="rounded-lg bg-pine px-3 py-1.5 text-xs font-semibold text-paper hover:bg-pine-dark">출제하기</button>
          <button type="button" onClick={() => setChecked(new Set())} className="text-xs text-ink2 hover:underline">선택 해제</button>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-line bg-paper2/60 text-xs text-ink2">
              <th className="w-10 px-3 py-3">
                <input type="checkbox" className="h-4 w-4 accent-pine"
                  checked={sets.length > 0 && sets.every((s) => checked.has(s.key))}
                  onChange={(e) => setChecked(e.target.checked ? new Set(sets.map((s) => s.key)) : new Set())} />
              </th>
              <th className="whitespace-nowrap px-3 py-3">학년</th>
              {mode === 'textbook' && <th className="whitespace-nowrap px-3 py-3">출판사</th>}
              <th className="px-3 py-3 text-left">학습지명</th>
              <th className="whitespace-nowrap px-3 py-3">문제수</th>
              {mode === 'recommend' && <th className="whitespace-nowrap px-3 py-3">난이도</th>}
              <th className="whitespace-nowrap px-3 py-3">미리보기</th>
              <th className="whitespace-nowrap px-3 py-3">수정</th>
              <th className="whitespace-nowrap px-3 py-3">출제</th>
            </tr>
          </thead>
          <tbody>
            {sets.length === 0 && (
              <tr><td colSpan={cols} className="px-3 py-10 text-center text-sm text-ink2">
                {mode === 'textbook' && publisher !== '전체'
                  ? `「${publisher}」 교과서 문항은 준비 중입니다. 「전체」에서 단원별 세트를 쓰세요.`
                  : filter.courses.length === 0 && filter.label !== '전체'
                    ? `「${filter.label}」 과정은 준비 중입니다.`
                    : '해당하는 학습지가 없습니다.'}
              </td></tr>
            )}
            {pageSets.map((s) => {
              const n = counts.get(s.key) ?? 0
              const can = n > 0
              return (
                <tr key={s.key} className="border-b border-line last:border-b-0 hover:bg-paper2/40">
                  <td className="px-3 py-3 text-center">
                    <input type="checkbox" className="h-4 w-4 accent-pine" checked={checked.has(s.key)}
                      onChange={() => setChecked((c) => { const nx = new Set(c); nx.has(s.key) ? nx.delete(s.key) : nx.add(s.key); return nx })} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">
                    <div className="font-semibold">{s.grade}</div>
                    <div className="text-[11px] text-ink2">{s.revision}</div>
                  </td>
                  {mode === 'textbook' && <td className="whitespace-nowrap px-3 py-3 text-center text-ink2">{s.publisher}</td>}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => can && preview(s)} disabled={!can}
                        className="text-left font-bold hover:underline disabled:cursor-default disabled:opacity-50 disabled:no-underline">{s.title}</button>
                      {mode === 'recommend' && (
                        <span className="shrink-0 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">자동 채점</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs font-semibold text-blue-500">
                      {s.subtitle}
                      {!can && !loading && <span className="ml-2 font-normal text-ink2">— 문제은행에 아직 없음</span>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">{n}</td>
                  {mode === 'recommend' && <td className="whitespace-nowrap px-3 py-3 text-center">{s.diffLabel}</td>}
                  <td className="px-3 py-3 text-center">
                    <button type="button" onClick={() => preview(s)} disabled={!can} title="미리보기"
                      className="rounded-lg border border-line px-2.5 py-1.5 hover:bg-paper2 disabled:opacity-40">🔍</button>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button type="button" onClick={() => edit(s)} title="이 범위로 편집기 열기"
                      className="rounded-lg border border-line px-2.5 py-1.5 hover:bg-paper2">✎</button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">
                    <button type="button" onClick={() => setAssignSet(s)} disabled={!can}
                      className="rounded-lg bg-pine px-3 py-1.5 text-xs font-semibold text-paper hover:bg-pine-dark disabled:opacity-40">출제하기</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-2 flex items-center justify-center gap-3 text-sm">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-line px-3 py-1 disabled:opacity-40">‹</button>
          <span className="text-ink2">{page + 1} / {pages}</span>
          <button type="button" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-line px-3 py-1 disabled:opacity-40">›</button>
        </div>
      )}

      {previewSet && (
        <PreviewModal
          set={previewSet}
          problems={pickNaesinProblems(previewSet, index)}
          onClose={() => setPreviewSet(null)}
          onAssign={() => { setAssignSet(previewSet); setPreviewSet(null) }}
          onEdit={() => edit(previewSet)}
        />
      )}
      {assignMany && assignMany.length > 0 && (
        <AssignModal
          title={`학습지 ${assignMany.length}개`}
          students={students.filter((s) => s.active)}
          klassOrder={klassOrder}
          initial={[]}
          onClose={() => setAssignMany(null)}
          onSubmit={(ids, kind, reveal, exam) => {
            for (const set of assignMany) { const id = materialize(set); if (id) addAssignment(id, ids, kind, reveal, exam) }
            setAssignMany(null); setChecked(new Set())
            nav('/prep/worksheet')
          }}
        />
      )}
      {assignSet && (
        <AssignModal
          title={`「${assignSet.title}」`}
          students={students.filter((s) => s.active)}
          klassOrder={klassOrder}
          initial={[]}
          onClose={() => setAssignSet(null)}
          onSubmit={(ids, kind, reveal, exam) => {
            const id = materialize(assignSet)
            if (id) addAssignment(id, ids, kind, reveal, exam)
            setAssignSet(null)
            if (id) nav(`/worksheet/${id}`)
          }}
        />
      )}
    </div>
  )
}

// ── 🔍 미리보기 — 저장 없이 문항만 본다 (원본의 미리보기와 같은 역할) ─────────────
function PreviewModal({ set, problems, onClose, onAssign, onEdit }: {
  set: NaesinSet; problems: Problem[]; onClose: () => void; onAssign: () => void; onEdit: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black">{set.title}</p>
            <p className="text-xs text-ink2">{set.subtitle} · {problems.length}문제 · 난이도 {set.diffLabel}</p>
          </div>
          <button type="button" onClick={onEdit} className="ml-auto rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:bg-paper2">✎ 수정</button>
          <button type="button" onClick={onAssign} className="rounded-lg bg-pine px-3 py-1.5 text-xs font-semibold text-paper hover:bg-pine-dark">출제하기</button>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-ink2 hover:bg-paper2">✕</button>
        </div>
        <div className="grid gap-4 overflow-y-auto p-5 sm:grid-cols-2">
          {problems.length === 0 && <p className="col-span-2 py-10 text-center text-sm text-ink2">이 범위의 문제가 문제은행에 아직 없습니다.</p>}
          {problems.map((p, i) => (
            <div key={p.id} className="rounded-xl border border-line p-3">
              <div className="mb-1.5 flex items-center gap-2 text-[11px] text-ink2">
                <span className="font-black text-ink">{i + 1}</span>
                <span className="rounded bg-paper2 px-1.5 py-0.5">{DIFF_LABEL[p.diff]}</span>
                <span>{p.kind}</span>
              </div>
              <ProblemContent p={p} textClass="text-sm" />
            </div>
          ))}
        </div>
        <p className="border-t border-line px-5 py-2 text-[11px] text-ink2">미리보기는 저장되지 않습니다. [출제하기]를 누를 때 학습지가 만들어집니다.</p>
      </div>
    </div>
  )
}
