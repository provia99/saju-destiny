#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
임효원 사주 해석서 PDF 생성 스크립트
─ 표: weasyprint (HTML → PNG 변환 후 삽입)
─ 본문: reportlab + HYSMyeongJo CID 폰트
─ A4 여백 20mm 전방위
─ PNG 캐시 + 멀티프로세싱 병렬 렌더링
"""

import os
import re
import sys
import time
import numpy as np
from pathlib import Path
from multiprocessing import Pool, cpu_count
from bs4 import BeautifulSoup, NavigableString, Comment

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
    Image as RLImage, KeepTogether, HRFlowable
)

# ════════════════════════════════════════════════════════════════════
# 경로
# ════════════════════════════════════════════════════════════════════
BASE_DIR       = Path(__file__).resolve().parent.parent  # engine/ 의 상위 = 사주집필/
ENGINE_DIR     = BASE_DIR / 'engine'
FONTS_DIR      = ENGINE_DIR / 'fonts'
TABLES_DIR     = ENGINE_DIR / 'tables'
PNG_CACHE_DIR  = ENGINE_DIR / 'tables' / '_png_cache_300'
RENDER_DPI     = 300
HTML_FILE      = BASE_DIR / 's11_임효원_final.html'
OUTPUT_PDF     = BASE_DIR / '임효원_사주해석서_2026_v9.pdf'

PNG_CACHE_DIR.mkdir(exist_ok=True)

# ════════════════════════════════════════════════════════════════════
# CID 폰트 (본문용)
# ════════════════════════════════════════════════════════════════════
pdfmetrics.registerFont(UnicodeCIDFont('HYSMyeongJo-Medium'))
BODY_FONT = 'HYSMyeongJo-Medium'

# ════════════════════════════════════════════════════════════════════
# weasyprint 폰트 CSS
# ════════════════════════════════════════════════════════════════════
def wp_font_css():
    d = FONTS_DIR
    return f"""
