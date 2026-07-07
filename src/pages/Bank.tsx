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
