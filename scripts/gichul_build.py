# 기출 회차 빌드 (workerE 11/10) — EBSi 수학 PDF → public/gichul/<id>/q*.jpg·s*.jpg·probs/q<no>.jpg + probs.json + index.json
# 과탐 옛 회차(workerD 11/10): <뿌리>/고3_N수 → «EBSi_기출/고3_N수/과학탐구» 를 가리키게 두고 --years 2006-2024 --light
# 사용: python3 gichul_build.py <PDF 뿌리> <public/gichul> [--years 2006-2023] [--light] [--skip-existing]
#   <PDF 뿌리>/<고1|고2|고3_N수>/<연도>/(_PDF/)?*.pdf — 드라이브 «EBSi_기출/<학년>/수학» 그대로
#   index.json 은 합친다: 이번에 만든 회차만 바꾸고 나머지(다른 연도·과학)는 그대로 둔다
#   --light : 옛 회차용 가벼운 그림(쪽 폭 1000·품질 60, 문항 자르기 배율 1.6·품질 70) — 배포 무게를 줄인다
import argparse, json, os, re, unicodedata
import fitz
import numpy as np
from PIL import Image
import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gichul_marks import find_marks, mark_rect

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('--years', default='')
ap.add_argument('--light', action='store_true')
ap.add_argument('--skip-existing', action='store_true')
ap.add_argument('--only', default='')                     # 회차 id 쉼표 목록만 (imac 11/10)
ap.add_argument('--crops-only', action='store_true')      # 쪽 그림은 두고 문항 자르기만 다시 — 이미 붙은 tags·tw 는 번호로 이어 붙인다
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
        # 과학탐구 (workerE 11/10) — 2019년 시행까지 파일 이름은 «물리Ⅰ», 과목 버튼은 «물리학Ⅰ» 하나로(workerD 11/10) — area='과학' 으로 표시해 헤더 과목이 과학일 때만 보인다
        '물리학Ⅰ': ('물리학Ⅰ', 'phy1'), '물리Ⅰ': ('물리학Ⅰ', 'phy1'), '화학Ⅰ': ('화학Ⅰ', 'chem1'), '생명과학Ⅰ': ('생명과학Ⅰ', 'bio1'), '지구과학Ⅰ': ('지구과학Ⅰ', 'earth1'), '통합과학': ('통합과학', 'int'),
        # 영어 (mbp 11/10) — area='영어' : 헤더 과목이 영어일 때만 보인다. 과목 버튼은 없음(영어 하나)
        '영어': (None, 'eng')}
SCI = {'phy1', 'chem1', 'bio1', 'earth1', 'int'}
AREA = {**{c: '과학' for c in SCI}, 'eng': '영어'}

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
            f = re.sub(r' \(\d+\)\.pdf$', '.pdf', f)   # 드라이브가 붙인 «문제 (1).pdf» — 영어는 이것만 있는 회차도 있다 (mbp 11/10)
            if '짝수형' in f: continue
            if os.path.getsize(path) == 0: continue   # 드라이브 원본이 0바이트인 것(2007·2009 과탐 62개) — 없는 셈 친다
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
                                        **({'area': AREA[scode]} if scode in AREA else {})})
            p['problemPdf' if part == '문제' else 'solutionPdf'] = path

def render_pages(pdf, outdir, prefix):
    d = fitz.open(pdf)
    for i, pg in enumerate(d):
        z = PAGE_W / pg.rect.width
        pg.get_pixmap(matrix=fitz.Matrix(z, z)).save(os.path.join(outdir, f'{prefix}{i + 1}.jpg'), jpg_quality=PAGE_Q)
    return len(d)

# 영어 묶음 지문 (mbp 11/10) — «[41～42] 다음 글을 읽고, 물음에 답하시오.» 아래 지문을 41·42 문항 그림 위에 붙인다
#   (안 붙이면 41 은 «윗글의 제목…» 선택지만 남는다). 지문은 머리부터 그 묶음 첫 문항 번호 위까지, 단을 넘기면 두 조각.
grp_re = re.compile(r'^\[\s*(\d+)\s*[～~∼\-]\s*(\d+)\s*\]')

def find_groups(d):
    gs = []
    for pg in d:
        W, H = pg.rect.width, pg.rect.height
        for b in pg.get_text('blocks'):
            t = b[4].strip(); m = grp_re.match(t)
            if m and '읽고' in t[:40]: gs.append((pg.number, 0 if b[0] < W * 0.45 else 1, b[1], int(m.group(1)), int(m.group(2))))
    return gs

def col_x(pg, left, col):
    W = pg.rect.width
    return (W * (left[0] - 0.02), W * min(0.493, left[1] - 0.012)) if col == 0 else (W * (left[1] - 0.008), W * (1.02 - left[0]))

