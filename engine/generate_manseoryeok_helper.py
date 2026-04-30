#!/usr/bin/env python3
"""
generate_manseoryeok_helper.py — 만세력 HTML 생성 (Python)
만세력표를 생성하여 HTML 파일로 저장합니다.
"""

import sys
import json
from pathlib import Path

# sys.path 설정
engine_dir = Path(__file__).parent
sys.path.insert(0, str(engine_dir.parent / 'banya_web'))

from saju_engine import calculate_saju, analyze_ohaeng
from saju_engine.heavenly_earthly import HEAVENLY_OHAENG, EARTHLY_OHAENG, to_korean_reading


def generate_manseoryeok(slot_id, queue_dir=None, tables_dir=None):
    """
    사주 데이터로부터 만세력.html 생성

    Args:
        slot_id: 슬롯 ID (예: sample_436)
        queue_dir: queue 폴더 경로
        tables_dir: tables 폴더 경로
    """

    if queue_dir is None:
        queue_dir = engine_dir / 'queue'
    else:
        queue_dir = Path(queue_dir)

    if tables_dir is None:
        tables_dir = engine_dir / 'tables'
    else:
        tables_dir = Path(tables_dir)

    # ── 데이터 파일 로드 ──────────────────────────
    master_file = queue_dir / f"{slot_id}_master_preprocessed.json"

    if not master_file.exists():
        print(f"❌ 없음: {master_file}", file=sys.stderr)
        sys.exit(1)

    with open(master_file, 'r', encoding='utf-8') as f:
        master = json.load(f)

    # ── 사주 계산 ──────────────────────────────────
    birth_year = int(master.get('생년', 1990))
    birth_month = int(master.get('생월', 1))
    birth_day = int(master.get('생일', 1))
    birth_time_str = master.get('생시', '00:00')

    # 시간 파싱
    hour = 0
    if ':' in birth_time_str:
        try:
            hour = int(birth_time_str.split(':')[0])
        except:
            hour = 0

    # 사주 계산
    res = calculate_saju(
        birth_year, birth_month, birth_day,
        hour, 0,
        is_lunar=bool(master.get('음력입력', 0)),
        is_leap=bool(master.get('윤달', 0)),
        gender='M' if master.get('성별', '남') == '남' else 'F'
    )

    # ── 기본 정보 ──────────────────────────────────
    name = master.get('이름', '—')
    gender_kr = '남성' if master.get('성별', '남') == '남' else '여성'
    age = 2026 - birth_year  # 현재 연도: 2026
    birth_solar = res['input']['solar_date']
    birth_lunar = res['input']['lunar_date']

    # ── 만세력 데이터 ──────────────────────────────
    p = res['pillars']
    ms = res['manseryeok']

    # 오행 영문 변환
    oh_eng = {'목': 'wood', '화': 'fire', '토': 'earth', '금': 'metal', '수': 'water'}

    def get_ohaeng_class(stem_or_branch):
        """천간 또는 지지 → CSS 클래스명 (wood, fire, earth, metal, water)"""
        if stem_or_branch in HEAVENLY_OHAENG:
            oh_kr = HEAVENLY_OHAENG[stem_or_branch]
        elif stem_or_branch in EARTHLY_OHAENG:
            oh_kr = EARTHLY_OHAENG[stem_or_branch]
        else:
            return 'metal'
        return oh_eng.get(oh_kr, 'earth')

    manseryeok_data = {
        'year': {
            'sipseong_stem': ms['year']['sipseong_stem'] or '—',
            'stem': p['year']['stem'],
            'stem_kr': to_korean_reading(p['year']['stem']),
            'stem_element': get_ohaeng_class(p['year']['stem']),
            'branch': p['year']['branch'],
            'branch_kr': to_korean_reading(p['year']['branch']),
            'branch_element': get_ohaeng_class(p['year']['branch']),
        },
        'month': {
            'sipseong_stem': ms['month']['sipseong_stem'] or '—',
            'stem': p['month']['stem'],
            'stem_kr': to_korean_reading(p['month']['stem']),
            'stem_element': get_ohaeng_class(p['month']['stem']),
            'branch': p['month']['branch'],
            'branch_kr': to_korean_reading(p['month']['branch']),
            'branch_element': get_ohaeng_class(p['month']['branch']),
        },
        'day': {
            'sipseong_stem': ms['day']['sipseong_stem'] or '—',
            'stem': p['day']['stem'],
            'stem_kr': to_korean_reading(p['day']['stem']),
            'stem_element': get_ohaeng_class(p['day']['stem']),
            'branch': p['day']['branch'],
            'branch_kr': to_korean_reading(p['day']['branch']),
            'branch_element': get_ohaeng_class(p['day']['branch']),
        },
        'time': {
            'sipseong_stem': ms['time']['sipseong_stem'] or '—',
            'stem': p['time']['stem'],
            'stem_kr': to_korean_reading(p['time']['stem']),
            'stem_element': get_ohaeng_class(p['time']['stem']),
            'branch': p['time']['branch'],
            'branch_kr': to_korean_reading(p['time']['branch']),
            'branch_element': get_ohaeng_class(p['time']['branch']),
        }
    }

    # ── 템플릿 렌더링 ──────────────────────────────
    template_path = engine_dir / 'templates' / 'manseoryeok_table.html'
    if not template_path.exists():
        print(f"❌ 없음: {template_path}", file=sys.stderr)
        sys.exit(1)

    with open(template_path, 'r', encoding='utf-8') as f:
        template = f.read()

    # 간단한 템플릿 렌더링
    html = template

    # {{var|default('...')}} 처리
    html = html.replace("{{ user_profile.name }}", name)
    html = html.replace("{{ user_profile.gender_kr|default('남성') }}", gender_kr)
    html = html.replace("{{ user_profile.age }}", str(age))
    html = html.replace("{{ user_profile.birth_solar|default('-') }}", birth_solar)
    html = html.replace("{{ user_profile.birth_lunar|default('-') }}", birth_lunar)

    # manseryeok 데이터 주입
    for pillar_key, pillar_name in [('time', 'time'), ('day', 'day'), ('month', 'month'), ('year', 'year')]:
        data = manseryeok_data[pillar_key]

        # 천간 십성
        html = html.replace(
            f"{{{{ manseryeok['{pillar_key}'].sipseong_stem|default('-') }}}}",
            data['sipseong_stem']
        )

        # 천간 한자, 한글, 오행 클래스
        html = html.replace(
            f"{{{{ manseryeok['{pillar_key}'].stem }}}}",
            data['stem']
        )
        html = html.replace(
            f"{{{{ manseryeok['{pillar_key}'].stem_kr }}}}",
            data['stem_kr']
        )
        html = html.replace(
            f"{{{{ manseryeok['{pillar_key}'].stem_element }}}}",
            data['stem_element']
        )

        # 지지 한자, 한글, 오행 클래스
        html = html.replace(
            f"{{{{ manseryeok['{pillar_key}'].branch }}}}",
            data['branch']
        )
        html = html.replace(
            f"{{{{ manseryeok['{pillar_key}'].branch_kr }}}}",
            data['branch_kr']
        )
        html = html.replace(
            f"{{{{ manseryeok['{pillar_key}'].branch_element }}}}",
            data['branch_element']
        )

    # CSS 스타일 추가
    css = """
<style>
:root {
  --wood: #4caf50;
  --fire: #f44336;
  --earth: #ffc107;
  --metal: #9e9e9e;
  --water: #2196f3;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { font-family: 'Noto Sans KR', sans-serif; background: white; }

.manseoryeok-container {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 30px;
  background: white;
}

.header-unified-box {
  border: 2px solid #333;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  background: #fafaf8;
}

.info-section { display: flex; gap: 20px; align-items: flex-start; }
.character-circle { width: 80px; height: 80px; border-radius: 50%; background: #f5f5f5; border: 2px solid #ddd; display: flex; align-items: center; justify-content: center; font-size: 40px; }

.info-table-container { flex: 1; width: 100%; border-collapse: collapse; }
.info-table-container tr:not(:last-child) { border-bottom: 1px solid #ddd; }
.info-cell { padding: 10px 12px; font-size: 13px; }
.info-cell.label { background: #f0f0f0; font-weight: bold; color: #333; width: 80px; }
.info-cell.value { color: #555; text-align: left; }
.info-cell.title-cell { background: #333; color: white; font-weight: bold; font-size: 14px; }

.manseoryeok-table-wrapper { overflow-x: auto; border: 2px solid #333; border-radius: 8px; }
.manseoryeok-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.manseoryeok-table thead { background: #333; color: white; }
.manseoryeok-table th { padding: 12px; text-align: center; font-weight: bold; border-right: 1px solid #666; }
.manseoryeok-table th:last-child { border-right: none; }
.manseoryeok-table td { padding: 10px; border: 1px solid #ddd; text-align: center; }

.label-cell { background: #f5f5f5; font-weight: bold; width: 120px; text-align: center; }
.label-hanja { display: block; font-size: 10px; color: #888; margin-top: 2px; }

.sipseong { font-weight: bold; color: #333; padding: 8px 4px; border-radius: 4px; }
.sipseong.primary { background: #fff9e6; color: #d97706; }
.sipseong.normal { background: white; }

.ganji-box { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; width: 70px; height: 70px; border-radius: 8px; color: white; font-weight: bold; gap: 2px; }
.ganji-box.wood { background: var(--wood); }
.ganji-box.fire { background: var(--fire); }
.ganji-box.earth { background: var(--earth); color: #333; }
.ganji-box.metal { background: var(--metal); }
.ganji-box.water { background: var(--water); }

.ganji-box .hanja { font-size: 20px; font-family: 'Noto Serif KR', serif; font-weight: 700; }
.ganji-box .hangul { font-size: 10px; opacity: 0.9; }
</style>
    """

    full_html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{name}님의 만세력 - 천명 설계도</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Noto+Serif+KR:wght@400;700&display=swap" rel="stylesheet">
  {css}
</head>
<body>
  {html}
</body>
</html>"""

    # ── 파일 저장 ────────────────────────────────
    slot_table_dir = tables_dir / slot_id
    slot_table_dir.mkdir(parents=True, exist_ok=True)

    output_path = slot_table_dir / '만세력.html'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(full_html)

    print(f"✅ 만세력: {output_path.relative_to(engine_dir)}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('❌ 사용법: python3 generate_manseoryeok_helper.py <slot_id>', file=sys.stderr)
        sys.exit(1)

    slot_id = sys.argv[1]
    try:
        generate_manseoryeok(slot_id)
    except Exception as e:
        print(f'❌ 오류: {e}', file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
