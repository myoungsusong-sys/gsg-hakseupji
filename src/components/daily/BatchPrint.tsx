import { useEffect, useMemo, useRef, useState } from 'react'
import { loadVoca, vocaBookOf } from '../../lib/voca'
import { isStaleChunkError } from '../../lib/staleChunk'
import { isImageUrl } from '../MathText'
import type { Problem, Student } from '../../types'

// ── 📄 오늘 기본과제 일괄 PDF — 문제지·정답·해설·단어시험을 한 파일로 ──────────────────
//
// 왜 만들었나 (2026-08-21 명수쌤)
//   ① "학생 개별 이름이 나오게 해서 pdf로 만들어줘" — 학생마다 [🖨 인쇄]를 누르면
//      20명이면 20개 파일이 생긴다. 인쇄해 나눠 주려면 한 파일이어야 한다.
//   ② "해설과 정답도 다운로드 후 출력이 가능하게" — 채점을 **선생님이** 하게 되면서
//      정답지 없이는 채점 자체가 불가능해졌다. 단어시험도 뜻만 있고 답이 없어 못 매겼다.
//
// 🔴 되는 이유: lib/sheetPdf 의 buildSheetPdf() 는 **현재 화면의 .mf-page 를 전부** 모아
//    한 PDF로 만든다. 그래서 WorksheetView(924줄, useParams 의존)를 건드리지 않고
//    여기서 전 학생 페이지를 .mf-page 로 그려 두기만 하면 한 파일이 나온다.
//
// 🔴 **정답·해설은 학생 수만큼 찍지 않는다.** buildByTypeRound() 에 학생 인자가 없어
//    같은 학년·과목이면 문항이 완전히 같다(실측 확인). 학년·과목당 한 벌만 낸다 —
//    20명이면 정답지가 20배로 불어나 인쇄가 불가능해진다.
//
// 🔴 쪽 나눔은 **이미지 실제 높이를 재서** 채운다. 고정 칸 배치는 문항 크기가 제각각이라
//    작은 문제에서 지면을 버리고 큰 문제에서 잘린다. 다 실은 뒤 넘치는 것부터 다음 장으로.

const PAGE_W = 210, PAGE_H = 297          // mm (A4)
const MARGIN = 12, GUTTER = 6
const COL_W = (PAGE_W - MARGIN * 2 - GUTTER) / 2      // 90mm
const HEAD_H = 22, FOOT_H = 8
const BODY_H = PAGE_H - HEAD_H - FOOT_H - MARGIN      // 한 단이 쓸 수 있는 높이
// 🔴 이미지는 번호 배지(약 7mm) 옆에 붙으므로 **단 폭 그대로가 아니다.**
//    높이를 COL_W 로 계산하면 실제보다 작게 잡혀 마지막 문항이 지면 밖으로 밀린다
//    (실측 2026-08-21: 해설 쪽에서 96px 넘침). 반드시 이 값으로 계산한다.
const IMG_W = COL_W - 7

/** 문항 한 칸의 높이(mm) — 문제 이미지 + 풀이 여백. 이미지는 단 폭에 맞춰 축소된다.
 *  🔴 실측(2026-08-21, 마플시너지 미적분Ⅰ 24문항): 가로/세로비가 0.94~5.54, 중앙값 2.18.
 *     처음엔 여백을 최대 46mm 줬는데, 비 1.12 짜리 한 문항이 132mm(반 쪽)를 먹어
 *     15문항이 3쪽으로 퍼졌다. 여백을 조이니 2쪽으로 들어온다. */
function slotHeight(ratio: number): number {
  const img = IMG_W / Math.max(0.25, ratio)           // ratio = 가로/세로
  const work = Math.max(16, Math.min(26, img * 0.35)) // 풀이 공간
  return Math.min(BODY_H, img + work + 5)
}
/** 해설 한 칸의 높이 — 학생이 쓸 자리가 필요 없으니 이미지 높이 + 여백만. */
function solHeight(ratio: number): number {
  return Math.min(BODY_H, IMG_W / Math.max(0.25, ratio) + 7)
}

