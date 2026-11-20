// QR 코드 생성기 (바이트 모드 · 오류정정 M · 1~10판) — 바깥 라이브러리 없이 직접 만든다.
// 쓰는 곳: 학습지 머리말의 «찍어서 답 입력» QR (WorksheetView), 주소 한 줄(100바이트 안팎)이면 충분하다.
// 결과는 참/거짓 격자(true = 검은 칸). 그리기는 qrPath() 로 SVG path 한 줄을 만든다.

// 판(version)별 블록 구성 — 오류정정 M 기준: [오류정정 코드워드 수, 1군 블록 수, 1군 자료 코드워드, 2군 블록 수, 2군 자료 코드워드]
const BLOCKS_M: Record<number, [number, number, number, number, number]> = {
  1: [10, 1, 16, 0, 0],
  2: [16, 1, 28, 0, 0],
  3: [26, 1, 44, 0, 0],
  4: [18, 2, 32, 0, 0],
  5: [24, 2, 43, 0, 0],
  6: [16, 4, 27, 0, 0],
  7: [18, 4, 31, 0, 0],
  8: [22, 2, 38, 2, 39],
  9: [22, 3, 36, 2, 37],
  10: [26, 4, 43, 1, 44],
}
// 정렬 무늬 중심 좌표
const ALIGN: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
}

// ── GF(256) 연산 (기약다항식 0x11D) ──
const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
{
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
}
const gmul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]])

// 리드-솔로몬 생성 다항식(차수 n)의 계수 — 최고차항(1) 제외, 높은 차수부터
function rsGenerator(n: number): number[] {
  let poly = [1]
  for (let i = 0; i < n; i++) {
    const next = new Array<number>(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]
      next[j + 1] ^= gmul(poly[j], EXP[i])
    }
    poly = next
  }
  return poly.slice(1)
}
function rsRemainder(data: number[], gen: number[]): number[] {
  const rem = new Array<number>(gen.length).fill(0)
  for (const b of data) {
    const factor = b ^ rem[0]
    rem.shift(); rem.push(0)
    for (let i = 0; i < gen.length; i++) rem[i] ^= gmul(gen[i], factor)
  }
  return rem
}

function utf8(text: string): number[] {
  return Array.from(new TextEncoder().encode(text))
}

/** 이 글이 들어가는 가장 작은 판. 10판(바이트 213자)도 넘으면 null */
function pickVersion(len: number): number | null {
  for (let v = 1; v <= 10; v++) {
    const [, b1, d1, b2, d2] = BLOCKS_M[v]
    const dataBits = (b1 * d1 + b2 * d2) * 8
    const need = 4 + (v <= 9 ? 8 : 16) + len * 8
    if (need <= dataBits) return v
  }
  return null
}

