# 기출 문항 번호 찾기 — gichul_build.py(자르기)·gichul_autotag.py(유형 추천)가 함께 쓴다 (workerD 11/10)
import re
import fitz

num_re = re.compile(r'^(\d{1,2})\s*\.')

def find_marks(d):
    """PDF 에서 문항 머리(«N.»)를 찾아 [(쪽, 단, y, 번호)] 와 단 왼쪽 끝 비율 {0: x, 1: x} 를 돌려준다."""
    cand = []   # (page, col, x, y, no)
    for pg in d:
        W, H = pg.rect.width, pg.rect.height
        for b in pg.get_text('blocks'):
            m = num_re.match(b[4].strip())
            if not m: continue
            x0, y0 = b[0], b[1]
            if y0 < H * 0.08 or y0 > H * 0.9: continue
            cand.append((pg.number, 0 if x0 < W * 0.45 else 1, x0 / W, y0, int(m.group(1))))   # 과탐 오른쪽 단은 0.49 에서 시작
    # 단 왼쪽 끝은 판형마다 다르다(수학 약 0.10, 과탐 약 0.07·0.52) — 단마다 가장 흔한 x 를 기준으로
    left = {}
    for c in (0, 1):
        xs = [round(t[2], 2) for t in cand if t[1] == c]
        left[c] = max(set(xs), key=xs.count) if xs else (0.1 if c == 0 else 0.515)
    marks = [(pn, c, y, no) for pn, c, x, y, no in cand if abs(x - left[c]) <= 0.02]
    # 번호는 차례로 커져야 한다 — 어긋난 것은 버림
    marks.sort(key=lambda t: (t[0], t[1], t[2]))
    seq, last = [], 0
    for t in marks:
        if t[3] == last + 1: seq.append(t); last = t[3]
    return seq, left

def mark_rect(d, seq, left, i):
    """i 번째 문항이 차지하는 쪽 영역(fitz.Rect)."""
    pn, col, y, no = seq[i]
    pg = d[pn]; W, H = pg.rect.width, pg.rect.height
    x0, x1 = (W * (left[0] - 0.02), W * min(0.493, left[1] - 0.012)) if col == 0 else (W * (left[1] - 0.008), W * (1.02 - left[0]))
    nxt = seq[i + 1] if i + 1 < len(seq) else None
    if nxt and nxt[0] == pn and nxt[1] == col:
        y1 = nxt[2] - 8
    else:   # 단의 마지막 문항: 쪽 바닥까지 — 단 쪽 번호·저작권 줄·«※ 확인 사항» 상자 위에서 멈춘다
        y1 = H * 0.96   # 2009 판형은 ①~⑤ 가 0.91H 밑에 있다
        for b in pg.get_text('blocks'):
            t = b[4].strip()
            if b[1] <= y + 4 or b[2] < x0 or b[0] > x1: continue
            foot = b[1] > H * 0.88 and (re.fullmatch(r'[\d\s]+', t) or '저작권' in t)
            note = '확인' in t[:8] and t[:1] in '※*＊ӄ'
            if foot: y1 = min(y1, b[1] - 4)
            elif note: y1 = min(y1, b[1] - 8)
    return fitz.Rect(x0, y - 8, x1, y1)
