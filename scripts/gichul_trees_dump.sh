#!/bin/sh
# 유형 트리 → scripts/gichul_trees.json (gichul_autotag.py 가 읽음) — workerD 11/10
# node 24(타입 지우기)로 curriculum*.ts 를 바로 읽는다. import 경로에 .ts 를 붙인 사본을 임시 폴더에 만든다.
set -e
NODE=${NODE:-node}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
T=$(mktemp -d)
cp "$ROOT"/src/data/curriculum*.ts "$T"/
for f in "$T"/*.ts; do sed -i.bak -E "s#from '(\./curriculum[^']*)'#from '\1.ts'#g; s#^import type .*##" "$f"; done
cat > "$T"/dump.mjs <<'JS'
import { CURRICULA } from './curriculum.ts'
import fs from 'fs'
const want = ['m1-1','m1-2','m2-1','m2-2','m3-1','m3-2','h-cm1','h-cm2','h-alg','h-calc1','h-stat','h-calc2','h-geo','h-int1','h-phy','h-chem','h-bio','h-earth','h-chemrxn','h-biogen','h-earthsys','h15-phy1','h15-chem1','h15-bio1','h15-earth1']
const out = {}
for (const c of CURRICULA) if (want.includes(c.id)) out[c.id] = { label: c.label, types: c.units.flatMap(u => u.mids.flatMap(m => m.subs.flatMap(s => s.types.map(t => ({ id: t.id, name: t.name, sub: s.name, mid: m.name, unit: u.name }))))) }
fs.writeFileSync(process.argv[2], JSON.stringify(out))
console.log(Object.entries(out).map(([k, v]) => k + ':' + v.types.length).join(' '))
JS
"$NODE" "$T"/dump.mjs "$ROOT"/scripts/gichul_trees.json
rm -rf "$T"
