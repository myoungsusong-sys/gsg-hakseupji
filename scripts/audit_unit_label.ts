// 단위 라벨(정답 단위 분리 입력) 전수 감사 — 채점이 하나도 안 바뀌었는지 확인한다.
//
//   node --experimental-strip-types scripts/audit_unit_label.ts
//
// 검사 3종 (전부 public/wb-match-*.json 전수):
//   A. 채점 베이스라인 — mathEqual(정답, 정답)이 여전히 100%인가 (객관식/주관식 따로)
//   B. 라벨 대상 — answerUnit()이 라벨을 붙인 문항 수와 분포
//   C. 관용성 — 라벨이 붙은 문항에서 "학생이 값만 입력"해도 정답으로 채점되는가 (반드시 100%)
//
// ⚠️ 절대값을 목표로 삼지 말 것. public/wb-match-*.json 은 수집 파이프라인이 통째로
//    재생성하므로 총계가 수시로 변한다. **같은 스냅샷에서 변경 전/후 수치가 같은지**로 본다.
//    (2026-07-31 스냅샷 기준: 객관식 160,578 / 주관식 893,503 / 라벨 128,444 / C 100.00%)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mathEqual } from '../src/lib/mathAnswer.ts'
import {
  wbAnswerImg, isEssayAnswer, isHeavyMathAnswer, answerUnit,
} from '../src/lib/answers.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'public')

// StudentWorkbooks 의 wbGradable + wbMatch 의 realKind 를 그대로 옮긴 것
const CHOICE_OK = /^[①-⑮]$/
function realKind(kd: unknown, ans: string): '객관식' | '주관식' {
  if (kd !== 'C') return '주관식'
  const p = String(ans ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (!p.length) return '객관식'
  return p.every(x => CHOICE_OK.test(x) || /^[1-5]$/.test(x)) ? '객관식' : '주관식'
}

const stat = { 객관식: 0, 객관식OK: 0, 주관식: 0, 주관식OK: 0, 라벨: 0, 값만OK: 0 }
const byUnit: Record<string, number> = {}
const byLevel: Record<string, number> = { 초등: 0, 중등: 0, 고등: 0 }
const fail: string[] = []

for (const f of fs.readdirSync(DIR).filter(x => /^wb-match-.*\.json$/.test(x))) {
  const course = f.slice(9, -5)
  const elem = course.startsWith('e')
  const level = elem ? '초등' : course.startsWith('m') ? '중등' : '고등'
  const data = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as Record<string, unknown[][]>
  for (const key of Object.keys(data)) for (const row of data[key]) {
    const ans = String(row[4] ?? '').trim()
    const kd = row[5]
    if (!ans || ['.', '-'].includes(ans)) continue
    if (wbAnswerImg(ans) || isEssayAnswer(ans)) continue
    const kind = realKind(kd, ans)
    if (kind !== '객관식' && isHeavyMathAnswer(ans, elem)) continue

    // A. 베이스라인 — 정답 원문을 그대로 입력하면 반드시 정답이어야 한다
    if (kind === '객관식') { stat.객관식++; if (mathEqual(ans, ans)) stat.객관식OK++ }
    else { stat.주관식++; if (mathEqual(ans, ans)) stat.주관식OK++ }

    // B/C. 단위 라벨
    const u = answerUnit(ans, level as '초등' | '중등' | '고등')
    if (!u) continue
    stat.라벨++
    byUnit[u.unit] = (byUnit[u.unit] ?? 0) + 1
    byLevel[level]++
    if (mathEqual(ans, u.value)) stat.값만OK++
    else if (fail.length < 20) fail.push(`${course}: ${ans}  →  값만 '${u.value}' 오답`)
  }
}

const pct = (a: number, b: number) => b ? (a / b * 100).toFixed(2) + '%' : '-'
console.log('A. 채점 베이스라인')
console.log(`   객관식 ${stat.객관식.toLocaleString()} / ${pct(stat.객관식OK, stat.객관식)}`)
console.log(`   주관식 ${stat.주관식.toLocaleString()} / ${pct(stat.주관식OK, stat.주관식)}`)
console.log('B. 단위 라벨 대상')
console.log(`   ${stat.라벨.toLocaleString()}건 (자동채점 대상의 ${pct(stat.라벨, stat.객관식 + stat.주관식)})`)
console.log('   학년:', JSON.stringify(byLevel))
console.log('   상위단위:', JSON.stringify(Object.entries(byUnit).sort((a, b) => b[1] - a[1]).slice(0, 20)))
console.log('C. 값만 입력해도 정답인가')
console.log(`   ${stat.값만OK.toLocaleString()} / ${stat.라벨.toLocaleString()} = ${pct(stat.값만OK, stat.라벨)}  ← 100.00% 아니면 배포 금지`)
if (fail.length) { console.log('   실패 예시:'); for (const s of fail) console.log('    ', s) }
process.exit(stat.값만OK === stat.라벨 && stat.객관식OK === stat.객관식 ? 0 : 1)
