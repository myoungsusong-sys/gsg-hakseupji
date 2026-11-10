# 경찰대·사관학교 기출·쌍둥이 회차 빌드 (workerE 11/11) — AI·크레딧 0
# 드라이브 «08_강의제작_AI/명수쌤의 문제은행/기출_경찰대·사관학교»(원본 14개)·«기출_경찰대사관학교쌍둥이»(쌍둥이 15개) PDF
#   → public/gichul/<id>/q*.jpg(문제 쪽)·s*.jpg(빠른정답+해설 쪽)·probs/q<no>.jpg + probs.json + index.json(합침)
# PDF 틀: 문제 쪽(쪽마다 두 단, «01» 번호 글자 + 문항 그림 한 장) → «빠른정답» 쪽 → 해설 쪽 → 맨 끝 답안지(뺌)
# id: pol-<연도>-police · pol-<연도>-army-calc · pol-<연도>-army-stat (쌍둥이는 poltw-…) · index 항목 kind = police | policeTwin
# 사용: python3 scripts/police_build.py <원본 폴더> <쌍둥이 폴더> <public/gichul>
#   그 뒤 유형 추천: 문항 그림 OCR(scripts/gichul_ocr.swift) → gichul_autotag.py --ocr (올리는법 참고)
import json, os, re, sys, unicodedata
import fitz

PAGE_W, PAGE_Q = 1100, 70      # 쪽 그림 폭(px)·품질 — gichul_build 와 같게
CROP_ZOOM, CROP_Q = 2.6, 75    # 문항 그림이 단 폭(207pt)이라 기출보다 크게 뜬다 → 약 540px

def meta(name, twin):
    name = unicodedata.normalize('NFC', name)
    m = re.match(r'(\d{4})년 (경찰대학|사관학교)(?: - (미적분|확률과 통계))?', name)
    if not m: return None
    year, school, subj = m.groups()
    subj = (subj or '').replace(' ', '')
    key = 'police' if school == '경찰대학' else 'army-calc' if subj == '미적분' else 'army-stat'
    return {
        'id': f"{'poltw' if twin else 'pol'}-{year}-{key}", 'grade': '고3', 'year': year,
        'month': '경찰대' if school == '경찰대학' else '사관', 'region': school,
        **({'subject': subj} if subj else {}),
        'problemPdf': name, 'kind': 'policeTwin' if twin else 'police', 'ext': 'jpg',
    }

def num_blocks(pg):
    """문항 번호 글자(«01», 굵고 큼) — 왼쪽 단 x≈42 · 오른쪽 단 x≈314"""
    out = []
    for b in pg.get_text('dict')['blocks']:
        if b['type'] != 0: continue
        t = ''.join(s['text'] for l in b['lines'] for s in l['spans']).strip()
        size = max(s['size'] for l in b['lines'] for s in l['spans'])
        if re.fullmatch(r'\d{2}', t) and size > 14: out.append((int(t), fitz.Rect(b['bbox'])))
    return out

def render(pg, path):
    z = PAGE_W / pg.rect.width
    pg.get_pixmap(matrix=fitz.Matrix(z, z)).save(path, jpg_quality=PAGE_Q)

def build(pdf, p, out):
    d = fitz.open(pdf)
    ans = next((i for i in range(d.page_count) if '빠른정답' in d[i].get_text()), None)
    if ans is None: print('  빠른정답 쪽 없음 — 건너뜀', pdf); return None
    last = d.page_count - 1   # 맨 끝은 답안지(번호 줄 + 동그라미) — 뺀다
    sol_end = last if len(num_blocks(d[last])) == 0 and '정답' not in d[last].get_text() else last + 1
    od = os.path.join(out, p['id']); os.makedirs(os.path.join(od, 'probs'), exist_ok=True)
    for i in range(ans): render(d[i], os.path.join(od, f'q{i + 1}.jpg'))
    for k, i in enumerate(range(ans, sol_end)): render(d[i], os.path.join(od, f's{k + 1}.jpg'))
    probs = []
    for pn in range(ans):
        pg = d[pn]
        imgs = [fitz.Rect(x['bbox']) for x in pg.get_image_info() if x['bbox'][1] > 90 or pn > 0]
        for no, r in num_blocks(pg):
            im = next((b for b in imgs if 0 <= b.x0 - r.x1 < 25 and abs(b.y0 - r.y0) < 15), None)
            if im is None: print('  그림 못 찾음', p['id'], no); continue
            clip = fitz.Rect(r.x0 - 4, min(r.y0, im.y0) - 4, im.x1 + 4, im.y1 + 4)
            pg.get_pixmap(matrix=fitz.Matrix(CROP_ZOOM, CROP_ZOOM), clip=clip).save(
                os.path.join(od, 'probs', f'q{no}.jpg'), jpg_quality=CROP_Q)
            probs.append({'no': no, 'img': f"/gichul/{p['id']}/probs/q{no}.jpg", 'page': pn + 1})
    probs.sort(key=lambda x: x['no'])
    json.dump(probs, open(os.path.join(od, 'probs.json'), 'w'), ensure_ascii=False)
    p.update(qPages=ans, sPages=sol_end - ans, solutionPdf=None)
    return probs

def main():
    orig, twin, out = sys.argv[1:4]
    ipath = os.path.join(out, 'index.json')
    index = {p['id']: p for p in json.load(open(ipath))}
    for src, tw in ((orig, False), (twin, True)):
        for root, _, fs in os.walk(src):
            for f in sorted(fs):
                if not f.lower().endswith('.pdf'): continue
                p = meta(f, tw)
                if not p: print('  이름 못 읽음', f); continue
                probs = build(os.path.join(root, f), p, out)
                if probs is None: continue
                index[p['id']] = p
                print(p['id'], '문제', p['qPages'], '쪽 · 해설', p['sPages'], '쪽 · 문항', len(probs))
    json.dump(list(index.values()), open(ipath, 'w'), ensure_ascii=False, indent=0)   # gichul_build 와 같은 꼴

main()
