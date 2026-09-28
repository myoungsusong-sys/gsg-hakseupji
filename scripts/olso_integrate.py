#!/usr/bin/env python3
"""중학 사회·역사(올쏘 유사유형) 과정을 앱에 붙인다 — python3 scripts/olso_integrate.py [과정 …]
과정을 안 주면 _gen/m-soc*·m-his* 중 olso_check 를 통과한 것 전부.
 ① _gen/<과정>/_tree.json      → src/data/curriculum-olso.ts (OLSO_TREES)
 ② _gen/<과정>/_wbmap.json     → public/wb-match-<과정>.json 의 유형 id 교체(교재 오답 → 새 유형 사다리)
 ③ _gen/<과정>/_concepts.json  → _concepts/<과정>.json
 ④ node scripts/merge-gen.mjs <과정> → public/gen-<과정>.json
그 뒤 직접: node _concepts/합치기.mjs · npm run build"""
import json, os, subprocess, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
ALL = ['m-soc1-1', 'm-soc1-2', 'm-soc2-1', 'm-soc2-2', 'm-his1-1', 'm-his1-2', 'm-his2-1', 'm-his2-2', 'h-khis1', 'h-khis2']
want = sys.argv[1:] or ALL
ok = []
for c in want:
    if not os.path.exists(f'_gen/{c}/_tree.json'):
        continue
    r = subprocess.run([sys.executable, '_gen/olso_check.py', c], capture_output=True, text=True)
    print(r.stdout.strip().splitlines()[0], '→', '통과' if r.returncode == 0 else '실패(건너뜀)')
    if r.returncode == 0:
        ok.append(c)

# ① 트리 — 이미 붙은 과정(파일에 있던 것)은 유지하고 이번 과정만 덮는다
path = 'src/data/curriculum-olso.ts'
trees = {}
if os.path.exists(path):
    s = open(path).read()
    j = s[s.index('= {') + 2: s.rindex('}') + 1] if '= {' in s else '{}'
    trees = json.loads(j)
for c in ok:
    trees[c] = json.load(open(f'_gen/{c}/_tree.json'))
with open(path, 'w') as f:
    f.write('// 자동 생성 — _gen/<과정>/_tree.json 을 scripts/olso_integrate.py 로 합친 것. 손으로 고치지 마라.\n')
    f.write('// 올쏘(22개정) 중학 사회·역사 교재 목차대로 세운 단원·유형 트리. 유형 id 는 build() 가 순서로 매긴다\n')
    f.write('// (<과정>-u{대}m{중}s{소}t{유형}) — 순서를 바꾸면 문항·교재 채점표의 id 가 밀린다. 끝에만 덧붙일 것.\n')
    f.write('type SubC = [string, string[]]\ntype MidC = [string, SubC[]]\ntype BigC = [string, MidC[]]\n\n')
    f.write('export const OLSO_TREES: Record<string, BigC[]> = ' + json.dumps(trees, ensure_ascii=False, indent=1) + '\n')

node = os.environ.get('NODE', 'node')
for c in ok:
    # ② 교재 채점표 — 교재 채점표가 없는 과정(고1 한국사 등)은 건너뛴다
    n = 0
    p = f'public/wb-match-{c}.json'
    wm = json.load(open(f'_gen/{c}/_wbmap.json')) if os.path.exists(f'_gen/{c}/_wbmap.json') else {}
    d = json.load(open(p)) if os.path.exists(p) and wm else {}
    for k, items in d.items():
        for it in items:
            # 🔴 2026-09-28: 교재 문항 id(개념01·대표01 …)는 단원마다 다시 쓰인다 → «쪽:id» 로 먼저 찾는다.
            #    (예전엔 id 만 봐서 같은 id 가 여러 쪽에 있으면 전부 첫 쪽 유형으로 붙었다 — 사회①-1 첫 배포)
            key = f'{it[1]}:{it[0]}'
            t = wm.get(key) or wm.get(it[0])
            if t and it[2] != t:
                it[2] = t; n += 1
    if d:
        json.dump(d, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))
    # ③ 개념카드
    json.dump(json.load(open(f'_gen/{c}/_concepts.json')), open(f'_concepts/{c}.json', 'w'), ensure_ascii=False, indent=1)
    # ④ 문항
    r = subprocess.run([node, 'scripts/merge-gen.mjs', c], capture_output=True, text=True)
    print(f'[{c}] 채점표 {n}문항 유형 교체 ·', r.stdout.strip().replace('\n', ' '))
print('붙인 과정:', ok)
