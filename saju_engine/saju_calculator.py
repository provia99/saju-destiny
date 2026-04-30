"""
사주 계산기 (Saju Calculator)

생년월일시 입력 → 사주팔자 추출
음양력 변환 자동 처리
십성 및 합충 분석
"""

from typing import Dict, List, Tuple, Optional
from datetime import datetime
from .heavenly_earthly import (
    HEAVENLY_STEMS, EARTHLY_BRANCHES,
    HEAVENLY_OHAENG, EARTHLY_OHAENG, EARTHLY_HIDDEN_STEMS,
    TWELVE_PHASES, UNSEONG_START_BRANCH,
    TWELVE_SHINSAL, TRINITY_FRAMES, SHINSAL_START_BRANCH,
    HEAVENLY_YIN_YANG, EARTHLY_YIN_YANG,
    get_sipseong, get_twelve_unseong,
    format_ganji, to_korean_reading, get_season
)
from .lunar_solar_converter import lunar_to_solar, solar_to_lunar
from .manseryeok import calculate_four_pillars

class SajuCalculator:
    """사주 계산기 클래스"""
    
    def __init__(self):
        pass
    
    def calculate(
        self,
        year: int,
        month: int,
        day: int,
        hour: int,
        minute: int = 0,
        is_lunar: bool = False,
        is_leap: bool = False,
        gender: str = 'M',
        use_yajojasi: bool = True
    ) -> Dict:
        """
        사주 계산 메인 함수
        
        Args:
            year: 생년 (4자리)
            month: 생월 (1-12)
            day: 생일 (1-31)
            hour: 생시 (0-23)
            minute: 분 (0-59, 자시 판별용)
            is_lunar: 음력 여부
            is_leap: 윤달 여부 (음력일 경우만)
            gender: 성별 ('M' or 'F')
            use_yajojasi: 야자시/조자시 규칙 적용 여부
            
        Returns:
            사주 정보 딕셔너리
        """
        # 음력이면 양력으로 변환
        if is_lunar:
            solar_year, solar_month, solar_day = lunar_to_solar(
                year, month, day, is_leap
            )
            lunar_year, lunar_month, lunar_day = year, month, day
        else:
            solar_year, solar_month, solar_day = year, month, day
            lunar_year, lunar_month, lunar_day, leap = solar_to_lunar(
                year, month, day
            )
            is_leap = leap
        
        # 만세력으로 사주 계산 (야자시/조자시 옵션 전달)
        pillars = calculate_four_pillars(
            solar_year, solar_month, solar_day, hour, minute,
            use_yajojasi=use_yajojasi
        )
        
        # 일간 (日干) - 사주의 중심
        day_stem = pillars['day'][0]
        
        # 십성 계산
        sipseong = self._calculate_sipseong(pillars, pillars['day'][0])
        
        # 12운성 및 신살 등 만세력 데이터 구성
        manseryeok = {}
        day_branch = pillars['day'][1]
        year_branch = pillars['year'][1]
        day_stem = pillars['day'][0]
        
        for pillar_name in ['year', 'month', 'day', 'time']:
            stem = pillars[pillar_name][0]
            branch = pillars[pillar_name][1]
            
            # 천간 십성
            p_sipseong_stem = sipseong.get(f'{pillar_name}_stem', '')
            if pillar_name == 'day': p_sipseong_stem = '일 원' # 일간 표시
            
            # 지지 십성
            p_sipseong_branch = sipseong.get(f'{pillar_name}_branch', '')
            
            # 12운성 (일간 기준 지지)
            unseong = self._calculate_12unseong(day_stem, branch)
            
            # 12신살 (년지 기준) - 사회적/보편적
            shinsal_year = self._calculate_12shinsal(year_branch, branch)
            # 12신살 (일지 기준) - 심리적/개인적
            shinsal_day_12 = self._calculate_12shinsal(day_branch, branch)
            
            # 지장간
            jijanggan = self._get_jijanggan_info(branch, day_stem)
            
            manseryeok[pillar_name] = {
                'stem': stem,
                'branch': branch,
                'sipseong_stem': p_sipseong_stem,
                'sipseong_branch': p_sipseong_branch,
                'unseong': unseong,
                'shinsal': self._combine_shinsal(shinsal_year, shinsal_day_12, pillar_name, stem, branch, day_stem, pillars),
                'jijanggan': jijanggan
            }
            
        # 합충 관계 분석
        hapchung = self._analyze_hapchung(pillars)
        
        # 계절 판단
        season = get_season(pillars['month'][1])
        
        # 결과 구성
        result = {
            'input': {
                'solar_date': f"{solar_year}-{solar_month:02d}-{solar_day:02d}",
                'lunar_date': f"{lunar_year}-{lunar_month:02d}-{lunar_day:02d}",
                'is_leap': is_leap,
                'time': f"{hour:02d}:{minute:02d}",
                'gender': gender,
                'gender_kr': '남' if gender == 'M' else '여'
            },
            'pillars': {
                'year': {
                    'stem': pillars['year'][0],
                    'branch': pillars['year'][1],
                    'ganji': format_ganji(*pillars['year']),
                    'ganji_kr': format_ganji(*pillars['year'], korean=True)
                },
                'month': {
                    'stem': pillars['month'][0],
                    'branch': pillars['month'][1],
                    'ganji': format_ganji(*pillars['month']),
                    'ganji_kr': format_ganji(*pillars['month'], korean=True)
                },
                'day': {
                    'stem': pillars['day'][0],
                    'branch': pillars['day'][1],
                    'ganji': format_ganji(*pillars['day']),
                    'ganji_kr': format_ganji(*pillars['day'], korean=True)
                },
                'time': {
                    'stem': pillars['time'][0],
                    'branch': pillars['time'][1],
                    'ganji': format_ganji(*pillars['time']),
                    'ganji_kr': format_ganji(*pillars['time'], korean=True)
                }
            },
            'day_stem': {
                'stem': day_stem,
                'stem_kr': to_korean_reading(day_stem),
                'ohaeng': HEAVENLY_OHAENG[day_stem],
                'yin_yang': HEAVENLY_YIN_YANG[day_stem]
            },
            'season': season,
            'sipseong': sipseong,
            'unseong': unseong,
            'hapchung': hapchung,
            'manseryeok': manseryeok
        }
        
        return result
    
    def _calculate_sipseong(self, pillars: dict, day_stem: str) -> Dict:
        """십성(十星) 계산"""
        sipseong = {}
        
        # 년간
        sipseong['year_stem'] = get_sipseong(day_stem, pillars['year'][0])
        # 월간
        sipseong['month_stem'] = get_sipseong(day_stem, pillars['month'][0])
        # 일간 (자기 자신)
        sipseong['day_stem'] = '일간'
        # 시간
        sipseong['time_stem'] = get_sipseong(day_stem, pillars['time'][0])
        
        # 지지의 본기(本氣) 천간 매핑
        # 지지의 십성은 지장간의 본기(Main Energy)를 기준으로 함
        branch_to_stem = {
            '子': '癸',  # 자수 -> 계수 (음수)
            '丑': '己',  # 축토 -> 기토 (음토)
            '寅': '甲',  # 인목 -> 갑목 (양목)
            '卯': '乙',  # 묘목 -> 을목 (음목)
            '辰': '戊',  # 진토 -> 무토 (양토)
            '巳': '丙',  # 사화 -> 병화 (양화)
            '午': '丁',  # 오화 -> 정화 (음화)
            '未': '己',  # 미토 -> 기토 (음토)
            '申': '庚',  # 신금 -> 경금 (양금)
            '酉': '辛',  # 유금 -> 신금 (음금)
            '戌': '戊',  # 술토 -> 무토 (양토)
            '亥': '壬'   # 해수 -> 임수 (양수)
        }
        
        # 지지 십성 계산
        for pillar_name in ['year', 'month', 'day', 'time']:
            branch = pillars[pillar_name][1]
            rep_stem = branch_to_stem.get(branch)
            
            if rep_stem:
                sipseong[f'{pillar_name}_branch'] = get_sipseong(day_stem, rep_stem)
            else:
                sipseong[f'{pillar_name}_branch'] = '미상'
        
        return sipseong

    def _calculate_12unseong(self, day_stem: str, branch: str) -> str:
        """12운성 계산"""
        # 양생음사 음생양사 (Yang born Yin dies, Yin born Yang dies)
        # 양간은 순행, 음간은 역행
        
        is_yang = (day_stem in ['甲', '丙', '戊', '庚', '壬'])
        
        start_branch = UNSEONG_START_BRANCH.get(day_stem)
        if not start_branch:
            return ""
            
        start_idx = EARTHLY_BRANCHES.index(start_branch)
        target_idx = EARTHLY_BRANCHES.index(branch)
        
        if is_yang:
            # 순행
            diff = (target_idx - start_idx) % 12
        else:
            # 역행
            diff = (start_idx - target_idx) % 12
            
        return TWELVE_PHASES[diff]

    def _calculate_12shinsal(self, master_branch: str, target_branch: str) -> str:
        """12신살 계산 (년지 또는 일지 기준)"""
        # 삼합 국 찾기
        frame = TRINITY_FRAMES.get(master_branch)
        if not frame:
            return ""
            
        # 겁살 시작 지지
        start_branch = SHINSAL_START_BRANCH.get(frame)
        start_idx = EARTHLY_BRANCHES.index(start_branch)
        target_idx = EARTHLY_BRANCHES.index(target_branch)
        
        diff = (target_idx - start_idx) % 12
        return TWELVE_SHINSAL[diff]

    def _combine_shinsal(self, basic_shinsal, day_shinsal, pillar_name, stem, branch, day_stem, pillars=None):
        """기본 12신살과 특수 신살을 합쳐서 리스트 반환"""
        shinsal_list = []
        if basic_shinsal:
            shinsal_list.append(basic_shinsal) # 년지 기준 (기본)
            
        if day_shinsal and day_shinsal != basic_shinsal:
            shinsal_list.append(f"{day_shinsal}(일)") # 일지 기준 (추가)
            
        # 특수 신살 계산
        if pillars:
            special = self._calculate_special_shinsal(stem, branch, day_stem, pillars, pillar_name)
            shinsal_list.extend(special)
        
        # 5개 제한 해제 (사용자 요청: 한줄에 하나씩 다 나오게)
        return ",".join(shinsal_list)

    def _calculate_gongmang(self, day_stem, day_branch, target_branch):
        """공망(空亡) 계산"""
        stem_idx = HEAVENLY_STEMS.index(day_stem)
        branch_idx = EARTHLY_BRANCHES.index(day_branch)
        
        val = (branch_idx - stem_idx) % 12
        if val < 0: val += 12
        
        if val == 0: empty = ['戌', '亥']
        elif val == 2: empty = ['子', '丑']
        elif val == 4: empty = ['寅', '卯']
        elif val == 6: empty = ['辰', '巳']
        elif val == 8: empty = ['午', '未']
        elif val == 10: empty = ['申', '酉']
        else: empty = []
        
        if target_branch in empty:
            return '공망'
        return None

    def _calculate_special_shinsal(self, stem, branch, day_stem, pillars, pillar_name):
        """특수 신살 계산"""
        special_list = []
        day_branch = pillars['day'][1]
        
        # 1. 공망 (空亡)
        gongmang = self._calculate_gongmang(day_stem, day_branch, branch)
        if gongmang:
            special_list.append(gongmang)
        
        # 2. 천을귀인 (天乙貴人)
        gwiyin_map = {
            '甲': ['丑', '未'], '戊': ['丑', '未'], '庚': ['丑', '未'],
            '乙': ['子', '申'], '己': ['子', '申'],
            '丙': ['亥', '酉'], '丁': ['亥', '酉'],
            '辛': ['午', '寅'],
            '壬': ['巳', '卯'], '癸': ['巳', '卯']
        }
        if branch in gwiyin_map.get(day_stem, []):
            special_list.append('천을귀인')

        # 3. 백호대살 (白虎大殺) - 년/월/일/시주 모두 적용 가능
        baekho_list = [
            ('甲', '辰'), ('乙', '未'), ('丙', '戌'), ('丁', '丑'),
            ('戊', '辰'), ('壬', '戌'), ('癸', '丑')
        ]
        if (stem, branch) in baekho_list:
            special_list.append('백호')

        # 4. 양인살 (羊刃殺)
        yangin_map = {'甲': '卯', '丙': '午', '戊': '午', '庚': '酉', '壬': '子'}
        if branch == yangin_map.get(day_stem):
            special_list.append('양인')
            
        # 5. 괴강살 (魁罡殺)
        goegang_list = [
            ('庚', '辰'), ('庚', '戌'), ('壬', '辰'), ('壬', '戌'), ('戊', '戌')
        ]
        if (stem, branch) in goegang_list:
            special_list.append('괴강')
            
        # 6. 현침살 (懸針殺)
        needles = ['甲', '申', '卯', '午', '辛']
        if stem in needles or branch in needles:
             special_list.append('현침')
             
        # 7. 태극귀인 (太極貴人)
        taegeuk_map = {
            '甲': ['子', '午'], '乙': ['子', '午'],
            '丙': ['卯', '酉'], '丁': ['卯', '酉'],
            '戊': ['辰', '戌', '丑', '未'], '己': ['辰', '戌', '丑', '未'],
            '庚': ['寅', '亥'], '辛': ['寅', '亥'],
            '壬': ['巳', '申'], '癸': ['巳', '申']
        }
        if branch in taegeuk_map.get(day_stem, []):
            special_list.append('태극귀인')
            
        # 8. 홍염살 (紅艶殺)
        hongyeom_pairs = [
             ('甲', '午'), ('乙', '申'), ('丙', '寅'), ('丁', '未'), 
             ('戊', '辰'), ('己', '辰'), ('庚', '戌'), ('辛', '酉'), 
             ('壬', '子'), ('癸', '申')
        ]
        if (day_stem, branch) in hongyeom_pairs:
             special_list.append('홍염')

        # 9. 고란살 (孤鸞殺) - 일주/시주 위주이나 여기선 일주만 체크 (명리 정설)
        if pillar_name == 'day':
            goran_list = [('甲', '寅'), ('乙', '巳'), ('丁', '巳'), ('辛', '亥'), ('戊', '申')]
            if (stem, branch) in goran_list:
                special_list.append('고란')
                
        # 10. 천복귀인 (天福貴人)
        cheonbok_map = {
            '甲': '酉', '乙': '申', '丙': '子', '丁': '亥',
            '戊': '卯', '己': '寅', '庚': '午', '辛': '巳',
            '壬': '午', '癸': '巳' 
        } 
        # 임계는 보통 오사로 봄 (록의 정관)
        if branch == cheonbok_map.get(day_stem):
            special_list.append('천복귀인')
        
        # 11. 협록 (夾祿) - 건록을 끼고 있는 두 글자? 보통 잘 안쓰는데 사용자 요청에 있을 수 있음.
        # 일단 패스하거나, 사용자 이미지에 '협록'이 있으므로 추가.
         
        # 12. 귀문관살 (鬼門關殺) - 타 지지와 일지 관계 (자기 자신 제외)
        if pillar_name != 'day':
            gwimun_check = {
                ('子', '酉'), ('酉', '子'), ('丑', '午'), ('午', '丑'),
                ('寅', '未'), ('未', '寅'), ('卯', '申'), ('申', '卯'),
                ('辰', '亥'), ('亥', '辰'), ('巳', '戌'), ('戌', '巳')
            }
            if (day_branch, branch) in gwimun_check:
                 special_list.append('귀문')

        # 13. 원진살 (怨嗔殺) - 타 지지와 일지 관계
        if pillar_name != 'day':
            wonjin_check = {
                ('子', '未'), ('未', '子'), ('丑', '午'), ('午', '丑'),
                ('寅', '酉'), ('酉', '寅'), ('卯', '申'), ('申', '卯'),
                ('辰', '亥'), ('亥', '辰'), ('巳', '戌'), ('戌', '巳')
            }
            if (day_branch, branch) in wonjin_check:
                 special_list.append('원진')

        # [추가] 14. 문창귀인 (文昌貴人) - 식신이면서 장생지 (학문, 문학)
        moonchang_map = {
            '甲': '巳', '乙': '午', '丙': '申', '丁': '酉', '戊': '申', 
            '己': '酉', '庚': '亥', '辛': '子', '壬': '寅', '癸': '卯'
        }
        if branch == moonchang_map.get(day_stem):
            special_list.append('문창귀인')

        # [추가] 15. 암록 (暗祿) - 건록과 합하는 글자 (보이지 않는 도움)
        amrok_map = {
            '甲': '亥', '乙': '戌', '丙': '申', '丁': '未', '戊': '申',
            '己': '未', '庚': '巳', '辛': '辰', '壬': '寅', '癸': '丑'
        }
        if branch == amrok_map.get(day_stem):
            special_list.append('암록')

        # [추가] 16. 금여 (金輿) - 건록의 다음 글자 (배우자 복, 안락함)
        geumyeo_map = {
            '甲': '辰', '乙': '巳', '丙': '未', '丁': '申', '戊': '未',
            '己': '申', '庚': '戌', '辛': '亥', '壬': '丑', '癸': '寅'
        }
        if branch == geumyeo_map.get(day_stem):
            special_list.append('금여')

        return special_list

    def _get_jijanggan_info(self, branch: str, day_stem: str) -> List[Dict]:
        """지장간 정보 (천간, 십성)"""
        hidden_stems = EARTHLY_HIDDEN_STEMS.get(branch, [])
        result = []
        
        for stem, days in hidden_stems:
            sipseong = get_sipseong(day_stem, stem)
            result.append({
                'stem': stem,
                'days': days,
                'sipseong': sipseong
            })
            
        return result
    
    def _calculate_twelve_unseong(self, pillars: dict, day_stem: str) -> Dict:
        """12운성 계산"""
        unseong = {}
        
        for pillar_name in ['year', 'month', 'day', 'time']:
            branch = pillars[pillar_name][1]
            unseong[pillar_name] = get_twelve_unseong(day_stem, branch)
        
        return unseong
    
    def _analyze_hapchung(self, pillars: dict) -> Dict:
        """합충 관계 분석"""
        hapchung = {
            'cheongan_hap': [],  # 천간합
            'jiji_hap': [],      # 지지합
            'chung': [],         # 충
            'hyung': [],         # 형
            'hae': []            # 해
        }
        
        stems = [
            pillars['year'][0],
            pillars['month'][0],
            pillars['day'][0],
            pillars['time'][0]
        ]
        
        branches = [
            pillars['year'][1],
            pillars['month'][1],
            pillars['day'][1],
            pillars['time'][1]
        ]
        
        # 천간합 (天干合) - 오합
        cheongan_hap_pairs = {
            ('甲', '己'): '토',
            ('乙', '庚'): '금',
            ('丙', '辛'): '수',
            ('丁', '壬'): '목',
            ('戊', '癸'): '화'
        }
        
        pillar_names = ['년간', '월간', '일간', '시간']
        for i in range(4):
            for j in range(i+1, 4):
                pair = tuple(sorted([stems[i], stems[j]]))
                if pair in cheongan_hap_pairs:
                    hapchung['cheongan_hap'].append({
                        'pair': f"{pillar_names[i]}-{pillar_names[j]}",
                        'stems': pair,
                        'result': cheongan_hap_pairs[pair]
                    })
        
        # 지지합 (地支合)
        # 육합 (六合)
        yukhap_pairs = {
            ('子', '丑'): '토', ('寅', '亥'): '목', ('卯', '戌'): '화',
            ('辰', '酉'): '금', ('巳', '申'): '수', ('午', '未'): '화/토'
        }
        
        pillar_names = ['년지', '월지', '일지', '시지']
        for i in range(4):
            for j in range(i+1, 4):
                pair = tuple(sorted([branches[i], branches[j]]))
                if pair in yukhap_pairs:
                    hapchung['jiji_hap'].append({
                        'pair': f"{pillar_names[i]}-{pillar_names[j]}",
                        'branches': pair,
                        'type': '육합',
                        'result': yukhap_pairs[pair]
                    })
        
        # 충 (沖) - 정반대 지지끼리
        chung_pairs = [
            ('子', '午'), ('丑', '未'), ('寅', '申'),
            ('卯', '酉'), ('辰', '戌'), ('巳', '亥')
        ]
        
        for i in range(4):
            for j in range(i+1, 4):
                pair = tuple(sorted([branches[i], branches[j]]))
                if pair in chung_pairs:
                    hapchung['chung'].append({
                        'pair': f"{pillar_names[i]}-{pillar_names[j]}",
                        'branches': pair
                    })
        
        # 형 (刑)
        hyung_groups = [
            (['寅', '巳', '申'], '무은지형'),
            (['丑', '戌', '未'], '지세지형'),
            (['子', '卯'], '무례지형'),
            (['辰', '辰'], '자형'),
            (['午', '午'], '자형'),
            (['酉', '酉'], '자형'),
            (['亥', '亥'], '자형')
        ]
        
        # 형 판별 (간단 버전)
        for group, hyung_type in hyung_groups:
            found_branches = [b for b in branches if b in group]
            if len(found_branches) >= 2:
                hapchung['hyung'].append({
                    'branches': found_branches,
                    'type': hyung_type
                })
        
        return hapchung
    
    def format_output(self, saju_data: Dict) -> str:
        """사주 데이터를 보기 좋게 포맷팅"""
        lines = []
        lines.append("=" * 60)
        lines.append("사주팔자 (四柱八字)")
        lines.append("=" * 60)
        lines.append("")
        
        # 입력 정보
        inp = saju_data['input']
        lines.append(f"양력: {inp['solar_date']} {inp['time']}")
        lines.append(f"음력: {inp['lunar_date']}{'(윤)' if inp['is_leap'] else ''}")
        lines.append(f"성별: {inp['gender_kr']}")
        lines.append("")
        
        # 사주 4주
        p = saju_data['pillars']
        lines.append("    시주      일주      월주      년주")
        lines.append(f"    {p['time']['ganji']}      {p['day']['ganji']}      {p['month']['ganji']}      {p['year']['ganji']}")
        lines.append(f"   ({p['time']['ganji_kr']})    ({p['day']['ganji_kr']})    ({p['month']['ganji_kr']})    ({p['year']['ganji_kr']})")
        lines.append("")
        
        # 일간
        ds = saju_data['day_stem']
        lines.append(f"일간(日干): {ds['stem']}({ds['stem_kr']}) - {ds['ohaeng']}({ds['yin_yang']})")
        lines.append(f"계절: {saju_data['season']}")
        lines.append("")
        
        # 십성
        lines.append("--- 십성(十星) ---")
        sp = saju_data['sipseong']
        lines.append(f"년간: {sp['year_stem']}, 년지: {sp['year_branch']}")
        lines.append(f"월간: {sp['month_stem']}, 월지: {sp['month_branch']}")
        lines.append(f"일간: {sp['day_stem']}, 일지: {sp['day_branch']}")
        lines.append(f"시간: {sp['time_stem']}, 시지: {sp['time_branch']}")
        lines.append("")
        
        # 12운성
        lines.append("--- 12운성 ---")
        us = saju_data['unseong']
        lines.append(f"년지: {us['year']}, 월지: {us['month']}, 일지: {us['day']}, 시지: {us['time']}")
        lines.append("")
        
        # 합충
        hc = saju_data['hapchung']
        if hc['cheongan_hap']:
            lines.append("--- 천간합 ---")
            for h in hc['cheongan_hap']:
                lines.append(f"{h['pair']}: {h['stems']} → {h['result']}화")
        
        if hc['jiji_hap']:
            lines.append("--- 지지합 ---")
            for h in hc['jiji_hap']:
                lines.append(f"{h['pair']}: {h['branches']} → {h['result']} ({h['type']})")
        
        if hc['chung']:
            lines.append("--- 충(沖) ---")
            for c in hc['chung']:
                lines.append(f"{c['pair']}: {c['branches']}")
        
        if hc['hyung']:
            lines.append("--- 형(刑) ---")
            for h in hc['hyung']:
                lines.append(f"{h['branches']}: {h['type']}")
        
        lines.append("")
        lines.append("=" * 60)
        
        return "\n".join(lines)

# 전역 함수
_calculator = SajuCalculator()

def calculate_saju(
    year: int,
    month: int,
    day: int,
    hour: int,
    minute: int = 0,
    is_lunar: bool = False,
    is_leap: bool = False,
    gender: str = 'M',
    use_yajojasi: bool = True
) -> Dict:
    """사주 계산 (전역 함수)"""
    return _calculator.calculate(
        year, month, day, hour, minute,
        is_lunar, is_leap, gender, use_yajojasi
    )

def format_saju_output(saju_data: Dict) -> str:
    """사주 출력 포맷팅 (전역 함수)"""
    return _calculator.format_output(saju_data)
