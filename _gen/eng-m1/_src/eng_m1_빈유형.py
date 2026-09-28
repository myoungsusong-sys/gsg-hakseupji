# 중1 영어(eng-m1) 빈 유형 10개 × 6문항 — 2026-09-28 밤 · 지문은 전부 직접 창작
import sys, os; sys.path.insert(0, '/private/tmp/claude-501/-Users-songmyeongsumaegbug-eeo-Library-Mobile-Documents-com-apple-CloudDocs-08------AI/19f5d8ef-bdd5-411c-80d8-fdf503e62ef1/scratchpad/korgen')
import lib; lib.COURSE = 'eng-m1'
from lib import q, qf, s, save

WC = []   # (tid, 단어 수) — 지문 길이 점검용


def P(tid, text):
    t = text.strip()
    import re
    WC.append((tid, len(re.findall(r"[A-Za-z][A-Za-z'’\-]*", t))))
    return t


def B(발문, p, tail=None):
    return f'{발문}\n\n{p}' + (f'\n\n{tail}' if tail else '')


E5 = ['ⓐ', 'ⓑ', 'ⓒ', 'ⓓ', 'ⓔ']
A5 = ['(A)', '(B)', '(C)', '(D)', '(E)']
INS = '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?'

# ───────────────────────── u0m0s0t1 주제문 찾기 ─────────────────────────
T = 'u0m0s0t1'
p = P(T, """ⓐ Eating breakfast is good for you in many ways. ⓑ First, it gives you energy for the morning. ⓒ Second, it helps you pay attention in class. ⓓ Also, you don't get too hungry before lunch, so you don't eat too many snacks. ⓔ My brother eats rice and soup every morning, and he is always full of energy.""")
qf(T, 1, B('다음 글의 주제문으로 가장 알맞은 것은?', p), E5, 0,
   ['ⓐ 「아침을 먹는 것은 여러 면에서 몸에 좋다.」가 글 전체의 중심 내용이다.',
    'ⓑ(아침의 에너지), ⓒ(수업 집중), ⓓ(간식 줄이기)는 First·Second·Also 로 그 좋은 점을 하나씩 든 뒷받침 문장이다.',
    'ⓔ는 글쓴이의 형제가 매일 아침을 먹는다는 예시일 뿐이므로 주제문이 아니다.'])

p = P(T, """ⓐ Minho's grandmother lives alone in a small village. ⓑ Every Sunday evening, Minho calls her and tells her about his week. ⓒ She always laughs at his funny stories. ⓓ She says the call makes her happy for the whole week. ⓔ A short phone call can mean a lot to someone you love.""")
qf(T, 2, B('다음 글의 주제문으로 가장 알맞은 것은?', p), E5, 4,
   ['ⓔ 「짧은 전화 한 통이 사랑하는 사람에게는 큰 의미가 될 수 있다.」는 민호의 이야기 전체를 일반적인 교훈으로 정리한 문장이다.',
    'ⓐ~ⓓ는 할머니가 혼자 사신다 → 민호가 일요일마다 전화한다 → 할머니가 웃으신다 → 일주일 내내 행복하다고 하신다는 구체적인 이야기(사례)이다.',
    '주제문이 글의 끝에 오는 미괄식 구성이다. ⓑ는 민호의 행동을 말하는 세부 내용이라 주제문이 될 수 없다.'])

p = P(T, """ⓐ Do you have a pet dog? ⓑ Many people keep dogs as friendly pets and take them for walks every day. ⓒ But dogs can also do important jobs for people. ⓓ For example, some dogs guide people who cannot see. ⓔ Other dogs use their strong noses to find people who are lost under snow or fallen buildings.""")
qf(T, 3, B('다음 글의 주제문으로 가장 알맞은 것은?', p), E5, 2,
   ['ⓐ는 독자의 관심을 끄는 질문이고, ⓑ는 「많은 사람이 개를 반려동물로 기른다」는 일반적인 이야기이다.',
    'But 으로 시작하는 ⓒ 「그러나 개는 사람을 위해 중요한 일도 할 수 있다.」가 글쓴이가 말하려는 중심 내용이다.',
    'ⓓ(시각 장애인 안내), ⓔ(눈이나 무너진 건물 아래의 사람 찾기)는 For example·Other dogs 로 이어지는 예시이다.',
    'ⓑ는 But 앞의 도입일 뿐, 글 전체의 내용을 담지 못한다.'])

p = P(T, """ⓐ Many students use their smartphones in bed late at night. ⓑ But this is not a good habit for your sleep. ⓒ The bright light from the screen keeps your brain awake. ⓓ So you can't fall asleep easily, and you feel tired the next day. ⓔ Last night, I read a book instead of using my phone, and I slept very well.""")
qf(T, 3, B('다음 글에서 글쓴이가 가장 말하고 싶은 내용을 담은 문장은?', p), E5, 1,
   ['ⓐ는 「많은 학생이 밤늦게 침대에서 스마트폰을 쓴다」는 현상 소개이다.',
    'ⓑ 「그러나 이것은 잠에 좋지 않은 습관이다.」가 글쓴이의 중심 생각(주제문)이다.',
    'ⓒ(화면 빛이 뇌를 깨어 있게 함)와 ⓓ(잠들기 어렵고 다음 날 피곤함)는 그 이유, ⓔ는 글쓴이의 경험(예시)이다.',
    'ⓐ는 글쓴이의 생각이 아니라 비판하려는 행동을 소개한 문장이므로 답이 아니다.'])

p = P(T, """ⓐ Our school has a small garden behind the library. ⓑ Last spring, my class planted tomatoes and beans there. ⓒ Every morning, we took turns watering the plants. ⓓ From the garden, we learned much more than how to grow vegetables. ⓔ We learned to work together, and we also learned to wait patiently for the harvest.""")
qf(T, 4, B('다음 글의 주제문으로 가장 알맞은 것은?', p, '*harvest: 수확'), E5, 3,
   ['ⓐ~ⓒ는 학교 텃밭이 있다 → 토마토와 콩을 심었다 → 돌아가며 물을 주었다는 사건의 흐름이다.',
    'ⓓ 「우리는 텃밭에서 채소 기르는 법보다 훨씬 더 많은 것을 배웠다.」가 이야기 전체가 말하려는 중심 내용이다.',
    'ⓔ는 그 「더 많은 것」이 무엇인지(협동, 참을성 있게 기다리기) 구체적으로 밝힌 뒷받침 문장이다.',
    'ⓐ는 글의 첫 문장이지만 배경(장소) 소개일 뿐이라 주제문이 아니다.'])

p = P(T, """ⓐ Some people think that mistakes are always bad. ⓑ They feel embarrassed when they make one, and they try to hide it. ⓒ But mistakes are actually good teachers. ⓓ For example, when you get a math problem wrong, you find out what you don't know yet. ⓔ Then you can study that part again and do much better next time.""")
q(T, 5, B('다음 글에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?', p,
          '<보기>\nㄱ. ⓐ는 글쓴이가 반박하려는 생각이다.\nㄴ. 이 글의 주제문은 ⓒ이다.\nㄷ. ⓓ와 ⓔ는 주제문을 뒷받침하는 예이다.\nㄹ. 이 글의 주제문은 ⓐ이다.'),
  'ㄱ, ㄴ, ㄷ', ['ㄱ, ㄴ', 'ㄴ, ㄷ', 'ㄱ, ㄹ', 'ㄴ, ㄷ, ㄹ'],
  ['ⓐ 「어떤 사람들은 실수가 언제나 나쁘다고 생각한다.」는 But 뒤에서 뒤집히는 생각이므로 ㄱ은 옳다.',
   'ⓒ 「그러나 실수는 사실 좋은 선생님이다.」가 중심 내용이므로 ㄴ은 옳고, ㄹ은 틀리다.',
   'ⓓ(수학 문제를 틀리면 모르는 것을 알게 됨), ⓔ(그 부분을 다시 공부해 더 잘하게 됨)는 실수가 좋은 선생님인 까닭을 보여 주는 예이므로 ㄷ은 옳다.'])

