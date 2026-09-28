#!/usr/bin/env python3
"""중학 사회·역사(올쏘) 생성분 «밤새 자동 붙이기» — 2026-09-28 명수쌤 「곧 시험이라 밤새 … 자동전송으로 완성」
   python3 scripts/olso_auto.py            # 드라이브 생성분을 지켜보다 한 과정이 오면 관문을 다 거쳐 배포하고 끝난다(한 과정씩)

 흐름: 드라이브 F/생성분/<과정> 에 _tree·_concepts·_wbmap·p-* 가 오고 크기가 두 번 연속 같으면(다 올라옴)
   → 저장소 _gen/<과정> 로 복사(한글 이름 NFC · _mk 는 뺀다)
   → 관문 ① olso_check 통과
      ② 객관식 전수: 정답 번호가 선지 안 · 해설 마지막 줄에 그 번호
      ③ 같은 문제(발문+선지) 중복 없음
      ④ 붙인 뒤 교재 채점표: «쪽:id» 기준 불일치 0 · 트리에 없는 유형 0
      ⑤ tsc · 빌드 통과
   → 전부 통과해야만 커밋·push(=배포). 하나라도 막히면 배포하지 않고 사유를 찍고 끝난다.
 끝나면 클로드가 표본을 직접 읽어 확인하고 다시 돌린다(사람 눈 관문).
"""
import glob, json, os, re, shutil, subprocess, sys, time, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
F = os.path.expanduser('~/Library/CloudStorage/GoogleDrive-myoungsusong@gmail.com/내 드라이브/08_강의제작_AI/학습지앱 (1)/중학사회역사_문제은행/생성분')
ALL = ['m-soc2-2', 'm-his1-2', 'm-soc1-2', 'm-his2-2', 'm-soc2-1', 'm-his2-1', 'm-soc1-1', 'm-his1-1', 'h-khis2', 'h-khis1']
# 과정마다 생성분이 있는 드라이브 폴더(한국사는 따로)
KHIS = os.path.expanduser('~/Library/CloudStorage/GoogleDrive-myoungsusong@gmail.com/내 드라이브/08_강의제작_AI/학습지앱 (1)/고1한국사_문제은행/생성분')
def 폴더(c):
    return KHIS if c.startswith('h-khis') else F
이름표 = {'m-soc1-1': '중학 사회①-1', 'm-soc1-2': '중학 사회①-2', 'm-soc2-1': '중학 사회②-1', 'm-soc2-2': '중학 사회②-2',
        'm-his1-1': '중학 역사①-1', 'm-his1-2': '중학 역사①-2', 'm-his2-1': '중학 역사②-1', 'm-his2-2': '중학 역사②-2',
        'h-khis1': '고1 한국사1', 'h-khis2': '고1 한국사2'}
ENV = {**os.environ, 'PATH': os.path.expanduser('~/.nvm/versions/node/v24.18.0/bin') + ':' + os.environ.get('PATH', '')}
C = '①②③④⑤'


