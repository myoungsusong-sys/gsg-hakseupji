# 기출 회차 빌드 (workerE 11/10) — EBSi 수학 PDF → public/gichul/<id>/q*.jpg·s*.jpg·probs/q<no>.jpg + probs.json + index.json
# 사용: python3 gichul_build.py <PDF 뿌리> <public/gichul>
import json, os, re, sys
import fitz
import numpy as np
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
PAGE_W = 1100          # 쪽 그림 폭(px)
CROP_ZOOM = 1.8        # 문항 자르기 배율
GR = {'고1': 'g1', '고2': 'g2', '고3_N수': 'g3'}
SUBJ = {'미적분': ('미적분', 'calc'), '확률과_통계': ('확률과통계', 'stat'), '기하': ('기하', 'geo'), '수학': (None, 'math'),
        # 과학탐구 (workerE 11/10) — area='과학' 으로 표시해 헤더 과목이 과학일 때만 보인다
        '물리학Ⅰ': ('물리학Ⅰ', 'phy1'), '화학Ⅰ': ('화학Ⅰ', 'chem1'), '생명과학Ⅰ': ('생명과학Ⅰ', 'bio1'), '지구과학Ⅰ': ('지구과학Ⅰ', 'earth1'), '통합과학': ('통합과학', 'int')}
SCI = {'phy1', 'chem1', 'bio1', 'earth1', 'int'}

pat_mock = re.compile(r'^(\d{4})_고(\d)_(\d{1,2})월_(학평|모평)\((.+?)\)_(.+)_(문제|해설)\.pdf$')
pat_csat = re.compile(r'^(\d{4})_(\d{4})학년도_대학수학능력시험_(.+?)(?:_홀수형)?_(문제|해설)\.pdf$')

papers = {}
for g in GR:
    gdir = os.path.join(SRC, g)
    if not os.path.isdir(gdir): continue
    for y in sorted(os.listdir(gdir)):
        for f in sorted(os.listdir(os.path.join(gdir, y))):
            path = os.path.join(gdir, y, f)
            m = pat_mock.match(f)
            if m:
                year, _, mon, kind, region, subj, part = m.groups()
                month = mon
            else:
                m = pat_csat.match(f)
                if not m: continue
                year, _, subj, part = m.groups()
                month, region = '수능', '평가원'
            if subj not in SUBJ: continue
            sname, scode = SUBJ[subj]
            mtag = 'csat' if month == '수능' else f'{int(month):02d}'
            pid = f'{GR[g]}-{year}-{mtag}-{scode}'
            p = papers.setdefault(pid, {'id': pid, 'grade': '고3' if g == '고3_N수' else g, 'year': year, 'month': month,
                                        'region': region, **({'subject': sname} if sname else {}),
                                        'problemPdf': '', 'solutionPdf': None, 'qPages': 0, 'sPages': 0, 'ext': 'jpg',
                                        **({'area': '과학'} if scode in SCI else {})})
            p['problemPdf' if part == '문제' else 'solutionPdf'] = path

def render_pages(pdf, outdir, prefix):
    d = fitz.open(pdf)
    for i, pg in enumerate(d):
        z = PAGE_W / pg.rect.width
        pg.get_pixmap(matrix=fitz.Matrix(z, z)).save(os.path.join(outdir, f'{prefix}{i + 1}.jpg'), jpg_quality=70)
    return len(d)

num_re = re.compile(r'^(\d{1,2})\s*\.')
def crop_problems(pdf, outdir, pid):
    d = fitz.open(pdf)
    marks = []   # (page, col, y, no)
    for pg in d:
        W, H = pg.rect.width, pg.rect.height
        for b in pg.get_text('blocks'):
            m = num_re.match(b[4].strip())
            if not m: continue
            x0, y0 = b[0], b[1]
            if y0 < H * 0.08 or y0 > H * 0.9: continue
            col = 0 if x0 < W / 2 else 1
            left = W * 0.1 if col == 0 else W * 0.515
            if abs(x0 - left) > W * 0.03: continue
            marks.append((pg.number, col, y0, int(m.group(1))))
    # 번호는 차례로 커져야 한다 — 어긋난 것은 버림
    marks.sort(key=lambda t: (t[0], t[1], t[2]))
    seq, last = [], 0
    for t in marks:
        if t[3] == last + 1: seq.append(t); last = t[3]
    if len(seq) < 10: return []
    os.makedirs(os.path.join(outdir, 'probs'), exist_ok=True)
    out = []
    for i, (pn, col, y, no) in enumerate(seq):
        pg = d[pn]; W, H = pg.rect.width, pg.rect.height
        x0, x1 = (W * 0.08, W * 0.493) if col == 0 else (W * 0.507, W * 0.92)
        nxt = seq[i + 1] if i + 1 < len(seq) else None
        y1 = nxt[2] - 8 if nxt and nxt[0] == pn and nxt[1] == col else H * 0.9
        clip = fitz.Rect(x0, y - 8, x1, y1)
        pix = pg.get_pixmap(matrix=fitz.Matrix(CROP_ZOOM, CROP_ZOOM), clip=clip)
        im = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
        a = np.asarray(im.convert('L')) < 200          # 글자 있는 칸
        rows, cols = np.where(a.any(1))[0], np.where(a.any(0))[0]
        if len(rows):                                  # 아래·오른쪽 빈 곳 잘라냄(여백 20px)
            im = im.crop((0, 0, min(im.width, cols[-1] + 20), min(im.height, rows[-1] + 20)))
        im.save(os.path.join(outdir, 'probs', f'q{no}.jpg'), quality=75)
        out.append({'no': no, 'img': f'/gichul/{pid}/probs/q{no}.jpg'})
    return out

index = []
for pid, p in sorted(papers.items()):
    if not p['problemPdf']: continue
    od = os.path.join(OUT, pid); os.makedirs(od, exist_ok=True)
    p['qPages'] = render_pages(p['problemPdf'], od, 'q')
    if p['solutionPdf']: p['sPages'] = render_pages(p['solutionPdf'], od, 's')
    probs = crop_problems(p['problemPdf'], od, pid)
    json.dump(probs, open(os.path.join(od, 'probs.json'), 'w'), ensure_ascii=False)
    p['problemPdf'] = os.path.basename(p['problemPdf']); p['solutionPdf'] = p['solutionPdf'] and os.path.basename(p['solutionPdf'])
    index.append(p)
    print(pid, p['qPages'], p['sPages'], len(probs), flush=True)
index.sort(key=lambda p: (p['year'], p['month'] == '수능', p['month'].zfill(2), p['grade']), reverse=True)
json.dump(index, open(os.path.join(OUT, 'index.json'), 'w'), ensure_ascii=False, indent=0)
print('회차', len(index))
