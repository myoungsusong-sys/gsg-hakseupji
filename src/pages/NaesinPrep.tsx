import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SubTabs from '../components/SubTabs'
import { useStore, uid } from '../lib/store'
import { useBrand } from '../lib/brand'
import { DEFAULT_SHEET_OPTIONS } from '../types'
import { AssignModal } from './WorksheetList'
import {
  naesinCourses, textbookSets, recommendSets, pickNaesinProblems, poolCoverage, LEVELS,
  type NaesinSet, type NaesinLevel,
} from '../lib/naesin'

/**
 * 🏫 내신 대비 — 매쓰플랫 「내신관」과 같은 3탭 (2026-09-04 명수쌤 "내신관 동일하게 만들어줘")
 *
 * 매쓰플랫 원본(2026-09-04 teacher.mathflat.com/lesson-preparation/school-exam 실측):
 *   탭1 내신관        = 허브. 「학교별 기출」「교과서 종별 대비」「시그니처 교재」 3구역 + 서술형 AI 채점 배너
 *   탭2 내신 대비 교과서 = 학년·출판사 필터 → 표(선택·학년·출판사·학습지명·문제수·미리보기·수정·출제)
 *   탭3 내신 대비 추천   = 학년 필터 → 표(선택·학년·학습지명·문제수·난이도·미리보기·수정·출제)
 *
 * 우리와 다른 점 하나 — **학교 기출지·교과서 문항 원본이 없다**(저작권). 그래서
 *   · 탭2는 출판사 대신 **대단원(시험 범위) 단위** 세트, 탭3는 **중단원×난이도** 세트를 자체 풀로 만든다
 *   · 탭1의 「학교별 기출」은 우리가 이미 가진 기출 업로드·태깅 흐름으로 연결한다
 * 목록은 저장해 두지 않고 매번 계산한다. [출제하기]를 누를 때만 학습지로 굳힌다 (lib/naesin.ts).
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

// ── 탭1 내신관(허브) — 매쓰플랫과 같은 3구역 ─────────────────────────────────

function Hall({ onGo }: { onGo: (tab: string) => void }) {
  const chip = (t: string, tone = 'bg-pine-soft text-pine-dark') =>
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${tone}`}>{t}</span>
  const Row = ({ tag, tone, label, sub, to, onClick }: { tag: string; tone?: string; label: string; sub?: string; to?: string; onClick?: () => void }) => {
    const inner = (
      <div className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-paper2/60">
        {chip(tag, tone)}
        <span className="text-sm font-semibold">{label}</span>
        {sub && <span className="text-xs text-ink2">| {sub}</span>}
        <span className="ml-auto text-ink2">›</span>
      </div>
    )
    return to ? <Link to={to}>{inner}</Link> : <button type="button" onClick={onClick} className="w-full text-left">{inner}</button>
  }

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      {/* 배너 — 매쓰플랫은 「서술형 AI 채점」, 우리는 이미 있는 서술형 첨삭 화면으로 */}
      <Link to="/prep/essay" className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white">
        <div>
          <p className="text-2xl font-black leading-snug">2학기 중간고사<br />서술형부터 잡자!</p>
          <p className="mt-3 text-sm text-white/80">학생이 쓴 풀이를 사진으로 올리면 채점·첨삭이 붙습니다.</p>
        </div>
        <span className="mt-6 inline-block rounded-lg bg-white/15 px-4 py-2 text-sm font-bold">서술형 AI 채점·첨삭 사용하기 ›</span>
      </Link>

      <div className="grid gap-3">
        <section className="rounded-2xl border border-line bg-white p-4">
          <p className="mb-1 text-sm font-black">학교별 기출</p>
          <Row tag="학습지" label="단원별 학습지" to="/make" />
          <Row tag="학습지" tone="bg-amber-100 text-amber-800" label="학교별 기출 업로드" sub="시험지 사진·PDF → 문제은행" to="/prep/worksheet-upload" />
          <Row tag="학습지" label="학교별 기출 학습지" sub="중등·고1 — 업로드한 기출로 출제" to="/prep/worksheet" />
          <Row tag="교재" tone="bg-sky-100 text-sky-800" label="학교별 기출 교재" sub="교재 진도표와 연결" to="/prep/workbook" />
        </section>

        <section className="rounded-2xl border border-line bg-white p-4">
          <p className="mb-1 text-sm font-black">교과서 종별 대비</p>
          <Row tag="학습지" label="교과서 빈출 기반 학습지" sub="대단원(시험 범위) 단위" onClick={() => onGo('textbook')} />
          <Row tag="내가 만드는" tone="bg-rose-100 text-rose-800" label="교과서 내신 대비 문제" sub="단원·유형·난이도 직접 고르기" to="/make" />
        </section>

        <section className="rounded-2xl border border-line bg-white p-4">
          <p className="mb-1 text-sm font-black">유형별 추천</p>
          <Row tag="학습지" label="내신 대비 추천 학습지" sub="중단원 × 난이도 3종" onClick={() => onGo('recommend')} />
          <Row tag="교재" tone="bg-sky-100 text-sky-800" label="내신대비 교재 목록" to="/prep/workbook" />
        </section>
      </div>
    </div>
  )
}

