# 중학 국어 유형별 문항 제작 도우미 (2026-09-28 · 맥북에어 학습지앱 세션)
# q(유형, 난이도, 발문, 정답, [오답4], [풀이 단계]) — 보기는 id 해시로 섞어 정답 번호를 ①~⑤ 에 고루 흩는다.
# 풀이 마지막 줄 「따라서 답은 ○이다.」 는 여기서 붙인다(정답 번호와 어긋날 수 없게).
import hashlib, json, os, collections

C = '①②③④⑤'
_items = []
_count = collections.Counter()
COURSE = 'kor-m2'          # 스크립트에서 lib.COURSE = 'kor-m1' 처럼 바꾼다
SOURCE = None              # None 이면 과정 id 로 정한다(중학/고등 · 국어/영어)


def _src(course):
    if SOURCE:
        return SOURCE
    lv = '중학' if '-m' in course else '고등'
    sb = '영어' if course.startswith('eng') else '국어'
    return f'씨앗제조기 · {lv} {sb} 유형'


def q(tid, diff, body, correct, wrongs, steps, course=None):
    course = course or COURSE
    assert len(wrongs) == 4, (tid, body[:30])
    assert correct not in wrongs, (tid, body[:30])
    _count[tid] += 1
    n = _count[tid]
    qid = f'seed-{course}-{tid}-{n:02d}'
    h = int(hashlib.md5(f'{course}-{tid}'.encode()).hexdigest(), 16)
    pos = (h + n) % 5          # 유형마다 시작 번호만 다르고 6문항이 ①~⑤ 를 돌아가며 쓴다 → 고르게
    ch = list(wrongs)
    ch.insert(pos, correct)
    sol = '\n'.join(f'{i + 1}. {s}' for i, s in enumerate(steps)) + f'\n{len(steps) + 1}. 따라서 답은 {C[pos]}이다.'
    _items.append({'id': qid, 'typeId': f'{course}-{tid}', 'twinGroup': f'tw-{course}-{tid}', 'kind': '객관식',
                   'diff': diff, 'body': body.strip('\n'), 'choices': ch, 'answer': C[pos], 'solution': sol,
                   'source': _src(course)})


def s(tid, diff, body, answer, steps, course=None, essay=False):
    course = course or COURSE
    """단답(용어 하나) 또는 서술형(essay=True → selfGrade)"""
    _count[tid] += 1
    n = _count[tid]
    qid = f'seed-{course}-{tid}-{n:02d}'
    it = {'id': qid, 'typeId': f'{course}-{tid}', 'twinGroup': f'tw-{course}-{tid}', 'kind': '주관식', 'diff': diff,
          'body': body.strip('\n'), 'answer': answer,
          'solution': '\n'.join(f'{i + 1}. {x}' for i, x in enumerate(steps)), 'source': _src(course)}
    if essay:
        it['selfGrade'] = True
    _items.append(it)



def qf(tid, diff, body, choices, ans_idx, steps, course=None):
    """보기 순서를 그대로 둔다 — 위치·순서형((A)~(E) 자리, 문장 번호 ⓐ~ⓔ, 배열 순서)용.
    ans_idx 는 0~4. 정답 번호가 한쪽에 몰리지 않게 유형 안에서 직접 돌려 쓴다."""
    course = course or COURSE
    assert len(choices) == 5 and len(set(choices)) == 5, (tid, body[:30])
    assert 0 <= ans_idx <= 4
    _count[tid] += 1
    n = _count[tid]
    qid = f'seed-{course}-{tid}-{n:02d}'
    sol = '\n'.join(f'{i + 1}. {x}' for i, x in enumerate(steps)) + f'\n{len(steps) + 1}. 따라서 답은 {C[ans_idx]}이다.'
    _items.append({'id': qid, 'typeId': f'{course}-{tid}', 'twinGroup': f'tw-{course}-{tid}', 'kind': '객관식',
                   'diff': diff, 'body': body.strip('\n'), 'choices': list(choices), 'answer': C[ans_idx], 'solution': sol,
                   'source': _src(course)})

def save(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(_items, open(path, 'w'), ensure_ascii=False, indent=0)
    dist = collections.Counter(p['answer'] for p in _items if p['kind'] == '객관식')
    per = collections.Counter(p['typeId'] for p in _items)
    diffs = collections.Counter((p['typeId'], p['diff']) for p in _items)
    print(f'{os.path.basename(path)}: {len(_items)}문항 · 유형 {len(per)} · 정답분포 {dict(sorted(dist.items()))}')
    short = {t: c for t, c in per.items() if c != 6}
    if short:
        print('  ⚠️ 6문항 아닌 유형:', short)
    _items.clear()
