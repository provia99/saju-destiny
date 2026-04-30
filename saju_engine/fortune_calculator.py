"""
대운/세운/월운 계산 모듈 (Fortune Calculator)

대운(大運): 10년 주기 운세
세운(歲運): 연간 운세
월운(月運): 월간 운세
"""

from typing import List, Dict, Tuple
from datetime import datetime
from .heavenly_earthly import (
    HEAVENLY_STEMS, EARTHLY_BRANCHES,
    HEAVENLY_YIN_YANG, get_gapja_by_index,
    format_ganji, SIXTY_GAPJA,
    get_sipseong, get_twelve_unseong,  # Imported for enrichment
    BRANCH_MAINS,
    TWELVE_SHINSAL, TRINITY_FRAMES, SHINSAL_START_BRANCH
)
from .manseryeok import calculate_year_pillar, calculate_month_pillar
from .lunar_solar_converter import get_lichun_date, LunarSolarConverter

class FortuneCalculator:
    """대운/세운/월운 계산기"""
    
    def __init__(self):
        self._converter = LunarSolarConverter()
    
    def calculate_daeun(
        self,
        saju_data: Dict,
        start_year: int,
        num_periods: int = 10,
        day_stem: str = None
    ) -> List[Dict]:
        """
        대운(大運) 계산
        
        10년 주기로 바뀌는 큰 운
        성별과 년간 음양에 따라 순행/역행
        
        Args:
            saju_data: 사주 데이터
            start_year: 대운 시작 연도 (출생년도)
            num_periods: 계산할 대운 개수
            
        Returns:
            대운 리스트
        """
        gender = saju_data['input']['gender']
        year_stem = saju_data['pillars']['year']['stem']
        month_stem = saju_data['pillars']['month']['stem']
        month_branch = saju_data['pillars']['month']['branch']
        
        # 년지 (12신살 기준)
        year_branch = saju_data['pillars']['year']['branch']
        
        # 12신살 프레임 준비
        shinsal_start_idx = -1
        if year_branch:
            frame = TRINITY_FRAMES.get(year_branch)
            if frame:
                start_branch = SHINSAL_START_BRANCH.get(frame)
                if start_branch:
                    shinsal_start_idx = EARTHLY_BRANCHES.index(start_branch)

        # 년간의 음양
        year_yang = (HEAVENLY_YIN_YANG[year_stem] == '양')
        
        # 순행/역행 결정 (M/남, F/여 지원)
        is_male = gender in ['남', 'M', 'm', 'Male', 'male']
        is_female = gender in ['여', 'F', 'f', 'Female', 'female']
        
        forward = (is_male and year_yang) or \
                  (is_female and not year_yang)
        
        # 1. 기준 절기 찾기
        solar_date = datetime.strptime(saju_data['input']['solar_date'], "%Y-%m-%d")
        
        if forward:
            # 순행: 미래의 절기까지 남은 날짜
            target_jeolgi = self._converter.get_nearest_jeolgi_date(solar_date, direction='next')
            diff_days = (target_jeolgi - solar_date).days
        else:
            # 역행: 과거의 절기부터 지나온 날짜
            target_jeolgi = self._converter.get_nearest_jeolgi_date(solar_date, direction='prev')
            diff_days = (solar_date - target_jeolgi).days
            
        # 2. 대운수 계산 (3일 = 1년)
        daeun_num = round(diff_days / 3)
        if daeun_num < 1:
            daeun_num = 1
        elif daeun_num > 10:
            daeun_num = 10
            
        start_age = daeun_num
        
        # 월주의 60갑자 인덱스
        month_index = -1
        for i, (s, b) in enumerate(SIXTY_GAPJA):
            if s == month_stem and b == month_branch:
                month_index = i
                break
        
        daeun_list = []
        
        for i in range(num_periods):
            age_start = start_age + (i * 10)
            age_end = age_start + 9
            year_start = start_year + age_start - 1
            year_end = start_year + age_end - 1
            
            # 대운 간지 계산
            if forward:
                daeun_index = (month_index + 1 + i) % 60
            else:
                daeun_index = (month_index - 1 - i) % 60
            
            daeun_stem, daeun_branch = SIXTY_GAPJA[daeun_index]
            
            daeun_entry = {
                'period': i + 1,
                'age_range': f"{age_start}-{age_end}세",
                'year_range': f"{year_start}-{year_end}",
                'stem': daeun_stem,
                'branch': daeun_branch,
                'ganji': format_ganji(daeun_stem, daeun_branch),
                'ganji_kr': format_ganji(daeun_stem, daeun_branch, korean=True)
            }
            
            if day_stem:
                daeun_entry['sipseong_stem'] = get_sipseong(day_stem, daeun_stem)
                daeun_entry['sipseong_branch'] = get_sipseong(day_stem, BRANCH_MAINS[daeun_branch])
                daeun_entry['unseong'] = get_twelve_unseong(day_stem, daeun_branch)
            
            # 12신살 계산
            if shinsal_start_idx != -1:
                target_idx = EARTHLY_BRANCHES.index(daeun_branch)
                diff = (target_idx - shinsal_start_idx) % 12
                daeun_entry['shinsal'] = TWELVE_SHINSAL[diff]
            else:
                daeun_entry['shinsal'] = ''
                
            daeun_list.append(daeun_entry)
        return daeun_list

    
    def calculate_seun(
        self,
        start_year: int,
        end_year: int,
        day_stem: str = None,
        year_branch: str = None,
        birth_year: int = None
    ) -> List[Dict]:
        """
        세운(歲運) 계산
        
        매년의 운세 (년간 운)
        
        Args:
            start_year: 시작 연도
            end_year: 종료 연도
            day_stem: 일간 (십성, 운성 계산용)
            year_branch: 생년 지지 (신살 계산용)
            birth_year: 태어난 해 (나이 계산용)
            
        Returns:
            세운 리스트
        """
        seun_list = []
        
        # 12신살 프레임 준비
        shinsal_start_idx = -1
        if year_branch:
            frame = TRINITY_FRAMES.get(year_branch)
            if frame:
                start_branch = SHINSAL_START_BRANCH.get(frame)
                if start_branch:
                    shinsal_start_idx = EARTHLY_BRANCHES.index(start_branch)

        for year in range(start_year, end_year + 1):
            # 해당 연도의 년주 계산 (1월 1일 기준)
            year_stem, year_branch_seun = calculate_year_pillar(year, 1, 1)
            
            # 하지만 입춘 전후로 바뀌므로 정확히는 2월 4일 정도 기준
            year_stem, year_branch_seun = calculate_year_pillar(year, 2, 4)
            
            seun_entry = {
                'year': year,
                'stem': year_stem,
                'branch': year_branch_seun,
                'ganji': format_ganji(year_stem, year_branch_seun),
                'ganji_kr': format_ganji(year_stem, year_branch_seun, korean=True)
            }

            # 나이 계산
            if birth_year:
                # 한국 나이 (세는 나이)
                seun_entry['age'] = year - birth_year + 1
            
            # 십성 및 운성
            if day_stem:
                seun_entry['sipseong_stem'] = get_sipseong(day_stem, year_stem)
                seun_entry['sipseong_branch'] = get_sipseong(day_stem, BRANCH_MAINS[year_branch_seun])
                seun_entry['unseong'] = get_twelve_unseong(day_stem, year_branch_seun)
            
            # 12신살
            if shinsal_start_idx != -1:
                target_idx = EARTHLY_BRANCHES.index(year_branch_seun)
                diff = (target_idx - shinsal_start_idx) % 12
                seun_entry['shinsal'] = TWELVE_SHINSAL[diff]
            else:
                seun_entry['shinsal'] = ''

            seun_list.append(seun_entry)
        
        return seun_list
    
    def calculate_wolun(
        self,
        year: int,
        month: int = 1,
        duration: int = 15,
        day_stem: str = None,
        year_branch: str = None
    ) -> List[Dict]:
        """
        월운(月運) 계산
        
        지정된 연/월부터 n개월간의 월운 계산
        
        Args:
            year: 시작 연도
            month: 시작 월
            duration: 계산할 개월 수 (기본: 15개월)
            day_stem: 일간 (십성/운성용)
            year_branch: 띠 (12신살용)
            
        Returns:
            월운 리스트
        """
        wolun_list = []
        
        # 12신살 프레임 준비
        shinsal_start_idx = -1
        if year_branch:
            frame = TRINITY_FRAMES.get(year_branch)
            if frame:
                start_branch = SHINSAL_START_BRANCH.get(frame)
                if start_branch:
                    shinsal_start_idx = EARTHLY_BRANCHES.index(start_branch)

        current_year = year
        current_month = month
        
        for _ in range(duration):
            month_stem, month_branch = calculate_month_pillar(current_year, current_month, 15)
            
            wolun_entry = {
                'year': current_year,
                'month': current_month,
                'stem': month_stem,
                'branch': month_branch,
                'ganji': format_ganji(month_stem, month_branch),
                'ganji_kr': format_ganji(month_stem, month_branch, korean=True)
            }
            
            if day_stem:
                wolun_entry['sipseong_stem'] = get_sipseong(day_stem, month_stem)
                wolun_entry['sipseong_branch'] = get_sipseong(day_stem, BRANCH_MAINS[month_branch])
                wolun_entry['unseong'] = get_twelve_unseong(day_stem, month_branch)
            
            # 12신살 계산
            if shinsal_start_idx != -1:
                target_idx = EARTHLY_BRANCHES.index(month_branch)
                diff = (target_idx - shinsal_start_idx) % 12
                wolun_entry['shinsal'] = TWELVE_SHINSAL[diff]
            else:
                wolun_entry['shinsal'] = ''
                
            wolun_list.append(wolun_entry)
            
            # 다음 달로 이동
            current_month += 1
            if current_month > 12:
                current_month = 1
                current_year += 1
        
        return wolun_list
    
    def analyze_hapchung_with_saju(
        self,
        saju_data: Dict,
        fortune_ganji: Tuple[str, str]
    ) -> Dict:
        """
        사주와 대운/세운의 합충 관계 분석
        
        Args:
            saju_data: 사주 데이터
            fortune_ganji: 운의 간지 (천간, 지지)
            
        Returns:
            합충 관계
        """
        fortune_stem, fortune_branch = fortune_ganji
        
        pillars = saju_data['pillars']
        
        hapchung = {
            'cheongan_hap': [],
            'jiji_hap': [],
            'chung': [],
            'favorable': True  # 길흉 판단 (간단 버전)
        }
        
        # 천간합
        cheongan_hap_pairs = {
            ('甲', '己'): '토', ('乙', '庚'): '금', ('丙', '辛'): '수',
            ('丁', '壬'): '목', ('戊', '癸'): '화'
        }
        
        for pillar_name in ['year', 'month', 'day', 'time']:
            stem = pillars[pillar_name]['stem']
            pair = tuple(sorted([stem, fortune_stem]))
            if pair in cheongan_hap_pairs:
                hapchung['cheongan_hap'].append({
                    'saju_pillar': pillar_name,
                    'result': cheongan_hap_pairs[pair]
                })
        
        # 지지합
        yukhap_pairs = {
            ('子', '丑'): '토', ('寅', '亥'): '목', ('卯', '戌'): '화',
            ('辰', '酉'): '금', ('巳', '申'): '수', ('午', '未'): '화/토'
        }
        
        for pillar_name in ['year', 'month', 'day', 'time']:
            branch = pillars[pillar_name]['branch']
            pair = tuple(sorted([branch, fortune_branch]))
            if pair in yukhap_pairs:
                hapchung['jiji_hap'].append({
                    'saju_pillar': pillar_name,
                    'result': yukhap_pairs[pair]
                })
        
        # 충
        chung_pairs = [
            ('子', '午'), ('丑', '未'), ('寅', '申'),
            ('卯', '酉'), ('辰', '戌'), ('巳', '亥')
        ]
        
        for pillar_name in ['year', 'month', 'day', 'time']:
            branch = pillars[pillar_name]['branch']
            pair = tuple(sorted([branch, fortune_branch]))
            if pair in chung_pairs:
                hapchung['chung'].append({
                    'saju_pillar': pillar_name,
                    'chung_type': '지지충'
                })
                # 충이 있으면 대체로 불리
                hapchung['favorable'] = False
        
        return hapchung
    
    def format_daeun_output(self, daeun_list: List[Dict]) -> str:
        """대운 출력 포맷팅"""
        lines = []
        lines.append("=" * 60)
        lines.append("대운 (大運) - 10년 주기")
        lines.append("=" * 60)
        lines.append("")
        
        for daeun in daeun_list:
            lines.append(
                f"{daeun['period']:2d}. {daeun['age_range']:10s} "
                f"({daeun['year_range']:11s}) : "
                f"{daeun['ganji']} ({daeun['ganji_kr']})"
            )
        
        lines.append("")
        lines.append("=" * 60)
        return "\n".join(lines)
    
    def format_seun_output(self, seun_list: List[Dict]) -> str:
        """세운 출력 포맷팅"""
        lines = []
        lines.append("=" * 60)
        lines.append("세운 (歲運) - 연간 운세")
        lines.append("=" * 60)
        lines.append("")
        
        for seun in seun_list:
            lines.append(
                f"{seun['year']}년: {seun['ganji']} ({seun['ganji_kr']})"
            )
        
        lines.append("")
        lines.append("=" * 60)
        return "\n".join(lines)
    
    def format_wolun_output(self, wolun_list: List[Dict], year: int) -> str:
        """월운 출력 포맷팅"""
        lines = []
        lines.append("=" * 60)
        lines.append(f"월운 (月運) - {year}년 월간 운세")
        lines.append("=" * 60)
        lines.append("")
        
        for wolun in wolun_list:
            lines.append(
                f"{wolun['month']:2d}월: {wolun['ganji']} ({wolun['ganji_kr']})"
            )
        
        lines.append("")
        lines.append("=" * 60)
        return "\n".join(lines)

