import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useBrand } from '../lib/brand'
import { courseTagOfType, typeName, typeUnitName } from '../data/curriculum'
import { diagnosisCourses } from '../lib/diagnosis'
import { achievementOf } from '../lib/achievement'

// ── 입학 진단 리포트 — 학습 배경(등록 정보) + 입학 진단고사 채점 결과를 상담용 한 장으로 ──
// 데이터는 전부 실시간 재계산(스토어) — 별도 저장 테이블 없음. 인쇄(.note-print)로 PDF 배포.

interface TypeStat { typeId: string; wrong: number; total: number }

export default function DiagnosisReport() {
  const { studentId } = useParams()
  const { students, worksheets, assignments, gradings, problems, ensureCourse } = useStore()
  const brand = useBrand()
  const student = students.find(s => s.id === studentId)
  const [comment, setComment] = useState('')

  // 진단 문항 typeId 해석 보조용 풀 로드 (구 기록 fallback)
  useEffect(() => {
    if (student) diagnosisCourses(student.grade).forEach(c => ensureCourse(c))
  }, [student, ensureCourse])

  const probType = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of problems) m.set(p.id, p.typeId)
    return m
  }, [problems])

  // 학생별 진단고사(입학 TEST 태그 + 배정) 채점 집계
  const calc = useMemo(() => {
    function diagOf(sid: string) {
      const wsIds = new Set(
        worksheets.filter(w => !w.deletedAt && w.tags.includes('입학 TEST')
          && assignments.some(a => a.worksheetId === w.id && a.studentId === sid)).map(w => w.id))
      const gs = gradings.filter(g => g.studentId === sid && g.worksheetId && wsIds.has(g.worksheetId))
      const byType = new Map<string, TypeStat>()
      let total = 0, wrong = 0
      for (const g of gs) {
        const ws = worksheets.find(w => w.id === g.worksheetId)
        g.results.forEach((r, i) => {
          const typeId = r.typeId
            ?? (r.itemId ? probType.get(r.itemId) : undefined)
            ?? (ws ? probType.get(ws.problemIds[i] ?? '') : undefined)
          if (!typeId) return
          const cur = byType.get(typeId) ?? { typeId, wrong: 0, total: 0 }
          cur.total++; total++
          if (!r.correct) { cur.wrong++; wrong++ }
          byType.set(typeId, cur)
        })
      }
      return { wsIds, gs, byType, total, wrong }
    }
    if (!student) return null
    const mine = diagOf(student.id)
    // 또래(같은 학년 재원생) 평균 정답률 — 진단 응시자만
    const peers = students
      .filter(s => s.active && s.id !== student.id && s.grade === student.grade)
      .map(s => diagOf(s.id)).filter(d => d.total > 0)
    const peerRate = peers.length
      ? peers.reduce((a, d) => a + (1 - d.wrong / d.total), 0) / peers.length
      : null
    return { ...mine, peerRate, peerN: peers.length }
  }, [student, students, worksheets, assignments, gradings, probType])

  if (!student || !calc) {
    return <div className="p-8 text-sm text-ink2">학생을 찾을 수 없습니다. <Link to="/manage" className="text-pine underline">학생 관리로</Link></div>
  }

  const stats = [...calc.byType.values()]
  const rate = calc.total ? 1 - calc.wrong / calc.total : null
  const curCourseTag = (() => {   // 현재 과정 태그 ('중1-1' 등) — 선수 결손 구분용
    const c = diagnosisCourses(student.grade)[0]
    return c ? courseTagOfType0(c) : student.grade
  })()

  // 과정별·대단원별 집계
  const byCourse = groupBy(stats, s => courseTagOfType(s.typeId) || '기타')
  const byUnit = groupBy(stats, s => `${courseTagOfType(s.typeId)} · ${typeUnitName(s.typeId).split(' · ')[0]}`)
  const weak = stats.filter(s => s.wrong > 0).sort((a, b) => b.wrong / b.total - a.wrong / a.total)
  const prereqGaps = weak.filter(s => courseTagOfType(s.typeId) && courseTagOfType(s.typeId) !== curCourseTag)
  const strong = stats.filter(s => s.total >= 1 && s.wrong === 0)

  // 자동 소견 (규칙 기반) — 선생님이 아래 코멘트로 보완
  const findings: string[] = []
  if (rate !== null) {
    const pct = Math.round(rate * 100)
    findings.push(`진단고사 전체 정답률 ${pct}% (${calc.total}문항 중 ${calc.total - calc.wrong}개 정답)${calc.peerRate !== null ? ` — 또래 재원생 평균 ${Math.round(calc.peerRate * 100)}%` : ''}`)
    const worstUnits = [...byUnit.entries()].filter(([, v]) => sumT(v) >= 2)
      .sort((a, b) => rateOf(a[1]) - rateOf(b[1])).slice(0, 2)
    for (const [name, v] of worstUnits) {
      if (rateOf(v) < 0.7) findings.push(`보강 필요 단원: ${name} (정답률 ${Math.round(rateOf(v) * 100)}%)`)
    }
    if (prereqGaps.length) findings.push(`선수 과정 결손 ${prereqGaps.length}개 유형 — 현행 진도 전에 짧은 보강을 권장`)
    if (strong.length) findings.push(`강점 유형 ${strong.length}개 — 해당 단원은 빠른 진도가 가능`)
  } else {
    findings.push('진단고사 채점 기록이 아직 없습니다. 테스트 > 입학 TEST에서 생성·응시 후 다시 열어주세요.')
  }
  if (student.traits?.length) findings.push(`상담 시 확인된 성향: ${student.traits.join(', ')}`)
  if (student.goal) findings.push(`학습 목표: ${student.goal}`)

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.')
  return (
    <div className="mx-auto max-w-3xl">
      <div className="note-noprint mb-3 flex items-center justify-between">
        <Link to="/manage" className="text-sm text-ink2 hover:text-ink">← 학생 관리</Link>
        <div className="flex items-center gap-2">
          <Link to="/prep/test" className="rounded-lg border border-line px-3 py-1.5 text-sm font-bold text-ink2 hover:border-pine">🧭 진단고사 만들기</Link>
          <button onClick={() => window.print()}
            className="rounded-lg bg-pine px-4 py-1.5 text-sm font-bold text-paper">🖨 인쇄 / PDF</button>
        </div>
      </div>

      <div className="note-print rounded-2xl border border-line bg-white p-8">
        {/* 머리말 */}
        <div className="flex items-end justify-between border-b-2 border-ink pb-3">
          <div>
            <p className="text-xs font-bold text-ink2">{brand}</p>
            <h1 className="text-2xl font-black">입학 진단 리포트</h1>
          </div>
          <div className="text-right text-sm">
            <p className="font-black">{student.name} <span className="font-semibold text-ink2">({student.grade}{student.school ? ` · ${student.school}` : ''})</span></p>
            <p className="text-xs text-ink2">작성일 {today}</p>
          </div>
        </div>

        {/* 1. 학습 배경 */}
        <Section title="1. 학습 배경 (상담 접수 내용)">
          <div className="grid gap-1 text-sm">
            {!!student.recentExams?.length && (
              <Row k="최근 학교시험">
                {student.recentExams.map((e, i) =>
                  <span key={i} className="mr-2">{e.name} {e.subject} <b>{e.score}점</b></span>)}
              </Row>
            )}
            {student.prevEdu && <Row k="이전 학습">{student.prevEdu}</Row>}
            {student.progressNow && <Row k="현행·선행">{student.progressNow}</Row>}
            {student.goal && <Row k="학습 목표">{student.goal}</Row>}
            {!!student.traits?.length && <Row k="학습 성향">{student.traits.join(' · ')}</Row>}
            {student.weeklyHours && <Row k="자기공부 시간">{student.weeklyHours}</Row>}
            {student.parentConcern && <Row k="학부모 관심">{student.parentConcern}</Row>}
            {student.memo && <Row k="특이사항">{student.memo}</Row>}
            {!student.recentExams?.length && !student.prevEdu && !student.goal && !student.traits?.length && (
              <p className="text-ink2">등록된 학습 배경이 없습니다. 학생 상세에서 입력하면 여기 표시됩니다.</p>
            )}
          </div>
        </Section>

        {/* 2. 진단고사 결과 */}
        <Section title="2. 입학 진단고사 결과">
          {rate === null ? (
            <p className="text-sm text-ink2">채점 기록이 없습니다.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-4">
                <Kpi label="전체 정답률" value={`${Math.round(rate * 100)}%`} />
                <Kpi label="응시 문항" value={`${calc.total}문항`} />
                <Kpi label="오답" value={`${calc.wrong}문항`} />
                {calc.peerRate !== null && <Kpi label={`또래 평균 (${calc.peerN}명)`} value={`${Math.round(calc.peerRate * 100)}%`} />}
              </div>
              <div className="grid gap-1.5">
                {[...byCourse.entries()].map(([course, v]) => (
                  <BarRow key={course} name={course || '기타'} rate={rateOf(v)} count={sumT(v)} />
                ))}
              </div>
              <p className="mb-1 mt-3 text-xs font-bold text-ink2">대단원별</p>
              <div className="grid gap-1.5">
                {[...byUnit.entries()].sort((a, b) => rateOf(a[1]) - rateOf(b[1])).map(([unit, v]) => (
                  <BarRow key={unit} name={unit} rate={rateOf(v)} count={sumT(v)} />
                ))}
              </div>
            </>
          )}
        </Section>

        {/* 3. 취약 유형 / 선수 결손 */}
        {weak.length > 0 && (
          <Section title="3. 보강이 필요한 유형">
            <div className="grid gap-1">
              {weak.slice(0, 12).map(s => (
                <div key={s.typeId} className="flex items-center gap-2 text-sm">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${achievementOf(s).cls}`}>
                    {s.total - s.wrong}/{s.total}
                  </span>
                  <span className="font-semibold">{typeName(s.typeId)}</span>
                  <span className="text-xs text-ink2">{courseTagOfType(s.typeId)} · {typeUnitName(s.typeId)}</span>
                  {courseTagOfType(s.typeId) !== curCourseTag && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">선수 결손</span>
                  )}
                </div>
              ))}
              {weak.length > 12 && <p className="text-xs text-ink2">외 {weak.length - 12}개 유형 (유형분석 화면에서 전체 확인)</p>}
            </div>
          </Section>
        )}

        {/* 4. 종합 소견 */}
        <Section title={`${weak.length > 0 ? 4 : 3}. 종합 소견 및 학습 제안`}>
          <ul className="grid list-disc gap-1 pl-5 text-sm">
            {findings.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
            placeholder="선생님 종합 코멘트 (입력한 내용이 인쇄에 그대로 들어갑니다)"
            className="note-noprint mt-3 w-full rounded-lg border border-line px-3 py-2 text-sm" />
          {comment && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-paper2 p-3 text-sm">{comment}</p>}
        </Section>

        <p className="mt-6 border-t border-line pt-3 text-center text-xs text-ink2">
          {brand} · 입학 진단 리포트 · 문의는 학원으로 연락 주세요
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h2 className="mb-2 border-l-4 border-pine pl-2 text-base font-black">{title}</h2>
      {children}
    </div>
  )
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2">
      <span className="font-bold text-ink2">{k}</span>
      <span>{children}</span>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line px-4 py-2 text-center">
      <p className="text-[11px] font-bold text-ink2">{label}</p>
      <p className="text-lg font-black">{value}</p>
    </div>
  )
}

function BarRow({ name, rate, count }: { name: string; rate: number; count: number }) {
  const pct = Math.round(rate * 100)
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-64 shrink-0 truncate">{name}</span>
      <div className="h-3 flex-1 overflow-hidden rounded bg-paper2">
        <div className={`h-full ${pct >= 70 ? 'bg-pine' : pct >= 50 ? 'bg-amber' : 'bg-red-400'}`}
          style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 shrink-0 text-right text-xs font-bold">{pct}% <span className="font-normal text-ink2">({count})</span></span>
    </div>
  )
}

function groupBy<T>(arr: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of arr) {
    const k = key(x)
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(x)
  }
  return m
}
const sumT = (v: TypeStat[]) => v.reduce((a, s) => a + s.total, 0)
const rateOf = (v: TypeStat[]) => { const t = sumT(v); return t ? 1 - v.reduce((a, s) => a + s.wrong, 0) / t : 0 }

// 과정 id → 과정 태그 ('m1-1' → '중1-1') — courseTagOfType는 typeId용이라 과정 id용 보조
import { curriculumFor } from '../data/curriculum'
function courseTagOfType0(courseId: string): string {
  const c = curriculumFor(courseId)
  return c.grade.startsWith('고') ? c.label.replace(/ \(.*\)$/, '') : c.grade
}
