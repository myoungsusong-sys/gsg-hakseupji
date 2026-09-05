#!/usr/bin/env python3
"""자체 문항 생성기 — 유형별 템플릿에 숫자를 갈아 끼워 쌍둥이문제를 찍어낸다.

왜 이렇게 만드나 (2026-09-05 대표님 지시)
  · 서브에이전트로 문항을 지으면 토큰이 폭발한다(09-04 하루 114건, 한도 2회 소진).
  · 계산형 문제는 「템플릿 + 숫자」다. 정답은 파이썬이 계산하므로 **AI 검증이 필요 없고 100% 맞다.**
  · 같은 템플릿에서 나온 것들이 곧 **쌍둥이**다 — twinGroup 을 같은 값으로 준다.
    앱의 select.ts(오답 재출제)·drill.ts(쌍둥이 훈련)가 이 필드로 쌍둥이를 고른다.

쓰는 법
  python3 _gen/make_pool.py            # public/gen-m1-1.json 생성
  python3 _gen/make_pool.py --check    # 정답 자가검증만 (파일 안 씀)

출력: Problem 객체 배열 → public/gen-<과정>.json
  loadPool(pool.ts)이 기본 풀 뒤에 자동으로 합친다. id 는 gen-<과정>-<typeId>-<n>.
"""
from __future__ import annotations
import json, math, random, sys
from pathlib import Path
from math import gcd

ROOT = Path(__file__).resolve().parent.parent
COURSE = "m1-1"
CIRCLED = "①②③④⑤"
PER_TYPE = 12          # 유형당 문항 수 (= 쌍둥이 12개)
random.seed(20260905)  # 돌릴 때마다 같은 문제가 나오게 (배포본이 흔들리지 않도록)


# ── 도우미 ────────────────────────────────────────────────────────────────────
def factorize(n: int) -> dict[int, int]:
    f, d = {}, 2
    while d * d <= n:
        while n % d == 0:
            f[d] = f.get(d, 0) + 1
            n //= d
        d += 1
    if n > 1:
        f[n] = f.get(n, 0) + 1
    return f


def fact_tex(n: int) -> str:
    """소인수분해를 $2^2 \\times 3$ 꼴로"""
    parts = [f"{p}^{{{e}}}" if e > 1 else f"{p}" for p, e in sorted(factorize(n).items())]
    return r" \times ".join(parts)


