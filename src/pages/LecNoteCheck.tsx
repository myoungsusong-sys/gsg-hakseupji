/**
 * 🎧 인강노트 확인 — GPT 강의노트 → 빈칸테스트 · 스캔한 문제풀이노트 → 학습지 (2026-09-05 명수쌤)
 *
 *   "인강의 강의노트와 문제풀이노트는 내가 지피티로 만들어줄거야. 그거 확인 빈칸테스트와 문제는
 *    우리 학습지앱에 동일하게 적용시켜서 만들어줘. 문제는 내가 스캔할거야."
 *
 * 화면은 두 탭뿐이다. 둘 다 끝은 같다 — 학습지가 만들어지고 학생에게 배정되어 학생앱 [학습지] 탭에 뜬다.
 *   ① 빈칸테스트 — 노트 글을 붙여 넣고 [[정답]] 자리가 빈칸이 된다. 한 줄 = 한 문항. 자동채점.
 *   ② 스캔 문제 — 스캔 이미지를 올리고 문제마다 드래그로 자른다. 답(①~⑤ 또는 글)을 적으면 문항이 된다.
 * 만드는 것은 전부 기존 그릇(hj_problems · hj_worksheets · assignments)이라 오늘 교실·관리앱 채점판에 그대로 뜬다.
 * 순수 로직은 lib/lecnote.ts — 노드에서 검증한다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore, uid } from '../lib/store'
import { CURRICULA, curriculumFor, defaultCurriculumForGrade, subjectOfCourse } from '../data/curriculum'
import { DEFAULT_SHEET_OPTIONS, type Assignment, type Problem, type Worksheet } from '../types'
import { fileToScaledJpeg } from '../lib/scanAnswers'
import { cropToJpeg, dataUrlBytes, draftsFromNote, normChoiceAnswer, type CropRect } from '../lib/lecnote'
import MathText from '../components/MathText'

type Tab = 'blank' | 'scan'

const NOTE_SAMPLE = [
  '# 미적분Ⅰ 12강 함수의 극한',
  '함수 f(x)에서 x가 a에 한없이 가까워질 때 f(x)가 일정한 값 L에 가까워지면, L을 x=a에서의 [[극한값]]이라 한다.',
  '좌극한과 우극한이 [[같을]] 때만 극한값이 존재한다.',
  '$\\lim_{x\\to a} f(x)=L$ 이고 $\\lim_{x\\to a} g(x)=M$ 이면 $\\lim_{x\\to a} f(x)g(x)$ = [[LM]] 이다.',
  '∞×0 꼴은 [[유리화|통분]] 또는 인수분해로 바꾼 뒤 계산한다.',
].join('\n')

export default function LecNoteCheck() {
  const { students, worksheets, assignments, addProblem, saveWorksheet, addAssignment } = useStore()
  const [tab, setTab] = useState<Tab>('blank')

  // ── 공통: 학생 · 과정 · 유형 · 강좌 ─────────────────────────────────────
  const active = useMemo(() => {
    const a = students.filter(s => s.active)
    // 관리앱(프리미엄) 학생을 위로, 그 안에서 고학년 먼저
    return [...a].sort((x, y) => Number(!!y.mgmtId) - Number(!!x.mgmtId) || String(y.grade).localeCompare(String(x.grade)))
  }, [students])
  const [studentId, setStudentId] = useState('')
  useEffect(() => { if (!studentId && active[0]) setStudentId(active[0].id) }, [active, studentId])
  const student = active.find(s => s.id === studentId)

  const [courseId, setCourseId] = useState('')
  useEffect(() => {
    if (!student) return
    setCourseId(c => c || defaultCurriculumForGrade(student.grade))
  }, [student])
  const cur = courseId ? curriculumFor(courseId) : null
  const typeGroups = useMemo(() => {
    if (!cur) return []
    return cur.units.flatMap(u => u.mids.flatMap(m => m.subs.map(s => ({
      label: `${u.name} › ${s.name}`, types: s.types,
    })))).filter(g => g.types.length > 0)
  }, [cur])
  const [typeId, setTypeId] = useState('')
  useEffect(() => { setTypeId(typeGroups[0]?.types[0]?.id ?? '') }, [typeGroups])

  const [lecture, setLecture] = useState('')       // 예: 현우진 시발점 미적분Ⅰ 12강
  const [kind, setKind] = useState<Assignment['kind']>('숙제')
  const [made, setMade] = useState<{ wsId: string; title: string; n: number } | null>(null)

  const subject = subjectOfCourse(courseId) ?? '수학'

  function makeWorksheet(title: string, problemIds: string[], tag: string): string {
    if (!student) throw new Error('학생을 고르세요')
    const id = uid('ws')
    const w: Worksheet = {
      id, title, author: '대치스파르타', grade: String(student.grade), subject,
      tags: ['인강노트', tag, ...(lecture.trim() ? [lecture.trim()] : [])],
      theme: 'pine', problemIds, conceptIds: [],
      options: { ...DEFAULT_SHEET_OPTIONS, showTypeName: false, showDiff: false, showNew: false, autoGrade: true },
      listIds: [], createdAt: new Date().toISOString(), deletedAt: null,
    }
    saveWorksheet(w)
    addAssignment(id, [student.id], kind)
    return id
  }

  // 이 화면에서 만든 학습지 목록 (태그로 식별)
  const mine = useMemo(() => worksheets
    .filter(w => !w.deletedAt && w.tags.includes('인강노트'))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12)
    .map(w => ({
      w,
      who: assignments.filter(a => a.worksheetId === w.id).map(a => students.find(s => s.id === a.studentId)?.name ?? '?'),
    })), [worksheets, assignments, students])

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-1 text-xl font-black">🎧 인강노트 확인</h1>
      <p className="mb-5 text-sm text-ink2">
        GPT로 만든 <b className="text-ink">강의노트</b>는 빈칸테스트로, 스캔한 <b className="text-ink">문제풀이노트</b>는 문제 학습지로 만들어
        학생에게 바로 배정합니다. 학생앱 [학습지] 탭에 뜨고, 풀면 자동채점되어 <Link to="/today" className="font-bold text-pine underline">오늘 교실</Link>과
        관리앱 채점판에 그대로 나옵니다.
      </p>

      {/* 공통 선택 */}
      <div className="mb-4 grid gap-3 rounded-2xl border border-line bg-white p-4 text-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs font-bold text-ink2">학생</span>
            <select value={studentId} onChange={e => setStudentId(e.target.value)} className="rounded-lg border border-line px-2 py-1.5 font-bold">
              {active.map(s => <option key={s.id} value={s.id}>{s.name} ({s.grade}{s.mgmtId ? ' · 관리앱' : ''})</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-bold text-ink2">강좌 · 강 (학습지 이름에 들어갑니다)</span>
            <input value={lecture} onChange={e => setLecture(e.target.value)} placeholder="예: 시발점 미적분Ⅰ 12강 함수의 극한"
              className="rounded-lg border border-line px-2 py-1.5" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-bold text-ink2">과정</span>
            <select value={courseId} onChange={e => setCourseId(e.target.value)} className="rounded-lg border border-line px-2 py-1.5">
              {CURRICULA.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-bold text-ink2">유형 (오답 통계·유형 마스터가 이 유형으로 이어집니다)</span>
            <select value={typeId} onChange={e => setTypeId(e.target.value)} className="rounded-lg border border-line px-2 py-1.5">
              {typeGroups.map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-ink2">배정 종류</span>
          {(['숙제', '수업', '시험'] as const).map(k => (
            <button key={k} onClick={() => setKind(k)}
              className={`rounded-full border px-3 py-1 font-bold ${kind === k ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line bg-white text-ink2'}`}>{k}</button>
          ))}
          <span className="text-ink2">· 숙제로 내면 학생앱에 「숙제」 표시가 붙습니다</span>
        </div>
      </div>

      {/* 탭 */}
      <div className="mb-3 flex gap-1 border-b border-line text-sm">
        {([['blank', '① 빈칸테스트 (강의노트)'], ['scan', '② 스캔 문제 (문제풀이노트)']] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setMade(null) }}
            className={`-mb-px rounded-t-lg border px-4 py-2 font-bold ${tab === k ? 'border-line border-b-white bg-white text-pine-dark' : 'border-transparent text-ink2'}`}>{l}</button>
        ))}
      </div>

      {tab === 'blank'
        ? <BlankTab typeId={typeId} lecture={lecture} disabled={!student || !typeId} onMake={(title, ids) => { const wsId = makeWorksheet(title, ids, '빈칸테스트'); setMade({ wsId, title, n: ids.length }) }} addProblem={addProblem} />
        : <ScanTab typeId={typeId} lecture={lecture} disabled={!student || !typeId} onMake={(title, ids) => { const wsId = makeWorksheet(title, ids, '스캔문제'); setMade({ wsId, title, n: ids.length }) }} addProblem={addProblem} />}

      {made && (
        <div className="mt-4 rounded-2xl border border-pine bg-pine-soft p-4 text-sm">
          <b className="text-pine-dark">✅ 「{made.title}」 {made.n}문항을 만들어 {student?.name} 학생에게 {kind}로 배정했습니다.</b>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <Link to={`/worksheet/${made.wsId}`} className="font-bold text-pine underline">학습지 보기·인쇄</Link>
            <Link to="/today" className="font-bold text-pine underline">오늘 교실에서 채점 보기</Link>
            <span className="text-ink2">학생은 학생앱 [학습지] 탭에서 풉니다. 같은 노트를 또 만들면 학습지가 하나 더 생깁니다.</span>
          </div>
        </div>
      )}

      {mine.length > 0 && (
        <div className="mt-6 rounded-2xl border border-line bg-white p-4 text-sm">
          <h2 className="mb-2 font-black">최근 만든 인강노트 학습지</h2>
          <table className="w-full text-xs">
            <thead><tr className="text-left text-ink2"><th className="py-1">날짜</th><th>제목</th><th>문항</th><th>배정</th><th /></tr></thead>
            <tbody>
              {mine.map(({ w, who }) => (
                <tr key={w.id} className="border-t border-line">
                  <td className="py-1.5 text-ink2">{w.createdAt.slice(0, 10)}</td>
                  <td className="font-semibold">{w.title}</td>
                  <td>{w.problemIds.length}</td>
                  <td className="text-ink2">{who.join(', ') || '—'}</td>
                  <td className="text-right"><Link to={`/worksheet/${w.id}`} className="font-bold text-pine underline">열기</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── ① 빈칸테스트 ──────────────────────────────────────────────────────────
function BlankTab({ typeId, lecture, disabled, onMake, addProblem }: {
  typeId: string; lecture: string; disabled: boolean
  onMake: (title: string, problemIds: string[]) => void
  addProblem: (p: Problem) => void
}) {
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const drafts = useMemo(() => draftsFromNote(text), [text])
  const autoTitle = `${lecture.trim() || '강의노트'} 확인 빈칸테스트`

  function make() {
    if (!drafts.length) return
    const ids: string[] = []
    const src = `인강노트 · ${lecture.trim() || '강의노트'}`
    for (const d of drafts) {
      const id = uid('ln')
      addProblem({ id, typeId, kind: '주관식', diff: 2, body: d.body, answer: d.answer, solution: d.solution, source: src, custom: true })
      ids.push(id)
    }
    onMake((title.trim() || autoTitle), ids)
    setText(''); setTitle('')
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="grid gap-2">
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-bold text-ink2">학습지 제목 (비우면 「{autoTitle}」)</span>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={autoTitle} className="rounded-lg border border-line px-2 py-1.5" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-bold text-ink2">노트 글 — 빈칸으로 낼 말을 <code className="rounded bg-paper2 px-1">[[ ]]</code> 로 감쌉니다. 한 줄이 한 문항</span>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={16} placeholder={NOTE_SAMPLE}
            className="rounded-lg border border-line px-3 py-2 font-mono text-[13px] leading-relaxed" />
        </label>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink2">
          <button onClick={() => setText(NOTE_SAMPLE)} className="rounded-lg border border-line px-2 py-1 font-bold hover:bg-paper2">예시 넣어 보기</button>
          <span>· 빈칸이 없는 줄과 <code>#</code> 제목 줄은 문항이 되지 않습니다 · <code>[[유리화|통분]]</code> 처럼 <code>|</code> 로 두 답을 다 인정</span>
        </div>
        <details className="rounded-xl border border-line bg-paper2/50 p-3 text-xs text-ink2">
          <summary className="cursor-pointer font-bold text-ink">GPT에게 이렇게 시키면 바로 붙여 넣을 수 있습니다</summary>
          <pre className="mt-2 whitespace-pre-wrap font-sans leading-relaxed">{`방금 만든 강의노트에서 확인 빈칸테스트를 만들어줘.
- 한 줄에 한 문장씩, 시험에 나오는 핵심 개념·공식·조건만 10~15문장.
- 각 문장에서 학생이 반드시 알아야 할 낱말이나 식 1~2개를 [[ ]] 로 감싸줘. 예: 좌극한과 우극한이 [[같을]] 때만 극한값이 존재한다.
- 수식은 $...$ 로 감싸고, 답이 둘 다 되면 [[유리화|통분]] 처럼 | 로 나눠줘.
- 번호·머리말·설명 없이 문장만 출력해줘.`}</pre>
        </details>
      </div>
      <div className="grid content-start gap-2">
        <div className="flex items-center justify-between text-sm">
          <b>미리보기 <span className="font-normal text-ink2">{drafts.length}문항</span></b>
          <button disabled={disabled || !drafts.length} onClick={make}
            className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper disabled:opacity-40">학습지 만들고 배정</button>
        </div>
        {drafts.length === 0
          ? <p className="rounded-xl border border-dashed border-line p-6 text-center text-xs text-ink2">왼쪽에 노트 글을 붙여 넣으면 문항이 여기 보입니다.</p>
          : (
            <ol className="grid gap-2">
              {drafts.map((d, i) => (
                <li key={i} className="rounded-xl border border-line bg-white p-3 text-sm">
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-ink2">
                    <b className="text-ink">{i + 1}</b>
                    <span>{d.parts > 1 ? `칸 ${d.parts}개` : '칸 1개'}</span>
                    {d.warn && <span className="rounded bg-amber-soft px-1 text-amber">{d.warn}</span>}
                  </div>
                  <MathText text={d.body} />
                  <div className="mt-1 text-xs text-pine-dark">정답: <MathText text={d.answer} /></div>
                </li>
              ))}
            </ol>
          )}
      </div>
    </div>
  )
}

// ── ② 스캔 문제 ───────────────────────────────────────────────────────────
interface PageImg { name: string; url: string; w: number; h: number }
interface Item { id: string; img: string; bytes: number; kind: '객관식' | '주관식'; answer: string; page: string }

function ScanTab({ typeId, lecture, disabled, onMake, addProblem }: {
  typeId: string; lecture: string; disabled: boolean
  onMake: (title: string, problemIds: string[]) => void
  addProblem: (p: Problem) => void
}) {
  const [pages, setPages] = useState<PageImg[]>([])
  const [pi, setPi] = useState(0)
  const [items, setItems] = useState<Item[]>([])
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState('')
  const imgRef = useRef<HTMLImageElement>(null)
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const autoTitle = `${lecture.trim() || '문제풀이노트'} 문제`
  const page = pages[pi]

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy('이미지 읽는 중…')
    const next: PageImg[] = []
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue
      const { dataUrl } = await fileToScaledJpeg(f, 2200)
      const dim = await new Promise<{ w: number; h: number }>(res => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.src = dataUrl })
      next.push({ name: f.name, url: dataUrl, ...dim })
    }
    setPages(p => [...p, ...next]); setPi(pages.length); setBusy('')
  }

  // 화면 좌표 → 원본 픽셀
  function toNatural(e: React.MouseEvent): { x: number; y: number } {
    const el = imgRef.current!
    const r = el.getBoundingClientRect()
    const sx = el.naturalWidth / r.width, sy = el.naturalHeight / r.height
    return { x: Math.min(el.naturalWidth, Math.max(0, (e.clientX - r.left) * sx)), y: Math.min(el.naturalHeight, Math.max(0, (e.clientY - r.top) * sy)) }
  }
  function addCrop(r: CropRect) {
    const el = imgRef.current
    if (!el || !page) return
    const img = cropToJpeg(el, r)
    if (!img) return
    setItems(list => [...list, { id: uid('sc'), img, bytes: dataUrlBytes(img), kind: '객관식', answer: '', page: page.name }])
  }
  function onUp(e: React.MouseEvent) {
    if (!drag) return
    const p = toNatural(e)
    const r = { x: Math.min(drag.x0, p.x), y: Math.min(drag.y0, p.y), w: Math.abs(p.x - drag.x0), h: Math.abs(p.y - drag.y0) }
    setDrag(null)
    if (r.w > 40 && r.h > 25) addCrop(r)
  }
  const dragBox = (() => {
    if (!drag || !imgRef.current) return null
    const el = imgRef.current; const r = el.getBoundingClientRect()
    const kx = r.width / el.naturalWidth, ky = r.height / el.naturalHeight
    return { left: Math.min(drag.x0, drag.x1) * kx, top: Math.min(drag.y0, drag.y1) * ky, width: Math.abs(drag.x1 - drag.x0) * kx, height: Math.abs(drag.y1 - drag.y0) * ky }
  })()

  const ready = items.filter(it => it.answer.trim())
  const totalKb = Math.round(items.reduce((a, it) => a + it.bytes, 0) / 1024)

  function make() {
    if (!ready.length) return
    const ids: string[] = []
    const src = `인강노트 · ${lecture.trim() || '문제풀이노트'}`
    const t = title.trim() || autoTitle
    ready.forEach((it, i) => {
      const id = uid('sc')
      const answer = it.kind === '객관식' ? normChoiceAnswer(it.answer) : it.answer.trim()
      addProblem({ id, typeId, kind: it.kind, diff: 3, body: `${t} ${i + 1}번`, answer, solution: '(문제풀이노트 참고)', source: src, imageUrl: it.img, custom: true })
      ids.push(id)
    })
    onMake(t, ids)
    setItems([]); setTitle('')
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-bold text-ink2">학습지 제목 (비우면 「{autoTitle}」)</span>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={autoTitle} className="rounded-lg border border-line px-2 py-1.5" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-bold text-ink2">스캔 이미지 (JPG·PNG, 여러 장 가능 — PDF는 이미지로 저장해서)</span>
          <input type="file" accept="image/*" multiple onChange={e => onFiles(e.target.files)} className="text-xs" />
        </label>
      </div>
      {busy && <p className="text-xs text-ink2">{busy}</p>}

      <div className="grid gap-3 md:grid-cols-[3fr_2fr]">
        {/* 왼쪽: 쪽 이미지 + 드래그 */}
        <div className="rounded-2xl border border-line bg-white p-3">
          {!page ? (
            <p className="rounded-xl border border-dashed border-line p-10 text-center text-xs text-ink2">
              스캔한 쪽 이미지를 올린 뒤, <b className="text-ink">문제 하나를 마우스로 드래그해 감싸면</b> 오른쪽에 문항으로 잘려 들어갑니다.
            </p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                {pages.map((_p, i) => (
                  <button key={i} onClick={() => setPi(i)}
                    className={`rounded-full border px-2 py-0.5 font-bold ${i === pi ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2'}`}>{i + 1}쪽</button>
                ))}
                <span className="grow" />
                <button onClick={() => addCrop({ x: 0, y: 0, w: page.w, h: page.h })}
                  className="rounded-lg border border-line px-2 py-1 font-bold text-ink2 hover:bg-paper2">이 쪽 전체를 한 문제로</button>
              </div>
              <div className="relative select-none overflow-hidden rounded-lg border border-line" style={{ cursor: 'crosshair' }}
                onMouseDown={e => { const p = toNatural(e); setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }) }}
                onMouseMove={e => { if (drag) { const p = toNatural(e); setDrag({ ...drag, x1: p.x, y1: p.y }) } }}
                onMouseUp={onUp} onMouseLeave={() => setDrag(null)}>
                <img ref={imgRef} src={page.url} alt={page.name} className="block w-full" draggable={false} />
                {dragBox && <div className="pointer-events-none absolute border-2 border-pine bg-pine/10" style={dragBox} />}
              </div>
              <p className="mt-1 text-[11px] text-ink2">문제 번호부터 보기 끝까지 넉넉히 감싸세요. 잘못 잘랐으면 오른쪽에서 ✕ 하고 다시 드래그.</p>
            </>
          )}
        </div>

        {/* 오른쪽: 잘린 문항 + 답 */}
        <div className="grid content-start gap-2">
          <div className="flex items-center justify-between text-sm">
            <b>문항 <span className="font-normal text-ink2">{items.length}개 · 답 입력 {ready.length}개 · {totalKb}KB</span></b>
            <button disabled={disabled || !ready.length} onClick={make}
              className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper disabled:opacity-40">학습지 만들고 배정</button>
          </div>
          {items.length === 0 && <p className="rounded-xl border border-dashed border-line p-6 text-center text-xs text-ink2">잘린 문항이 여기 쌓입니다. 답을 넣은 문항만 학습지에 들어갑니다.</p>}
          {items.map((it, i) => (
            <div key={it.id} className="grid gap-2 rounded-xl border border-line bg-white p-2 text-xs">
              <div className="flex items-center gap-2">
                <b>{i + 1}번</b>
                <span className="text-ink2">{it.page} · {Math.round(it.bytes / 1024)}KB</span>
                <span className="grow" />
                {(['객관식', '주관식'] as const).map(k => (
                  <button key={k} onClick={() => setItems(l => l.map(x => x.id === it.id ? { ...x, kind: k, answer: '' } : x))}
                    className={`rounded-full border px-2 py-0.5 font-bold ${it.kind === k ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2'}`}>{k}</button>
                ))}
                <button onClick={() => setItems(l => l.filter(x => x.id !== it.id))} className="rounded px-1 text-ink2 hover:bg-paper2">✕</button>
              </div>
              <img src={it.img} alt={`${i + 1}번`} className="max-h-48 w-auto max-w-full rounded border border-line bg-white" />
              {it.kind === '객관식' ? (
                <div className="flex gap-1.5">
                  {['①', '②', '③', '④', '⑤'].map((c, n) => (
                    <button key={c} onClick={() => setItems(l => l.map(x => x.id === it.id ? { ...x, answer: c } : x))}
                      className={`h-8 w-8 rounded-full border text-sm font-bold ${it.answer === c ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink'}`}>{n + 1}</button>
                  ))}
                </div>
              ) : (
                <input value={it.answer} onChange={e => setItems(l => l.map(x => x.id === it.id ? { ...x, answer: e.target.value } : x))}
                  placeholder="정답 (수식은 $...$ , 예: $x=6$ · 답 두 개면 3, 5)" className="rounded-lg border border-line px-2 py-1.5" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