# ───────────────────────── u0m1s3t0 글에서 추론할 수 없는 것 ─────────────────────────
T = 'u0m1s3t0'
p = P(T, """Jisu has a little brother, Jiho. He is five years old. Every evening, Jisu reads a storybook to him. Jiho loves animal stories the most. When Jisu reads, he sits close to her and listens quietly. Sometimes he falls asleep before the story ends. Then Jisu covers him with a blanket and turns off the light.""")
q(T, 1, B('다음 글을 읽고 추론할 수 «없는» 것은?', p), '지호는 지수가 책을 읽어 줄 때 딴짓을 하며 집중하지 못한다.',
  ['지수는 지호보다 나이가 많다.', '지수는 동생을 아끼고 잘 돌본다.', '지호는 동물이 나오는 이야기를 좋아한다.', '지호는 이야기를 듣다가 잠이 들 때가 있다.'],
  ['「he sits close to her and listens quietly(지호는 누나 곁에 가까이 앉아 조용히 듣는다)」고 했으므로 집중하지 못한다는 추론은 글과 어긋난다.',
   '지호는 지수의 little brother(남동생)이므로 지수가 나이가 많고, 매일 책을 읽어 주고 담요를 덮어 주는 모습에서 동생을 아낀다는 것을 알 수 있다.',
   'loves animal stories the most, falls asleep before the story ends 에서 나머지 보기를 확인할 수 있다.'])

p = P(T, """Tom moved to a new town last month. On his first day at his new school, he didn't know anyone. At lunch, he sat alone and ate quietly. Then a boy named Sam came to his table. “Do you like soccer?” Sam asked. Tom smiled and said, “I love it!” After school, they played soccer together. Now they are best friends.""")
q(T, 2, B('다음 글을 읽고 추론할 수 «없는» 것은?', p), 'Tom and Sam were friends before Tom moved.',
  ['Tom felt lonely at lunch on his first day.', 'Sam was friendly to Tom.', 'Tom goes to a different school now.', 'Soccer helped Tom and Sam become friends.'],
  ['「he didn\'t know anyone(톰은 아무도 알지 못했다)」고 했으므로 톰과 샘이 이사 오기 전부터 친구였다는 추론은 글과 어긋난다.',
   '첫날 점심에 혼자 앉아 조용히 먹었으니 외로웠을 것이고(①), 샘이 먼저 다가와 말을 걸었으니 친절했다(②).',
   'new school 에서 학교가 바뀌었음을, 축구 이야기로 친해져 지금은 가장 친한 친구가 되었다는 것에서 축구가 계기였음을 알 수 있다.'])

p = P(T, """Our school sports day was planned for last Friday. But it rained hard that morning, so the teachers moved it to the next Monday. We were very sad. We practiced relay races every day for two weeks! Instead, we watched a movie in the gym. After lunch, the rain stopped and the sun came out. “Now it's sunny!” Mina said, and everyone laughed.""")
q(T, 3, B('다음 글을 읽고 추론할 수 «없는» 것은?', p), '학생들은 금요일 오후에 운동장에서 이어달리기를 했다.',
  ['운동회는 비 때문에 미뤄졌다.', '학생들은 이어달리기를 열심히 연습했다.', '학생들은 운동회가 미뤄져서 아쉬워했다.', '금요일 오후에는 날씨가 맑아졌다.'],
  ['운동회는 다음 주 월요일로 옮겨졌고(moved it to the next Monday), 금요일에는 대신 체육관에서 영화를 보았다(Instead, we watched a movie in the gym).',
   '따라서 금요일 오후에 이어달리기를 했다는 추론은 글과 어긋난다.',
   '비 때문에 연기(①), 2주 동안 매일 연습(②), We were very sad(③), 점심 뒤 해가 나옴(④)은 모두 글에서 알 수 있다.'])

p = P(T, """Today I baked cookies for the first time. I used my mom's recipe, but I put in salt instead of sugar! The cookies looked perfect, but they tasted terrible. My dad ate one and made a funny face. We all laughed. My mom said, “Everyone makes mistakes. Let's try again this weekend.” I can't wait to bake better cookies.""")
q(T, 3, B('다음 글을 읽고 추론할 수 «없는» 것은?', p), "The writer's mom got angry about the mistake.",
  ['The writer never baked cookies before today.', "The writer's dad tasted a cookie.", 'The cookies tasted salty.', 'The writer will bake cookies again.'],
  ['엄마는 「누구나 실수를 해. 이번 주말에 다시 해 보자.」라고 격려했고, 가족 모두 웃었다. 따라서 엄마가 화를 냈다는 추론은 글과 어긋난다.',
   'for the first time → 오늘 처음 구웠다(①), My dad ate one → 아빠가 맛을 봤다(②), 설탕 대신 소금을 넣었다 → 짠맛이 났을 것이다(③).',
   "Let's try again this weekend, I can't wait to bake better cookies 에서 다시 구울 것을 알 수 있다(④)."])

p = P(T, """Every Saturday, Mr. Park opens his small bakery at seven in the morning. But last Saturday, the door was still closed at nine. People waited outside and looked worried. At ten, Mr. Park finally came with a big smile. “I'm sorry I'm late,” he said. “My daughter had a baby last night. I'm a grandfather now!” Everyone clapped, and he gave free bread to all his customers that day.""")
q(T, 4, B('다음 글을 읽고 추론할 수 «없는» 것은?', p), '박 씨는 기분이 좋지 않아서 가게 문을 늦게 열었다.',
  ['박 씨는 보통 토요일 아침 7시에 가게 문을 연다.', '사람들은 가게 문이 닫혀 있어 박 씨를 걱정했다.', '지난 토요일 박 씨는 평소보다 세 시간 늦게 가게에 왔다.', '박 씨는 손주가 태어난 것을 무척 기뻐했다.'],
  ['박 씨는 「with a big smile(환하게 웃으며)」 나타났고, 딸이 아기를 낳아 할아버지가 되었다고 기뻐하며 손님들에게 빵을 공짜로 주었다.',
   '늦은 이유는 손주가 태어났기 때문이지 기분이 나빠서가 아니다.',
   '평소 7시에 열고 지난 토요일에는 10시에 왔으므로 세 시간 늦었다(③). looked worried 에서 사람들이 걱정했음을 알 수 있다(②).'])

p = P(T, """Yuna wanted a new bike. Every week, she put 5,000 won from her pocket money into a jar. After 24 weeks, she had 120,000 won. Last Sunday, she went to a bike shop with her mom. The new bike she wanted was 150,000 won, so she bought a used bike for 70,000 won instead. With the rest of the money, she bought a warm scarf for her grandmother's birthday.""")
q(T, 5, B('윗글을 읽고 추론할 수 «없는» 것만을 <보기>에서 있는 대로 고른 것은?', p,
          '<보기>\nㄱ. 유나는 원하던 새 자전거를 사기에는 돈이 부족했다.\nㄴ. 유나는 자전거를 사고 남은 돈으로 할머니의 선물을 샀다.\nㄷ. 유나가 할머니의 선물을 사는 데 쓴 돈은 7만 원이다.\nㄹ. 유나는 자전거 가게에 혼자 갔다.'),
  'ㄷ, ㄹ', ['ㄱ, ㄴ', 'ㄱ, ㄷ', 'ㄴ, ㄹ', 'ㄱ, ㄷ, ㄹ'],
  ['유나가 모은 돈은 5,000원 × 24주 = 120,000원이고, 새 자전거는 150,000원이므로 돈이 부족했다(ㄱ은 추론 가능).',
   '중고 자전거를 70,000원에 사서 남은 돈은 120,000 − 70,000 = 50,000원이다. 그 돈으로 목도리를 샀으므로(ㄴ은 추론 가능) 선물에 7만 원을 썼다는 ㄷ은 틀리다.',
   '「she went to a bike shop with her mom(엄마와 함께 갔다)」이므로 혼자 갔다는 ㄹ도 추론할 수 없다.'])

