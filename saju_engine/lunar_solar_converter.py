"""
음양력 변환 및 절기 계산 모듈

양력 ↔ 음력 변환
24절기 계산
"""

from datetime import datetime, timedelta
from typing import Tuple, Optional
from korean_lunar_calendar import KoreanLunarCalendar

# 24절기 정보 (양력 기준 대략적인 날짜)
# 실제로는 태양의 황경으로 계산해야 하지만, 여기서는 근사값 사용
SOLAR_TERMS = {
    1: [
        ('소한', 6), ('대한', 20)
    ],
    2: [
        ('입춘', 4), ('우수', 19)
    ],
    3: [
        ('경칩', 6), ('춘분', 21)
    ],
    4: [
        ('청명', 5), ('곡우', 20)
    ],
    5: [
        ('입하', 6), ('소만', 21)
    ],
    6: [
        ('망종', 6), ('하지', 21)
    ],
    7: [
        ('소서', 7), ('대서', 23)
    ],
    8: [
        ('입추', 8), ('처서', 23)
    ],
    9: [
        ('백로', 8), ('추분', 23)
    ],
    10: [
        ('한로', 8), ('상강', 23)
    ],
    11: [
        ('입동', 7), ('소설', 22)
    ],
    12: [
        ('대설', 7), ('동지', 22)
    ]
}

# 각 월의 절입 절기 (월주를 바꾸는 절기)
MONTH_SOLAR_TERMS = {
    1: '입춘',   # 2월
    2: '경칩',   # 3월
    3: '청명',   # 4월
    4: '입하',   # 5월
    5: '망종',   # 6월
    6: '소서',   # 7월
    7: '입추',   # 8월
    8: '백로',   # 9월
    9: '한로',   # 10월
    10: '입동',  # 11월
    11: '대설',  # 12월
    12: '소한'   # 1월
}

