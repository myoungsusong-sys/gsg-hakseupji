# 영어 기출 문항 유형 추천 (mbp 11/10) — AI·크레딧 0
# 수능·학평 영어는 발문이 정해진 틀(«글의 목적으로…» «어법상 틀린 것은?» …)이라 발문 낱말로 유형이 거의 하나로 정해진다.
# 붙는 트리: 고1·고2·고3 영어(eng-h1/h2/h3, curriculum-engkor.ts ENG_SECTIONS) — gen-eng-h* 문제은행과 같은 유형이라 쌍둥이 탭이 그대로 이어진다.
# 듣기(1~17번)는 트리에 듣기 유형이 없어 추천을 비운다(열람·인쇄만).
# 사용: python3 gichul_engtag.py <PDF 뿌리(gichul_build.py 와 같은)> <public/gichul>
import json, os, re, sys, unicodedata
import fitz
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gichul_marks import find_marks, mark_rect

SRC, OUT = sys.argv[1], sys.argv[2]

# (발문에 있어야 할 낱말들, 유형 꼬리) — 위에서부터 먼저 맞는 것
RULES = [
    (['요약'], 'u0m0s4t0'),
    (['안내문'], 'u0m1s4t1'), (['도표'], 'u0m1s4t1'),
    (['목적'], 'u0m0s3t0'),
    (['심경'], 'u0m0s5t0'), (['분위기'], 'u0m0s5t1'),
    (['주장'], 'u0m0s2t1'), (['요지'], 'u0m0s2t0'),
    (['주제'], 'u0m0s0t0'), (['제목'], 'u0m0s1t0'),
    (['어법', '틀린'], 'u1m0s1t0'), (['어법'], 'u1m0s0t0'),
    (['낱말의 쓰임'], 'u1m1s0t0'), (['낱말', '네모'], 'u1m1s0t1'),
    (['가리키는 대상'], 'u0m3s2t0'),
    (['의미'], 'u0m3s1t1'), (['뜻하는'], 'u0m3s1t1'),
    (['관계 없는'], 'u0m2s0t0'), (['들어가기'], 'u0m2s1t0'), (['순서'], 'u0m2s2t0'),
    (['빈칸', '(A)'], 'u0m3s0t2'), (['빈칸'], 'u0m3s0t1'),
    (['일치하지 않는'], 'u0m1s1t0'), (['일치하는'], 'u0m1s0t0'),
    (['내용으로', '않은'], 'u0m1s1t0'), (['내용으로', '적절한'], 'u0m1s0t0'),   # 장문 «윗글에 관한 내용으로 적절하지 않은 것은?»
]
grp_re = re.compile(r'^\[\s*(\d+)\s*[～~∼\-]\s*(\d+)\s*\]')
COURSE = {'고1': 'eng-h1', '고2': 'eng-h2', '고3': 'eng-h3'}

def classify(stem):
    s = re.sub(r'\s+', ' ', stem)
    for words, tail in RULES:
        if all(w in s for w in words): return tail
    return None

def find_pdf(name):
    for root, _, fs in os.walk(SRC):
        for f in fs:
            g = re.sub(r' \(\d+\)\.pdf$', '.pdf', unicodedata.normalize('NFC', f))
            if g == name: return os.path.join(root, f)

index = json.load(open(os.path.join(OUT, 'index.json')))
tot = tagged = 0
for p in index:
    if p.get('area') != '영어': continue
    pdf = find_pdf(p['problemPdf']); pj = os.path.join(OUT, p['id'], 'probs.json')
    if not pdf or not os.path.exists(pj): print('없음', p['id']); continue
    d = fitz.open(pdf); seq, left = find_marks(d)
    stems, heads = {}, {}
    for pg in d:                                   # [31～34] 다음 빈칸에… — 묶음 문항은 발문이 머리에만 있다
        for b in pg.get_text('blocks'):
            m = grp_re.match(b[4].strip())
            if m:
                for k in range(int(m.group(1)), int(m.group(2)) + 1): heads[k] = b[4]
    for i, (pn, col, y, no) in enumerate(seq):
        r = mark_rect(d, seq, left, i)
        stems[no] = d[pn].get_text('text', clip=fitz.Rect(r.x0, y - 2, r.x1, min(r.y1, y + 30)))
    probs = json.load(open(pj)); c = COURSE[p['grade']]; n = 0
    for q in probs:
        q.pop('tags', None)
        tail = (classify(stems.get(q['no'], '')) or classify(heads.get(q['no'], ''))) if q['no'] >= 18 else None
        if tail: q['tags'] = [{'t': f'{c}-{tail}', 'c': c, 's': 1.0}]; n += 1
    json.dump(probs, open(pj, 'w'), ensure_ascii=False)
    tot += len(probs); tagged += n
    print(p['id'], len(probs), n, flush=True)
print('문항', tot, '· 추천', tagged)