# ───────────────────────── u0m1s4t1 도표·안내문 세부 정보 ─────────────────────────
T = 'u0m1s4t1'
n = """[Greenwood Library Book Fair]
- Date: Saturday, May 10
- Time: 10:00 a.m. – 4:00 p.m.
- Place: Greenwood Library, 1st floor
- Price: 2,000 won for each book
Please bring your own bag!"""
q(T, 1, B('다음 안내문을 읽고 알 수 «없는» 것은?', n), '주차할 수 있는지 여부',
  ['행사 날짜', '행사 시간', '행사 장소', '책 한 권의 가격'],
  ['안내문에는 날짜(5월 10일 토요일), 시간(오전 10시~오후 4시), 장소(도서관 1층), 가격(권당 2,000원)이 나와 있다.',
   '주차에 관한 내용은 어디에도 없다.'])

n = """[Summer Swimming Class]
- For: students aged 10 to 15
- When: July 21 – August 1 (Monday to Friday)
- Time: 9:00 – 10:30 a.m.
- Fee: 30,000 won
- Sign up at the front desk by July 15.
※ Please bring a swimming cap and goggles."""
q(T, 2, B('다음 안내문의 내용과 일치하지 «않는» 것은?', n), '신청은 7월 21일까지 받는다.',
  ['10세부터 15세까지의 학생이 참가할 수 있다.', '수업은 월요일부터 금요일까지 있다.', '수업은 한 번에 1시간 30분 동안 한다.', '수영모와 물안경을 가져와야 한다.'],
  ['「Sign up at the front desk by July 15.」 — 신청은 7월 15일까지이다. 7월 21일은 수업이 시작되는 날이다.',
   '9:00~10:30 이므로 한 번 수업은 1시간 30분이다.',
   'students aged 10 to 15, Monday to Friday, bring a swimming cap and goggles 로 나머지 보기를 확인할 수 있다.'])

n = """[Class 1-3 Field Trip Schedule — Friday, October 17]
8:30  Meet at the school gate
9:00  Leave by bus
10:30  Arrive at Sunny Farm
10:40 – 12:00  Pick apples
12:00 – 1:00  Lunch (Bring your own lunch.)
1:00 – 2:30  Make apple jam
3:00  Leave the farm
4:30  Arrive back at school"""
q(T, 3, B('다음 일정표의 내용과 일치하는 것은?', n), '학생들은 점심 도시락을 싸 와야 한다.',
  ['학생들은 9시에 학교 정문에 모인다.', '사과 따기는 점심 식사 후에 한다.', '잼 만들기는 2시간 동안 한다.', '학생들은 오후 3시에 학교에 도착한다.'],
  ['「Lunch (Bring your own lunch.)」 — 점심은 각자 싸 와야 한다.',
   '모이는 시각은 8:30이고 9:00은 버스 출발 시각이다. 사과 따기(10:40~12:00)는 점심 전이다.',
   '잼 만들기는 1:00~2:30으로 1시간 30분이고, 3:00은 농장에서 떠나는 시각, 학교 도착은 4:30이다.'])

n = """[Happy Zoo — Ticket Prices]
- Adults (20 and over): 10,000 won
- Teenagers (13–19): 7,000 won
- Children (4–12): 5,000 won
- Under 4: Free
※ On Wednesdays, every ticket is 1,000 won cheaper."""
q(T, 3, B('민수(14세)가 토요일에 엄마, 여동생(8세)과 함께 이 동물원에 간다면, 세 사람이 내야 할 입장료의 합은?', n), '22,000원',
  ['19,000원', '20,000원', '25,000원', '17,000원'],
  ['엄마는 어른(10,000원), 14세 민수는 Teenagers(7,000원), 8세 여동생은 Children(5,000원)이다.',
   '10,000 + 7,000 + 5,000 = 22,000원이다.',
   '수요일 할인(1,000원씩)은 토요일에는 적용되지 않으므로 19,000원은 틀리다. 민수를 어린이 요금으로 계산하면 20,000원이 되어 틀린다.'])

n = """Join the Hilltop Middle School Drama Club!
We are looking for new members.
- Who: 1st and 2nd graders
- Meetings: every Tuesday and Thursday after school, in Room 204
- Our show: We perform a play at the school festival in December.
- How to join: Visit Ms. Kim in the teachers' office by March 20.
No experience? No problem!"""
q(T, 4, B('다음 안내문을 읽고 답할 수 «없는» 질문은?', n), 'How many members does the club have now?',
  ['Which grades can join the club?', 'Where does the club meet?', 'When is the last day to join?', 'Do new members need any experience?'],
  ['현재 동아리 회원이 몇 명인지는 안내문에 나와 있지 않다.',
   '1·2학년(1st and 2nd graders), 204호(Room 204), 3월 20일까지(by March 20), 경험이 없어도 된다(No experience? No problem!)로 나머지 질문에는 답할 수 있다.'])

n = """[City Science Museum]
- Open: Tuesday – Sunday, 9:00 a.m. – 6:00 p.m. (Closed on Mondays)
- Tickets: Adults 8,000 won / Students 5,000 won
  ※ Show your student ID to get the student price.
- Special Event: “Space Night”
  Every Saturday, 7:00 – 9:00 p.m.
  Watch the stars through a telescope! (3,000 won extra)
※ No food or drinks inside the museum."""
q(T, 5, B('다음 안내문의 내용으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?', n,
          '<보기>\nㄱ. 월요일에는 박물관에 들어갈 수 없다.\nㄴ. 학생증을 보여 준 학생이 입장권을 사고 ‘Space Night’에도 참여하면 모두 8,000원을 낸다.\nㄷ. ‘Space Night’는 매주 일요일 저녁에 열린다.\nㄹ. 박물관 안에서 음료를 마실 수 있다.'),
  'ㄱ, ㄴ', ['ㄱ', 'ㄴ, ㄷ', 'ㄱ, ㄴ, ㄹ', 'ㄱ, ㄷ, ㄹ'],
  ['Closed on Mondays 이므로 ㄱ은 옳다.',
   '학생 요금 5,000원 + Space Night 추가 요금(extra) 3,000원 = 8,000원이므로 ㄴ은 옳다.',
   'Space Night 는 Every Saturday(매주 토요일)이므로 ㄷ은 틀리고, No food or drinks inside 이므로 ㄹ도 틀리다.'])

# ───────────────────────── u0m2s0t0 전체 흐름과 관계없는 문장 ─────────────────────────
T = 'u0m2s0t0'
p = P(T, """Pandas are famous for eating bamboo. ⓐ They spend many hours a day eating it. ⓑ Bamboo does not have much energy in it, so they need to eat a lot. ⓒ Pandas have a special bone like a thumb, and it helps them hold bamboo. ⓓ Tigers are also very popular animals at the zoo. ⓔ To save energy, pandas move slowly and rest a lot.""")
qf(T, 1, B('다음 글에서 전체 흐름과 관계 «없는» 문장은?', p), E5, 3,
   ['글은 판다가 대나무를 먹는 생활(하루에 여러 시간 먹기, 영양이 적어 많이 먹기, 엄지 같은 뼈, 에너지 아끼기)을 설명한다.',
    'ⓓ 「호랑이도 동물원에서 매우 인기 있는 동물이다.」는 판다와 대나무 이야기와 관계가 없다.',
    'ⓔ는 대나무에 에너지가 적다(ⓑ)는 내용과 이어지므로 흐름에 맞다.'])

