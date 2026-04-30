"""
표 전수 감사 — 상품별 슬롯의 표·풀이 텍스트에서 어색한 문장·미치환 슬롯·빈 필드 검출
"""
import os, re, json
from pathlib import Path

ROOT = Path(r'c:\Users\provi\Desktop\banya_web\engine\queue\sample')

# ── 의심 패턴 ─────────────────────────────────────────────
PATTERNS = [
    # (이름, 정규식, 설명)
    ('미치환슬롯',       re.compile(r'\{\{[^}]+\}\}'),                   '{{xxx}} 슬롯이 치환 안 됨'),
    ('없음조사',         re.compile(r'없음(이|가|은|는|을|를)\s'),        "'없음이 부족한' 류 어색한 문장"),
    ('미상조사',         re.compile(r'미상(이|가|은|는)\s'),              "'미상이' 류 어색한 문장"),
    ('빈괄호',           re.compile(r'\(\s*\)|\[\s*\]'),                   '빈 괄호'),
    ('이름빈',           re.compile(r'^\s*(?:님|님은|님의)\s'),            '이름이 비어 "님은 ~" 시작'),
    ('이중조사',         re.compile(r'(이/가|을/를|은/는)'),               '조사 미선택'),
    ('연속하이픈',       re.compile(r'-\s*-\s*-'),                          '빈 필드 연속 - - - 표시'),
    ('null값',           re.compile(r'\bnull\b|\bundefined\b|\bNaN\b'),     'JS null/undefined/NaN 노출'),
    ('빈날짜',           re.compile(r'\b0년\b|\b0월\b|\b0일\b'),             '0년/0월/0일'),
    ('빈인사',           re.compile(r'님 사주에서.*없음'),                 '"X 사주에서 ... 없음" 패턴'),
    ('placeholder누락',  re.compile(r'TODO|FIXME|XXX'),                     'TODO/FIXME 잔재'),
]

# 일부 문맥에서는 정상인 패턴 — 화이트리스트
WHITELIST_LINE = [
    re.compile(r'없음\s*$'),                       # 단순 '없음' 단독
    re.compile(r'^\s*없음\s*[•·]'),                # bullet 시작
    re.compile(r'없음\s*\)'),                      # (없음)
    re.compile(r'\b없음\b\s*[/,]'),                # 없음 / xxx
    re.compile(r'※\s*없음'),
]

def is_whitelisted(line, pat_name):
    if pat_name == '없음조사':
        # 진짜 어색한 것만 잡기 — '없음이 부족' 같은
        return False
    return False

def audit_file(path):
    """한 파일 점검 → [(라인번호, 패턴이름, 라인내용)]"""
    issues = []
    try:
        with open(path, encoding='utf-8') as f:
            for ln, line in enumerate(f, 1):
                stripped = line.strip()
                if not stripped: continue
                # HTML 태그 제거 (간이) — 검사 대상은 텍스트
                plain = re.sub(r'<[^>]+>', ' ', stripped)
                for name, regex, desc in PATTERNS:
                    if regex.search(plain):
                        if is_whitelisted(plain, name): continue
                        # 라인 너무 길면 자르기
                        snippet = plain[:200].replace('\n',' ')
                        issues.append((ln, name, snippet))
    except Exception as e:
        issues.append((0, 'READ_ERROR', str(e)))
    return issues

def collect_files():
    """슬롯 폴더 안의 result.txt + tables/*.html"""
    results = []
    for member_dir in ROOT.iterdir():
        if not member_dir.is_dir(): continue
        for product in ('saju', 'compatibility'):
            slot = member_dir / product / '2026'
            if not slot.exists(): continue
            # result.txt
            r = slot / 'result.txt'
            if r.exists(): results.append((member_dir.name, product, 'result.txt', r))
            # tables HTML
            tdir = slot / 'tables'
            if tdir.exists():
                for f in sorted(tdir.glob('*.html')):
                    if f.name.startswith('filler') or f.name.startswith('운세달력_'): continue
                    if f.name.startswith('돛단배'): continue
                    results.append((member_dir.name, product, f.name, f))
    return results

# ── 실행 ──
totals = {}  # 패턴별 누적
by_member = {}  # 회원별 카운트
files = collect_files()

print(f"감사 대상 파일: {len(files)}개\n")

# 패턴별 sample 1~3개씩 출력
samples = {p[0]: [] for p in PATTERNS}

for member, product, fname, path in files:
    issues = audit_file(path)
    if not issues: continue
    key = f"{member}/{product}/{fname}"
    by_member[key] = len(issues)
    for ln, pname, snip in issues:
        totals[pname] = totals.get(pname, 0) + 1
        if len(samples.get(pname, [])) < 3:
            samples.setdefault(pname, []).append(f"{member}/{product}/{fname}:{ln}  »  {snip[:120]}")

# ── 보고 ──
print("━" * 70)
print("📊 패턴별 발생 건수")
print("━" * 70)
for pname, cnt in sorted(totals.items(), key=lambda x:-x[1]):
    print(f"  {pname:20s}  {cnt:4d}건")

print()
print("━" * 70)
print("🔍 패턴별 샘플 (최대 3개씩)")
print("━" * 70)
for pname, cnt in sorted(totals.items(), key=lambda x:-x[1]):
    print(f"\n  ── {pname} ({cnt}건) ──")
    for s in samples.get(pname, [])[:3]:
        print(f"    • {s}")

print()
print("━" * 70)
print(f"📋 이슈 발생 파일 상위 10개")
print("━" * 70)
for k, v in sorted(by_member.items(), key=lambda x:-x[1])[:10]:
    print(f"  {v:4d}건  {k}")
