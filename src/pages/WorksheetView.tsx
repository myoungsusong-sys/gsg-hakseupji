import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { typeName, typeUnitName } from '../data/curriculum'
import { CONCEPTS } from '../data/concepts'
import MathText, { isImageUrl } from '../components/MathText'
import VideoModal from '../components/VideoModal'
import type { Problem } from '../types'
import { DEFAULT_SHEET_OPTIONS, DIFF_LABEL, THEMES, spacingMmOf } from '../types'

/* ═══════════════════════════════════════════════════════════════════
   매쓰플랫 원본 PDF 실측 지오메트리 (오답루프실사_매쓰플랫_2026-07-08.md §5~7)
   — 전부 mm. pt 원본 값은 주석에 병기 (1pt = 0.3528mm).
   페이지 구성: 문제지 → 빠른정답(별지) → 해설지(별지), 페이지 번호는 부 전체 연속.
   JS 페이지네이션: 숨김 측정 컨테이너에서 블록 높이 실측 → A4 실물 페이지에 분배.
   ═══════════════════════════════════════════════════════════════════ */
const G = {
  pageW: 210, pageH: 297,          // A4 (595×842pt)
  mx: 14.1,                        // 좌우 여백 40pt
  body1Top: 60,                    // 1p 헤더 구분선 y=170pt
  bodyNTop: 17.6,                  // 연속 페이지 축약 헤더 구분선 y=50pt
  bodyBottom: 282.6,               // 푸터 구분선 y=801pt
  colW: 84.8,                      // 단 폭 240.5pt
  colGap: 11.3,                    // 단 간 32pt
  solW: 85.5,                      // 풀이칸·빠른정답 표 폭 242.5pt
  indent: 11.6,                    // 문항 본문 hanging indent 33pt
  probImgW: 73.2,                  // 문제 이미지 폭 207.5pt (원본 930px 기준)
  solImgW: 64.4,                   // 해설 이미지 폭 182.5pt
  qaColW: 28.5,                    // 빠른정답 3열 등분 열폭 80.8pt
  qaRowH: 8.6,                     // 빠른정답 행높이 24.5pt (최소)
  qaLabelH: 19.2,                  // 「빠른정답」 라벨 영역 (표 시작 y=224.5pt − 헤더 170pt)
  soGap: 8.6,                      // 해설 블록 간 24.4pt
  minSolveH: 40,                   // 풀이칸 행 최소 높이
  // OMR 별지 (§7-bis) — 표 2단, 페이지 절대좌표(mm)
  omrColXL: 12.9,                  // 좌단 표 시작 x 36.5pt
  omrColXR: 109,                   // 우단 표 시작 x 309pt
  omrColW: 88,                     // 단 폭 249.5pt
  omrNoW: 14.1,                    // 번호칸 40pt
  omrRowH: 13.6,                   // 행 높이 38.5pt
  omrRows1: 15,                    // 1페이지 좌단 15행 → 우단 이어짐
}
const CONTENT_W = G.pageW - G.mx * 2               // 181.8
const BODY1_H = G.bodyBottom - G.body1Top          // 222.6
const BODYN_H = G.bodyBottom - G.bodyNTop          // 265.0
const PXMM = 96 / 25.4                             // CSS px per mm

type Dims = Map<string, { w: number; h: number }>

// 매쓰플랫 문제·해설 이미지(원본 930px)의 실물 스케일: baseW mm ↔ 930px, 작은 이미지는 비례 축소
function scaledImgStyle(dims: Dims | undefined, url: string, baseWmm: number): CSSProperties {
  const d = dims?.get(url)
  if (!d || !d.w) return { width: '100%', maxWidth: `${baseWmm}mm`, height: 'auto' }
  const w = Math.min(baseWmm, d.w * baseWmm / 930)
  return { width: `${w}mm`, height: `${w * d.h / d.w}mm` }
}
// 답 이미지: 자연 크기(96dpi 환산) — 셀/칸 폭 내 max-width, height auto (max-h 캡 없음)
function naturalImgStyle(dims: Dims | undefined, url: string, capMm: number): CSSProperties {
  const d = dims?.get(url)
  if (!d || !d.w) return { maxWidth: `${capMm}mm`, height: 'auto' }
  const w = Math.min(capMm, d.w / PXMM)
  return { width: `${w}mm`, height: `${w * d.h / d.w}mm` }
}

function AnswerContent({ text, dims, capMm, style }: { text: string; dims?: Dims; capMm: number; style?: CSSProperties }) {
  if (isImageUrl(text)) return <img src={text} alt="" style={naturalImgStyle(dims, text, capMm)} />
  return <span style={style}><MathText text={text} /></span>
}

/* ── 페이지 정의 ── */
type PageDef =
  | { part: 's'; first: boolean; kind: 'cols'; cols: [number[], number[]]; conceptsFirst: boolean }
  | { part: 's'; first: boolean; kind: 'rows'; rows: number[]; conceptsFirst: boolean }
  | { part: 's'; first: boolean; kind: 'split'; slots: number[]; conceptsFirst: boolean }
  | { part: 'q'; first: boolean; kind: 'qa'; left: number[]; right: number[] }
  | { part: 'so'; first: boolean; kind: 'socols'; cols: [number[], number[]] }
  | { part: 'o'; first: boolean; kind: 'omr'; left: number[]; right: number[] }