type Sheet =
  | { kind: '문제'; student: Student; subject: '수학' | '과학' | '사회'; problems: Problem[] }
  | { kind: '단어장'; student: Student; book: string; day: number; words: [string, string][] }   // 외우기용(영단어+뜻)
  | { kind: '단어'; student: Student; book: string; day: number; words: [string, string][] }
  | { kind: '정답'; label: string; problems: Problem[] }              // 학년·과목별 빠른정답
  | { kind: '해설'; label: string; problems: Problem[] }              // 학년·과목별 정답·해설
  | { kind: '단어정답'; label: string; day: number; words: [string, string][] }

/** 이미지 가로/세로 비를 미리 재 둔다 — 못 재면 A4 문항의 흔한 비율(2.6)로 본다. */
function useRatios(urls: string[]): Map<string, number> {
  const [map, setMap] = useState<Map<string, number>>(new Map())
  useEffect(() => {
    let alive = true
    const out = new Map<string, number>()
    let left = urls.length
    if (!left) { setMap(out); return }
    for (const u of urls) {
      const im = new Image()
      im.crossOrigin = 'anonymous'
      const done = (r: number) => {
        out.set(u, r)
        if (--left === 0 && alive) setMap(new Map(out))
      }
      im.onload = () => done(im.naturalWidth / Math.max(1, im.naturalHeight))
      im.onerror = () => done(2.6)
      im.src = u
    }
    return () => { alive = false }
  }, [urls.join('|')])   // eslint-disable-line react-hooks/exhaustive-deps
  return map
}

/** 채점표에 쓸 정답 글자 — 정답이 이미지로만 오는 서술형은 「해설 참조」. */
function answerText(p: Problem): string {
  const a = (p.answer ?? '').trim()
  if (!a || isImageUrl(a)) return '해설 참조'
  return a
}

type Part = '문제지' | '빠른정답' | '정답해설' | '단어장' | '단어시험'

