import { useEffect, useMemo, useState } from 'react'
import type { Grading, Student } from '../../types'
import { DIFF_LABEL, type Diff } from '../../types'
import { useStore } from '../../lib/store'
import { probIndex } from '../../lib/probIndex'
import { bigUnitNameOfType, typeName } from '../../data/curriculum'
import { dateKey } from '../../lib/dates'

/* 학습 보고서(기간) — 쪽 구성을 골라 만든다 (2026-11-20)
   · 기간: 월 선택 또는 시작일~끝일
   · 쪽: 표지 / 기간 분석(선생님 의견 포함 여부) / 주간 분석(난이도별 포함 여부) / 학습 내역 / 유형 성취 / 서술형 결과
   · 비교군: 학원 같은 학년 평균 / 같은 반 평균 / 안 씀 · 가산점(%)
   · 서술형 결과 깊이: 요약(유형별 점수) / 표준(+문항별 점수·첨삭) / 상세(+채점 기준)
   · «매달 자동»: 켜 두면 지난달 보고서가 저장 목록에 저절로 올라간다
   출력은 학습지와 같은 길(.mf-page → PDF) */

type Sec = 'cover' | 'summary' | 'weekly' | 'history' | 'types' | 'essay'
const SECS: [Sec, string][] = [['cover', '표지'], ['summary', '기간 분석'], ['weekly', '주간 분석'], ['history', '학습 내역'], ['types', '유형 성취'], ['essay', '서술형 결과']]
const pct = (a: number, b: number) => (b > 0 ? Math.round(a / b * 100) : null)
const autoKey = (sid: string) => `r|${sid}`

