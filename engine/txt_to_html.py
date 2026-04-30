#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
txt_to_html.py  —  사주집필 마커 기반 HTML 어셈블러
=====================================================
사용법:
  python txt_to_html.py <input_txt> [<output_html>] [--slot SLOT_ID]

예시:
  python txt_to_html.py queue/s11_all_임효원_result.txt
  python txt_to_html.py queue/s11_all_임효원_result.txt output/s11_임효원_final.html --slot s11

마커 문법 (txt 파일 내 삽입):
  [[TABLE:사주기본표]]       → engine/tables/{slot_id}/사주기본표.html 삽입
  [[TABLE:오행점수표]]       → engine/tables/{slot_id}/오행점수표.html 삽입
  [[PAGEBREAK]]              → 강제 페이지 나누기

txt 구조 마커:
  ☯ 장 제목 ☯              → <chapter-title>
  ✦ 섹션 제목               → <section-title>
  ✺ 절 제목                 → <subsection-title> (절 번호 포함)
  ◈ 소항목 제목             → <subsection-title>
  ★ 불릿 그룹 제목          → 굵은 단락 (구: ◎)
  ▸ 본문 불릿               → <bullet-item>
  • 불릿 아이템             → <bullet-item>
  일반 텍스트               → <p> 단락
  python txt_to_html.py <input_txt> [<output_html>] [--slot SLOT_ID] [--tables-dir DIR]

슬롯 폴더 모드 (queue/saju_XXX/ 구조):
  python txt_to_html.py queue/saju_정종욱/result.txt queue/saju_정종욱/final.html \\
         --slot sample_406 --tables-dir queue/saju_정종욱/tables
