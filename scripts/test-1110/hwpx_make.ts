// node --experimental-strip-types scripts/test-1110/hwpx_make.ts [출력.hwpx] — 저장소 뿌리에서. 글·그림·쪽 나눔이 든 시험 hwpx 를 만든다(한글에서 열어 보기용)
import { writeFileSync, readFileSync } from 'node:fs'
import { buildHwpx } from '../../src/lib/sheetHwpx.ts'
const jpg = readFileSync('public/gichul/g3-2025-csat-calc/probs/q1.jpg')
// JPEG 크기 읽기(SOF0)
let w = 0, h = 0; for (let i = 2; i < jpg.length;) { const m = jpg[i + 1], len = jpg.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc2) { h = jpg.readUInt16BE(i + 5); w = jpg.readUInt16BE(i + 7); break } i += 2 + len }
const out = buildHwpx('시험 학습지', [
  { kind: 'text', text: '시험 학습지 <영어> & "수학"', style: 'title' },
  { kind: 'text', text: '고1 · 20문제   이름 ________', style: 'small' },
  { kind: 'text', text: '01', style: 'num' },
  { kind: 'text', text: 'Choose the correct word.\nShe [ has / have ] lived here.' },
  { kind: 'text', text: '① has   ② have' },
  { kind: 'text', text: '02', style: 'num' },
  { kind: 'img', data: new Uint8Array(jpg), w, h, widthMm: 90 },
  { kind: 'text', text: '빠른 정답', style: 'title', pageBreak: true },
  { kind: 'text', text: '01 ①   02 ③' },
])
writeFileSync(process.argv[2] ?? '/tmp/test.hwpx', out); console.log('bytes', out.length, 'img', w, h)