def 찍기(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def 붙었나(c):
    return bool(glob.glob(f'_gen/{c}/p-*.json')) and os.path.exists(f'public/gen-{c}.json')


def 도착(c, 전):
    d = os.path.join(폴더(c), c)
    if not os.path.isdir(d):
        return None
    fs = [unicodedata.normalize('NFC', x) for x in os.listdir(d)]
    채점표필요 = '_wbitems.json' in fs          # 교재 채점표가 있는 과정만 _wbmap 이 필요하다
    if not ('_tree.json' in fs and '_concepts.json' in fs and (not 채점표필요 or '_wbmap.json' in fs) and any(x.startswith('p-') for x in fs)):
        return None
    sig = (len(fs), sum(os.path.getsize(os.path.join(d, x)) for x in os.listdir(d) if os.path.isfile(os.path.join(d, x))))
    return sig if 전.get(c) == sig else ('기다림', sig)


def 자리확보():
    """🔴 2026-09-28 실사고: 맥북에어 디스크가 꽉 차(남은 396MB) 드라이브 받기가 전부 «Operation timed out» 으로 실패했다.
       빌드 한 번에 dist 가 ~850MB 라 1.5GB 는 있어야 한다. 모자라면 다시 생기는 캐시(npx·npm)부터 비운다."""
    free = shutil.disk_usage(os.path.expanduser('~')).free
    if free < 1500 * 1024 * 1024:
        for d in ('~/.npm/_npx', '~/.npm/_cacache'):
            shutil.rmtree(os.path.expanduser(d), ignore_errors=True)
        free = shutil.disk_usage(os.path.expanduser('~')).free
        찍기(f'⚠️ 디스크 여유 {free // 2**20}MB — 캐시 비움')
    return free


def 복사(c):
    src = os.path.join(폴더(c), c)
    dst = f'_gen/{c}'
    자리확보()
    for 번 in range(3):
        shutil.rmtree(dst, ignore_errors=True)
        try:
            shutil.copytree(src, dst, ignore=shutil.ignore_patterns('_mk'))
            break
        except Exception as e:
            찍기(f'⚠️ 드라이브에서 받기 실패({번 + 1}/3) — {str(e)[:120]}')
            if 번 == 2:
                raise
            time.sleep(30)
    for d, dirs, files in os.walk(dst, topdown=False):
        for x in files + dirs:
            m = unicodedata.normalize('NFC', x)
            if m != x:
                os.rename(os.path.join(d, x), os.path.join(d, m))


def 관문_문항(c):
    """② 객관식 정답·선지·해설 끝줄 ③ 중복"""
    g = []
    for f in sorted(glob.glob(f'_gen/{c}/p-*.json')):
        g += json.load(open(f))
    틀 = []
    for p in g:
        if p.get('kind') != '객관식':
            continue
        a = str(p.get('answer', '')).strip()
        ch = p.get('choices') or []
        끝 = (str(p.get('solution', '')).strip().splitlines() or [''])[-1]
        if a not in C or C.index(a) >= len(ch) or a not in 끝:
            틀.append(p.get('id'))
    본 = {}
    겹침 = []
    for p in g:
        k = re.sub(r'\s+', '', str(p.get('body', ''))) + '|' + '|'.join(re.sub(r'\s+', '', str(x)) for x in (p.get('choices') or []))
        if k in 본:
            겹침.append((본[k], p.get('id')))
        본[k] = p.get('id')
    return len(g), 틀, 겹침


def 관문_채점표(c):
    """④ 붙인 뒤 교재 채점표 — «쪽:id» 기준 불일치·트리에 없는 유형"""
    if not (os.path.exists(f'_gen/{c}/_wbmap.json') and os.path.exists(f'public/wb-match-{c}.json')):
        return 0, 0, 0                            # 교재 채점표가 없는 과정
    wm = json.load(open(f'_gen/{c}/_wbmap.json'))
    tree = json.load(open(f'_gen/{c}/_tree.json'))
    types = set()
    for ui, (u, mids) in enumerate(tree):
        for mi, (m, ss) in enumerate(mids):
            for si, (s, ts) in enumerate(ss):
                for ti, _ in enumerate(ts):
                    types.add(f'{c}-u{ui}m{mi}s{si}t{ti}')
    d = json.load(open(f'public/wb-match-{c}.json'))
    n = 틀 = 없음 = 0
    for items in d.values():
        for it in items:
            n += 1
            if it[2] != wm.get(f'{it[1]}:{it[0]}', wm.get(it[0])):
                틀 += 1
            if it[2] not in types:
                없음 += 1
    return n, 틀, 없음


def 돌리기(cmd, 초=900):
    r = subprocess.run(cmd, capture_output=True, text=True, env=ENV, timeout=초)
    return r.returncode, (r.stdout + r.stderr)


def 한과정(c):
    찍기(f'▶ {c} 도착 — 복사')
    복사(c)
    rc, out = 돌리기([sys.executable, '_gen/olso_check.py', c])
    찍기('① olso_check:', out.strip().splitlines()[0] if out.strip() else '', '→', '통과' if rc == 0 else '실패')
    if rc != 0:
        찍기('🔴 배포 안 함 — olso_check 실패\n' + out[-1500:]); return False
    n, 틀, 겹침 = 관문_문항(c)
    찍기(f'②③ 문항 {n} · 객관식 정답/선지/해설 불일치 {len(틀)} · 중복 {len(겹침)}')
    if 틀 or 겹침:
        찍기('🔴 배포 안 함 —', '불일치', 틀[:8], '중복', 겹침[:5]); return False
    rc, out = 돌리기([sys.executable, 'scripts/olso_integrate.py', c])
    찍기('붙이기:', ' / '.join(out.strip().splitlines()[-3:]))
    if rc != 0 or f"'{c}'" not in out:
        찍기('🔴 배포 안 함 — 붙이기 실패\n' + out[-1500:]); return False
    rc, out = 돌리기(['node', '_concepts/합치기.mjs'])
    찍기('개념카드:', out.strip().splitlines()[-1] if out.strip() else '')
    if rc != 0:
        찍기('🔴 배포 안 함 — 개념카드 합치기 실패\n' + out[-800:]); return False
    n2, 틀2, 없음2 = 관문_채점표(c)
    찍기(f'④ 교재 채점표 {n2} · 쪽 기준 불일치 {틀2} · 트리에 없는 유형 {없음2}')
    if 틀2 or 없음2:
        찍기('🔴 배포 안 함 — 교재 채점표 연결 오류'); return False
    for cmd in (['npx', 'tsc', '--noEmit', '-p', 'tsconfig.app.json'], ['npm', 'run', 'build']):
        rc, out = 돌리기(cmd)
        if rc != 0:
            찍기('🔴 배포 안 함 —', ' '.join(cmd), '실패\n' + out[-1500:]); return False
    찍기('⑤ tsc·빌드 통과')
    이름 = 이름표[c]
    rc, out = 돌리기([sys.executable, 'scripts/changelog_add.py', f'{이름} 문제은행 {n}문항',
                     f'올쏘 {이름}(22개정)을 교재 목차대로 단원·유형으로 세우고 새로 지은 {n}문항과 소단원 개념카드를 넣었어요. 교재 채점 문항도 새 유형에 연결돼 교재에서 틀리면 그 유형 연습으로 이어져요.'])
    돌리기(['git', 'add', '-A'])
    rc, out = 돌리기(['git', 'commit', '-q', '-m',
                     f'올쏘 {이름}: {n}문항 붙임 (olso_auto — 관문 ①~⑤ 통과)\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'])
    rc, out = 돌리기(['git', 'push', '-q', 'origin', 'main'], 초=300)
    if rc != 0:
        찍기('🔴 push 실패\n' + out[-800:]); return False
    rc, out = 돌리기(['git', 'log', '--oneline', '-1'])
    찍기(f'✅ {c} 배포 ·', out.strip())
    return True


if __name__ == '__main__':
    전 = {}
    끝 = time.time() + 12 * 3600
    while time.time() < 끝:
        남은 = [c for c in ALL if not 붙었나(c)]
        if not 남은:
            찍기('🎉 8과정 모두 붙었다'); sys.exit(0)
        for c in 남은:
            s = 도착(c, 전)
            if s is None:
                continue
            if isinstance(s, tuple) and s and s[0] == '기다림':
                전[c] = s[1]; continue
            try:
                ok = 한과정(c)
            except Exception as e:
                찍기(f'🔴 {c} 처리 중 오류 — {str(e)[:300]} · 3분 뒤 다시')
                전.pop(c, None)
                continue
            sys.exit(0 if ok else 3)
        time.sleep(180)
    찍기('12시간 동안 새 과정 없음')
