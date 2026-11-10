# 기출 회차 빌드 (workerE 11/10) — EBSi 수학 PDF → public/gichul/<id>/q*.jpg·s*.jpg·probs/q<no>.jpg + probs.json + index.json
# 사용: python3 gichul_build.py <PDF 뿌리> <public/gichul> [--years 2006-2023] [--light] [--skip-existing]
#   <PDF 뿌리>/<고1|고2|고3_N수>/<연도>/(_PDF/)?*.pdf — 드라이브 «EBSi_기출/<학년>/수학» 그대로
#   index.json 은 합친다: 이번에 만든 회차만 바꾸고 나머지(다른 연도·과학)는 그대로 둔다
#   --light : 옛 회차용 가벼운 그림(쪽 폭 1000·품질 60, 문항 자르기 배율 1.6·품질 70) — 배포 무게를 줄인다
import argparse, json, os, re, unicodedata
import fitz
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('--years', default='')
ap.add_argument('--light', action='store_true')
ap.add_argument('--skip-existing', action='store_true')
A = ap.parse_args()
SRC, OUT = A.src, A.out
Y0, Y1 = (map(int, A.years.split('-')) if A.years else (0, 9999))
PAGE_W, PAGE_Q = (1000, 60) if A.light else (1100, 70)     # 쪽 그림 폭(px)·품질
CROP_ZOOM, CROP_Q = (1.6, 70) if A.light else (1.8, 75)    # 문항 자르기 배율·품질
GR = {'고1': 'g1', '고2': 'g2', '고3_N수': 'g3'}
SUBJ = {'미적분': ('미적분', 'calc'), '확률과_통계': ('확률과통계', 'stat'), '기하': ('기하', 'geo'), '수학': (None, 'math'),
        # 옛 교육과정 (2006~2023) — 수리 가/나형(~2011) · 수학 가/나형(2012~13, 2017~21) · 수학 A/B(2014~16)
        '수리가형': ('수리 가형', 'sga'), '수리나형': ('수리 나형', 'sna'),
        '수학가형-이산수학': ('수리 가형 · 이산수학', 'sgadm'), '수학가형-확률과통계': ('수리 가형 · 확률과통계', 'sgast'),
        '수학가형': ('수학 가형', 'ga'), '수학나형': ('수학 나형', 'na'), '수학A': ('수학 A형', 'ma'), '수학B': ('수학 B형', 'mb'),
        # 과학탐구 (workerE 11/10) — area='과학' 으로 표시해 헤더 과목이 과학일 때만 보인다
        '물리학Ⅰ': ('물리학Ⅰ', 'phy1'), '화학Ⅰ': ('화학Ⅰ', 'chem1'), '생명과학Ⅰ': ('생명과학Ⅰ', 'bio1'), '지구과학Ⅰ': ('지구과학Ⅰ', 'earth1'), '통합과학': ('통합과학', 'int')}
SCI = {'phy1', 'chem1', 'bio1', 'earth1', 'int'}

# 파일 이름이 해마다 조금씩 다르다: «2010_3월_학력평가(서울)» · «2014_고1_3월_학평_(서울)» · «2013_2013_고1_…» · «4.24_시행_수학»
pat_mock = re.compile(r'^(\d{4})_(?:\d{4}_)?(?:고\d_)?(\d{1,2})월_(?:학평|모평|학력평가|모의평가)_?\((.+?)\)_(.+)_(문제|해설)\.pdf$')
pat_csat = re.compile(r'^(\d{4})_(\d{4})학년도_대학수학능력시험_(.+?)(?:_홀수형)?_(문제|해설)\.pdf$')
pat_pre = re.compile(r'^(\d{4})_(\d{4})_수능_예비시행\((.+?)\)_(.+)_(문제|해설)\.pdf$')
pat_date = re.compile(r'^\d{1,2}\.\d{1,2}_시행_')   # 2020 코로나로 미뤄진 시험의 «4.24_시행_» 머리

