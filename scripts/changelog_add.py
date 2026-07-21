#!/usr/bin/env python3
"""changelog_add.py "제목" "설명" — public/changelog.json 맨 앞에 항목 추가.

배포마다 실행할 것: 앱이 이 파일을 3분 폴링해 사용자에게 업데이트 배너를 띄운다.
"""
import json
import sys
from datetime import datetime
from pathlib import Path

if len(sys.argv) < 3:
    sys.exit('사용법: changelog_add.py "제목" "설명"')

path = Path(__file__).resolve().parent.parent / 'public' / 'changelog.json'
items = json.loads(path.read_text(encoding='utf-8'))
items.insert(0, {
    'ts': datetime.now().strftime('%Y-%m-%d %H:%M'),
    'title': sys.argv[1],
    'detail': sys.argv[2],
})
path.write_text(json.dumps(items, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'✅ changelog 추가: {sys.argv[1]} ({len(items)}건)')