export default function BatchPrint({
  sheets, brand, onClose,
}: { sheets: Sheet[]; brand: string; onClose: () => void }) {
  const [busy, setBusy] = useState('')
  const [done, setDone] = useState(false)
  // 🔴 정답·해설을 기본으로 켜 둔다 — 선생님이 채점하려면 없으면 안 되는 것이다.
  const [parts, setParts] = useState<Set<Part>>(
    new Set<Part>(['문제지', '빠른정답', '정답해설', '단어시험']))
  const stage = useRef<HTMLDivElement>(null)
  const today = new Date()
  const dstr = `${today.getFullYear()}. ${today.getMonth() + 1}. ${today.getDate()}`

  const toggle = (p: Part) => setParts(s => {
    const n = new Set(s)
    if (n.has(p)) n.delete(p); else n.add(p)
    return n
  })

  const picked = useMemo(() => sheets.filter(s =>
    s.kind === '문제' ? parts.has('문제지')
      : s.kind === '정답' ? parts.has('빠른정답')
        : s.kind === '해설' ? parts.has('정답해설')
          : s.kind === '단어장' ? parts.has('단어장')
            : parts.has('단어시험')), [sheets, parts])

  const urls = useMemo(() => {
    const s = new Set<string>()
    for (const sh of picked) {
      if (sh.kind === '문제') for (const p of sh.problems) if (p.imageUrl) s.add(p.imageUrl)
      if (sh.kind === '해설') for (const p of sh.problems) if (p.solution && isImageUrl(p.solution)) s.add(p.solution)
    }
    return [...s]
  }, [picked])
  const ratios = useRatios(urls)
  const measured = urls.length === 0 || ratios.size >= urls.length

  type Page =
    | { t: '문제'; head: Extract<Sheet, { kind: '문제' }>; cols: Problem[][]; no: number; of: number }
    | { t: '해설'; head: Extract<Sheet, { kind: '해설' }>; cols: Problem[][]; no: number; of: number }
    | { t: '단어장'; head: Extract<Sheet, { kind: '단어장' }> }
    | { t: '단어'; head: Extract<Sheet, { kind: '단어' }> }
    | { t: '정답'; head: Extract<Sheet, { kind: '정답' }> }
    | { t: '단어정답'; head: Extract<Sheet, { kind: '단어정답' }> }

  /** 문항들을 단(column)에 채우고 2단씩 한 쪽으로 묶는다. */
  function pack(list: Problem[], h: (p: Problem) => number): Problem[][] {
    const cols: Problem[][] = []
    let cur: Problem[] = [], acc = 0
    for (const p of list) {
      const ph = h(p)
      if (cur.length && acc + ph > BODY_H) { cols.push(cur); cur = []; acc = 0 }
      cur.push(p); acc += ph
    }
    if (cur.length) cols.push(cur)
    return cols
  }

  const pages = useMemo(() => {
    if (!measured) return []
    const out: Page[] = []
    for (const sh of picked) {
      if (sh.kind === '단어장') { out.push({ t: '단어장', head: sh }); continue }
      if (sh.kind === '단어') { out.push({ t: '단어', head: sh }); continue }
      if (sh.kind === '단어정답') { out.push({ t: '단어정답', head: sh }); continue }
      if (sh.kind === '정답') { out.push({ t: '정답', head: sh }); continue }
      if (sh.kind === '해설') {
        const items = sh.problems.filter(p => p.solution)
        const cols = pack(items, p => solHeight(ratios.get(p.solution ?? '') ?? 2.6))
        const total = Math.ceil(cols.length / 2)
        for (let i = 0; i < cols.length; i += 2) {
          out.push({ t: '해설', head: sh, cols: cols.slice(i, i + 2), no: i / 2 + 1, of: total })
        }
        continue
      }
      const cols = pack(sh.problems, p => slotHeight(ratios.get(p.imageUrl ?? '') ?? 2.6))
      const total = Math.ceil(cols.length / 2)
      for (let i = 0; i < cols.length; i += 2) {
        out.push({ t: '문제', head: sh, cols: cols.slice(i, i + 2), no: i / 2 + 1, of: total })
      }
    }
    return out
  }, [picked, ratios, measured])

  async function make(act: 'print' | 'download') {
    setBusy('PDF 만드는 중… (쪽 수에 따라 30초~2분)')
    try {
      const mod = await import('../../lib/sheetPdf').catch((e: unknown) => {
        if (isStaleChunkError(e)) {
          if (confirm('새 버전이 배포되어 이 화면이 오래됐어요.\n새로고침하면 바로 됩니다.\n\n지금 새로고침할까요?')) location.reload()
          return null
        }
        throw e
      })
      if (!mod) { setBusy(''); return }
      const doc = await mod.buildSheetPdf()
      const name = `기본과제_${today.getMonth() + 1}월${today.getDate()}일_${pages.length}쪽`
      if (act === 'print') mod.printPdf(doc); else mod.savePdf(doc, name)
      setDone(true)
    } catch (e) {
      alert('PDF 생성에 실패했습니다.\n' + String(e).slice(0, 140))
    }
    setBusy('')
  }

  const students = new Set(sheets
    .filter((s): s is Extract<Sheet, { kind: '문제' | '단어' }> => s.kind === '문제' || s.kind === '단어')
    .map(s => s.student.id)).size
  const countOf = (k: Sheet['kind']) => sheets.filter(s => s.kind === k).length

  /** 쪽 머리 — 학생 이름(또는 정답지 라벨)을 크게. 20장을 섞어 놔도 한눈에 찾아야 한다. */
  function Head({ big, small, title, sub, answer }: {
    big: string; small?: string; title: string; sub: string; answer?: boolean
  }) {
    return (
      <div className={`flex items-end gap-3 border-b-2 pb-2 ${answer ? 'border-clay' : 'border-ink'}`}>
        <div className="min-w-0">
          <div className="text-[10pt] font-bold tracking-wide text-ink2">{brand} · {dstr}</div>
          <div className="flex items-baseline gap-2">
            <span className={`text-[24pt] font-black leading-tight ${answer ? 'text-clay' : ''}`}>{big}</span>
            {small && <span className="text-[11pt] font-bold text-ink2">{small}</span>}
          </div>
        </div>
        <div className="grow" />
        <div className="text-right">
          <div className="text-[15pt] font-black">{title}</div>
          <div className="text-[9pt] text-ink2">{sub}</div>
        </div>
      </div>
    )
  }
  const Foot = ({ label }: { label: string }) => (
    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-[12mm] pb-[6mm] text-[8pt] text-ink2">
      <span>{label}</span><span>{dstr}</span>
    </div>
  )

  const PART_LIST: [Part, number][] = [
    ['문제지', countOf('문제')], ['빠른정답', countOf('정답')],
    ['정답해설', countOf('해설')], ['단어장', countOf('단어장')], ['단어시험', countOf('단어') + countOf('단어정답')],
  ]

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-paper2">
      <div className="no-print sticky top-0 z-10 border-b border-line bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <b className="text-sm">📄 오늘 기본과제 — 학생 {students}명 · {pages.length}쪽</b>
          <div className="grow" />
          {!measured && <span className="text-xs text-ink2">문항 크기 재는 중… {ratios.size}/{urls.length}</span>}
          <button onClick={() => make('download')} disabled={!!busy || !measured || !pages.length}
            className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper hover:brightness-110 disabled:opacity-50">
            {busy || '⬇ PDF 저장'}
          </button>
          <button onClick={() => make('print')} disabled={!!busy || !measured || !pages.length}
            className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink2 hover:border-pine disabled:opacity-50">
            🖨 바로 인쇄
          </button>
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-ink2 hover:text-ink">닫기</button>
        </div>
        {/* 무엇을 담을지 — 정답·해설은 선생님 채점용이라 기본으로 켜 둔다 */}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-ink2">담을 것</span>
          {PART_LIST.map(([p, n]) => (
            <label key={p} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-semibold ${
              parts.has(p) ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line bg-white text-ink2'}`}>
              <input type="checkbox" checked={parts.has(p)} onChange={() => toggle(p)} className="accent-pine" />
              {p} <span className="font-normal">{n}장</span>
            </label>
          ))}
          <span className="text-ink2">정답·해설은 <b className="text-ink">학년·과목당 한 벌</b>만 나옵니다 — 문항이 같습니다.</span>
        </div>
        {done && <p className="mt-1 text-xs text-pine-dark">✅ 만들었습니다. 파일이 안 보이면 브라우저 다운로드 목록을 보세요.</p>}
      </div>

      <div ref={stage} className="py-4">
        {pages.map((pg, i) => {
          const last = i === pages.length - 1 ? 'mf-last' : ''

          if (pg.t === '문제') {
            const st = pg.head.student
            return (
              <div key={i} className={`mf-page ${last}`}>
                <div style={{ padding: `${MARGIN}mm ${MARGIN}mm 0` }}>
                  <Head big={st.name} small={st.grade} title={`${pg.head.subject} 기본과제`}
                    sub={`${pg.of > 1 ? `${pg.no}/${pg.of}쪽 · ` : ''}풀어서 선생님께 내세요`} />
                  <div className="mt-3 flex gap-[6mm]">
                    {pg.cols.map((col, ci) => (
                      <div key={ci} style={{ width: `${COL_W}mm` }} className="flex flex-col">
                        {col.map(p => (
                          <div key={p.id} style={{ height: `${slotHeight(ratios.get(p.imageUrl ?? '') ?? 2.6)}mm` }}
                            className="relative border-b border-dashed border-line/60">
                            <div className="flex items-start gap-1.5">
                              <span className="mt-[0.6mm] shrink-0 rounded bg-ink px-1.5 text-[8pt] font-bold leading-[4mm] text-white">
                                {pg.head.problems.indexOf(p) + 1}
                              </span>
                              {p.imageUrl
                                ? <img src={p.imageUrl} alt="" style={{
                                    width: `${IMG_W}mm`, maxHeight: `${BODY_H - 6}mm`,
                                    objectFit: 'contain', objectPosition: 'left top' }} />
                                : <span className="text-[9pt]">{p.body || '(문제 이미지 없음)'}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <Foot label={`${st.name} · ${st.grade}`} />
              </div>
            )
          }

          if (pg.t === '해설') {
            return (
              <div key={i} className={`mf-page ${last}`}>
                <div style={{ padding: `${MARGIN}mm ${MARGIN}mm 0` }}>
                  <Head answer big="정답 · 해설" small={pg.head.label} title="선생님용"
                    sub={`${pg.of > 1 ? `${pg.no}/${pg.of}쪽 · ` : ''}학생에게 주지 마세요`} />
                  <div className="mt-3 flex gap-[6mm]">
                    {pg.cols.map((col, ci) => (
                      <div key={ci} style={{ width: `${COL_W}mm` }} className="flex flex-col">
                        {col.map(p => (
                          <div key={p.id} style={{ height: `${solHeight(ratios.get(p.solution ?? '') ?? 2.6)}mm` }}
                            className="relative border-b border-dashed border-line/60">
                            <div className="flex items-start gap-1.5">
                              <span className="mt-[0.6mm] shrink-0 rounded bg-clay px-1.5 text-[8pt] font-bold leading-[4mm] text-white">
                                {pg.head.problems.indexOf(p) + 1}
                              </span>
                              <img src={p.solution} alt="" style={{
                                width: `${IMG_W}mm`, maxHeight: `${BODY_H - 6}mm`,
                                objectFit: 'contain', objectPosition: 'left top' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <Foot label={`정답·해설 · ${pg.head.label}`} />
              </div>
            )
          }

          if (pg.t === '정답') {
            return (
              <div key={i} className={`mf-page ${last}`}>
                <div style={{ padding: `${MARGIN}mm ${MARGIN}mm 0` }}>
                  <Head answer big="빠른정답" small={pg.head.label} title="선생님용"
                    sub="채점용 · 학생에게 주지 마세요" />
                  <div className="mt-4 grid grid-cols-5 gap-x-[5mm]">
                    {pg.head.problems.map((p, k) => (
                      <div key={p.id} className="flex items-baseline gap-2 border-b border-line/70 py-[2.6mm]">
                        <span className="w-[7mm] shrink-0 text-right text-[9pt] font-bold text-ink2">{k + 1}</span>
                        <b className="min-w-0 grow truncate text-[11pt]">{answerText(p)}</b>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-[8.5pt] text-ink2">
                    「해설 참조」는 답이 한 줄로 안 나오는 서술형입니다 — 뒤의 정답·해설 장을 보세요.
                  </p>
                </div>
                <Foot label={`빠른정답 · ${pg.head.label}`} />
              </div>
            )
          }

          if (pg.t === '단어정답') {
            return (
              <div key={i} className={`mf-page ${last}`}>
                <div style={{ padding: `${MARGIN}mm ${MARGIN}mm 0` }}>
                  <Head answer big="단어시험 정답" small={pg.head.label} title="선생님용"
                    sub={`DAY ${pg.head.day} · 채점용`} />
                  <div className="mt-3 grid grid-cols-2 gap-x-[6mm]">
                    {pg.head.words.map(([w, mean], k) => (
                      <div key={k} className="flex items-baseline gap-2 border-b border-line/70 py-[3.4mm]">
                        <span className="w-[6mm] shrink-0 text-[9pt] font-bold text-ink2">{k + 1}</span>
                        <b className="w-[34mm] shrink-0 text-[10.5pt]">{w}</b>
                        <span className="min-w-0 grow truncate text-[9.5pt] text-ink2">{mean}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Foot label={`단어시험 정답 · ${pg.head.label}`} />
              </div>
            )
          }

          // 📕 단어장 (학생용 · 외우기) — 시험 전에 이걸 보고 외운다
          if (pg.t === '단어장') {
            const s0 = pg.head.student
            const longest = Math.max(...pg.head.words.map(([, m]) => m.length))
            const pad = longest > 26 ? '3.1mm' : longest > 18 ? '4.2mm' : '5.4mm'
            const fs = longest > 26 ? '9.3pt' : '10.5pt'
            return (
              <div key={i} className={`mf-page ${last}`}>
                <div style={{ padding: `${MARGIN}mm ${MARGIN}mm 0` }}>
                  <Head big={s0.name} small={s0.grade} title="영어 단어장"
                    sub={`${pg.head.book} · DAY ${pg.head.day} · 외운 뒤 시험을 봅니다`} />
                  <div className="mt-3 grid grid-cols-2 gap-x-[6mm]">
                    {pg.head.words.map(([w, mean], k) => (
                      <div key={k} style={{ paddingTop: pad, paddingBottom: pad }}
                        className="flex items-baseline gap-2 border-b border-line/70">
                        <span className="w-[6mm] shrink-0 text-[9pt] font-bold text-ink2">{k + 1}</span>
                        <b className="w-[34mm] shrink-0 text-[10.5pt]">{w}</b>
                        <span style={{ fontSize: fs }} className="min-w-0 grow leading-snug text-ink2">{mean}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Foot label={`영어 단어장 · ${s0.name} · DAY ${pg.head.day}`} />
              </div>
            )
          }

          // 단어시험지 (학생용)
          const st = pg.head.student
          return (
            <div key={i} className={`mf-page ${last}`}>
              <div style={{ padding: `${MARGIN}mm ${MARGIN}mm 0` }}>
                <Head big={st.name} small={st.grade} title="영어 단어시험"
                  sub={`${pg.head.book} · DAY ${pg.head.day}`} />
                {/* 🔴 줄 높이는 **뜻 길이를 보고** 정한다. 천일문(중등)은 뜻이 짧지만
                    어휘끝 수능은 "1. 외모, (겉)모습 2. 출현, 등장" 처럼 길어 두 줄이 되고,
                    고정 여백으로 두면 25번째 단어가 지면 밖으로 밀린다(실측 125px 넘침). */}
                {(() => {
                  const longest = Math.max(...pg.head.words.map(([, m]) => m.length))
                  const pad = longest > 26 ? '3.1mm' : longest > 18 ? '4.2mm' : '5.4mm'
                  const fs = longest > 26 ? '9.3pt' : '10.5pt'
                  return (
                    <div className="mt-3 grid grid-cols-2 gap-x-[6mm]">
                      {pg.head.words.map(([, mean], k) => (
                        <div key={k} style={{ paddingTop: pad, paddingBottom: pad }}
                          className="flex items-center gap-2 border-b border-line/70">
                          <span className="w-[6mm] shrink-0 text-[9pt] font-bold text-ink2">{k + 1}</span>
                          <span style={{ fontSize: fs }} className="min-w-0 grow leading-snug">{mean}</span>
                          <span className="h-[6mm] w-[36mm] shrink-0 border-b border-ink2/50" />
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
              <Foot label={`${st.name} · ${st.grade}`} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** 단어시험지에 쓸 그날의 단어 — 학년에 맞는 책에서 고른다. */
export async function vocaSheetFor(student: Student, day: number): Promise<Sheet | null> {
  const bk = vocaBookOf(student.grade)
  try {
    const all = await loadVoca(bk.file)
    const keys = Object.keys(all)
    const d = String(Math.min(Math.max(1, day), keys.length))
    const words = all[d]
    if (!words?.length) return null
    return { kind: '단어', student, book: bk.name, day: Number(d), words }
  } catch { return null }
}

/** 📕 단어장(외우기용) — 영단어와 뜻을 나란히. 명수쌤 2026-08-25: "영어 단어장을 먼저 만들어줘".
 *  시험지만 주면 학생은 외울 것이 없다. 같은 DAY 의 25단어를 먼저 주고, 외운 뒤 시험을 본다. */
export async function vocaStudySheetFor(student: Student, day: number): Promise<Sheet | null> {
  const bk = vocaBookOf(student.grade)
  try {
    const all = await loadVoca(bk.file)
    const keys = Object.keys(all)
    const d = String(Math.min(Math.max(1, day), keys.length))
    const words = all[d]
    if (!words?.length) return null
    return { kind: '단어장', student, book: bk.name, day: Number(d), words }
  } catch { return null }
}

/** 단어시험 정답지 — 책마다 한 벌. 선생님이 채점하려면 영단어가 있어야 한다. */
export async function vocaAnswerFor(grade: string, day: number): Promise<Sheet | null> {
  const bk = vocaBookOf(grade)
  try {
    const all = await loadVoca(bk.file)
    const keys = Object.keys(all)
    const d = String(Math.min(Math.max(1, day), keys.length))
    const words = all[d]
    if (!words?.length) return null
    return { kind: '단어정답', label: bk.name, day: Number(d), words }
  } catch { return null }
}

export type { Sheet }