p = P(T, """My family has a special rule on Sunday evenings. ⓐ From seven to nine, nobody uses a smartphone or watches TV. ⓑ Instead, we play board games or talk about our week. ⓒ My dad bought a new smartphone last month. ⓓ At first, I didn't like the rule very much. ⓔ But now Sunday evening is my favorite time of the week.""")
qf(T, 2, B('다음 글에서 전체 흐름과 관계 «없는» 문장은?', p), E5, 2,
   ['글은 일요일 저녁 7~9시에 스마트폰과 TV를 쓰지 않는 가족 규칙과, 그 규칙에 대한 글쓴이의 마음 변화를 말한다.',
    'ⓒ 「아빠는 지난달 새 스마트폰을 사셨다.」는 smartphone 이라는 낱말만 같을 뿐, 규칙과 관계가 없다.',
    'ⓓ(처음엔 싫었다)와 ⓔ(지금은 가장 좋아하는 시간)는 규칙에 대한 생각의 변화이므로 흐름에 맞다.'])

p = P(T, """Water is very important for our bodies. ⓐ Some bottled water in stores is very expensive. ⓑ About 60 percent of an adult's body is water. ⓒ Water helps us keep the right body temperature. ⓓ It also helps us digest food. ⓔ So you should drink enough water every day, especially on hot days or after exercise.""")
qf(T, 3, B('다음 글에서 전체 흐름과 관계 «없는» 문장은?', p, '*digest: 소화하다'), E5, 0,
   ['첫 문장은 「물은 우리 몸에 매우 중요하다.」이고, ⓑ~ⓔ는 몸의 약 60%가 물이다, 체온 유지, 소화, 그러니 물을 충분히 마셔라로 이어진다.',
    'ⓐ 「가게에서 파는 어떤 생수는 매우 비싸다.」는 물의 가격 이야기로, 몸에서 물이 하는 역할과 관계가 없다.',
    '관계없는 문장이 첫 번째 자리에 올 수도 있으니 자리로 짐작하지 말고 내용으로 판단한다.'])

p = P(T, """Kimchi is a traditional Korean food. ⓐ It is usually made with cabbage, red pepper powder, garlic, and salt. ⓑ In the past, Korean families made a lot of kimchi in late autumn. ⓒ They kept it in large pots and ate it during the cold winter. ⓓ This custom is called kimjang. ⓔ Many people also enjoy eating rice cakes on New Year's Day.""")
qf(T, 3, B('다음 글의 흐름으로 보아 어색한 문장은?', p), E5, 4,
   ['글은 김치의 재료와, 늦가을에 김치를 많이 담가 겨울 동안 먹던 풍습(김장)을 소개한다.',
    'ⓔ 「많은 사람이 설날에 떡도 즐겨 먹는다.」는 김치·김장과 관계가 없는 다른 음식 이야기이다.',
    'ⓓ의 This custom 은 ⓑ·ⓒ에서 말한 풍습을 가리키므로 흐름에 맞다.'])

p = P(T, """Many people think that sharks are very dangerous to humans. ⓐ However, shark attacks on people are very rare. ⓑ Some sharks can grow longer than a school bus. ⓒ Most sharks are not interested in people at all. ⓓ They usually eat fish and other sea animals. ⓔ In fact, people kill many more sharks than sharks kill people.""")
qf(T, 4, B('다음 글에서 전체 흐름과 관계 «없는» 문장은?', p), E5, 1,
   ['글의 흐름은 「상어가 위험하다고 생각하지만(첫 문장), 사실 상어가 사람을 공격하는 일은 드물다(ⓐ)」이다.',
    'ⓒ(사람에게 관심이 없음), ⓓ(주로 물고기를 먹음), ⓔ(사람이 상어를 훨씬 더 많이 죽임)는 모두 상어가 생각만큼 위험하지 않다는 근거이다.',
    'ⓑ 「어떤 상어는 스쿨버스보다 더 길게 자란다.」는 상어의 크기 이야기로, 상어가 위험하지 않다는 글의 흐름과 관계가 없다.',
    '모든 문장에 상어가 나오므로 낱말이 아니라 글이 말하려는 내용으로 판단해야 한다.'])

p = P(T, """Why do leaves change color in autumn? ⓐ Leaves are green because they have a green material called chlorophyll. ⓑ In autumn, the days get shorter, and trees stop making chlorophyll. ⓒ Many people go hiking in the mountains in autumn to see the colorful leaves. ⓓ Without new chlorophyll, the green color slowly disappears. ⓔ Then we can see the yellow and orange colors that were hidden under the green.""")
qf(T, 5, B('다음 글에서 전체 흐름과 관계 «없는» 문장은?', p, '*chlorophyll: 엽록소'), E5, 2,
   ['첫 문장 「가을에 나뭇잎은 왜 색이 변할까?」에 대한 답을 과학적 순서로 설명하는 글이다.',
    '초록 물질(엽록소) 때문에 잎이 초록색(ⓐ) → 가을에 낮이 짧아져 엽록소를 만들지 않음(ⓑ) → 초록색이 사라짐(ⓓ) → 숨어 있던 노란색·주황색이 보임(ⓔ)으로 이어진다.',
    'ⓒ 「많은 사람이 가을에 단풍을 보러 등산을 간다.」는 단풍과 관련된 낱말은 있지만 색이 변하는 까닭과 관계가 없고, ⓑ와 ⓓ 사이의 원인·결과 흐름을 끊는다.'])

# ───────────────────────── u0m2s1t0 주어진 문장이 들어갈 위치 ─────────────────────────
T = 'u0m2s1t0'
g = 'But it was too heavy for me.'
p = P(T, """Last Saturday, I helped my grandfather on his farm. ( A ) He asked me to carry a big box of potatoes. ( B ) So he gave me a smaller box. ( C ) I carried ten small boxes to his truck. ( D ) At the end of the day, my arms hurt, but I felt proud. ( E )""")
qf(T, 1, f'{INS}\n\n[주어진 문장]\n{g}\n\n{p}', A5, 1,
   ['주어진 문장 「하지만 그것은 나에게 너무 무거웠다.」의 it 은 앞의 a big box of potatoes 를 가리킨다.',
    '(B)에 넣으면 큰 상자를 옮기라고 하심 → 너무 무거웠음 → 그래서(So) 더 작은 상자를 주심으로 자연스럽다.',
    '(C) 이후는 이미 작은 상자를 받은 뒤라 「너무 무거웠다」가 어울리지 않는다.'])

g = 'For example, you can turn off the lights when you leave a room.'
p = P(T, """There are easy ways to save energy at home. ( A ) Also, you can unplug the phone charger when you don't use it. ( B ) These small actions can save a lot of electricity. ( C ) They can also help your family pay less money. ( D ) So why don't you start today? ( E )""")
qf(T, 2, f'{INS}\n\n[주어진 문장]\n{g}\n\n{p}', A5, 0,
   ['주어진 문장 「예를 들어, 방을 나갈 때 불을 끌 수 있다.」는 첫 번째 예시이다.',
    '(A) 뒤의 Also(또한)는 두 번째 예시(충전기 플러그 뽑기)를 이끄므로, 그 앞에 첫 번째 예시가 와야 한다.',
    '(B) 이후의 These small actions(이런 작은 행동들)는 예시들이 모두 나온 뒤에 오는 정리이므로, (B)~(E)에는 들어갈 수 없다.'])

g = 'He even covered his ears whenever she played.'
p = P(T, """When Hana was ten, she got a violin for her birthday. ( A ) At first, she could only make terrible sounds. ( B ) Her little brother laughed at her playing. ( C ) But Hana didn't give up and practiced every day. ( D ) Slowly, her sounds got better and better. ( E ) Last month, she played at a school concert, and her brother clapped the loudest.""")
qf(T, 3, f'{INS}\n\n[주어진 문장]\n{g}\n\n{p}', A5, 2,
   ['주어진 문장 「그는 심지어 그녀가 연주할 때마다 귀를 막았다.」의 He 는 남동생, even(심지어)은 앞의 놀림보다 더한 행동을 덧붙인다.',
    '따라서 「남동생이 그녀의 연주를 비웃었다.」 바로 뒤인 (C)에 와야 한다.',
    '(A)·(B)에는 He 가 가리킬 남자가 아직 나오지 않았고, (D) 이후는 하나가 포기하지 않고 실력이 나아지는 내용이라 흐름이 맞지 않는다.'])

