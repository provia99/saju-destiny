"""
천간지지 (Heavenly Stems and Earthly Branches) 체계

10천간(天干): 甲乙丙丁戊己庚辛壬癸
12지지(地支): 子丑寅卯辰巳午未申酉戌亥
60갑자 순환 체계
"""

from typing import Dict, List, Tuple

# 10천간 (Heavenly Stems)
HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
HEAVENLY_STEMS_KR = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계']

# 12지지 (Earthly Branches)
EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
EARTHLY_BRANCHES_KR = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해']

# 천간 음양
HEAVENLY_YIN_YANG = {
    '甲': '양', '乙': '음', '丙': '양', '丁': '음', '戊': '양',
    '己': '음', '庚': '양', '辛': '음', '壬': '양', '癸': '음'
}

# 지지 음양
EARTHLY_YIN_YANG = {
    '子': '양', '丑': '음', '寅': '양', '卯': '음', '辰': '양', '巳': '음',
    '午': '양', '未': '음', '申': '양', '酉': '음', '戌': '양', '亥': '음'
}

# 천간 오행
HEAVENLY_OHAENG = {
    '甲': '목', '乙': '목',
    '丙': '화', '丁': '화',
    '戊': '토', '己': '토',
    '庚': '금', '辛': '금',
    '壬': '수', '癸': '수'
}

# 지지 오행
EARTHLY_OHAENG = {
    '子': '수', '丑': '토', '寅': '목', '卯': '목',
    '辰': '토', '巳': '화', '午': '화', '未': '토',
    '申': '금', '酉': '금', '戌': '토', '亥': '수'
}

# 지장간 (支藏干) - 지지 안에 숨어있는 천간들
# 형식: {지지: [(천간, 일수), ...]}
EARTHLY_HIDDEN_STEMS = {
    '子': [('癸', 20), ('壬', 10)],             # 왕지 (본기, 여기)
    '丑': [('己', 18), ('辛', 3), ('癸', 9)],    # 묘지 (본기, 중기, 여기)
    '寅': [('甲', 16), ('丙', 7), ('戊', 7)],    # 생지 (본기, 중기, 여기)
    '卯': [('乙', 20), ('甲', 10)],             # 왕지 (본기, 여기)
    '辰': [('戊', 18), ('癸', 3), ('乙', 9)],    # 묘지 (본기, 중기, 여기)
    '巳': [('丙', 16), ('庚', 7), ('戊', 7)],    # 생지 (본기, 중기, 여기)
    '午': [('丁', 11), ('己', 9), ('丙', 10)],   # 왕지 (본기, 중기, 여기) - 오화는 기토 포함
    '未': [('己', 18), ('乙', 3), ('丁', 9)],    # 묘지 (본기, 중기, 여기)
    '申': [('庚', 16), ('壬', 7), ('戊', 7)],    # 생지 (본기, 중기, 여기)
    '酉': [('辛', 20), ('庚', 10)],             # 왕지 (본기, 여기)
    '戌': [('戊', 18), ('丁', 3), ('辛', 9)],    # 묘지 (본기, 중기, 여기)
    '亥': [('壬', 16), ('甲', 7), ('戊', 7)]     # 생지 (본기, 중기, 여기)
}

# 지지의 본기(本氣) 천간 매핑
BRANCH_MAINS = {
    '子': '癸', '丑': '己', '寅': '甲', '卯': '乙',
    '辰': '戊', '巳': '丙', '午': '丁', '未': '己',
    '申': '庚', '酉': '辛', '戌': '戊', '亥': '壬'
}

# 60갑자 (60 Sexagenary Cycles)
def get_60_gapja() -> List[Tuple[str, str]]:
    """60갑자 리스트 생성"""
    gapja = []
    for i in range(60):
        stem = HEAVENLY_STEMS[i % 10]
        branch = EARTHLY_BRANCHES[i % 12]
        gapja.append((stem, branch))
    return gapja

SIXTY_GAPJA = get_60_gapja()

# 60갑자 인덱스 찾기
def get_gapja_index(stem: str, branch: str) -> int:
    """천간과 지지로 60갑자 인덱스 찾기 (0-59)"""
    for i, (s, b) in enumerate(SIXTY_GAPJA):
        if s == stem and b == branch:
            return i
    return -1

# 인덱스로 간지 얻기
def get_gapja_by_index(index: int) -> Tuple[str, str]:
    """인덱스로 간지 얻기"""
    index = index % 60
    return SIXTY_GAPJA[index]

# 시간별 지지 (시지)
TIME_EARTHLY_BRANCHES = {
    23: '子', 1: '丑', 3: '寅', 5: '卯',
    7: '辰', 9: '巳', 11: '午', 13: '未',
    15: '申', 17: '酉', 19: '戌', 21: '亥'
}