@font-face{{font-family:'NotoSansKR';src:url('file://{d}/NotoSansKR-Thin.ttf') format('truetype');font-weight:100;}}
@font-face{{font-family:'NotoSansKR';src:url('file://{d}/NotoSansKR-ExtraLight.ttf') format('truetype');font-weight:200;}}
@font-face{{font-family:'NotoSansKR';src:url('file://{d}/NotoSansKR-Light.ttf') format('truetype');font-weight:300;}}
@font-face{{font-family:'NotoSansKR';src:url('file://{d}/NotoSansKR-Regular.ttf') format('truetype');font-weight:400;}}
@font-face{{font-family:'NotoSansKR';src:url('file://{d}/NotoSansKR-Medium.ttf') format('truetype');font-weight:500;}}
@font-face{{font-family:'NotoSansKR';src:url('file://{d}/NotoSansKR-SemiBold.ttf') format('truetype');font-weight:600;}}
@font-face{{font-family:'NotoSansKR';src:url('file://{d}/NotoSansKR-Bold.ttf') format('truetype');font-weight:700;}}
@font-face{{font-family:'NotoSansKR';src:url('file://{d}/NotoSansKR-ExtraBold.ttf') format('truetype');font-weight:800;}}
@font-face{{font-family:'NotoSansKR';src:url('file://{d}/NotoSansKR-Black.ttf') format('truetype');font-weight:900;}}
@font-face{{font-family:'NotoSerifKR';src:url('file://{d}/NotoSerifKR-Light.otf') format('opentype');font-weight:300;}}
@font-face{{font-family:'NotoSerifKR';src:url('file://{d}/NotoSerifKR-Regular.otf') format('opentype');font-weight:400;}}
@font-face{{font-family:'NotoSerifKR';src:url('file://{d}/NotoSerifKR-Medium.otf') format('opentype');font-weight:500;}}
@font-face{{font-family:'NotoSerifKR';src:url('file://{d}/NotoSerifKR-SemiBold.otf') format('opentype');font-weight:600;}}
@font-face{{font-family:'NotoSerifKR';src:url('file://{d}/NotoSerifKR-Bold.otf') format('opentype');font-weight:700;}}
@font-face{{font-family:'NotoSerifKR';src:url('file://{d}/NotoSerifKR-ExtraBold.ttf') format('truetype');font-weight:800;}}
@font-face{{font-family:'NotoSerifKR';src:url('file://{d}/NotoSerifKR-Black.otf') format('opentype');font-weight:900;}}
"""

# ════════════════════════════════════════════════════════════════════
# CSS 전처리 헬퍼 (weasyprint 호환 변환)
# ════════════════════════════════════════════════════════════════════
def _fix_css_block(css: str) -> str:
    """<style> 블록 CSS: grid→table, flex→block 변환"""
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


def _fix_inline_grid(el) -> None:
    style = el.get('style', '')
    style = re.sub(r'display\s*:\s*grid\s*;?', 'display:table;width:100%;', style)
    style = re.sub(r'grid-template-[a-z-]+\s*:[^;]+;?', '', style)
    style = re.sub(r'grid-[a-z-]+\s*:[^;]+;?', '', style)
    style = re.sub(r'align-items\s*:[^;]+;?', '', style)
    style = re.sub(r'justify-content\s*:[^;]+;?', '', style)
    style = re.sub(r'\bgap\s*:[^;]+;?', '', style)
    el['style'] = style.strip()
    for child in el.children:
        if isinstance(child, (NavigableString, Comment)):
            continue
        cs = child.get('style', '')
        if 'display' not in cs:
            child['style'] = 'display:table-cell;vertical-align:top;' + cs


def _fix_inline_flex(el) -> None:
    style = el.get('style', '')
    style = re.sub(r'display\s*:\s*(?:inline-)?flex\s*;?', 'display:block;', style)
    style = re.sub(r'flex-direction\s*:[^;]+;?', '', style)
    style = re.sub(r'align-items\s*:[^;]+;?', '', style)
    style = re.sub(r'justify-content\s*:[^;]+;?', '', style)
    style = re.sub(r'flex-wrap\s*:[^;]+;?', '', style)
    style = re.sub(r'\bgap\s*:\s*([\d.]+)px\s*;?', r'margin-bottom:\1px;', style)
    style = re.sub(r'\bgap\s*:[^;]+;?', '', style)
    el['style'] = style.strip()


# ════════════════════════════════════════════════════════════════════
# HTML 전처리 (weasyprint용)
# ════════════════════════════════════════════════════════════════════
def preprocess_html(html: str) -> str:
    # 1. Google Fonts 제거
    html = re.sub(r'<link[^>]*fonts\.googleapis[^>]*>', '', html)
    html = re.sub(r'<link[^>]*fonts\.gstatic[^>]*>', '', html)

    # 2. 폰트 패밀리명 교체
    for old, new in [
        ("'Noto Sans KR'", 'NotoSansKR'), ('"Noto Sans KR"', 'NotoSansKR'),
        ('Noto Sans KR', 'NotoSansKR'),
        ("'Noto Serif KR'", 'NotoSerifKR'), ('"Noto Serif KR"', 'NotoSerifKR'),
        ('Noto Serif KR', 'NotoSerifKR'),
        ("'Nanum Myeongjo'", 'NotoSerifKR'), ('"Nanum Myeongjo"', 'NotoSerifKR'),
        ('Nanum Myeongjo', 'NotoSerifKR'),
        ("'Malgun Gothic'", 'NotoSansKR'), ('"Malgun Gothic"', 'NotoSansKR'),
        ("'맑은 고딕'", 'NotoSansKR'), ('"맑은 고딕"', 'NotoSansKR'),
        ("'Apple SD Gothic Neo'", 'NotoSansKR'),
        ("'DM Serif Display'", 'NotoSerifKR'),
    ]:
        html = html.replace(old, new)

    # 3. <style> 블록 CSS 변환 (grid/flex → weasyprint 호환)
    html = re.sub(
        r'(<style[^>]*>)(.*?)(</style>)',
        lambda m: m.group(1) + _fix_css_block(m.group(2)) + m.group(3),
        html, flags=re.DOTALL | re.IGNORECASE
    )

    # 4. 인라인 style 변환
    soup = BeautifulSoup(html, 'html.parser')
    for el in soup.find_all(style=True):
        s = el.get('style', '')
        if re.search(r'display\s*:\s*grid', s):
            _fix_inline_grid(el)
        elif re.search(r'display\s*:\s*(?:inline-)?flex', s):
            _fix_inline_flex(el)
    html = str(soup)

    # 5. @page + font CSS 주입
    base_css = (f'{wp_font_css()}'
                f'@page{{margin:0;size:604px 2200px;}}'
                f'html,body{{margin:0;padding:0;background:white;}}'
                f'table td,table th{{display:table-cell !important;vertical-align:middle;}}')
    inject = f'<style>{base_css}</style>'
    if '</head>' in html:
        html = html.replace('</head>', inject + '</head>', 1)
    elif '<style>' in html:
        html = html.replace('<style>', inject + '\n<style>', 1)
    else:
        html = inject + html

    return html


# ════════════════════════════════════════════════════════════════════
# 단일 HTML → PNG 변환
# ════════════════════════════════════════════════════════════════════
def _render_one(args):
    folder, name, html_path, cache_path = args
    cache_path = Path(cache_path).resolve()
    html_path  = Path(html_path).resolve()

    if cache_path.exists():
        return (name, 'cached', cache_path)

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
                last_row = i; break
        crop_h = min(last_row + 40, img.height)
        cropped = img.crop((0, 0, img.width, crop_h))
        cropped.save(str(cache_path), format='PNG', optimize=True)

        dt = time.time() - t0
        return (name, f'OK {cropped.size[0]}x{cropped.size[1]} {dt:.1f}s', cache_path)

    except Exception as e:
        return (name, f'ERROR: {e}', None)


# ════════════════════════════════════════════════════════════════════
# 표 PNG 사전 생성 (병렬)
# ════════════════════════════════════════════════════════════════════
def prebuild_png_cache(slot: str, table_list: list, workers=4):
    tasks = []
    for folder, name in table_list:
        html_path  = TABLES_DIR / folder / f'{name}.html'
        cache_path = PNG_CACHE_DIR / f'{folder}_{name}.png'
        if not html_path.exists():
            print(f'  없음: {folder}/{name}.html')
            continue
        tasks.append((folder, name, str(html_path), str(cache_path)))

    pending = [t for t in tasks if not Path(t[3]).exists()]
    cached  = len(tasks) - len(pending)
    print(f'  캐시 존재: {cached}개, 렌더링 필요: {len(pending)}개')
    if not pending:
        return

    t_start = time.time()
    n_workers = min(workers, len(pending), cpu_count())
    print(f'  병렬 처리 ({n_workers} workers)...')
    with Pool(n_workers) as pool:
        for name, status, path in pool.imap_unordered(_render_one, pending):
            print(f'    {name}: {status}')
    print(f'  PNG 캐시 완료: {time.time()-t_start:.0f}초')


# ════════════════════════════════════════════════════════════════════
# 표 → reportlab Image flowable
# ════════════════════════════════════════════════════════════════════
CSS_PX_PER_INCH = 96
TABLE_CSS_W     = 604
TABLE_CSS_H_MAX = 820

def css_px_to_mm(px):
    return px * 25.4 / CSS_PX_PER_INCH

MAX_W_MM = css_px_to_mm(TABLE_CSS_W)
MAX_H_MM = css_px_to_mm(TABLE_CSS_H_MAX)

def table_flowable(folder: str, name: str, styles: dict) -> list:
    cache_path = PNG_CACHE_DIR / f'{folder}_{name}.png'
    html_path  = TABLES_DIR / folder / f'{name}.html'

    items = [Paragraph(f'▶ {name}', styles['caption'])]

    if not cache_path.exists():
        if not html_path.exists():
            items.append(Paragraph(f'[ {name} 파일 없음 ]', styles['body']))
            return items
        print(f'    실시간 렌더링: {name} ...', end='', flush=True)
        result = _render_one((folder, name, str(html_path), str(cache_path)))
        print(result[1])

    if not cache_path.exists():
        items.append(Paragraph(f'[ {name} 렌더링 실패 ]', styles['body']))
        return items

    pil = PILImage.open(str(cache_path))
    img_w_px, img_h_px = pil.size
    img_w_css = img_w_px * CSS_PX_PER_INCH / RENDER_DPI
    img_h_css = img_h_px * CSS_PX_PER_INCH / RENDER_DPI
    scale = min(TABLE_CSS_W / img_w_css, TABLE_CSS_H_MAX / img_h_css, 1.0)
    final_w = css_px_to_mm(img_w_css * scale) * mm
    final_h = css_px_to_mm(img_h_css * scale) * mm

    rl_img = RLImage(str(cache_path), width=final_w, height=final_h)
    items.append(rl_img)
    items.append(Spacer(1, 4*mm))
    return items


# ════════════════════════════════════════════════════════════════════
# 스타일
# ════════════════════════════════════════════════════════════════════
def make_styles():
    F = BODY_FONT
    return dict(
        title=ParagraphStyle('T', fontName=F, fontSize=28, textColor=colors.HexColor('#2c1a10'),
                             alignment=1, spaceAfter=10*mm, leading=35),
        subtitle=ParagraphStyle('ST', fontName=F, fontSize=14, textColor=colors.HexColor('#6b4030'),
                                alignment=1, spaceAfter=4*mm, leading=18),
        name=ParagraphStyle('N', fontName=F, fontSize=20, textColor=colors.HexColor('#2c1a10'),
                            alignment=1, leading=26),
        org=ParagraphStyle('O', fontName=F, fontSize=9, textColor=colors.HexColor('#999'),
                           alignment=1, leading=14),
        toc=ParagraphStyle('TC', fontName=F, fontSize=10, textColor=colors.HexColor('#444'),
                           leading=17, spaceAfter=1.5*mm),
        chapter=ParagraphStyle('CH', fontName=F, fontSize=17, textColor=colors.HexColor('#2c1a10'),
                               spaceBefore=4*mm, spaceAfter=5*mm, leading=24),
        section=ParagraphStyle('SC', fontName=F, fontSize=11, textColor=colors.HexColor('#1a4e7a'),
                               spaceBefore=5*mm, spaceAfter=2*mm, leading=16),
        body=ParagraphStyle('BD', fontName=F, fontSize=10, textColor=colors.HexColor('#333'),
                            leading=18, spaceAfter=2*mm),
        caption=ParagraphStyle('CP', fontName=F, fontSize=9, textColor=colors.HexColor('#6b4030'),
                               spaceBefore=5*mm, spaceAfter=1*mm, leading=13,
                               backColor=colors.HexColor('#fdf5e6'),
                               borderPadding=(3, 4, 3, 4)),
    )


# ════════════════════════════════════════════════════════════════════
# 챕터 텍스트 추출
# ════════════════════════════════════════════════════════════════════
def extract_chapter_paragraphs(soup, chapter_kw, next_kw=None):
    paras = []
    found = False
    for el in soup.find_all(['h2', 'h3', 'h4', 'p']):
        if el.name == 'h2':
            text = el.get_text(strip=True)
            if chapter_kw in text:
                found = True; continue
            elif found and next_kw and next_kw in text:
                break
        if not found: continue
        if el.name in ('h3', 'h4'):
            t = el.get_text(strip=True)
            if t and len(t) > 3: paras.append(('section', t))
        elif el.name == 'p':
            t = el.get_text(strip=True)
            if t and len(t) > 10: paras.append(('body', t))
    return paras


# ════════════════════════════════════════════════════════════════════
# 챕터 빌드
# ════════════════════════════════════════════════════════════════════
def build_chapter(story, soup, kw, next_kw, title, tables, slot, styles):
    story.append(PageBreak())
    story.append(Paragraph(title, styles['chapter']))
    story.append(HRFlowable(width='100%', thickness=2, color=colors.HexColor('#9b6f00'),
                            spaceAfter=4*mm))

    for folder, name in tables:
        story.extend(table_flowable(folder, name, styles))

    for ptype, text in extract_chapter_paragraphs(soup, kw, next_kw):
        style = styles['section'] if ptype == 'section' else styles['body']
        story.append(Paragraph(text, style))

    story.append(Spacer(1, 6*mm))


# ════════════════════════════════════════════════════════════════════
# 챕터 목록 — (folder, name) 튜플로 표 지정
# 'common' = 공통표, 슬롯ID = 개인화 표
# ════════════════════════════════════════════════════════════════════
def make_chapters(slot: str) -> list:
    s = slot
    return [
        dict(kw='서장',  next_kw='1장',
             title='서장. 임효원 님께, 이 책을 펼치기 전에',
             tables=[(s,'사주기본표'), (s,'사주원국요약표'), (s,'일주요약박스'), (s,'공망안내박스')]),
        dict(kw='1장',   next_kw='2장',   title='1장. 사주의 언어',
             tables=[('common','천간일람표'), ('common','지지일람표'),
                     ('common','십이운성조견표'), ('common','60갑자표')]),
        dict(kw='2장',   next_kw='3장',   title='2장. 戊辰(무진) — 나라는 사람',  tables=[]),
        dict(kw='3장',   next_kw='4장',   title='3장. 사주 네 기둥 — 내 삶의 지도',
             tables=[(s,'합충형파해분석표'), ('common','천간합조견표'),
                     ('common','지지육합조견표'), ('common','지지충조견표')]),
        dict(kw='4장',   next_kw='5장',   title='4장. 오행 — 내 에너지 지형',
             tables=[(s,'오행균형표'), (s,'오행점수표'), (s,'오행생극도'), ('common','오행조견표')]),
        dict(kw='5장',   next_kw='6장',   title='5장. 십성 — 마음의 이야기',
             tables=[(s,'십성배치표'), (s,'십성계열분류표'), ('common','십성의미조견표')]),
        dict(kw='6장',   next_kw='7장',   title='6장. 용신 — 내 삶의 나침반',
             tables=[(s,'4신요약표'), (s,'용신가이드카드')]),
        dict(kw='7장',   next_kw='8장',   title='7장. 지장간 — 숨겨진 힘',
             tables=[(s,'지장간분석표')]),
        dict(kw='8장',   next_kw='9장',   title='8장. 대운 — 인생의 흐름',
             tables=[(s,'대운타임라인'), (s,'대운로드맵')]),
        dict(kw='9장',   next_kw='10장',  title='9장. 전환점 — 인생의 분기점',
             tables=[(s,'전환점타임라인'), (s,'전환점요약표')]),
        dict(kw='10장',  next_kw='11장',  title='10장. 2026년 세운·월운',
             tables=[(s,'세운대운교차표'), (s,'세운월운달력'), (s,'연간운세요약표')]),
        dict(kw='11장',  next_kw='12장',  title='11장. 기질의 이해',     tables=[]),
        dict(kw='12장',  next_kw='13장',  title='12장. 건강',            tables=[(s,'건강표')]),
        dict(kw='13장',  next_kw='14장',  title='13장. 재물',            tables=[(s,'직업표')]),
        dict(kw='14장',  next_kw='15장',  title='14장. 가족',            tables=[]),
        dict(kw='15장',  next_kw='16장',  title='15장. 귀인과 도움',
             tables=[(s,'신살현황표')]),
        dict(kw='16장',  next_kw='17장',  title='16장. 시련과 극복',     tables=[]),
        dict(kw='17장',  next_kw='종장',  title='17장. 개운 실천 가이드',
             tables=[(s,'용신체크리스트')]),
        dict(kw='종장',  next_kw=None,    title='종장. 100년을 향하여',  tables=[]),
    ]


# ════════════════════════════════════════════════════════════════════
# PDF 생성
# ════════════════════════════════════════════════════════════════════
def build_pdf(slot: str = 's11'):
    t_start = time.time()
    styles  = make_styles()
    chapters = make_chapters(slot)

    # 모든 개인화 표 목록 수집 (PNG 사전 생성용)
    all_tables = []
    for ch in chapters:
        all_tables.extend(ch['tables'])

    # ── STEP 1: 표 PNG 사전 렌더링 ──────────────────────────
    print('══ STEP 1: 표 PNG 사전 렌더링 ══')
    prebuild_png_cache(slot, all_tables, workers=4)

    # ── STEP 2: 원고 파싱 ───────────────────────────────────
    print('\n══ STEP 2: 원고 파싱 ══')
    with open(HTML_FILE, encoding='utf-8') as f:
        book_soup = BeautifulSoup(f.read(), 'html.parser')

    # ── STEP 3: PDF 조립 ────────────────────────────────────
    print('\n══ STEP 3: PDF 조립 ══')
    doc = SimpleDocTemplate(
        str(OUTPUT_PDF), pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm,
        title='임효원 사주 해석서 2026', author='반야선생'
    )

    story = []

    # 표지
    story.append(Spacer(1, 38*mm))
    story.append(Paragraph('사주 해석서', styles['title']))
    story.append(HRFlowable(width=60*mm, thickness=2,
                            color=colors.HexColor('#9b6f00'),
                            spaceAfter=6*mm, hAlign='CENTER'))
    story.append(Paragraph('戊辰(무진) 일주 · 2026년판', styles['subtitle']))
    story.append(Paragraph('황금 용의 기운',
                           ParagraphStyle('g', fontName=BODY_FONT, fontSize=11,
                                          textColor=colors.HexColor('#9b6f00'),
                                          alignment=1, leading=15)))
    story.append(Spacer(1, 24*mm))
    story.append(Paragraph('임효원 님', styles['name']))
    story.append(Spacer(1, 44*mm))
    story.append(Paragraph('집필 : 반야선생', styles['org']))
    story.append(Paragraph('반야 백년 사주 연구소', styles['org']))

    # 목차
    story.append(PageBreak())
    story.append(Paragraph('목  차', styles['chapter']))
    story.append(HRFlowable(width='100%', thickness=2,
                            color=colors.HexColor('#9b6f00'), spaceAfter=4*mm))
    for ch in chapters:
        story.append(Paragraph(f'· {ch["title"]}', styles['toc']))

    # 챕터
    for ch in chapters:
        print(f'  [{ch["kw"]}] {ch["title"][:25]}')
        build_chapter(story, book_soup,
                      ch['kw'], ch['next_kw'],
                      ch['title'], ch['tables'], slot, styles)

    doc.build(story)

    size_kb = OUTPUT_PDF.stat().st_size // 1024
    elapsed = time.time() - t_start
    print(f'\n✅ 완료: {OUTPUT_PDF.name}')
    print(f'   크기: {size_kb:,} KB')
    print(f'   총 소요: {elapsed:.0f}초')

    try:
        import pypdf
        r = pypdf.PdfReader(str(OUTPUT_PDF))
        print(f'   페이지: {len(r.pages)}쪽')
    except Exception:
        pass


if __name__ == '__main__':
    slot = sys.argv[1] if len(sys.argv) > 1 else 's11'
    build_pdf(slot)
