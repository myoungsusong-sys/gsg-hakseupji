import { useMemo, useState } from 'react'
import { CURRICULA } from '../data/curriculum'
import { uid } from '../lib/store'
import type { Kind, WBItem, Workbook } from '../types'

// 정답표 일괄 등록: 빠른정답 텍스트를 붙여넣어 문항(WBItem)으로 파싱
// 형식:
//   37            ← 쪽 헤더 줄 (이후 줄들은 37쪽)
//   1 ③ 소인수분해  ← 번호 정답 [유형검색어]
//   2 12
//   38p 1 ②       ← 인라인 쪽 지정은 p 필수

interface TypeRef { id: string; name: string; unit: string }
interface ParsedRow { page: number; label: string; kind: Kind; answer: string; typeId: string; typeLabel: string; warn?: string }
interface ParseError { line: number; text: string; reason: string }

export default function BulkImportModal({ workbook, existing, onSave, onClose }: {
  workbook: Workbook
  existing: WBItem[]
  onSave: (items: WBItem[]) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')

  // 교재 grade의 과정을 우선 탐색 (중: grade 일치, 고: 과목명=label 일치)
  const { refs, fallbackType } = useMemo(() => {
    const preferred = CURRICULA.find(c => c.grade === workbook.grade || c.label.replace(' (22개정)', '') === workbook.grade)
    const ordered = preferred ? [preferred, ...CURRICULA.filter(c => c !== preferred)] : CURRICULA
    const out: TypeRef[] = []
    for (const c of ordered)
      for (const u of c.units)
        for (const m of u.mids)
          for (const s of m.subs)
            for (const t of s.types) out.push({ id: t.id, name: t.name, unit: u.name })
    const fc = preferred ?? CURRICULA.find(c => c.id === 'm1-1') ?? CURRICULA[0]
    const ft = fc.units[0].mids[0].subs[0].types[0]
    return { refs: out, fallbackType: { id: ft.id, name: ft.name } }
  }, [workbook.grade])

  const { rows, errors } = useMemo(() => {
    const rows: ParsedRow[] = []
    const errors: ParseError[] = []
    let page: number | null = null

    function findType(q: string): TypeRef | undefined {
      return refs.find(r => r.name.includes(q)) ?? refs.find(r => r.unit.includes(q))
    }

    text.split('\n').forEach((raw, idx) => {
      const line = raw.trim()
      if (!line) return
      const tokens = line.split(/\s+/)
      // 쪽 헤더 줄: 숫자 하나만 있는 줄
      if (tokens.length === 1 && /^\d+$/.test(tokens[0])) { page = Number(tokens[0]); return }
      // 인라인 쪽 지정: "38p 1 12" — p 필수
      let rest = tokens
      let p = page
      if (/^\d+[pP]$/.test(tokens[0])) { p = Number(tokens[0].slice(0, -1)); rest = tokens.slice(1) }
      if (p == null) { errors.push({ line: idx + 1, text: line, reason: '쪽이 지정되지 않음 — 쪽 헤더 줄(예: 37) 또는 "38p"로 시작' }); return }
      if (rest.length < 2) { errors.push({ line: idx + 1, text: line, reason: '형식: 번호 정답 [유형검색어]' }); return }
      const [label, answer, ...tq] = rest
      const kind: Kind = /^[①②③④⑤]$/.test(answer) ? '객관식' : '주관식'
      const query = tq.join(' ')
      let typeId: string
      let typeLabel: string
      let warn: string | undefined
      if (query) {
        const hit = findType(query)
        if (hit) { typeId = hit.id; typeLabel = hit.name }
        else { typeId = fallbackType.id; typeLabel = fallbackType.name; warn = '⚠유형 못 찾음' }
      } else {
        // 유형검색어 생략 시 직전 문항의 유형을 잇는다 (없으면 과정 첫 유형)
        const prev = rows.at(-1)
        if (prev) { typeId = prev.typeId; typeLabel = prev.typeLabel }
        else { typeId = fallbackType.id; typeLabel = fallbackType.name; warn = '⚠유형 미지정' }
      }
      rows.push({ page: p, label, kind, answer, typeId, typeLabel, warn })
    })
    return { rows, errors }
  }, [text, refs, fallbackType])

  function save() {
    if (rows.length === 0) { alert('등록할 문항이 없습니다.'); return }
    const base = existing.length
    const items: WBItem[] = rows.map((r, i) => ({
      id: uid('wi'),
      workbookId: workbook.id,
      page: r.page,
      no: base + i + 1,
      label: r.label,
      typeId: r.typeId,
      kind: r.kind,
      answer: r.answer,
    }))
    onSave([...existing, ...items])
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-lg font-bold">📋 정답표 일괄 등록</h3>
          <span className="truncate text-sm text-ink2">{workbook.name}</span>
          <div className="grow" />
          <button onClick={onClose} className="text-ink2 hover:text-ink">✕</button>
        </div>

        <p className="mb-2 text-xs leading-relaxed text-ink2">
          쪽 번호만 있는 줄(<b>37</b>)이 쪽 헤더 — 이후 줄들은 그 쪽의 <b>번호 정답 [유형검색어]</b>.
          한 줄에서 쪽을 바꾸려면 <b>38p 1 12</b>처럼 p를 붙입니다. 정답이 ①~⑤면 객관식으로 자동 인식.
        </p>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={7} autoFocus
          placeholder={'37\n1 ③ 소인수분해\n2 12\n3 ② 약수의 개수\n38p 1 ⑤'}
          className="mb-3 w-full rounded-xl border border-line px-3 py-2 font-mono text-sm" />

        {errors.length > 0 && (
          <div className="mb-3 rounded-xl border border-clay/40 bg-red-50 p-3 text-xs text-clay">
            <b>형식 오류 {errors.length}줄</b> — 등록에서 제외됩니다.
            {errors.slice(0, 5).map(e => (
              <div key={e.line} className="mt-1">· {e.line}행 「{e.text}」 — {e.reason}</div>
            ))}
            {errors.length > 5 && <div className="mt-1">· 외 {errors.length - 5}줄</div>}
          </div>
        )}

        {rows.length > 0 && (
          <div className="min-h-0 grow overflow-y-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-paper2">
                <tr className="text-left text-xs text-ink2">
                  <th className="px-3 py-2">쪽</th><th>번호</th><th>형태</th><th>정답</th><th>유형</th><th>경고</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-line/50">
                    <td className="px-3 py-1.5">{r.page}</td>
                    <td className="py-1.5">{r.label}</td>
                    <td className="py-1.5 text-xs text-ink2">{r.kind}</td>
                    <td className="py-1.5 font-semibold">{r.answer}</td>
                    <td className="py-1.5 text-xs">{r.typeLabel}</td>
                    <td className="py-1.5 text-xs font-semibold text-clay">{r.warn ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink2">
            빠른정답 사진을 Claude에게 주면 이 형식의 텍스트로 만들어 줍니다. 붙여넣으면 여기 미리보기가 뜹니다.
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          {existing.length > 0 && <span className="text-xs text-ink2">기존 {existing.length}문항 뒤에 추가됩니다.</span>}
          <div className="grow" />
          <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm">취소</button>
          <button onClick={save} disabled={rows.length === 0}
            className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper disabled:opacity-40">
            {rows.length}문항 등록
          </button>
        </div>
      </div>
    </div>
  )
}
