import { useMemo, useState } from 'react'
import { CURRICULA, curriculumFor, typeName, typeUnitName } from '../data/curriculum'
import { useStore, uid } from '../lib/store'
import MathText from '../components/MathText'
import ProblemContent from '../components/ProblemContent'
import GradeSelect from '../components/GradeSelect'
import type { Diff, Kind, Problem } from '../types'
import { DIFF_COLOR, DIFF_LABEL } from '../types'

export default function Bank() {
  const { problems, addProblem, removeProblem, favorites, toggleFavorite } = useStore()
  const [gradeId, setGradeId] = useState('m1-1')
  const cur = curriculumFor(gradeId)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [adding, setAdding] = useState(false)
  const [bulk, setBulk] = useState(false)

  const list = useMemo(
    () => problems.filter(p => typeFilter === 'all' || p.typeId === typeFilter),
    [problems, typeFilter],
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* 유형 트리 */}
      <div className="h-fit rounded-2xl border border-line bg-white p-5">
        <GradeSelect value={gradeId} onChange={g => { setGradeId(g); setTypeFilter('all') }} className="mb-3 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold" />
        <button onClick={() => setTypeFilter('all')}
          className={`mb-3 w-full rounded-lg px-3 py-2 text-left text-sm font-bold ${typeFilter === 'all' ? 'bg-pine text-paper' : 'hover:bg-paper2'}`}>
          전체 문제 ({problems.length})
        </button>
        {cur.units.map(u => (
          <div key={u.id} className="mb-3">
            <div className="mb-1 text-sm font-black text-ink2">{u.name}</div>
            {u.mids.map(m => (
              <div key={m.id} className={m.name === u.name ? 'mb-1' : 'mb-1 ml-2'}>
                {m.name !== u.name && <div className="text-xs font-bold text-ink2">{m.name}</div>}
                {m.subs.map(s => (
                  <div key={s.id} className={s.name === m.name ? '' : 'ml-2'}>
                    {s.name !== m.name && <div className="mt-0.5 text-[11px] font-semibold text-ink2/80">{s.name}</div>}
                    {s.types.map(t => {
                      const n = problems.filter(p => p.typeId === t.id).length
                      return (
                        <button key={t.id} onClick={() => setTypeFilter(t.id)}
                          className={`ml-2 block w-[calc(100%-8px)] rounded px-2 py-1 text-left text-xs ${typeFilter === t.id ? 'bg-pine-soft font-bold text-pine-dark' : 'text-ink2 hover:bg-paper2'}`}>
                          {t.name} <span className="opacity-60">({n})</span>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 문제 목록 */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <h2 className="font-bold">
            {typeFilter === 'all' ? '전체 문제' : `${typeUnitName(typeFilter)} · ${typeName(typeFilter)}`}
            <span className="ml-2 text-sm font-normal text-ink2">{list.length}개</span>
          </h2>
          <div className="grow" />
          <button onClick={() => setBulk(true)}
            className="rounded-lg border border-pine px-4 py-2 text-sm font-bold text-pine hover:bg-pine-soft">
            📥 문제 일괄 등록
          </button>
          <button onClick={() => setAdding(true)}
            className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper hover:bg-pine-dark">
            + 문제 직접 추가
          </button>
        </div>

        <div className="grid gap-3">
          {list.map(p => (
            <div key={p.id} className="rounded-2xl border border-line bg-white p-5">
              <div className="mb-2 flex items-center gap-2 text-xs">
                <span className={`rounded px-1.5 py-0.5 font-bold ${DIFF_COLOR[p.diff]}`}>{DIFF_LABEL[p.diff]}</span>
                <span className="rounded bg-paper2 px-1.5 py-0.5 text-ink2">{p.kind}</span>
                <span className="text-ink2">{typeName(p.typeId)}</span>
                <span className="rounded-full border border-line px-2 py-0.5 text-ink2">{p.source}</span>
                {p.twinGroup && <span className="rounded-full bg-pine-soft px-2 py-0.5 font-semibold text-pine-dark">쌍둥이 있음</span>}
                <button onClick={() => toggleFavorite(p.id)} title="즐겨찾기"
                  className={`text-base leading-none ${favorites.includes(p.id) ? 'text-amber' : 'text-line hover:text-amber'}`}>★</button>
                {p.custom && (
                  <>
                    <span className="rounded-full bg-amber-soft px-2 py-0.5 font-semibold text-amber">내 문제</span>
                    <div className="grow" />
                    <button onClick={() => { if (confirm('이 문제를 삭제할까요?')) removeProblem(p.id) }}
                      className="rounded border border-line px-2 py-1 text-ink2 hover:border-clay hover:text-clay">삭제</button>
                  </>
                )}
              </div>
              <ProblemContent p={p} imgClass="w-full max-w-md" />
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-semibold text-pine">정답·해설 보기</summary>
                <div className="mt-2 rounded-lg bg-paper2 p-3">
                  <b>정답:</b> <MathText text={p.answer} />
                  <div className="mt-1"><b>해설:</b> <MathText text={p.solution} /></div>
                </div>
              </details>
            </div>
          ))}
        </div>
      </div>

      {adding && <AddProblemModal onClose={() => setAdding(false)} onAdd={p => { addProblem(p); setAdding(false) }} />}
      {bulk && <BulkAddModal courseId={gradeId} onClose={() => setBulk(false)}
        onAdd={ps => { ps.forEach(addProblem); setBulk(false); alert(`${ps.length}문제를 등록했습니다.`) }} />}
    </div>
  )
}

function AddProblemModal({ onClose, onAdd }: { onClose: () => void; onAdd: (p: Problem) => void }) {
  const [typeId, setTypeId] = useState(CURRICULA[0].units[0].mids[0].subs[0].types[0].id)
  const [kind, setKind] = useState<Kind>('주관식')
  const [diff, setDiff] = useState<Diff>(3)
  const [body, setBody] = useState('')
  const [choices, setChoices] = useState(['', '', '', '', ''])
  const [answer, setAnswer] = useState('')
  const [solution, setSolution] = useState('')

  function submit() {
    if (!body.trim() || !answer.trim()) { alert('문제와 정답은 필수입니다.'); return }
    onAdd({
      id: uid('cp'), typeId, kind, diff,
      body: body.trim(),
      choices: kind === '객관식' ? choices.map(c => c.trim()) : undefined,
      answer: answer.trim(),
      solution: solution.trim() || '(해설 없음)',
      source: '직접 입력', custom: true,
    })
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-bold">문제 직접 추가</h3>
        <div className="grid gap-4 text-sm">
          <label className="grid gap-1 font-bold">
            유형
            <select value={typeId} onChange={e => setTypeId(e.target.value)}
              className="rounded-lg border border-line px-3 py-2 font-normal">
              {CURRICULA.map(c => (
                <optgroup key={c.id} label={`${c.grade} ${c.label.replace(' (22개정)', '')}`}>
                  {c.units.flatMap(u => u.mids.flatMap(m => m.subs.flatMap(s => s.types.map(t => (
                    <option key={t.id} value={t.id}>{u.name} › {t.name}</option>
                  )))))}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="flex gap-6">
            <label className="grid gap-1 font-bold">
              형태
              <div className="flex gap-2 font-normal">
                {(['주관식', '객관식'] as Kind[]).map(k => (
                  <button key={k} onClick={() => setKind(k)}
                    className={`rounded-lg border px-3 py-1.5 ${kind === k ? 'border-pine bg-pine-soft font-semibold' : 'border-line'}`}>{k}</button>
                ))}
              </div>
            </label>
            <label className="grid gap-1 font-bold">
              난이도
              <div className="flex gap-2 font-normal">
                {([1, 2, 3, 4, 5] as Diff[]).map(d => (
                  <button key={d} onClick={() => setDiff(d)}
                    className={`rounded-lg border px-3 py-1.5 ${diff === d ? 'border-pine bg-pine-soft font-semibold' : 'border-line'}`}>{DIFF_LABEL[d]}</button>
                ))}
              </div>
            </label>
          </div>
          <label className="grid gap-1 font-bold">
            문제 <span className="font-normal text-ink2">(수식은 $...$ 로 감싸면 됩니다. 예: $2^3\times3^2$)</span>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={3}
              className="rounded-lg border border-line px-3 py-2 font-normal" />
          </label>
          {body.trim() && (
            <div className="rounded-lg bg-paper2 p-3"><b className="text-xs text-ink2">미리보기:</b> <MathText text={body} /></div>
          )}
          {kind === '객관식' && (
            <div className="grid gap-1.5">
              <span className="font-bold">보기 5개</span>
              {choices.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span>{'①②③④⑤'[i]}</span>
                  <input value={c} onChange={e => setChoices(prev => prev.map((x, xi) => xi === i ? e.target.value : x))}
                    className="grow rounded-lg border border-line px-3 py-1.5" />
                </div>
              ))}
            </div>
          )}
          <label className="grid gap-1 font-bold">
            정답 <span className="font-normal text-ink2">{kind === '객관식' ? '(예: ③)' : '(예: $x=6$)'}</span>
            <input value={answer} onChange={e => setAnswer(e.target.value)}
              className="rounded-lg border border-line px-3 py-2 font-normal" />
          </label>
          <label className="grid gap-1 font-bold">
            해설
            <textarea value={solution} onChange={e => setSolution(e.target.value)} rows={3}
              className="rounded-lg border border-line px-3 py-2 font-normal" />
          </label>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="rounded-lg border border-line px-5 py-2.5">취소</button>
            <button onClick={submit} className="rounded-lg bg-pine px-6 py-2.5 font-bold text-paper">추가</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 일괄 등록 ─────────────────────────────────────────────
interface BulkBlock {
  typeQuery: string
  typeId: string | null
  kind: Kind
  diff: Diff
  body: string
  choices?: string[]
  answer: string
  solution: string
  source: string
  twin: string
  errors: string[]
  warns: string[]
}

const DIFF_FROM_TEXT: Record<string, Diff> = { 하: 1, 중하: 2, 중: 3, 상: 4, 최상: 5 }
const BULK_FIELD_RE = /^(유형|형태|난이도|출처|쌍둥이|문제|보기|답|해설)\s*[:：]\s*(.*)$/

// 유형 퍼지 매핑: 선택 과정 우선 → 전 과정. 유형명 먼저, 그다음 소단원명(첫 유형으로 귀속)
function findTypeIdFuzzy(query: string, courseId: string): string | null {
  const q = query.replace(/\s+/g, '')
  if (!q) return null
  const ordered = [curriculumFor(courseId), ...CURRICULA.filter(c => c.id !== courseId)]
  for (const c of ordered) {
    for (const u of c.units) for (const m of u.mids) for (const s of m.subs)
      for (const t of s.types) {
        const n = t.name.replace(/\s+/g, '')
        if (n.includes(q) || q.includes(n)) return t.id
      }
    for (const u of c.units) for (const m of u.mids) for (const s of m.subs) {
      const n = s.name.replace(/\s+/g, '')
      if (s.types.length > 0 && (n.includes(q) || q.includes(n))) return s.types[0].id
    }
  }
  return null
}

function parseBulk(text: string, courseId: string): BulkBlock[] {
  const rawBlocks = text.split(/^\s*-{3,}\s*$/m).map(b => b.trim()).filter(Boolean)
  return rawBlocks.map(raw => {
    const f: Record<string, string> = {}
    let cur: string | null = null
    for (const line of raw.split('\n')) {
      const m = line.match(BULK_FIELD_RE)
      if (m) { cur = m[1]; f[cur] = f[cur] ? `${f[cur]}\n${m[2]}` : m[2] }
      else if (cur) f[cur] = `${f[cur]}\n${line}`
    }
    const g = (k: string) => (f[k] ?? '').trim()

    const errors: string[] = []
    const warns: string[] = []

    const typeQuery = g('유형')
    const typeId = findTypeIdFuzzy(typeQuery, courseId)
    if (!typeQuery) errors.push('유형 없음')
    else if (!typeId) errors.push(`유형 매칭 실패: "${typeQuery}"`)

    const kind: Kind = g('형태').includes('객') ? '객관식' : '주관식'

    const dv = g('난이도')
    const diff: Diff = DIFF_FROM_TEXT[dv] ?? 3
    if (dv && !DIFF_FROM_TEXT[dv]) warns.push(`난이도 "${dv}" 인식 불가 → 중`)

    const body = g('문제')
    if (!body) errors.push('문제 없음')
    const answer = g('답')
    if (!answer) errors.push('답 없음')

    let choices: string[] | undefined
    if (kind === '객관식') {
      const rawC = g('보기')
      choices = rawC.split(/(?=[①②③④⑤])/)
        .map(s => s.replace(/^[①②③④⑤]\s*/, '').trim())
        .filter(Boolean)
      if (choices.length < 2) choices = rawC.split('\n').map(s => s.trim()).filter(Boolean)
      if (choices.length < 2) errors.push('객관식인데 보기 부족')
      else if (choices.length !== 5) warns.push(`보기 ${choices.length}개 (5개 아님)`)
    }

    const solution = g('해설')
    if (!solution) warns.push('해설 없음')

    return {
      typeQuery, typeId, kind, diff, body, choices, answer, solution,
      source: g('출처'), twin: g('쌍둥이'), errors, warns,
    }
  })
}

function BulkAddModal({ courseId, onClose, onAdd }: {
  courseId: string
  onClose: () => void
  onAdd: (ps: Problem[]) => void
}) {
  const [text, setText] = useState('')
  const parsed = useMemo(() => parseBulk(text, courseId), [text, courseId])
  const valid = parsed.filter(b => b.errors.length === 0)

  function register() {
    if (valid.length === 0) return
    onAdd(valid.map(b => ({
      id: uid('p'),
      typeId: b.typeId!,
      kind: b.kind,
      diff: b.diff,
      body: b.body,
      choices: b.kind === '객관식' ? b.choices : undefined,
      answer: b.answer,
      solution: b.solution || '(해설 없음)',
      source: b.source || '직접 입력',
      twinGroup: b.twin || undefined,
      custom: true,
    })))
  }

  const placeholder = [
    '유형: 소인수분해 하기',
    '형태: 주관식',
    '난이도: 중',
    '출처: 자체 제작',
    '쌍둥이: pf-01',
    '문제: $60$을 소인수분해하시오.',
    '답: $2^2\\times3\\times5$',
    '해설: $60=2\\times30=2\\times2\\times15=2^2\\times3\\times5$',
    '---',
    '유형: 정수의 덧셈',
    '형태: 객관식',
    '문제: $(-3)+(+5)$의 값은?',
    '보기: ① $-2$ ② $-1$ ③ $0$ ④ $1$ ⑤ $2$',
    '답: ⑤',
  ].join('\n')

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
        <h3 className="mb-1 text-lg font-bold">📥 문제 일괄 등록</h3>
        <p className="mb-3 text-sm text-ink2">
          문제 사이를 <b>---</b> 줄로 구분해 붙여넣으세요. 필드: 유형 / 형태 / 난이도(하·중하·중·상·최상) / 출처 / 쌍둥이 / 문제 / 보기 / 답 / 해설.
          유형은 현재 선택된 과정을 우선으로 전 과정 유형명·소단원명에서 검색해 매핑합니다.
        </p>
        <div className="mb-3 rounded-lg bg-amber-soft px-3 py-2 text-sm font-semibold text-clay">
          ⚠️ 유료 서비스(매쓰플랫 등)의 문제를 옮겨 넣는 것은 저작권 위반입니다. 직접 만든 문제·보유 자료만 등록하세요.
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={12} placeholder={placeholder}
          className="w-full rounded-lg border border-line px-3 py-2 font-mono text-sm" />

        {parsed.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-sm font-bold">미리보기 <span className="font-normal text-ink2">{parsed.length}블록 · 등록 가능 {valid.length}개</span></h4>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-paper2 text-xs text-ink2">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">유형</th>
                    <th className="px-3 py-2">형태</th>
                    <th className="px-3 py-2">난이도</th>
                    <th className="px-3 py-2">답</th>
                    <th className="px-3 py-2">경고</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((b, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-3 py-2 text-ink2">{i + 1}</td>
                      <td className="px-3 py-2">
                        {b.typeId
                          ? <span className="font-semibold text-pine-dark">{typeName(b.typeId)}</span>
                          : <span className="font-semibold text-clay">매칭 실패</span>}
                      </td>
                      <td className="px-3 py-2">{b.kind}</td>
                      <td className="px-3 py-2">{DIFF_LABEL[b.diff]}</td>
                      <td className="max-w-40 truncate px-3 py-2"><MathText text={b.answer || '—'} /></td>
                      <td className="px-3 py-2 text-xs">
                        {b.errors.length > 0 && <span className="font-semibold text-clay">{b.errors.join(' · ')}</span>}
                        {b.errors.length === 0 && b.warns.length > 0 && <span className="text-amber">{b.warns.join(' · ')}</span>}
                        {b.errors.length === 0 && b.warns.length === 0 && <span className="text-ink2">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-line px-5 py-2.5 text-sm">취소</button>
          <button onClick={register} disabled={valid.length === 0}
            className="rounded-lg bg-pine px-6 py-2.5 text-sm font-bold text-paper hover:bg-pine-dark disabled:opacity-50">
            {valid.length}문제 등록
          </button>
        </div>
      </div>
    </div>
  )
}