def get_time_branch(hour: int) -> str:
    """시간으로 시지(時支) 구하기"""
    if hour == 23 or hour <= 0:
        return '子'
    elif hour <= 2:
        return '丑'
    elif hour <= 4:
        return '寅'
    elif hour <= 6:
        return '卯'
    elif hour <= 8:
        return '辰'
    elif hour <= 10:
        return '巳'
    elif hour <= 12:
        return '午'
    elif hour <= 14:
        return '未'
    elif hour <= 16:
        return '申'
    elif hour <= 18:
        return '酉'
    elif hour <= 20:
        return '戌'
    else:
        return '亥'

# 시간 천간 계산 (오자원두 기법)
# 甲己日: 甲子시 시작
# 乙庚日: 丙子시 시작
# 丙辛日: 戊子시 시작
# 丁壬日: 庚子시 시작
# 戊癸日: 壬子시 시작
DAY_STEM_TO_HOUR_STEM_BASE = {
    '甲': 0, '己': 0,  # 甲
    '乙': 2, '庚': 2,  # 丙
    '丙': 4, '辛': 4,  # 戊
    '丁': 6, '壬': 6,  # 庚
    '戊': 8, '癸': 8   # 壬
}

def get_time_stem(day_stem: str, time_branch: str) -> str:
    """일간과 시지로 시간 천간 구하기"""
    base_index = DAY_STEM_TO_HOUR_STEM_BASE.get(day_stem, 0)
    branch_index = EARTHLY_BRANCHES.index(time_branch)
    stem_index = (base_index + branch_index) % 10
    return HEAVENLY_STEMS[stem_index]

# 십성 (十星) - 일간 기준으로 다른 간지들의 관계
def get_sipseong(day_stem: str, target_stem: str) -> str:
    """
    일간 기준으로 대상 천간의 십성 구하기
    
    비견(比肩), 겁재(劫財): 나와 같은 오행
    식신(食神), 상관(傷官): 내가 생하는 오행
    편재(偏財), 정재(正財): 내가 극하는 오행
    편관(偏官), 정관(正官): 나를 극하는 오행
    편인(偏印), 정인(正印): 나를 생하는 오행
    """
    day_ohaeng = HEAVENLY_OHAENG[day_stem]
    target_ohaeng = HEAVENLY_OHAENG[target_stem]
    
    day_yin_yang = HEAVENLY_YIN_YANG[day_stem]
    target_yin_yang = HEAVENLY_YIN_YANG[target_stem]
    
    same_yin_yang = (day_yin_yang == target_yin_yang)
    
    # 오행 관계 파악
    if day_ohaeng == target_ohaeng:
        # 같은 오행: 비견/겁재
        return '비견' if same_yin_yang else '겁재'
    
    # 상생상극 관계
    saengguk = {
        '목': {'생': '화', '극': '토'},
        '화': {'생': '토', '극': '금'},
        '토': {'생': '금', '극': '수'},
        '금': {'생': '수', '극': '목'},
        '수': {'생': '목', '극': '화'}
    }
    
    if target_ohaeng == saengguk[day_ohaeng]['생']:
        # 내가 생하는 오행: 식신/상관
        return '식신' if same_yin_yang else '상관'
    elif target_ohaeng == saengguk[day_ohaeng]['극']:
        # 내가 극하는 오행: 편재/정재
        return '편재' if same_yin_yang else '정재'
    else:
        # 나를 생하거나 극하는 오행 찾기
        for oh, relations in saengguk.items():
            if oh == target_ohaeng:
                if relations['생'] == day_ohaeng:
                    # 나를 생하는 오행: 편인/정인
                    return '편인' if same_yin_yang else '정인'
                elif relations['극'] == day_ohaeng:
                    # 나를 극하는 오행: 편관/정관
                    return '편관' if same_yin_yang else '정관'
    
    return '미상'

# 12운성 (十二運星)
TWELVE_UNSEONG = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양']

def get_twelve_unseong(stem: str, branch: str) -> str:
    """천간과 지지로 12운성 구하기"""
    # 12운성 시작 위치 (장생지)
    jangseong_positions = {
        '甲': '亥', '乙': '午',
        '丙': '寅', '丁': '酉',
        '戊': '寅', '己': '酉',
        '庚': '巳', '辛': '子',
        '壬': '申', '癸': '卯'
    }
    
    if stem not in jangseong_positions:
        return '미상'
    
    jangseong = jangseong_positions[stem]
    jangseong_idx = EARTHLY_BRANCHES.index(jangseong)
    branch_idx = EARTHLY_BRANCHES.index(branch)
    
    # 음간은 역행
    if HEAVENLY_YIN_YANG[stem] == '음':
        diff = (jangseong_idx - branch_idx) % 12
    else:
        diff = (branch_idx - jangseong_idx) % 12
    
    return TWELVE_UNSEONG[diff]