class LunarSolarConverter:
    """음양력 변환 클래스"""
    
    def __init__(self):
        self.calendar = KoreanLunarCalendar()
    
    def solar_to_lunar(self, year: int, month: int, day: int) -> Tuple[int, int, int, bool]:
        """
        양력을 음력으로 변환
        
        Returns:
            (음력년, 음력월, 음력일, 윤달여부)
        """
        try:
            self.calendar.setSolarDate(year, month, day)
            lunar_year = self.calendar.lunarYear
            lunar_month = self.calendar.lunarMonth
            lunar_day = self.calendar.lunarDay
            is_leap = self.calendar.isIntercalation
            
            return (lunar_year, lunar_month, lunar_day, is_leap)
        except Exception as e:
            raise ValueError(f"양력 변환 오류: {year}-{month}-{day}, {e}")
    
    def lunar_to_solar(self, year: int, month: int, day: int, is_leap: bool = False) -> Tuple[int, int, int]:
        """
        음력을 양력으로 변환
        
        Args:
            year: 음력 년
            month: 음력 월
            day: 음력 일
            is_leap: 윤달 여부
            
        Returns:
            (양력년, 양력월, 양력일)
        """
        try:
            self.calendar.setLunarDate(year, month, day, is_leap)
            solar_year = self.calendar.solarYear
            solar_month = self.calendar.solarMonth
            solar_day = self.calendar.solarDay
            
            return (solar_year, solar_month, solar_day)
        except Exception as e:
            raise ValueError(f"음력 변환 오류: {year}-{month}-{day}(윤:{is_leap}), {e}")
    
    def get_solar_term_date(self, year: int, month: int, term_name: str) -> Optional[int]:
        """
        특정 연도/월의 절기 날짜 구하기 (근사값)
        
        Args:
            year: 연도
            month: 월
            term_name: 절기 이름
            
        Returns:
            절기 날짜 (일)
        """
        if month not in SOLAR_TERMS:
            return None
        
        for term, approx_day in SOLAR_TERMS[month]:
            if term == term_name:
                # 실제로는 천문 계산이 필요하지만, 여기서는 근사값 사용
                # 연도에 따라 ±1일 정도 차이 날 수 있음
                return approx_day
        
        return None
    
    def get_month_solar_term(self, solar_month: int) -> str:
        """양력 월에 해당하는 월주 절입 절기 구하기"""
        # 2월 입춘, 3월 경칩, 4월 청명...
        return MONTH_SOLAR_TERMS.get(solar_month - 1, '입춘')
    
    def is_after_solar_term(self, year: int, month: int, day: int, term_name: str) -> bool:
        """
        특정 날짜가 절기 이후인지 확인
        
        Args:
            year: 연도
            month: 월
            day: 일
            term_name: 절기 이름
            
        Returns:
            절기 이후이면 True
        """
        term_day = self.get_solar_term_date(year, month, term_name)
        if term_day is None:
            return False
        
        return day >= term_day
    
    def get_year_pillars_start_date(self, year: int) -> datetime:
        """
        년주가 바뀌는 입춘(立春) 날짜 구하기
        
        일반적으로 2월 3-5일경
        """
        # 입춘은 양력 2월 초순
        lichun_day = self.get_solar_term_date(year, 2, '입춘')
        if lichun_day:
            return datetime(year, 2, lichun_day)
        else:
            # 기본값: 2월 4일
            return datetime(year, 2, 4)

    def get_nearest_jeolgi_date(self, date: datetime, direction: str = 'next') -> datetime:
        """
        주어진 날짜에서 가장 가까운 절기 날짜 구하기 (대운 계산용)
        
        Args:
            date: 기준 날짜
            direction: 'next' (다음 절기) or 'prev' (이전 절기)
            
        Returns:
            절기 날짜 (datetime)
        """
        year, month, day = date.year, date.month, date.day
        
        # 검색 범위: 전후 2개월
        search_dates = []
        
        # 현재 달의 절기
        if month in SOLAR_TERMS:
            for term, term_day in SOLAR_TERMS[month]:
                search_dates.append(datetime(year, month, term_day))
                
        # 이전 달의 절기
        prev_month_date = date.replace(day=1) - timedelta(days=1)
        prev_year, prev_month = prev_month_date.year, prev_month_date.month
        if prev_month in SOLAR_TERMS:
            for term, term_day in SOLAR_TERMS[prev_month]:
                search_dates.append(datetime(prev_year, prev_month, term_day))
                
        # 다음 달의 절기
        if month == 12:
            next_year, next_month = year + 1, 1
        else:
            next_year, next_month = year, month + 1
            
        if next_month in SOLAR_TERMS:
            for term, term_day in SOLAR_TERMS[next_month]:
                search_dates.append(datetime(next_year, next_month, term_day))
                
        search_dates.sort()
        
        if direction == 'next':
            # 기준일 이후의 첫 절기
            for term_date in search_dates:
                if term_date > date:
                    return term_date
            # 못 찾았으면 더 미래 검색 (간단히 2달 뒤 가정)
            return date + timedelta(days=15) # Fallback
            
        else: # prev
            # 기준일 이전의 마지막 절기
            for term_date in reversed(search_dates):
                if term_date < date:
                    return term_date
            # 못 찾았으면 더 과거 검색
            return date - timedelta(days=15) # Fallback

# 전역 인스턴스
_converter = LunarSolarConverter()

def solar_to_lunar(year: int, month: int, day: int) -> Tuple[int, int, int, bool]:
    """양력을 음력으로 변환 (전역 함수)"""
    return _converter.solar_to_lunar(year, month, day)

def lunar_to_solar(year: int, month: int, day: int, is_leap: bool = False) -> Tuple[int, int, int]:
    """음력을 양력으로 변환 (전역 함수)"""
    return _converter.lunar_to_solar(year, month, day, is_leap)

def get_lichun_date(year: int) -> datetime:
    """입춘 날짜 구하기"""
    return _converter.get_year_pillars_start_date(year)
