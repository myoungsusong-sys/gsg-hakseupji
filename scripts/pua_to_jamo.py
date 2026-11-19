#!/usr/bin/env python3
"""옛한글 «한양 PUA»(U+E000~F8FF) → 표준 옛한글 자모. 앱 글꼴 YetHangul 은 표준 자모만 그린다(PUA 는 ☒).
쓰는 법: python3 scripts/pua_to_jamo.py [--check] <과정…>   예: exam2-kor-h12-bis exam-kor2-fill   (pip install hypua2jamo)
대상: public/gen-<과정>.json · _gen/<과정>/*.json — 글자만 바꾸고 JSON 꼴·줄바꿈은 그대로 둔다.
변환 뒤에도 PUA 가 남는 파일은 «한양 PUA 가 아닌 다른 깨짐»이 섞인 것이라 손대지 않는다(ns-kr-h-lit-b2~b5 등, 2026-11-19 실측)."""
import glob, json, re, site, sys
sys.path.append(site.getusersitepackages())
from hypua2jamo import translate
PUA = re.compile('[-]')
check = '--check' in sys.argv
tot = left = 0
courses = [a for a in sys.argv[1:] if not a.startswith('--')]
files = []
for c in courses:
    files += glob.glob(f'public/gen-{c}.json') + glob.glob(f'_gen/{c}/*.json')
for f in sorted(files):
    s = open(f, encoding='utf-8').read()
    n = len(PUA.findall(s))
    if not n:
        continue
    t = translate(s)
    json.loads(t)
    r = len(PUA.findall(t))
    tot += n; left += r
    print(f'{f}: PUA {n} → 남음 {r}')
    if r:
        print('  ↳ 남는 PUA 가 있어 건너뜀'); continue
    if not check:
        open(f, 'w', encoding='utf-8').write(t)
print(f'합계 PUA {tot} · 변환 뒤 남음 {left}')
sys.exit(1 if (check and tot) else 0)