papers = {}
for g in GR:
    gdir = os.path.join(SRC, g)
    if not os.path.isdir(gdir): continue
    for y in sorted(os.listdir(gdir)):
        if not y.isdigit() or not Y0 <= int(y) <= Y1: continue
        files = []
        for root, _, fs in os.walk(os.path.join(gdir, y)):
            files += [(root, f) for f in fs]
        for root, f in sorted(files):
            path, f = os.path.join(root, f), unicodedata.normalize('NFC', f)
            if '짝수형' in f: continue
            m = pat_mock.match(f)
            if m:
                year, month, region, subj, part = m.groups()
            elif (m := pat_csat.match(f)):
                year, csat, subj, part = m.groups()
                month, region, year = '수능', '평가원', str(int(csat) - 1)
            elif (m := pat_pre.match(f)):
                _, csat, region, subj, part = m.groups()
                month, year = '예비', str(int(csat) - 1)   # 화면은 연도+1 을 학년도로 쓴다
            else:
                continue
            subj = pat_date.sub('', subj)
            if subj not in SUBJ: continue
            sname, scode = SUBJ[subj]
            mtag = {'수능': 'csat', '예비': 'pre'}.get(month) or f'{int(month):02d}'
            pid = f'{GR[g]}-{year}-{mtag}-{scode}'
            p = papers.setdefault(pid, {'id': pid, 'grade': '고3' if g == '고3_N수' else g, 'year': year, 'month': str(int(month)) if month.isdigit() else month,
                                        'region': region, **({'subject': sname} if sname else {}),
                                        'problemPdf': '', 'solutionPdf': None, 'qPages': 0, 'sPages': 0, 'ext': 'jpg',
                                        **({'area': '과학'} if scode in SCI else {})})
            p['problemPdf' if part == '문제' else 'solutionPdf'] = path

def render_pages(pdf, outdir, prefix):
    d = fitz.open(pdf)
    for i, pg in enumerate(d):
        z = PAGE_W / pg.rect.width
        pg.get_pixmap(matrix=fitz.Matrix(z, z)).save(os.path.join(outdir, f'{prefix}{i + 1}.jpg'), jpg_quality=PAGE_Q)
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
        im.save(os.path.join(outdir, 'probs', f'q{no}.jpg'), quality=CROP_Q)
        out.append({'no': no, 'img': f'/gichul/{pid}/probs/q{no}.jpg'})
    return out

ipath = os.path.join(OUT, 'index.json')
index = {p['id']: p for p in (json.load(open(ipath)) if os.path.exists(ipath) else [])}
built = 0
for pid, p in sorted(papers.items()):
    if not p['problemPdf']: continue
    if A.skip_existing and pid in index and os.path.exists(os.path.join(OUT, pid, 'probs.json')): continue
    od = os.path.join(OUT, pid); os.makedirs(od, exist_ok=True)
    try:
        p['qPages'] = render_pages(p['problemPdf'], od, 'q')
        if p['solutionPdf']: p['sPages'] = render_pages(p['solutionPdf'], od, 's')
        probs = crop_problems(p['problemPdf'], od, pid)
    except Exception as e:                             # 깨진 PDF 한 개 때문에 전체가 멈추지 않게
        print('건너뜀', pid, e, flush=True); continue
    json.dump(probs, open(os.path.join(od, 'probs.json'), 'w'), ensure_ascii=False)
    p['problemPdf'] = unicodedata.normalize('NFC', os.path.basename(p['problemPdf']))
    p['solutionPdf'] = p['solutionPdf'] and unicodedata.normalize('NFC', os.path.basename(p['solutionPdf']))
    index[pid] = p; built += 1
    print(pid, p['qPages'], p['sPages'], len(probs), flush=True)
out = sorted(index.values(), key=lambda p: (p['year'], p['month'] in ('수능', '예비'), p['month'].zfill(2), p['grade']), reverse=True)
json.dump(out, open(ipath, 'w'), ensure_ascii=False, indent=0)
print('이번', built, '· 회차', len(out))
