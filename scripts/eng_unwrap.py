#!/usr/bin/env python3
"""영어 문제은행(public/gen-eng-*.json) 본문·해설의 «낱말마다 줄바꿈» 되돌리기.

PDF 양쪽 맞춤 줄에서 글자를 뽑을 때 한 줄이 낱말 하나씩 끊겨 들어온 곳
(한 낱말짜리 줄이 3개 이상 이어짐)을 원래 한 줄로 이어 붙인다.
(A)/(B)/(C)·㉠㉡㉢·①② 같은 표 머리·기호 줄, 숫자만 있는 표 칸은 건드리지 않는다.
파일 모양(한 줄 JSON / 줄바꿈 JSON)은 그대로 두고 바뀐 값만 바꿔 끼운다. AI·크레딧 0.

  python3 scripts/eng_unwrap.py public/gen-eng-*.json          # 고침
  python3 scripts/eng_unwrap.py --dry public/gen-eng-*.json    # 세기만
"""
import json, re, sys

MARK = re.compile(r'^(\(?[A-Ea-e]\)|[㉠-㉭ⓐ-ⓩ①-⑳]|[→←↓↑]|\d{1,2}[.)])$')
WORD = re.compile(r'[A-Za-z가-힣]{2,}')


def unwrap(s: str) -> str:
    L = s.split('\n')
    out, i = [], 0
    while i < len(L):
        j = i
        while (j < len(L) and L[j].strip() and len(L[j].split()) == 1
               and not MARK.match(L[j].strip())):
            j += 1
        run = [x.strip() for x in L[i:j]]
        if len(run) >= 3 and sum(1 for t in run if WORD.search(t)) * 2 >= len(run):
            out.append(' '.join(run))
            i = j
        else:
            out.append(L[i])
            i += 1
    return '\n'.join(out)


def enc(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def main(argv):
    dry = '--dry' in argv
    files = [a for a in argv if not a.startswith('--')]
    tot_items = tot_fields = 0
    for f in files:
        raw = open(f, encoding='utf-8').read()
        data = json.loads(raw)
        items = data if isinstance(data, list) else []
        changed = 0
        for p in items:
            hit = False
            for k in ('body', 'solution'):
                v = p.get(k)
                if not isinstance(v, str):
                    continue
                nv = unwrap(v)
                if nv == v:
                    continue
                old, new = enc(v), enc(nv)
                if old not in raw and new not in raw:  # 같은 본문이 두 번이면 앞에서 이미 바뀜
                    sys.exit(f'{f}: 원문 그대로 못 찾음 {p.get("id")} {k}')
                raw = raw.replace(old, new)
                p[k] = nv
                tot_fields += 1
                hit = True
            changed += hit
        if changed and not dry:
            assert json.loads(raw) == data, f
            open(f, 'w', encoding='utf-8').write(raw)
        if changed:
            print(f'{f}\t문항 {changed}/{len(items)}')
        tot_items += changed
    print(f'합계 문항 {tot_items} · 칸 {tot_fields}' + (' (세기만)' if dry else ''))


if __name__ == '__main__':
    main(sys.argv[1:])