g = 'A woman found Coco near the lake and called us.'
p = P(T, """Last Sunday, my family went to the park with our dog, Coco. ( A ) While we were having lunch, Coco ran after a cat and disappeared. ( B ) We looked for her everywhere, but we couldn't find her. ( C ) We went home. We were very sad. ( D ) That evening, the phone rang. ( E ) We ran back to the lake, and there was Coco, wagging her tail!""")
qf(T, 3, f'{INS}\n\n[주어진 문장]\n{g}\n\n{p}', A5, 4,
   ['주어진 문장 「한 여자분이 호수 근처에서 코코를 발견하고 우리에게 전화했다.」는 전화가 온 까닭을 밝힌다.',
    '(E)에 넣으면 저녁에 전화가 울림 → 여자분이 코코를 찾아 전화함 → 우리는 호수로 달려감으로 이어진다.',
    '(E) 뒤의 the lake 는 앞에서 호수가 언급되어야 쓸 수 있으므로 주어진 문장이 (E)에 와야 한다. (D)에 넣으면 전화가 울리기도 전에 전화를 한 셈이 되어 어색하다.'])

g = 'However, this was not true.'
p = P(T, """For a long time, people believed that the Earth was the center of the universe. ( A ) They thought the sun, the moon, and the stars moved around the Earth. ( B ) In the 1500s, a scientist named Copernicus had a different idea. ( C ) He said that the Earth moved around the sun. ( D ) At first, many people did not believe him. ( E ) Today, we know that he was right.""")
qf(T, 4, f'{INS}\n\n[주어진 문장]\n{g}\n\n{p}', A5, 1,
   ['주어진 문장 「그러나 이것은 사실이 아니었다.」의 this 는 사람들이 오랫동안 믿었던 생각(지구가 우주의 중심이고 해·달·별이 지구 주위를 돈다)을 가리킨다.',
    '따라서 옛 믿음의 설명이 끝난 뒤, 코페르니쿠스의 새로운 생각이 나오기 전인 (B)에 와야 한다.',
    '(A)에 넣으면 뒤의 They thought ~ 가 다시 옛 믿음을 설명하게 되어 흐름이 끊기고, (D)에 넣으면 코페르니쿠스의 옳은 주장을 틀렸다고 하는 셈이 되어 마지막 문장과 모순된다.'])

g = 'This way, they don\'t waste any food.'
p = P(T, """In Japan, many students eat lunch in their classroom. ( A ) Students take turns serving food to their classmates. ( B ) They wear white hats and aprons when they serve. ( C ) Each student gets only as much food as he or she can eat. ( D ) After lunch, they clean the classroom together. ( E )""")
qf(T, 5, f'{INS}\n\n[주어진 문장]\n{g}\n\n{p}', A5, 3,
   ['주어진 문장 「이렇게 해서 그들은 음식을 조금도 낭비하지 않는다.」의 This way(이런 방법)는 음식을 버리지 않게 하는 구체적인 방법을 가리켜야 한다.',
    '「각 학생은 자신이 먹을 수 있는 만큼만 음식을 받는다.」 바로 뒤인 (D)가 알맞다.',
    '(B)·(C)의 앞 문장(배식 당번, 흰 모자와 앞치마)은 음식 낭비와 관계가 없고, (E)의 앞 문장(교실 청소)도 음식을 아끼는 방법이 아니다.'])

# ───────────────────────── u0m2s3t0 빈칸에 알맞은 연결어 ─────────────────────────
T = 'u0m2s3t0'
q(T, 1, "다음 빈칸에 들어갈 말로 가장 적절한 것은?\n\nI wanted to go to the beach yesterday. ______, it rained all day, so I stayed home and read comic books.",
  'However', ['For example', 'Also', 'First', 'So'],
  ['앞 문장 「어제 해변에 가고 싶었다.」와 뒤 문장 「하루 종일 비가 와서 집에 있었다.」는 서로 반대되는 내용(대조)이다.',
   '대조를 나타내는 연결어는 However(그러나)이다.',
   'So(그래서)는 앞 내용의 결과를 이을 때 쓰는데, 해변에 가고 싶었던 것 때문에 비가 온 것은 아니다.'])

q(T, 2, "다음 빈칸에 들어갈 말로 가장 적절한 것은?\n\nJimin stayed up late playing games last night. ______, she was very sleepy in class this morning. She even fell asleep during math class.",
  'As a result', ['However', 'For example', 'In addition', 'On the other hand'],
  ['앞 문장 「지민이는 어젯밤 늦게까지 게임을 했다.」는 원인, 뒤 문장 「오늘 아침 수업 시간에 매우 졸렸다.」는 그 결과이다.',
   '결과를 나타내는 연결어는 As a result(그 결과)이다.',
   'However·On the other hand 는 대조, For example 은 예시, In addition 은 추가를 나타낸다.'])

q(T, 3, "다음 빈칸에 들어갈 말로 가장 적절한 것은?\n\nThere are many easy ways to stay healthy. ______, you can walk to school instead of taking the bus. You can also drink water instead of soda. Going to bed early is another good way.",
  'For example', ['However', 'As a result', 'Instead', 'On the other hand'],
  ['첫 문장 「건강을 지키는 쉬운 방법은 많다.」 뒤에 걸어서 등교하기, 탄산음료 대신 물 마시기, 일찍 자기가 구체적인 방법으로 이어진다.',
   '일반적인 내용 뒤에 구체적인 예를 들 때는 For example(예를 들어)을 쓴다.',
   'Instead(대신에)는 앞의 것을 하지 않고 다른 것을 할 때 쓰므로 여기에는 맞지 않다.'])

q(T, 3, "다음 빈칸에 들어갈 말로 가장 적절한 것은?\n\nI really like my new school. The teachers are kind, and the classes are fun. ______, the school cafeteria serves delicious food every day. I can't wait for lunchtime!",
  'In addition', ['However', 'So', 'Instead', 'Unfortunately'],
  ['앞에서 새 학교가 좋은 점(친절한 선생님, 재미있는 수업)을 말하고, 뒤에서 또 다른 좋은 점(맛있는 급식)을 덧붙인다.',
   '같은 방향의 내용을 덧붙일 때는 In addition(게다가)을 쓴다.',
   'However 는 대조, So 는 결과, Unfortunately(불행히도)는 좋지 않은 내용 앞에 쓰므로 맞지 않다.'])

q(T, 4, "다음 글의 빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?\n\nDolphins live in the sea, but they are not fish. (A)______, they are mammals like us. They breathe air through a hole on the top of their heads. (B)______, they have to come up to the surface of the water often.\n\n*mammal: 포유동물",
  'In fact – Therefore', ['For example – Therefore', 'In fact – However', 'As a result – However', 'For example – In addition'],
  ['(A) 앞 「돌고래는 바다에 살지만 물고기가 아니다.」 뒤에 「사실 그들은 우리처럼 포유동물이다.」라는 진짜 사실을 밝히므로 In fact(사실은)가 알맞다.',
   '(B) 앞 「머리 위의 구멍으로 공기를 들이마신다.」는 원인, 뒤 「그래서 물 위로 자주 올라와야 한다.」는 결과이므로 Therefore(그러므로)가 알맞다.',
   'For example 은 예시, However 는 대조, In addition 은 추가를 나타내므로 두 빈칸의 관계와 맞지 않다.'])

q(T, 5, "다음 글의 빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?\n\nSome students study with music on. They say music helps them relax. (A)______, other students need a quiet place to study. They can't focus when there is any sound around them. So, which way is better? There is no one right answer. (B)______, you should find the way that works best for you.",
  'On the other hand – Instead', ['For example – Instead', 'On the other hand – For example', 'As a result – However', 'In addition – For example'],
  ['(A) 앞은 음악을 들으며 공부하는 학생들, 뒤는 조용한 곳이 필요한 학생들로 서로 다른 두 무리를 맞세우므로 On the other hand(반면에)가 알맞다.',
   '(B) 앞 「정답은 하나가 아니다.」 뒤에 「(정해진 답을 찾는 대신) 자신에게 가장 잘 맞는 방법을 찾아야 한다.」가 오므로 Instead(대신에)가 알맞다.',
   '(A)에 For example·As a result·In addition 은 대조 관계를 나타내지 못하고, (B)에 For example 은 앞 문장의 예가 아니므로 맞지 않다.'])