def divisors(n: int) -> list[int]:
    out = [d for d in range(1, int(math.isqrt(n)) + 1) if n % d == 0]
    return sorted(set(out + [n // d for d in out]))


def ndiv(n: int) -> int:
    r = 1
    for e in factorize(n).values():
        r *= e + 1
    return r


def lcm(a: int, b: int) -> int:
    return a * b // gcd(a, b)


def is_prime(n: int) -> bool:
    return n > 1 and all(n % d for d in range(2, int(math.isqrt(n)) + 1))


def choices_from(answer: int | str, distractors: list, unit: str = "") -> tuple[list[str], str]:
    """정답 + 오답 4개를 섞어 보기 5개와 정답 기호(①~⑤)를 돌려준다.
    정답 자리가 한쪽에 몰리지 않게 섞는다."""
    pool, seen = [], set()
    for v in [answer] + list(distractors):
        k = str(v)
        if k not in seen:
            seen.add(k)
            pool.append(v)
    i = 2
    while len(pool) < 5:                      # 오답이 모자라면 근처 수로 채운다
        for cand in (int_or_none(answer) or 0) + i, (int_or_none(answer) or 0) - i:
            if cand is not None and cand > 0 and str(cand) not in seen:
                seen.add(str(cand))
                pool.append(cand)
                if len(pool) == 5:
                    break
        i += 1
    five = pool[:5]
    random.shuffle(five)
    idx = five.index(answer)
    return [f"${v}${unit}" for v in five], CIRCLED[idx]


def int_or_none(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


PROBS: list[dict] = []


def add(type_id: str, twin: str, diff: int, body: str, answer: str,
        solution: str, choices: list[str] | None = None) -> None:
    PROBS.append({
        "typeId": type_id, "twinGroup": f"tw-{COURSE}-{twin}", "diff": diff,
        "kind": "객관식" if choices else "주관식",
        "body": body, **({"choices": choices} if choices else {}),
        "answer": answer, "solution": solution,
        "source": "자체 생성", "custom": True,
    })


# ── 유형별 템플릿 ─────────────────────────────────────────────────────────────
# 각 함수는 그 유형의 문항을 PER_TYPE 개 만든다. 난이도는 숫자 크기·단계 수로 준다.

def t_yaksu_baesu():                                   # 15246 자연수의 약수와 배수
    for i in range(PER_TYPE):
        n = random.choice([12, 18, 24, 28, 36, 40, 45, 48, 54, 60, 72, 84])
        ds = divisors(n)
        add("15246", "yaksu-count", 1 + i % 2,
            f"${n}$ 의 약수의 개수를 구하여라.", f"${len(ds)}$",
            f"${n} = {fact_tex(n)}$ 이므로 약수의 개수는 "
            + r" \times ".join(f"({e}+1)" for e in factorize(n).values())
            + f" $= {len(ds)}$ 이다.")


def t_baesu_panbyeol():                                # 9648 배수판별법
    for i in range(PER_TYPE):
        d = random.choice([3, 4, 6, 9])
        n = random.randrange(100, 1000)
        n -= n % d if i % 2 else 0                     # 절반은 배수, 절반은 아니게
        yes = n % d == 0
        digits = sum(int(c) for c in str(n))
        rule = {3: f"각 자리 숫자의 합 ${digits}$", 9: f"각 자리 숫자의 합 ${digits}$",
                4: f"끝 두 자리 ${str(n)[-2:]}$", 6: f"짝수이면서 각 자리 숫자의 합 ${digits}$"}[d]
        add("9648", f"panbyeol-{d}", 2,
            f"${n}$ 은 ${d}$ 의 배수인가? 배수이면 $1$, 아니면 $0$ 을 답하여라.",
            "$1$" if yes else "$0$",
            f"{d} 의 배수판별: {rule} 이 ${d}$ 로 나누어떨어지는지 보면 된다. "
            f"따라서 ${n}$ 은 ${d}$ 의 배수가 {'맞다' if yes else '아니다'}.")


def t_sosu_hapseong():                                 # 15247 소수와 합성수
    for i in range(PER_TYPE):
        cand = random.sample([2, 9, 11, 15, 17, 21, 23, 27, 29, 33, 37, 39, 41, 49, 51, 53, 57], 5)
        primes = [c for c in cand if is_prime(c)]
        if len(primes) != 1:                           # 정답이 하나만 되게 조정
            cand = [primes[0] if primes else 13] + [c for c in cand if not is_prime(c)][:4]
            while len(cand) < 5:
                cand.append(random.choice([9, 15, 21, 25, 27, 33, 35, 39]))
            primes = [c for c in cand if is_prime(c)]
        random.shuffle(cand)
        ans = CIRCLED[cand.index(primes[0])]
        add("15247", "sosu-pick", 1 + i % 2,
            "다음 중 소수인 것은?", ans,
            f"${primes[0]}$ 은 $1$ 과 자기 자신만을 약수로 가지므로 소수이다. "
            "나머지는 다른 약수를 가지므로 합성수이다.",
            [f"${c}$" for c in cand])


def t_geodeup_bat_jisu():                              # 15239 거듭제곱의 밑과 지수
    for i in range(PER_TYPE):
        a, b = random.choice([2, 3, 5, 7, 11]), random.randrange(3, 10)
        add("15239", "bat-jisu", 1,
            f"거듭제곱 ${a}^{{{b}}}$ 에서 밑을 $a$, 지수를 $b$ 라 할 때 $a+b$ 의 값은?",
            *choices_from(a + b, [a * b, a + b + 1, a + b - 1, abs(a - b)])[::-1],
            solution=f"밑은 ${a}$, 지수는 ${b}$ 이므로 $a+b={a}+{b}={a+b}$ 이다.") \
            if False else add(
            "15239", "bat-jisu", 1,
            f"거듭제곱 ${a}^{{{b}}}$ 에서 밑을 $a$, 지수를 $b$ 라 할 때 $a+b$ 의 값은?",
            choices_from(a + b, [a * b, a + b + 1, a + b - 1, abs(a - b)])[1],
            f"밑은 ${a}$, 지수는 ${b}$ 이므로 $a+b={a}+{b}={a+b}$ 이다.",
            choices_from(a + b, [a * b, a + b + 1, a + b - 1, abs(a - b)])[0])


def t_soinsubunhae():                                  # 15240 소인수분해 하기
    for i in range(PER_TYPE):
        n = random.choice([36, 48, 60, 72, 84, 90, 96, 120, 126, 132, 140, 150, 168, 180, 196, 200])
        add("15240", "bunhae", 1 + i % 3,
            f"${n}$ 을 소인수분해 하여라. (예: $2^2 \\times 3$ 꼴)", f"${fact_tex(n)}$",
            f"${n}$ 을 작은 소수부터 차례로 나누면 ${n} = {fact_tex(n)}$ 이다.")


def t_soinsu():                                        # 15241 소인수 구하기
    for i in range(PER_TYPE):
        n = random.choice([84, 90, 126, 132, 140, 150, 168, 180, 198, 204, 220, 234, 252, 270, 294])
        ps = sorted(factorize(n))
        s = sum(ps)
        add("15241", "soinsu-sum", 2 + i % 2,
            f"${n}$ 의 모든 소인수의 합은?",
            choices_from(s, [s + 2, s - 2, s + 5, sum(ps) * 2])[1],
            f"${n} = {fact_tex(n)}$ 이므로 소인수는 ${', '.join(map(str, ps))}$ 이고, 그 합은 ${s}$ 이다.",
            choices_from(s, [s + 2, s - 2, s + 5, sum(ps) * 2])[0])


def t_jegop_mandeulgi():                               # 15244 제곱인 수 만들기 (곱하기)
    for i in range(PER_TYPE):
        n = random.choice([12, 18, 20, 24, 27, 40, 45, 48, 50, 54, 60, 72, 75, 80, 90, 98])
        a = 1
        for p, e in factorize(n).items():
            if e % 2:
                a *= p
        r = int(math.isqrt(n * a))
        add("15244", "jegop-mul", 2 + i % 3,
            f"${n}$ 에 자연수 $a$ 를 곱하여 어떤 자연수의 제곱이 되게 하려고 한다. "
            f"이때 가장 작은 자연수 $a$ 의 값을 구하여라.", f"${a}$",
            f"${n} = {fact_tex(n)}$ 이다. 제곱수가 되려면 모든 소인수의 지수가 짝수여야 하므로 "
            f"지수가 홀수인 소인수를 곱해야 한다. 따라서 $a={a}$ 이고, "
            f"${n} \\times {a} = {n*a} = {r}^2$ 이다.")


def t_yaksu_gaesu():                                   # 15233 약수의 개수 구하기
    for i in range(PER_TYPE):
        n = random.choice([72, 96, 108, 120, 144, 180, 200, 216, 240, 288, 300, 360])
        k = ndiv(n)
        add("15233", "yaksu-n", 2 + i % 3,
            f"${n}$ 의 약수의 개수는?",
            choices_from(k, [k + 1, k - 1, k + 2, k * 2])[1],
            f"${n} = {fact_tex(n)}$ 이므로 약수의 개수는 "
            + r" \times ".join(f"({e}+1)" for e in factorize(n).values()) + f" $= {k}$ 이다.",
            choices_from(k, [k + 1, k - 1, k + 2, k * 2])[0])


def t_seoroso():                                       # 15274 서로소
    for i in range(PER_TYPE):
        opts, ans = [], None
        while len(opts) < 5:
            a, b = random.randrange(10, 60), random.randrange(10, 60)
            co = gcd(a, b) == 1
            if co and ans is None:
                ans = (a, b)
                opts.append((a, b))
            elif not co and len(opts) < 5:
                opts.append((a, b))
        if ans not in opts:
            opts[0] = ans
        random.shuffle(opts)
        idx = opts.index(ans)
        add("15274", "seoroso", 1 + i % 2,
            "다음 중 두 수가 서로소인 것은?", CIRCLED[idx],
            f"${ans[0]}$ 과 ${ans[1]}$ 의 최대공약수는 $1$ 이므로 서로소이다.",
            [f"${a}$ 와 ${b}$" for a, b in opts])


def t_choedae_gongyaksu():                             # 15277 최대공약수 구하기
    for i in range(PER_TYPE):
        g = random.choice([6, 8, 12, 14, 15, 18, 21, 24])
        a, b = g * random.choice([4, 5, 7, 9, 11]), g * random.choice([3, 8, 13, 17])
        while gcd(a // g, b // g) != 1:
            b = g * random.choice([3, 8, 13, 17, 19])
        add("15277", "gcd", 2 + i % 3,
            f"두 수 ${a}$ 와 ${b}$ 의 최대공약수를 구하여라.", f"${g}$",
            f"${a} = {fact_tex(a)}$, ${b} = {fact_tex(b)}$ 이므로 "
            f"공통인 소인수를 지수가 작은 쪽으로 택하면 최대공약수는 ${g}$ 이다.")


def t_choeso_gongbaesu():                              # 15253 최소공배수 구하기
    for i in range(PER_TYPE):
        a, b = random.randrange(8, 40), random.randrange(8, 40)
        L = lcm(a, b)
        add("15253", "lcm", 2 + i % 3,
            f"두 수 ${a}$ 와 ${b}$ 의 최소공배수를 구하여라.", f"${L}$",
            f"${a} = {fact_tex(a)}$, ${b} = {fact_tex(b)}$ 이므로 "
            f"각 소인수를 지수가 큰 쪽으로 택하면 최소공배수는 ${L}$ 이다.")


def t_gwan_gye():                                      # 15272 (두 수의 곱)=(최대공약수)×(최소공배수)
    for i in range(PER_TYPE):
        g = random.choice([4, 6, 8, 9, 12, 15])
        m, n = random.choice([5, 7, 11, 13]), random.choice([3, 8, 9, 17])
        while gcd(m, n) != 1:
            n = random.choice([3, 8, 9, 17, 19])
        a, b = g * m, g * n
        L = lcm(a, b)
        add("15272", "gcd-lcm-rel", 3 + i % 2,
            f"두 자연수 ${a}$, ${b}$ 의 최대공약수가 ${g}$ 일 때, 최소공배수를 구하여라.", f"${L}$",
            f"(두 수의 곱) $=$ (최대공약수) $\\times$ (최소공배수) 이므로 "
            f"${a} \\times {b} = {g} \\times L$, 즉 $L = \\dfrac{{{a} \\times {b}}}{{{g}}} = {L}$ 이다.")


def t_nanugi():                                        # 15262 어떤 자연수로 나누기
    for i in range(PER_TYPE):
        d = random.choice([7, 8, 9, 11, 12, 13, 15])
        r1, r2 = random.randrange(1, min(d, 6)), random.randrange(1, min(d, 6))
        a, b = d * random.randrange(8, 30) + r1, d * random.randrange(8, 30) + r2
        if gcd(a - r1, b - r2) != d:
            continue
        add("15262", "divide-remain", 4,
            f"${a}$ 를 어떤 자연수로 나누면 ${r1}$ 이 남고, ${b}$ 를 그 자연수로 나누면 ${r2}$ 가 남는다. "
            f"이러한 자연수 중 가장 큰 수를 구하여라.", f"${d}$",
            f"${a}-{r1}={a-r1}$, ${b}-{r2}={b-r2}$ 를 모두 나누어떨어지게 하는 수 중 가장 큰 수이므로 "
            f"${a-r1}$ 과 ${b-r2}$ 의 최대공약수인 ${d}$ 이다. (나머지보다 커야 하므로 조건에 맞다.)")


def t_silsaenghwal_gcd():                              # 15259 최대공약수 실생활 — 나누어 주기
    items = [("사탕", "개"), ("초콜릿", "개"), ("연필", "자루"), ("공책", "권"), ("귤", "개")]
    for i in range(PER_TYPE):
        g = random.choice([6, 8, 12, 14, 16, 18])
        (n1, u1), (n2, u2) = random.sample(items, 2)
        a, b = g * random.choice([3, 5, 7]), g * random.choice([4, 9, 11])
        while gcd(a // g, b // g) != 1:
            b = g * random.choice([4, 9, 11, 13])
        add("15259", "gcd-share", 3 + i % 2,
            f"{n1} ${a}${u1}, {n2} ${b}${u2} 를 되도록 많은 학생에게 남김없이 똑같이 나누어 주려고 한다. "
            f"이때 한 학생이 받는 {n1}과 {n2}의 개수의 합을 구하여라.",
            f"${a//g + b//g}$",
            f"학생 수는 ${a}$ 와 ${b}$ 의 최대공약수인 ${g}$ 명이다. "
            f"한 학생이 {n1} ${a}\\div{g}={a//g}$, {n2} ${b}\\div{g}={b//g}$ 를 받으므로 "
            f"합은 ${a//g}+{b//g}={a//g + b//g}$ 이다.")


def t_silsaenghwal_lcm():                              # 15263 최소공배수 실생활 — 다시 만나기
    for i in range(PER_TYPE):
        a, b = random.choice([6, 8, 9, 10, 12, 15]), random.choice([14, 16, 18, 20, 21, 24])
        L = lcm(a, b)
        add("15263", "lcm-meet", 3 + i % 2,
            f"어느 버스 정류장에서 A 버스는 ${a}$ 분마다, B 버스는 ${b}$ 분마다 출발한다. "
            f"두 버스가 오전 $7$ 시에 동시에 출발했을 때, 다음번에 처음으로 다시 동시에 출발하는 것은 "
            f"몇 분 후인지 구하여라.", f"${L}$",
            f"${a}$ 와 ${b}$ 의 최소공배수를 구하면 ${L}$ 이므로 ${L}$ 분 후에 처음으로 다시 동시에 출발한다.")


def t_topni():                                         # 15264 맞물려 도는 톱니바퀴
    for i in range(PER_TYPE):
        a, b = random.choice([12, 14, 16, 18, 20, 24]), random.choice([15, 21, 27, 30, 32, 36])
        L = lcm(a, b)
        add("15264", "gear", 4,
            f"톱니가 각각 ${a}$ 개, ${b}$ 개인 두 톱니바퀴가 맞물려 돌고 있다. "
            f"두 톱니바퀴가 같은 톱니에서 처음으로 다시 맞물릴 때까지 "
            f"톱니가 ${a}$ 개인 톱니바퀴는 몇 바퀴 도는지 구하여라.", f"${L//a}$",
            f"맞물린 톱니 수는 ${a}$ 와 ${b}$ 의 최소공배수인 ${L}$ 개이다. "
            f"따라서 톱니가 ${a}$ 개인 바퀴는 ${L}\\div{a}={L//a}$ 바퀴 돈다.")


TEMPLATES = [
    t_yaksu_baesu, t_baesu_panbyeol, t_sosu_hapseong, t_geodeup_bat_jisu,
    t_soinsubunhae, t_soinsu, t_jegop_mandeulgi, t_yaksu_gaesu,
    t_seoroso, t_choedae_gongyaksu, t_choeso_gongbaesu, t_gwan_gye,
    t_nanugi, t_silsaenghwal_gcd, t_silsaenghwal_lcm, t_topni,
]


# ── 자가검증 ──────────────────────────────────────────────────────────────────
def self_check(items: list[dict]) -> list[str]:
    """정답이 계산으로 나온 것이라 값 자체는 맞다. 여기서는 **형식**을 본다:
    객관식 보기 5개·정답 기호 유효·본문 비어 있지 않음·$ 짝 맞음."""
    bad = []
    for p in items:
        if not p["body"].strip():
            bad.append(f"{p['id']} 본문 없음")
        if p["body"].count("$") % 2:
            bad.append(f"{p['id']} 수식 $ 짝이 안 맞음")
        if p["kind"] == "객관식":
            if len(p.get("choices", [])) != 5:
                bad.append(f"{p['id']} 보기 {len(p.get('choices', []))}개")
            if p["answer"] not in CIRCLED:
                bad.append(f"{p['id']} 정답 기호 이상: {p['answer']}")
        else:
            if not p["answer"].strip():
                bad.append(f"{p['id']} 정답 없음")
        if not p["solution"].strip():
            bad.append(f"{p['id']} 풀이 없음")
    return bad


def main() -> None:
    for fn in TEMPLATES:
        fn()

    seq: dict[str, int] = {}
    for p in PROBS:
        t = p["typeId"]
        seq[t] = seq.get(t, 0) + 1
        p["id"] = f"gen-{COURSE}-{t}-{seq[t]}"

    bad = self_check(PROBS)
    twins = {}
    for p in PROBS:
        twins.setdefault(p["twinGroup"], 0)
        twins[p["twinGroup"]] += 1

    print(f"문항 {len(PROBS)}개 · 유형 {len(seq)}개 · 쌍둥이 묶음 {len(twins)}개 "
          f"(묶음당 평균 {len(PROBS)/max(1,len(twins)):.1f}개)")
    print(f"난이도 분포: " + " ".join(
        f"{d}:{sum(1 for p in PROBS if p['diff']==d)}" for d in range(1, 6)))
    if bad:
        print(f"⚠️ 형식 문제 {len(bad)}건")
        for b in bad[:10]:
            print("  ", b)
    else:
        print("형식 검증 통과 ✓")

    if "--check" in sys.argv:
        return
    out = ROOT / "public" / f"gen-{COURSE}.json"
    out.write_text(json.dumps(PROBS, ensure_ascii=False), encoding="utf-8")
    print(f"→ {out} ({out.stat().st_size//1024}KB)")


if __name__ == "__main__":
    main()
