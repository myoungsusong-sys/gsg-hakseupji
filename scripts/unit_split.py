# -*- coding: utf-8 -*-
"""
정답 문자열에서 '단위/라벨'을 분리하는 규칙 (매쓰플랫 중3-1 데이터 전수조사 기반)

측정 결과 (단위 메타데이터를 가진 5개 교재 5,178문항 기준)
  - 단위 유무 이진판정 : 정밀도 98.79% / 재현율 100.00% / F1 99.39%
  - 단위 배열 완전일치 : 566/571 = 99.12%

사용:
    from unit_split import extract
    extract('\\sqrt{6}cm')      -> (['cm'], ['\\sqrt{6}'])
    extract('x=0\\; 또는\\; x=1') -> (['x=', 'x='], ['0', '1'])
"""
import re

# --- 접미 단위 사전 (긴 것 먼저 = 최장일치. '만 원'이 '원'보다 앞) ---------
SUFFIX_UNITS = ['m/s', 'km/h', '만 원', 'cm', 'km', 'mm', '㎝', '㎞', '㎜',
                '㎠', '㎤', '㎡', '㎥', 'kg', '㎏', 'mL', 'L', 'g', '℃', '%',
                '시간', '번째', '단계', '가지', '초', '분', '개', '명', '원',
                '살', '일', '배', '점', '권', '자루', '마리', '도', 'm']

RX_TEXSP  = re.compile(r'\\[;,:!]|\\ |~')                       # LaTeX 공백
RX_SUFFIX = re.compile(r'(' + '|'.join(re.escape(u) for u in SUFFIX_UNITS) + r')\s*$')
RX_MARKER = re.compile(r'^(㈎|㈏|㈐|㈑|㈒|㈓|㈔|㈕|\(가\)|\(나\)|\(다\)|\(라\)|\(마\))\s*')
RX_LABEL  = re.compile(r'^([^:=,<>]{1,16}?\s*)([:=])\s*(?=\S)')
RX_TEXCMD = re.compile(r'\\[a-zA-Z]+')

# --- 가드 (오탐 방지) -------------------------------------------------------
RX_DATE   = re.compile(r'[0-9]\s*월\s*[0-9]+\s*일\s*$')   # '7월 5일'  → 날짜
RX_DOW    = re.compile(r'요일\s*$')                        # '화요일'    → 요일
RX_NUMLAB = re.compile(r'^\s*[0-9]+\s*$')                  # '2:11'     → 비(比)
RX_VALEND = re.compile(r'[0-9}\)²³πxyzabcn]\s*$')          # 단위 앞엔 값이 있어야 함


def norm(s):
    """LaTeX 공백(\\;, \\, 등)을 실공백으로 펴고 공백 정리"""
    return re.sub(r'\s+', ' ', RX_TEXSP.sub(' ', s)).strip()


def split_top(s):
    """최상위 쉼표 / '또는' 으로 분할. 괄호·중괄호 안의 쉼표는 보호((0,-7), \\frac{1}{2})"""
    s = re.sub(r'\s*또는\s*', ',', s)
    out, buf, dep = [], [], 0
    for ch in s:
        if ch in '({[':
            dep += 1
        elif ch in ')}]':
            dep -= 1
        if ch == ',' and dep <= 0:
            out.append(''.join(buf)); buf = []
        else:
            buf.append(ch)
    out.append(''.join(buf))
    return [p.strip() for p in out if p.strip()]


def _rhs_is_value(rhs):
    """등호 우변이 '값'(변수 없음)인가 '식'(변수 있음)인가.
    y=3{x}^{2}-1 처럼 우변에 미지수가 남으면 'y='는 라벨이 아니라 식의 일부다."""
    return not re.search(r'[a-zA-Z]', re.sub(r'[{}]', '', RX_TEXCMD.sub('', rhs)))


def _strip_suffix(part):
    units = []
    while True:
        if RX_DATE.search(part) or RX_DOW.search(part):
            break
        m = RX_SUFFIX.search(part)
        if not m:
            break
        head = part[:m.start()].rstrip()
        if not head or not RX_VALEND.search(head):
            break
        units.insert(0, m.group(1))
        part = head
        if len(units) >= 2:
            break
    return part, units


def extract(ans):
    """정답 문자열 -> (단위/라벨 리스트, 단위를 뗀 값 리스트)"""
    units, vals = [], []
    for part in split_top(norm(ans)):
        u = []
        m = RX_MARKER.match(part)
        if m:                                   # ① ㈎ ㈏ ㈐ 마커
            u = [m.group(1) + ' ']
            part = part[m.end():]
        else:
            body, suf = _strip_suffix(part)     # ② 접미 단위 먼저 제거
            m = RX_LABEL.match(body)            # ③ 접두 라벨
            if m and not RX_NUMLAB.match(m.group(1)):
                lab, sep, rhs = m.group(1), m.group(2), body[m.end():]
                if sep == ':' or (len(lab.strip()) <= 2 and _rhs_is_value(rhs)):
                    u = [lab + sep] + suf
                    part = rhs
                else:
                    u, part = suf, body
            else:
                u, part = suf, body
        units.extend(u)
        vals.append(part)
    return units, vals
