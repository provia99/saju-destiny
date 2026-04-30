"""
오행 분석 모듈 (Ohaeng Analyzer)

사주의 오행(五行) 분석
- 목(木), 화(火), 토(土), 금(金), 수(水) 개수 집계
- 지장간 포함 정밀 분석
- 강약 판단 및 용신 제안
"""

from typing import Dict, List
from .heavenly_earthly import (
    HEAVENLY_OHAENG, EARTHLY_OHAENG,
    EARTHLY_HIDDEN_STEMS, get_season
)

class OhaengAnalyzer:
    """오행 분석기"""
    
    def __init__(self):
        self.ohaeng_order = ['목', '화', '토', '금', '수']
    
    def analyze(self, saju_data: Dict) -> Dict:
        """
        사주의 오행 분석
        
        Args:
            saju_data: SajuCalculator.calculate()의 결과
            
        Returns:
            오행 분석 결과
        """
        pillars = saju_data['pillars']
        
        # 천간 오행 집계
        cheongan_count = self._count_cheongan_ohaeng(pillars)
        
        # 지지 오행 집계 (표면)
        jiji_count_surface = self._count_jiji_ohaeng_surface(pillars)
        
        # 지지 오행 집계 (지장간 포함)
        jiji_count_detail = self._count_jiji_ohaeng_detail(pillars)
        
        # 전체 오행 집계
        total_count = self._merge_counts(cheongan_count, jiji_count_detail)
        
        # 오행 강약 분석
        strength = self._analyze_strength(total_count, saju_data)
        
        # 과부족 판단
        excess_deficiency = self._analyze_excess_deficiency(total_count)
        
        # 상생상극 관계
        saeng_geuk = self._analyze_saeng_geuk(total_count)
        
        # 계절 조후 분석
        johoo = self._analyze_johoo(saju_data)
        
        result = {
            'cheongan': cheongan_count,
            'jiji_surface': jiji_count_surface,
            'jiji_detail': jiji_count_detail,
            'total': total_count,
            'strength': strength,
            'excess_deficiency': excess_deficiency,
            'saeng_geuk': saeng_geuk,
            'johoo': johoo,
            'day_stem_ohaeng': saju_data['day_stem']['ohaeng']
        }
        
        return result
    
    def _count_cheongan_ohaeng(self, pillars: Dict) -> Dict[str, int]:
        """천간 오행 집계"""
        count = {'목': 0, '화': 0, '토': 0, '금': 0, '수': 0}
        
        for pillar in ['year', 'month', 'day', 'time']:
            stem = pillars[pillar]['stem']
            ohaeng = HEAVENLY_OHAENG[stem]
            count[ohaeng] += 1
        
        return count
    
    def _count_jiji_ohaeng_surface(self, pillars: Dict) -> Dict[str, int]:
        """지지 오행 집계 (표면)"""
        count = {'목': 0, '화': 0, '토': 0, '금': 0, '수': 0}
        
        for pillar in ['year', 'month', 'day', 'time']:
            branch = pillars[pillar]['branch']
            ohaeng = EARTHLY_OHAENG[branch]
            count[ohaeng] += 1
        
        return count
    
    def _count_jiji_ohaeng_detail(self, pillars: Dict) -> Dict[str, float]:
        """지지 오행 집계 (지장간 포함, 가중치 반영)"""
        count = {'목': 0.0, '화': 0.0, '토': 0.0, '금': 0.0, '수': 0.0}
        
        for pillar in ['year', 'month', 'day', 'time']:
            branch = pillars[pillar]['branch']
            hidden_stems = EARTHLY_HIDDEN_STEMS[branch]
            
            # 지장간의 일수 비율로 가중치 계산
            total_days = sum(days for _, days in hidden_stems)
            
            for stem, days in hidden_stems:
                ohaeng = HEAVENLY_OHAENG[stem]
                weight = days / total_days
                count[ohaeng] += weight
        
        return count
    
    def _merge_counts(
        self, 
        cheongan: Dict[str, int], 
        jiji: Dict[str, float]
    ) -> Dict[str, float]:
        """천간과 지지 오행 합산"""
        total = {}
        for oh in self.ohaeng_order:
            total[oh] = cheongan[oh] + jiji[oh]
        return total
    
    def _analyze_strength(self, total_count: Dict[str, float], saju_data: Dict) -> Dict:
        """오행 강약 분석"""
        day_stem_ohaeng = saju_data['day_stem']['ohaeng']
        season = saju_data['season']
        
        # 계절별 왕성한 오행
        season_strong = {
            '봄': '목',
            '여름': '화',
            '가을': '금',
            '겨울': '수'
        }
        
        # 일간 오행의 개수
        day_ohaeng_count = total_count[day_stem_ohaeng]
        
        # 계절 보정
        strong_by_season = season_strong.get(season, None)
        season_bonus = 1.0 if day_stem_ohaeng == strong_by_season else 0.0
        
        # 일간 강약 판단
        effective_strength = day_ohaeng_count + season_bonus
        
        if effective_strength >= 3.5:
            day_stem_strength = '강'
        elif effective_strength >= 2.0:
            day_stem_strength = '중'
        else:
            day_stem_strength = '약'
        
        # 나를 생하는 오행 (인성)
        saeng_map = {
            '목': '수', '화': '목', '토': '화', '금': '토', '수': '금'
        }
        inseong_ohaeng = saeng_map[day_stem_ohaeng]
        inseong_count = total_count[inseong_ohaeng]
        
        # 나와 같은 오행 (비겁)
        bigeob_count = day_ohaeng_count
        
        return {
            'day_stem_strength': day_stem_strength,
            'day_stem_count': day_ohaeng_count,
            'season_strong': strong_by_season,
            'season_bonus': season_bonus,
            'effective_strength': effective_strength,
            'inseong_count': inseong_count,
            'bigeob_count': bigeob_count
        }
    
    def _analyze_excess_deficiency(self, total_count: Dict[str, float]) -> Dict:
        """과부족 분석"""
        result = {
            'excess': [],    # 과다 (3개 이상)
            'sufficient': [], # 적당 (1-2개)
            'deficient': []   # 부족 (0개)
        }
        
        for ohaeng in self.ohaeng_order:
            count = total_count[ohaeng]
            if count >= 3.0:
                result['excess'].append(ohaeng)
            elif count >= 1.0:
                result['sufficient'].append(ohaeng)
            else:
                result['deficient'].append(ohaeng)
        
        return result
    
    def _analyze_saeng_geuk(self, total_count: Dict[str, float]) -> Dict:
        """상생상극 관계 분석"""
        # 상생: 목→화→토→금→수→목
        # 상극: 목→토, 화→금, 토→수, 금→목, 수→화
        
        saeng_relations = {
            '목': {'생': '화', '극': '토', '생받음': '수', '극받음': '금'},
            '화': {'생': '토', '극': '금', '생받음': '목', '극받음': '수'},
            '토': {'생': '금', '극': '수', '생받음': '화', '극받음': '목'},
            '금': {'생': '수', '극': '목', '생받음': '토', '극받음': '화'},
            '수': {'생': '목', '극': '화', '생받음': '금', '극받음': '토'}
        }
        
        analysis = {}
        for ohaeng, rels in saeng_relations.items():
            analysis[ohaeng] = {
                'count': total_count[ohaeng],
                'saeng_target': rels['생'],
                'saeng_target_count': total_count[rels['생']],
                'geuk_target': rels['극'],
                'geuk_target_count': total_count[rels['극']],
                'saeng_source': rels['생받음'],
                'saeng_source_count': total_count[rels['생받음']],
                'geuk_source': rels['극받음'],
                'geuk_source_count': total_count[rels['극받음']]
            }
        
        return analysis
    
    def _analyze_johoo(self, saju_data: Dict) -> Dict:
        """조후(調候) 분석 - 계절에 따른 한난조습"""
        season = saju_data['season']
        day_stem = saju_data['day_stem']['stem']
        
        # 계절별 조후 요구사항
        johoo_requirements = {
            '봄': {
                'description': '목왕, 따뜻하고 습함',
                'needs': ['화', '금'],  # 금으로 다듬고 화로 따뜻하게
                'avoid': ['목', '수']   # 너무 강한 목, 차가운 수
            },
            '여름': {
                'description': '화왕, 뜨겁고 건조함',
                'needs': ['수', '토'],  # 수로 조절하고 토로 습기
                'avoid': ['화', '목']   # 너무 강한 화
            },
            '가을': {
                'description': '금왕, 서늘하고 건조함',
                'needs': ['화', '수'],  # 화로 따뜻하게, 수로 윤택하게
                'avoid': ['금', '토']   # 너무 강한 금
            },
            '겨울': {
                'description': '수왕, 차갑고 습함',
                'needs': ['화', '목'],  # 화로 따뜻하게, 목으로 기운 발산
                'avoid': ['수', '금']   # 너무 차가운 수
            }
        }
        
        requirements = johoo_requirements.get(season, {})
        
        return {
            'season': season,
            'description': requirements.get('description', ''),
            'needs': requirements.get('needs', []),
            'avoid': requirements.get('avoid', [])
        }
    
    def format_output(self, ohaeng_data: Dict) -> str:
        """오행 분석 결과 포맷팅"""
        lines = []
        lines.append("=" * 60)
        lines.append("오행 분석 (五行分析)")
        lines.append("=" * 60)
        lines.append("")
        
        # 일간 오행
        lines.append(f"일간 오행: {ohaeng_data['day_stem_ohaeng']}")
        lines.append("")
        
        # 오행 개수
        lines.append("--- 오행 개수 ---")
        total = ohaeng_data['total']
        for oh in self.ohaeng_order:
            lines.append(f"{oh}(木火土金水'[self.ohaeng_order.index(oh)]'): {total[oh]:.1f}개")
        lines.append("")
        
        # 천간 vs 지지
        lines.append("--- 천간/지지 분포 ---")
        cheongan = ohaeng_data['cheongan']
        jiji = ohaeng_data['jiji_detail']
        for oh in self.ohaeng_order:
            lines.append(f"{oh}: 천간 {cheongan[oh]}개, 지지 {jiji[oh]:.1f}개")
        lines.append("")
        
        # 강약
        strength = ohaeng_data['strength']
        lines.append("--- 일간 강약 ---")
        lines.append(f"일간 강도: {strength['day_stem_strength']}")
        lines.append(f"일간 오행 개수: {strength['day_stem_count']:.1f}개")
        lines.append(f"계절 왕성 오행: {strength['season_strong']}")
        lines.append(f"계절 보너스: +{strength['season_bonus']:.1f}")
        lines.append(f"유효 강도: {strength['effective_strength']:.1f}")
        lines.append("")
        
        # 과부족
        ed = ohaeng_data['excess_deficiency']
        lines.append("--- 오행 과부족 ---")
        if ed['excess']:
            lines.append(f"과다: {', '.join(ed['excess'])}")
        if ed['deficient']:
            lines.append(f"부족: {', '.join(ed['deficient'])}")
        lines.append("")
        
        # 조후
        johoo = ohaeng_data['johoo']
        lines.append("--- 조후(調候) ---")
        lines.append(f"계절: {johoo['season']}")
        lines.append(f"특성: {johoo['description']}")
        if johoo['needs']:
            lines.append(f"필요: {', '.join(johoo['needs'])}")
        if johoo['avoid']:
            lines.append(f"주의: {', '.join(johoo['avoid'])}")
        lines.append("")
        
        # 용신 제안
        lines.append("--- 용신(用神) 제안 ---")
        if strength['day_stem_strength'] == '강':
            lines.append("일간이 강함 → 설기(泄氣)나 극(剋)하는 오행 필요")
        elif strength['day_stem_strength'] == '약':
            lines.append("일간이 약함 → 생(生)하거나 돕는 오행 필요")
        else:
            lines.append("일간이 중간 강도 → 균형 유지")
        
        lines.append("")
        lines.append("=" * 60)
        
        return "\n".join(lines)

# 전역 함수
_analyzer = OhaengAnalyzer()

def analyze_ohaeng(saju_data: Dict) -> Dict:
    """오행 분석 (전역 함수)"""
    return _analyzer.analyze(saju_data)

def format_ohaeng_output(ohaeng_data: Dict) -> str:
    """오행 분석 출력 포맷팅 (전역 함수)"""
    return _analyzer.format_output(ohaeng_data)