"""

import sys
import os
import re
import html
from pathlib import Path


# ─── 경로 설정 ──────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
CSS_PATH   = "../print.css"   # HTML 내 상대경로 (output 폴더 기준)


def detect_slot(input_path: Path) -> str:
    """파일명에서 슬롯 ID 자동 감지 (예: s11_all_임효원_result.txt → s11)"""
    m = re.match(r'^(s\d+)_', input_path.stem)
    return m.group(1) if m else "s00"


def load_table(table_name: str, slot_id: str, tables_dir: Path) -> str:
    """[[TABLE:xxx]] 마커에 대응하는 HTML 파일 로드"""
    # 슬롯별 폴더 우선, 없으면 공통 폴더
    candidates = [
        tables_dir / slot_id / f"{table_name}.html",
        tables_dir / "common" / f"{table_name}.html",
        tables_dir / f"{table_name}.html",
    ]
    for p in candidates:
        if p.exists():
            return p.read_text(encoding="utf-8")
    return f'<div class="info-box warn">⚠ 표 파일 없음: tables/{slot_id}/{table_name}.html</div>\n'


def parse_txt_to_html(txt: str, slot_id: str, tables_dir: Path) -> str:
    """txt 본문을 HTML 블록으로 변환"""
    lines = txt.splitlines()
    out   = []
    i     = 0

    def esc(s):
        return html.escape(s)

    while i < len(lines):
        raw  = lines[i]
        line = raw.strip()
        i   += 1

        # ── 빈 줄 ──────────────────────────────────────────────
        if not line:
            continue

        # ── TABLE 마커 ─────────────────────────────────────────
        m = re.match(r'^\[\[TABLE:(.+?)\]\]$', line)
        if m:
            out.append(load_table(m.group(1).strip(), slot_id, tables_dir))
            continue

        # ── PAGEBREAK 마커 ─────────────────────────────────────
        if line == '[[PAGEBREAK]]':
            out.append('<div style="page-break-after: always;"></div>\n')
            continue

        # ── 챕터 제목  ☯ ... ☯ ────────────────────────────────
        m = re.match(r'^☯\s*(.+?)\s*☯\s*$', line)
        if m:
            title = esc(m.group(1).strip())
            out.append(f'<h2 class="chapter-title">{title}</h2>\n')
            continue

        # ── 목차 페이지: ☯ 단독 시작 (목차 블록) ─────────────
        if line.startswith('☯') and line.endswith('☯'):
            title = esc(line.strip('☯').strip())
            out.append(f'<h2 class="chapter-title">{title}</h2>\n')
            continue

        # ── 섹션 제목  ✦ ──────────────────────────────────────
        if line.startswith('✦'):
            title = esc(line.lstrip('✦').strip())
            out.append(f'<h3 class="section-title">{title}</h3>\n')
            continue

        # ── 절 제목  ✺ ────────────────────────────────────────
        # "✺ N장. 주제 — 부제" 패턴: '—' 뒤(부제)를 14pt bold로 강조
        if line.startswith('✺'):
            raw = line.lstrip('✺').strip()
            if '—' in raw:
                main, sub = raw.split('—', 1)
                out.append(
                    f'<h4 class="subsection-title">'
                    f'{esc(main.strip())} — '
                    f'<span class="subsection-sub">{esc(sub.strip())}</span>'
                    f'</h4>\n'
                )
            else:
                out.append(f'<h4 class="subsection-title">{esc(raw)}</h4>\n')
            continue

        # ── 소항목 제목  ◈ → ★ 와 동일 처리 ─────────────────
        if line.startswith('◈'):
            title = esc(line.lstrip('◈').strip())
            out.append(f'<p><strong>{title}</strong></p>\n')
            continue

        # ── 불릿 그룹  ★ (구: ◎) ──────────────────────────────
        if line.startswith('★'):
            title = esc(line.lstrip('★').strip())
            out.append(f'<p><strong>{title}</strong></p>\n')
            continue

        # ── 본문 불릿  ▸ ──────────────────────────────────────
        if line.startswith('▸'):
            content = esc(line.lstrip('▸').strip())
            out.append(f'<p class="bullet-item">{content}</p>\n')
            continue

        # ── 불릿 아이템  • ────────────────────────────────────
        if line.startswith('•'):
            content = esc(line.lstrip('•').strip())
            out.append(f'<p class="bullet-item">{content}</p>\n')
            continue

        # ── 목차 하위 항목  - ─────────────────────────────────
        if line.startswith('-'):
            content = esc(line.lstrip('-').strip())
            out.append(f'<p class="bullet-item" style="padding-left:32px;">{content}</p>\n')
            continue

        # ── 구분선 ────────────────────────────────────────────
        if re.match(r'^[─\-]{10,}$', line):
            out.append('<hr class="divider">\n')
            continue

        # ── 강조 박스: ━ 또는 ★ 로 시작하는 단락 ────────────
        # (필요 시 확장)

        # ── 일반 텍스트 단락 ──────────────────────────────────
        # 들여쓰기 된 줄도 동일하게 처리
        text = esc(raw)   # 원본 보존 (앞뒤 공백 포함 escape)
        # 빈 줄이 아니면 <p> 처리
        if text.strip():
            out.append(f'<p class="text-block">{text.strip()}</p>\n')

    return '\n'.join(out)


def extract_title_name(txt: str) -> tuple[str, str]:
    """txt에서 이름과 일주 추출 (표지 생성용)"""
    name_m   = re.search(r'성\s*명\s*:\s*(.+)', txt)
    ilju_m   = re.search(r'일\s*주\s*:\s*(.+)', txt)
    name  = name_m.group(1).strip()  if name_m  else "사주 해석서"
    ilju  = ilju_m.group(1).strip()  if ilju_m  else ""
    return name, ilju


def build_toc_html(txt: str) -> str:
    """txt 목차 섹션에서 목차 HTML 생성"""
    # 목차 블록 찾기 (☯ 목차 ☯ ~ 첫 ☯ 서장 ☯ 사이)
    toc_match = re.search(r'☯\s*목\s*차.*?☯(.*?)(?=☯\s*서장|\Z)', txt, re.DOTALL)
    if not toc_match:
        return ""

    lines = toc_match.group(1).strip().splitlines()
    items = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith('✦'):
            text = html.escape(line.lstrip('✦').strip())
            items.append(
                f'<div class="toc-item">'
                f'<span class="toc-text"><strong>{text}</strong></span>'
                f'<span class="toc-dots"></span>'
                f'</div>'
            )
        elif line.startswith('•'):
            text = html.escape(line.lstrip('•').strip())
            items.append(
                f'<div class="toc-item" style="padding-left:16px;">'
                f'<span class="toc-text">{text}</span>'
                f'<span class="toc-dots"></span>'
                f'</div>'
            )
        elif line.startswith('-'):
            text = html.escape(line.lstrip('-').strip())
            items.append(
                f'<div class="toc-item" style="padding-left:32px;font-size:10pt;">'
                f'<span class="toc-text">{text}</span>'
                f'</div>'
            )

    if not items:
        return ""

    return (
        '<div class="toc-page">\n'
        '  <div class="toc-title">목  차</div>\n'
        + '\n'.join(f'  {item}' for item in items)
        + '\n</div>\n'
    )


def wrap_html(body: str, title: str, name: str, ilju: str, css_path: str) -> str:
    """완성 HTML 문서 조립"""
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{html.escape(title)}</title>
  <link rel="stylesheet" href="{css_path}">
</head>
<body>
<div class="page-wrap">

<!-- ═══ 표지 ═══ -->
<div class="cover-page">
  <div class="cover-title">사주 해석서</div>
  <div class="cover-sub">{html.escape(ilju)} · 2026년판</div>
  <div class="cover-divider"></div>
  <div class="cover-name">{html.escape(name)} 님</div>
  <div class="cover-sub" style="margin-top:32px; font-size:11pt;">
    집필: 반야선생 · 반야 백년 사주 연구소
  </div>
</div>

<!-- ═══ 본문 ═══ -->
{body}

</div>
</body>
</html>
"""