export default function PeriodReport({ student }: { student: Student }) {
  const { gradings, students, worksheets, workbooks, problems, wbItems, academyProfile, savedReports, addSavedReport, lectureLog, setLectureLog } = useStore()
  const now = new Date()
  const [mode, setMode] = useState<'month' | 'range'>('month')
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [from, setFrom] = useState(dateKey(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [to, setTo] = useState(dateKey(now))
  const [on, setOn] = useState<Record<Sec, boolean>>({ cover: true, summary: true, weekly: true, history: true, types: true, essay: true })
  const [withOpinion, setWithOpinion] = useState(true)
  const [withDiff, setWithDiff] = useState(true)
  const [opinion, setOpinion] = useState('')
  const [group, setGroup] = useState<'grade' | 'klass' | 'none'>('grade')
  const [bonus, setBonus] = useState(0)
  const [essayDepth, setEssayDepth] = useState<'요약' | '표준' | '상세'>('표준')
  const [busy, setBusy] = useState(false)

  const [a, b] = mode === 'month'
    ? [`${month}-01`, dateKey(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))]
    : [from <= to ? from : to, from <= to ? to : from]
  const label = mode === 'month' ? `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월` : `${a} ~ ${b}`

  // «매달 자동» — 켜져 있고 지난달 보고서가 저장 목록에 없으면 올린다
  const autoOn = !!lectureLog[autoKey(student.id)]
  useEffect(() => {
    if (!autoOn) return
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (savedReports.some(r => r.studentId === student.id && r.kind === 'monthly' && r.period === period)) return
    addSavedReport({ kind: 'monthly', studentId: student.id, name: `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 보고서`, period })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOn, student.id])

  const data = useMemo(() => {
    const pmap = probIndex(problems)
    const item = new Map(wbItems.map(i => [i.id, i]))
    const inP = (g: Grading) => { const k = dateKey(g.date); return k >= a && k <= b }
    const mine = gradings.filter(g => g.studentId === student.id && inP(g))
    const flat = (gs: Grading[]) => gs.flatMap(g => g.results.filter(r => !r.pending).map((r, i) => {
      const pid = r.itemId ?? (g.worksheetId ? worksheets.find(w => w.id === g.worksheetId)?.problemIds[i] : undefined)
      const p = pid ? pmap.get(pid) : undefined
      const it = r.itemId ? item.get(r.itemId) : undefined
      return { g, r, typeId: r.typeId ?? p?.typeId ?? it?.typeId, diff: (p?.diff ?? it?.diff) as Diff | undefined }
    }))
    const rows = flat(mine)
    const solved = rows.length, correct = rows.filter(x => x.r.correct).length
    const rate = pct(correct, solved)
    const shown = rate == null ? null : Math.min(100, Math.round(rate * (1 + bonus / 100)))
    // 비교군
    const peers = group === 'none' ? [] : students.filter(s => s.active && s.id !== student.id && (group === 'grade' ? s.grade === student.grade : !!student.klass && s.klass === student.klass))
    const peerRates = peers.map(s => { const rs = flat(gradings.filter(g => g.studentId === s.id && inP(g))); return pct(rs.filter(x => x.r.correct).length, rs.length) }).filter((x): x is number => x != null)
    const peerAvg = peerRates.length ? Math.round(peerRates.reduce((x, y) => x + y, 0) / peerRates.length) : null
    // 주간
    const weeks: { label: string; solved: number; rate: number | null; byDiff: Record<number, [number, number]> }[] = []
    const start = new Date(a), end = new Date(b)
    const mon = new Date(start.getFullYear(), start.getMonth(), start.getDate() - ((start.getDay() + 6) % 7))
    for (let d = new Date(mon); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)) {
      const e = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6)
      const ka = dateKey(d), kb = dateKey(e)
      const rs = rows.filter(x => { const k = dateKey(x.g.date); return k >= ka && k <= kb })
      const byDiff: Record<number, [number, number]> = {}
      for (const x of rs) { if (!x.diff) continue; const v = byDiff[x.diff] ?? [0, 0]; v[1]++; if (x.r.correct) v[0]++; byDiff[x.diff] = v }
      weeks.push({ label: `${d.getMonth() + 1}/${d.getDate()}~${e.getMonth() + 1}/${e.getDate()}`, solved: rs.length, rate: pct(rs.filter(x => x.r.correct).length, rs.length), byDiff })
    }
    // 학습 내역
    const history = mine.filter(g => g.results.length > 0).sort((x, y) => x.date.localeCompare(y.date)).map(g => ({
      date: dateKey(g.date), name: g.worksheetId ? worksheets.find(w => w.id === g.worksheetId)?.title ?? '학습지' : g.workbookId ? `${workbooks.find(w => w.id === g.workbookId)?.name ?? '교재'}${g.pageFrom ? ` ${g.pageFrom}${g.pageTo && g.pageTo !== g.pageFrom ? `~${g.pageTo}` : ''}쪽` : ''}` : g.title ?? '기록',
      n: g.results.length, ok: g.results.filter(r => r.correct).length,
    }))
    // 유형 성취
    const tm = new Map<string, [number, number]>()
    for (const x of rows) { if (!x.typeId) continue; const v = tm.get(x.typeId) ?? [0, 0]; v[1]++; if (x.r.correct) v[0]++; tm.set(x.typeId, v) }
    const types = [...tm].map(([id, v]) => ({ id, name: typeName(id), unit: bigUnitNameOfType(id), n: v[1], rate: Math.round(v[0] / v[1] * 100) })).filter(t => t.name && t.name !== t.id)
    const strong = types.filter(t => t.n >= 2).sort((x, y) => y.rate - x.rate || y.n - x.n).slice(0, 6)
    const weak = types.filter(t => t.n >= 2).sort((x, y) => x.rate - y.rate || y.n - x.n).slice(0, 6)
    // 서술형
    const essays = rows.filter(x => x.r.score != null && x.r.maxScore != null).map(x => ({ date: dateKey(x.g.date), type: x.typeId ? typeName(x.typeId) : '서술형', score: x.r.score!, max: x.r.maxScore!, feedback: x.r.feedback, criteria: x.r.criteria }))
    return { solved, correct, rate, shown, peerAvg, peerN: peerRates.length, weeks, history, strong, weak, essays, days: new Set(mine.map(g => dateKey(g.date))).size }
  }, [gradings, students, worksheets, workbooks, problems, wbItems, student, a, b, group, bonus])

  async function out(act: 'download' | 'print') {
    setBusy(true)
    try {
      const mod = await import('../../lib/sheetPdf')
      await mod.outputPages(act, `${student.name}_${label}_학습보고서`.replace(/\s+/g, '_'))
    } catch (e) { alert('PDF 를 만들지 못했어요. 잠시 뒤 다시 해 주세요.\n' + String(e).slice(0, 120)) }
    setBusy(false)
  }
  const save = () => addSavedReport({ kind: 'monthly', studentId: student.id, name: `${label} 학습 보고서`, period: mode === 'month' ? month : `${a}~${b}` })

  const C = '#2e6b4f'
  const page: React.CSSProperties = { position: 'relative', width: '210mm', height: '297mm', background: '#fff', color: '#1c1b18', overflow: 'hidden', marginBottom: '6mm' }
  const inner: React.CSSProperties = { position: 'absolute', left: '16mm', right: '16mm', top: '16mm', bottom: '16mm' }
  const h2: React.CSSProperties = { fontSize: '13pt', fontWeight: 800, borderBottom: `1.2pt solid ${C}`, paddingBottom: '2mm', marginBottom: '4mm' }
  const th: React.CSSProperties = { padding: '1.6mm 2mm', fontSize: '8.5pt', fontWeight: 700, color: '#5c5c5c', textAlign: 'left', borderBottom: '0.5pt solid #bfbfbf', background: '#fafaf8', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '1.5mm 2mm', fontSize: '9pt', borderBottom: '0.25pt solid #dedede' }
  const Head = ({ t }: { t: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6mm', fontSize: '9pt', color: '#8a8a84' }}>
      <span>{student.name} · {label} 학습 보고서</span><span>{t}</span>
    </div>
  )
  const logo = academyProfile.logoOff ? null : academyProfile.logo ?? null
  const body1 = on.summary || on.weekly
  const body2 = on.history || on.types
  const body3 = on.essay && data.essays.length > 0

  return (
    <div data-period-report>
      <div className="no-print mb-4 grid gap-3 rounded-2xl border border-line bg-white p-4 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <b>기간</b>
          <label className="flex items-center gap-1.5"><input type="radio" checked={mode === 'month'} onChange={() => setMode('month')} /> 월 선택</label>
          <input type="month" value={month} onChange={e => { setMonth(e.target.value); setMode('month') }} className="rounded-lg border border-line px-2 py-1" />
          <label className="flex items-center gap-1.5"><input type="radio" checked={mode === 'range'} onChange={() => setMode('range')} /> 날짜</label>
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setMode('range') }} className="rounded-lg border border-line px-2 py-1" />
          ~ <input type="date" value={to} onChange={e => { setTo(e.target.value); setMode('range') }} className="rounded-lg border border-line px-2 py-1" />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <b>쪽 구성</b>
          {SECS.map(([k, t]) => (
            <label key={k} className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" data-sec={k} className="h-4 w-4 accent-pine" checked={on[k]} onChange={e => setOn(p => ({ ...p, [k]: e.target.checked }))} /> {t}</label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" className="h-4 w-4 accent-pine" checked={withOpinion} onChange={e => setWithOpinion(e.target.checked)} /> 선생님 의견 넣기</label>
          <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" className="h-4 w-4 accent-pine" checked={withDiff} onChange={e => setWithDiff(e.target.checked)} /> 주간 분석에 난이도별</label>
          <span className="flex items-center gap-1.5">비교군
            <select value={group} onChange={e => setGroup(e.target.value as typeof group)} className="rounded-lg border border-line px-2 py-1">
              <option value="grade">학원 같은 학년 평균</option><option value="klass">같은 반 평균</option><option value="none">안 씀</option>
            </select></span>
          <span className="flex items-center gap-1.5">가산점 <input type="number" min={0} max={30} value={bonus} onChange={e => setBonus(Math.min(30, Math.max(0, Number(e.target.value) || 0)))} className="w-16 rounded-lg border border-line px-2 py-1" /> %</span>
          <span className="flex items-center gap-1.5">서술형
            <select value={essayDepth} onChange={e => setEssayDepth(e.target.value as typeof essayDepth)} className="rounded-lg border border-line px-2 py-1">
              <option>요약</option><option>표준</option><option>상세</option>
            </select></span>
        </div>
        {withOpinion && <textarea value={opinion} onChange={e => setOpinion(e.target.value)} rows={2} placeholder="선생님 의견 (비워 두면 숫자로 쓴 요약 문장이 들어갑니다)" className="rounded-lg border border-line px-3 py-2" />}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5" title="켜 두면 달이 바뀔 때 지난달 보고서가 저장 목록에 저절로 올라갑니다">
            <input type="checkbox" data-auto className="h-4 w-4 accent-pine" checked={autoOn} onChange={e => setLectureLog({ [autoKey(student.id)]: e.target.checked ? new Date().toISOString() : null })} /> 매달 자동으로 만들기
          </label>
          <div className="grow" />
          <button onClick={save} className="rounded-lg border border-line px-3 py-1.5 font-bold hover:bg-paper2">💾 저장 목록에 올리기</button>
          <button disabled={busy} onClick={() => out('download')} className="rounded-lg border border-line px-3 py-1.5 font-bold hover:bg-paper2 disabled:opacity-40">⬇ PDF 받기</button>
          <button disabled={busy} onClick={() => out('print')} className="rounded-lg bg-pine px-3 py-1.5 font-bold text-paper disabled:opacity-40">🖨 인쇄</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        {on.cover && (
          <div className="mf-page" style={page}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100mm', background: C }} />
            <div style={{ position: 'absolute', left: '22mm', right: '22mm', top: '34mm', color: '#fff' }}>
              <div style={{ fontSize: '13pt', fontWeight: 700, opacity: 0.9 }}>학습 보고서</div>
              <div style={{ marginTop: '5mm', fontSize: '32pt', fontWeight: 800, lineHeight: 1.2 }}>{label}</div>
            </div>
            <div style={{ position: 'absolute', left: '22mm', right: '22mm', top: '122mm', fontSize: '13pt', display: 'grid', gridTemplateColumns: '26mm 1fr', rowGap: '5mm' }}>
              <span style={{ color: '#8a8a84' }}>이름</span><b>{student.name}</b>
              <span style={{ color: '#8a8a84' }}>학년·반</span><b>{student.grade}{student.klass ? ` · ${student.klass}` : ''}</b>
              <span style={{ color: '#8a8a84' }}>기간</span><b>{a} ~ {b}</b>
              <span style={{ color: '#8a8a84' }}>만든 날</span><b>{dateKey(now)}</b>
            </div>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: '24mm', display: 'flex', justifyContent: 'center' }}>
              {logo ? <img src={logo} alt="" style={{ maxWidth: '70mm', maxHeight: '15mm', objectFit: 'contain' }} /> : <b style={{ fontSize: '14pt' }}>{academyProfile.academyName ?? ''}</b>}
            </div>
          </div>
        )}

        {body1 && (
          <div className="mf-page" style={page}><div style={inner}>
            <Head t="분석" />
            {on.summary && (
              <>
                <div style={h2}>기간 분석</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3mm' }}>
                  {[['공부한 날', `${data.days}일`], ['푼 문제', `${data.solved}문제`], ['정답률', data.shown != null ? `${data.shown}%` : '—'], [group === 'none' ? '맞은 문제' : group === 'grade' ? '같은 학년 평균' : '같은 반 평균', group === 'none' ? `${data.correct}문제` : data.peerAvg != null ? `${data.peerAvg}%` : '—']].map(([k, v]) => (
                    <div key={k} style={{ border: '0.5pt solid #d9d9d4', borderRadius: '2.5mm', padding: '3.5mm', textAlign: 'center' }}>
                      <div style={{ fontSize: '8.5pt', color: '#5c5c5c' }}>{k}</div>
                      <div style={{ marginTop: '1mm', fontSize: '18pt', fontWeight: 800, color: C }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '2mm', fontSize: '8pt', color: '#8a8a84' }}>
                  {bonus > 0 && `정답률에는 가산점 ${bonus}%를 더했습니다(원래 ${data.rate ?? '—'}%). `}
                  {group !== 'none' && `비교 평균은 같은 기간에 기록이 있는 우리 학원 학생 ${data.peerN}명 기준입니다.`}
                </div>
                {withOpinion && (
                  <div style={{ marginTop: '5mm', background: '#f6f6f2', borderRadius: '2.5mm', padding: '4mm', fontSize: '10pt', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    <b style={{ display: 'block', marginBottom: '1mm', fontSize: '9pt', color: C }}>선생님 의견</b>
                    {opinion.trim() || `${label} 동안 ${data.days}일 공부하며 ${data.solved}문제를 풀었고 정답률은 ${data.rate ?? '—'}%입니다.${data.weak[0] ? ` «${data.weak[0].name}» 유형을 조금 더 연습하면 좋겠습니다.` : ''}${data.strong[0] ? ` «${data.strong[0].name}» 유형은 잘하고 있습니다.` : ''}`}
                  </div>
                )}
              </>
            )}
            {on.weekly && (
              <>
                <div style={{ ...h2, marginTop: on.summary ? '9mm' : 0 }}>주간 분석</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1pt solid #3f3f3f' }}>
                  <thead><tr><th style={th}>주</th><th style={th}>푼 문제</th><th style={th}>정답률</th>{withDiff && [1, 2, 3, 4, 5].map(d => <th key={d} style={th}>{DIFF_LABEL[d as Diff]}</th>)}</tr></thead>
                  <tbody>
                    {data.weeks.map(w => (
                      <tr key={w.label}><td style={td}>{w.label}</td><td style={td}>{w.solved}</td><td style={{ ...td, fontWeight: 700 }}>{w.rate != null ? `${w.rate}%` : '—'}</td>
                        {withDiff && [1, 2, 3, 4, 5].map(d => { const v = w.byDiff[d]; return <td key={d} style={td}>{v ? `${Math.round(v[0] / v[1] * 100)}% (${v[1]})` : '—'}</td> })}</tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div></div>
        )}

        {body2 && (
          <div className="mf-page" style={page}><div style={inner}>
            <Head t="내역·성취" />
            {on.history && (
              <>
                <div style={h2}>학습 내역</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1pt solid #3f3f3f' }}>
                  <thead><tr><th style={th}>날짜</th><th style={th}>학습지·교재</th><th style={th}>채점</th><th style={th}>맞음</th><th style={th}>정답률</th></tr></thead>
                  <tbody>
                    {data.history.slice(0, on.types ? 14 : 30).map((h, i) => (
                      <tr key={i}><td style={td}>{h.date.slice(5).replace('-', '/')}</td><td style={{ ...td, maxWidth: '95mm', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name}</td><td style={td}>{h.n}</td><td style={td}>{h.ok}</td><td style={{ ...td, fontWeight: 700 }}>{Math.round(h.ok / h.n * 100)}%</td></tr>
                    ))}
                    {data.history.length === 0 && <tr><td style={td} colSpan={5}>이 기간에는 채점 기록이 없습니다.</td></tr>}
                  </tbody>
                </table>
                {data.history.length > (on.types ? 14 : 30) && <div style={{ marginTop: '1.5mm', fontSize: '8pt', color: '#8a8a84' }}>그 밖에 {data.history.length - (on.types ? 14 : 30)}건이 더 있습니다.</div>}
              </>
            )}
            {on.types && (
              <>
                <div style={{ ...h2, marginTop: on.history ? '8mm' : 0 }}>유형 성취</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8mm' }}>
                  {([['잘하는 유형', data.strong], ['더 연습할 유형', data.weak]] as const).map(([t, list]) => (
                    <div key={t}>
                      <div style={{ fontSize: '10pt', fontWeight: 800, marginBottom: '2mm' }}>{t}</div>
                      {list.length === 0 && <div style={{ fontSize: '9pt', color: '#8a8a84' }}>두 문제 이상 푼 유형이 아직 없습니다.</div>}
                      {list.map(x => (
                        <div key={x.id} style={{ marginBottom: '2.4mm' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5pt' }}><span style={{ maxWidth: '58mm', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.name}</span><b>{x.rate}% <span style={{ color: '#8a8a84', fontWeight: 400 }}>({x.n})</span></b></div>
                          <div style={{ height: '2mm', background: '#f1f1ee', borderRadius: '1mm', overflow: 'hidden' }}><div style={{ width: `${x.rate}%`, height: '100%', background: t === '잘하는 유형' ? C : '#d9422e' }} /></div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div></div>
        )}

        {body3 && (
          <div className="mf-page" style={page}><div style={inner}>
            <Head t={`서술형 (${essayDepth})`} />
            <div style={h2}>서술형 결과</div>
            <div style={{ fontSize: '10pt', marginBottom: '4mm' }}>문항 {data.essays.length}개 · 받은 점수 <b style={{ color: C }}>{data.essays.reduce((x, y) => x + y.score, 0)}</b> / {data.essays.reduce((x, y) => x + y.max, 0)}점</div>
            {essayDepth === '요약' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1pt solid #3f3f3f' }}>
                <thead><tr><th style={th}>유형</th><th style={th}>문항</th><th style={th}>점수</th></tr></thead>
                <tbody>{[...new Set(data.essays.map(e => e.type))].map(t => { const es = data.essays.filter(e => e.type === t); return <tr key={t}><td style={td}>{t}</td><td style={td}>{es.length}</td><td style={{ ...td, fontWeight: 700 }}>{es.reduce((x, y) => x + y.score, 0)} / {es.reduce((x, y) => x + y.max, 0)}</td></tr> })}</tbody>
              </table>
            ) : data.essays.slice(0, 9).map((e, i) => (
              <div key={i} style={{ borderBottom: '0.25pt solid #dedede', padding: '2.5mm 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5pt' }}><span>{e.date.slice(5).replace('-', '/')} · {e.type}</span><b style={{ color: C }}>{e.score} / {e.max}점</b></div>
                {e.feedback && <div style={{ marginTop: '1mm', fontSize: '9pt', color: '#333', whiteSpace: 'pre-wrap' }}>{e.feedback}</div>}
                {essayDepth === '상세' && e.criteria?.map((c, k) => <div key={k} style={{ fontSize: '8.5pt', color: '#5c5c5c' }}>· {c.text} — {c.got}/{c.weight}</div>)}
              </div>
            ))}
          </div></div>
        )}
      </div>
    </div>
  )
}