# ───────────────────────── u0m3s1t1 함축적 의미 ─────────────────────────
T = 'u0m3s1t1'
p = P(T, """Yesterday we had a math test. I studied hard for a whole week, and I solved every problem in my workbook twice. So the test was [a piece of cake] for me. I finished it in only twenty minutes and had time to check all my answers again. My friends were surprised when I left the classroom first.""")
q(T, 1, B('다음 글의 [ ] 안의 말이 의미하는 바로 가장 알맞은 것은?', p), '아주 쉬운 일',
  ['맛있는 간식', '아주 어려운 일', '지루한 일', '예상하지 못한 일'],
  ['a piece of cake 는 「케이크 한 조각」이 아니라 「아주 쉬운 일」을 뜻하는 표현이다.',
   '일주일 동안 열심히 공부했고, 시험을 20분 만에 끝내고 답까지 다시 확인했다는 내용에서 시험이 매우 쉬웠음을 알 수 있다.',
   '시험을 빨리 끝냈으므로 「아주 어려운 일」은 글과 반대이다.'])

p = P(T, """When Grandpa started to tell the story about his trip to the North Pole, my little sister stopped playing with her doll. She sat right in front of him and didn't say a word. She was [all ears]. When the story ended, she asked, “Can you tell me another one?”""")
q(T, 2, B('다음 글의 [ ] 안의 말이 의미하는 바로 가장 알맞은 것은?', p), '매우 주의 깊게 듣고 있었다',
  ['귀가 아팠다', '졸려서 잠이 들었다', '이야기를 듣기 싫어했다', '소리를 잘 듣지 못했다'],
  ['all ears 는 「온통 귀가 되어」, 곧 「매우 열심히 귀 기울여 듣는」 모습을 뜻한다.',
   '인형 놀이를 멈추고 할아버지 바로 앞에 앉아 한마디도 하지 않았고, 이야기가 끝나자 하나 더 해 달라고 했다.',
   '다른 이야기를 더 해 달라고 했으므로 「듣기 싫어했다」나 「잠이 들었다」는 글과 맞지 않다.'])

p = P(T, """Minji's room was full of clothes, books, and snack bags. Her toys were all over the floor, and her bed was covered with paper. There was even a half-eaten sandwich on her desk. When her mom opened the door, she shouted, “Oh my! [This room is a zoo!]” Minji laughed and started to clean up her room.""")
q(T, 3, B('다음 글의 [ ] 안의 말이 의미하는 바로 가장 알맞은 것은?', p), '방이 매우 지저분하고 어수선하다.',
  ['방에서 동물을 많이 기르고 있다.', '방이 동물원처럼 넓고 크다.', '방에서 동물 냄새가 심하게 난다.', '방이 조용하고 깨끗하다.'],
  ['[ ]는 「이 방은 동물원이다!」라는 뜻이지만, 실제 동물원이 아니라 방이 동물원처럼 정신없고 어질러져 있다는 뜻이다.',
   '옷, 책, 과자 봉지, 장난감, 종이가 방 곳곳에 널려 있고, 민지가 웃으며 방을 치우기 시작했다는 내용이 근거이다.',
   '글에 동물을 기르거나 방이 넓다는 내용은 없으며, 「조용하고 깨끗하다」는 정반대이다.'])

p = P(T, """Our new teacher, Ms. Yoon, gave us a lot of homework on the first day. Everyone looked worried because it seemed too difficult. But she smiled and said, “Don't worry. [My door is always open.]” After that, whenever we had questions about the homework, we visited her office, and she always helped us kindly.""")
q(T, 3, B('다음 글의 [ ] 안의 말이 의미하는 바로 가장 알맞은 것은?', p), '언제든지 찾아와서 도움을 청해도 된다.',
  ['교실 문을 항상 열어 두어야 한다.', '선생님 방의 문이 고장 나 있다.', '숙제는 선생님 방 문 앞에 두고 가라.', '선생님은 항상 교무실에 없다.'],
  ['「내 방 문은 항상 열려 있다.」는 실제 문이 아니라 「언제든 찾아와도 된다」는 뜻이다.',
   '그 뒤로 숙제에 대해 궁금한 것이 있을 때마다 선생님을 찾아갔고, 선생님은 늘 친절하게 도와주셨다는 내용이 근거이다.',
   '문 자체(고장, 열어 두기)에 대한 보기들은 겉뜻만 본 것이다.'])

p = P(T, """Jake always talked about his big plans. “I'll run a marathon next year,” he said. “I'll learn three languages!” But he never started anything. One day, his grandmother smiled and said, “[Talking about a dream doesn't move your feet.]” The next morning, Jake put on his running shoes and went for his first short run.""")
q(T, 4, B('다음 글의 [ ] 안의 말이 의미하는 바로 가장 알맞은 것은?', p), 'You have to take action, not just talk.',
  ['You should not run a marathon.', 'Talking with friends is good for your health.', 'You should dream bigger dreams.', 'Learning languages is harder than running.'],
  ['제이크는 큰 계획을 말하기만 하고 아무것도 시작하지 않았다(he never started anything).',
   '「꿈에 대해 말하는 것이 너의 발을 움직이지는 않는다.」는 말만 해서는 이룰 수 없으니 실제로 행동해야 한다는 뜻이다.',
   '할머니의 말을 들은 다음 날 제이크가 실제로 달리기를 시작한 것이 근거이다. 마라톤을 하지 말라거나 꿈을 더 크게 가지라는 뜻은 아니다.'])

p = P(T, """Sora was the best swimmer on her team, and she knew it. She often skipped practice because she thought she didn't need it. At the city swimming contest, she finished fourth. The winner was a quiet girl who never missed practice. On the way home, Sora's coach said, “Talent opens the door, but [practice keeps you in the room].”""")
q(T, 5, B('다음 글의 [ ] 안의 말이 의미하는 바로 가장 알맞은 것은?', p, '*talent: 재능'), '재능이 있어도 꾸준히 연습해야 계속 잘할 수 있다.',
  ['재능이 없는 사람은 대회에 나갈 수 없다.', '연습은 방 안에서 해야 효과가 있다.', '재능이 있으면 연습하지 않아도 된다.', '대회에서 이기는 것보다 즐기는 것이 더 중요하다.'],
  ['코치의 말 「재능은 문을 열어 주지만, 연습은 너를 그 방 안에 머물게 한다.」에서 「방 안에 머문다」는 잘하는 자리를 계속 지킨다는 뜻이다.',
   '재능이 뛰어났던 소라는 연습을 자주 빼먹어 4등을 했고, 연습을 빠지지 않은 조용한 소녀가 우승했다.',
   '따라서 재능이 있어도 꾸준한 연습이 있어야 계속 잘할 수 있다는 뜻이다. 「재능이 있으면 연습하지 않아도 된다」는 소라의 잘못된 생각이다.'])

# ───────────────────────── u2m0s2t0 문장에서 틀린 부분 찾아 고치기 (서술형) ─────────────────────────
T = 'u2m0s2t0'
s(T, 1, '다음 문장에서 어법상 틀린 부분을 찾아 바르게 고쳐 쓰시오.\n\nMy brother play soccer after school every day.',
  'play → plays  [채점 포인트] 틀린 곳 play 를 찾아 plays 로 고치면 정답.',
  ['주어 My brother 는 3인칭 단수이고, every day 가 있어 현재 시제이다.',
   '3인칭 단수 주어의 현재 시제 일반동사에는 -s 를 붙인다: play → plays.',
   '해석: 내 형(남동생)은 매일 방과 후에 축구를 한다.'], essay=True)

