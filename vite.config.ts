import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 🔴 배포해도 «지금 풀고 있는 학생» 화면이 안 깨지게 — 자산 주소에 배포 번호(?dpl=)를 박는다
//
// 학생이 문제를 풀고 있는 동안 새 배포가 나가면 그 브라우저는 옛 번들로 돌고 있다.
// 그 상태에서 아직 안 받은 조각을 요청하면 404 가 되어 화면이 깨진다. 우리 앱에서 그 조각은 둘이다.
//   ① KaTeX 폰트 59개  — 아직 안 나온 수식 글꼴 (학생 화면)
//   ② PDF 만들기 chunk — sheetPdf·html2canvas·purify·typeof (선생님 화면)
//
// Vercel 의 Skew Protection 이 옛 배포 자산을 12시간 살려 둔다(maxAge 43200). 다만
// 공식 문서상 «자동»은 Next.js·SvelteKit·Qwik·Astro·Nuxt 뿐이고, **Vite 는 직접 붙여야 한다.**
// VERCEL_SKEW_PROTECTION_ENABLED 가 '1' 일 때 모든 자산 주소에 ?dpl=<배포 ID> 를 달아,
// 그 번들이 «자기 배포»의 조각을 받아 오게 한다.
//   https://vercel.com/docs/skew-protection  (Supported frameworks → Other frameworks)
//
// 🔴 public/ 자산(정적 JSON·그림)에는 붙이지 않는다(type !== 'asset' 로 걸러진다).
//    그쪽은 배포마다 이름이 그대로여서 ?dpl= 이 붙으면 배포할 때마다 캐시가 통째로 날아가
//    첫 로딩이 느려진다 — 그건 고쳐 놓은 것을 되돌리는 일이다.
const skewDpl =
  process.env.VERCEL_SKEW_PROTECTION_ENABLED === '1'
    ? process.env.VERCEL_DEPLOYMENT_ID
    : undefined

/**
 * renderBuiltUrl 이 못 미치는 자리를 메운다.
 *
 * 실측(2026-10-06): renderBuiltUrl 만 켜면 index.html·CSS 폰트·preload 목록
 * (__vite__mapDeps)에는 ?dpl= 이 붙지만, **실제 동적 import 경로**
 * `import(`./sheetPdf-XXXX.js`)` 에는 안 붙는다 — 그 경로는 자산이 아니라 chunk 라서
 * renderBuiltUrl 을 거치지 않는다. preload 는 dpl 로 가고 정작 import 는 dpl 없이 가니
 * 결국 404 다. 그래서 생성된 chunk 코드에서 그 자리를 직접 메운다.
 */
function skewProtectChunkImports(dpl: string | undefined): Plugin {
  return {
    name: 'skew-protect-chunk-imports',
    enforce: 'post',
    generateBundle(_options, bundle) {
      if (!dpl) return
      const names = Object.keys(bundle)
        .filter((f) => f.endsWith('.js'))
        .map((f) => f.slice(f.lastIndexOf('/') + 1))
      if (!names.length) return
      const alt = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
      const re = new RegExp(`(["'\`])\\./(${alt})\\1`, 'g')
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue
        file.code = file.code.replace(re, (_m, q: string, name: string) => `${q}./${name}?dpl=${dpl}${q}`)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), skewProtectChunkImports(skewDpl)],
  experimental: {
    renderBuiltUrl(filename, { type }) {
      if (!skewDpl || type !== 'asset') return undefined
      return `/${filename}?dpl=${skewDpl}`
    },
  },
})
