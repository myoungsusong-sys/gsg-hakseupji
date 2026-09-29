// 가벼운 빌드 점검 — public/ 를 복사하지 않고(855MB) 코드만 번들해 본다. 결과는 임시 폴더에 쓰고 지운다.
// 🔴 2026-09-29: 맥북에어 디스크 여유 1GB 에서 `npm run build`(dist 855MB)가 드라이브를 멈춰 세웠다.
//    실제 배포 빌드는 Vercel 이 한다 — 여기서는 «컴파일이 되는가»만 확인하면 된다.
import { build } from 'vite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const out = mkdtempSync(join(tmpdir(), 'hj-build-'))
const t = Date.now()
try {
  await build({ logLevel: 'error', publicDir: false, build: { outDir: out, emptyOutDir: true, reportCompressedSize: false } })
  console.log(`✓ built in ${((Date.now() - t) / 1000).toFixed(1)}s (가벼운 점검)`)
} finally { rmSync(out, { recursive: true, force: true }) }