s(T, 2, '다음 문장에서 어법상 틀린 부분을 찾아 바르게 고쳐 쓰시오.\n\nYesterday, I go to the library with my friend.',
  'go → went  [채점 포인트] go 를 과거형 went 로 고치면 정답(goed 는 오답).',
  ['Yesterday(어제)는 과거를 나타내는 말이므로 동사도 과거형이어야 한다.',
   'go 의 과거형은 불규칙 변화 went 이다. goed 라고 쓰면 틀린다.',
   '해석: 어제 나는 친구와 함께 도서관에 갔다.'], essay=True)

s(T, 3, '다음 두 문장에서 어법상 틀린 부분을 각각 하나씩 찾아 바르게 고쳐 쓰시오.\n\n(1) She can speaks Chinese very well.\n(2) There is many people in the park.',
  '(1) speaks → speak  (2) is → are  [채점 포인트] 두 곳을 모두 바르게 고쳐야 정답(한 곳만 맞으면 부분 점수).',
  ['(1) 조동사 can 뒤에는 동사원형이 온다: can speaks → can speak. (해석: 그녀는 중국어를 아주 잘할 수 있다.)',
   '(2) There is/are 뒤에 오는 말이 주어이다. many people 은 복수이므로 There are 를 쓴다. (해석: 공원에 많은 사람들이 있다.)'], essay=True)

s(T, 3, '다음 대화에서 어법상 틀린 부분을 찾아 바르게 고쳐 쓰시오.\n\nA: Does your sister likes spicy food?\nB: No, she doesn\'t. She likes sweet food.',
  'likes → like (A의 문장)  [채점 포인트] Does 뒤의 likes 를 동사원형 like 로 고치면 정답. B의 likes 는 맞는 표현이다.',
  ['Does 로 시작하는 의문문에서는 3인칭 단수의 -s 를 Does 가 이미 나타내므로 뒤의 동사는 동사원형을 쓴다.',
   '따라서 Does your sister likes → Does your sister like 로 고친다.',
   'B의 She likes sweet food. 는 평서문이므로 likes 가 맞다. (해석: A: 네 언니(여동생)는 매운 음식을 좋아하니? B: 아니, 안 좋아해. 단 음식을 좋아해.)'], essay=True)

s(T, 4, '다음 글의 ⓐ~ⓔ 중 어법상 틀린 것을 두 개 찾아 기호를 쓰고, 바르게 고쳐 쓰시오.\n\nLast weekend, my family ⓐ[went] camping. We ⓑ[set] up a tent near a river. At night, my dad ⓒ[cooks] sausages over the fire. We ⓓ[was] very happy. I want ⓔ[to go] camping again.',
  'ⓒ cooks → cooked, ⓓ was → were  [채점 포인트] 기호 두 개와 고친 형태가 모두 맞아야 정답.',
  ['글 전체가 Last weekend(지난 주말)의 일이므로 과거 시제를 써야 한다. ⓒ cooks → cooked.',
   '주어 We 는 복수이므로 be동사 과거형은 were 이다. ⓓ was → were.',
   'ⓑ set 은 과거형도 set 이므로 맞다. ⓐ went, ⓔ want to go 도 맞다.'], essay=True)

s(T, 5, '다음 글에서 어법상 틀린 부분 3개를 찾아 바르게 고쳐 쓰시오.\n\nMy friend Yuri lives next door. She have a cute cat. Its name is Nabi. Every morning, Nabi sits by the window and watch the birds. Yesterday, Nabi catched a butterfly in the garden. Yuri was very surprised.',
  'have → has, watch → watches, catched → caught  [채점 포인트] 세 곳을 모두 찾아 바르게 고쳐야 정답. Its 는 맞는 표현이므로 고치면 감점.',
  ['She 는 3인칭 단수이므로 have → has.',
   'Nabi sits ~ and watch ~ 에서 and 로 이어진 두 동사는 같은 형태여야 한다(주어 Nabi, 현재): watch → watches.',
   'catch 의 과거형은 불규칙 변화 caught 이다: catched → caught.',
   'Its name 의 Its 는 「그것의」라는 소유격이므로 맞다(It\'s 는 It is 의 줄임말).'], essay=True)

# ───────────────────────── u2m0s3t1 본문 내용 우리말로 쓰기 (서술형) ─────────────────────────
T = 'u2m0s3t1'
p = P(T, """Hi, I'm Daniel. I'm from Canada, and I live in Seoul now. I go to Hanbit Middle School. My favorite subject is art because I love drawing. After school, I often go to the park and draw cartoons of people and animals there. I want to be a cartoonist in the future.""")
s(T, 1, B('윗글에서 Daniel이 미술을 가장 좋아하는 이유를 우리말로 쓰시오.', p),
  '그림 그리는 것을 아주 좋아하기 때문이다.  [채점 포인트] ‘그림 그리기를 좋아한다’는 내용이 들어가면 정답.',
  ['근거 문장: My favorite subject is art because I love drawing.',
   '해석: 나는 그림 그리는 것을 아주 좋아하기 때문에 내가 가장 좋아하는 과목은 미술이다.',
   'because 뒤가 이유이다.'], essay=True)

p = P(T, """Every Saturday morning, I go to the animal shelter near my house. I walk the dogs and clean their rooms. I also give them food and water. The work is hard, but I love it. Some of the dogs are old, and some are still puppies. They always wag their tails when they see me.""")
s(T, 2, B('윗글의 글쓴이가 토요일마다 동물 보호소에서 하는 일 세 가지를 우리말로 쓰시오.', p, '*animal shelter: 동물 보호소'),
  '개들을 산책시키고, 개들의 방(우리)을 청소하고, 개들에게 먹이와 물을 준다.  [채점 포인트] 산책시키기·청소하기·먹이와 물 주기 세 가지가 모두 들어가야 정답.',
  ['근거 문장: I walk the dogs and clean their rooms. I also give them food and water.',
   '해석: 나는 개들을 산책시키고 개들의 방을 청소한다. 또한 개들에게 먹이와 물을 준다.',
   '「일이 힘들지만 좋아한다」, 「개들이 꼬리를 흔든다」는 하는 일이 아니므로 답에 넣지 않는다.'], essay=True)

p = P(T, """Have you ever heard of the “two-minute rule”? It is very simple. If a job takes less than two minutes, do it right away. For example, hang up your coat when you come home, or wash your cup after you drink. If you do this, you won't have a lot of small jobs later, and your room will stay clean.""")
s(T, 3, B('윗글에서 설명하는 ‘2분 규칙’이 무엇인지 우리말로 쓰시오.', p),
  '2분이 안 걸리는 일은 바로(미루지 말고 즉시) 하는 것이다.  [채점 포인트] ‘2분이 안 걸리는 일’과 ‘바로 한다’ 두 요소가 모두 있어야 정답.',
  ['근거 문장: If a job takes less than two minutes, do it right away.',
   '해석: 어떤 일이 2분보다 적게 걸린다면, 그것을 바로 해라.',
   '코트 걸기·컵 씻기는 규칙의 예일 뿐이므로, 예만 쓰고 규칙을 쓰지 않으면 정답이 아니다.'], essay=True)

p = P(T, """Minsu wanted to be healthier, so he made two rules for himself. First, he doesn't drink soda anymore. He drinks water or milk instead. Second, he takes the stairs, not the elevator, at school and at home. After two months, he feels much stronger than before, and he sleeps better at night, too.""")
s(T, 3, B('윗글에서 민수가 스스로 세운 규칙 두 가지를 우리말로 쓰시오.', p, '*soda: 탄산음료'),
  '(1) 탄산음료를 마시지 않고 대신 물이나 우유를 마신다. (2) 학교와 집에서 엘리베이터 대신 계단을 이용한다.  [채점 포인트] 두 규칙이 모두 들어가야 정답(하나만 쓰면 부분 점수).',
  ['First 와 Second 로 두 규칙이 소개된다.',
   '해석: 첫째, 그는 더 이상 탄산음료를 마시지 않는다. 그는 대신 물이나 우유를 마신다. 둘째, 그는 학교와 집에서 엘리베이터가 아니라 계단을 이용한다.',
   '「두 달 뒤 훨씬 더 튼튼해졌다」는 규칙이 아니라 결과이다.'], essay=True)

