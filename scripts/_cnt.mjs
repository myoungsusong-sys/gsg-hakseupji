import { build } from 'esbuild'
import fs from 'fs'
const r = await build({ entryPoints:['src/data/curriculum.ts'], bundle:true, format:'esm', write:false, platform:'node' })
fs.writeFileSync('scripts/_cur.mjs', r.outputFiles[0].text)
const { CURRICULA } = await import('./_cur.mjs')
const out = {}
for (const c of CURRICULA) { let n=0; for (const u of c.units) for (const m of u.mids) for (const s of m.subs) n+=s.types.length; out[c.id]=n }
console.log(JSON.stringify(out))
console.log('과정수', CURRICULA.length, '유형합', Object.values(out).reduce((a,b)=>a+b,0))
