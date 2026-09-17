import { useMemo, useState } from 'react'
import { EXAM_NAMES, examSubjects, normalizeExam, parseSubjects } from '../lib/exam'
import type { SchoolExam, SchoolExamDay } from '../types'

// ── 🏫 시험 일정 입력 폼 — 학생앱(학생이 직접)과 선생님 내신 대비 화면이 같이 쓴다 ──
//   시험 이름 · 날짜별 과목(한 줄에 "국어, 수학") · 과목별 범위(선택) · 메모.
//   저장 전에 normalizeExam 으로 날짜 정렬·빈 줄 제거. 날짜가 하나도 없으면 저장 불가.

type Row = { date: string; text: string }
const rowsOf = (e?: SchoolExam): Row[] =>
  e?.days.length ? e.days.map(d => ({ date: d.date, text: d.subjects.join(', ') })) : [{ date: '', text: '' }, { date: '', text: '' }]

export default function ExamForm({ initial, studentId, by, onSave, onCancel, onDelete }: {
  initial?: SchoolExam; studentId: string; by: 'student' | 'teacher'
  onSave: (e: SchoolExam) => void; onCancel?: () => void; onDelete?: () => void
}) {
  const isCustom = !!initial && !(EXAM_NAMES as readonly string[]).includes(initial.name)
  const [name, setName] = useState(initial?.name ?? EXAM_NAMES[2])
  const [custom, setCustom] = useState(isCustom)
  const [rows, setRows] = useState<Row[]>(rowsOf(initial))
  const [ranges, setRanges] = useState<Record<string, string>>(initial?.ranges ?? {})
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [err, setErr] = useState('')

  const days: SchoolExamDay[] = useMemo(() => rows.map(r => ({ date: r.date, subjects: parseSubjects(r.text) })), [rows])
  const subjects = useMemo(() => examSubjects({ days } as SchoolExam), [days])
  const setRow = (i: number, patch: Partial<Row>) => setRows(p => p.map((r, k) => (k === i ? { ...r, ...patch } : r)))

  function save() {
    const e = normalizeExam({
      id: initial?.id ?? `ex-${studentId}-${Date.now().toString(36)}`,
      studentId, name: custom ? name : name, days, ranges, memo, by, updatedAt: new Date().toISOString(),
    })
    if (!e.name) return setErr('시험 이름을 넣어 주세요.')
    if (!e.days.length) return setErr('날짜를 하나 이상 넣어 주세요 (달력에서 고르면 돼요).')
    if (e.days.some(d => !d.subjects.length)) return setErr('과목이 비어 있는 날이 있어요. 그날 보는 과목을 적어 주세요.')
    setErr(''); onSave(e)
  }

  return (
    <div className="grid gap-4">
      <div>
        <div className="mb-1 text-xs font-bold text-ink2">시험 이름</div>
        <div className="flex flex-wrap gap-1.5">
          {EXAM_NAMES.map(n => (
            <button key={n} type="button" onClick={() => { setCustom(false); setName(n) }}
              className={`rounded-full border px-3 py-1 text-sm font-bold ${!custom && name === n ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink2 hover:border-pine'}`}>{n}</button>
          ))}
          <button type="button" onClick={() => { setCustom(true); setName(isCustom ? (initial?.name ?? '') : '') }}
            className={`rounded-full border px-3 py-1 text-sm font-bold ${custom ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink2 hover:border-pine'}`}>직접 입력</button>
        </div>
        {custom && (
          <input value={name} onChange={e => setName(e.target.value)} placeholder="예: 3월 학력평가"
            className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm" aria-label="시험 이름" />
        )}
      </div>

      <div>
        <div className="mb-1 text-xs font-bold text-ink2">날짜별 과목 — 그날 보는 과목을 쉼표로 (예: 국어, 수학)</div>
        <div className="grid gap-1.5">
          {rows.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input type="date" value={r.date} onChange={e => setRow(i, { date: e.target.value })}
                className="rounded-lg border border-line px-2.5 py-1.5 text-sm" aria-label={`${i + 1}일차 날짜`} />
              <input value={r.text} onChange={e => setRow(i, { text: e.target.value })} placeholder="국어, 수학"
                className="min-w-0 grow rounded-lg border border-line px-3 py-1.5 text-sm" aria-label={`${i + 1}일차 과목`} />
              {rows.length > 1 && (
                <button type="button" onClick={() => setRows(p => p.filter((_, k) => k !== i))}
                  className="rounded-lg border border-line px-2 py-1.5 text-xs text-ink2 hover:border-clay hover:text-clay" aria-label="이 날 지우기">✕</button>
              )}
            </div>
          ))}
        </div>
        {rows.length < 7 && (
          <button type="button" onClick={() => setRows(p => [...p, { date: '', text: '' }])}
            className="mt-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-xs font-bold text-ink2 hover:border-pine hover:text-pine">＋ 날짜 추가</button>
        )}
      </div>

      {subjects.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-bold text-ink2">과목별 시험 범위 (알면 적어 주세요 — 대비 과제에 그대로 나와요)</div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {subjects.map(s => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <b className="w-20 shrink-0 truncate" title={s}>{s}</b>
                <input value={ranges[s] ?? ''} onChange={e => setRanges(p => ({ ...p, [s]: e.target.value }))}
                  placeholder="예: 3단원~5단원, p.60~120" className="min-w-0 grow rounded-lg border border-line px-3 py-1.5 text-sm" aria-label={`${s} 범위`} />
              </label>
            ))}
          </div>
        </div>
      )}

      <label className="text-sm">
        <div className="mb-1 text-xs font-bold text-ink2">메모 (선택)</div>
        <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="예: 수학 서술형 4문제, 영어 듣기 없음"
          className="w-full rounded-lg border border-line px-3 py-1.5 text-sm" />
      </label>

      {err && <p className="text-sm font-bold text-clay">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} className="rounded-lg bg-pine px-5 py-2.5 text-sm font-black text-paper hover:brightness-110">
          {initial ? '고친 내용 저장' : '시험 일정 저장'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink2">취소</button>}
        <div className="grow" />
        {initial && onDelete && (
          <button type="button" onClick={() => { if (confirm('이 시험 일정을 지울까요?')) onDelete() }}
            className="rounded-lg border border-line bg-white px-3 py-2.5 text-xs font-bold text-clay hover:border-clay">지우기</button>
        )}
      </div>
    </div>
  )
}
