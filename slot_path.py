"""
슬롯 경로 유틸 》 브랜드/개인/상품/연도 4단계 폴더 구조

새 규칙: engine/queue/{brand}/m{member_id:05d}_{name}/{product}/{year}/
예시: engine/queue/sample/m00002_최원석/saju/2026/

폴더명에 member_id를 prefix로 붙여 회원 식별을 명확히 함.
이름이 변경되어도 prefix(m{id:05d})가 같으면 동일 회원으로 인식.

기존 폴더(legacy: name_phonedigits 또는 name_bookid)는 호환성 유지.
"""
import re
from pathlib import Path
from datetime import datetime


_NAME_SAFE = re.compile(r'[\\/:*?"<>|]')

def _safe_name(name: str) -> str:
    return _NAME_SAFE.sub('_', str(name or '').strip()) or 'unknown'


def make_person_folder(member_id: int, name: str) -> str:
    """새 폴더명 규칙 — m{id:05d}_{name}.
    member_id가 prefix이므로 이름이 바뀌어도 같은 회원으로 식별 가능."""
    return f"m{int(member_id):05d}_{_safe_name(name)}"


def make_slot_dir(queue_dir: Path, brand: str, member_id: int, name: str,
                  product: str = "saju", year: int = None) -> Path:
    """새 슬롯 경로 — DB에 절대경로 저장하는 진실 소스용.
    이름이 바뀌어도 m{id:05d}_* prefix로 검색 가능."""
    if year is None:
        year = datetime.now().year
    return queue_dir / brand / make_person_folder(member_id, name) / product / str(year)


# ── 레거시 호환 ──────────────────────────────────────────────
def get_phone_digits(phone: str, member_id: int = 0) -> str:
    phone_raw = str(phone or "").replace("-", "").replace(" ", "")
    if len(phone_raw) >= 4:
        return phone_raw[-8:]
    return f"0000{str(member_id).zfill(4)}"


def get_person_folder(name: str, phone: str, member_id: int = 0) -> str:
    digits = get_phone_digits(phone, member_id)
    return f"{name}_{digits}"


def get_person_dir(queue_dir: Path, brand: str, name: str, phone: str,
                   member_id: int = 0) -> Path:
    person = get_person_folder(name, phone, member_id)
    return queue_dir / brand / person


def get_slot_dir(queue_dir: Path, brand: str, name: str, phone: str,
                 product: str = "saju", member_id: int = 0,
                 year: int = None) -> Path:
    if year is None:
        year = datetime.now().year
    person = get_person_folder(name, phone, member_id)
    return queue_dir / brand / person / product / str(year)


def find_slot_dir(queue_dir: Path, brand: str, name: str, phone: str,
                  product: str = "saju", member_id: int = 0,
                  year: int = None) -> Path:
    if year is None:
        year = datetime.now().year

    # 1순위: 새 규칙 (m{id:05d}_{name})
    if member_id:
        new_rule = make_slot_dir(queue_dir, brand, member_id, name, product, year)
        if new_rule.exists():
            return new_rule
        # 이름 변경 케이스: prefix(m{id:05d}_)만 같으면 같은 회원 — 가장 최근 폴더 채택
        try:
            prefix = f"m{int(member_id):05d}_"
            cands = sorted(
                (p for p in (queue_dir / brand).glob(f"{prefix}*") if p.is_dir()),
                key=lambda p: p.stat().st_mtime, reverse=True,
            )
            for pd in cands:
                cand = pd / product / str(year)
                if cand.exists():
                    return cand
        except Exception:
            pass

    # 2순위: 레거시 새 구조 (brand/person_phone/product/year/)
    legacy_path = get_slot_dir(queue_dir, brand, name, phone, product, member_id, year)
    if legacy_path.exists():
        return legacy_path

    # 3순위: 연도 없는 레거시
    no_year = queue_dir / brand / get_person_folder(name, phone, member_id) / product
    if no_year.exists() and not (no_year / str(year)).exists():
        return no_year

    # 4순위: 더 오래된 레거시 (saju_{name}_{digits}/)
    digits = get_phone_digits(phone, member_id)
    legacy = queue_dir / f"saju_{name}_{digits}"
    if legacy.exists():
        return legacy

    # 5순위 (phone 빈값 fallback): {name}_* 패턴으로 가장 최근 폴더
    phone_raw = str(phone or "").replace("-", "").replace(" ", "")
    if len(phone_raw) < 4:
        try:
            person_dirs = sorted(
                (queue_dir / brand).glob(f"{name}_*"),
                key=lambda p: p.stat().st_mtime, reverse=True,
            )
            for pd in person_dirs:
                cand = pd / product / str(year)
                if cand.exists():
                    return cand
        except Exception:
            pass

    return legacy_path
