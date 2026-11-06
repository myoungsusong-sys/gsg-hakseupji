import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, uid } from '../lib/store'
import { CURRICULA } from '../data/curriculum'
import { DEFAULT_SHEET_OPTIONS, type Problem } from '../types'

// ── 영어 지문 하나로 «변형 문제 · 단어장 · 문장 드릴» (2026-11-07) ──────────────
// 교과서·모의고사·EBS·외부 지문 어느 것이든 붙여 넣으면 AI 가 만든다(api/eng-passage).
//  · 변형 문제 21유형 → 나의 DB 에 담고 학습지로 바로 저장(출제·채점·오답이 기존 흐름 그대로)
//  · 단어장 → 단어장 / 뜻 쓰기 / 단어 쓰기 / 뜻 고르기 시험지 (화면에서 만들어 인쇄)
//  · 문장 드릴 → 해석 쓰기 / 우리말 보고 영작 / 단어 배열 / 핵심 어구 빈칸 (화면에서 만들어 인쇄)

const TYPES = [
  '주제', '제목', '요지', '글의 목적', '심경 변화', '내용 일치', '빈칸 추론', '어법(틀린 것)', '어법(옳은 것)',
  '어휘 쓰임', '순서 배열', '문장 삽입', '무관한 문장', '문단 요약', '지칭 추론', '영영 풀이',
  '서술형/영작', '서술형/순서 배열', '서술형/틀린 부분 고치기', '서술형/빈칸 채우기', '서술형/요약문 완성',
]
const LEVELS = ['중1', '중2', '중3', '고1', '고2', '고3']
type Tab = '변형 문제' | '단어장' | '문장 드릴'
interface GenProblem { type: string; kind: string; body: string; choices?: string[]; answer: string; solution: string }
interface Word { word: string; pos?: string; meaning: string; example?: string }
interface Sent { en: string; ko: string; key?: string[] }

const CIRC = ['①', '②', '③', '④', '⑤']
function shuffle<T>(a: T[], seed: number): T[] {
  const r = [...a]; let s = seed || 1
  for (let i = r.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [r[i], r[j]] = [r[j], r[i]] }
  return r
}

