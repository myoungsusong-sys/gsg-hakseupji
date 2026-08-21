import { useEffect, useMemo, useRef, useState } from 'react'
import { loadVoca, vocaBookOf } from '../../lib/voca'
import { isStaleChunkError } from '../../lib/staleChunk'
import type { Problem, Student } from '../../types'

// ── 📄 오늘 기본과제 일괄 PDF — 학생 이름이 박힌 문제지·단어시험지를 한 파일로 ──────────
//
// 왜 만들었나 (2026-08-21 명수쌤): "오늘 학생들이 풀 문제지와 단어장을 학생 개별 이름이
// 나오게 해서 pdf로 만들어줘."  지금까지는 학생 한 명씩 [🖨 인쇄]를 눌러야 했다 —
// 20명이면 20번 눌러 20개 파일이 생긴다. 인쇄해서 나눠 주려면 한 파일이어야 한다.
//
// 🔴 되는 이유: lib/sheetPdf 의 buildSheetPdf() 는 **현재 화면의 .mf-page 를 전부** 모아
//    한 PDF로 만든다. 그래서 WorksheetView(924줄, useParams 의존)를 건드리지 않고
//    여기서 전 학생 페이지를 .mf-page 로 그려 두기만 하면 한 파일이 나온다.
//
// 🔴 쪽 나눔은 **이미지 실제 높이를 재서** 채운다. 고정 칸 배치는 문항 크기가 제각각이라
//    작은 문제에서 지면을 버리고 큰 문제에서 잘린다. 다 실은 뒤 넘치는 것부터 다음 장으로.

const PAGE_W = 210, PAGE_H = 297          // mm (A4)
const MARGIN = 12, GUTTER = 6
const COL_W = (PAGE_W - MARGIN * 2 - GUTTER) / 2      // 90mm
const HEAD_H = 22, FOOT_H = 8
const BODY_H = PAGE_H - HEAD_H - FOOT_H - MARGIN      // 한 단이 쓸 수 있는 높이

/** 문항 한 칸의 높이(mm) — 문제 이미지 + 풀이 여백. 이미지는 단 폭에 맞춰 축소된다.
 *  🔴 실측(2026-08-21, 마플시너지 미적분Ⅰ 24문항): 가로/세로비가 0.94~5.54, 중앙값 2.18.
 *     처음엔 여백을 최대 46mm 줬는데, 비 1.12 짜리 한 문항이 132mm(반 쪽)를 먹어
 *     15문항이 3쪽으로 퍼졌다. 여백을 조이니 2쪽으로 들어온다. */
function slotHeight(ratio: number): number {
  const img = COL_W / Math.max(0.25, ratio)           // ratio = 가로/세로
  const work = Math.max(16, Math.min(26, img * 0.35)) // 풀이 공간
  return Math.min(BODY_H, img + work + 5)
}

type Sheet =
  | { kind: '문제'; student: Student; subject: '수학' | '과학'; problems: Problem[] }
  | { kind: '단어'; student: Student; book: string; day: number; words: [string, string][] }

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