/* 인쇄 작업 단위 — 렌더할 부(문제지 s / 빠른정답 q / 정답해설 so / OMR o)와 파일명 라벨 */
type PrintJob = { label: string; s: boolean; q: boolean; so: boolean; o: boolean }
const PART_FLAG: Record<string, keyof Omit<PrintJob, 'label'>> = {
  '문제지': 's', '빠른정답': 'q', '정답해설': 'so', 'OMR': 'o',
}
const jobOf = (label: string, sel: string[]): PrintJob => ({
  label, s: sel.includes('문제지'), q: sel.includes('빠른정답'), so: sel.includes('정답해설'), o: sel.includes('OMR'),
})

// 블록을 페이지×열에 순서대로 분배. 열에 안 들어가면 다음 열/페이지로. (단독 초과 블록은 그냥 배치)
function fillColumns(heights: number[], gap: number, ncols: number, availFor: (page: number, col: number) => number): number[][][] {
  const out: number[][][] = []
  let i = 0
  while (i < heights.length) {
    const page = out.length
    const cols: number[][] = Array.from({ length: ncols }, () => [])
    for (let c = 0; c < ncols && i < heights.length; c++) {
      const avail = availFor(page, c)
      let used = 0
      while (i < heights.length) {
        const h = heights[i]
        if (cols[c].length > 0 && used + gap + h > avail) break
        used = cols[c].length === 0 ? h : used + gap + h
        cols[c].push(i); i++
        if (used > avail) break
      }
    }
    out.push(cols)
  }
  return out
}