# 전역 함수
_fortune_calculator = FortuneCalculator()

def calculate_daeun(saju_data: Dict, start_year: int, num_periods: int = 10, day_stem: str = None) -> List[Dict]:
    """대운 계산 (전역 함수)"""
    return _fortune_calculator.calculate_daeun(saju_data, start_year, num_periods, day_stem)

def calculate_seun(start_year: int, end_year: int, day_stem: str = None, year_branch: str = None, birth_year: int = None) -> List[Dict]:
    """세운 계산 (전역 함수)"""
    return _fortune_calculator.calculate_seun(start_year, end_year, day_stem, year_branch, birth_year)

def calculate_wolun(year: int, month: int = 1, duration: int = 15, day_stem: str = None, year_branch: str = None) -> List[Dict]:
    """월운 계산 (전역 함수)"""
    return _fortune_calculator.calculate_wolun(year, month, duration, day_stem, year_branch)

def format_daeun_output(daeun_list: List[Dict]) -> str:
    """대운 출력 포맷팅"""
    return _fortune_calculator.format_daeun_output(daeun_list)

def format_seun_output(seun_list: List[Dict]) -> str:
    """세운 출력 포맷팅"""
    return _fortune_calculator.format_seun_output(seun_list)

def format_wolun_output(wolun_list: List[Dict], year: int) -> str:
    """월운 출력 포맷팅"""
    return _fortune_calculator.format_wolun_output(wolun_list, year)
