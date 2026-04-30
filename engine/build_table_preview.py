#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
표 미리보기 PDF 생성 스크립트
─ 모든 표를 한 페이지에 하나씩 A4 PDF로 출력
─ weasyprint → pdf2image (PNG) → reportlab 조립
"""

import re
import sys
import time
import numpy as np
from pathlib import Path
from multiprocessing import Pool, cpu_count

from PIL import Image as PILImage
from weasyprint import HTML as WP_HTML
from weasyprint.text.fonts import FontConfiguration
from pdf2image import convert_from_bytes

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Image as RLImage, KeepTogether
)

# ════════════════════════════════════════════════════════════════════
# 경로
# ════════════════════════════════════════════════════════════════════
BASE_DIR      = Path(__file__).resolve().parent.parent   # 사주집필/
ENGINE_DIR    = BASE_DIR / 'engine'
FONTS_DIR     = ENGINE_DIR / 'fonts'
TABLES_DIR    = ENGINE_DIR / 'tables'
CACHE_DIR     = ENGINE_DIR / 'tables' / '_png_cache_300'
OUTPUT_PDF    = BASE_DIR / '표_미리보기.pdf'

RENDER_DPI    = 300
CSS_PX_PER_INCH = 96

CACHE_DIR.mkdir(exist_ok=True)

# ════════════════════════════════════════════════════════════════════
# 표 목록 (순서대로 PDF에 출력)
# ════════════════════════════════════════════════════════════════════
TABLE_LIST = [
    # ─ 기본 정보 ─
    ('s11',    '사주기본표'),
    ('s11',    '사주원국요약표'),
    ('s11',    '일주요약박스'),
    ('s11',    '공망안내박스'),
    # ─ 사주의 언어 ─
    ('common', '천간일람표'),
    ('common', '지지일람표'),
    ('common', '십이운성조견표'),
    ('common', '60갑자표'),
    # ─ 합충형파해 ─
    ('s11',    '합충형파해분석표'),
    ('common', '천간합조견표'),
    ('common', '지지육합조견표'),
    ('common', '지지충조견표'),
    # ─ 오행 ─
    ('s11',    '오행균형표'),
    ('s11',    '오행점수표'),
    ('s11',    '오행생극도'),
    ('common', '오행조견표'),
    # ─ 십성 ─
    ('s11',    '십성배치표'),
    ('s11',    '십성계열분류표'),
    ('common', '십성의미조견표'),
    # ─ 용신 ─
    ('s11',    '4신요약표'),
    ('s11',    '용신가이드카드'),
    # ─ 지장간 ─
    ('s11',    '지장간분석표'),
    # ─ 대운 ─
    ('s11',    '대운타임라인'),
    ('s11',    '대운로드맵'),
    # ─ 전환점 ─
    ('s11',    '전환점타임라인'),
    ('s11',    '전환점요약표'),
    # ─ 세운·월운 ─
    ('s11',    '세운대운교차표'),
    ('s11',    '세운월운달력'),
    ('s11',    '월별운세그래프'),
    ('s11',    '연간운세요약표'),
    # ─ 기타 ─
    ('s11',    '신살현황표'),
    ('s11',    '용신체크리스트'),
]

# ════════════════════════════════════════════════════════════════════
# weasyprint 폰트 CSS
# ════════════════════════════════════════════════════════════════════
def wp_font_css():
    d = FONTS_DIR
    return f"""
