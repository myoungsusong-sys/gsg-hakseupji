import { useMemo, useState } from 'react'
import type { Diff, Grading, Problem, Student, Worksheet } from '../../types'
import { DIFF_LABEL, THEMES } from '../../types'
import { useStore } from '../../lib/store'
import { bigUnitNameOfType, typeName } from '../../data/curriculum'
import { isStaleChunkError } from '../../lib/staleChunk'

/* 원클릭 보고서 — 학습지 1장의 결과를 A4 한 장으로 (2026-11-20)
   · 위: 종합 등급 · 점수 · 맞은 수
   · 평균과 등수: 학원 전체 / 같은 반 (이 학습지를 채점한 학생들 기준, 넣을 범위를 고른다)
   · 난이도별 · 단원별 정답률 — 학생 막대와 학원 평균 막대를 나란히
   · 문항별 결과표
   출력은 학습지와 같은 길(.mf-page 를 그림으로 떠 진짜 PDF) — 내려받기 / 인쇄 */

type Row = { p: Problem; no: number; ok: boolean | null }

// 이 학습지의 학생별 최신 채점 → 문항 id 별 정오 (옛 기록은 순서로 해석)
function marksOf(g: Grading | undefined, ws: Worksheet): Map<string, boolean> {
  const m = new Map<string, boolean>()
  if (!g) return m
  g.results.forEach((r, i) => {
    const id = r.itemId ?? ws.problemIds[i]
    if (id) m.set(id, !!r.correct && !r.unknown)
  })
  return m
}
function latestOf(gradings: Grading[], sid: string, wsId: string): Grading | undefined {
  let latest: Grading | undefined
  for (const g of gradings) {
    if (g.studentId !== sid || g.source !== '학습지' || g.worksheetId !== wsId) continue
    if (!latest || g.date > latest.date) latest = g
  }
  return latest
}
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null)
// 등급 — 점수 구간 (90↑ A · 80↑ B · 70↑ C · 60↑ D · 그 아래 E)
const gradeOf = (score: number) => (score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'E')

