"""한국어 자연어에서 날짜·기간 추출.

지원:
  단일일자: "오늘", "내일", "모레", "글피", "어제", "5월 7일", "2026년 5월 7일"
  요일:     "이번주 금요일", "다음주 월요일"
  상대월:   "다음 달", "이번 달", "지난 달"
  기간:     "다음 달 이사 좋은 날" → (시작, 끝)

LLM 없이 정규식 기반 — 일반 케이스 잡고, 모호하면 None 반환.
"""

from __future__ import annotations
import re
from datetime import date, timedelta
from typing import Optional

WEEKDAY_KO = {
    "월": 0, "월요일": 0,
    "화": 1, "화요일": 1,
    "수": 2, "수요일": 2,
    "목": 3, "목요일": 3,
    "금": 4, "금요일": 4,
    "토": 5, "토요일": 5,
    "일": 6, "일요일": 6,
}


def _today() -> date:
    return date.today()


def parse_single_date(text: str, ref: Optional[date] = None) -> Optional[date]:
    """단일 날짜 추출. 못 찾으면 None."""
    ref = ref or _today()
    s = text.strip()

    # 상대 일자
    if re.search(r"\b오늘\b", s): return ref
    if re.search(r"\b내일\b", s): return ref + timedelta(days=1)
    if re.search(r"\b모레\b", s): return ref + timedelta(days=2)
    if re.search(r"\b글피\b", s): return ref + timedelta(days=3)
    if re.search(r"\b어제\b", s): return ref - timedelta(days=1)
    if re.search(r"\b그제\b|\b그저께\b", s): return ref - timedelta(days=2)

    # "이번/다음/지난주 + 요일"
    m = re.search(r"(이번|다음|지난)\s*주\s*([월화수목금토일][요일]*)", s)
    if m:
        which, wkd = m.group(1), m.group(2)
        target_wkd = WEEKDAY_KO.get(wkd)
        if target_wkd is not None:
            today_wkd = ref.weekday()
            if which == "이번":
                delta = target_wkd - today_wkd
                return ref + timedelta(days=delta)
            elif which == "다음":
                delta = (target_wkd - today_wkd) % 7 + 7
                return ref + timedelta(days=delta)
            elif which == "지난":
                delta = (today_wkd - target_wkd) % 7 + 7
                return ref - timedelta(days=delta)

    # "이번/다음/지난주 + 요일 없이" → 그 주의 같은 요일
    m = re.search(r"(이번|다음|지난)\s*주", s)
    if m:
        which = m.group(1)
        if which == "이번": return ref
        if which == "다음": return ref + timedelta(days=7)
        if which == "지난": return ref - timedelta(days=7)

    # "YYYY년 M월 D일"
    m = re.search(r"(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일", s)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            return None

    # "M월 D일"
    m = re.search(r"(\d{1,2})\s*월\s*(\d{1,2})\s*일", s)
    if m:
        try:
            mo, dy = int(m.group(1)), int(m.group(2))
            year = ref.year
            cand = date(year, mo, dy)
            # 과거면 다음 해 (예: 1월에 "12월 7일" 묻는 경우는 보통 미래)
            # 단순화: 그대로 올해 기준
            return cand
        except ValueError:
            return None

    # "M/D" or "MM-DD"
    m = re.search(r"\b(\d{1,2})[/\-.](\d{1,2})\b", s)
    if m:
        try:
            return date(ref.year, int(m.group(1)), int(m.group(2)))
        except ValueError:
            return None

    return None


def parse_month_range(text: str, ref: Optional[date] = None) -> Optional[tuple[date, date]]:
    """월 단위 범위 추출 — "이번 달", "다음 달", "지난 달". 없으면 None."""
    ref = ref or _today()
    s = text.strip()

    if re.search(r"이번\s*달", s):
        start = ref.replace(day=1)
        end = _last_day_of_month(start)
        return (start, end)
    if re.search(r"다음\s*달", s):
        if ref.month == 12:
            start = date(ref.year + 1, 1, 1)
        else:
            start = date(ref.year, ref.month + 1, 1)
        end = _last_day_of_month(start)
        return (start, end)
    if re.search(r"지난\s*달", s):
        if ref.month == 1:
            start = date(ref.year - 1, 12, 1)
        else:
            start = date(ref.year, ref.month - 1, 1)
        end = _last_day_of_month(start)
        return (start, end)

    # "M월" 단독 (날짜 없이)
    m = re.search(r"(?<![\d년])(\d{1,2})\s*월(?!\s*\d)", s)
    if m:
        try:
            mo = int(m.group(1))
            year = ref.year
            start = date(year, mo, 1)
            end = _last_day_of_month(start)
            return (start, end)
        except ValueError:
            return None

    return None


def _last_day_of_month(d: date) -> date:
    if d.month == 12:
        return date(d.year, 12, 31)
    nxt = date(d.year, d.month + 1, 1)
    return nxt - timedelta(days=1)