export default function WorksheetView() {
  const { id } = useParams()
  const nav = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { worksheets, problems } = useStore()
  // 인쇄 작업(job): 지정 부분만 렌더 → 매쓰플랫처럼 문제지/빠른정답/정답해설/OMR 따로 PDF 저장.
  const [job, setJob] = useState<PrintJob | null>(null)
  // 개별 PDF(each) 모드: 남은 부들의 순차 인쇄 큐 — 이전 print() 리턴 후 다음 실행
  const jobQueueRef = useRef<PrintJob[]>([])
  const [video, setVideo] = useState<{ src: string; subtitle?: string; title: string } | null>(null)
  // 다이얼로그에서 넘어온 학생 이름 표시 옵션 (?name=)
  const studentName = searchParams.get('name')

  const ws = worksheets.find(w => w.id === id)
  const items = useMemo(
    () => (ws?.problemIds ?? []).map(pid => problems.find(p => p.id === pid)).filter(p => p != null),
    [ws, problems],
  )
  const theme = ws ? THEMES[ws.theme] : THEMES.pine
  const opts = ws?.options ?? DEFAULT_SHEET_OPTIONS

  /* ── 조판 1단계: 이미지 원본 크기 로드 (로드 완료까지 "조판 중…") ── */
  const [imgDims, setImgDims] = useState<Dims | null>(null)
  const [measured, setMeasured] = useState<Record<string, number> | null>(null)
  const measRef = useRef<HTMLDivElement>(null)

  const layoutKey = ws ? `${ws.id}|${(ws.problemIds ?? []).join(',')}|${JSON.stringify(opts)}|${ws.theme}` : ''
  useEffect(() => {
    setImgDims(null); setMeasured(null)
    if (!ws) return
    let alive = true
    const urls = new Set<string>()
    for (const p of items) {
      if (p.imageUrl) urls.add(p.imageUrl)
      if (isImageUrl(p.answer)) urls.add(p.answer)
      if (isImageUrl(p.solution)) urls.add(p.solution)
    }
    Promise.all([...urls].map(u => new Promise<[string, { w: number; h: number }] | null>(res => {
      const img = new Image()
      img.onload = () => res([u, { w: img.naturalWidth, h: img.naturalHeight }])
      img.onerror = () => res(null)
      img.src = u
    }))).then(entries => {
      if (alive) setImgDims(new Map(entries.filter((e): e is [string, { w: number; h: number }] => e != null)))
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey])

  /* ── 조판 2단계: 폰트 준비 후 숨김 컨테이너에서 블록 높이 실측 ── */
  useEffect(() => {
    if (!imgDims || measured) return
    let alive = true
    document.fonts.ready.then(() => requestAnimationFrame(() => {
      if (!alive || !measRef.current) return
      const hs: Record<string, number> = {}
      measRef.current.querySelectorAll<HTMLElement>('[data-mk]').forEach(el => {
        hs[el.dataset.mk!] = el.offsetHeight / PXMM
      })
      setMeasured(hs)
    }))
    return () => { alive = false }
  }, [imgDims, measured])

  const concepts = (ws?.conceptIds ?? [])
    .map(cid => CONCEPTS.find(c => c.id === cid))
    .filter(c => c != null)

  const qaRows = useMemo(() => {
    const rows: number[][] = []
    for (let i = 0; i < items.length; i += 3) rows.push([i, i + 1, i + 2].filter(k => k < items.length))
    return rows
  }, [items])

  /* ── 조판 3단계: 페이지 분배 ── */
  const pagesAll = useMemo<PageDef[] | null>(() => {
    if (!measured || !ws || items.length === 0) return null
    const S = spacingMmOf(opts.spacing)
    const defs: PageDef[] = []
    const conceptsH = concepts.length ? (measured['concepts'] ?? 0) + 5 : 0
    const avail1 = BODY1_H - conceptsH

    // 1부. 문제지
    if (opts.layout === 'basic' && opts.wrongNoteArea) {
      // 풀이칸: 문항당 1행(전폭), 행 높이 = max(문제, 40mm)
      const rowH = items.map((_, i) => Math.max(measured[`p${i}`] ?? 0, G.minSolveH))
      fillColumns(rowH, S, 1, p => p === 0 ? avail1 : BODYN_H)
        .forEach((cols, pi) => defs.push({ part: 's', first: pi === 0, kind: 'rows', rows: cols[0], conceptsFirst: pi === 0 && concepts.length > 0 }))
    } else if (opts.layout === 'basic') {
      const hs = items.map((_, i) => measured[`p${i}`] ?? 0)
      fillColumns(hs, S, 2, p => p === 0 ? avail1 : BODYN_H)
        .forEach((cols, pi) => defs.push({ part: 's', first: pi === 0, kind: 'cols', cols: [cols[0], cols[1]], conceptsFirst: pi === 0 && concepts.length > 0 }))
    } else {
      const per = opts.layout === 'split2' ? 2 : opts.layout === 'split4' ? 4 : 6
      for (let i = 0; i < items.length; i += per) {
        const slots: number[] = []
        for (let k = i; k < Math.min(i + per, items.length); k++) slots.push(k)
        defs.push({ part: 's', first: i === 0, kind: 'split', slots, conceptsFirst: i === 0 && concepts.length > 0 })
      }
    }

    // 2부. 빠른정답 — 좌단 3열 표, 넘치면 우단으로 흐름
    const qaH = qaRows.map((_, r) => Math.max(measured[`q${r}`] ?? 0, G.qaRowH))
    fillColumns(qaH, 0, 2, (p, c) => (p === 0 ? BODY1_H : BODYN_H) - (p === 0 && c === 0 ? G.qaLabelH : 0))
      .forEach((cols, pi) => defs.push({ part: 'q', first: pi === 0, kind: 'qa', left: cols[0], right: cols[1] }))

    // 3부. 해설지 — 2단(세로 구분선 없음), 블록 간 8.6mm
    const soH = items.map((_, i) => measured[`s${i}`] ?? 0)
    fillColumns(soH, G.soGap, 2, p => p === 0 ? BODY1_H : BODYN_H)
      .forEach((cols, pi) => defs.push({ part: 'so', first: pi === 0, kind: 'socols', cols: [cols[0], cols[1]] }))

    // 4부. OMR (§7-bis) — 행 13.6mm 고정 2단 표, 좌단 15행 → 우단 이어짐, 넘치면 다음 페이지
    {
      let oi = 0, opi = 0
      while (oi < items.length) {
        const perCol = opi === 0 ? G.omrRows1 : Math.floor(BODYN_H / G.omrRowH)
        const left: number[] = [], right: number[] = []
        for (let k = 0; k < perCol && oi < items.length; k++) left.push(oi++)
        for (let k = 0; k < perCol && oi < items.length; k++) right.push(oi++)
        defs.push({ part: 'o', first: opi === 0, kind: 'omr', left, right })
        opi++
      }
    }

    return defs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measured, layoutKey, items, qaRows, concepts.length])

  // job이 걸리면: 해당 부분만 렌더된 뒤 파일명(제목_문제지 등) 세팅 → 인쇄 → 원복.
  // window.print()는 인쇄창이 닫힌 뒤 리턴 → 큐(each 모드)의 다음 부를 이어서 인쇄.
  useEffect(() => {
    if (!job || !ws) return
    const prevTitle = document.title
    document.title = `${ws.title}_${job.label}`.replace(/\s+/g, '_')
    const raf = requestAnimationFrame(() => {
      window.print()
      document.title = prevTitle
      const next = jobQueueRef.current.shift()
      if (next) { setJob(next); return }
      setJob(null)
      // 자동 인쇄(다이얼로그 경유)였다면 쿼리 제거 → 이후엔 일반 미리보기 화면
      if (new URLSearchParams(window.location.hash.split('?')[1] ?? '').has('out')) {
        setSearchParams({}, { replace: true })
      }
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, ws])

  // 다운로드/인쇄 다이얼로그 쿼리(?out=문제지,정답해설&mode=one|each&name=…) — 조판 완료 후 자동 인쇄
  const autoRan = useRef(false)
  const ready0 = pagesAll != null
  useEffect(() => {
    if (!ready0 || autoRan.current) return
    const out = searchParams.get('out')
    if (!out) return
    autoRan.current = true
    const sel = out.split(',').filter(p => p in PART_FLAG)
    if (sel.length === 0) { setSearchParams({}, { replace: true }); return }
    if (searchParams.get('mode') === 'each' && sel.length > 1) {
      const jobs = sel.map(p => jobOf(p, [p]))
      jobQueueRef.current = jobs.slice(1)
      setJob(jobs[0])
    } else {
      setJob(jobOf(sel.length === 4 ? '전체' : sel.join('_'), sel))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready0, searchParams])

  if (!ws) return <div className="text-ink2">학습지를 찾을 수 없습니다.</div>

  const printPart = (label: string, ...sel: string[]) => setJob(jobOf(label, sel))
  const show: Record<'s' | 'q' | 'so' | 'o', boolean> = {
    s: job ? job.s : true, q: job ? job.q : true, so: job ? job.so : true, o: job ? job.o : true,
  }

  const fmtDate = (d: Date) =>
    `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  const dateText = opts.showDate
    ? (opts.customDate ? opts.customDate.replaceAll('-', '.') : fmtDate(new Date(ws.createdAt)))
    : null

  // 부제: 전체 문항의 단원 범위 (첫 단원 ~ 끝 단원) — 첫 문항만 표기하던 버그 수정
  const subtitle = (() => {
    if (!items.length) return ''
    const a = typeUnitName(items[0].typeId)
    const b = typeUnitName(items[items.length - 1].typeId)
    return a === b ? a : `${a} ~ ${b}`
  })()

  const caption = (p: Problem) => {
    const parts: string[] = []
    if (opts.showTypeName) parts.push(typeName(p.typeId))
    if (opts.showDiff) parts.push(DIFF_LABEL[p.diff])
    if (opts.showCorrectRate && p.correctRate != null) parts.push(`정답률 ${p.correctRate}%`)
    if (opts.showNew && p.isNew) parts.push('신경향')
    return parts.join(' · ')
  }
  const onVideo = (pp: Problem, ii: number) =>
    setVideo({ src: pp.videoUrl!, subtitle: pp.subtitleUrl, title: `${ii + 1}번 풀이영상` })

  const conceptsEl = concepts.length > 0 ? (
    <div style={{ border: `0.5pt solid ${theme.main}`, borderRadius: '1.5mm', padding: '3.5mm' }}>
      <div style={{ fontSize: '10pt', fontWeight: 800, color: theme.main, marginBottom: '2mm' }}>■ 개념 정리</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {concepts.map(c => (
          <div key={c.id}>
            <b style={{ fontSize: '9.5pt' }}>{c.title}</b>
            {c.lines.map((l, li) => (
              <div key={li} style={{ fontSize: '9pt', lineHeight: 1.6, color: '#5c5c5c' }}>· <MathText text={l} /></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  ) : null

  const dims = imgDims ?? undefined
  const S = spacingMmOf(opts.spacing)

  /* ── 렌더 조각들 ── */
  const problemAt = (i: number) => (
    <ProblemBlock p={items[i]} idx={i} caption={caption(items[i])} themeMain={theme.main} dims={dims} onVideo={onVideo} />
  )
  const solveRowAt = (i: number, rowH: number) => (
    <div key={items[i].id} style={{ display: 'flex', justifyContent: 'space-between', minHeight: `${rowH}mm`, marginBottom: `${S}mm` }}>
      <div style={{ width: `${G.colW}mm`, flex: 'none' }}>{problemAt(i)}</div>
      {/* 풀이칸: 상단 0.5pt 검정 실선 + '풀이' 라벨 9pt #777, 내부 완전 공백 */}
      <div style={{ width: `${G.solW}mm`, flex: 'none' }}>
        <div style={{ borderTop: '0.5pt solid #000000' }} />
        <div style={{ fontSize: '9pt', fontWeight: 700, color: '#777777', paddingLeft: '3.5mm', marginTop: '3mm' }}>풀이</div>
      </div>
    </div>
  )
  const qaRowAt = (r: number, isLast: boolean) => (
    <div key={r} style={{
      display: 'grid', gridTemplateColumns: `repeat(3, ${G.qaColW}mm)`,
      borderBottom: isLast ? 'none' : '0.25pt solid #bfbfbf',
    }}>
      {[0, 1, 2].map(k => {
        const idx = qaRows[r][k]
        return (
          <div key={k} style={{
            minHeight: `${G.qaRowH}mm`, display: 'flex', alignItems: 'center', gap: '1.6mm',
            paddingLeft: '2mm', paddingRight: '1mm', paddingTop: '0.8mm', paddingBottom: '0.8mm',
            borderRight: k < 2 ? '0.5pt solid #bfbfbf' : 'none',
          }}>
            {idx != null && (
              <>
                <b style={{ fontSize: '10pt', color: theme.main, flex: 'none' }}>{String(idx + 1).padStart(2, '0')}</b>
                <span style={{ fontSize: '10pt', minWidth: 0 }}>
                  <AnswerContent text={items[idx].answer} dims={dims} capMm={18} />
                </span>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
  // 빠른정답 표 세그먼트: 최상·최하 1pt #3f3f3f, 좌우 바깥 테두리 없음(개방형)
  const qaSegment = (rows: number[]) => rows.length === 0 ? null : (
    <div style={{ width: `${G.solW}mm`, borderTop: '1pt solid #3f3f3f', borderBottom: '1pt solid #3f3f3f' }}>
      {rows.map((r, k) => qaRowAt(r, k === rows.length - 1))}
    </div>
  )
  const solutionAt = (i: number) => (
    <SolutionBlock p={items[i]} idx={i} themeMain={theme.main} dims={dims} withBody={opts.solutionWithBody} />
  )

  const header1 = (
    <PageHeader1 theme={theme.main} grade={ws.grade} title={ws.title} subtitle={subtitle}
      dateText={dateText} count={items.length} author={ws.author} studentName={studentName} />
  )
  const headerN = <PageHeaderN title={ws.title} subtitle={subtitle} />

  const renderBody = (pg: PageDef) => {
    if (pg.kind === 'rows') return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {pg.conceptsFirst && <div style={{ marginBottom: '5mm' }}>{conceptsEl}</div>}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {pg.rows.map(i => solveRowAt(i, Math.max((measured?.[`p${i}`] ?? 0), G.minSolveH)))}
        </div>
      </div>
    )
    if (pg.kind === 'cols' || pg.kind === 'socols') {
      const isS = pg.kind === 'cols'
      const gap = isS ? S : G.soGap
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {pg.kind === 'cols' && pg.conceptsFirst && <div style={{ marginBottom: '5mm' }}>{conceptsEl}</div>}
          <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {/* 중앙 세로 구분선 1pt #e7e7e7 — 기본 2단(문제지)에만, 해설지엔 없음 */}
            {isS && <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: '#e7e7e7' }} />}
            <div style={{ position: 'absolute', left: 0, top: 0, width: `${G.colW}mm` }}>
              {pg.cols[0].map(i => <div key={i} style={{ marginBottom: `${gap}mm` }}>{isS ? problemAt(i) : solutionAt(i)}</div>)}
            </div>
            <div style={{ position: 'absolute', right: 0, top: 0, width: `${G.colW}mm` }}>
              {pg.cols[1].map(i => <div key={i} style={{ marginBottom: `${gap}mm` }}>{isS ? problemAt(i) : solutionAt(i)}</div>)}
            </div>
          </div>
        </div>
      )
    }
    if (pg.kind === 'split') {
      const two = opts.layout !== 'split2'
      const nrows = opts.layout === 'split2' ? 2 : opts.layout === 'split4' ? 2 : 3
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {pg.conceptsFirst && <div style={{ marginBottom: '5mm' }}>{conceptsEl}</div>}
          <div className={opts.layout === 'split6' ? 'text-[92%]' : ''}
            style={{
              flex: 1, minHeight: 0, display: 'grid', columnGap: `${G.colGap}mm`,
              gridTemplateColumns: two ? '1fr 1fr' : '1fr', gridTemplateRows: `repeat(${nrows}, 1fr)`, gridAutoFlow: 'column',
            }}>
            {pg.slots.map(i => (
              <div key={i} style={{ overflow: 'hidden', borderBottom: '1px dotted #e3e8ef', paddingBottom: '2mm' }}>
                {problemAt(i)}
              </div>
            ))}
          </div>
        </div>
      )
    }
    // OMR (§7-bis): 2단 표(전체 셀 테두리 0.5pt #cccccc), 행 13.6mm = 번호칸 14.1mm + 답칸,
    // 번호 13pt bold 테마색, 객관식 = ①~⑤ 세로 알약형 빈 버블(윤곽선만), 주관식 = 빈칸
    if (pg.kind === 'omr') {
      const omrCol = (rows: number[], xMm: number) => rows.length === 0 ? null : (
        <div style={{ position: 'absolute', left: `${xMm - G.mx}mm`, top: 0, width: `${G.omrColW}mm` }}>
          {rows.map((i, k) => (
            <div key={i} className="omr-row" style={{
              display: 'flex', height: `${G.omrRowH}mm`, boxSizing: 'border-box',
              border: '0.5pt solid #cccccc', borderTop: k === 0 ? '0.5pt solid #cccccc' : 'none',
            }}>
              <div style={{
                width: `${G.omrNoW}mm`, flex: 'none', borderRight: '0.5pt solid #cccccc',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13pt', fontWeight: 800, color: theme.main,
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5.5mm' }}>
                {items[i].kind === '객관식' && [1, 2, 3, 4, 5].map(n => (
                  <span key={n} className="omr-bubble" style={{
                    width: '4.2mm', height: '8.6mm', boxSizing: 'border-box',
                    border: '0.5pt solid #b5b5b5', borderRadius: '2.1mm',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '6.5pt', lineHeight: 1, color: '#b5b5b5',
                  }}>{n}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )
      return (
        <div style={{ position: 'relative', height: '100%' }}>
          {omrCol(pg.left, G.omrColXL)}
          {omrCol(pg.right, G.omrColXR)}
        </div>
      )
    }
    // 빠른정답
    return (
      <div style={{ position: 'relative', height: '100%' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: `${G.solW}mm` }}>
          {pg.first && (
            <div style={{ height: `${G.qaLabelH}mm`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                padding: '1.6mm 5mm', borderTop: '0.5pt solid #bfbfbf', borderBottom: '0.5pt solid #bfbfbf',
                fontSize: '10pt', fontWeight: 800, color: '#231916',
              }}>빠른정답</div>
            </div>
          )}
          {qaSegment(pg.left)}
        </div>
        <div style={{ position: 'absolute', left: `${G.colW + G.colGap}mm`, top: pg.first ? `${G.qaLabelH}mm` : 0, width: `${G.solW}mm` }}>
          {qaSegment(pg.right)}
        </div>
      </div>
    )
  }

  const visibleIdx = (pagesAll ?? []).map((pg, gi) => ({ pg, gi })).filter(({ pg }) => show[pg.part])
  const lastVisible = visibleIdx.length ? visibleIdx[visibleIdx.length - 1].gi : -1
  const ready = pagesAll != null

  return (
    <div>
      {/* WorksheetView 전용 @page 오버라이드: 여백 0 → 크롬이 머리말·꼬리말(URL·날짜)을 안 찍음.
          다른 화면(보고지 등)의 @page 12mm는 index.css 기본값 그대로 유지된다. */}
      <style>{`@page { size: A4; margin: 0; }`}</style>

      <div className="no-print mb-2 flex flex-wrap items-center gap-3">
        <button onClick={() => nav('/')} className="rounded-lg border border-line px-4 py-2 text-sm">← 목록</button>
        <button onClick={() => nav(`/make?edit=${ws.id}`)} className="rounded-lg border border-line px-4 py-2 text-sm hover:border-pine hover:text-pine">✏ 수정</button>
        <div className="grow" />
        {/* 매쓰플랫 분류 용어: 문제지 / 빠른정답 / 정답해설 / OMR */}
        <span className="text-sm font-bold text-ink2">따로 다운로드</span>
        <div className="flex items-center gap-1 rounded-lg border border-line p-1">
          <button onClick={() => printPart('문제지', '문제지')} disabled={!ready}
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-ink2 hover:bg-pine-soft hover:text-pine-dark disabled:opacity-40">📄 문제지</button>
          <button onClick={() => printPart('빠른정답', '빠른정답')} disabled={!ready}
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-ink2 hover:bg-pine-soft hover:text-pine-dark disabled:opacity-40">🔑 빠른정답</button>
          <button onClick={() => printPart('정답해설', '정답해설')} disabled={!ready}
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-ink2 hover:bg-pine-soft hover:text-pine-dark disabled:opacity-40">📝 정답해설</button>
          <button onClick={() => printPart('OMR', 'OMR')} disabled={!ready}
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-ink2 hover:bg-pine-soft hover:text-pine-dark disabled:opacity-40">🅾 OMR</button>
        </div>
        <button onClick={() => printPart('전체', '문제지', '빠른정답', '정답해설', 'OMR')} disabled={!ready}
          className="rounded-lg bg-pine px-5 py-2.5 text-sm font-bold text-paper hover:bg-pine-dark disabled:opacity-40">🖨 전체 인쇄 / PDF</button>
      </div>
      <p className="no-print mb-6 text-[11px] text-ink2">
        여백 0으로 인쇄돼 머리말·꼬리말 없이 매쓰플랫 실물과 동일하게 나옵니다. 가장자리가 잘리면 인쇄창에서 <b>배율 100% · 여백 ‘없음’</b>을 확인하세요.
      </p>

      {/* 조판 중 스피너 (이미지·폰트 로드 → 실측 → 페이지 분배) */}
      {!ready && (
        <div className="no-print mx-auto flex max-w-md items-center justify-center gap-3 rounded-2xl border border-line bg-white p-10 text-sm text-ink2">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-line border-t-pine" />
          조판 중… (문항 이미지를 불러와 A4 페이지에 배치하고 있습니다)
        </div>
      )}

      {/* 숨김 측정 컨테이너 — 정확한 단 폭에서 블록 높이 실측 */}
      {imgDims && !measured && (
        <div ref={measRef} aria-hidden
          style={{ position: 'fixed', left: '-9999px', top: 0, visibility: 'hidden', pointerEvents: 'none' }}>
          {conceptsEl && <div data-mk="concepts" style={{ width: `${CONTENT_W}mm` }}>{conceptsEl}</div>}
          {items.map((p, i) => (
            <div key={`p${i}`} data-mk={`p${i}`} style={{ width: `${G.colW}mm` }}>
              <ProblemBlock p={p} idx={i} caption={caption(p)} themeMain={theme.main} dims={dims} onVideo={onVideo} />
            </div>
          ))}
          {items.map((p, i) => (
            <div key={`s${i}`} data-mk={`s${i}`} style={{ width: `${G.colW}mm` }}>
              <SolutionBlock p={p} idx={i} themeMain={theme.main} dims={dims} withBody={opts.solutionWithBody} />
            </div>
          ))}
          {qaRows.map((_, r) => (
            <div key={`q${r}`} data-mk={`q${r}`} style={{ width: `${G.solW}mm` }}>{qaRowAt(r, false)}</div>
          ))}
        </div>
      )}

      {/* ══ A4 실물 페이지 (문제지 → 빠른정답 → 해설지, 페이지 번호 부 전체 연속) ══ */}
      {ready && pagesAll!.map((pg, gi) => show[pg.part] && (
        <div key={gi} className={`mf-page ${gi === lastVisible ? 'mf-last' : ''}`}>
          {pg.first ? header1 : headerN}
          <div style={{
            position: 'absolute', left: `${G.mx}mm`, right: `${G.mx}mm`,
            top: `${pg.first ? G.body1Top : G.bodyNTop}mm`, height: `${pg.first ? BODY1_H : BODYN_H}mm`,
            overflow: 'hidden',
          }}>
            {renderBody(pg)}
          </div>
          {/* 푸터 구분선(전폭 1pt #f4f4f4) + 페이지 번호(하단 중앙 10pt, 2자리 0패딩, 전체 연속) */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: `${G.bodyBottom}mm`, borderTop: '1pt solid #f4f4f4' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: '286.5mm', textAlign: 'center', fontSize: '10pt', lineHeight: 1, color: '#000000' }}>
            {String(gi + 1).padStart(2, '0')}
          </div>
        </div>
      ))}

      {video && <VideoModal src={video.src} subtitle={video.subtitle} title={video.title} onClose={() => setVideo(null)} />}
    </div>
  )
}

/* ── 1p 헤더 (매쓰플랫 §5-2): 학년 태그+제목 16pt 인라인 / 부제 13pt / 메타 11pt+이름 / 우상단 학원명 ── */
function PageHeader1({ theme, grade, title, subtitle, dateText, count, author, studentName }: {
  theme: string; grade: string; title: string; subtitle: string
  dateText: string | null; count: number; author: string; studentName?: string | null
}) {
  return (
    <>
      <div style={{ position: 'absolute', left: `${G.mx}mm`, right: `${G.mx}mm`, top: 0, height: '60mm', overflow: 'hidden' }}>
        {/* 우상단 학원명 (로고 자리) */}
        <div style={{ position: 'absolute', right: 0, top: '13mm', fontSize: '11pt', fontWeight: 800, color: '#333333' }}>{author}</div>
        <h1 className="line-clamp-2" style={{
          position: 'absolute', left: 0, right: '50mm', top: '11.6mm',
          fontSize: '16pt', fontWeight: 800, lineHeight: '22.4pt', color: '#000000', letterSpacing: '-0.01em',
        }}>
          <span style={{ color: theme }}>{grade} </span>{title}
        </h1>
        {subtitle && (
          <div style={{ position: 'absolute', left: 0, right: '40mm', top: '30mm', fontSize: '13pt', color: '#5c5c5c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subtitle}
          </div>
        )}
        <div style={{ position: 'absolute', left: 0, top: '45.2mm', fontSize: '11pt', color: '#333333' }}>
          {dateText && <>{dateText} | </>}{count}문제{author && <> | <span style={{ color: '#707070' }}>{author}</span></>}
          <span style={{ marginLeft: '6mm', color: '#000000' }}>
            이름 {studentName ? <b>{studentName}</b> : '________________'}
          </span>
        </div>
      </div>
      {/* 헤더 구분선 y=60mm, 전폭 1pt #f4f4f4 */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: '60mm', borderTop: '1pt solid #f4f4f4' }} />
    </>
  )
}

/* ── 연속 페이지 축약 헤더 (§5-3): 구분선 y=17.6mm, 좌 학습지명 11pt, 우 부제 10pt #5c5c5c ── */
function PageHeaderN({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <div style={{ position: 'absolute', left: '7mm', top: '10.4mm', maxWidth: '110mm', fontSize: '11pt', lineHeight: 1, fontWeight: 600, color: '#000000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {title}
      </div>
      <div style={{ position: 'absolute', right: '7mm', top: '10.8mm', maxWidth: '80mm', fontSize: '10pt', lineHeight: 1, color: '#5c5c5c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {subtitle}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: '17.6mm', borderTop: '1pt solid #f4f4f4' }} />
    </>
  )
}

/* ── 지면 머리글 (MakeWizard STEP3 축소 미리보기용 flow 버전 — 1p 헤더와 같은 구성) ── */
export function SheetHeader({ ws, subtitle, dateText, count, theme }: {
  ws: { grade: string; title: string; author: string }
  subtitle: string; dateText: string | null; count: number; theme: string
}) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', right: 0, top: 0, fontSize: '11pt', fontWeight: 800, color: '#333333' }}>{ws.author}</div>
      <h1 className="line-clamp-2" style={{ paddingRight: '42mm', fontSize: '16pt', fontWeight: 800, lineHeight: '22.4pt', color: '#000000' }}>
        <span style={{ color: theme }}>{ws.grade} </span>{ws.title}
      </h1>
      {subtitle && <div style={{ marginTop: '2.5mm', fontSize: '13pt', color: '#5c5c5c' }}>{subtitle}</div>}
      <div style={{ marginTop: '6mm', fontSize: '11pt', color: '#333333' }}>
        {dateText && <>{dateText} | </>}{count}문제{ws.author && <> | <span style={{ color: '#707070' }}>{ws.author}</span></>}
        <span style={{ marginLeft: '6mm', color: '#000000' }}>이름 ________________</span>
      </div>
      <div style={{ marginTop: '4mm', borderTop: '1pt solid #f4f4f4' }} />
    </div>
  )
}

/* ── 문항 블록 (§5-5): 번호 20pt bold 테마색 2자리 0패딩 + 본문 hanging indent 11.6mm,
      문제 이미지 폭 73.2mm(930px 원본 기준, 작으면 비례) ── */
export function ProblemBlock({ p, idx, caption, themeMain, onVideo, dims }: {
  p: Problem; idx: number; caption: string; themeMain: string
  onVideo?: (p: Problem, idx: number) => void; dims?: Dims
}) {
  return (
    <div style={{ position: 'relative', paddingLeft: `${G.indent}mm` }}>
      <span style={{ position: 'absolute', left: 0, top: 0, fontSize: '20pt', lineHeight: 1, fontWeight: 800, color: themeMain, letterSpacing: '-0.02em' }}>
        {String(idx + 1).padStart(2, '0')}
      </span>
      {(caption || (onVideo && p.videoUrl)) && (
        <div style={{ fontSize: '8pt', lineHeight: 1.3, color: '#949494', marginBottom: '1mm' }}>
          {caption}
          {onVideo && p.videoUrl && (
            <button onClick={() => onVideo(p, idx)}
              className="no-print ml-1.5 rounded-full border border-pine px-1.5 py-0 text-[10px] font-bold text-pine hover:bg-pine-soft">▶</button>
          )}
        </div>
      )}
      {p.imageUrl
        ? <img src={p.imageUrl} alt="" style={scaledImgStyle(dims, p.imageUrl, G.probImgW)} />
        : <>
            <div style={{ fontSize: '10.5pt', lineHeight: 1.7 }}><MathText text={p.body} /></div>
            {p.choices && (
              <div style={{ marginTop: '1.5mm', display: 'grid', gap: '0.5mm', fontSize: '10pt', lineHeight: 1.6 }}>
                {p.choices.map((c, ci) => (
                  <span key={ci}>{'①②③④⑤'[ci]} <MathText text={c} /></span>
                ))}
              </div>
            )}
            {p.kind === '주관식' && <div style={{ marginTop: '5mm', borderBottom: '1px dotted #bfbfbf' }} />}
          </>}
    </div>
  )
}

/* ── 해설 블록 (§7): 번호 20pt + '정답' 9pt #231916 + 답(자연 크기, items-start로 침범 방지)
      → 괘선 0.5pt #414141 → '해설' 9pt #777 → 본문(폭 64.4mm) ── */
function SolutionBlock({ p, idx, themeMain, dims, withBody }: {
  p: Problem; idx: number; themeMain: string; dims?: Dims; withBody?: boolean
}) {
  return (
    <div style={{ position: 'relative', paddingLeft: `${G.indent}mm` }}>
      <span style={{ position: 'absolute', left: 0, top: 0, fontSize: '20pt', lineHeight: 1, fontWeight: 800, color: themeMain, letterSpacing: '-0.02em' }}>
        {String(idx + 1).padStart(2, '0')}
      </span>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2.6mm', minHeight: '7mm', paddingBottom: '1mm' }}>
        <span style={{ fontSize: '9pt', fontWeight: 800, color: '#231916', paddingTop: '1mm', flex: 'none' }}>정답</span>
        <div style={{ fontSize: '10pt', fontWeight: 700, minWidth: 0 }}>
          <AnswerContent text={p.answer} dims={dims} capMm={G.colW - G.indent - 10} />
        </div>
      </div>
      <div style={{ borderTop: '0.5pt solid #414141' }} />
      {withBody && (
        <div style={{ marginTop: '2.5mm', background: '#f7f7f7', borderRadius: '1mm', padding: '2mm' }}>
          {p.imageUrl
            ? <img src={p.imageUrl} alt="" style={scaledImgStyle(dims, p.imageUrl, G.solImgW)} />
            : <>
                <div style={{ fontSize: '9.5pt', lineHeight: 1.6 }}><MathText text={p.body} /></div>
                {p.choices && (
                  <div style={{ marginTop: '1mm', display: 'flex', flexWrap: 'wrap', columnGap: '4mm', fontSize: '9pt', color: '#5c5c5c' }}>
                    {p.choices.map((c, ci) => <span key={ci}>{'①②③④⑤'[ci]} <MathText text={c} /></span>)}
                  </div>
                )}
              </>}
        </div>
      )}
      <div style={{ fontSize: '9pt', fontWeight: 800, color: '#777777', marginTop: '4mm' }}>해설</div>
      <div style={{ marginTop: '1.5mm' }}>
        {isImageUrl(p.solution)
          ? <img src={p.solution} alt="" style={scaledImgStyle(dims, p.solution, G.solImgW)} />
          : <div style={{ fontSize: '9.5pt', lineHeight: 1.7 }}><MathText text={p.solution} /></div>}
      </div>
    </div>
  )
}