def assemble(input_path: Path, output_path: Path, slot_id: str, custom_tables_dir: Path = None):
    """메인 어셈블리 함수"""
    txt = input_path.read_text(encoding="utf-8")

    # 경로 설정
    engine_dir = SCRIPT_DIR
    tables_dir = custom_tables_dir if custom_tables_dir else (engine_dir / "tables")

    # 출력 파일 기준 CSS 상대경로 계산
    try:
        css_rel = os.path.relpath(engine_dir / "print.css", output_path.parent)
        css_rel = css_rel.replace("\\", "/")
    except ValueError:
        css_rel = CSS_PATH

    # 이름 / 일주 추출 (표지용)
    name, ilju = extract_title_name(txt)

    # 본문 변환
    body = parse_txt_to_html(txt, slot_id, tables_dir)

    # HTML 조립
    html_doc = wrap_html(body, f"{name} 사주 해석서", name, ilju, css_rel)

    # 출력
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html_doc, encoding="utf-8")
    print(f"✅  완성: {output_path}")
    print(f"   슬롯: {slot_id}  /  표 폴더: {tables_dir}  /  CSS: {css_rel}")
    print(f"   파일 크기: {output_path.stat().st_size:,} bytes")


# ─── CLI 진입점 ──────────────────────────────────────────────────
if __name__ == "__main__":
    args = sys.argv[1:]

    if not args:
        print(__doc__)
        sys.exit(0)

    input_file       = Path(args[0])
    slot_id          = None
    output_file      = None
    custom_tables_dir = None

    # 옵션 파싱
    i = 1
    while i < len(args):
        if args[i] == "--slot" and i + 1 < len(args):
            slot_id = args[i + 1]
            i += 2
        elif args[i] == "--tables-dir" and i + 1 < len(args):
            custom_tables_dir = Path(args[i + 1])
            i += 2
        elif not args[i].startswith("--") and output_file is None:
            output_file = Path(args[i])
            i += 1
        else:
            i += 1

    if not input_file.exists():
        print(f"❌  파일 없음: {input_file}", file=sys.stderr)
        sys.exit(1)

    if slot_id is None:
        slot_id = detect_slot(input_file)

    if output_file is None:
        # 기본 출력 위치: engine/output/{slot_id}_{이름}_final.html
        stem = re.sub(r'_result$', '', input_file.stem)
        stem = re.sub(r'_all_', '_', stem)
        output_dir = SCRIPT_DIR / "output"
        output_file = output_dir / f"{stem}_final.html"

    assemble(input_file, output_file, slot_id, custom_tables_dir)