# 계절 (Season)
SEASONS = {
    '寅': '봄', '卯': '봄', '辰': '봄',
    '巳': '여름', '午': '여름', '未': '여름',
    '申': '가을', '酉': '가을', '戌': '가을',
    '亥': '겨울', '子': '겨울', '丑': '겨울'
}

def get_season(month_branch: str) -> str:
    """월지로 계절 구하기"""
    return SEASONS.get(month_branch, '미상')

# 유틸리티 함수들
def to_korean_reading(stem_or_branch: str) -> str:
    """한자 간지를 한글 읽기로 변환"""
    if stem_or_branch in HEAVENLY_STEMS:
        idx = HEAVENLY_STEMS.index(stem_or_branch)
        return HEAVENLY_STEMS_KR[idx]
    elif stem_or_branch in EARTHLY_BRANCHES:
        idx = EARTHLY_BRANCHES.index(stem_or_branch)
        return EARTHLY_BRANCHES_KR[idx]
    return stem_or_branch

def format_ganji(stem: str, branch: str, korean: bool = False) -> str:
    """간지를 포맷팅"""
    if korean:
        return f"{to_korean_reading(stem)}{to_korean_reading(branch)}"
    return f"{stem}{branch}"
# 12운성 (12 Phases of Qi)
# 포태법: 천간이 지지를 만났을 때의 기운의 세기
# 순서: 장생, 목욕, 관대, 건록, 제왕, 쇠, 병, 사, 묘, 절, 태, 양
TWELVE_PHASES = [
    '장생(長生)', '목욕(沐浴)', '관대(冠帶)', '건록(建祿)', '제왕(帝旺)', '쇠(衰)', 
    '병(病)', '사(死)', '묘(墓)', '절(絶)', '태(胎)', '양(養)'
]

# 12운성 매핑 테이블 (천간 -> 시작 지지(장생지))
# 양간은 순행, 음간은 역행
# 甲(해), 丙/戊(인), 庚(사), 壬(신) - 양간
# 乙(오), 丁/己(유), 辛(자), 癸(묘) - 음간
UNSEONG_START_BRANCH = {
    '甲': '亥', # 양목: 해수에서 장생
    '乙': '午', # 음목: 오화에서 장생 (역행)
    '丙': '寅', # 양화: 인목에서 장생
    '丁': '酉', # 음화: 유금에서 장생 (역행)
    '戊': '寅', # 양토: 화토동법(병화와 동일)
    '己': '酉', # 음토: 화토동법(정화와 동일)
    '庚': '巳', # 양금: 사화에서 장생
    '辛': '子', # 음금: 자수에서 장생 (역행)
    '壬': '申', # 양수: 신금에서 장생
    '癸': '卯'  # 음수: 묘목에서 장생 (역행)
}

# 12신살 (12 Divine Spirits) - 지지 삼합 기준
# 기준: 인오술(화국), 사유축(금국), 신자진(수국), 해묘미(목국)
# 순서: 겁살, 재살, 천살, 지살, 년살, 월살, 망신살, 장성살, 반안살, 역마살, 육해살, 화개살
TWELVE_SHINSAL = [
    '겁살', '재살', '천살', '지살', '년살', '월살', 
    '망신살', '장성살', '반안살', '역마살', '육해살', '화개살'
]

# 삼합 국 (Three Harmonies Frames)
TRINITY_FRAMES = {
    '寅': '화국', '午': '화국', '戌': '화국', # 인오술 화국
    '巳': '금국', '酉': '금국', '丑': '금국', # 사유축 금국
    '申': '수국', '子': '수국', '辰': '수국', # 신자진 수국
    '亥': '목국', '卯': '목국', '未': '목국'  # 해묘미 목국
}

# 신살 시작 지지 (겁살 기준)
# 인오술(화) -> 해수(겁살)
# 사유축(금) -> 인목(겁살)
# 신자진(수) -> 사화(겁살)
# 해묘미(목) -> 신금(겁살)
SHINSAL_START_BRANCH = {
    '화국': '亥',
    '금국': '寅',
    '수국': '巳',
    '목국': '申'
}

# 기타 신살 (간단한 매핑)
# 역마, 도화(년살), 화개
SIMPLE_SHINSAL = {
    '역마': ['寅', '申', '巳', '亥'],
    '도화': ['子', '午', '卯', '酉'],
    '화개': ['辰', '戌', '丑', '未']
}
