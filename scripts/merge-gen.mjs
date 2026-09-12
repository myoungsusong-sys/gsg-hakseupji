#!/usr/bin/env node
/**
 * 🧩 자체 생성 문항 병합 — _gen/<course>/*.json → public/gen-<course>.json
 *   node scripts/merge-gen.mjs m1-1
 * 검사: 필수 필드 · 객관식 보기 5개 · 정답 형식(①~⑤ / 값) · $ 짝 · id 중복. 통과 못 한 문항은 이유와 함께 제외.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
const course = process.argv[2]
if (!course) { console.error('과정 id 를 주세요 (예: m1-1)'); process.exit(1) }
const dir = join(process.cwd(), '_gen', course)
if (!existsSync(dir)) { console.error('폴더 없음:', dir); process.exit(1) }
const CIRC = ['①', '②', '③', '④', '⑤']
const out = [], bad = [], seen = new Set()
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  let arr
  try { arr = JSON.parse(readFileSync(join(dir, f), 'utf8')) } catch (e) { bad.push([f, 'JSON 깨짐']); continue }
  if (!Array.isArray(arr)) { bad.push([f, '배열 아님']); continue }
  arr.forEach((p, i) => {
    const why = []
    for (const k of ['id', 'typeId', 'kind', 'diff', 'body', 'answer', 'solution']) if (p[k] == null || p[k] === '') why.push(`${k} 없음`)
    if (p.kind === '객관식') {
      if (!Array.isArray(p.choices) || p.choices.length !== 5) why.push('보기 5개 아님')
      if (!CIRC.includes(String(p.answer).trim())) why.push('객관식 정답이 ①~⑤ 아님')
    }
    // ✍️ selfGrade(서술형 자기채점)는 길이 제한을 두지 않는다 — 어차피 기계가 대조하지 않는다.
    //    켜지 않은 주관식은 mathEqual 로 대조하므로 긴 답이면 학생이 무엇을 써도 오답이 된다.
    if (p.kind === '주관식' && !p.selfGrade && String(p.answer).length > 40) why.push('주관식 정답 너무 김 (selfGrade 필요)')
    if (typeof p.body === 'string' && (p.body.split('$').length - 1) % 2) why.push('$ 짝 안 맞음(본문)')
    if (typeof p.solution === 'string' && (p.solution.split('$').length - 1) % 2) why.push('$ 짝 안 맞음(풀이)')
    if (seen.has(p.id)) why.push('id 중복')
    if (why.length) { bad.push([`${f}#${i}`, why.join(', ')]); return }
    seen.add(p.id)
    out.push({ id: p.id, typeId: String(p.typeId), kind: p.kind, diff: Number(p.diff), body: p.body,
      ...(p.choices ? { choices: p.choices } : {}), answer: String(p.answer).trim(), solution: p.solution,
      source: p.source || '자체 생성',
      // 📗 교과서(출판사) — 영어 내신 문항은 그 교과서 본문이 지문이라 학생 교과서와 맞춰 걸러야 한다.
      //    여기서 안 흘려보내면 public/gen-*.json 에서 사라져 필터가 통째로 무력해진다(2026-09-12 실측).
      ...(p.book ? { book: String(p.book) } : {}),
      ...(p.selfGrade ? { selfGrade: true } : {}),
      custom: true })
  })
}
mkdirSync(join(process.cwd(), 'public'), { recursive: true })
const target = join(process.cwd(), 'public', `gen-${course}.json`)
writeFileSync(target, JSON.stringify(out))
const byType = out.reduce((a, p) => (a[p.typeId] = (a[p.typeId] || 0) + 1, a), {})
console.log(`✅ ${out.length}문항 → ${target} (${(readFileSync(target).length / 1024).toFixed(0)}KB) · 유형 ${Object.keys(byType).length}개`)
console.log(`❌ 제외 ${bad.length}건`); bad.slice(0, 12).forEach(([w, r]) => console.log('   ', w, '—', r))