export default function EngPassage() {
  const { addProblem, saveWorksheet } = useStore()
  const nav = useNavigate()
  const engCourses = useMemo(() => CURRICULA.filter(c => c.subject === '영어'), [])
  const [tab, setTab] = useState<Tab>('변형 문제')
  const [title, setTitle] = useState('')
  const [passage, setPassage] = useState('')
  const [level, setLevel] = useState('고1')
  const [courseId, setCourseId] = useState(engCourses[0]?.id ?? '')
  const [types, setTypes] = useState<Set<string>>(new Set(['주제', '빈칸 추론', '어법(틀린 것)', '순서 배열', '서술형/영작']))
  const [perType, setPerType] = useState(1)
  const [wordCount, setWordCount] = useState(20)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [probs, setProbs] = useState<GenProblem[]>([])
  const [words, setWords] = useState<Word[]>([])
  const [sents, setSents] = useState<Sent[]>([])
  const [sheet, setSheet] = useState('')   // 인쇄할 시험지 종류

  async function gen() {
    setErr(''); setBusy(true)
    try {
      const mode = tab === '변형 문제' ? 'exercise' : tab === '단어장' ? 'words' : 'drill'
      const r = await fetch('/api/eng-passage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, passage, types: [...types], perType, level, wordCount }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || '실패')
      if (mode === 'exercise') setProbs(j.problems ?? [])
      else if (mode === 'words') { setWords(j.words ?? []); setSheet('단어장') }
      else { setSents(j.sentences ?? []); setSheet('해석 쓰기') }
    } catch (e: any) { setErr(String(e?.message || e)) } finally { setBusy(false) }
  }

  function saveAsWorksheet() {
    const course = engCourses.find(c => c.id === courseId)
    const typeId = course?.units[0]?.mids[0]?.subs[0]?.types[0]?.id
    if (!typeId) { setErr('붙일 영어 과정을 고르세요.'); return }
    const src = `외부지문 변형 · ${title.trim() || passage.trim().slice(0, 24)}`
    const ids: string[] = []
    for (const g of probs) {
      const p: Problem = {
        id: uid('cp'), typeId, kind: g.kind === '서술형' ? '주관식' : '객관식', diff: 3,
        body: `[${g.type}] ${g.body}`, choices: g.kind === '서술형' ? undefined : g.choices,
        answer: String(g.answer), solution: g.solution, source: src, custom: true,
        selfGrade: g.kind === '서술형' ? true : undefined,
      }
      addProblem(p); ids.push(p.id)
    }
    const id = uid('ws')
    saveWorksheet({
      id, title: src, author: '', subject: '영어', grade: course?.grade ?? '고1-1', tags: ['외부지문 변형'], theme: 'pine',
      problemIds: ids, conceptIds: [], options: DEFAULT_SHEET_OPTIONS, listIds: [],
      createdAt: new Date().toISOString(), deletedAt: null,
    })
    nav(`/worksheet/${id}`)
  }

  // ── 인쇄용 시험지 (단어장·드릴) ──
  const printable = useMemo(() => {
    const seed = passage.length
    if (tab === '단어장' && words.length) {
      if (sheet === '단어장') return words.map((w, i) => <tr key={i}><td className="w-8 py-1 text-ink2">{i + 1}</td><td className="font-bold">{w.word}</td><td className="text-ink2">{w.pos}</td><td>{w.meaning}</td><td className="text-xs text-ink2">{w.example}</td></tr>)
      if (sheet === '뜻 쓰기') return words.map((w, i) => <tr key={i}><td className="w-8 py-2 text-ink2">{i + 1}</td><td className="font-bold">{w.word}</td><td className="w-1/2 border-b border-line" /></tr>)
      if (sheet === '단어 쓰기') return words.map((w, i) => <tr key={i}><td className="w-8 py-2 text-ink2">{i + 1}</td><td>{w.meaning}</td><td className="w-1/2 border-b border-line" /></tr>)
      if (sheet === '뜻 고르기') return words.map((w, i) => {
        const 보기 = shuffle([w.meaning, ...shuffle(words.filter(x => x !== w).map(x => x.meaning), seed + i).slice(0, 4)], seed * 7 + i)
        return <tr key={i}><td className="w-8 py-2 align-top text-ink2">{i + 1}</td><td className="align-top font-bold">{w.word}</td><td className="text-sm">{보기.map((m, k) => <span key={k} className="mr-3">{CIRC[k]} {m}</span>)}</td></tr>
      })
    }
    if (tab === '문장 드릴' && sents.length) {
      if (sheet === '해석 쓰기') return sents.map((s, i) => <tr key={i}><td className="w-8 py-2 align-top text-ink2">{i + 1}</td><td><div>{s.en}</div><div className="mt-5 border-b border-line" /></td></tr>)
      if (sheet === '영작') return sents.map((s, i) => <tr key={i}><td className="w-8 py-2 align-top text-ink2">{i + 1}</td><td><div>{s.ko}</div><div className="mt-5 border-b border-line" /></td></tr>)
      if (sheet === '단어 배열') return sents.map((s, i) => {
        const tok = s.en.replace(/[.!?]$/, '').split(/\s+/)
        return <tr key={i}><td className="w-8 py-2 align-top text-ink2">{i + 1}</td><td><div>{s.ko}</div><div className="mt-1 text-sm text-ink2">( {shuffle(tok, seed + i * 13).join(' / ')} )</div><div className="mt-5 border-b border-line" /></td></tr>
      })
      if (sheet === '핵심 어구 빈칸') return sents.map((s, i) => {
        let t = s.en; for (const k of s.key ?? []) t = t.replace(k, '_'.repeat(Math.max(6, k.length)))
        return <tr key={i}><td className="w-8 py-2 align-top text-ink2">{i + 1}</td><td><div>{t}</div><div className="mt-1 text-xs text-ink2">{s.ko}</div></td></tr>
      })
    }
    return null
  }, [tab, sheet, words, sents, passage.length])
  const answerKey = useMemo(() => {
    if (tab === '문장 드릴' && sheet === '핵심 어구 빈칸') return sents.map((s, i) => `${i + 1}. ${(s.key ?? []).join(' / ')}`).join('   ')
    if (tab === '문장 드릴' && (sheet === '영작' || sheet === '단어 배열')) return sents.map((s, i) => `${i + 1}. ${s.en}`).join('\n')
    if (tab === '단어장' && sheet === '뜻 고르기') {
      const seed = passage.length
      return words.map((w, i) => {
        const 보기 = shuffle([w.meaning, ...shuffle(words.filter(x => x !== w).map(x => x.meaning), seed + i).slice(0, 4)], seed * 7 + i)
        return `${i + 1}.${CIRC[보기.indexOf(w.meaning)]}`
      }).join('  ')
    }
    return ''
  }, [tab, sheet, sents, words, passage.length])

  const sheetKinds = tab === '단어장' ? ['단어장', '뜻 쓰기', '단어 쓰기', '뜻 고르기'] : ['해석 쓰기', '영작', '단어 배열', '핵심 어구 빈칸']

  return (
    <div>
      <div className="no-print">
        <div className="mb-4 flex flex-wrap items-baseline gap-3">
          <h2 className="text-lg font-black">영어 지문 학습지 만들기</h2>
          <span className="text-xs text-ink2">교과서·모의고사·EBS·외부 지문을 붙여 넣으면 AI 가 변형 문제·단어장·문장 드릴을 만들어요</span>
        </div>
        <div className="mb-3 flex gap-2">
          {(['변형 문제', '단어장', '문장 드릴'] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setErr('') }}
              className={`rounded-lg border px-4 py-2 text-sm font-bold ${tab === t ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2'}`}>{t}</button>
          ))}
        </div>
        <div className="grid gap-3 rounded-2xl border border-line bg-white p-4">
          <div className="flex flex-wrap gap-2">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="자료 이름 (예: 2026 10월 고1 모의고사 31번)"
              className="min-w-64 grow rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-pine" />
            <select value={level} onChange={e => setLevel(e.target.value)} className="rounded-lg border border-line px-2 py-2 text-sm">
              {LEVELS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <textarea value={passage} onChange={e => setPassage(e.target.value)} rows={9}
            placeholder="영어 지문을 붙여 넣으세요 (여섯 문장 이상)"
            className="rounded-lg border border-line px-3 py-2 font-mono text-sm leading-relaxed outline-none focus:border-pine" />
          {tab === '변형 문제' && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {TYPES.map(t => (
                  <button key={t} onClick={() => setTypes(p => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n })}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${types.has(t) ? 'border-pine bg-pine text-paper' : 'border-line text-ink2'}`}>{t}</button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">유형마다
                  <select value={perType} onChange={e => setPerType(Number(e.target.value))} className="rounded-lg border border-line px-2 py-1">
                    {[1, 2, 3].map(n => <option key={n} value={n}>{n}문항</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2">붙일 과정
                  <select value={courseId} onChange={e => setCourseId(e.target.value)} className="max-w-72 rounded-lg border border-line px-2 py-1">
                    {engCourses.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
                <span className="text-xs text-ink2">모두 {types.size * perType}문항</span>
              </div>
            </>
          )}
          {tab === '단어장' && (
            <label className="flex items-center gap-2 text-sm">뽑을 단어
              <select value={wordCount} onChange={e => setWordCount(Number(e.target.value))} className="rounded-lg border border-line px-2 py-1">
                {[10, 15, 20, 25, 30, 40].map(n => <option key={n} value={n}>{n}개</option>)}
              </select>
            </label>
          )}
          <div className="flex items-center gap-2">
            <button onClick={gen} disabled={busy || passage.trim().length < 80}
              className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper disabled:opacity-40">
              {busy ? 'AI 가 지문을 읽는 중… (30초~2분)' : `AI 로 ${tab} 만들기`}
            </button>
            {err && <span className="text-sm text-clay">{err}</span>}
          </div>
        </div>
      </div>

      {tab === '변형 문제' && probs.length > 0 && (
        <div className="mt-5">
          <div className="no-print mb-3 flex flex-wrap items-center gap-2">
            <b>{probs.length}문항</b><span className="text-xs text-ink2">— 살펴보고 학습지로 저장하면 출제·채점·오답 관리가 그대로 됩니다</span>
            <div className="grow" />
            <button onClick={() => window.print()} className="rounded-lg border border-line px-4 py-2 text-sm">🖨 인쇄</button>
            <button onClick={saveAsWorksheet} className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper">학습지로 저장</button>
          </div>
          <div className="print-root grid gap-4 rounded-2xl border border-line bg-white p-6">
            {probs.map((g, i) => (
              <div key={i} className="break-inside-avoid">
                <div className="mb-1 text-xs font-bold text-pine-dark">{i + 1}. [{g.type}]</div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{g.body}</div>
                {g.choices && g.kind !== '서술형' && (
                  <div className="mt-2 grid gap-0.5 text-sm">{g.choices.map((c, k) => <div key={k}>{CIRC[k]} {c}</div>)}</div>
                )}
                {g.kind === '서술형' && <div className="mt-4 h-16 rounded border border-dashed border-line" />}
                <details className="no-print mt-2 text-xs text-ink2"><summary className="cursor-pointer">정답·해설</summary>
                  <div className="mt-1">정답: {g.kind === '서술형' ? g.answer : CIRC[Number(g.answer) - 1] ?? g.answer}</div>
                  <div className="whitespace-pre-wrap">{g.solution}</div>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab !== '변형 문제' && printable && (
        <div className="mt-5">
          <div className="no-print mb-3 flex flex-wrap items-center gap-2">
            {sheetKinds.map(k => (
              <button key={k} onClick={() => setSheet(k)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${sheet === k ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2'}`}>{k}</button>
            ))}
            <div className="grow" />
            <button onClick={() => window.print()} className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper">🖨 인쇄 / PDF</button>
          </div>
          <div className="print-root rounded-2xl border border-line bg-white p-6">
            <div className="mb-3 flex items-baseline gap-2"><b>{title.trim() || '영어 지문'}</b><span className="text-sm text-ink2">· {sheet}</span><div className="grow" /><span className="text-sm">이름 ________</span></div>
            <table className="w-full text-sm"><tbody>{printable}</tbody></table>
            {answerKey && <div className="sheet-page mt-6 whitespace-pre-wrap border-t border-line pt-3 text-xs text-ink2"><b>정답</b>{'\n'}{answerKey}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
