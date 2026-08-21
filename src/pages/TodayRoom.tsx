import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { dateKey, todayKey } from '../lib/dates'
import { subjectOfWorkbook, useSubject, type Subject } from '../lib/subject'
import { clearCall, fetchCalls, pushCall, type TeacherCall } from '../lib/live'
import TeachPanel from '../components/lesson/TeachPanel'
import DailyGradeBar from '../components/lesson/DailyGradeBar'
import type { Grading, Student, Workbook, Worksheet } from '../types'

// ── 📋 오늘 교실 — 오늘 답을 입력한 **전 학생**과 틀린 개수를 한 화면에, 거기서 바로 호출
//
// 왜 만들었나 (2026-08-12 명수쌤): "아이들이 질문을 잘 안 해서 선생님은 놀고 있다."
// 학생이 손들기를 기다리지 말고 **앱이 막힌 학생을 지목하고 선생님이 먼저 부른다.**
//
// 🔴 기존 '오늘의 학습' 화면을 복사하지 않은 이유 — 그쪽은 **출제(Assignment)가 있어야** 행이 생기고
//    (TodayPanel.tsx `if (dayAs.length === 0) continue`), 매칭도 worksheetId 로만 한다.
//    그래서 교재에 답만 입력한 학생은 통째로 사라진다. 이것이 "일부 학생만 뜬다"의 원인이었다.
//    여기서는 **gradings 를 날짜로만** 거른다. 출제 여부·교재/학습지 구분과 무관하게 전원이 잡힌다.

type Row = {
  st: Student
  total: number; correct: number; wrong: number
  unknown: number; careless: number; pending: number
  open: number            // 미해결 오답 = 오답 - 실수(재시도로 맞힘). 정렬 기준
  lastAt: number
  labels: string[]
}

/** 과목 판정 — 참조가 끊긴 이관 기록은 null. **null 은 숨기지 않는다**(숨기면 학생이 사라진다). */
function subjOf(g: Grading, wbById: Map<string, Workbook>, wsById: Map<string, Worksheet>): Subject | null {
  if ((g.source ?? '교재') === '교재') {
    const w = g.workbookId ? wbById.get(g.workbookId) : undefined
    return w ? subjectOfWorkbook(w) : null
  }
  return (g.worksheetId ? wsById.get(g.worksheetId)?.subject : undefined) ?? null
}

function labelOf(g: Grading, wbById: Map<string, Workbook>, wsById: Map<string, Worksheet>): string {
  const base = (g.worksheetId && wsById.get(g.worksheetId)?.title)
    || (g.workbookId && wbById.get(g.workbookId)?.name)
    || g.title || (g.source ?? '교재')
  if (g.pageFrom == null) return base
  return `${base} ${g.pageFrom}${g.pageTo && g.pageTo !== g.pageFrom ? `~${g.pageTo}` : ''}쪽`
}

const ago = (ms: number) => {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (s < 60) return '방금'
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  return `${Math.floor(s / 3600)}시간 전`
}

const CALL_TEXTS = ['앞으로 나오세요', '틀린 문제 같이 봐요', '질문 있으면 지금 오세요', '풀이 확인하러 오세요']

