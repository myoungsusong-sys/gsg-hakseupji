import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import { brandFor, DEFAULT_ACADEMY } from '../../lib/brand'
import type { Subject } from '../../lib/subject'
import { DEFAULT_SHEET_OPTIONS, type Student } from '../../types'
import { AssignModal } from '../../pages/WorksheetList'
import { EXAM_COURSES } from '../../data/curriculum-exam'
import {
  courseById, draftComment, kindOfCourse, loadExamSheetRows, parentReportText, studentCourseResults, worksheetFromRow,
  type CourseResult, type ExamKind, type ExamSheetRow,
} from '../../lib/examSets'

// ── 📝 시험대비·수업세트 (선생님 › 내신 대비) — 2026-10-27 명수쌤
//    «시험대비 세트를 학습지앱에 반영해서 채점을 할 수 있게» · «따로 탭을 만들어서 학부모 보고까지»
//   ① 과정을 고른다 → ② 학습지가 아직 없으면 [학습지 만들기] (학습지 행 목록 public/figs/exam/_worksheets.json 그대로)
//   ③ [출제하기] — 출제 창은 학습지 목록과 같은 것(AssignModal) ④ 학생별 점수 ⑤ [학부모 보고] — 카톡에 붙일 글을 복사
//   🔴 학부모에게 보내는 것은 선생님이 직접 한다(여기서는 글만 만든다).
const KINDS: ExamKind[] = ['시험대비', '수업세트']

async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select()
    const ok = document.execCommand('copy'); ta.remove(); return ok
  }
}

