#!/usr/bin/env python3
"""시중 비교 보강분 받아 오기 — 아이맥이 드라이브 `학습지앱 (1)/시중비교_보강/결과/<과정>/` 에 `_완료.md` 를 쓰면
p-plus-*.json 을 `_gen/<과정>/` 로, figs/*.png 를 `public/figs/<과정>/` 로 가져와 검사하고 **멈춘다**(과정 하나마다).
병합·배포는 총괄(맥북에어 세션)이 표본 검산 뒤에 한다 — 여기서는 git 을 건드리지 않는다.
    python3 scripts/plus_auto.py            # 3분마다 감시, 새 과정 하나 가져오면 종료(코드 0)
"""
import glob, json, os, re, shutil, subprocess, sys, time, unicodedata

W = os.path.expanduser('~/Library/CloudStorage/GoogleDrive-myoungsusong@gmail.com/내 드라이브/08_강의제작_AI/학습지앱 (1)/시중비교_보강')
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DONE = os.path.join(R, '_gen', '_plus_가져감.json')      # 이미 가져온 과정 기록(_ 로 시작 → merge-gen 이 읽지 않음)
C = '①②③④⑤'


def 찍기(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def 목록(d):
    """드라이브는 클라우드 전용이라 멎을 수 있다 — 파이썬 시간 제한으로 연다(이 맥엔 timeout 명령이 없다)."""
    r = subprocess.run(['ls', d], capture_output=True, text=True, timeout=60)
    return [unicodedata.normalize('NFC', x) for x in r.stdout.split('\n') if x]


def 검사(c, items, 기존ids):
    bad = []
    for q in items:
        if not q['typeId'].startswith(c + '-'): bad.append((q['id'], '과정 불일치'))
        if q['id'] in 기존ids: bad.append((q['id'], '기존 문항과 id 겹침'))
        if q['kind'] == '객관식':
            a = q.get('answer')
            if a not in C or len(q.get('choices', [])) != 5: bad.append((q['id'], '보기/정답 형식')); continue
            if f'답은 {a}' not in q['solution'].strip().split('\n')[-1]: bad.append((q['id'], '풀이 끝줄'))
        for m in re.findall(r'\[\[그림:/?(figs/[^\]]+)\]\]', q['body']):
            if not os.path.exists(os.path.join(R, 'public', m)): bad.append((q['id'], f'그림 없음 {m}'))
    ids = [q['id'] for q in items]
    bad += [(i, 'id 중복') for i in set(ids) if ids.count(i) > 1]
    return bad


def 한과정(c):
    src = os.path.join(W, '결과', c)
    fs = 목록(src)
    ps = [f for f in fs if f.startswith('p-plus-') and f.endswith('.json')]
    dst = os.path.join(R, '_gen', c)
    os.makedirs(dst, exist_ok=True)
    for f in ps:
        shutil.copyfile(os.path.join(src, f), os.path.join(dst, f))
    n그림 = 0
    if 'figs' in fs:
        fd = os.path.join(R, 'public', 'figs', c)
        os.makedirs(fd, exist_ok=True)
        for g in 목록(os.path.join(src, 'figs')):
            shutil.copyfile(os.path.join(src, 'figs', g), os.path.join(fd, g)); n그림 += 1
    for f in [x for x in fs if x.startswith('compare_') and x.endswith('.md')]:
        os.makedirs(os.path.join(R, '_gen', c, '_compare'), exist_ok=True)
        shutil.copyfile(os.path.join(src, f), os.path.join(R, '_gen', c, '_compare', f))
    items = [q for f in ps for q in json.load(open(os.path.join(dst, f)))]
    기존 = []
    for f in glob.glob(os.path.join(dst, '*.json')):
        b = os.path.basename(f)
        if b.startswith('p-plus-') or (b.startswith('_') and b != '_existing.json'): continue
        기존 += json.load(open(f))
    bad = 검사(c, items, {q['id'] for q in 기존})
    찍기(f'▶ {c}: 보강 {len(items)}문항 · 파일 {len(ps)} · 그림 {n그림} · 기존 {len(기존)} · 문제 {len(bad)}', bad[:8])
    return len(bad) == 0


if __name__ == '__main__':
    done = json.load(open(DONE)) if os.path.exists(DONE) else []
    끝 = time.time() + 20 * 3600
    while time.time() < 끝:
        try:
            for c in 목록(os.path.join(W, '결과')):
                if c in done or '_완료.md' not in 목록(os.path.join(W, '결과', c)):
                    continue
                ok = 한과정(c)
                done.append(c); json.dump(done, open(DONE, 'w'), ensure_ascii=False)
                찍기(('✅ ' if ok else '🔴 ') + f'{c} 가져옴 — 총괄이 표본 검산 뒤 merge-gen·배포')
                sys.exit(0 if ok else 3)
        except subprocess.TimeoutExpired:
            찍기('⚠️ 드라이브 응답 없음 — 3분 뒤 다시')
        time.sleep(180)
    찍기('20시간 동안 새 과정 없음')