/** 글 → QR 격자. 너무 길면(10판 초과) null */
export function qrMatrix(text: string): boolean[][] | null {
  const bytes = utf8(text)
  const ver = pickVersion(bytes.length)
  if (ver == null) return null
  const [ecLen, b1, d1, b2, d2] = BLOCKS_M[ver]
  const dataLen = b1 * d1 + b2 * d2

  // ── 자료 비트열: 모드(0100) + 글자 수 + 바이트들 + 종료 + 채움 ──
  const bits: number[] = []
  const put = (val: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1) }
  put(0b0100, 4)
  put(bytes.length, ver <= 9 ? 8 : 16)
  for (const b of bytes) put(b, 8)
  const cap = dataLen * 8
  put(0, Math.min(4, cap - bits.length))
  while (bits.length % 8 !== 0) bits.push(0)
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8)
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]
    data.push(b)
  }

  // ── 블록 나누기 + 오류정정 + 엇갈려 싣기 ──
  const gen = rsGenerator(ecLen)
  const dBlocks: number[][] = [], eBlocks: number[][] = []
  let pos = 0
  for (let i = 0; i < b1 + b2; i++) {
    const len = i < b1 ? d1 : d2
    const blk = data.slice(pos, pos + len); pos += len
    dBlocks.push(blk); eBlocks.push(rsRemainder(blk, gen))
  }
  const all: number[] = []
  const maxD = Math.max(d1, d2)
  for (let i = 0; i < maxD; i++) for (const blk of dBlocks) if (i < blk.length) all.push(blk[i])
  for (let i = 0; i < ecLen; i++) for (const blk of eBlocks) all.push(blk[i])

  // ── 격자: 기능 무늬 ──
  const size = ver * 4 + 17
  const mod: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const fn: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const setFn = (x: number, y: number, dark: boolean) => { mod[y][x] = dark; fn[y][x] = true }

  // 타이밍 무늬
  for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0) }
  // 위치 찾기 무늬(세 귀퉁이) + 흰 테두리
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy
      if (x < 0 || x >= size || y < 0 || y >= size) continue
      const d = Math.max(Math.abs(dx), Math.abs(dy))
      setFn(x, y, d !== 2 && d !== 4)
    }
  }
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4)
  // 정렬 무늬
  const al = ALIGN[ver]
  for (let i = 0; i < al.length; i++) for (let j = 0; j < al.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      setFn(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    }
  }
  // 형식 정보 자리(값은 마스크 고른 뒤) + 늘 검은 칸
  const drawFormat = (mask: number) => {
    const d = (0b00 << 3) | mask            // 오류정정 M = 00
    let rem = d
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const f = ((d << 10) | rem) ^ 0x5412
    const bit = (i: number) => ((f >>> i) & 1) !== 0
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(i))
    setFn(8, 7, bit(6)); setFn(8, 8, bit(7)); setFn(7, 8, bit(8))
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i))
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i))
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i))
    setFn(8, size - 8, true)
  }
  drawFormat(0)
  // 판 정보(7판부터)
  if (ver >= 7) {
    let rem = ver
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const vbits = (ver << 12) | rem
    for (let i = 0; i < 18; i++) {
      const dark = ((vbits >>> i) & 1) !== 0
      const a = size - 11 + (i % 3), b = Math.floor(i / 3)
      setFn(a, b, dark); setFn(b, a, dark)
    }
  }

  // ── 자료 싣기(오른쪽 아래에서 지그재그) ──
  let k = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vert : vert
        if (!fn[y][x] && k < all.length * 8) {
          mod[y][x] = ((all[k >>> 3] >>> (7 - (k & 7))) & 1) !== 0
          k++
        }
      }
    }
  }

  // ── 마스크 8가지 중 벌점이 가장 낮은 것 ──
  const maskFn = (m: number, x: number, y: number): boolean => {
    switch (m) {
      case 0: return (x + y) % 2 === 0
      case 1: return y % 2 === 0
      case 2: return x % 3 === 0
      case 3: return (x + y) % 3 === 0
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
      case 5: return ((x * y) % 2) + ((x * y) % 3) === 0
      case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
      default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
    }
  }
  const applyMask = (m: number) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (!fn[y][x] && maskFn(m, x, y)) mod[y][x] = !mod[y][x]
    }
  }
  const penalty = (): number => {
    let p = 0
    // 같은 색이 5칸 넘게 이어짐(가로·세로)
    for (let dir = 0; dir < 2; dir++) {
      for (let a = 0; a < size; a++) {
        let run = 1
        for (let b = 1; b < size; b++) {
          const cur = dir === 0 ? mod[a][b] : mod[b][a]
          const prev = dir === 0 ? mod[a][b - 1] : mod[b - 1][a]
          if (cur === prev) { run++; if (run === 5) p += 3; else if (run > 5) p++ }
          else run = 1
        }
      }
    }
    // 2×2 같은 색
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
      const c = mod[y][x]
      if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3
    }
    // 위치 찾기 무늬 닮은꼴(1:1:3:1:1 + 흰 4칸)
    const pat = [true, false, true, true, true, false, true, false, false, false, false]
    for (let a = 0; a < size; a++) for (let b = 0; b + 11 <= size; b++) {
      for (let dir = 0; dir < 2; dir++) {
        let fwd = true, rev = true
        for (let i = 0; i < 11; i++) {
          const v = dir === 0 ? mod[a][b + i] : mod[b + i][a]
          if (v !== pat[i]) fwd = false
          if (v !== pat[10 - i]) rev = false
        }
        if (fwd) p += 40
        if (rev) p += 40
      }
    }
    // 검은 칸 비율이 50%에서 벗어난 만큼
    let dark = 0
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (mod[y][x]) dark++
    p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10
    return p
  }
  let best = 0, bestP = Infinity
  for (let m = 0; m < 8; m++) {
    applyMask(m); drawFormat(m)
    const p = penalty()
    if (p < bestP) { bestP = p; best = m }
    applyMask(m)                    // 되돌리기(XOR 이라 한 번 더 걸면 원래대로)
  }
  applyMask(best); drawFormat(best)
  return mod
}

/** 격자 → SVG path d (칸 하나 = 1 단위). viewBox 는 `0 0 n n` (n = 격자 크기 + 여백×2) */
export function qrPath(m: boolean[][], quiet = 2): { d: string; n: number } {
  const parts: string[] = []
  for (let y = 0; y < m.length; y++) {
    let x = 0
    while (x < m.length) {
      if (!m[y][x]) { x++; continue }
      let w = 1
      while (x + w < m.length && m[y][x + w]) w++
      parts.push(`M${x + quiet} ${y + quiet}h${w}v1h-${w}z`)
      x += w
    }
  }
  return { d: parts.join(''), n: m.length + quiet * 2 }
}