// ── 탭2·탭3 공용 표 — 매쓰플랫 표와 같은 칸 구성 ───────────────────────────

function SetTable({ mode }: { mode: 'textbook' | 'recommend' }) {
  const { problems, ensureCourse, saveWorksheet, addAssignment, students, klassOrder } = useStore()
  const brand = useBrand()
  const nav = useNavigate()

  const courses = useMemo(() => naesinCourses(), [])
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '')
  const [level, setLevel] = useState<NaesinLevel | '전체'>('전체')
  const [q, setQ] = useState('')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [assignSet, setAssignSet] = useState<NaesinSet | null>(null)

  const cur = courses.find((c) => c.id === courseId)
  useEffect(() => { if (courseId) ensureCourse(courseId) }, [courseId, ensureCourse])
  useEffect(() => { setChecked(new Set()) }, [courseId, level, q, mode])

  const sets = useMemo(() => {
    if (!cur) return []
    const all = mode === 'textbook' ? textbookSets(cur) : recommendSets(cur)
    return all
      .filter((s) => level === '전체' || s.level === level)
      .filter((s) => !q.trim() || s.title.includes(q.trim()) || s.unitName.includes(q.trim()) || (s.midName ?? '').includes(q.trim()))
  }, [cur, mode, level, q])

  // 이 과정 풀만 미리 걸러 둔다 — 세트마다 전체 풀을 훑지 않게
  const coursePool = useMemo(() => {
    if (!cur) return []
    const ids = new Set(cur.units.flatMap((u) => u.mids.flatMap((m) => m.subs.flatMap((s) => s.types.map((t) => t.id)))))
    return problems.filter((p) => ids.has(p.typeId))
  }, [cur, problems])
  const loading = Boolean(cur) && coursePool.length === 0

  /** 세트를 학습지로 굳힌다 — 매쓰플랫도 목록의 세트는 출제 순간에 학습지가 된다 */
  function materialize(set: NaesinSet): string | null {
    const picked = pickNaesinProblems(set, coursePool)
    if (picked.length === 0) { alert('이 범위의 문제가 문제은행에 아직 없습니다.'); return null }
    const id = uid('ws')
    saveWorksheet({
      id,
      title: set.title,
      author: brand,
      grade: set.grade,
      subject: '수학',
      tags: ['내신대비', set.level],
      theme: 'amber',
      problemIds: picked.map((p) => p.id),
      conceptIds: [],
      options: { ...DEFAULT_SHEET_OPTIONS, showTypeName: true, autoGrade: true },
      listIds: [],
      createdAt: new Date().toISOString(),
      deletedAt: null,
    })
    return id
  }

  const preview = (set: NaesinSet) => { const id = materialize(set); if (id) nav(`/worksheet/${id}`) }

  const pill = (on: boolean) =>
    `whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold ${on ? 'border-pine bg-pine text-paper' : 'border-line text-ink2 hover:border-pine'}`

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black">{mode === 'textbook' ? '내신 대비 교과서란?' : '내신 대비 추천이란?'}</p>
          <p className="mt-0.5 text-xs text-ink2">
            {mode === 'textbook'
              ? '교과서 대단원(시험 범위) 단위로 묶은 학습지입니다. "3단원까지"처럼 범위가 나오면 그 단원 세트를 그대로 출제합니다.'
              : '각 중단원에서 자주 출제되는 유형을 토대로 내신 대비에 맞춘 문제로 구성한 학습지입니다. 난이도 3종으로 제공됩니다.'}
          </p>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="학습지명 검색"
          className="w-56 rounded-lg border border-line bg-white px-3 py-1.5 text-sm" />
      </div>

      {/* 학년·과정 필터 — 매쓰플랫 첫 줄과 같은 자리 */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {courses.map((c) => (
          <button key={c.id} type="button" onClick={() => setCourseId(c.id)} className={pill(c.id === courseId)}>
            {c.label.replace(/^중학교 (\d)학년 (\d)학기/, '중$1-$2').replace(/ \((\d+)개정\)$/, '($1)')}
          </button>
        ))}
      </div>
      {/* 난이도 필터 — 매쓰플랫 둘째 줄(출판사) 자리. 우리는 출판사 대신 난이도 */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(['전체', ...LEVELS] as const).map((l) => (
          <button key={l} type="button" onClick={() => setLevel(l)} className={pill(l === level)}>{l}</button>
        ))}
        {loading && <span className="ml-2 self-center text-xs text-ink2">문제 풀 불러오는 중…</span>}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-line bg-paper2/60 text-xs text-ink2">
              <th className="w-10 px-3 py-3">
                <input type="checkbox" className="h-4 w-4 accent-pine"
                  checked={sets.length > 0 && sets.every((s) => checked.has(s.key))}
                  onChange={(e) => setChecked(e.target.checked ? new Set(sets.map((s) => s.key)) : new Set())} />
              </th>
              <th className="whitespace-nowrap px-3 py-3">학년</th>
              {mode === 'textbook' && <th className="whitespace-nowrap px-3 py-3">범위</th>}
              <th className="px-3 py-3 text-left">학습지명</th>
              <th className="whitespace-nowrap px-3 py-3">문제수</th>
              <th className="whitespace-nowrap px-3 py-3">난이도</th>
              <th className="whitespace-nowrap px-3 py-3">미리보기</th>
              <th className="whitespace-nowrap px-3 py-3">수정</th>
              <th className="whitespace-nowrap px-3 py-3">출제</th>
            </tr>
          </thead>
          <tbody>
            {sets.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-ink2">해당하는 학습지가 없습니다.</td></tr>
            )}
            {sets.map((s) => {
              const cov = poolCoverage(s, coursePool)
              const can = cov.problems > 0
              const n = Math.min(s.count, cov.problems)
              return (
                <tr key={s.key} className="border-b border-line last:border-b-0 hover:bg-paper2/40">
                  <td className="px-3 py-3 text-center">
                    <input type="checkbox" className="h-4 w-4 accent-pine" checked={checked.has(s.key)}
                      onChange={() => setChecked((c) => { const nx = new Set(c); nx.has(s.key) ? nx.delete(s.key) : nx.add(s.key); return nx })} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">
                    <div className="font-semibold">{s.grade}</div>
                    <div className="text-[11px] text-ink2">({s.courseLabel.match(/\((\d+)개정\)/)?.[1] ?? '22'}개정)</div>
                  </td>
                  {mode === 'textbook' && <td className="whitespace-nowrap px-3 py-3 text-center text-ink2">{s.unitName}</td>}
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => can && preview(s)} disabled={!can}
                      className="text-left font-bold hover:underline disabled:cursor-default disabled:opacity-50 disabled:no-underline">
                      {s.title}
                    </button>
                    <div className="mt-0.5 text-xs font-semibold text-blue-500">
                      {s.midName ?? s.unitName}
                      {!can && !loading && <span className="ml-2 font-normal text-ink2">— 문제은행에 아직 없음</span>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">{n}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">{s.diffLabel}</td>
                  <td className="px-3 py-3 text-center">
                    <button type="button" onClick={() => preview(s)} disabled={!can} title="미리보기"
                      className="rounded-lg border border-line px-2.5 py-1.5 hover:bg-paper2 disabled:opacity-40">🔍</button>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {/* 수정 = 이 범위로 학습지 만들기 마법사를 여는 것 — 매쓰플랫의 ✎ 도 편집 화면으로 간다 */}
                    <button type="button" onClick={() => nav('/make')} title="범위·문항 직접 고치기"
                      className="rounded-lg border border-line px-2.5 py-1.5 hover:bg-paper2">✎</button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">
                    <button type="button" onClick={() => setAssignSet(s)} disabled={!can}
                      className="rounded-lg bg-pine px-3 py-1.5 text-xs font-semibold text-paper hover:bg-pine-dark disabled:opacity-40">
                      출제하기
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

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