export default function OneClickReport({ student, ws, list, onClose }: {
  student: Student; ws: Worksheet; list: Problem[]; onClose: () => void
}) {
  const { gradings, students, academyProfile } = useStore()
  const theme = THEMES[ws.theme] ?? THEMES.pine
  const [scopeAll, setScopeAll] = useState(true)      // 학원 전체 평균·등수
  const [scopeKlass, setScopeKlass] = useState(true)  // 같은 반 평균·등수
  const [busy, setBusy] = useState(false)

  const data = useMemo(() => {
    const mine = marksOf(latestOf(gradings, student.id, ws.id), ws)
    const rows: Row[] = list.map((p, i) => ({ p, no: i + 1, ok: mine.has(p.id) ? mine.get(p.id)! : null }))
    const graded = rows.filter(r => r.ok != null)
    const correct = graded.filter(r => r.ok).length
    const score = pct(correct, graded.length)

    // 이 학습지를 채점한 다른 학생들(재원생) — 점수와 문항별 정오
    const peers = students
      .filter(s => s.active)
      .map(s => ({ s, m: marksOf(latestOf(gradings, s.id, ws.id), ws) }))
      .filter(x => x.m.size > 0)
      .map(x => ({ ...x, score: pct([...x.m.values()].filter(Boolean).length, x.m.size) ?? 0 }))
    const rankIn = (group: typeof peers) => {
      if (score == null || group.length === 0) return null
      const avg = Math.round(group.reduce((a, x) => a + x.score, 0) / group.length)
      const rank = group.filter(x => x.score > score).length + 1
      return { avg, rank, n: group.length }
    }
    const all = rankIn(peers)
    const klass = student.klass ? rankIn(peers.filter(x => x.s.klass === student.klass)) : null

    // 묶음별(난이도·단원) 정답률 — 학생 / 학원 평균
    const bucket = (keyOf: (p: Problem) => string) => {
      const order: string[] = []
      const me = new Map<string, [number, number]>(), av = new Map<string, [number, number]>()
      for (const r of rows) {
        const k = keyOf(r.p)
        if (!me.has(k)) { order.push(k); me.set(k, [0, 0]); av.set(k, [0, 0]) }
        if (r.ok != null) { const v = me.get(k)!; v[1]++; if (r.ok) v[0]++ }
        for (const x of peers) {
          if (!x.m.has(r.p.id)) continue
          const v = av.get(k)!; v[1]++; if (x.m.get(r.p.id)) v[0]++
        }
      }
      return order.map(k => ({ k, n: rows.filter(r => keyOf(r.p) === k).length, me: pct(...me.get(k)!), av: pct(...av.get(k)!) }))
    }
    const byDiff = bucket(p => String(p.diff)).sort((a, b) => Number(a.k) - Number(b.k))
    const byUnit = bucket(p => bigUnitNameOfType(p.typeId) || '기타')
    return { rows, graded: graded.length, correct, score, all, klass, byDiff, byUnit, peers: peers.length }
  }, [gradings, students, student, ws, list])

  const dateText = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  const logo = academyProfile.logoOff ? null : academyProfile.logo ?? null

  async function out(act: 'download' | 'print') {
    setBusy(true)
    try {
      const mod = await import('../../lib/sheetPdf')
      await mod.outputPages(act, `${student.name}_${ws.title}_보고서`.replace(/\s+/g, '_'))
    } catch (e) {
      alert(isStaleChunkError(e)
        ? '새 버전이 배포되어 화면이 오래됐어요. 새로고침한 뒤 다시 눌러 주세요.'
        : 'PDF 를 만들지 못했어요. 잠시 뒤 다시 해 주세요.\n' + String(e).slice(0, 120))
    }
    setBusy(false)
  }

  const Bar = ({ me, av }: { me: number | null; av: number | null }) => (
    <div style={{ display: 'grid', gap: '0.8mm' }}>
      <div style={{ height: '3.2mm', background: '#f1f1ee', borderRadius: '1mm', overflow: 'hidden' }}>
        <div style={{ width: `${me ?? 0}%`, height: '100%', background: theme.main }} />
      </div>
      <div style={{ height: '1.8mm', background: '#f1f1ee', borderRadius: '1mm', overflow: 'hidden' }}>
        <div style={{ width: `${av ?? 0}%`, height: '100%', background: '#b9b9b2' }} />
      </div>
    </div>
  )
  const th: React.CSSProperties = { padding: '1.6mm 2mm', fontSize: '8.5pt', fontWeight: 700, color: '#5c5c5c', textAlign: 'center', whiteSpace: 'nowrap', borderBottom: '0.5pt solid #bfbfbf', background: '#fafaf8' }
  const td: React.CSSProperties = { padding: '1.6mm 2mm', fontSize: '9.5pt', textAlign: 'center', borderBottom: '0.25pt solid #dedede' }
  const half = Math.ceil(data.rows.length / 2)

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-ink/50 p-6" onClick={onClose}>
      <div className="mx-auto w-fit" onClick={e => e.stopPropagation()}>
        {/* 도구 줄 */}
        <div className="no-print mb-3 flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm shadow">
          <b>원클릭 보고서</b>
          <span className="text-ink2">평균·등수 넣기</span>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" className="h-4 w-4 accent-pine" checked={scopeAll} onChange={e => setScopeAll(e.target.checked)} /> 학원 전체
          </label>
          <label className={`flex items-center gap-1.5 ${student.klass ? 'cursor-pointer' : 'opacity-40'}`}>
            <input type="checkbox" className="h-4 w-4 accent-pine" disabled={!student.klass} checked={scopeKlass && !!student.klass} onChange={e => setScopeKlass(e.target.checked)} /> 같은 반
          </label>
          <div className="grow" />
          <button disabled={busy} onClick={() => out('download')} className="rounded-lg border border-line px-3 py-1.5 font-bold hover:bg-paper2 disabled:opacity-40">⬇ PDF 받기</button>
          <button disabled={busy} onClick={() => out('print')} className="rounded-lg bg-pine px-3 py-1.5 font-bold text-paper disabled:opacity-40">🖨 인쇄</button>
          <button onClick={onClose} className="px-2 text-lg leading-none text-ink2 hover:text-ink" aria-label="닫기">✕</button>
        </div>

        {/* A4 한 장 */}
        <div className="mf-page mf-last" style={{ position: 'relative', width: '210mm', height: '297mm', background: '#ffffff', color: '#1c1b18', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: '14mm', right: '14mm', top: '13mm' }}>
            {/* 머리말 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '10pt', fontWeight: 700, color: theme.main }}>학습지 결과 보고서</div>
                <div style={{ marginTop: '1.5mm', fontSize: '17pt', fontWeight: 800, lineHeight: 1.25 }}>{ws.title}</div>
                <div style={{ marginTop: '2.5mm', fontSize: '10.5pt', color: '#333333' }}>
                  <b>{student.name}</b> · {student.grade}{student.klass ? ` · ${student.klass}` : ''} · {dateText}
                </div>
              </div>
              {logo
                ? <img src={logo} alt="" style={{ maxWidth: '46.6mm', maxHeight: '10mm', objectFit: 'contain' }} />
                : <div style={{ fontSize: '11pt', fontWeight: 800, color: '#333333' }}>{academyProfile.academyName ?? ws.author}</div>}
            </div>
            <div style={{ marginTop: '5mm', borderTop: `1.2pt solid ${theme.main}` }} />

            {/* 요약 3칸 */}
            <div style={{ marginTop: '6mm', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4mm' }}>
              {[
                ['종합 등급', data.score != null ? gradeOf(data.score) : '—', '90점↑ A · 80↑ B · 70↑ C · 60↑ D'],
                ['점수', data.score != null ? `${data.score}점` : '채점 전', `채점한 ${data.graded}문제 기준`],
                ['맞은 문제', `${data.correct} / ${data.rows.length}`, `틀린 문제 ${data.graded - data.correct}개`],
              ].map(([label, big, sub]) => (
                <div key={label} style={{ border: '0.5pt solid #d9d9d4', borderRadius: '2.5mm', padding: '4mm', textAlign: 'center' }}>
                  <div style={{ fontSize: '9pt', color: '#5c5c5c' }}>{label}</div>
                  <div style={{ marginTop: '1mm', fontSize: '22pt', fontWeight: 800, color: theme.main, lineHeight: 1.2 }}>{big}</div>
                  <div style={{ marginTop: '1mm', fontSize: '7.5pt', color: '#8a8a84' }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* 평균과 등수 */}
            {((scopeAll && data.all) || (scopeKlass && data.klass)) && (
              <table style={{ marginTop: '6mm', width: '100%', borderCollapse: 'collapse', borderTop: '1pt solid #3f3f3f', borderBottom: '1pt solid #3f3f3f' }}>
                <thead><tr>
                  <th style={th}>범위</th><th style={th}>응시</th><th style={th}>평균</th><th style={th}>내 점수</th><th style={th}>등수</th>
                </tr></thead>
                <tbody>
                  {scopeAll && data.all && (
                    <tr><td style={td}>학원 전체</td><td style={td}>{data.all.n}명</td><td style={td}>{data.all.avg}점</td>
                      <td style={{ ...td, fontWeight: 800, color: theme.main }}>{data.score}점</td><td style={td}>{data.all.n}명 중 <b>{data.all.rank}등</b></td></tr>
                  )}
                  {scopeKlass && data.klass && (
                    <tr><td style={td}>{student.klass} 반</td><td style={td}>{data.klass.n}명</td><td style={td}>{data.klass.avg}점</td>
                      <td style={{ ...td, fontWeight: 800, color: theme.main }}>{data.score}점</td><td style={td}>{data.klass.n}명 중 <b>{data.klass.rank}등</b></td></tr>
                  )}
                </tbody>
              </table>
            )}

            {/* 난이도별 · 단원별 정답률 */}
            <div style={{ marginTop: '7mm', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8mm' }}>
              {([['난이도별 정답률', data.byDiff.map(b => ({ ...b, label: DIFF_LABEL[Number(b.k) as Diff] ?? b.k }))],
                ['단원별 정답률', data.byUnit.map(b => ({ ...b, label: b.k }))]] as const).map(([title, items]) => (
                <div key={title}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '11pt', fontWeight: 800 }}>{title}</div>
                    <div style={{ fontSize: '7.5pt', color: '#5c5c5c' }}>
                      <span style={{ display: 'inline-block', width: '2.6mm', height: '2.6mm', background: theme.main, borderRadius: '0.5mm', verticalAlign: 'middle' }} /> {student.name}
                      <span style={{ display: 'inline-block', width: '2.6mm', height: '2.6mm', background: '#b9b9b2', borderRadius: '0.5mm', verticalAlign: 'middle', marginLeft: '2.5mm' }} /> 학원 평균
                    </div>
                  </div>
                  <div style={{ marginTop: '3mm', display: 'grid', gap: '2.6mm' }}>
                    {items.slice(0, 8).map(b => (
                      <div key={b.k} style={{ display: 'grid', gridTemplateColumns: '26mm 1fr 19mm', alignItems: 'center', gap: '2mm' }}>
                        <div style={{ fontSize: '8.5pt', lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {b.label} <span style={{ color: '#8a8a84' }}>({b.n})</span>
                        </div>
                        <Bar me={b.me} av={b.av} />
                        <div style={{ fontSize: '8.5pt', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <b style={{ color: theme.main }}>{b.me != null ? `${b.me}%` : '—'}</b>
                          <span style={{ color: '#8a8a84' }}> / {b.av != null ? `${b.av}%` : '—'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* 문항별 결과 — 두 단 */}
            <div style={{ marginTop: '7mm', fontSize: '11pt', fontWeight: 800 }}>문항별 결과</div>
            <div style={{ marginTop: '2.5mm', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6mm' }}>
              {[data.rows.slice(0, half), data.rows.slice(half)].map((part, ci) => (
                <table key={ci} style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1pt solid #3f3f3f', borderBottom: '1pt solid #3f3f3f', alignSelf: 'start' }}>
                  <thead><tr><th style={{ ...th, width: '11mm' }}>번호</th><th style={{ ...th, textAlign: 'left' }}>유형</th><th style={{ ...th, width: '14mm' }}>난이도</th><th style={{ ...th, width: '11mm' }}>결과</th></tr></thead>
                  <tbody>
                    {part.map(r => (
                      <tr key={r.no} style={{ background: r.ok === false ? '#fdf1ee' : undefined }}>
                        <td style={{ ...td, fontSize: '8.5pt', padding: '1mm 1.5mm', fontWeight: 700, color: theme.main }}>{String(r.no).padStart(2, '0')}</td>
                        <td style={{ ...td, fontSize: '8pt', padding: '1mm 1.5mm', textAlign: 'left', maxWidth: '52mm', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{typeName(r.p.typeId) === r.p.typeId ? '유형 미분류' : typeName(r.p.typeId)}</td>
                        <td style={{ ...td, fontSize: '8pt', padding: '1mm 1.5mm' }}>{DIFF_LABEL[r.p.diff]}</td>
                        <td style={{ ...td, fontSize: '9pt', padding: '1mm 1.5mm', fontWeight: 800, color: r.ok == null ? '#b9b9b2' : r.ok ? '#2b7de9' : '#d9422e' }}>{r.ok == null ? '—' : r.ok ? '○' : '✕'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}
            </div>
          </div>
          <div style={{ position: 'absolute', left: '14mm', right: '14mm', bottom: '9mm', display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: '#8a8a84' }}>
            <span>평균과 등수는 이 학습지를 채점한 우리 학원 학생 {data.peers}명 기준입니다.</span>
            <span>{academyProfile.academyName ?? ws.author}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
