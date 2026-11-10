# 기출 문항 유형 추천 (workerD 11/10) — AI·크레딧 0
# 문항 PDF 글자를 우리 유형 트리(유형·소단원·중단원 이름 + 같은 유형 생성 문항 본문)와 글자 조각 유사도로 견줘
# probs.json 각 문항에 tags=[{t:유형id, c:과정id, s:점수}] 상위 3개를 붙인다(과탐은 쌍둥이용 22개정 유형 tw 하나 더). GichulTag 가 첫 추천으로 미리 채우고,
# 선생님은 보고 고치기만 하면 된다(편입은 여전히 사람 손).
# 사용: python3 scripts/gichul_autotag.py <PDF 폴더(문제 PDF 가 아래 어디든)> public/gichul [trees.json] [--years 2006-2026] [--area 과학|수학]
#   trees.json 기본 = scripts/gichul_trees.json — 유형 트리가 바뀌면 scripts/gichul_trees_dump.sh 로 다시 뽑는다
import argparse, json, math, os, re, sys, unicodedata
from collections import Counter, defaultdict
import fitz
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gichul_marks import find_marks, mark_rect

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('trees', nargs='?', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gichul_trees.json'))
ap.add_argument('--years', default='')
ap.add_argument('--area', default='')
A = ap.parse_args()
Y0, Y1 = (map(int, A.years.split('-')) if A.years else (0, 9999))
TREES = json.load(open(A.trees))
PUB = os.path.dirname(os.path.abspath(A.out.rstrip('/')))   # public/

SCI_CUR = {'물리학Ⅰ': 'h15-phy1', '화학Ⅰ': 'h15-chem1', '생명과학Ⅰ': 'h15-bio1', '지구과학Ⅰ': 'h15-earth1', '통합과학': 'h-int1'}
# 쌍둥이용: 과탐Ⅰ 문항을 우리 문제은행이 있는 22개정 과학 트리에도 하나 붙인다(tw) — 2015 트리엔 문제은행 문항이 없다
TWIN_CUR = {'h15-phy1': ['h-phy'], 'h15-chem1': ['h-chem', 'h-chemrxn'], 'h15-bio1': ['h-bio', 'h-biogen'], 'h15-earth1': ['h-earth', 'h-earthsys']}
MID = ['m3-1', 'm3-2', 'm2-1', 'm2-2', 'm1-1', 'm1-2']   # 고1 3월 학평 = 중학 범위
ELECT = {'미적분': 'h-calc2', '기하': 'h-geo', '확률과통계': 'h-stat'}

def candidates(p, no):
    """이 문항을 견줄 과정들 — 과목·학년·번호로 정한다."""
    s = p.get('subject') or ''
    if s in SCI_CUR: return [SCI_CUR[s]]
    m = int(p['month']) if p['month'].isdigit() else 12
    if p['grade'] == '고1':   # 3월 = 중학 전 범위(중1~중3 트리, mbp 11/10) · 6·9월 = 공통수학1 · 10·11월 = 공통수학1·2
        return MID if m <= 3 else ['h-cm1'] if m <= 9 else ['h-cm1', 'h-cm2']
    if p['grade'] == '고2':   # 3월 = 고1 범위
        return ['h-cm1', 'h-cm2'] if m <= 3 else ['h-alg', 'h-calc1', 'h-stat']
    if s in ELECT: return ['h-alg', 'h-calc1'] if no <= 22 else [ELECT[s]]   # 2022학년도~ 공통 1~22 · 선택 23~30
    return ['h-alg', 'h-calc1', 'h-calc2', 'h-stat', 'h-geo']                # 옛 고3 (가/나형·A/B형)

# ── 글자 조각 ──
hangul = re.compile(r'[가-힣]+')
latin = re.compile(r'[A-Za-z]{2,}|[∫∑√πθ∞]|lim|log|sin|cos|tan')
STOP = set('그림 다음 것은 고른 대한 옳은 있는 대로 보기 이다 이고 같이 하는 에서 으로 이때 값은 값을 구하시오 단 다 점 의 은 는 이 가 을 를 에 와 과'.split())
def toks(text):
    text = unicodedata.normalize('NFC', text)
    out = []
    for w in hangul.findall(text):
        if w in STOP: continue
        out += [w[i:i + 2] for i in range(len(w) - 1)] or [w]
    out += [m.lower() for m in latin.findall(re.sub(r'\\[a-z]+', lambda m: ' ' + m.group(0)[1:] + ' ', text))]
    return out

# ── 유형 문서 ──
gen_body = defaultdict(list)
for f in os.listdir(PUB):
    if (f.startswith('gen-h-') or re.match(r'gen-m\d', f)) and f.endswith('.json'):   # 중학 문항 본문도(고1 3월용)
        try: arr = json.load(open(os.path.join(PUB, f)))
        except Exception: continue
        if isinstance(arr, list):
            for q in arr:
                if isinstance(q, dict) and q.get('typeId') and q.get('body'): gen_body[str(q['typeId'])].append(q['body'])

docs = {}   # (cur, typeId) -> Counter
for cur, tr in TREES.items():
    for t in tr['types']:
        c = Counter()
        for w, k in ((t['name'], 4), (t['sub'], 2), (t['mid'], 1), (t['unit'], 1)):
            for x in toks(w): c[x] += k
        for b in gen_body.get(str(t['id']), [])[:30]:
            for x in toks(b): c[x] += 0.3
        docs[(cur, str(t['id']))] = c
df = Counter()
for c in docs.values(): df.update(set(c))
N = len(docs)
idf = {w: math.log((N + 1) / (n + 1)) + 1 for w, n in df.items()}
def vec(c):
    v = {w: (1 + math.log(n)) * idf.get(w, 0) for w, n in c.items() if n > 0 and w in idf}
    z = math.sqrt(sum(x * x for x in v.values())) or 1
    return {w: x / z for w, x in v.items()}
dvec = {k: vec(c) for k, c in docs.items()}
by_cur = defaultdict(list)
for (cur, tid), v in dvec.items(): by_cur[cur].append((tid, v))

MIN_S = 0.1   # 이보다 낮으면 글자가 거의 안 겹친 것 — 추천하지 않는다
def suggest(text, curs, k=3):
    q = vec(Counter(toks(text)))
    if not q: return []
    sc = []
    for cur in curs:
        for tid, v in by_cur.get(cur, []):
            s = sum(x * v.get(w, 0) for w, x in q.items())
            if s > 0: sc.append((s, tid, cur))
    sc.sort(reverse=True)
    return [{'t': tid, 'c': cur, 's': round(s, 3)} for s, tid, cur in sc[:k] if s >= MIN_S]

# ── PDF 찾기: gichul_build 와 같은 이름 → index.json 의 problemPdf 로 ──
pdfs = {}
for root, _, fs in os.walk(A.src, followlinks=True):
    for f in fs: pdfs[unicodedata.normalize('NFC', f)] = os.path.join(root, f)

index = json.load(open(os.path.join(A.out, 'index.json')))
done = tagged = 0
for p in index:
    if not Y0 <= int(p['year']) <= Y1: continue
    if A.area and (p.get('area') or '수학') != A.area: continue
    pj = os.path.join(A.out, p['id'], 'probs.json')
    if not os.path.exists(pj): continue
    probs = json.load(open(pj))
    if not probs or p['problemPdf'] not in pdfs: continue
    d = fitz.open(pdfs[p['problemPdf']])
    seq, left = find_marks(d)
    rect = {no: (pn, i) for i, (pn, c, y, no) in enumerate(seq)}
    for pr in probs:
        if pr['no'] not in rect: continue
        pn, i = rect[pr['no']]
        text = d[pn].get_text('text', clip=mark_rect(d, seq, left, i))
        pr.pop('tags', None); pr.pop('tw', None)   # 다시 돌릴 때 옛 추천을 지운다
        curs = candidates(p, pr['no'])
        tg = suggest(text, curs)
        if tg: pr['tags'] = tg; tagged += 1
        tw = suggest(text, TWIN_CUR.get(curs[0], []), 1) if curs else []
        if tw: pr['tw'] = tw[0]
    json.dump(probs, open(pj, 'w'), ensure_ascii=False)
    done += 1
print('회차', done, '· 추천 붙인 문항', tagged)
