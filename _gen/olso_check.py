#!/usr/bin/env python3
"""중학 사회·역사(올쏘 유사유형) 과정 검사 — python3 _gen/olso_check.py <과정id>
트리 형식 · 문항 형식(merge-gen 규칙과 동일 + 추가) · 유형별 문항 수/난이도 · 정답 분포 · 그림 의존 문구 · wbmap 전수."""
import json, os, re, sys, glob, collections

C = sys.argv[1]
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), C)
errs, warns = [], []

def load(p):
    try:
        return json.load(open(p))
    except Exception as e:
        errs.append(f'{os.path.basename(p)} JSON 깨짐: {e}'); return None

tree = load(os.path.join(D, '_tree.json')) or []
types, subs = {}, {}
try:
    for ui, (u, mids) in enumerate(tree):
        for mi, (m, ss) in enumerate(mids):
            for si, (s, ts) in enumerate(ss):
                subs[f'{C}-u{ui}m{mi}s{si}'] = s
                if not 1 <= len(ts) <= 5: warns.append(f'소단원 «{s}» 유형 {len(ts)}개')
                for ti, t in enumerate(ts):
                    assert isinstance(t, str) and t.strip()
                    types[f'{C}-u{ui}m{mi}s{si}t{ti}'] = t
except Exception as e:
    errs.append(f'_tree.json 형식 오류: {e}')

CIRC = ['①', '②', '③', '④', '⑤']
VIS = re.compile(r'(다음|아래|위)\s*(지도|사진|그림|그래프|도표|지형도)|(지도|사진|그림|그래프)(의|에서|에 표시된)\s*[A-E(（ㄱ-ㅎ가-마]|(지도|사진|그림|그래프)[을를]\s*보고')
probs, seen = [], set()
for f in sorted(glob.glob(os.path.join(D, 'p-*.json'))):
    arr = load(f)
    if not isinstance(arr, list):
        errs.append(f'{os.path.basename(f)} 배열 아님'); continue
    for i, p in enumerate(arr):
        w = f'{os.path.basename(f)}#{i}'
        why = []
        for k in ['id', 'typeId', 'kind', 'diff', 'body', 'answer', 'solution']:
            if p.get(k) in (None, ''): why.append(f'{k} 없음')
        if p.get('typeId') not in types: why.append(f'typeId 트리에 없음({p.get("typeId")})')
        if p.get('diff') not in (1, 2, 3, 4, 5): why.append('diff 1~5 아님')
        if p.get('kind') == '객관식':
            ch = p.get('choices')
            if not isinstance(ch, list) or len(ch) != 5: why.append('보기 5개 아님')
            elif len(set(c.strip() for c in ch)) != 5: why.append('보기 중복')
            if str(p.get('answer', '')).strip() not in CIRC: why.append('객관식 정답 ①~⑤ 아님')
        elif p.get('kind') == '주관식':
            if not p.get('selfGrade') and len(str(p.get('answer', ''))) > 8: why.append('단답 정답 8자 초과(서술형이면 selfGrade)')
        else:
            why.append('kind 는 객관식/주관식')
        for k in ('body', 'solution'):
            if isinstance(p.get(k), str) and p[k].count('$') % 2: why.append(f'$ 짝({k})')
        if isinstance(p.get('body'), str) and VIS.search(p['body']): why.append('그림·지도 의존 문구: ' + VIS.search(p['body']).group(0))
        if p.get('id') in seen: why.append('id 중복')
        seen.add(p.get('id'))
        if why: errs.append(f'{w}: ' + ', '.join(why))
        probs.append(p)

by = collections.defaultdict(list)
for p in probs: by[p.get('typeId')].append(p)
empty = [t for t in types if t not in by]
if empty: errs.append(f'문항 없는 유형 {len(empty)}개: ' + ', '.join(empty[:8]))
thin = [t for t, ps in by.items() if t in types and len(ps) < 5]
if thin: errs.append(f'5문항 미만 유형 {len(thin)}개: ' + ', '.join(thin[:8]))
nodiff = [t for t, ps in by.items() if t in types and len({x.get("diff") for x in ps}) < 3]
if nodiff: warns.append(f'난이도가 3단계 미만인 유형 {len(nodiff)}개')
ans = collections.Counter(p.get('answer') for p in probs if p.get('kind') == '객관식')
nobj = sum(ans.values())
if nobj and max(ans.values()) / nobj > 0.3: warns.append(f'정답 번호 쏠림 {dict(ans)}')
kinds = collections.Counter(('서술' if p.get('selfGrade') else p.get('kind')) for p in probs)
if probs and (kinds['주관식'] + kinds['서술']) / len(probs) > 0.2: warns.append(f'주관식 비율 높음 {dict(kinds)}')

# 개념카드: 소단원 전수
cc = load(os.path.join(D, '_concepts.json')) if os.path.exists(os.path.join(D, '_concepts.json')) else None
if cc is None: errs.append('_concepts.json 없음')
else:
    have = {c.get('subId') for c in cc}
    miss = [s for s in subs if s not in have]
    if miss: errs.append(f'개념카드 없는 소단원 {len(miss)}개: ' + ', '.join(miss[:6]))
    bad = [c.get('subId') for c in cc if c.get('subId') not in subs]
    if bad: errs.append(f'트리에 없는 subId 카드: {bad[:6]}')

# wbmap 전수
wi = os.path.join(D, '_wbitems.json')
if os.path.exists(wi):
    items = json.load(open(wi))
    wm = load(os.path.join(D, '_wbmap.json')) if os.path.exists(os.path.join(D, '_wbmap.json')) else None
    if wm is None: errs.append('_wbmap.json 없음')
    else:
        miss = [x[0] for x in items if x[0] not in wm]
        badt = [k for k, v in wm.items() if v not in types]
        if miss: errs.append(f'wbmap 빠진 교재 문항 {len(miss)}개: {miss[:6]}')
        if badt: errs.append(f'wbmap 유형 id 트리에 없음 {len(badt)}개: {badt[:6]}')

print(f'[{C}] 트리 대{len(tree)} 소{len(subs)} 유형{len(types)} · 문항 {len(probs)} {dict(kinds)} · 정답분포 {dict(sorted(ans.items()))}')
for w in warns: print('  ⚠️', w)
for e in errs[:40]: print('  ❌', e)
if len(errs) > 40: print(f'  … 외 {len(errs) - 40}건')
print('✓ 통과' if not errs else f'✗ 실패 {len(errs)}건')
sys.exit(1 if errs else 0)