export default function ExamSetPanel() {
  const { worksheets, students, assignments, gradings, klassOrder, saveWorksheet, addAssignment, academyProfile } = useStore()
  const [rows, setRows] = useState<ExamSheetRow[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { loadExamSheetRows().then(setRows).catch(e => setErr(String(e?.message ?? e))) }, [])
  const [kind, setKind] = useState<ExamKind>('시험대비')
  // 수업세트는 과목·번호순(set2-<과목>-<번호>) · 시험대비는 등록 순서 그대로
  const courses = EXAM_COURSES.filter(c => kindOfCourse(c.id) === kind).sort((a, b) => (kind === '수업세트' ? a.id.localeCompare(b.id) : 0))
  const [cid, setCid] = useState(courses[0]?.id ?? '')
  const course = courseById(cid)
  const live = useMemo(() => new Map(worksheets.filter(w => !w.deletedAt).map(w => [w.id, w])), [worksheets])
  const courseRows = (rows ?? []).filter(r => r.course === cid)
  const missing = courseRows.filter(r => !live.has(r.id))
  const [assignWs, setAssignWs] = useState<string | null>(null)
  const [report, setReport] = useState<Student | null>(null)

  // 이 과정 학습지를 받았거나 푼 학생 — 결과 한 줄씩
  const studentRows = useMemo(() => {
    const out: { st: Student; r: CourseResult }[] = []
    for (const st of students) {
      if (!st.active) continue
      const r = studentCourseResults(st, worksheets, assignments, gradings).find(x => x.course.id === cid)
      if (r) out.push({ st, r })
    }
    return out.sort((a, b) => (a.st.klass ?? '').localeCompare(b.st.klass ?? '') || a.st.name.localeCompare(b.st.name))
  }, [students, worksheets, assignments, gradings, cid])

  const sheetStat = (wsId: string) => {
    const who = new Set(assignments.filter(a => a.worksheetId === wsId).map(a => a.studentId))
    let done = 0, sum = 0
    for (const { r } of studentRows) {
      const s = r.sheets.find(x => x.ws.id === wsId)
      if (s && s.score != null) { done++; sum += s.score }
    }
    return { assigned: who.size, assignedIds: [...who], done, avg: done ? Math.round(sum / done) : null }
  }

  function makeSheets() {
    for (const r of missing) saveWorksheet(worksheetFromRow(r, DEFAULT_SHEET_OPTIONS))
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {KINDS.map(k => (
          <button key={k} onClick={() => { setKind(k); setCid(EXAM_COURSES.filter(c => kindOfCourse(c.id) === k).map(c => c.id).sort((x, y) => (k === '수업세트' ? x.localeCompare(y) : 0))[0] ?? '') }}
            className={`rounded-full px-4 py-1.5 text-sm font-bold ${kind === k ? 'bg-pine text-paper' : 'border border-line bg-white text-ink2'}`}>
            {k} {EXAM_COURSES.filter(c => kindOfCourse(c.id) === k).length}
          </button>
        ))}
        <select value={cid} onChange={e => setCid(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold">
          {courses.map(c => <option key={c.id} value={c.id}>{c.label} · {c.grade}</option>)}
        </select>
      </div>

      {err && <p className="text-sm text-clay">학습지 목록을 못 불러왔어요: {err}</p>}
      {course && rows && (
        <section className="rounded-2xl border border-line bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-black">{course.label}</h3>
            {missing.length > 0 && (
              <button onClick={makeSheets} className="rounded-lg bg-pine px-3 py-1.5 text-sm font-bold text-paper hover:brightness-110">
                📥 이 과정 학습지 만들기 ({missing.length}장)
              </button>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink2">
                <th className="py-2">학습지</th><th className="py-2">문항</th><th className="py-2">출제</th><th className="py-2">완료</th><th className="py-2">평균</th><th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {courseRows.map(r => {
                const ws = live.get(r.id)
                const s = sheetStat(r.id)
                return (
                  <tr key={r.id} className="border-b border-line/50 last:border-0">
                    <td className="py-2 pr-2 font-semibold">{r.title.replace(/^(내신대비|수업세트) \| /, '')}</td>
                    <td className="py-2">{r.problemIds.length}</td>
                    <td className="py-2">{s.assigned}명</td>
                    <td className="py-2">{s.done}명</td>
                    <td className="py-2">{s.avg != null ? `${s.avg}점` : '—'}</td>
                    <td className="py-2 text-right">
                      {ws ? (
                        <button onClick={() => setAssignWs(r.id)} className="whitespace-nowrap rounded-lg border border-pine px-2.5 py-1 text-xs font-bold text-pine hover:bg-pine-soft">📤 출제하기</button>
                      ) : <span className="text-xs text-ink2">학습지 없음</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      {course && (
        <section className="rounded-2xl border border-line bg-white p-4">
          <h3 className="mb-3 font-black">학생별 결과 · 학부모 보고</h3>
          {studentRows.length === 0 ? (
            <p className="text-sm text-ink2">아직 이 과정 학습지를 받은 학생이 없어요. 위에서 [📤 출제하기]로 내 주세요.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink2">
                  <th className="py-2">학생</th><th className="py-2">완료</th><th className="py-2">정답률</th><th className="py-2">더 볼 곳</th><th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {studentRows.map(({ st, r }) => (
                  <tr key={st.id} className="border-b border-line/50 last:border-0">
                    <td className="py-2 font-semibold">{st.name}{st.klass ? <span className="ml-1 text-xs text-ink2">{st.klass}</span> : null}</td>
                    <td className="py-2">{r.done}/{r.sheets.filter(s => s.assigned).length}장</td>
                    <td className="py-2">{r.answered ? `${Math.round(r.correct / r.answered * 100)}% (${r.correct}/${r.answered})` : '—'}</td>
                    <td className="py-2 text-xs text-ink2">{r.weak.slice(0, 2).map(w => w.name).join(', ') || '—'}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => setReport(st)} className="whitespace-nowrap rounded-lg border border-amber px-2.5 py-1 text-xs font-bold text-amber hover:bg-amber-soft">📨 학부모 보고</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {assignWs && (() => {
        const ws = live.get(assignWs)
        if (!ws) return null
        return (
          <AssignModal
            title={`「${ws.title}」`}
            students={students.filter(s => s.active)}
            klassOrder={klassOrder}
            initial={sheetStat(assignWs).assignedIds}
            onClose={() => setAssignWs(null)}
            onSubmit={(ids, k, reveal, exam) => {
              const already = new Set(sheetStat(assignWs).assignedIds)
              const add = ids.filter(id => !already.has(id))
              if (add.length) addAssignment(assignWs, add, k, reveal, exam)
              setAssignWs(null)
            }}
          />
        )
      })()}

      {report && course && (
        <ParentReportModal student={report} focus={course.id}
          brand={brandFor(academyProfile?.academyName?.trim() || DEFAULT_ACADEMY, course.subject as Subject)}
          results={studentCourseResults(report, worksheets, assignments, gradings)}
          onClose={() => setReport(null)} />
      )}
    </div>
  )
}

function ParentReportModal({ student, focus, brand, results, onClose }: {
  student: Student; focus: string; brand: string; results: CourseResult[]; onClose: () => void
}) {
  const [all, setAll] = useState(false)          // 이 과정만 / 이 학생의 시험대비 전부
  const shown = all ? results : results.filter(r => r.course.id === focus)
  const [comments, setComments] = useState<Record<string, string>>(() => Object.fromEntries(results.map(r => [r.course.id, draftComment(r)])))
  const text = parentReportText(brand, student, shown, comments)
  const [copied, setCopied] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-black">📨 {student.name} 학부모 보고</h3>
          <button onClick={onClose} className="rounded-lg px-2 text-lg text-ink2 hover:bg-paper2">✕</button>
        </div>
        <label className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} className="h-4 w-4 accent-pine" />
          이 학생의 시험대비·수업세트 전부 넣기 ({results.length}과정)
        </label>
        {shown.map(r => (
          <div key={r.course.id} className="mb-2">
            <div className="mb-1 text-xs font-bold text-ink2">💬 한 줄 평 — {r.course.label}</div>
            <textarea value={comments[r.course.id] ?? ''} onChange={e => setComments(c => ({ ...c, [r.course.id]: e.target.value }))}
              rows={2} className="w-full rounded-lg border border-line p-2 text-sm" />
          </div>
        ))}
        <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-paper2 p-3 text-[13px] leading-relaxed">{text}</pre>
        <div className="mt-3 flex items-center justify-end gap-2">
          <span className="text-xs text-ink2">복사해서 카톡에 붙여 넣으세요 — 보내기는 선생님이 직접 해요</span>
          <button onClick={async () => { if (await copy(text)) { setCopied(true); setTimeout(() => setCopied(false), 1800) } }}
            className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper hover:brightness-110">
            {copied ? '✓ 복사됨' : '📋 글 복사'}
          </button>
        </div>
      </div>
    </div>
  )
}
