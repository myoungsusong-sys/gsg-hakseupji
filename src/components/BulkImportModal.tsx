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
//   8 | 물이 증발하기 때문이다.   ← 공백이 든 정답(서술형)은 | 뒤에 문장 그대로
//
// 🔴 | 가 필요한 이유: 아래 파싱은 공백으로 토큰을 나눠 `번호 정답 유형검색어` 로 읽는다.
// 서술형 정답은 문장이라 그냥 쓰면 첫 낱말만 정답이 되고 나머지가 유형검색어로 사라진다
// (오투 과학 서술형 60문항을 넣으려다 발견). | 앞은 `번호`(+선택적 정답), | 뒤는 나머지.

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
      // 공백이 든 정답(서술형)은 `|` 로 경계를 준다. `번호 | 문장` 또는 `번호 정답 | 유형검색어`
      const bar = line.indexOf('|')
      const head = bar >= 0 ? line.slice(0, bar).trim() : line
      const tail = bar >= 0 ? line.slice(bar + 1).trim() : ''
      const tokens = head.split(/\s+/).filter(Boolean)
      // 쪽 헤더 줄: 숫자 하나만 있는 줄 (`39 | 문장` 은 헤더가 아니라 문항이다)
      if (bar < 0 && tokens.length === 1 && /^\d+$/.test(tokens[0])) { page = Number(tokens[0]); return }
      if (!tokens.length) { errors.push({ line: idx + 1, text: line, reason: '번호가 없음 — 형식: 번호 | 정답' }); return }
      // 인라인 쪽 지정: "38p 1 12" — p 필수
      let rest = tokens
      let p = page
      if (/^\d+[pP]$/.test(tokens[0])) { p = Number(tokens[0].slice(0, -1)); rest = tokens.slice(1) }
      if (p == null) { errors.push({ line: idx + 1, text: line, reason: '쪽이 지정되지 않음 — 쪽 헤더 줄(예: 37) 또는 "38p"로 시작' }); return }
      if (rest.length < (bar >= 0 ? 1 : 2)) {
        errors.push({ line: idx + 1, text: line, reason: '형식: 번호 정답 [유형검색어] · 문장 정답은 「번호 | 문장」' }); return
      }
      // `|` 있음 → 정답은 (번호 뒤 토큰이 있으면 그것들, 없으면) `|` 뒤 문장 그대로. 유형검색어는 그 반대편.
      const label = rest[0]
      const answer = bar >= 0 ? (rest.length > 1 ? rest.slice(1).join(' ') : tail) : rest[1]
      const query = bar >= 0 ? (rest.length > 1 ? tail : '') : rest.slice(2).join(' ')
      if (!answer) { errors.push({ line: idx + 1, text: line, reason: '정답이 비어 있음' }); return }
      const kind: Kind = /^[①②③④⑤]$/.test(answer) ? '객관식' : '주관식'
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
          <br />
          <b>공백이 든 문장 정답(서술형)</b>은 번호 뒤에 <b>|</b> 를 넣고 문장을 그대로 씁니다 — <b>8 | 물이 증발하기 때문이다.</b>
        </p>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={7} autoFocus
          placeholder={'37\n1 ③ 소인수분해\n2 12\n3 ② 약수의 개수\n38p 1 ⑤\n15\n8 | 증발하면서 주위의 열을 흡수하기 때문이다.'}
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

        {/* 매칭 교재는 정답표가 이미 있다 — 여기 넣는 건 '덮어쓰기'라는 걸 분명히 알린다.
            (개정판이 달라 책과 정답이 안 맞는 교재를 선생님이 직접 맞추는 용도) */}
        {workbook.matchKey && (
          <p className="mt-3 rounded-lg bg-amber-soft/50 px-3 py-2 text-xs text-ink2">
            이 교재는 정답표가 이미 있습니다. <b className="text-ink">쪽과 번호가 같은 문항은 여기 넣은 정답으로 바뀝니다.</b>
            {' '}책과 다른 문항만 넣으시면 됩니다 — 채점해 둔 기록은 그대로 남습니다.
          </p>
        )}

        <div className="mt-3 flex items-center gap-2">
          {existing.length > 0 && (
            <span className="text-xs text-ink2">
              {workbook.matchKey ? `이미 고쳐 넣은 ${existing.length}문항에 더해집니다.` : `기존 ${existing.length}문항 뒤에 추가됩니다.`}
            </span>
          )}
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