export default function TodayRoom() {
  const { students, gradings, workbooks, worksheets, teachers, academyProfile, branches, branchScope, multiBranch } = useStore()
  // 지점을 골라 본 상태면 제목 앞에 지점명을 박는다 — 어느 교실을 보고 있는지가 늘 보여야 한다
  const branchLabel = multiBranch
    ? <><b className="text-pine">{branches.find(b => b.id === branchScope)?.name ?? '전체 지점'}</b> · </>
    : null
  const [subject] = useSubject()
  const [subjOnly, setSubjOnly] = useState(true)
  const [showZero, setShowZero] = useState(false)
  const [sort, setSort] = useState<'wrong' | 'recent' | 'name'>('wrong')
  const [callText, setCallText] = useState(CALL_TEXTS[0])
  const [teach, setTeach] = useState<Student | null>(null)   // 지도 패널 대상 학생
  const [calls, setCalls] = useState<TeacherCall[]>([])
  const [, tick] = useState(0)
  const busy = useRef(false)

  // 호출 상태만 따로 폴링한다 — 채점 데이터는 실시간 동기화가 알아서 갱신한다
  useEffect(() => {
    let alive = true
    const poll = async () => {
      if (busy.current) return
      busy.current = true
      try { const c = await fetchCalls(); if (alive) setCalls(c) } finally { busy.current = false }
    }
    poll()
    const t = setInterval(poll, 5000)
    const tk = setInterval(() => tick(n => n + 1), 1000)   // '3분 전' 표시 갱신
    return () => { alive = false; clearInterval(t); clearInterval(tk) }
  }, [])

  const today = todayKey()
  const teacherName = teachers?.find(t => t.name)?.name || academyProfile.teacherName || '선생님'

  const { rows, idle, totalActive, linked, only } = useMemo(() => {
    const actives = students.filter(s => s.active)
    const byId = new Map(actives.map(s => [s.id, s]))
    const wbById = new Map(workbooks.map(w => [w.id, w]))
    const wsById = new Map(worksheets.map(w => [w.id, w]))
    const acc = new Map<string, Row>()

    for (const g of gradings) {
      if (dateKey(g.date) !== today) continue
      const st = byId.get(g.studentId)
      if (!st) continue
      if (subjOnly) {
        const sj = subjOf(g, wbById, wsById)
        if (sj && sj !== subject) continue          // 판정 불가(null)는 거르지 않는다
      }
      const r = acc.get(st.id) ?? {
        st, total: 0, correct: 0, wrong: 0, unknown: 0, careless: 0, pending: 0,
        open: 0, lastAt: 0, labels: [] as string[],
      }
      for (const x of g.results) {
        if (x.pending) { r.pending++; continue }     // AI·선생님 승인 대기는 아직 오답이 아니다
        r.total++
        if (x.correct) { r.correct++; continue }
        r.wrong++
        if (x.unknown) r.unknown++
        if (x.careless) r.careless++
      }
      r.open = r.wrong - r.careless
      r.lastAt = Math.max(r.lastAt, Date.parse(g.date) || 0)
      const lb = labelOf(g, wbById, wsById)
      if (lb && !r.labels.includes(lb)) r.labels.push(lb)
      acc.set(st.id, r)
    }
    const list = [...acc.values()]
    list.sort((a, b) =>
      sort === 'recent' ? b.lastAt - a.lastAt
      : sort === 'name' ? a.st.name.localeCompare(b.st.name, 'ko')
      : (b.open - a.open) || (b.lastAt - a.lastAt))
    // 출처 내역 — "관리앱 아이들만 뜨는 것 아니냐"를 화면에서 바로 확인할 수 있게 나눠 센다.
    // (표시용으로 mgmtId 로 거르는 코드는 이 앱 어디에도 없다. 재원생이면 전원 잡힌다.)
    const linked = list.filter(r => r.st.mgmtId).length
    return {
      rows: list,
      idle: actives.filter(s => !acc.has(s.id)),
      totalActive: actives.length,
      linked,
      only: list.length - linked,
    }
  }, [students, gradings, workbooks, worksheets, subject, subjOnly, sort, today])

  const callOf = useMemo(() => new Map(calls.map(c => [c.studentId, c])), [calls])
  const shown = showZero ? rows : rows.filter(r => r.open > 0)
  const totalOpen = rows.reduce((s, r) => s + r.open, 0)

  async function call(st: Student, reason?: string) {
    const c: TeacherCall = {
      studentId: st.id, by: teacherName, text: callText, reason,
      state: 'calling', at: Date.now(), expiresAt: Date.now() + 15 * 60 * 1000,
    }
    setCalls(p => [...p.filter(x => x.studentId !== st.id), c])   // 즉시 반영
    await pushCall(c)
  }
  async function done(st: Student) {
    setCalls(p => p.filter(x => x.studentId !== st.id))
    await clearCall(st.id)
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-black">📋 오늘 교실</h1>
        <span className="text-sm text-ink2">
          오늘 답 입력 <b className="text-ink">{rows.length}명</b> ·
          미해결 오답 <b className="text-clay">{totalOpen}개</b>
          {calls.length > 0 && <> · 호출중 <b className="text-clay">{calls.filter(c => c.state === 'calling').length}명</b></>}
        </span>
      </div>
      <p className="mb-2 text-sm text-ink2">
        {branchLabel}재원생 <b className="text-ink">{totalActive}명</b> 전원이 대상입니다 —
        <b className="text-ink"> 관리앱 연결 {linked}명</b> ·
        <b className="text-ink"> 학습지앱 전용(수학만) {only}명</b>이 오늘 답을 입력했습니다.
      </p>
      <p className="mb-4 text-sm text-ink2">
        출제 여부·교재/학습지 구분 없이 전부 나옵니다. 오답이 많은 학생이 앞에 옵니다 —
        위에서부터 부르시면 됩니다.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <select value={sort} onChange={e => setSort(e.target.value as typeof sort)}
          className="rounded-lg border border-line px-2 py-1.5">
          <option value="wrong">오답 많은 순</option>
          <option value="recent">최근 입력 순</option>
          <option value="name">이름순</option>
        </select>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={subjOnly}
          onChange={e => setSubjOnly(e.target.checked)} className="accent-pine" />{subject}만</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={showZero}
          onChange={e => setShowZero(e.target.checked)} className="accent-pine" />다 맞은 학생도 보기</label>
        <div className="grow" />
        <span className="text-xs text-ink2">호출 문구</span>
        <select value={callText} onChange={e => setCallText(e.target.value)}
          className="rounded-lg border border-line px-2 py-1.5">
          {CALL_TEXTS.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {/* 🔴 기본과제는 선생님이 직접 채점한다 — 아래 목록은 「오늘 답을 입력한 학생」만 잡아서
          채점 전 학생이 안 뜬다. 출제된 기본과제 자체를 기준으로 하는 줄을 위에 둔다. */}
      <DailyGradeBar />

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-ink2">
          {rows.length === 0
            ? '아직 오늘 답을 입력한 학생이 없어요.'
            : '오늘 틀린 학생이 없어요 — [다 맞은 학생도 보기]를 켜면 전원이 보입니다.'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map(r => {
            const c = callOf.get(r.st.id)
            const coming = c?.state === 'coming'
            return (
              <div key={r.st.id} className={`rounded-2xl border bg-white p-4 ${
                coming ? 'border-pine bg-pine-soft/40' : c ? 'border-clay' : 'border-line'}`}>
                <div className="flex items-baseline gap-2">
                  <span className="font-black">{r.st.name}</span>
                  <span className="text-xs text-ink2">{r.st.grade}{r.st.klass ? ` · ${r.st.klass}` : ''}</span>
                  <div className="grow" />
                  <span className="text-xs text-ink2">{r.lastAt ? ago(r.lastAt) : ''}</span>
                </div>
                <div className="my-2 flex items-baseline gap-2">
                  <span className={`text-3xl font-black ${r.open > 0 ? 'text-clay' : 'text-pine'}`}>✕ {r.open}</span>
                  <span className="text-xs text-ink2">{r.total}문항 중 ○{r.correct}</span>
                </div>
                <div className="mb-2 flex flex-wrap gap-1 text-[10px] font-bold">
                  {r.unknown > 0 && <span className="rounded bg-amber-soft px-1.5 py-0.5 text-ink">모름 {r.unknown}</span>}
                  {r.careless > 0 && <span className="rounded bg-paper2 px-1.5 py-0.5 text-ink2">실수 {r.careless}</span>}
                  {r.pending > 0 && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-700">AI 대기 {r.pending}</span>}
                </div>
                <div className="mb-3 truncate text-xs text-ink2" title={r.labels.join(' · ')}>{r.labels.join(' · ')}</div>
                {!c ? (
                  <div className="flex gap-1.5">
                    {/* 부르기 전에 무엇을 틀렸는지 먼저 볼 수 있게 — 준비하고 부른다 */}
                    <button onClick={() => setTeach(r.st)}
                      className="shrink-0 rounded-lg border border-pine px-3 py-2 text-sm font-bold text-pine hover:bg-pine-soft">
                      👨‍🏫 {r.open}
                    </button>
                    <button onClick={() => call(r.st, `오답 ${r.open}개 · ${r.labels[0] ?? ''}`)}
                      className="grow rounded-lg bg-clay px-3 py-2 text-sm font-bold text-white hover:brightness-110">
                      📢 호출
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <span className={`grow rounded-lg px-3 py-2 text-center text-sm font-bold ${
                      coming ? 'bg-pine text-paper' : 'bg-red-50 text-clay'}`}>
                      {coming ? '🙋 온다고 함' : `🔔 호출중 ${ago(c.at)}`}
                    </span>
                    <button onClick={() => done(r.st)}
                      className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink2 hover:bg-paper2">
                      {coming ? '완료' : '취소'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 아무것도 안 한 학생 — 사실 이쪽이 더 위험하다. 여기서도 부를 수 있게 한다. */}
      {idle.length > 0 && (
        <div className="mt-6 rounded-2xl border border-line bg-paper2/40 p-4">
          <div className="mb-2 text-sm font-bold text-ink2">오늘 입력 없음 {idle.length}명 — 눌러서 호출</div>
          <div className="flex flex-wrap gap-1.5">
            {idle.map(s => {
              const c = callOf.get(s.id)
              return (
                <button key={s.id} onClick={() => (c ? done(s) : call(s, '오늘 입력 없음'))}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    c?.state === 'coming' ? 'border-pine bg-pine text-paper'
                    : c ? 'border-clay bg-red-50 text-clay' : 'border-line bg-white text-ink2 hover:bg-white'}`}>
                  {s.name}{c ? (c.state === 'coming' ? ' 🙋' : ' 🔔') : ''}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {teach && <TeachPanel student={teach} onClose={() => setTeach(null)} />}
    </div>
  )
}