@font-face{{font-family:'NotoSansKR';src:url('file://{d}/NotoSansKR-Regular.ttf') format('truetype');font-weight:400;}}
@font-face{{font-family:'NotoSansKR';src:url('file://{d}/NotoSansKR-Medium.ttf') format('truetype');font-weight:500;}}
@font-face{{font-family:'NotoSansKR';src:url('file://{d}/NotoSansKR-Bold.ttf') format('truetype');font-weight:700;}}
@font-face{{font-family:'NotoSerifKR';src:url('file://{d}/NotoSerifKR-Regular.ttf') format('truetype');font-weight:400;}}
@font-face{{font-family:'NotoSerifKR';src:url('file://{d}/NotoSerifKR-Medium.ttf') format('truetype');font-weight:500;}}
@font-face{{font-family:'NotoSerifKR';src:url('file://{d}/NotoSerifKR-Bold.ttf') format('truetype');font-weight:700;}}
"""

# ════════════════════════════════════════════════════════════════════
# CSS 전처리 (weasyprint 호환: grid/flex 변환)
# ════════════════════════════════════════════════════════════════════
def _fix_css_block(css: str) -> str:
    grid_sels = re.findall(
        r'([.#][\w-]+(?:\s*[.#>+~\s][\w-]+)*)\s*\{[^}]*display\s*:\s*grid[^}]*\}', css)
    css = re.sub(r'display\s*:\s*grid\s*;', 'display:table;width:100%;table-layout:fixed;', css)
    css = re.sub(r'grid-template-(?:columns|rows|areas?)\s*:[^;]+;', '', css)
    css = re.sub(r'grid-(?:column|row)(?:-(?:start|end))?\s*:[^;]+;', '', css)
    css = re.sub(r'grid-auto-(?:columns|rows|flow)\s*:[^;]+;', '', css)
    css = re.sub(r'grid-area\s*:[^;]+;', '', css)
    css = re.sub(r'place-(?:items|content|self)\s*:[^;]+;', '', css)
    css = re.sub(r'display\s*:\s*flex\s*;', 'display:block;', css)
    css = re.sub(r'display\s*:\s*inline-flex\s*;', 'display:inline-block;', css)
    css = re.sub(r'flex-direction\s*:[^;]+;', '', css)
    css = re.sub(r'align-items\s*:[^;]+;', '', css)
    css = re.sub(r'justify-content\s*:[^;]+;', '', css)
    css = re.sub(r'align-content\s*:[^;]+;', '', css)
    css = re.sub(r'flex-wrap\s*:[^;]+;', '', css)
    css = re.sub(r'\bflex\s*:\s*[\d.][^;]*;', '', css)
    css = re.sub(r'flex-(?:shrink|grow|basis)\s*:[^;]+;', '', css)
    css = re.sub(r'\bgap\s*:\s*([\d.]+)px\s*;', r'margin-bottom:\1px;', css)
    css = re.sub(r'\b(?:row-gap|column-gap)\s*:[^;]+;', '', css)
    css = re.sub(r'\bgap\s*:[^;]+;', '', css)
    for sel in set(grid_sels):
        sel = sel.strip()
        css += f'\n{sel} > * {{ display:table-cell !important; vertical-align:top; }}'
    return css


def preprocess_html(html: str) -> str:
    html = re.sub(r'<link[^>]*fonts\.googleapis[^>]*>', '', html)
    html = re.sub(r'<link[^>]*fonts\.gstatic[^>]*>', '', html)
    for old, new in [
        ("'Malgun Gothic'", 'NotoSansKR'), ('"Malgun Gothic"', 'NotoSansKR'),
        ("'맑은 고딕'", 'NotoSansKR'),     ('"맑은 고딕"', 'NotoSansKR'),
        ("'Apple SD Gothic Neo'", 'NotoSansKR'),
        ("'Noto Sans KR'", 'NotoSansKR'),  ('"Noto Sans KR"', 'NotoSansKR'),
        ('Noto Sans KR', 'NotoSansKR'),
        ("'Nanum Myeongjo'", 'NotoSerifKR'), ('Nanum Myeongjo', 'NotoSerifKR'),
        ("'DM Serif Display'", 'NotoSerifKR'),
    ]:
        html = html.replace(old, new)

    html = re.sub(
        r'(<style[^>]*>)(.*?)(</style>)',
        lambda m: m.group(1) + _fix_css_block(m.group(2)) + m.group(3),
        html, flags=re.DOTALL | re.IGNORECASE
    )

    base_css = (
        f'{wp_font_css()}'
        f'@page{{margin:0;size:604px 2200px;}}'
        f'html,body{{margin:0;padding:0;background:white;}}'
        f'table td,table th{{display:table-cell !important;vertical-align:middle;}}'
    )
    inject = f'<style>{base_css}</style>'
    if '</head>' in html:
        html = html.replace('</head>', inject + '</head>', 1)
    elif '<style>' in html:
        html = html.replace('<style>', inject + '\n<style>', 1)
    else:
        html = inject + html
    return html


# ════════════════════════════════════════════════════════════════════
# 단일 표 HTML → PNG (멀티프로세싱 worker)
# ════════════════════════════════════════════════════════════════════
def _render_one(args):
    folder, name, html_path_str, cache_path_str = args
    cache_path = Path(cache_path_str).resolve()
    html_path  = Path(html_path_str).resolve()

    if cache_path.exists():
        return (name, 'cached', str(cache_path))

    try:
        t0 = time.time()
        html = html_path.read_text(encoding='utf-8')
        html = preprocess_html(html)

        fc = FontConfiguration()
        pdf_bytes = WP_HTML(string=html, base_url=str(html_path.parent)).write_pdf(
            font_config=fc, presentational_hints=True
        )

        images = convert_from_bytes(pdf_bytes, dpi=RENDER_DPI, first_page=1, last_page=1)
        if not images:
            return (name, 'no_image', None)

        img = images[0]
        arr = np.array(img.convert('RGB'))
        row_white = np.all(arr == 255, axis=(1, 2))
        last_row = img.height - 1
        for i in range(img.height - 1, -1, -1):
            if not row_white[i]:
                last_row = i
                break
        crop_h = min(last_row + 40, img.height)
        cropped = img.crop((0, 0, img.width, crop_h))
        cropped.save(str(cache_path), format='PNG', optimize=True)

        dt = time.time() - t0
        return (name, f'OK {cropped.size[0]}×{cropped.size[1]}px  {dt:.1f}s', str(cache_path))

    except Exception as e:
        return (name, f'ERROR: {e}', None)


# ════════════════════════════════════════════════════════════════════
# PNG 캐시 일괄 생성
# ════════════════════════════════════════════════════════════════════
def build_png_cache(force=False):
    tasks = []
    for folder, name in TABLE_LIST:
        html_path  = TABLES_DIR / folder / f'{name}.html'
        cache_path = CACHE_DIR  / f'{folder}_{name}.png'
        if not html_path.exists():
            print(f'  [없음] {folder}/{name}.html')
            continue
        if force and cache_path.exists():
            cache_path.unlink()
        tasks.append((folder, name, str(html_path), str(cache_path)))

    pending = [t for t in tasks if not Path(t[3]).exists()]
    cached  = len(tasks) - len(pending)
    print(f'  캐시 존재: {cached}개 / 렌더링 필요: {len(pending)}개')

    if not pending:
        return

    t0 = time.time()
    n_workers = min(2, len(pending), cpu_count())
    print(f'  병렬 PNG 렌더링 ({n_workers} workers)...\n')

    with Pool(n_workers) as pool:
        for name, status, path in pool.imap_unordered(_render_one, pending):
            icon = '✓' if status.startswith('OK') or status == 'cached' else '✗'
            print(f'  {icon} {name}: {status}')

    print(f'\n  완료: {time.time()-t0:.0f}초')


# ════════════════════════════════════════════════════════════════════
# PDF 조립 (표 하나 = 한 페이지)
# ════════════════════════════════════════════════════════════════════
def build_preview_pdf():
    pdfmetrics.registerFont(UnicodeCIDFont('HYSMyeongJo-Medium'))
    FONT = 'HYSMyeongJo-Medium'

    PAGE_W, PAGE_H = A4
    MARGIN = 20 * mm
    USABLE_W = PAGE_W - 2 * MARGIN
    USABLE_H = PAGE_H - 2 * MARGIN - 18 * mm  # 상단 라벨 공간 확보

    doc = SimpleDocTemplate(
        str(OUTPUT_PDF),
        pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN,  bottomMargin=MARGIN,
    )

    lbl_style = ParagraphStyle(
        'label', fontName=FONT, fontSize=9,
        textColor=colors.HexColor('#555555'),
        spaceAfter=4 * mm,
    )
    miss_style = ParagraphStyle(
        'miss', fontName=FONT, fontSize=10,
        textColor=colors.HexColor('#cc0000'),
        spaceAfter=4 * mm,
    )

    story = []
    total = len(TABLE_LIST)

    for idx, (folder, name) in enumerate(TABLE_LIST):
        cache_path = CACHE_DIR / f'{folder}_{name}.png'

        # 폴더 표시: (c) = common
        label_text = f'{idx+1}/{total}  {name}{"  (공통표)" if folder == "common" else "  (개인표)"}'

        if not cache_path.exists():
            story.append(Paragraph(f'[{label_text}] — PNG 없음', miss_style))
        else:
            try:
                img = PILImage.open(cache_path)
                iw, ih = img.size  # pixels at RENDER_DPI

                # mm 변환
                w_mm = iw * 25.4 / RENDER_DPI
                h_mm = ih * 25.4 / RENDER_DPI

                # 페이지 안에 맞게 비례 축소
                scale = min(USABLE_W / (w_mm * mm),
                            USABLE_H / (h_mm * mm),
                            1.0)
                final_w = w_mm * mm * scale
                final_h = h_mm * mm * scale

                lbl  = Paragraph(label_text, lbl_style)
                rl_img = RLImage(str(cache_path), width=final_w, height=final_h)
                story.append(KeepTogether([lbl, rl_img]))

            except Exception as e:
                story.append(Paragraph(f'[{label_text}] ERROR: {e}', miss_style))

        # 마지막 표 제외 페이지 나눔
        if idx < total - 1:
            story.append(PageBreak())

    print(f'  PDF 빌드 중...')
    doc.build(story)
    print(f'  저장: {OUTPUT_PDF}')


# ════════════════════════════════════════════════════════════════════
# 메인
# ════════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    force = '--force' in sys.argv

    print('━' * 50)
    print(' 표 미리보기 PDF 생성')
    print(f' 총 {len(TABLE_LIST)}개 표  |  DPI={RENDER_DPI}')
    print('━' * 50)

    print('\n[1] PNG 캐시 생성')
    build_png_cache(force=force)

    print('\n[2] PDF 조립')
    build_preview_pdf()

    print('\n━' * 50)
    print(f' 완료: {OUTPUT_PDF.name}')
    print('━' * 50)