p = P(T, """I didn't like reading at all. Books were boring to me. Then one day, my cousin gave me a comic book about Korean history. It was really funny, and I read it three times! After that, I started to read more history books. Now I think books can be as fun as movies.""")
s(T, 4, B('윗글에서 글쓴이가 책에 대한 생각을 바꾸게 된 계기와, 바뀐 생각을 우리말로 쓰시오.', p),
  '계기: 사촌이 준 한국사 만화책을 아주 재미있게 읽었다(세 번이나 읽었다). 바뀐 생각: 책도 영화만큼 재미있을 수 있다.  [채점 포인트] 계기(사촌이 준 한국사 만화책)와 바뀐 생각(책도 영화만큼 재미있다) 두 가지가 모두 있어야 정답.',
  ['처음 생각: I didn\'t like reading at all. Books were boring to me. (책은 지루했다)',
   '계기: my cousin gave me a comic book about Korean history. It was really funny ~ (사촌이 준 한국사 만화책이 정말 재미있었다)',
   '바뀐 생각: Now I think books can be as fun as movies. (as ~ as: ~만큼 …한)'], essay=True)

p = P(T, """Last month, I lost my wallet on the bus. I thought I would never see it again. But the next day, a bus driver called me. Someone found my wallet and gave it to him. Nothing was missing! I don't know that person's name, but I want to be like that person. Now, when I find something on the street, I always take it to the police station.""")
s(T, 5, B('윗글을 읽고, (1) 글쓴이가 지갑을 되찾게 된 과정과 (2) 그 뒤 글쓴이의 행동이 어떻게 달라졌는지를 각각 우리말로 쓰시오.', p),
  '(1) 누군가 지갑을 발견해 버스 기사님께 주었고, 다음 날 기사님이 글쓴이에게 전화해 주었다. (2) 길에서 물건을 주우면 항상 경찰서에 가져다준다.  [채점 포인트] (1)은 ‘누군가 주워 기사님께 줌’과 ‘기사님이 연락함’, (2)는 ‘주운 물건을 경찰서에 가져다줌’이 있어야 정답.',
  ['(1) 근거: the next day, a bus driver called me. Someone found my wallet and gave it to him.',
   '해석: 다음 날 버스 기사님이 나에게 전화했다. 누군가 내 지갑을 발견해서 그에게 주었다.',
   '(2) 근거: Now, when I find something on the street, I always take it to the police station.',
   '해석: 이제 나는 길에서 무언가를 발견하면 언제나 그것을 경찰서에 가져간다. 지갑을 찾아 준 사람처럼 되고 싶었기 때문이다.'], essay=True)

# ───────────────────────── u3m1s0t0 문장 해석 ─────────────────────────
T = 'u3m1s0t0'
q(T, 1, '다음 문장의 해석으로 가장 알맞은 것은?\n\nI usually get up at seven in the morning.', '나는 보통 아침 7시에 일어난다.',
  ['나는 항상 아침 7시에 일어난다.', '나는 보통 저녁 7시에 잠자리에 든다.', '나는 어제 아침 7시에 일어났다.', '나는 보통 아침 7시에 학교에 간다.'],
  ['usually 는 「보통, 대개」, get up 은 「일어나다」, at seven in the morning 은 「아침 7시에」이다.',
   'always(항상)와 usually(보통)는 뜻이 다르고, 현재 시제이므로 「일어났다」도 틀리다.'])

q(T, 2, '다음 문장의 해석으로 가장 알맞은 것은?\n\nCan you help me with my homework?', '내 숙제 좀 도와줄 수 있니?',
  ['너는 숙제를 할 수 있니?', '내가 네 숙제를 도와줄 수 있어.', '너는 내 숙제를 도와줬니?', '내가 네 숙제를 해도 되니?'],
  ['Can you ~? 는 「~해 줄 수 있니?」라는 부탁의 표현이다.',
   'help A with B 는 「A가 B 하는 것을 돕다」이므로 help me with my homework 는 「내 숙제를 도와주다」이다.',
   '도와주는 사람은 you(너), 도움을 받는 사람은 me(나)이다.'])

q(T, 3, '다음 문장의 해석으로 가장 알맞은 것은?\n\nThere were a lot of people at the concert last night.', '어젯밤 콘서트에는 많은 사람들이 있었다.',
  ['어젯밤 콘서트에는 사람이 별로 없었다.', '오늘 밤 콘서트에는 많은 사람들이 올 것이다.', '많은 사람들이 어젯밤 콘서트를 좋아했다.', '어젯밤 많은 사람들이 콘서트를 열었다.'],
  ['There were ~ 는 「~이 있었다」라는 뜻이고, a lot of people 은 「많은 사람들」이다.',
   'last night(어젯밤)이므로 미래(올 것이다)는 틀리고, 좋아했다·열었다는 문장에 없는 내용이다.'])

q(T, 3, '다음 문장의 해석으로 가장 알맞은 것은?\n\nYou should not use your phone in the library.', '도서관에서는 휴대 전화를 사용하지 말아야 한다.',
  ['도서관에서 휴대 전화를 사용해도 된다.', '도서관에서 휴대 전화를 잃어버리면 안 된다.', '너는 도서관에서 휴대 전화를 사용할 수 없었다.', '도서관에서는 휴대 전화를 꼭 사용해야 한다.'],
  ['should not 은 「~하지 말아야 한다(~하지 않는 것이 좋다)」라는 충고의 뜻이다.',
   'use 는 「사용하다」이므로 「잃어버리다」는 틀리고, 과거(없었다)도 아니다.'])

q(T, 4, '다음 중 문장의 해석이 바르지 «않은» 것은?', 'My brother is good at swimming. — 내 남동생은 수영하는 것을 좋아한다.',
  ['She is taller than her mother. — 그녀는 엄마보다 키가 크다.', 'I was watching TV when he called. — 그가 전화했을 때 나는 TV를 보고 있었다.',
   'We will visit the museum next week. — 우리는 다음 주에 박물관을 방문할 것이다.', 'He has to finish the work today. — 그는 오늘 그 일을 끝내야 한다.'],
  ['be good at ~ 은 「~을 잘하다」이다. 따라서 「내 남동생은 수영을 잘한다」로 해석해야 한다. 「좋아한다」는 like 의 뜻이다.',
   'taller than(~보다 키가 큰), was watching(보고 있었다), will visit(방문할 것이다), has to(~해야 한다)는 모두 바르게 해석되었다.'])

q(T, 5, '다음 <보기>의 문장 중 해석이 바른 것만을 있는 대로 고른 것은?\n\n<보기>\nㄱ. It will be sunny tomorrow. → 내일은 화창할 것이다.\nㄴ. How often do you exercise? → 너는 얼마나 오래 운동하니?\nㄷ. I stayed home because I was sick. → 나는 아파서 집에 있었다.\nㄹ. You don\'t have to bring lunch. → 너는 점심을 가져오면 안 된다.',
  'ㄱ, ㄷ', ['ㄱ, ㄴ', 'ㄴ, ㄹ', 'ㄱ, ㄷ, ㄹ', 'ㄴ, ㄷ, ㄹ'],
  ['ㄱ: will be sunny = 화창할 것이다(바름). ㄷ: because I was sick = 아팠기 때문에(바름).',
   'ㄴ: How often 은 「얼마나 자주」이다. 「얼마나 오래」는 How long 이므로 틀리다.',
   'ㄹ: don\'t have to 는 「~할 필요가 없다」이다. 「~하면 안 된다」는 must not 이므로 틀리다.'])

save(os.path.expanduser('~/hakseupji-deploy/_gen/eng-m1/p-seed.json'))
print('지문 단어 수:', WC)