def passage_clips(d, left, g, first):
    """묶음 머리 g 부터 첫 문항 표시 first(쪽, 단, y, 번호) 위까지의 [(쪽, Rect)]."""
    pn, col, y, _, _ = g
    fpn, fcol, fy, _ = first
    H = d[pn].rect.height
    if (pn, col) == (fpn, fcol): return [(pn, fitz.Rect(*col_x(d[pn], left, col)[:1], y - 6, col_x(d[pn], left, col)[1], fy - 8))]
    x0, x1 = col_x(d[pn], left, col); fx0, fx1 = col_x(d[fpn], left, fcol)
    # 단 바닥·꼭대기는 그 단 글자 덩어리로 — 쪽 번호 상자·머리줄(«8 홀수형»)은 빼고
    bot = max([b[3] for b in d[pn].get_text('blocks') if b[1] >= y and b[0] >= x0 - 2 and b[2] <= x1 + 2 and b[3] < H * 0.9], default=H * 0.9)
    top = min([b[1] for b in d[fpn].get_text('blocks') if H * 0.1 < b[1] < fy and b[0] >= fx0 - 2 and b[2] <= fx1 + 2], default=fy)
    for r in (dr['rect'] for dr in d[pn].get_drawings()):            # 지문 상자 테두리(선)도
        if r.y0 >= y and r.y1 < H * 0.9 and r.x0 >= x0 - 2 and r.x1 <= x1 + 2: bot = max(bot, r.y1)
    for r in (dr['rect'] for dr in d[fpn].get_drawings()):
        if H * 0.1 < r.y0 < fy and r.x0 >= fx0 - 2 and r.x1 <= fx1 + 2: top = min(top, r.y0)
    return [(pn, fitz.Rect(x0, y - 6, x1, bot + 6)), (fpn, fitz.Rect(fx0, top - 6, fx1, fy - 8))]

def crop_problems(pdf, outdir, pid):
    d = fitz.open(pdf)
    seq, left = find_marks(d)
    if len(seq) < 10: return []
    groups = find_groups(d)
    os.makedirs(os.path.join(outdir, 'probs'), exist_ok=True)
    out = []
    for i, (pn, col, y, no) in enumerate(seq):
        pg = d[pn]
        clip = mark_rect(d, seq, left, i)
        for g in groups:                               # 단 끝 문항이 다음 묶음 머리·지문까지 먹지 않게
            if (g[0], g[1]) == (pn, col) and y < g[2] < clip.y1: clip.y1 = g[2] - 6
        clips = []
        g = next((g for g in groups if g[3] <= no <= g[4]), None)
        first = next((t for t in seq if g and t[3] == g[3]), None)
        if g and first: clips = [c for c in passage_clips(d, left, g, first) if c[1].height > 10]
        parts = []
        for cpn, c in clips + [(pn, clip)]:
            pix = d[cpn].get_pixmap(matrix=fitz.Matrix(CROP_ZOOM, CROP_ZOOM), clip=c)
            parts.append(Image.frombytes('RGB', (pix.width, pix.height), pix.samples))
        im = parts[0] if len(parts) == 1 else Image.new('RGB', (max(p.width for p in parts), sum(p.height for p in parts)), 'white')
        if len(parts) > 1:
            yy = 0
            for p_ in parts: im.paste(p_, (0, yy)); yy += p_.height
        a = np.asarray(im.convert('L')) < 200          # 글자 있는 칸
        rows = np.where(a.any(1))[0]
        if len(rows) > 1:                              # 긴 빈칸(200px+) 뒤 작은 조각(쪽 번호 상자 등 40줄 미만)은 떼어 냄 (imac 11/10)
            gaps = np.where(np.diff(rows) > 200)[0]
            if len(gaps) and len(rows) - gaps[-1] - 1 < 40:
                a = a[:rows[gaps[-1]] + 1]
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
    if A.only and pid not in A.only.split(','): continue
    od = os.path.join(OUT, pid); os.makedirs(od, exist_ok=True)
    try:
        if A.crops_only and pid in index:
            p['qPages'], p['sPages'] = index[pid]['qPages'], index[pid]['sPages']
            p['solutionPdf'] = p['solutionPdf'] or index[pid].get('solutionPdf')   # 문제 PDF 만 받아 와도 해설 이름은 그대로
            old = {q['no']: q for q in json.load(open(os.path.join(od, 'probs.json')))} if os.path.exists(os.path.join(od, 'probs.json')) else {}
        else:
            old = {}
            p['qPages'] = render_pages(p['problemPdf'], od, 'q')
            if p['solutionPdf']: p['sPages'] = render_pages(p['solutionPdf'], od, 's')
        probs = crop_problems(p['problemPdf'], od, pid)
        for q in probs: q.update({k: v for k, v in old.get(q['no'], {}).items() if k not in q})
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