export default function BatchPrint({
  sheets, brand, onClose,
}: { sheets: Sheet[]; brand: string; onClose: () => void }) {
  const [busy, setBusy] = useState('')
  const [done, setDone] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const today = new Date()
  const dstr = `${today.getFullYear()}. ${today.getMonth() + 1}. ${today.getDate()}`

  const urls = useMemo(() => {
    const s = new Set<string>()
    for (const sh of sheets) if (sh.kind === '문제') for (const p of sh.problems) if (p.imageUrl) s.add(p.imageUrl)
    return [...s]
  }, [sheets])
  const ratios = useRatios(urls)
  const measured = urls.length === 0 || ratios.size >= urls.length

  // 학생·과목별로 문항을 쪽에 채운다 (2단, 높이를 재서)
  const pages = useMemo(() => {
    if (!measured) return []
    type Page = { head: Sheet; cols: Problem[][]; no: number; of: number; words?: [string, string][] }
    const out: Page[] = []
    for (const sh of sheets) {
      if (sh.kind === '단어') { out.push({ head: sh, cols: [], no: 1, of: 1, words: sh.words }); continue }
      const cols: Problem[][] = []
      let cur: Problem[] = []
      let h = 0
      for (const p of sh.problems) {
        const ph = slotHeight(ratios.get(p.imageUrl ?? '') ?? 2.6)
        if (cur.length && h + ph > BODY_H) { cols.push(cur); cur = []; h = 0 }
        cur.push(p); h += ph
      }
      if (cur.length) cols.push(cur)
      const total = Math.ceil(cols.length / 2)
      for (let i = 0; i < cols.length; i += 2) {
        out.push({ head: sh, cols: cols.slice(i, i + 2), no: i / 2 + 1, of: total })
      }
    }
    return out
  }, [sheets, ratios, measured])

  async function make(act: 'print' | 'download') {
    setBusy('PDF 만드는 중… (문항 수에 따라 30초~2분)')
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
      const name = `기본과제_${today.getMonth() + 1}월${today.getDate()}일_${sheets.length}장`
      if (act === 'print') mod.printPdf(doc); else mod.savePdf(doc, name)
      setDone(true)
    } catch (e) {
      alert('PDF 생성에 실패했습니다.\n' + String(e).slice(0, 140))
    }
    setBusy('')
  }

  const students = new Set(sheets.map(s => s.student.id)).size

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-paper2">
      {/* 조작 막대 — 캡처에서는 .no-print 로 빠진다 */}
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-line bg-white px-4 py-3 shadow-sm">
        <b className="text-sm">📄 오늘 기본과제 — 학생 {students}명 · {sheets.length}장 · {pages.length}쪽</b>
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
        {done && <span className="w-full text-xs text-pine-dark">✅ 만들었습니다. 파일이 안 보이면 브라우저 다운로드 목록을 보세요.</span>}
      </div>

      <div ref={stage} className="py-4">
        {pages.map((pg, i) => {
          // 🔴 union 좁히기는 **지역 const 로 꺼내야** 먹는다. pg.head 로 바로 쓰면
          //    TS 가 kind 를 판별자로 인정하지 않아 book·day 접근이 컴파일 에러가 난다.
          const head = pg.head
          const st = head.student
          const title = head.kind === '단어' ? '영어 단어시험' : `${head.subject} 기본과제`
          const sub = head.kind === '단어'
            ? `${head.book} · DAY ${head.day}`
            : `${pg.of > 1 ? `${pg.no}/${pg.of}쪽 · ` : ''}풀고 채점한 뒤, 틀린 문제는 선생님께 오세요`
          return (
            <div key={i} className={`mf-page ${i === pages.length - 1 ? 'mf-last' : ''}`}>
              <div style={{ padding: `${MARGIN}mm ${MARGIN}mm 0` }}>
                {/* 머리 — 🔴 이름을 제일 크게. 20장을 섞어 놔도 한눈에 찾아야 한다 */}
                <div className="flex items-end gap-3 border-b-2 border-ink pb-2">
                  <div className="min-w-0">
                    <div className="text-[10pt] font-bold tracking-wide text-ink2">{brand} · {dstr}</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[24pt] font-black leading-tight">{st.name}</span>
                      <span className="text-[11pt] font-bold text-ink2">{st.grade}</span>
                    </div>
                  </div>
                  <div className="grow" />
                  <div className="text-right">
                    <div className="text-[15pt] font-black">{title}</div>
                    <div className="text-[9pt] text-ink2">{sub}</div>
                  </div>
                </div>

                {/* 몸 */}
                {head.kind === '단어' ? (
                  <div className="mt-3 grid grid-cols-2 gap-x-[6mm]">
                    {(pg.words ?? []).map(([, mean], k) => (
                      <div key={k} className="flex items-center gap-2 border-b border-line/70 py-[5.4mm]">
                        <span className="w-[6mm] shrink-0 text-[9pt] font-bold text-ink2">{k + 1}</span>
                        <span className="min-w-0 grow text-[10.5pt] leading-snug">{mean}</span>
                        <span className="h-[6mm] w-[38mm] shrink-0 border-b border-ink2/50" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 flex gap-[6mm]">
                    {pg.cols.map((col, ci) => (
                      <div key={ci} style={{ width: `${COL_W}mm` }} className="flex flex-col">
                        {col.map((p, k) => {
                          const no = head.kind === '문제' ? head.problems.indexOf(p) + 1 : k + 1
                          return (
                            <div key={p.id} style={{ height: `${slotHeight(ratios.get(p.imageUrl ?? '') ?? 2.6)}mm` }}
                              className="relative border-b border-dashed border-line/60">
                              <div className="flex items-start gap-1.5">
                                <span className="mt-[0.6mm] shrink-0 rounded bg-ink px-1.5 text-[8pt] font-bold leading-[4mm] text-white">{no}</span>
                                {p.imageUrl
                                  ? <img src={p.imageUrl} alt={`${no}번`} style={{ width: `${COL_W - 7}mm` }} />
                                  : <span className="text-[9pt]">{p.body || '(문제 이미지 없음)'}</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 꼬리 */}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-[12mm] pb-[6mm] text-[8pt] text-ink2">
                <span>{st.name} · {st.grade}</span>
                <span>{dstr}</span>
              </div>
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

export type { Sheet }
