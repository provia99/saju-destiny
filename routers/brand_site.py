"""
brand_site.py  -  브랜드별 고객 앱 라우터

URL 구조 (두 가지 방식 모두 지원):

  [서브도메인 방식 - 권장]
  banya.sajumaster.com/          -> 인트로 / 홈 리다이렉트
  banya.sajumaster.com/register  -> 회원가입
  banya.sajumaster.com/login     -> 로그인
  banya.sajumaster.com/home      -> 나의 사주 홈
  banya.sajumaster.com/logout    -> 로그아웃
  banya.sajumaster.com/profile   -> 내 정보

  [경로 방식 - 하위 호환]
  /expert/{master_id}            -> 인트로
  /expert/{master_id}/register   -> 회원가입
  /expert/{master_id}/login      -> 로그인
  /expert/{master_id}/home       -> 나의 사주 홈
  /expert/{master_id}/logout     -> 로그아웃
  /expert/{master_id}/profile    -> 내 정보
"""

import hashlib
import html as _html
import json as _json
import os as _os
import re
import subprocess as _subprocess
import random
from datetime import date, timedelta
from pathlib import Path as _Path
from fastapi import APIRouter, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from typing import Optional

import db
import cache_store
from utils import templates
from config import BASE_DOMAIN

router = APIRouter()

# ---------------------------------------------------------
# 상수
# ---------------------------------------------------------
REMEMBER_DAYS = 30
WEEKDAYS = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"]

# ── 상단 인사말 풀 (20개, 매일 시드 기반 랜덤 선택) ──
GREETINGS = [
    "오늘도 좋은 하루 되세요",
    "오늘 하루 별빛이 함께하길",
    "행운이 가까이 머무는 하루이길",
    "오늘 한 걸음이 멋진 흐름이 되길",
    "마음이 평온한 하루 되세요",
    "오늘은 작은 기쁨이 자주 찾아오길",
    "잔잔한 행복이 머무는 하루",
    "오늘의 인연이 따뜻하게 이어지길",
    "오늘도 가볍게 한 걸음 나아가요",
    "당신의 별이 환히 빛나는 하루",
    "햇살처럼 따뜻한 하루 되세요",
    "오늘 한 결정이 좋은 흐름으로",
    "오늘도 당신의 길에 빛이 함께하길",
    "마음이 편안한 하루 되세요",
    "오늘의 작은 노력이 큰 결실로",
    "별과 같은 마음으로 빛나는 하루",
    "오늘은 당신이 주인공인 날",
    "맑고 깊은 하루 되세요",
    "오늘 하루도 당신답게 빛나길",
    "잔잔한 흐름 속 좋은 일이 가득하길",
]

# ── saju_calc 연동 (Node.js subprocess + in-memory cache) ──
_ENGINE_DIR = _Path(__file__).resolve().parent.parent / "engine"
_NODE_DIR_WIN = r"C:\Program Files\nodejs"
_NODE_BIN = (
    _os.path.join(_NODE_DIR_WIN, "node.exe")
    if _os.path.exists(_os.path.join(_NODE_DIR_WIN, "node.exe"))
    else "node"
)
_SAJU_CACHE = {}  # key=client 생일·시·성별 → saju_calc 핵심 결과
_COMPAT_CACHE = {}  # key=(self_key, partner_key, relation) → compat 핵심 결과

def _saju_cache_key(client: dict) -> tuple:
    return (
        int(client.get("birth_year", 0) or 0),
        int(client.get("birth_month", 0) or 0),
        int(client.get("birth_day", 0) or 0),
        str(client.get("birth_time", "모름") or "모름"),
        int(client.get("lunar_yn", 0) or 0),
        int(client.get("leap_month_yn", 0) or 0),
        str(client.get("gender", "남") or "남"),
    )

def _resolve_subject(request: Request, client: dict) -> tuple:
    """
    ?as=<acq_id> 쿼리 파라미터를 보고 분석 대상(subject)을 결정.
    반환: (subject_dict, is_self, label)
      - subject_dict: 사주 계산용 dict (client 또는 acquaintance 변환본)
      - is_self: True면 본인, False면 지인
      - label: 화면 표시용 이름
    """
    qp = request.query_params.get("as")
    if not qp:
        return (client, True, client.get("name", ""))
    try:
        acq_id = int(qp)
    except (TypeError, ValueError):
        return (client, True, client.get("name", ""))
    acq = db.get_acquaintance(acq_id)
    if not acq or acq.get("client_id") != client.get("id"):
        return (client, True, client.get("name", ""))
    subject = {
        # 음수 id로 client와 cache key 충돌 방지
        "id":            -int(acq["id"]),
        "acq_id":        int(acq["id"]),
        "name":          acq.get("name", ""),
        "gender":        acq.get("gender", "남"),
        "birth_year":    acq.get("birth_year"),
        "birth_month":   acq.get("birth_month"),
        "birth_day":     acq.get("birth_day"),
        "birth_time":    acq.get("birth_time", "모름"),
        "lunar_yn":      acq.get("lunar_yn", 0),
        "leap_month_yn": acq.get("leap_month_yn", 0),
        "relation":      acq.get("relation", ""),
    }
    return (subject, False, acq.get("name", ""))


def _call_saju_calc(client: dict) -> dict | None:
    """saju_calc 1회 호출 → 본인 핵심 사주 (용신/희신/기신/구신/일간/신강약).
    in-memory cache (회원당 1회). 실패 시 None."""
    by = int(client.get("birth_year") or 0)
    bm = int(client.get("birth_month") or 0)
    bd = int(client.get("birth_day") or 0)
    if not (by and bm and bd):
        return None
    key = _saju_cache_key(client)
    if key in _SAJU_CACHE:
        return _SAJU_CACHE[key]
    js = (
        "const {전체사주계산}=require('./saju_calc');"
        "try{const r=전체사주계산({"
        f"이름:'_',성별:{repr(client.get('gender','남'))},"
        f"음력입력:{str(bool(client.get('lunar_yn'))).lower()},"
        f"윤달:{str(bool(client.get('leap_month_yn'))).lower()},"
        f"년:{by},월:{bm},일:{bd},"
        f"시간:{repr(client.get('birth_time','모름'))}"
        "});"
        "const dl=(r.대운목록||[]).map(d=>({"
        "천간:d.천간,지지:d.지지,천간한글:d.천간한글,지지한글:d.지지한글,"
        "시작나이:d.시작나이,종료나이:d.종료나이,시작년도:d.시작년도,"
        "나이범위:d.나이범위,대운길흉:d.대운길흉,십이운성:d.십이운성"
        "}));"
        "const cd=r.현재대운?{"
        "천간:r.현재대운.천간,지지:r.현재대운.지지,"
        "천간한글:r.현재대운.천간한글,지지한글:r.현재대운.지지한글,"
        "시작나이:r.현재대운.시작나이,종료나이:r.현재대운.종료나이,"
        "나이범위:r.현재대운.나이범위,대운길흉:r.현재대운.대운길흉}:null;"
        "const cs=r.현재세운?{"
        "년도:r.현재세운.년도,천간:r.현재세운.천간,지지:r.현재세운.지지,"
        "간지:r.현재세운.간지,천간한글:r.현재세운.천간한글,지지한글:r.현재세운.지지한글,"
        "지지오행값:r.현재세운.지지오행값}:null;"
        "process.stdout.write(JSON.stringify({"
        "용신:r.용신,희신:r.희신,기신:r.기신,구신:r.구신,한신:r.한신,"
        "일간:r.일간,일지:r.원국.일주.지지,"
        "년지:r.원국.년주.지지,신강약:r.신강약,"
        "원국:r.원국,일간오행:r.일간오행,일간한글:r.일간한글,일간음양:r.일간음양,"
        "오행점수:r.오행점수,십성배치:r.십성배치,"
        "대운방향:r.대운방향,대운시작나이:r.대운시작나이,"
        "대운목록:dl,현재대운:cd,만나이:r.만나이,"
        "현재세운:cs,현재세운길흉:r.현재세운길흉,현재세운년도:r.현재세운년도"
        "}));}"
        "catch(e){process.stdout.write(JSON.stringify({error:e.message}));}"
    )
    env = _os.environ.copy()
    if _os.path.exists(_NODE_DIR_WIN):
        env["PATH"] = _NODE_DIR_WIN + _os.pathsep + env.get("PATH", "")
    try:
        result = _subprocess.run(
            [_NODE_BIN, "-e", js],
            cwd=str(_ENGINE_DIR), capture_output=True, text=True,
            timeout=15, encoding="utf-8", env=env,
        )
        out = (result.stdout or "").strip()
        data = _json.loads(out) if out else {}
        if "error" in data:
            return None
    except Exception:
        return None
    _SAJU_CACHE[key] = data
    return data


def _compat_input_js(d: dict, name: str) -> str:
    """compat_calc에 넘길 사주 입력 객체 JS literal."""
    by = int(d.get("birth_year") or 0)
    bm = int(d.get("birth_month") or 0)
    bd = int(d.get("birth_day") or 0)
    return (
        "{"
        f"이름:{repr(name or '_')},성별:{repr(d.get('gender','남'))},"
        f"음력입력:{str(bool(d.get('lunar_yn'))).lower()},"
        f"윤달:{str(bool(d.get('leap_month_yn'))).lower()},"
        f"년:{by},월:{bm},일:{bd},"
        f"시간:{repr(d.get('birth_time','모름'))}"
        "}"
    )


# 관계 카드(가족/연인/친구/동료/기타) → 풀 상품 관계단계 기본 매핑
# (relation_stage가 명시 저장된 경우 그것을 우선 사용)
_RELATION_TO_STAGE = {
    "연인": "연인", "가족": "부부", "친구": "연인",
    "동료": "연인", "기타": "연인",
}
# 풀 상품 8단계
_COMPAT_STAGE_OPTIONS = ["썸","연인","예비부부","부부","재혼준비","재혼","별거","이혼고민"]


def _call_compat_calc(self_data: dict, partner_data: dict, relation: str = "") -> dict | None:
    """compatibility_calc.궁합분석 호출 → 풀 상품 점수·등급·항목 반환.
    실패 시 None. partner_data 의 relation_stage / relation_years / children_count /
    marriage_date 를 풀 엔진에 함께 전달 (관계기간은 년→개월 변환)."""
    if not self_data or not partner_data:
        return None
    skey = _saju_cache_key(self_data)
    pkey = _saju_cache_key(partner_data)

    # 관계단계 결정: 명시 저장된 값 > relation 카드 매핑 > "연인"
    explicit_stage = (partner_data.get("relation_stage") or "").strip()
    if explicit_stage in _COMPAT_STAGE_OPTIONS:
        stage = explicit_stage
    else:
        stage = _RELATION_TO_STAGE.get(relation or "", "연인")

    # 관계 기간은 DB에 년 단위로 저장되어 있고, 엔진에는 개월로 환산 전달
    years = partner_data.get("relation_years")
    try:
        years_i = int(years) if years not in (None, "") else None
    except (TypeError, ValueError):
        years_i = None
    months_i = years_i * 12 if years_i is not None else None

    # 자녀수·결혼일은 acquaintance(상대) 측에만 저장됨 (마스터 폼과 일치)
    children = partner_data.get("children_count")
    mdate   = partner_data.get("marriage_date") or ""

    ckey = (skey, pkey, stage, months_i,
            int(children) if children not in (None, "") else None,
            str(mdate))
    if ckey in _COMPAT_CACHE:
        return _COMPAT_CACHE[ckey]
    if not (skey[0] and skey[1] and skey[2]) or not (pkey[0] and pkey[1] and pkey[2]):
        return None

    A_js = _compat_input_js(self_data, self_data.get("name", "A"))
    B_js = _compat_input_js(partner_data, partner_data.get("name", "B"))

    # 관계정보 객체 — 선택값은 채워진 경우에만 포함
    rel_parts = [f"관계단계:{repr(stage)}"]
    if months_i is not None:
        rel_parts.append(f"관계기간개월:{months_i}")
    try:
        if children not in (None, ""):
            rel_parts.append(f"자녀수:{int(children)}")
    except (TypeError, ValueError): pass
    if mdate:
        rel_parts.append(f"결혼예정일:{repr(mdate)}")
    rel_js = "{" + ",".join(rel_parts) + "}"

    js = (
        "const {궁합분석}=require('./products/compatibility/compatibility_calc');"
        f"try{{const r=궁합분석({A_js},{B_js},{rel_js});"
        # ── lean output: 웹 표시에 필요한 필드만 ──
        "const out={"
        "종합:r.점수['종합'],"
        "등급:r.등급,등급키:r.등급키,"
        "상위퍼센트:r.상위퍼센트,하위퍼센트:r.하위퍼센트,"
        "점수상세:r.점수상세,"
        "일간상성:r.항목['일간상성']||null,"
        "오행보완분석:(r.항목['오행보완']||{}).분석||'',"
        "용신교차분석:(r.항목['용신교차']||{}).분석||'',"
        "합충교차:r.항목['합충교차']||{},"
        "친밀도분석:(r.항목['친밀도']||{}).분석||[],"
        "십성관계:r.항목['십성관계']||{},"
        "인연깊이분석:(r.항목['인연깊이']||{}).분석||[],"
        "대운시기:r.항목['대운시기']||{},"
        "잠자리궁합:(r.항목['잠자리궁합']||{}).스타일||'',"
        "갈등포인트:(r.항목['갈등포인트']||{}).분석||[],"
        "A:{이름:r.A.이름,일간:r.A.일간,일간한글:r.A.일간한글||'',"
        "  일지:(r.A.원국&&r.A.원국.일주)?r.A.원국.일주.지지:'',"
        "  격국명:r.A.격국명||'',신강약:r.A.신강약||''},"
        "B:{이름:r.B.이름,일간:r.B.일간,일간한글:r.B.일간한글||'',"
        "  일지:(r.B.원국&&r.B.원국.일주)?r.B.원국.일주.지지:'',"
        "  격국명:r.B.격국명||'',신강약:r.B.신강약||''}"
        "};"
        "process.stdout.write(JSON.stringify(out));"
        "}catch(e){process.stdout.write(JSON.stringify({error:e.message}));}"
    )
    env = _os.environ.copy()
    if _os.path.exists(_NODE_DIR_WIN):
        env["PATH"] = _NODE_DIR_WIN + _os.pathsep + env.get("PATH", "")
    try:
        result = _subprocess.run(
            [_NODE_BIN, "-e", js],
            cwd=str(_ENGINE_DIR), capture_output=True, text=True,
            timeout=30, encoding="utf-8", env=env,
        )
        out = (result.stdout or "").strip()
        data = _json.loads(out) if out else {}
        if "error" in data:
            return None
    except Exception:
        return None
    _COMPAT_CACHE[ckey] = data
    return data


# ── Python 60갑자 일진 ──
_HEAVEN    = "甲乙丙丁戊己庚辛壬癸"
_EARTH     = "子丑寅卯辰巳午未申酉戌亥"
_HEAVEN_OH = ["木","木","火","火","土","土","金","金","水","水"]
_EARTH_OH  = ["水","土","木","木","土","火","火","土","金","金","土","水"]
_OH_KR     = {"木":"목","火":"화","土":"토","金":"금","水":"수"}

# 12지 한자 → 동물 이모지
_BRANCH_EMOJI = {
    "子":"🐭","丑":"🐮","寅":"🐯","卯":"🐰",
    "辰":"🐲","巳":"🐍","午":"🐴","未":"🐑",
    "申":"🐵","酉":"🐔","戌":"🐶","亥":"🐷",
}
_BRANCH_KR = {
    "子":"쥐","丑":"소","寅":"범","卯":"토끼",
    "辰":"용","巳":"뱀","午":"말","未":"양",
    "申":"원숭이","酉":"닭","戌":"개","亥":"돼지",
}
# 용신 오행 → 시각 아이콘
_OH_ICON = {"木":"🌳","火":"🔥","土":"⛰️","金":"✨","水":"💧"}

def _josa(word: str, has_batchim: str, no_batchim: str) -> str:
    """한국어 조사 자동 선택 (이/가, 은/는, 을/를)."""
    if not word: return no_batchim
    last = word[-1]
    code = ord(last)
    if 0xAC00 <= code <= 0xD7A3:
        return has_batchim if (code - 0xAC00) % 28 != 0 else no_batchim
    return no_batchim

def _today_ilji(today: date) -> tuple:
    """양력 날짜 → 일진(천간, 지지, 천간오행, 지지오행).
    1924-02-05 (甲子) reference."""
    REF = date(1924, 2, 5)
    diff = (today - REF).days
    h = diff % 10
    e = diff % 12
    return _HEAVEN[h], _EARTH[e], _HEAVEN_OH[h], _EARTH_OH[e]


def _build_headline(saju: dict | None, ilji: tuple) -> tuple:
    """일진 vs 본인 용신/희신/기신/구신 매칭 → (headline, body, label_short, score_base).
    body는 4~5줄 분량의 풀이."""
    if not saju or not saju.get("용신"):
        return (
            "오늘의 흐름을 차분히 받아들이세요",
            "정확한 사주 풀이를 위해 회원 정보를 한 번 더 확인해주세요. "
            "생년월일·시간·음양력 정보가 정확해야 본인의 용신과 오늘 일진의 흐름을 정밀하게 맞춰볼 수 있습니다. "
            "프로필에서 정보를 보완해주시면 매일 정확한 풀이를 받아보실 수 있습니다.",
            "평", 65,
        )
    yong  = saju.get("용신")
    huy   = saju.get("희신")
    gisin = saju.get("기신")
    gusin = saju.get("구신")
    ilji_str = f"{ilji[0]}{ilji[1]}"
    oh_h_kr  = _OH_KR.get(ilji[2], "")
    oh_e_kr  = _OH_KR.get(ilji[3], "")
    yong_kr  = _OH_KR.get(yong, "")
    huy_kr   = _OH_KR.get(huy, "")
    gisin_kr = _OH_KR.get(gisin, "")
    gusin_kr = _OH_KR.get(gusin, "")
    oh_set = {ilji[2], ilji[3]}

    # 조사 헬퍼
    def J_ga(w):  return _josa(w, "이", "가")
    def J_eun(w): return _josa(w, "은", "는")
    def J_eul(w): return _josa(w, "을", "를")

    # 용신 + 기신 동시 (교차)
    if yong in oh_set and gisin in oh_set:
        return (
            f"용신과 기신이 교차하는 날",
            f"오늘 일진은 {ilji_str}({oh_h_kr}·{oh_e_kr})입니다. 본인의 용신 {yong_kr}과 기신 {gisin_kr}이 동시에 들어와 흐름의 양면이 공존하는 하루입니다. "
            f"좋은 기회와 작은 변수가 한꺼번에 다가올 수 있으니, 우선순위를 정해 핵심 한 가지에만 집중하시면 좋은 결실로 이어집니다. "
            f"주변의 호의와 협력은 자연스럽게 모이지만, 무리한 욕심은 오히려 흐름을 깨뜨릴 수 있으니 평정심을 유지하세요. "
            f"중요한 결정은 일진의 좋은 면이 우세한 오전·낮 시간대에 진행하고, 저녁은 마무리·정리에 시간을 쓰면 균형이 잘 맞춰집니다.",
            "길", 75,
        )
    # 용신
    if yong in oh_set and gisin not in oh_set:
        return (
            f"용신 {yong_kr}의 기운이 강하게 흐르는 날",
            f"오늘 일진은 {ilji_str}({oh_h_kr}·{oh_e_kr})로, 본인의 용신인 {yong_kr}{J_ga(yong_kr)} 함께 흐르는 매우 길한 날입니다. "
            f"평소 망설였던 결정도 과감히 추진하기 좋고, 새로운 만남이나 시도에서 큰 결실이 따라오는 흐름이 강합니다. "
            f"주변에서 자연스럽게 호의가 모이고 협력이 잘 이루어지니 적극적으로 응답하세요. "
            f"오전·오후 모두 흐름이 좋아 미뤘던 일을 한 번에 정리하기에도 적기이며, 작은 친절이 큰 인연으로 이어지는 하루입니다. "
            f"평소보다 한 발 먼저 다가가는 용기가 그대로 보답이 되어 돌아옵니다.",
            "대길", 90,
        )
    # 희신
    if huy in oh_set and gisin not in oh_set:
        return (
            f"희신 {huy_kr}의 도움이 자연스럽게 다가옵니다",
            f"오늘 일진은 {ilji_str}({oh_h_kr}·{oh_e_kr})로, 본인의 희신인 {huy_kr}{J_ga(huy_kr)} 함께 흐르는 하루입니다. "
            f"주변의 협력과 호의가 부드럽게 다가오니, 큰 변화를 좇기보다 잔잔한 도움 하나하나에 마음을 두면 좋은 흐름이 만들어집니다. "
            f"평소 연락이 뜸하던 사람과도 자연스러운 대화가 이어질 수 있고, 그 안에서 뜻밖의 기회가 생기기도 합니다. "
            f"새 일을 벌이기보다, 다가오는 호의에 적극적으로 응답하는 것이 더 큰 결실로 이어지는 날입니다.",
            "길", 80,
        )
    # 기신
    if gisin in oh_set and yong not in oh_set:
        return (
            f"기신 {gisin_kr}의 흐름을 신중히 다스리는 날",
            f"오늘 일진은 {ilji_str}({oh_h_kr}·{oh_e_kr})로, 본인의 기신인 {gisin_kr}{J_ga(gisin_kr)} 함께 있어 흐름이 다소 무거울 수 있는 하루입니다. "
            f"중요한 결정·계약·큰 지출은 잠시 미루고, 주변과의 소통에서도 한 박자 천천히 호흡을 가다듬으세요. "
            f"무리한 일정보다는 가지고 있는 것을 정돈하거나, 조용히 책을 읽고 산책으로 마음을 가라앉히는 시간이 큰 도움이 됩니다. "
            f"저녁으로 갈수록 흐름이 풀리는 경향이 있으니 중요한 일은 늦은 오후 이후로 미뤄두는 것이 좋습니다. "
            f"조심만 하면 큰 사건은 없으니, 차분함을 유지하는 것이 오늘의 가장 큰 무기가 됩니다.",
            "주의", 50,
        )
    # 구신
    if gusin in oh_set:
        return (
            f"구신 {gusin_kr}이 미세히 흔드는 날",
            f"오늘 일진은 {ilji_str}({oh_h_kr}·{oh_e_kr})로, 본인의 구신인 {gusin_kr}{J_ga(gusin_kr)} 살짝 흔드는 하루입니다. "
            f"본인 사주의 용신과 직접 부딪히지는 않으니 큰 사건은 없지만, 일정을 무리하게 잡지 말고 여유를 두고 관리하세요. "
            f"큰 일을 새로 벌이기보다 진행 중인 일을 차근차근 정리하는 데 시간을 쓰면, 좋은 흐름이 다음 단계로 자연스럽게 이어집니다. "
            f"주변의 작은 신호를 놓치지 않고 챙기면 잔잔한 정성이 다음 좋은 시기의 토양이 됩니다.",
            "평", 60,
        )
    # 한신 (용신과 무관)
    return (
        "담담한 흐름의 평온한 하루",
        f"오늘 일진은 {ilji_str}({oh_h_kr}·{oh_e_kr})로, 본인 용신과 직접 관계가 약해 큰 변동 없이 평이하게 흘러가는 하루입니다. "
        f"큰 변화나 사건이 없으니 무리해서 일을 벌이기보다 가지고 있는 것을 정돈하는 데 시간을 쓰면 좋습니다. "
        f"평소 미뤄둔 작은 일들 — 정리정돈·메일 답신·짧은 운동·메모 정리 등 — 을 처리하기에 적기인 날입니다. "
        f"이런 잔잔한 하루의 정성이 모여 다음 좋은 흐름을 부르는 토양이 되어 줍니다. "
        f"큰 행복을 좇기보다 작은 만족에 마음을 두는 것이 오늘 가장 좋은 자세입니다.",
        "평", 65,
    )


# ---------------------------------------------------------
# 헬퍼
# ---------------------------------------------------------

def _brand_ctx(master: dict, request=None) -> dict:
    brand_color = master.get("브랜드색상", "#1A3A6A")
    gold_color  = master.get("금색", "#C8B860")
    try:
        r = int(brand_color[1:3], 16)
        g = int(brand_color[3:5], 16)
        b = int(brand_color[5:7], 16)
        brand_rgb = f"{r},{g},{b}"
    except Exception:
        brand_rgb = "26,58,106"
    master_id = master.get("master_id", "")
    # base_url: 서브도메인이면 "" (상대경로), 경로 방식이면 "/expert/{master_id}"
    if request is not None:
        brand_id = getattr(request.state, "brand_id", None)
        base_url = "" if brand_id == master_id else f"/expert/{master_id}"
    else:
        base_url = f"/expert/{master_id}"
    # 신년운세 시즌 연도 — 1~9월: 현재, 10~12월: 다음 해
    _today = date.today()
    ny_year = _today.year if _today.month < 10 else _today.year + 1
    return {
        "master":      master,
        "master_id":   master_id,
        "brand_name":  master.get("선생님이름", ""),
        "brand_color": brand_color,
        "gold_color":  gold_color,
        "brand_rgb":   brand_rgb,
        "base_domain": BASE_DOMAIN,
        "base_url":    base_url,
        "ny_year":     ny_year,
    }


def _brand_url(request: Request, master_id: str, path: str = "") -> str:
    """서브도메인 접속이면 상대경로, 아니면 /expert/{master_id}/path"""
    brand_id = getattr(request.state, "brand_id", None)
    if brand_id == master_id:
        return f"/{path}" if path else "/"
    return f"/expert/{master_id}/{path}" if path else f"/expert/{master_id}"


def _get_client_session(request: Request, master_id: str):
    client_id = request.session.get(f"client_{master_id}")
    if not client_id:
        return None
    client = db.get_client(client_id)
    if not client:
        return None
    # members 테이블에서 사주 정보 병합 (방향 A)
    member = db.get_member_by_client(master_id, client_id)
    if member:
        for key in ['birth_year', 'birth_month', 'birth_day', 'birth_time',
                    'gender', 'lunar_yn', 'leap_month_yn',
                    'activity_type', 'marital_status', 'concern_area',
                    'has_children', 'has_siblings', 'parent_status',
                    'self_q1', 'self_q2', 'self_q3', 'self_q4',
                    'self_q5', 'self_q6', 'self_q7']:
            client[key] = member.get(key, client.get(key))
        client['member_id'] = member.get('id')
    return client


def _birth_info(client: dict) -> str:
    y = client.get("birth_year")
    m = client.get("birth_month")
    d = client.get("birth_day")
    t = client.get("birth_time", "모름")
    if y and m and d:
        lunar = " (음력)" if client.get("lunar_yn") else ""
        leap  = " [윤달]" if client.get("leap_month_yn") else ""
        return f"{y}년 {m}월 {d}일 {t}{lunar}{leap}"
    return "사주 정보 없음"


TIME_SLOTS = [
    ("새벽", "00:00 ~ 06:00", "휴식과 사색의 시간"),
    ("오전", "06:00 ~ 12:00", "중요한 결정·미팅에 좋은 시간"),
    ("오후", "12:00 ~ 18:00", "협업과 소통의 시간"),
    ("저녁", "18:00 ~ 24:00", "친목과 회복의 시간"),
]
# ── 분야별 운세 텍스트 풀 (5분야 × 3단계) ──
FIELD_TEXTS = {
    "money": {
        "high": "재물의 흐름이 활발하게 들어오는 날입니다. 평소 미뤘던 투자 검토나 절세 정리, 부수입 아이디어가 좋은 결실로 이어질 수 있습니다.",
        "mid":  "안정적인 재물 흐름이 유지됩니다. 큰 변화는 없으나 작은 절약과 꾸준한 저축이 다음 기회의 자산이 됩니다.",
        "low":  "지출이 평소보다 많을 수 있는 날입니다. 충동 구매와 큰 지출은 피하고, 가지고 있는 자산을 정돈하는 데 시간을 쓰세요.",
    },
    "love": {
        "high": "마음의 결이 부드럽고 표현이 자연스러운 날입니다. 새로운 만남이나 오래된 인연 모두에게 한 걸음 다가가기 좋습니다.",
        "mid":  "감정의 큰 변화 없이 차분한 흐름. 평소 하지 못한 한 마디 표현이 작은 따뜻함이 됩니다.",
        "low":  "외로움이나 오해가 마음을 무겁게 할 수 있습니다. 즉답보다는 한 박자 쉬며 호흡을 가다듬으세요.",
    },
    "work": {
        "high": "추진력과 집중력이 잘 어울리는 날입니다. 망설였던 결정·발표·제안에 적기이며, 동료와의 협업도 매끄럽습니다.",
        "mid":  "업무는 평이하게 흘러갑니다. 큰 일보다 미뤄둔 작은 일들을 정리하면 다음 흐름이 가벼워집니다.",
        "low":  "예상치 못한 변수가 발생할 수 있습니다. 무리한 일정보다는 우선순위를 줄이고 핵심에 집중하세요.",
    },
    "health": {
        "high": "기력이 충만하고 몸이 가볍게 느껴지는 날입니다. 평소 하지 않던 운동이나 산책으로 활기를 유지하세요.",
        "mid":  "전반적으로 안정된 컨디션. 평소 식사·수면 패턴을 지키면 무난히 흘러갑니다.",
        "low":  "피로가 쌓일 수 있으니 무리한 일정은 피하세요. 충분한 수분 섭취와 일찍 잠드는 것이 큰 도움이 됩니다.",
    },
    "study": {
        "high": "집중력이 깊어지고 기억력이 좋아지는 날입니다. 어려운 개념을 정리하거나 새 것을 배우기에 더없이 좋은 날.",
        "mid":  "꾸준한 흐름으로 학업을 이어가기 좋은 날. 짧은 시간이라도 매일 반복하는 습관이 중요합니다.",
        "low":  "산만해지기 쉬우니 환경을 정돈하고 짧은 단위로 나눠 학습하세요. 무리하기보다 적은 양을 꼼꼼히.",
    },
}
FIELD_META = [
    ("money",  "재물운", "💰", "오행"),
    ("love",   "연애운", "❤️", "관계"),
    ("work",   "사업운", "💼", "활동"),
    ("health", "건강운", "🌿", "심신"),
    ("study",  "학업운", "📚", "지혜"),
]

def _field_band(score: int) -> str:
    if score >= 75: return "high"
    if score >= 55: return "mid"
    return "low"


# ── 오행별 행운 콘텐츠 (12개 그리드 데이터) ──
# idx: 0=木, 1=火, 2=土, 3=金, 4=水
LUCKY_FLOWER  = ["라일락·대나무", "장미·튤립", "해바라기·국화", "백합·안개꽃", "수국·난"]
LUCKY_FOOD    = ["봄나물·두부", "현미·토마토", "고구마·호박", "마늘·무", "미역·검은콩"]
LUCKY_DRINK   = ["민트티·녹차", "홍차·카모마일", "현미차·보이차", "생강차·유자차", "보리차·옥수수차"]
LUCKY_SCENT   = ["시트러스 (베르가못)", "플로럴·스파이시 (재스민)", "우디 (샌달우드)", "머스크 (화이트머스크)", "마린 (오션)"]
LUCKY_ACCESS  = ["우드 비즈·그린", "루비·가넷", "시트린·토파즈", "다이아·은", "진주·사파이어"]

EXERCISE_POOL = {
    "high": ["러닝", "사이클", "등산", "수영", "근력 운동"],
    "mid":  ["요가", "필라테스", "산책", "스트레칭", "가벼운 조깅"],
    "low":  ["명상", "심호흡", "가벼운 스트레칭", "정원 산책"],
}

# 12지 (0=쥐, 1=소, 2=범, 3=토끼, 4=용, 5=뱀, 6=말, 7=양, 8=원숭이, 9=닭, 10=개, 11=돼지)
ZODIAC_KR    = ["쥐","소","범","토끼","용","뱀","말","양","원숭이","닭","개","돼지"]
ZODIAC_EMOJI = ["🐭","🐮","🐯","🐰","🐲","🐍","🐴","🐑","🐵","🐔","🐶","🐷"]
ZODIAC_HARMONY = {0:1, 1:0, 2:11, 11:2, 3:10, 10:3, 4:9, 9:4, 5:8, 8:5, 6:7, 7:6}  # 육합
ZODIAC_CONFLICT = {0:6, 1:7, 2:8, 3:9, 4:10, 5:11, 6:0, 7:1, 8:2, 9:3, 10:4, 11:5}  # 충

CONTACT_POOL = [
    "오랜 친구", "가족(부모)", "가까운 동료", "옛 스승",
    "오래 못 본 선배", "이웃·동네 친구", "가까운 후배", "사업 파트너",
]

def _zodiac_idx(birth_year: int) -> int:
    return (int(birth_year) - 1900) % 12 if birth_year else 0


DO_POOL = [
    "새로운 사람과의 대화", "작은 투자나 저축 시작",
    "오래 미뤘던 연락 먼저 하기", "산책·가벼운 운동",
    "독서·창작 활동", "감사 표현하기",
    "정리정돈·청소", "건강한 식사",
    "소중한 사람과의 만남",
]
AVOID_POOL = [
    "충동적인 큰 지출", "중요 계약·서명",
    "감정적인 말다툼", "과음·과식",
    "근거 없는 소문 전달", "확인되지 않은 투자",
    "무리한 일정", "갑작스런 약속 변경",
]

def _label_for(score: int) -> str:
    if score >= 90: return "대길"
    if score >= 75: return "길"
    if score >= 60: return "평"
    return "주의"


def _generate_daily_fortune(client: dict, today: date) -> dict:
    seed_str = (f"{client.get('birth_year',1990)}"
                f"{client.get('birth_month',1)}"
                f"{client.get('birth_day',1)}"
                f"{today.year}{today.month}{today.day}")
    seed = int(hashlib.md5(seed_str.encode()).hexdigest(), 16) % (2**32)
    rng  = random.Random(seed)

    # ── 본인 사주 + 오늘 일진 매칭 (saju_calc 연동) ──
    saju = _call_saju_calc(client)
    ilji = _today_ilji(today)
    headline, body, label_from_match, score_base = _build_headline(saju, ilji)

    # 일주 동물 (일지 → 이모지) + 용신 아이콘
    ilju_branch  = (saju or {}).get("일지", "")
    ilju_emoji   = _BRANCH_EMOJI.get(ilju_branch, "🌠")
    ilju_kr      = _BRANCH_KR.get(ilju_branch, "")
    yong_oh      = (saju or {}).get("용신", "")
    yong_icon    = _OH_ICON.get(yong_oh, "")

    # 점수 = 매칭 기반 base ± 시드 변동 (±5)
    total  = max(40, min(99, score_base + rng.randint(-5, 5)))
    money  = max(40, min(100, total + rng.randint(-15, 15)))
    love   = max(40, min(100, total + rng.randint(-15, 15)))
    work   = max(40, min(100, total + rng.randint(-15, 15)))
    health = max(40, min(100, total + rng.randint(-15, 15)))
    study  = max(40, min(100, total + rng.randint(-15, 15)))

    label_short = label_from_match
    label_full = {"대길":"대길 (大吉)","길":"길 (吉)","평":"평 (平)","주의":"주의 (注意)"}[label_short]
    stars_count = max(1, min(5, total // 20))

    # 시간대별 4구간 — 종합 점수 기반 ±20 변동
    timeslots = []
    for name, time_range, advice in TIME_SLOTS:
        t_score = max(30, min(99, total + rng.randint(-15, 15)))
        timeslots.append({
            "name": name, "range": time_range, "advice": advice,
            "score": t_score, "label": _label_for(t_score),
        })

    # 추천 vs 피할 활동
    do_list    = rng.sample(DO_POOL, 3)
    avoid_list = rng.sample(AVOID_POOL, 3)

    # 5분야 fortune.fields — 펜타곤 레이더 + 카드 리스트용
    field_scores = {"money": money, "love": love, "work": work, "health": health, "study": study}
    fields = []
    for key, label, icon, _meta in FIELD_META:
        score = field_scores[key]
        band = _field_band(score)
        fields.append({
            "key":   key,
            "label": label,
            "icon":  icon,
            "score": score,
            "band":  band,
            "text":  FIELD_TEXTS[key][band],
        })

    colors = [
        ("빨강","#FF4444"),("파랑","#4488FF"),("초록","#44BB44"),
        ("노랑","#FFCC00"),("보라","#8844CC"),("흰색","#FFFFFF"),
        ("검정","#333333"),("금색","#C8B860"),("하늘색","#88CCFF"),
    ]
    directions = ["동","서","남","북","동남","동북","서남","서북"]
    lucky_color, lucky_color_hex = colors[rng.randint(0, len(colors)-1)]

    # 오행 기반 행운 (오늘의 oh_idx — 시드 기반)
    oh_idx = rng.randint(0, 4)  # 0=木 1=火 2=土 3=金 4=水
    lucky_flower    = LUCKY_FLOWER[oh_idx]
    lucky_food      = LUCKY_FOOD[oh_idx]
    lucky_drink     = LUCKY_DRINK[oh_idx]
    lucky_scent     = LUCKY_SCENT[oh_idx]
    lucky_accessory = LUCKY_ACCESS[oh_idx]

    # 활동성에 따른 운동
    if   total >= 75: exer_band = "high"
    elif total >= 55: exer_band = "mid"
    else:             exer_band = "low"
    lucky_exercise = rng.choice(EXERCISE_POOL[exer_band])

    # 12지 합·충 (본인 띠 기준)
    my_zod = _zodiac_idx(client.get("birth_year") or 0)
    good_zod_idx = ZODIAC_HARMONY.get(my_zod, (my_zod + 1) % 12)
    bad_zod_idx  = ZODIAC_CONFLICT.get(my_zod, (my_zod + 6) % 12)
    good_zodiac = f"{ZODIAC_EMOJI[good_zod_idx]} {ZODIAC_KR[good_zod_idx]}띠"
    bad_zodiac  = f"{ZODIAC_EMOJI[bad_zod_idx]} {ZODIAC_KR[bad_zod_idx]}띠"

    # 연락하면 좋은 사람
    contact_recommend = rng.choice(CONTACT_POOL)
    advices = [
        "오늘은 새로운 인연을 만날 기회가 있습니다. 열린 마음으로 대화해 보세요.",
        "재물운이 좋으니 소소한 투자나 저축을 시작해 보는 것도 좋습니다.",
        "건강 관리에 신경 쓰세요. 충분한 수면과 규칙적인 식사가 도움이 됩니다.",
        "주변 사람들과의 소통이 중요한 날입니다. 먼저 연락해 보세요.",
        "창의적인 아이디어가 떠오르는 날입니다. 메모해 두면 나중에 도움이 됩니다.",
        "오늘은 감사한 마음을 표현해 보세요. 좋은 기운이 돌아옵니다.",
        "서두르지 말고 차분하게 일을 처리하면 좋은 결과를 얻을 수 있습니다.",
    ]
    return {
        "total_score":     total,
        "total_label":     label_full,
        "total_short":     label_short,
        "headline":        headline,
        "body":            body,
        "total_text":      body,  # 하위 호환
        "stars":           "★" * stars_count + "☆" * (5 - stars_count),
        "stars_count":     stars_count,
        "money_score":     money,
        "love_score":      love,
        "work_score":      work,
        "health_score":    health,
        "study_score":     study,
        "fields":          fields,
        "timeslots":       timeslots,
        "do_list":         do_list,
        "avoid_list":      avoid_list,
        "lucky_color":      lucky_color,
        "lucky_color_hex":  lucky_color_hex,
        "lucky_number":     rng.randint(1, 99),
        "lucky_direction":  directions[rng.randint(0, len(directions)-1)],
        "lucky_flower":     lucky_flower,
        "lucky_food":       lucky_food,
        "lucky_drink":      lucky_drink,
        "lucky_scent":      lucky_scent,
        "lucky_accessory":  lucky_accessory,
        "lucky_exercise":   lucky_exercise,
        "good_zodiac":      good_zodiac,
        "bad_zodiac":       bad_zodiac,
        "contact":          contact_recommend,
        "ilju_emoji":       ilju_emoji,
        "ilju_kr":          ilju_kr,
        "yong_icon":        yong_icon,
        "advice":           advices[rng.randint(0, len(advices)-1)],
    }


def _generate_7day_fortune(client: dict, today: date) -> list:
    """3일전·그제·어제·오늘·내일·모레·3일후 7일치 운세 (막대 그래프용)"""
    labels = ["3일전", "그제", "어제", "오늘", "내일", "모레", "3일후"]
    out = []
    for offset in range(-3, 4):
        d = today + timedelta(days=offset)
        f = _generate_daily_fortune(client, d)
        out.append({
            "date":      d,
            "date_str":  d.strftime("%m/%d"),
            "label":     labels[offset + 3],
            "weekday":   WEEKDAYS[d.weekday()][:1],   # 월/화/수...
            "is_today":  offset == 0,
            "is_past":   offset < 0,
            "is_future": offset > 0,
            "fortune":   f,
        })
    return out


# 하위 호환 (기존 호출이 남아있으면)
def _today_tarot(client: dict, today: date, saju: dict | None) -> dict:
    """오늘의 타로 1장 — 본인 사주 + 오늘 날짜 시드 기반 (재현 가능, 매일 다름).
    정/역위는 50/50 시드. 사주 용신과의 연계 한 줄 추가."""
    from .tarot_data import TAROT_MAJOR
    seed_str = (
        f"tarot_{client.get('birth_year',1990)}_"
        f"{client.get('birth_month',1)}_{client.get('birth_day',1)}_"
        f"{today.year}_{today.month}_{today.day}"
    )
    seed = int(hashlib.md5(seed_str.encode()).hexdigest(), 16)
    rng = random.Random(seed)
    card = rng.choice(TAROT_MAJOR)
    is_reversed = rng.random() < 0.4   # 역위 40% — 정위가 좀 더 자주 (긍정 비율↑)
    text = card["reversed"] if is_reversed else card["upright"]

    # 사주 연계 한 줄 — 용신/일진과 카드 의미 연결
    saju_line = ""
    if saju and saju.get("용신"):
        yong = _OH_KR.get(saju.get("용신"), "")
        if yong:
            saju_line = f"오늘 본인 용신 {yong}의 흐름과 함께, 이 카드의 메시지가 더 선명해집니다."

    do_text   = card.get("do_rev"   if is_reversed else "do_up", "")
    dont_text = card.get("dont_rev" if is_reversed else "dont_up", "")

    return {
        "id":          card["id"],
        "name":        card["name"],
        "name_kr":     card["name_kr"],
        "slug":        card["slug"],
        "image":       f"/static/tarot/major/{card['id']:02d}_{card['slug']}.jpg",
        "keywords":    card["keywords"],
        "is_reversed": is_reversed,
        "position_kr": "역위" if is_reversed else "정위",
        "text":        text,
        "saju_line":   saju_line,
        "do":          do_text,
        "dont":        dont_text,
    }


# ---------------------------------------------------------
# 신년운세 — 캐릭터 + 12개월 + 5분야 + 3미션 + 공유 카드
# ---------------------------------------------------------
NEWYEAR_CHARACTERS = {
    # 일간 오행 → 점수 등급별 캐릭터(이름, 슬로건, 이모지, 컬러)
    "木": [
        ("푸른 새싹", "느려도 멈추지 않는 사람",                "🌱", "#7dd87d"),
        ("초록 정원사", "내 손으로 가꾸는 한 해",              "🌿", "#4caf50"),
        ("청록 모험가", "익숙함을 버리고 새 길로",             "🌳", "#2e8b57"),
        ("빛나는 거목", "무게를 견디고 더 깊이 뿌리내리는 해", "🌲", "#1b5e20"),
    ],
    "火": [
        ("작은 불씨", "꺼지지 않는 마음을 지키는 해",     "🔥", "#ffab40"),
        ("주홍 전사", "정면 돌파가 가장 빠른 길",         "🌅", "#ff7043"),
        ("황금 불꽃", "당당히 빛나도 좋은 한 해",         "✨", "#ff9800"),
        ("붉은 사자", "두려움 없이 포효하는 한 해",       "🦁", "#e64a19"),
    ],
    "土": [
        ("황토 수호자", "묵묵히 자기 자리를 지키는 해", "🛡️", "#bcaaa4"),
        ("황금 기사",   "단단함이 곧 무기인 한 해",     "⚔️", "#d4a017"),
        ("골든 베어",   "두툼한 한 해, 깊은 한 발",     "🐻", "#a1887f"),
        ("빛나는 산",   "흔들리지 않고 보내는 한 해",   "⛰️", "#795548"),
    ],
    "金": [
        ("은빛 매",     "예리한 직관으로 결정하는 해",   "🦅", "#bdbdbd"),
        ("백금 검사",   "맑은 결단이 길을 여는 해",      "🗡️", "#90a4ae"),
        ("백색 늑대",   "혼자도 강해지는 한 해",         "🐺", "#cfd8dc"),
        ("강철 사신",   "가차 없는 정리가 자유로 이끄는 해", "⚙️", "#607d8b"),
    ],
    "水": [
        ("푸른 파도",   "흐름을 타고 멀리 가는 해",       "🌊", "#4fc3f7"),
        ("청록 인어",   "감정을 무기로 쓰는 한 해",       "🧜", "#26c6da"),
        ("깊은 호수",   "고요함이 힘이 되는 한 해",       "💧", "#0288d1"),
        ("빛의 항해사", "긴 여정의 결말이 보이는 해",     "🧭", "#01579b"),
    ],
}

NEWYEAR_HEADLINES = {
    "high":    "올해는 *축적*보다 *도약*입니다",
    "balance": "올해는 *깊이*가 폭을 만드는 해입니다",
    "caution": "올해는 *정리*가 새 시작을 부르는 해입니다",
}

# 분야별 풀이 풀 (3단계 × 5분야 × 2개) — body는 ~10줄 분량
NEWYEAR_FIELD_POOL = {
    "money": {
        "high": [
            ("재물의 큰 흐름이 들어오는 해",
             "들어오는 흐름이 활발해지는 해입니다. 그동안 묵묵히 쌓아온 노력이 *결실*로 이어지면서, "
             "본업에서 인정과 함께 실질적인 보상이 따라옵니다.\n\n"
             "특히 상반기에는 예상치 못한 *부수입의 기회*가 열립니다. 작은 채널이라도 시도해 두면 "
             "하반기에 본업 못지않은 흐름으로 자라날 수 있으니, 망설이지 말고 한 가지를 시작해 보세요.\n\n"
             "다만 들어오는 만큼 *나가는 길*도 함께 넓어지기 쉽습니다. 지출 구조를 한 번 점검하고, "
             "자동 저축 시스템을 만들어 두면 *진짜 자산*이 쌓이는 해가 됩니다. 충동소비만 조심하세요."),
            ("부수입의 가능성이 열리는 해",
             "본업에 더해 *작은 부업이나 사이드 채널*을 시도하기 가장 좋은 해입니다. 처음부터 큰 수익이 "
             "안 나와도 괜찮습니다. 흐름의 씨앗을 심어두는 의미가 더 큽니다.\n\n"
             "특히 본인 *전문 분야의 콘텐츠화*(글·강의·컨설팅 등)가 잘 풀립니다. SNS·블로그·뉴스레터 등 "
             "본인이 편한 채널 한 가지를 정해 꾸준히 쌓아 보세요. 1년 뒤에 보면 액수보다 *습관*이 자산입니다.\n\n"
             "가족이나 친지 사이의 *돈 거래*는 이 해에 시작하지 않는 게 좋습니다. 흐름이 좋아도 "
             "인간관계가 엉킬 수 있으니 분리 운영이 답입니다. 작은 시작이 다음 해의 큰 줄기가 됩니다."),
        ],
        "mid": [
            ("안정적인 흐름이 유지되는 해",
             "큰 변동 없이 *꾸준한 흐름*이 이어지는 해입니다. 새로운 큰 수입이 들어오지는 않지만, "
             "기존 수입원이 안정적으로 유지되니 그것만으로도 충분히 좋은 흐름입니다.\n\n"
             "올해는 *모으는 쪽*에 무게를 두세요. 무리한 투자나 큰 베팅보다 작은 절약과 자동 저축이 "
             "다음 해 도약의 기반이 됩니다. 적금·보험·연금 같은 안전 자산을 한 번 정비하기 좋은 시기.\n\n"
             "지출 항목 중 *습관화된 새는 돈*(구독·자동결제·외식 등)을 점검하세요. 한 달에 한 번씩 "
             "결산하는 루틴을 만들면, 1년 후에는 한눈에 보이는 자산 차이가 생겨있을 것입니다."),
            ("기복이 약간 있지만 평균 이상",
             "달마다 들쑥날쑥 보여도 *한 해 결산은 플러스*입니다. 좋은 달과 나쁜 달이 번갈아 오니 "
             "감정적으로 흔들리지 마시고, 멀리 보는 시야를 유지하세요.\n\n"
             "*비축의 한 해*로 가져가시면 좋습니다. 좋은 달에 들어온 수입을 다 쓰지 말고 30% 정도는 "
             "비축해 두세요. 그래야 흐름이 약한 달에도 부담 없이 넘어갈 수 있습니다.\n\n"
             "충동소비가 가장 큰 적입니다. 큰 결제 전에 *24시간 보류 룰*(하루 자고 결정)을 적용하면 "
             "후회 지출의 70%는 사라집니다. 작은 규칙 하나가 한 해의 차이를 만듭니다."),
        ],
        "low": [
            ("새는 곳을 막는 한 해",
             "큰 수입의 흐름은 잠잠하지만, *새는 돈을 잡는 만큼* 자산이 보이는 해입니다. 들어오는 쪽보다 "
             "나가는 쪽을 점검하는 데 에너지를 쓰세요.\n\n"
             "고정 지출 중 *불필요한 항목*을 한 번 정리하기 좋은 시기입니다. 안 쓰는 구독, 사용도가 낮은 "
             "보험, 비효율적인 통신 요금 등을 1주일만 들여 정비하면 한 해 내내 효과가 따라옵니다.\n\n"
             "큰 투자나 새로운 사업 결정은 *후반기*로 미루세요. 상반기는 보수적으로 운영하고, "
             "흐름을 보며 천천히 다음 카드를 꺼내는 것이 안전합니다. 무리하지 않는 게 가장 큰 수익."),
            ("절제와 정리의 시기",
             "한 해 전반은 *지출 절제*에 무게를 두는 흐름입니다. 새로운 카드를 만들거나 큰 결제를 "
             "시작하지 마시고, 기존 고정비를 줄이는 데 집중하세요.\n\n"
             "투자는 *전문가 동행이 필수*입니다. 혼자 결정하기보다 신뢰할 수 있는 사람의 검토를 받고 "
             "움직이세요. 정보 부족으로 인한 손실 가능성이 평소보다 큽니다.\n\n"
             "후반기로 갈수록 흐름이 회복됩니다. 상반기에 잘 버티면 하반기에는 작은 기회가 보이기 시작하니, "
             "그때를 위해 *현금 흐름과 신용*을 깨끗하게 유지하는 것이 올해의 핵심 과제입니다."),
        ],
    },
    "love": {
        "high": [
            ("새 인연이 다가오는 해",
             "익숙한 자리에만 머물지 마세요. 올해는 *새 관계의 문*이 활짝 열려 있는 해입니다. "
             "낯선 자리에 한 발 내딛는 용기가 평생 인연을 만들 수 있습니다.\n\n"
             "특히 *취미·배움·운동* 같은 자기계발 자리에서 만나는 인연이 깊습니다. 일이나 소개팅처럼 "
             "목적이 분명한 자리보다, 자연스러운 활동을 통해 만나는 사람이 더 잘 맞을 가능성이 큽니다.\n\n"
             "기존에 호감이 있던 사람이 있다면 *상반기 안*에 마음을 표현해 보세요. 흐름이 가장 부드러운 "
             "시기이니, 망설이는 동안 흐름이 지나갑니다. 진심을 가벼운 행동으로 옮겨 보세요."),
            ("관계가 깊어지는 한 해",
             "가벼운 이벤트보다 *진솔한 대화*가 더 큰 결실을 만드는 해입니다. 함께 보내는 시간의 "
             "깊이를 챙기세요. 자주 만나는 것보다 *제대로 들어주는* 한 번이 더 큰 의미를 남깁니다.\n\n"
             "결혼·동거·이사 같은 *큰 관계 결정*에 좋은 흐름입니다. 충분히 대화하고 양가의 의견도 "
             "확인했다면, 결단을 미루지 마세요. 흐름이 받쳐주는 시기는 길지 않습니다.\n\n"
             "다만 너무 가까워진 만큼 *서로의 영역*도 존중해 주세요. 모든 시간을 함께하기보다 "
             "각자만의 시간을 인정하는 균형이 관계를 더 단단하게 만듭니다."),
        ],
        "mid": [
            ("잔잔하고 따뜻한 해",
             "큰 사건은 없어도 *작은 감사*가 쌓이는 해입니다. 화려한 이벤트보다 일상의 작은 "
             "표현이 관계의 온도를 높여줍니다. 매일 한마디만 더해 보세요.\n\n"
             "기존 관계가 있는 분들은 *권태기 위험*을 미리 점검하세요. 익숙해진 만큼 무뎌지기 쉬우니, "
             "분기에 한 번씩이라도 *낯선 데이트*(처음 가는 곳·새로운 활동)를 시도해 보세요.\n\n"
             "솔로인 분들은 무리해서 인연을 찾기보다 *자기 안목*을 키우는 한 해로 가져가세요. "
             "혼자만의 시간을 잘 보낸 사람이 다음 해 더 좋은 인연을 만나는 토양을 갖게 됩니다."),
            ("관계 점검의 시기",
             "맞지 않는 인연은 *자연스럽게 정리*될 수 있는 해입니다. 억지로 잡지 말고 흐름에 맡기세요. "
             "그 자리에 새로운 인연이 들어올 공간이 생깁니다.\n\n"
             "*친구 관계의 재정렬*이 일어나기도 합니다. 한동안 자주 보던 사람과 멀어지고, "
             "오래 못 본 사람과 다시 가까워지는 일이 생기니 자연스럽게 받아들이세요.\n\n"
             "지금 곁에 있는 사람과는 *진짜 대화*를 더 자주 나누세요. 표면적인 안부보다 깊이 있는 "
             "이야기 한 번이 일 년의 관계를 결정합니다. 들어주는 데 더 많은 시간을 쓰세요."),
        ],
        "low": [
            ("외로움이 진해지는 시기",
             "혼자 있는 시간이 길어지는 해입니다. 다만 이 시간을 *결핍*이 아닌 *기회*로 보세요. "
             "다음 인연을 만날 토양을 다지는 시기로 가져가시면 됩니다.\n\n"
             "외로움을 *사람으로 채우려는 충동*을 경계하세요. 맞지 않는 사람과 시작하면 더 큰 외로움이 "
             "옵니다. 차라리 혼자만의 취미·운동·배움에 시간을 투자하는 게 정답입니다.\n\n"
             "옛 인연이 다시 떠오를 수 있지만 *재결합은 신중히* 결정하세요. 흐름이 약한 해에 시작한 "
             "관계는 깊어지기보다 같은 패턴을 반복할 가능성이 큽니다. 한 호흡 늦추세요."),
            ("기존 관계 갈등 주의",
             "사소한 말 한마디가 크게 번질 수 있는 해입니다. 평소 같으면 가볍게 넘길 일도 "
             "오해가 쌓이기 쉬우니, *말의 무게*를 챙겨주세요.\n\n"
             "갈등은 *24시간 안에 풀기*를 원칙으로 삼으세요. 묵히면 묵힐수록 더 풀기 어려워집니다. "
             "감정이 격할 때는 일단 멈추고, 한 박자 늦춘 뒤 차분히 대화를 시도하세요.\n\n"
             "이 시기에 *큰 결정*(결혼·이별·동거)은 미루는 게 안전합니다. 흐름이 약할 때 내린 결정은 "
             "후반기에 후회로 돌아오기 쉽습니다. 일단 이 한 해는 *지키는 데* 집중하세요."),
        ],
    },
    "work": {
        "high": [
            ("인정과 승진의 흐름",
             "그동안 묵묵히 쌓아온 노력이 *결실*로 돌아오는 해입니다. 승진·연봉 인상·중요 프로젝트 배정 "
             "등 *공식적인 인정*이 따라옵니다. 자신 있게 본인을 드러내세요.\n\n"
             "*상반기*가 가장 강한 흐름입니다. 미뤄둔 발표·면담·협상이 있다면 상반기 안에 마무리하세요. "
             "당당히 본인의 가치를 말할 수 있는 시기이니, 겸손이라는 이름으로 숨지 마세요.\n\n"
             "다만 *주변과의 균형*을 챙기세요. 본인이 빛나는 만큼 시기·질투의 시선이 따라올 수 있습니다. "
             "공로를 함께한 동료들에게 감사를 표현하면 흐름이 더 길게 이어집니다."),
            ("새 기회가 열리는 해",
             "*이직·이동·창업* 검토에 가장 좋은 해입니다. 새로운 환경에서 본인의 가치를 발휘할 "
             "기회가 열립니다. 익숙한 자리에만 머물지 마세요.\n\n"
             "다만 큰 결정은 *상반기 후반*(5~6월)이 가장 안전한 타이밍입니다. 그 이전은 정보 수집과 "
             "준비, 그 이후는 본격적인 실행으로 가져가는 흐름이 좋습니다.\n\n"
             "*인맥을 통한 기회*가 특히 큽니다. 이직은 채용 공고보다 추천·소개로 들어가는 자리가 "
             "한 단계 위입니다. 평소 신뢰를 쌓아둔 사람들에게 한 번씩 안부 연락을 돌리세요."),
        ],
        "mid": [
            ("꾸준함이 빛나는 해",
             "큰 변화 없이 *흐름을 깊게 다지는* 해입니다. 새 일을 벌리기보다 지금 하고 있는 일을 "
             "더 깊이 파고들면 다음 해 도약의 토대가 됩니다.\n\n"
             "*전문성 강화*에 시간을 투자하기 좋은 시기. 자격증·강의·책 등 본인의 전문 분야를 "
             "한 단계 깊게 만드는 활동에 집중하세요. 1년 뒤 시야가 달라져 있을 것입니다.\n\n"
             "큰 전환이 없는 만큼 *작은 변화*에서 의미를 찾으세요. 매일의 루틴, 효율을 높이는 도구, "
             "협업 방식의 개선 등이 누적되어 한 해 후에 큰 차이를 만듭니다."),
            ("주변과의 협력이 핵심",
             "혼자 빨리 가는 것보다 *함께 멀리 가는 것*이 정답인 해입니다. 본인 능력만 믿지 말고 "
             "팀·파트너·외부 협업의 힘을 빌리세요.\n\n"
             "특히 *분야가 다른 사람*과의 협업에서 시너지가 납니다. 익숙한 사람들과의 협업도 좋지만, "
             "낯선 분야와의 만남에서 예상치 못한 성과가 나올 수 있습니다.\n\n"
             "갈등 상황에서는 *먼저 양보*하는 쪽이 결국 더 큰 것을 얻습니다. 작은 양보가 신뢰로 "
             "쌓이고, 그 신뢰가 다음 기회를 만드는 한 해입니다."),
        ],
        "low": [
            ("정리와 재정비의 시기",
             "벌리지 말고 *덜어내세요*. 진행 중인 일이 너무 많다면 우선순위를 매겨 가장 중요한 한두 가지에 "
             "집중하는 게 정답입니다. 핵심에 집중해야 후반기에 빛납니다.\n\n"
             "*조직 내 변화*가 있을 수 있습니다. 인사 이동·팀 개편·업무 변화 등을 미리 예상하고 "
             "유연하게 대응하세요. 변화에 저항하기보다 흐름을 타는 게 더 안전합니다.\n\n"
             "큰 결정은 *후반기*로 미루세요. 상반기는 정리와 비축의 시기로 가져가고, 본격적인 "
             "도약은 다음 해를 노리세요. 잠시 멈추는 게 다음 도약의 기반이 됩니다."),
            ("스트레스 관리가 우선",
             "성과보다 *컨디션*이 우선입니다. 무리한 일정은 후반기로 미루고, 본인 페이스를 지키세요. "
             "건강을 잃으면 일도 함께 무너집니다.\n\n"
             "*인간관계 갈등*이 일에 영향을 줄 수 있습니다. 직장 내 미묘한 신경전이 길어지면 "
             "큰 문제로 번지기 전에 *제3자에게 상담*받거나 거리를 두는 결정을 빠르게 하세요.\n\n"
             "이 시기에는 *과정*을 챙기세요. 결과가 빨리 안 나와도 좌절하지 말고, 매일의 작은 "
             "기록을 남기세요. 후반기에 그 기록이 본인을 다시 일으키는 자료가 됩니다."),
        ],
    },
    "health": {
        "high": [
            ("활력이 차오르는 해",
             "체력과 활력이 좋아지는 해입니다. 묵은 피로가 풀리면서 일상의 의욕도 함께 올라옵니다. "
             "이 흐름을 잘 활용해 *건강 습관 하나*를 정착시키면 평생 자산이 됩니다.\n\n"
             "*운동 루틴*을 만들기 가장 좋은 시기. 새로운 종목을 시도해도 좋고, 평소 미뤄둔 "
             "PT·요가·러닝 클럽 등을 시작해 보세요. 처음 3개월만 견디면 평생 습관이 됩니다.\n\n"
             "다만 *컨디션이 좋다고 무리하지 마세요*. 흐름이 좋을 때 과로하면 후반기에 한 번에 "
             "몰려옵니다. 적절한 휴식과 회복 시간을 챙기는 균형이 핵심입니다."),
            ("회복과 재생의 흐름",
             "묵은 피로와 만성적인 불편이 *풀리는* 해입니다. 그동안 미뤄두었던 검진·치료·재활을 "
             "이 시기에 받아두면 효과가 가장 큽니다.\n\n"
             "특히 *상반기 안*에 정기 검진을 받으세요. 흐름이 좋을 때 받는 검진은 결과도 좋고, "
             "혹시 문제가 있어도 회복이 빠릅니다. 미루지 마시고 일정을 잡으세요.\n\n"
             "*수면의 질*에 투자하기 좋은 해입니다. 매트리스·베개·침실 환경 등 잠자리 개선이 "
             "한 해 내내 효과를 보여줍니다. 푹 자는 것이 가장 강력한 회복제입니다."),
        ],
        "mid": [
            ("기복이 작은 무난한 해",
             "큰 건강 이슈 없이 *무난하게* 지나가는 해입니다. 다만 무난함에 안주하면 작은 신호를 "
             "놓치기 쉬우니, 평소 컨디션을 *기록하는 습관*을 들여보세요.\n\n"
             "*규칙적인 생활 리듬*이 가장 큰 약입니다. 잠자는 시간·일어나는 시간·식사 시간을 "
             "일정하게 유지하면 그것만으로도 컨디션이 한 단계 올라갑니다.\n\n"
             "*새벽과 저녁의 컨디션 차이*를 살피세요. 한 시간대가 유난히 처진다면 그 시간 "
             "행동 패턴(과식·스트레스·자세 등)을 점검해 보세요. 답이 보입니다."),
            ("작은 잔병 주의",
             "큰 병은 없지만 *환절기 면역*이 약해지는 해입니다. 감기·몸살·소화불량 같은 잔병이 "
             "잦을 수 있으니 미리 챙기세요.\n\n"
             "*손씻기·마스크·수분 섭취* 같은 기본기가 가장 효과적입니다. 비싼 보조제보다 "
             "기본 위생과 충분한 수면이 면역의 90%를 결정합니다.\n\n"
             "*과로·과음·과식*을 한 번에 하지 않도록 주의하세요. 평소 같으면 견뎌지는 일도 "
             "이 시기에는 한 번에 무너지기 쉽습니다. 조금 일찍 잠자리에 드는 것이 답입니다."),
        ],
        "low": [
            ("관리가 필요한 해",
             "체력 비축이 *최우선* 과제입니다. 무리한 일정과 압박적인 환경을 미리 조정하세요. "
             "건강을 잃으면 다른 모든 흐름이 함께 흔들립니다.\n\n"
             "*수면·식사 리듬*을 절대 우선순위로 두세요. 일이 많아도 잠자는 시간만큼은 지키시고, "
             "끼니를 거르지 마세요. 기본기가 무너지면 회복이 길어집니다.\n\n"
             "*정기 검진*을 미루지 마시고, 평소 신경 쓰이던 부위가 있다면 이 해에 꼭 진료받으세요. "
             "흐름이 약한 해에 발견하는 것이 후반기·다음 해 회복을 빠르게 만듭니다."),
            ("스트레스성 증상 주의",
             "마음이 *몸으로* 옵니다. 두통·소화불량·불면 등 스트레스성 증상이 잦아질 수 있으니 "
             "원인부터 챙기세요. 약보다 휴식과 마음 정리가 답입니다.\n\n"
             "*명상·산책 같은 회복 루틴*을 정착시키세요. 매일 10분만이라도 일정 시간을 "
             "마음 정리에 쓰면 한 해 내내 효과가 따라옵니다.\n\n"
             "*갈등 상황을 길게 두지 마세요*. 마음의 짐이 길어질수록 몸이 더 빨리 망가집니다. "
             "전문가 상담·신뢰하는 사람과의 대화 등 출구를 만드는 것이 건강의 핵심입니다."),
        ],
    },
    "people": {
        "high": [
            ("귀인이 나타나는 해",
             "새로 알게 되는 사람 중 *큰 도움을 주는 인연*이 있는 해입니다. 적극적으로 새 자리에 "
             "참여하고, 낯선 사람과의 대화를 마다하지 마세요.\n\n"
             "특히 *나보다 한 단계 위에 있는 사람*과의 인연이 큽니다. 멘토·선배·전문가와의 "
             "만남에서 한 해의 흐름을 바꿀 조언을 얻을 수 있으니 적극적으로 다가가세요.\n\n"
             "*감사 표현*이 인연을 길게 만듭니다. 도움받은 일이 있다면 24시간 안에 짧게라도 "
             "감사를 표현하는 습관을 들이세요. 한 해 동안 이 작은 습관이 큰 차이를 만듭니다."),
            ("관계의 폭이 넓어지는 해",
             "낯선 자리에 한 번씩 나가보세요. 우연한 만남이 *큰 흐름*을 바꾸는 해입니다. "
             "동호회·세미나·지역 모임 등 평소 가지 않던 자리에 분기당 한 번씩이라도 가보세요.\n\n"
             "*분야가 다른 사람*과의 만남에서 의외의 시너지가 나옵니다. 본인 분야 사람들만 만나기보다 "
             "다른 직군·세대·지역의 사람들과의 교류를 늘리세요.\n\n"
             "다만 인맥의 *질*도 챙기세요. 명함만 주고받는 자리보다 *깊은 대화*를 한 번이라도 "
             "나눌 수 있는 자리에 시간을 쓰세요. 양보다 질이 답입니다."),
        ],
        "mid": [
            ("기존 관계가 깊어지는 해",
             "이미 알고 있는 사람들 중 *진짜 인연*이 보이는 시기입니다. 새 인연을 찾기보다 "
             "주변 사람을 더 깊이 챙기는 한 해로 가져가세요.\n\n"
             "*오래 못 본 사람*에게 먼저 연락해 보세요. 한동안 멀어졌던 친구·동료·선배가 "
             "다시 가까워지면서 새로운 흐름의 문이 열릴 수 있습니다.\n\n"
             "가족·가까운 사람과의 관계를 *재정비*하기 좋은 시기. 미뤄둔 대화, 풀지 못한 오해를 "
             "한 번에 정리해 보세요. 가까운 관계가 안정되면 모든 흐름이 함께 좋아집니다."),
            ("작은 갈등은 일찍 풀기",
             "갈등이 *묵히면 커지는* 해입니다. 24시간 안에 대화로 풀어내는 원칙을 세우세요. "
             "감정이 격할 때 결정하지 마시고, 한 박자 늦춘 뒤 차분히 이야기하세요.\n\n"
             "특히 *직장·가족 안의 작은 신경전*을 그냥 두지 마세요. 한 번 풀지 못하면 다음 갈등 때 "
             "더 크게 튀어나옵니다. 작더라도 정리하고 가는 게 정답.\n\n"
             "갈등이 풀리지 않는 사람과는 *거리를 두는 결정*도 필요합니다. 모든 관계를 다 잡으려 "
             "하기보다 본인 에너지를 지키는 우선순위를 분명히 하세요."),
        ],
        "low": [
            ("사람으로 인한 피곤",
             "맞지 않는 사람과의 *접촉이 잦아지는* 해입니다. 이 시기에는 모든 관계를 다 챙기려 "
             "하지 마시고, 본인 에너지를 지키는 우선순위를 분명히 하세요.\n\n"
             "*거리 두기는 죄가 아닙니다*. 가까웠던 사람이라도 본인을 소진시키는 관계라면 잠시 "
             "거리를 두세요. 죄책감 없이, 한 해 동안 본인을 회복시키는 데 우선순위를 두세요.\n\n"
             "이 시기에 *새 인연을 찾기*보다 *기존 인연을 정리*하는 게 더 중요합니다. 다음 해 "
             "흐름이 좋아질 때 새로운 인연이 들어올 공간을 미리 만들어 두는 의미입니다."),
            ("말 조심이 핵심",
             "오해가 커지기 쉬운 해입니다. 같은 말도 다르게 해석되어 갈등으로 번질 수 있으니 "
             "*말하기 전 한 박자 늦추는 습관*을 들이세요.\n\n"
             "*문자·메신저로 중요한 이야기를 하지 마세요*. 글은 표정과 어조가 빠져 오해가 더 큽니다. "
             "민감한 주제는 직접 만나거나 적어도 통화로 푸세요.\n\n"
             "*험담·뒷담화*는 절대 금물입니다. 이 시기에 한 말은 어떻게든 본인에게 돌아옵니다. "
             "말의 무게가 평소보다 무거운 한 해이니, 입조심이 곧 운조심입니다."),
        ],
    },
}

NEWYEAR_MISSION_POOL = [
    ("💰", "수입원 하나 더 만들기",      "본업 외 부수입 채널을 한 가지 실험해 보세요. 결과보다 *시도*가 자산입니다."),
    ("📚", "새 기술 1개 익히기",         "올해 안에 자격증·강의·언어 등 한 가지를 끝내는 것을 목표로 잡으세요."),
    ("🤝", "새 인연 3명 사귀기",         "낯선 자리에 분기당 1번씩. 1년이면 4번, 그 중 *진짜 인연* 1명은 만납니다."),
    ("🧘", "건강 루틴 정착시키기",       "새 운동보다 *주 3회 30분*을 1년 유지가 목표. 수면·식사 리듬도 함께."),
    ("🗒️", "올해의 책 12권 읽기",         "한 달 한 권. 쌓이면 다음 해 시야가 달라집니다."),
    ("🧹", "안 쓰는 것 비우기",           "물건·관계·습관 모두 *덜어내는* 한 해. 비운 자리에 새 기회가 들어옵니다."),
    ("✈️", "혼자 떠나기 1회",             "완전히 모르는 곳에서 1박 2일. 사주적으로 *전환의 트리거*가 됩니다."),
    ("💌", "감사 표현 매주 1회",         "주변 한 사람에게 짧은 감사 메시지. 운의 흐름이 부드러워집니다."),
    ("📈", "월급의 10% 자동저축",        "복잡한 재테크보다 *자동화*가 답. 1년 뒤에 보면 액수보다 *습관*이 자산."),
    ("🎯", "분기별 목표 1개씩",          "1년 4분기, 한 번에 한 가지만. 너무 많이 잡으면 다 못 합니다."),
]


_EMPH_RE = re.compile(r"\*([^*\n]+)\*")
def _emph(text: str) -> str:
    """본문 속 *X* → <em>X</em> 한 번에 모두 변환 (HTML escape 후 적용)."""
    if not text:
        return ""
    return _EMPH_RE.sub(r"<em>\1</em>", _html.escape(text))


def _newyear_character(saju: dict, total_score: int) -> dict:
    """일간 오행 + 총운 점수 → 캐릭터 1개 선택."""
    ilgan_oh = (saju or {}).get("일간_오행") or "土"
    if ilgan_oh not in NEWYEAR_CHARACTERS:
        ilgan_oh = "土"
    pool = NEWYEAR_CHARACTERS[ilgan_oh]
    if   total_score >= 80: idx = 3
    elif total_score >= 65: idx = 2
    elif total_score >= 50: idx = 1
    else:                   idx = 0
    name, slogan, emoji, color = pool[idx]
    return {"name": name, "slogan": slogan, "emoji": emoji, "color": color, "oh": ilgan_oh}


def _newyear_fortune(client: dict, year: int, saju: dict | None) -> dict:
    """신년운세 데이터 — 시드 기반 재현 가능, 같은 사람·같은 해는 같은 결과."""
    seed_str = (
        f"newyear_{client.get('birth_year',1990)}_{client.get('birth_month',1)}_"
        f"{client.get('birth_day',1)}_{year}"
    )
    seed = int(hashlib.md5(seed_str.encode()).hexdigest(), 16)
    rng  = random.Random(seed)

    # 총운 점수 (사주 + 시드)
    base_score  = 60 + rng.randint(-12, 18)
    total_score = max(40, min(95, base_score))
    if   total_score >= 75: tone = "high"
    elif total_score >= 55: tone = "balance"
    else:                   tone = "caution"
    headline = NEWYEAR_HEADLINES[tone]

    # 캐릭터
    character = _newyear_character(saju, total_score)

    # 12개월 흐름 — 사인 곡선 + 노이즈
    import math
    phase = rng.random() * math.pi * 2
    months = []
    high_months, low_months = [], []
    for m in range(1, 13):
        wave = math.sin(phase + (m - 1) * math.pi / 6) * 12   # ±12
        s = max(40, min(95, total_score + int(wave) + rng.randint(-6, 6)))
        if   s >= 75: lbl, mtone = "길월", "high"
        elif s >= 55: lbl, mtone = "보통",  "mid"
        else:         lbl, mtone = "주의", "low"
        text_pool = [
            f"흐름이 부드럽게 풀리는 달, {['중반','하순','초반'][rng.randint(0,2)]}이 가장 강합니다.",
            f"평소 미뤄둔 일에 *결단*이 필요한 달.",
            f"새 시작보다 *마무리*에 무게를 두면 좋습니다.",
            f"사람을 통해 길이 열리는 달입니다.",
            f"몸과 마음의 *컨디션*에 우선순위를 두세요.",
            f"작은 시도가 큰 흐름으로 이어집니다.",
        ]
        months.append({
            "month": m,
            "score": s,
            "tone":  mtone,
            "label": lbl,
            "text":  rng.choice(text_pool),
        })
        if mtone == "high": high_months.append(m)
        if mtone == "low":  low_months.append(m)

    # 5분야
    field_meta = [
        ("money",  "재물운", "💰"),
        ("love",   "애정운", "💕"),
        ("work",   "직업운", "💼"),
        ("health", "건강운", "🌿"),
        ("people", "대인운", "🤝"),
    ]
    fields = []
    for key, label, icon in field_meta:
        s = max(40, min(95, total_score + rng.randint(-15, 15)))
        if   s >= 70: band = "high"
        elif s >= 55: band = "mid"
        else:         band = "low"
        title, advice = rng.choice(NEWYEAR_FIELD_POOL[key][band])
        fields.append({
            "key":    key,
            "label":  label,
            "icon":   icon,
            "score":  s,
            "band":   band,
            "title":  title,
            "advice": _emph(advice),   # *X* → <em>X</em> 일괄 변환 + 줄바꿈 보존
        })

    # 3미션 — 점수 분포 기반 우선순위 (낮은 분야에 미션 매핑하면 좋지만, 일단 시드 랜덤 3개)
    missions_picked = rng.sample(NEWYEAR_MISSION_POOL, 3)
    missions = [{"icon": m[0], "title": m[1], "desc": m[2]} for m in missions_picked]

    # 공유 카드 요약
    share = {
        "headline":    headline,
        "char_name":   character["name"],
        "total_score": total_score,
        "fields":      [{"label": f["label"], "score": f["score"], "icon": f["icon"]} for f in fields],
        "key_advice":  rng.choice([
            "올해는 *한 가지*에 집중하면 모든 게 풀리는 해입니다.",
            "올해는 *덜어내는 만큼* 들어오는 해입니다.",
            "올해는 *사람*을 통해 길이 열리는 해입니다.",
            "올해는 *깊이*가 폭을 만드는 해입니다.",
        ]),
    }

    return {
        "year":         year,
        "total_score":  total_score,
        "tone":         tone,
        "headline":     headline,
        "character":    character,
        "months":       months,
        "high_months":  high_months,
        "low_months":   low_months,
        "fields":       fields,
        "missions":     missions,
        "share":        share,
    }


async def _newyear(request: Request, master_id: str):
    """신년운세 페이지 — 캐릭터 + 12개월 + 5분야 + 3미션 + 공유."""
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    client = _get_client_session(request, master_id)
    if not client:
        return RedirectResponse(_brand_url(request, master_id, "login"))
    today = date.today()
    target_year = today.year if today.month < 10 else today.year + 1
    subject, is_self, subject_label = _resolve_subject(request, client)
    saju    = _call_saju_calc(subject)
    # 사용자별 결과 캐시 — 입력값 해시 + 분석 연도 + 본인/지인 식별
    _cache_key = f"{cache_store.input_hash(subject)}_{int(subject.get('id', 0))}_{target_year}"
    fortune = cache_store.get(client["id"], "newyear", _cache_key)
    if fortune is None:
        fortune = _newyear_fortune(subject, target_year, saju)
        cache_store.set(client["id"], "newyear", _cache_key, fortune)

    _greet_seed = int(hashlib.md5(
        f"{client.get('id',0)}_{today.year}_{today.month}_{today.day}".encode()
    ).hexdigest(), 16)
    greeting = GREETINGS[_greet_seed % len(GREETINGS)]

    ctx = _brand_ctx(master, request)
    ctx.update({
        "client":        client,
        "subject":       subject,
        "subject_label": subject_label,
        "is_self":       is_self,
        "acquaintances": db.get_acquaintances_by_client(client["id"]) or [],
        "today_str":     today.strftime("%Y년 %m월 %d일"),
        "target_year":   target_year,
        "weekday":       WEEKDAYS[today.weekday()],
        "fortune":       fortune,
        "greeting":      greeting,
    })
    return templates.TemplateResponse(request, "brand/newyear.html", ctx)


# ---------------------------------------------------------
# 정통사주 — 명식 + 오행 + 대운 (실제 엔진 데이터 기반)
# ---------------------------------------------------------

# 일간 별칭 (10천간 × 음양·오행 기반)
_ILGAN_ALIAS = {
    "甲": ("우뚝 솟은 큰 나무", "곧고 강직한 리더형"),
    "乙": ("부드러운 화초",     "유연하고 섬세한 마음"),
    "丙": ("환한 태양",         "따뜻하고 밝은 에너지"),
    "丁": ("작은 등불",         "은은하고 정성스러운 빛"),
    "戊": ("높고 굳건한 산",    "묵직하고 신뢰가는 기둥"),
    "己": ("기름진 들판",       "포용력 있는 어머니의 땅"),
    "庚": ("벼린 강철",         "결단력 있는 의리의 검"),
    "辛": ("정교한 보석",       "예리하고 자존감 있는 빛"),
    "壬": ("드넓은 바다",       "유연하고 깊은 흐름"),
    "癸": ("맑은 샘물",         "섬세하고 직관적인 흐름"),
}

# 십성 → 짧은 의미
_SIPSEONG_MEAN = {
    "비견": "동료·경쟁",  "겁재": "배다른 형제",
    "식신": "베푸는 마음", "상관": "재능·표현",
    "편재": "큰 재물·기회","정재": "꾸준한 재물",
    "편관": "강한 명예",  "정관": "안정된 명예",
    "편인": "특수 학문",  "정인": "정통 학문",
}

# 오행 컬러 (도넛 차트)
_OH_COLOR = {
    "木": "#7dd87d",
    "火": "#ff7043",
    "土": "#d4a017",
    "金": "#cfd8dc",
    "水": "#4fc3f7",
}

# 십성 5계열 메타 (라벨·아이콘·간단 의미)
_SIP_GROUPS = [
    ("비겁", "비견·겁재", "🤝", "동료·경쟁·자존감"),
    ("식상", "식신·상관", "🌱", "표현·창의·재능"),
    ("재성", "편재·정재", "💰", "재물·기회·실속"),
    ("관성", "편관·정관", "👑", "명예·책임·체계"),
    ("인성", "편인·정인", "📚", "학문·도움·인덕"),
]

# 개운법 — 용신 오행별 추천 (색·방향·시간·음식·소품)
_GAEWOON = {
    "木": {
        "color":     ("초록·청록", "#4caf50"),
        "direction": "동쪽",
        "time":      "이른 아침 (5~9시)",
        "food":      "신선한 채소·신맛(레몬·매실)",
        "item":      "나무 소품·식물 화분",
    },
    "火": {
        "color":     ("빨강·주황", "#ff7043"),
        "direction": "남쪽",
        "time":      "정오 (11~13시)",
        "food":      "쓴맛(커피·고추)·붉은 음식",
        "item":      "촛불·향초·원목 액자",
    },
    "土": {
        "color":     ("골드·황토", "#d4a017"),
        "direction": "중앙·환절기",
        "time":      "오후 (13~17시)",
        "food":      "단맛(고구마·꿀)·곡물",
        "item":      "도자기·황색 패브릭",
    },
    "金": {
        "color":     ("백색·실버", "#cfd8dc"),
        "direction": "서쪽",
        "time":      "저녁 (17~21시)",
        "food":      "매운맛(생강·마늘)·흰 음식",
        "item":      "금속 액세서리·시계",
    },
    "水": {
        "color":     ("검정·남색", "#0288d1"),
        "direction": "북쪽",
        "time":      "밤 (21시~01시)",
        "food":      "짠맛(해조류·견과)·검은 음식",
        "item":      "수정·유리 소품",
    },
}

def _ilgan_explain(saju: dict) -> str:
    """일간 + 신강약 + 음양 기반 4~5줄 풀이."""
    오행 = saju.get("일간오행", "")
    음양 = saju.get("일간음양", "")
    신강약 = saju.get("신강약", "")
    base = {
        "木": "곧고 강직한 나무처럼 한 방향으로 뻗어나가는 기질",
        "火": "환하게 타오르는 불꽃처럼 정열적이고 표현력이 풍부한 기질",
        "土": "묵직한 산이나 들판처럼 신뢰가 가는 안정의 기질",
        "金": "정교하게 벼린 금속처럼 결단력과 의리가 뚜렷한 기질",
        "水": "흐르는 물처럼 유연하고 깊은 통찰을 지닌 기질",
    }.get(오행, "본인만의 고유한 기질")
    yy = {"양":"드러내는", "음":"내면을 다지는"}.get(음양, "")
    if "강" in 신강약:
        sk = "본인의 의지가 강해 *주도적으로* 흐름을 끌고 갈 수 있는 사주입니다. 단, 과하면 주변과 부딪힐 수 있으니 *유연함*을 챙기세요."
    elif "약" in 신강약:
        sk = "주변의 도움과 흐름을 *잘 활용*하면 더 멀리 갈 수 있는 사주입니다. 인덕이 큰 흐름이니 *관계*에 정성을 들이세요."
    else:
        sk = "균형이 잡힌 흐름이라 *차분하게 본인의 길*을 다지기 좋은 사주입니다. 큰 변화보다는 깊이를 만드는 시기."
    return (
        f"{base}을 가지고 계십니다. 음양으로는 *{음양}*({yy}) 성향이 두드러집니다.\n\n"
        f"{sk} 주변 흐름을 살피되, *본인 색*을 분명히 하는 것이 평생 운의 핵심입니다."
    )


def _oh_balance_explain(oh_dist: list) -> str:
    """오행 분포 균형 풀이 (3줄)."""
    if not oh_dist:
        return ""
    sorted_d = sorted(oh_dist, key=lambda x: x.get("score", 0), reverse=True)
    top, bottom = sorted_d[0], sorted_d[-1]
    if top["pct"] > 40:
        return (
            f"*{top['oh']}({top['kr']})*이 {top['pct']}%로 매우 강한 편입니다. "
            f"이 기운을 지나치게 쓰면 균형이 무너질 수 있으니, 부족한 *{bottom['oh']}({bottom['kr']})* "
            f"기운을 일상에 채워주는 것이 운기 보강의 핵심입니다."
        )
    if (top["pct"] - bottom["pct"]) < 15:
        return (
            "오행이 매우 고르게 분포되어 있는 *균형형* 사주입니다. "
            "어느 한 흐름에 치우치지 않아 다양한 분야에 적응이 빠르고, "
            "안정적인 흐름을 유지하기 좋은 구조입니다."
        )
    return (
        f"*{top['oh']}({top['kr']})*이 강하고 *{bottom['oh']}({bottom['kr']})*이 약한 편입니다. "
        f"부족한 {bottom['oh']} 기운을 *개운법*(아래)대로 보강하시면 "
        f"흐름이 한층 부드러워집니다."
    )


def _sinsin_explain(sinsin: list) -> str:
    """5신 활용 가이드 (3~4줄)."""
    yong = next((s for s in sinsin if s["label"] == "용신"), None)
    gi   = next((s for s in sinsin if s["label"] == "기신"), None)
    if not yong or not gi:
        return ""
    return (
        f"용신 *{yong['oh']}({yong['kr']})*은 본인에게 가장 도움 되는 기운입니다. "
        f"이 오행을 일상에 더할수록 운기가 부드러워지고 흐름이 풀립니다.\n\n"
        f"기신 *{gi['oh']}({gi['kr']})*은 과하면 흉을 부르는 기운이니, "
        f"큰 결정을 내릴 때 이 오행과 관련된 환경(색·방향·시간)은 *피하는* 것이 좋습니다."
    )


def _sip_top_explain(sip_dist: list) -> str:
    """가장 강한 십성 계열 풀이 (3~4줄)."""
    if not sip_dist:
        return ""
    sorted_sip = sorted(sip_dist, key=lambda x: x.get("count", 0), reverse=True)
    top = sorted_sip[0]
    if top["count"] == 0:
        return ""
    desc = {
        "비겁": "*주체성과 추진력*이 있는 사주입니다. 본인의 의지가 강해 한번 정한 길은 끝까지 가지만, "
                "과하면 *고집·갈등*으로 이어질 수 있으니 *협력*의 자세를 함께 챙기세요.",
        "식상": "*재능과 끼*가 있는 사주입니다. 표현하고 만들어내는 영역이 강하니, "
                "본인의 재능을 살리는 직업·취미·콘텐츠가 평생 *동력*이 됩니다.",
        "재성": "*현실 감각과 실속*이 있는 사주입니다. 금전·사업·기회의 흐름에 민감하니, "
                "*자기 관리*만 챙기면 큰 자산을 쌓아갈 수 있는 구조입니다.",
        "관성": "*책임감과 리더십*이 있는 사주입니다. 조직·공직·전문직에서 빛나는 흐름이고, "
                "*안정된 명예*와 사회적 위치를 차근차근 쌓아갑니다.",
        "인성": "*지적 호기심과 인덕*이 있는 사주입니다. 배움이 평생 자산이 되고, "
                "주변에서 도움이 자연스럽게 따라오는 *복덕* 있는 구조입니다.",
    }.get(top["key"], "")
    return (
        f"가장 강한 영역은 *{top['key']}*({top['sub']})로 {top['count']}자입니다.\n\n"
        f"{desc}"
    )


def _seun_explain(seun: dict) -> str:
    """현재 세운 풀이 확장 (3~4줄)."""
    if not seun:
        return ""
    tone = seun.get("tone", "mid")
    base = {
        "high": (
            "흐름이 부드럽게 풀리는 한 해입니다. 미뤄둔 일에 *결단*을 내리거나, "
            "새로운 도전을 시작하기 좋은 시기. 작은 시도가 큰 결실로 이어질 수 있는 흐름이니 "
            "*적극성*을 챙기세요."
        ),
        "mid": (
            "큰 변동 없이 *안정적인* 한 해입니다. 새 일을 벌리기보다 *기존의 흐름을 깊게 다지는* 데 "
            "에너지를 쓰면 다음 해 도약의 토대가 됩니다."
        ),
        "low": (
            "변수가 많은 한 해이니 *조심스럽게* 가는 게 정답입니다. 큰 결정·이직·창업은 "
            "후반기로 미루시고, 본업에 집중하며 *내실*을 다지세요. "
            "어려움 속에 분명한 배움이 있는 흐름입니다."
        ),
    }.get(tone, "")
    return base


def _gaewoon_intro(gaewoon: dict) -> str:
    """개운법 인트로 (2~3줄)."""
    if not gaewoon:
        return ""
    return (
        f"용신 *{gaewoon['yong']}({gaewoon['yong_kr']})*에 해당하는 흐름을 일상의 작은 행동으로 보강하는 가이드입니다. "
        f"한 번에 다 하실 필요 없이, *매일 한 가지씩* 의식하셔도 한 해의 결이 달라집니다."
    )


def _traditional_saju(saju: dict | None) -> dict | None:
    """정통사주 페이지용 데이터 빌더 — saju_calc 결과를 표시 가능한 구조로 정리."""
    if not saju or not saju.get("원국"):
        return None

    원국 = saju["원국"]
    일간 = saju.get("일간", "")
    alias_name, alias_sub = _ILGAN_ALIAS.get(일간, ("", ""))

    # 십성배치 → {위치: 십성명} 맵
    sip_map = {}
    for s in (saju.get("십성배치") or []):
        sip_map[s.get("위치", "")] = s

    # 명식판 — 4기둥 × {pos, 천간, 지지, 천간_십성, 지지_십성, 천간한글, 지지한글, 일주여부}
    pillar_keys = [
        ("시주", "시간", "시지"),
        ("일주", None,   "일지"),    # 일주 천간 = 일간 자체
        ("월주", "월간", "월지"),
        ("년주", "년간", "년지"),
    ]
    pillars = []
    for pname, hgan_pos, jiji_pos in pillar_keys:
        p = 원국.get(pname, {})
        cheon = p.get("천간", "")
        ji    = p.get("지지", "")
        한글  = p.get("한글", "")
        # 한글 분리 ("을목축토" = 천간한글+오행+지지한글+오행 → 천간:"을", 지지:"축")
        cheon_kr = 한글[0] if len(한글) >= 1 else ""
        ji_kr    = 한글[2] if len(한글) >= 3 else ""
        # 천간 십성 (일주는 본인이라 십성 없음 → 일원 표시)
        if pname == "일주":
            cheon_sip = {"십성명": "일원", "계열": "일원"}
        else:
            cheon_sip = sip_map.get(hgan_pos, {})
        ji_sip = sip_map.get(jiji_pos, {})
        # 천간/지지 오행
        try:
            cheon_oh = _HEAVEN_OH[_HEAVEN.index(cheon)]
        except ValueError:
            cheon_oh = ""
        try:
            ji_oh = _EARTH_OH[_EARTH.index(ji)]
        except ValueError:
            ji_oh = ""
        pillars.append({
            "name":       pname,
            "cheon":      cheon,
            "cheon_kr":   cheon_kr,
            "cheon_oh":   cheon_oh,
            "cheon_sip":  cheon_sip.get("십성명", ""),
            "ji":         ji,
            "ji_kr":      ji_kr,
            "ji_oh":      ji_oh,
            "ji_sip":     ji_sip.get("십성명", ""),
            "is_ilju":    (pname == "일주"),
            "ji_animal":  _BRANCH_EMOJI.get(ji, ""),
        })

    # 오행 도넛 — 점수 → 백분율
    oh_scores = saju.get("오행점수") or {}
    total = sum(oh_scores.get(k, 0) for k in ["木","火","土","金","水"]) or 1
    oh_dist = []
    for k in ["木", "火", "土", "金", "水"]:
        v = oh_scores.get(k, 0)
        pct = round((v / total) * 100, 1) if total else 0
        oh_dist.append({
            "oh":    k,
            "kr":    _OH_KR.get(k, k),
            "score": round(v, 1),
            "pct":   pct,
            "color": _OH_COLOR.get(k, "#888"),
            "icon":  _OH_ICON.get(k, ""),
        })

    # 5신 표시 (용신/희신/기신/구신/한신)
    sinsin = []
    for label, key in [("용신","용신"),("희신","희신"),("기신","기신"),("구신","구신"),("한신","한신")]:
        v = saju.get(key)
        if v:
            sinsin.append({
                "label": label,
                "oh":    v,
                "kr":    _OH_KR.get(v, v),
                "color": _OH_COLOR.get(v, "#888"),
                "icon":  _OH_ICON.get(v, ""),
            })

    # 대운 타임라인 — 8~10개 대운, 현재 강조
    daewoon_list = saju.get("대운목록") or []
    try:
        age_now = int(saju.get("만나이") or 0)
    except (TypeError, ValueError):
        age_now = 0
    daewoon = []
    for i, d in enumerate(daewoon_list):
        try:
            s_age = int(d.get("시작나이", 0) or 0)
        except (TypeError, ValueError):
            s_age = 0
        try:
            e_age = int(d.get("종료나이", s_age + 9) or s_age + 9)
        except (TypeError, ValueError):
            e_age = s_age + 9
        is_current = (s_age <= age_now <= e_age)
        gilhyung = d.get("대운길흉", "")
        if "길" in gilhyung or "용신" in gilhyung or "희신" in gilhyung:
            tone = "high"
        elif "흉" in gilhyung or "기신" in gilhyung or "구신" in gilhyung:
            tone = "low"
        else:
            tone = "mid"
        daewoon.append({
            "idx":        i,
            "cheon":      d.get("천간", ""),
            "ji":         d.get("지지", ""),
            "cheon_kr":   (d.get("천간한글", "")[0] if d.get("천간한글") else ""),
            "ji_kr":      (d.get("지지한글", "")[0] if d.get("지지한글") else ""),
            "start_age":  s_age,
            "end_age":    e_age,
            "start_year": str(d.get("시작년도", "") or ""),
            "age_range":  d.get("나이범위", f"{s_age}-{e_age}세"),
            "gilhyung":   gilhyung,
            "tone":       tone,
            "is_current": bool(is_current),
            "ship":       d.get("십이운성", ""),
        })

    # 십성 5계열 분포 (비겁·식상·재성·관성·인성) — 8자 명식 기준
    sip_count = {"비겁":0, "식상":0, "재성":0, "관성":0, "인성":0}
    for s in (saju.get("십성배치") or []):
        cat = s.get("계열", "")
        if cat in sip_count:
            sip_count[cat] += 1
    sip_total = sum(sip_count.values()) or 1
    sip_dist = []
    for key, sub_label, icon, meaning in _SIP_GROUPS:
        c = sip_count.get(key, 0)
        pct = round((c / sip_total) * 100, 1)
        sip_dist.append({
            "key":     key,
            "sub":     sub_label,
            "icon":    icon,
            "meaning": meaning,
            "count":   c,
            "pct":     pct,
        })

    # 현재 세운 카드
    seun = None
    cs = saju.get("현재세운")
    if cs:
        gilhyung = saju.get("현재세운길흉", "") or ""
        if "길" in gilhyung or "용신" in gilhyung or "희신" in gilhyung:
            tone = "high"
        elif "흉" in gilhyung or "기신" in gilhyung or "구신" in gilhyung:
            tone = "low"
        else:
            tone = "mid"
        seun = {
            "year":    cs.get("년도"),
            "ganji":   cs.get("간지", ""),
            "cheon":   cs.get("천간", ""),
            "ji":      cs.get("지지", ""),
            "cheon_kr":(cs.get("천간한글", "")[0] if cs.get("천간한글") else ""),
            "ji_kr":   (cs.get("지지한글", "")[0] if cs.get("지지한글") else ""),
            "ji_oh":   cs.get("지지오행값", ""),
            "gilhyung":gilhyung,
            "tone":    tone,
        }

    # 개운법 — 용신 오행 기반 (없으면 일간 오행 fallback)
    yong_oh = saju.get("용신") or saju.get("일간오행") or "土"
    g = _GAEWOON.get(yong_oh, _GAEWOON["土"])
    gaewoon = {
        "yong":          yong_oh,
        "yong_kr":       _OH_KR.get(yong_oh, yong_oh),
        "color_label":   g["color"][0],
        "color_hex":     g["color"][1],
        "direction":     g["direction"],
        "time":          g["time"],
        "food":          g["food"],
        "item":          g["item"],
    }

    # 풀이 텍스트 (각 섹션 아래 박스에 표시) — *X* → <em> 일괄 변환
    text_ilgan       = _emph(_ilgan_explain(saju))
    text_oh_balance  = _emph(_oh_balance_explain(oh_dist))
    text_sinsin      = _emph(_sinsin_explain(sinsin))
    text_sip_top     = _emph(_sip_top_explain(sip_dist))
    text_seun        = _emph(_seun_explain(seun)) if seun else ""
    text_gaewoon     = _emph(_gaewoon_intro(gaewoon))

    return {
        "일간":     일간,
        "일간한글": saju.get("일간한글", ""),
        "일간오행": saju.get("일간오행", ""),
        "일간음양": saju.get("일간음양", ""),
        "alias":    alias_name,
        "alias_sub":alias_sub,
        "신강약":   saju.get("신강약", ""),
        "pillars":  pillars,
        "oh_dist":  oh_dist,
        "sip_dist": sip_dist,
        "sinsin":   sinsin,
        "daewoon":  daewoon,
        "seun":     seun,
        "gaewoon":  gaewoon,
        "age_now":  age_now,
        "ilju_animal": _BRANCH_EMOJI.get(saju.get("일지", ""), ""),
        "ilju_kr":     _BRANCH_KR.get(saju.get("일지", ""), ""),
        "text_ilgan":      text_ilgan,
        "text_oh_balance": text_oh_balance,
        "text_sinsin":     text_sinsin,
        "text_sip_top":    text_sip_top,
        "text_seun":       text_seun,
        "text_gaewoon":    text_gaewoon,
    }


async def _traditional(request: Request, master_id: str):
    """정통사주 페이지 — 명식판 + 오행 도넛 + 대운 타임라인 + CTA."""
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    client = _get_client_session(request, master_id)
    if not client:
        return RedirectResponse(_brand_url(request, master_id, "login"))
    today = date.today()
    subject, is_self, subject_label = _resolve_subject(request, client)
    saju = _call_saju_calc(subject)
    # 정통사주는 입력 동일하면 결과 동일 (시간 의존 없음)
    _cache_key = f"{cache_store.input_hash(subject)}_{int(subject.get('id', 0))}"
    trad = cache_store.get(client["id"], "traditional", _cache_key)
    if trad is None:
        trad = _traditional_saju(saju)
        cache_store.set(client["id"], "traditional", _cache_key, trad)

    _greet_seed = int(hashlib.md5(
        f"{client.get('id',0)}_{today.year}_{today.month}_{today.day}".encode()
    ).hexdigest(), 16)
    greeting = GREETINGS[_greet_seed % len(GREETINGS)]

    ctx = _brand_ctx(master, request)
    ctx.update({
        "client":        client,
        "subject":       subject,
        "subject_label": subject_label,
        "is_self":       is_self,
        "acquaintances": db.get_acquaintances_by_client(client["id"]) or [],
        "today_str":     today.strftime("%Y년 %m월 %d일"),
        "weekday":       WEEKDAYS[today.weekday()],
        "trad":          trad,
        "greeting":      greeting,
    })
    return templates.TemplateResponse(request, "brand/traditional.html", ctx)


def _generate_5day_fortune(client: dict, today: date) -> list:
    return _generate_7day_fortune(client, today)[1:6]


def _generate_monthly_fortune(client: dict, year: int, month: int) -> str:
    seed_str = f"{client.get('birth_year',1990)}{client.get('birth_month',1)}{year}{month}"
    seed = int(hashlib.md5(seed_str.encode()).hexdigest(), 16) % (2**32)
    rng  = random.Random(seed)
    fortunes = [
        "이달은 새로운 기회가 찾아오는 달입니다. <strong>변화를 두려워하지 말고</strong> 적극적으로 도전해 보세요. 특히 중순 이후로 좋은 소식이 기대됩니다.",
        "재물운이 상승하는 달입니다. 그동안 준비해 온 일들이 <strong>결실을 맺을 가능성</strong>이 높으니 꾸준히 노력하세요. 다만 충동적인 지출은 주의하세요.",
        "인간관계에서 좋은 인연이 생기는 달입니다. <strong>주변 사람들과의 소통</strong>을 늘리고 협력하면 큰 도움을 받을 수 있습니다.",
        "건강 관리가 중요한 달입니다. 무리한 일정보다는 <strong>규칙적인 생활 패턴</strong>을 유지하는 것이 중요합니다. 하반월에 기운이 회복됩니다.",
        "직장과 사업에서 발전이 기대되는 달입니다. <strong>꼼꼼한 준비와 계획</strong>이 성공의 열쇠입니다. 상사나 선배의 조언을 귀담아 들으세요.",
    ]
    return fortunes[rng.randint(0, len(fortunes)-1)]


# ---------------------------------------------------------
# 서브도메인 진입점 (main.py의 root()에서 호출)
# ---------------------------------------------------------

async def brand_subdomain_root(request: Request, master_id: str):
    """서브도메인 루트(/) 처리 - main.py SubdomainMiddleware에서 호출.
    인트로 페이지(별 파티클 + 오늘의 말씀, 2.5초)를 거쳐
    로그인이면 /home, 비로그인이면 /welcome 으로 자동 이동."""
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404, detail="브랜드를 찾을 수 없습니다.")
    client = _get_client_session(request, master_id)
    if client:
        db.update_client_visit(client["id"])
    ctx = _brand_ctx(master, request)
    ctx["client"] = client  # intro.html이 IS_LOGGED_IN 분기에 사용
    return templates.TemplateResponse(request, "brand/intro.html", ctx)


async def _tarot(request: Request, master_id: str):
    """오늘의 타로 전용 페이지 — 큰 카드 + 풀이."""
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    client = _get_client_session(request, master_id)
    if not client:
        return RedirectResponse(_brand_url(request, master_id, "login"))
    today = date.today()
    subject, is_self, subject_label = _resolve_subject(request, client)
    saju = _call_saju_calc(subject)
    tarot = _today_tarot(subject, today, saju)
    _greet_seed = int(hashlib.md5(
        f"{client.get('id',0)}_{today.year}_{today.month}_{today.day}".encode()
    ).hexdigest(), 16)
    greeting = GREETINGS[_greet_seed % len(GREETINGS)]
    ctx = _brand_ctx(master, request)
    ctx.update({
        "client":        client,
        "subject":       subject,
        "subject_label": subject_label,
        "is_self":       is_self,
        "acquaintances": db.get_acquaintances_by_client(client["id"]) or [],
        "today_str":     today.strftime("%Y년 %m월 %d일"),
        "weekday":       WEEKDAYS[today.weekday()],
        "tarot":         tarot,
        "greeting":      greeting,
    })
    return templates.TemplateResponse(request, "brand/tarot.html", ctx)


async def _welcome(request: Request, master_id: str):
    """비회원용 랜딩 — 무료 운세 + 가입 유도."""
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    # 이미 로그인이면 홈으로
    client = _get_client_session(request, master_id)
    if client:
        return RedirectResponse(_brand_url(request, master_id, "home"))
    products = db.get_products(active_only=True)[:4]
    ctx = _brand_ctx(master, request)
    ctx["products"] = products
    return templates.TemplateResponse(request, "brand/welcome.html", ctx)


# ---------------------------------------------------------
# 공통 로직 함수 (서브도메인 / 경로 방식 공유)
# ---------------------------------------------------------

async def _register_form(request: Request, master_id: str):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    if _get_client_session(request, master_id):
        return RedirectResponse(_brand_url(request, master_id, "home"))
    ctx = _brand_ctx(master, request)
    ctx["error"] = None
    ctx["form"]  = {}
    return templates.TemplateResponse(request, "brand/register.html", ctx)


async def _register_post(
    request: Request, master_id: str,
    name: str, email: str, password: str, password_confirm: str,
    gender: str, birth_year: int, birth_month: int, birth_day: int,
    birth_time: str, lunar_yn, leap_month_yn
):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    ctx = _brand_ctx(master, request)
    ctx["form"] = {
        "name": name, "email": email, "gender": gender,
        "birth_year": birth_year, "birth_month": birth_month,
        "birth_day": birth_day, "birth_time": birth_time,
        "lunar_yn": 1 if lunar_yn else 0,
        "leap_month_yn": 1 if leap_month_yn else 0,
    }
    if not name or not email:
        ctx["error"] = "이름과 이메일은 필수입니다."
        return templates.TemplateResponse(request, "brand/register.html", ctx)
    # 이메일 형식 검증
    import re
    email = email.strip().lower()
    ctx["form"]["email"] = email
    EMAIL_RE = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
    if not re.match(EMAIL_RE, email):
        ctx["error"] = "올바른 이메일 형식이 아닙니다. (예: name@example.com)"
        return templates.TemplateResponse(request, "brand/register.html", ctx)
    if not password or len(password) < 6:
        ctx["error"] = "비밀번호는 6자 이상이어야 합니다."
        return templates.TemplateResponse(request, "brand/register.html", ctx)
    if password != password_confirm:
        ctx["error"] = "비밀번호가 일치하지 않습니다."
        return templates.TemplateResponse(request, "brand/register.html", ctx)
    if db.get_client_by_email(master_id, email):
        ctx["error"] = "이미 가입된 이메일입니다. 비밀번호 찾기를 이용하세요."
        return templates.TemplateResponse(request, "brand/register.html", ctx)
    try:
        client_id = db.insert_client({
            "master_id":     master_id,
            "name":          name,
            "email":         email,
            "password_hash": hashlib.sha256(password.encode()).hexdigest(),
            "phone":         "",
            "birth_year":    birth_year,
            "birth_month":   birth_month,
            "birth_day":     birth_day,
            "birth_time":    birth_time,
            "gender":        gender,
            "lunar_yn":      1 if lunar_yn else 0,
            "leap_month_yn": 1 if leap_month_yn else 0,
        })
    except Exception:
        ctx["error"] = "가입 중 오류가 발생했습니다. 다시 시도해 주세요."
        return templates.TemplateResponse(request, "brand/register.html", ctx)
    request.session[f"client_{master_id}"] = client_id
    request.session[f"client_name_{master_id}"] = name
    db.log_action(master_id, "B2C회원가입", f"{name} ({email})")
    return RedirectResponse(_brand_url(request, master_id, "home"), status_code=303)


async def _login_form(request: Request, master_id: str):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    if _get_client_session(request, master_id):
        return RedirectResponse(_brand_url(request, master_id, "home"))
    ctx = _brand_ctx(master, request)
    ctx["error"] = None
    ctx["form"]  = {}
    return templates.TemplateResponse(request, "brand/login.html", ctx)


async def _login_post(
    request: Request, master_id: str,
    login_id: str, password: str, remember
):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    ctx = _brand_ctx(master, request)
    ctx["form"] = {"login_id": login_id}
    client = db.client_login(master_id, login_id, password)
    if not client:
        ctx["error"] = "이메일 또는 비밀번호가 올바르지 않습니다."
        return templates.TemplateResponse(request, "brand/login.html", ctx)
    request.session[f"client_{master_id}"] = client["id"]
    request.session[f"client_name_{master_id}"] = client["name"]
    db.update_client_visit(client["id"])
    db.log_action(master_id, "B2C로그인", f"{client['name']} ({login_id})")
    resp = RedirectResponse(_brand_url(request, master_id, "home"), status_code=303)
    if remember:
        import secrets as _secrets
        resp.set_cookie(
            key=f"b2c_{master_id}",
            value=f"{client['id']}:{_secrets.token_urlsafe(48)}",
            max_age=REMEMBER_DAYS * 86400,
            httponly=True, samesite="lax"
        )
    return resp



# ---------------------------------------------------------
# 비밀번호 재설정 헬퍼
# ---------------------------------------------------------
async def _forgot_form(request: Request, master_id: str):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    ctx = _brand_ctx(master, request)
    ctx["error"] = None
    ctx["success"] = None
    return templates.TemplateResponse(request, "brand/forgot_password.html", ctx)

async def _forgot_post(request: Request, master_id: str, email: str):
    from config import BASE_DOMAIN, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    ctx = _brand_ctx(master, request)
    ctx["error"] = None
    ctx["success"] = None
    client = db.get_client_by_email(master_id, email)
    if client:
        token = db.create_password_reset_token(client["id"])
        # 재설정 링크 생성 — Host가 서브도메인이면 /reset-password, 아니면 path 방식
        host = request.headers.get("host", f"{master_id}.{BASE_DOMAIN}")
        host_only = host.split(":")[0]
        if host_only.endswith(f".{BASE_DOMAIN}"):
            reset_url = f"http://{host}/reset-password?token={token}"
        else:
            # 인트라넷·로컬 등 — path 방식 사용
            reset_url = f"http://{host}/expert/{master_id}/reset-password?token={token}"
        # 이메일 발송
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"[{master.get('연구소명') or master.get('선생님이름')}] 비밀번호 재설정"
            msg["From"] = SMTP_FROM
            msg["To"] = email
            html_body = f"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
                <h2 style="color:#1A3A6A;">비밀번호 재설정</h2>
                <p>안녕하세요, {client['name']}님.</p>
                <p>아래 버튼을 클릭하여 비밀번호를 재설정하세요.<br>
                   링크는 <strong>1시간</strong> 동안 유효합니다.</p>
                <a href="{reset_url}" style="display:inline-block;margin:24px 0;padding:14px 32px;
                   background:#1A3A6A;color:#fff;text-decoration:none;border-radius:8px;font-size:1rem;">
                   비밀번호 재설정하기
                </a>
                <p style="color:#999;font-size:0.85rem;">
                   이 메일을 요청하지 않으셨다면 무시하셔도 됩니다.
                </p>
            </div>
            """
            msg.attach(MIMEText(html_body, "html", "utf-8"))
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
                s.ehlo()
                s.starttls()
                s.login(SMTP_USER, SMTP_PASS)
                s.sendmail(SMTP_FROM, [email], msg.as_string())
            db.log_action(master_id, "비밀번호재설정요청", f"{email}")
        except Exception as e:
            db.log_action(master_id, "이메일발송실패", str(e))
    # 보안상 이메일 존재 여부 노출 안 함
    ctx["success"] = "입력하신 이메일로 재설정 링크를 발송했습니다. (이메일이 등록된 경우)"
    return templates.TemplateResponse(request, "brand/forgot_password.html", ctx)

async def _reset_form(request: Request, master_id: str, token: str):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    ctx = _brand_ctx(master, request)
    ctx["token"] = token
    ctx["error"] = None
    client = db.get_password_reset_token(token)
    if not client:
        ctx["error"] = "유효하지 않거나 만료된 링크입니다. 다시 요청해 주세요."
        ctx["token"] = None
    return templates.TemplateResponse(request, "brand/reset_password.html", ctx)

async def _reset_post(request: Request, master_id: str, token: str, password: str, password_confirm: str):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    ctx = _brand_ctx(master, request)
    ctx["token"] = token
    ctx["error"] = None
    if password != password_confirm:
        ctx["error"] = "비밀번호가 일치하지 않습니다."
        return templates.TemplateResponse(request, "brand/reset_password.html", ctx)
    if len(password) < 6:
        ctx["error"] = "비밀번호는 6자 이상이어야 합니다."
        return templates.TemplateResponse(request, "brand/reset_password.html", ctx)
    ok = db.use_password_reset_token(token, password)
    if not ok:
        ctx["error"] = "유효하지 않거나 만료된 링크입니다. 다시 요청해 주세요."
        ctx["token"] = None
        return templates.TemplateResponse(request, "brand/reset_password.html", ctx)
    db.log_action(master_id, "비밀번호재설정완료", "token 사용")
    return templates.TemplateResponse(request, "brand/reset_password.html", {
        **ctx, "token": None, "error": None, "success": True
    })

async def _logout(request: Request, master_id: str):
    request.session.pop(f"client_{master_id}", None)
    request.session.pop(f"client_name_{master_id}", None)
    resp = RedirectResponse(_brand_url(request, master_id, ""))
    resp.delete_cookie(f"b2c_{master_id}")
    return resp


async def _home(request: Request, master_id: str):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    client = _get_client_session(request, master_id)
    if not client:
        return RedirectResponse(_brand_url(request, master_id, "login"))
    db.update_client_visit(client["id"])
    today      = date.today()
    # 분석 대상(subject) 결정 — ?as=<acq_id>면 지인 기준
    subject, is_self, subject_label = _resolve_subject(request, client)
    days7      = _generate_7day_fortune(subject, today)
    fortune    = days7[3]["fortune"]   # 오늘 = idx 3
    score_seq  = [d["fortune"]["total_score"] for d in days7]

    # 오늘의 타로 1장 (saju cache 활용)
    _saju_for_tarot = _call_saju_calc(subject)
    tarot = _today_tarot(subject, today, _saju_for_tarot)

    # 상단 인사말 — 회원 + 오늘 날짜 시드 기반 (매일 다름, 같은 날 같은 사람은 같은 인사)
    _greet_seed = int(hashlib.md5(
        f"{client.get('id',0)}_{today.year}_{today.month}_{today.day}".encode()
    ).hexdigest(), 16)
    greeting = GREETINGS[_greet_seed % len(GREETINGS)]

    # 메인 배너 슬라이드 — DB(어드민 관리) 우선, 없으면 기본 5개 폴백
    db_banners = db.get_banners(master_id=master_id, active_only=True)
    if db_banners:
        banners = []
        for b in db_banners:
            href = b.get("href", "") or ""
            # 상대 경로(/shop, /home 등)이면 base_url 자동 적용
            if href.startswith("/") and not href.startswith("/expert/"):
                href = _brand_url(request, master_id, href.lstrip("/"))
            banners.append({
                "badge":        b.get("badge", ""),
                "title_top":    b.get("title_top", ""),
                "title_bottom": b.get("title_bottom", ""),
                "sub":          b.get("sub", ""),
                "icon":         b.get("icon", "🔮"),
                "href":         href or _brand_url(request, master_id, "shop"),
            })
    else:
        # 폴백 (DB에 배너 없을 때)
        banners = [
            {"badge":f"✨ {master.get('선생님이름','반야선생')} 마스터 직접 풀이",
             "title_top":"소름 돋는", "title_bottom":"미래 예측",
             "sub":"가장 정확한 정통 사주로<br>오늘의 운명을 확인하세요",
             "icon":"🔮", "href": _brand_url(request, master_id, "shop")},
            {"badge":"📅 2027년 신년운세",
             "title_top":"내년 한 해의", "title_bottom":"운명을 미리",
             "sub":"신년 흐름·재물·관계·건강<br>한 권으로 정리하는 신년운세",
             "icon":"📅", "href": _brand_url(request, master_id, "shop")},
            {"badge":"💑 짝궁합 풀이",
             "title_top":"두 사람의", "title_bottom":"인연을 풀다",
             "sub":"성격 궁합부터 평생 운세까지<br>둘이 함께 보는 정통 풀이",
             "icon":"💑", "href": _brand_url(request, master_id, "shop")},
            {"badge":"🤝 사람人 관계도",
             "title_top":"관계의", "title_bottom":"비밀을 풀다",
             "sub":"가족·동료·친구 관계의 흐름<br>한 번에 분석합니다",
             "icon":"🤝", "href": _brand_url(request, master_id, "shop")},
            {"badge":"🌟 오늘 행운 PRO",
             "title_top":"오늘 하루의", "title_bottom":"럭키 가이드",
             "sub":"색상·방향·시간·만남까지<br>오늘 적용할 행동 가이드",
             "icon":"🌟", "href": _brand_url(request, master_id, "shop")},
        ]

    ctx = _brand_ctx(master, request)
    ctx.update({
        "client":         client,
        "subject":        subject,
        "subject_label":  subject_label,
        "is_self":        is_self,
        "acquaintances":  db.get_acquaintances_by_client(client["id"]) or [],
        "birth_info":     _birth_info(subject),
        "today_str":      today.strftime("%Y년 %m월 %d일"),
        "weekday":        WEEKDAYS[today.weekday()],
        "month_str":      today.strftime("%Y년 %m월"),
        "fortune":        fortune,
        "days7":          days7,
        "score_seq":      score_seq,
        "banners":        banners,
        "greeting":       greeting,
        "tarot":          tarot,
    })
    return templates.TemplateResponse(request, "brand/home.html", ctx)


# ---------------------------------------------------------
# 지인(acquaintances) — 단일 페이지(목록 + 인라인 추가 폼)
# ---------------------------------------------------------
async def _acquaintances_page(request: Request, master_id: str,
                              errors: list | None = None,
                              form: dict | None = None,
                              edit_id: int | None = None):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    client = _get_client_session(request, master_id)
    if not client:
        return RedirectResponse(_brand_url(request, master_id, "login"))
    acqs = db.get_acquaintances_by_client(client["id"])
    today = date.today()
    for a in acqs:
        try:
            age = today.year - int(a.get("birth_year") or 0)
            if (today.month, today.day) < (int(a.get("birth_month") or 1), int(a.get("birth_day") or 1)):
                age -= 1
            a["age"] = age
        except Exception:
            a["age"] = ""

    # ?edit={id} 쿼리 파라미터 처리 — 폼을 그 지인 정보로 미리 채움
    if edit_id is None:
        try:
            qp_edit = request.query_params.get("edit")
            edit_id = int(qp_edit) if qp_edit else None
        except (TypeError, ValueError):
            edit_id = None
    edit_target = None
    if edit_id is not None:
        target = db.get_acquaintance(edit_id)
        if target and target.get("client_id") == client["id"]:
            edit_target = target
            if form is None:
                form = {
                    "name":          target.get("name", ""),
                    "gender":        target.get("gender", "남"),
                    "birth_year":    target.get("birth_year", 1990),
                    "birth_month":   target.get("birth_month", 1),
                    "birth_day":     target.get("birth_day", 1),
                    "birth_time":    target.get("birth_time", "모름"),
                    "lunar_yn":      bool(target.get("lunar_yn")),
                    "leap_month_yn": bool(target.get("leap_month_yn")),
                    "relation":      target.get("relation", "기타"),
                    "memo":          target.get("memo", ""),
                }

    ctx = _brand_ctx(master, request)
    ctx.update({
        "client":        client,
        "acquaintances": acqs,
        "msg":           request.query_params.get("msg", ""),
        "errors":        errors or [],
        "edit_id":       edit_target.get("id") if edit_target else None,
        "edit_name":     edit_target.get("name") if edit_target else "",
        "form":          form or {
            "name":"", "gender":"남",
            "birth_year":1990, "birth_month":1, "birth_day":1,
            "birth_time":"모름",
            "lunar_yn": False, "leap_month_yn": False,
            "relation":"기타", "memo":"",
        },
    })
    return templates.TemplateResponse(request, "brand/acquaintances.html", ctx)


async def _acquaintance_create(
    request: Request, master_id: str,
    name: str, gender: str, birth_year: int, birth_month: int, birth_day: int,
    birth_time: str, lunar_yn, leap_month_yn, relation: str, memo: str
):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    client = _get_client_session(request, master_id)
    if not client:
        return RedirectResponse(_brand_url(request, master_id, "login"))
    name = (name or "").strip()
    errors = []
    if not name:
        errors.append("이름은 필수입니다.")
    if errors:
        return await _acquaintances_page(
            request, master_id, errors=errors,
            form={
                "name": name, "gender": gender,
                "birth_year": birth_year, "birth_month": birth_month, "birth_day": birth_day,
                "birth_time": birth_time,
                "lunar_yn": bool(lunar_yn), "leap_month_yn": bool(leap_month_yn),
                "relation": relation, "memo": memo or "",
            }
        )
    db.insert_acquaintance(client["id"], {
        "name": name, "gender": gender,
        "birth_year": birth_year, "birth_month": birth_month, "birth_day": birth_day,
        "birth_time": birth_time, "lunar_yn": lunar_yn, "leap_month_yn": leap_month_yn,
        "relation": relation, "memo": memo,
    })
    cache_store.invalidate(client["id"])  # 지인 추가 → 페어 결과·subject 결과 모두 무효
    from urllib.parse import quote
    return RedirectResponse(
        _brand_url(request, master_id, "acquaintances") + "?msg=" + quote(f"{name}님 추가됨"),
        status_code=303
    )


async def _acquaintance_update(
    request: Request, master_id: str, acq_id: int,
    name: str, gender: str, birth_year: int, birth_month: int, birth_day: int,
    birth_time: str, lunar_yn, leap_month_yn, relation: str, memo: str
):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    client = _get_client_session(request, master_id)
    if not client:
        return RedirectResponse(_brand_url(request, master_id, "login"))
    acq = db.get_acquaintance(acq_id)
    if not acq or acq.get("client_id") != client["id"]:
        raise HTTPException(status_code=403)
    name = (name or "").strip()
    errors = []
    if not name:
        errors.append("이름은 필수입니다.")
    if errors:
        return await _acquaintances_page(
            request, master_id, errors=errors, edit_id=acq_id,
            form={
                "name": name, "gender": gender,
                "birth_year": birth_year, "birth_month": birth_month, "birth_day": birth_day,
                "birth_time": birth_time,
                "lunar_yn": bool(lunar_yn), "leap_month_yn": bool(leap_month_yn),
                "relation": relation, "memo": memo or "",
            }
        )
    db.update_acquaintance(acq_id, {
        "name": name, "gender": gender,
        "birth_year": birth_year, "birth_month": birth_month, "birth_day": birth_day,
        "birth_time": birth_time, "lunar_yn": lunar_yn, "leap_month_yn": leap_month_yn,
        "relation": relation, "memo": memo,
    })
    cache_store.invalidate(client["id"])
    from urllib.parse import quote
    return RedirectResponse(
        _brand_url(request, master_id, "acquaintances") + "?msg=" + quote(f"{name}님 정보 수정됨"),
        status_code=303
    )


async def _acquaintance_delete(request: Request, master_id: str, acq_id: int):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    client = _get_client_session(request, master_id)
    if not client:
        return RedirectResponse(_brand_url(request, master_id, "login"))
    acq = db.get_acquaintance(acq_id)
    if not acq or acq.get("client_id") != client["id"]:
        raise HTTPException(status_code=403)
    db.delete_acquaintance(acq_id)
    cache_store.invalidate(client["id"])
    from urllib.parse import quote
    return RedirectResponse(
        _brand_url(request, master_id, "acquaintances") + "?msg=" + quote("삭제되었습니다"),
        status_code=303
    )


# ---------------------------------------------------------
# 짝궁합 (compat) — 본인 고정 + 지인 1명 페어 분석
# ---------------------------------------------------------
COMPAT_GRADES = [
    (90, "천생연분", "✨", "#fbbf24"),
    (78, "매우 좋음", "💕", "#f472b6"),
    (65, "좋음",     "🌟", "#a78bfa"),
    (50, "보통",     "🙂", "#9ca3af"),
    (0,  "유의",     "⚠️", "#f87171"),
]

# 지지 6합 (12 쌍 × 양방향) — 합이면 +
_BRANCH_HARMONY = {
    "子":"丑","丑":"子",
    "寅":"亥","亥":"寅",
    "卯":"戌","戌":"卯",
    "辰":"酉","酉":"辰",
    "巳":"申","申":"巳",
    "午":"未","未":"午",
}
# 지지 6충 — 충이면 -
_BRANCH_CONFLICT_PAIR = {
    "子":"午","午":"子",
    "丑":"未","未":"丑",
    "寅":"申","申":"寅",
    "卯":"酉","酉":"卯",
    "辰":"戌","戌":"辰",
    "巳":"亥","亥":"巳",
}

COMPAT_SECTION_POOL = {
    "personality": {
        "high": [
            "두 분은 *비슷한 결*의 성격을 가지셨습니다. 큰 갈등 없이 자연스럽게 맞춰지는 흐름이 강합니다.\n\n"
            "다만 너무 닮아 *매너리즘*이 올 수 있으니, 가끔은 *낯선 자극*을 함께 만들어 보세요. "
            "함께 새로운 취미를 시도하거나 평소 안 가던 곳을 가보는 것이 관계의 활력이 됩니다.",
            "*기본 결*이 잘 맞아 일상이 평화롭게 흐릅니다. 사소한 의사결정도 빨리 합의되고 트러블이 적은 구성.\n\n"
            "단, *비슷한 단점*도 함께 가지기 쉬우니 한 사람이 약한 부분은 다른 한 사람이 *의도적으로* 보강해 주는 자세가 중요합니다."
        ],
        "mid":  [
            "성격에 *서로 다른 결*이 있어 처음엔 부딪힘이 있을 수 있지만, 시간이 지나면서 *보완*으로 작용합니다. "
            "한쪽이 추진력이 강하면 다른 쪽이 신중함으로 균형을 맞추는 식.\n\n"
            "*표현 방식의 차이*에서 오는 오해는 *대화의 빈도*로 해결됩니다. 작은 마음이라도 자주 표현하면 신뢰가 깊어집니다.",
            "성향이 미묘하게 다르지만 *근본 가치관*은 비슷한 편입니다. 함께 시간을 보낼수록 서로의 *다른 면*에 매력을 느끼게 됩니다.\n\n"
            "다툼은 *원칙적인 차이*보다 *작은 습관 차이*에서 옵니다. 쉽게 풀리는 종류이니 너무 무겁게 받아들이지 마세요."
        ],
        "low":  [
            "성격의 *결이 상당히 다른* 두 분입니다. 서로의 행동 양식이 잘 이해되지 않을 때가 많을 수 있습니다.\n\n"
            "관계가 잘 풀리려면 *내 기준*을 잠시 내려놓고 *상대의 시선*으로 보는 연습이 꼭 필요합니다. "
            "다름이 *틀림*이 아니라는 인정에서부터 진짜 인연이 시작됩니다.",
            "표면적으로는 잘 맞아 보여도 *깊은 곳의 가치관*에서 차이가 큽니다. 중요한 결정 앞에서 갈등이 생기기 쉬운 구성입니다.\n\n"
            "*제3자의 객관적 조언*(가족·전문가)을 받아두면 큰 결정 시 도움이 됩니다. 둘만의 대화로 풀기 어려운 부분도 있다는 것을 받아들이세요."
        ],
    },
    "values": {
        "high": [
            "두 분이 *인생에서 중요하게 여기는 것*이 비슷합니다. 돈·일·가족·자유 — 우선순위가 자연스럽게 일치합니다.\n\n"
            "큰 결정도 *논쟁 없이* 합의되며, 중장기 계획을 세우기 좋은 페어입니다. "
            "이미 같은 방향을 보고 있으니 속도만 잘 맞추면 됩니다.",
            "*인생 철학*이 잘 통하는 두 분입니다. 어려운 일이 생겨도 같은 방향으로 의사결정을 내리니 갈등 폭이 좁습니다.\n\n"
            "다만 *둘 다 같은 약점*을 가질 수 있으니 (예: 모험을 회피하는 성향), 가끔은 의도적으로 *벗어나는 시도*가 필요합니다."
        ],
        "mid":  [
            "*큰 가치관*은 비슷한데 *세부 우선순위*에서 차이가 있습니다. 예: 둘 다 가족이 중요하지만, 한쪽은 시간을, 다른 쪽은 경제적 안정을 더 중시.\n\n"
            "차이를 *공유*하는 대화가 쌓이면 충분히 좁힐 수 있습니다. 1년에 한 번 정도 *큰 그림 대화*를 정해두면 좋습니다.",
            "가치관에 *공통점과 차이점이 반반*인 페어. 공통점에 집중하면 깊어지고, 차이점에 집중하면 멀어집니다.\n\n"
            "관계의 질은 *어디에 시선을 두느냐*로 결정됩니다. 일부러라도 *닮은 점을 자주 언급*하는 습관을 들이세요."
        ],
        "low":  [
            "*인생에서 중요하게 여기는 것*이 서로 다릅니다. 한쪽은 돈, 다른 쪽은 시간 자유 — 같은 사건에 대한 반응이 다릅니다.\n\n"
            "관계 유지의 핵심은 *상대 가치관을 존중*하는 것입니다. 내 기준으로 평가하지 말고 *왜 그렇게 생각하는지* 이해하는 시간을 자주 가져야 합니다.",
            "큰 가치관 차이로 *결정의 순간*마다 의견이 갈리는 페어. 서로의 차이를 *위협*으로 받아들이면 관계가 위험해집니다.\n\n"
            "*공통의 작은 목표*(여행·운동·취미)를 함께 만들어 같은 방향으로 가는 경험을 쌓는 것이 처방입니다."
        ],
    },
    "money": {
        "high": [
            "둘이 함께 있을 때 *재물의 흐름*이 부드럽게 만들어지는 페어입니다. 서로의 약점을 보완해 큰 자산을 쌓을 가능성이 큽니다.\n\n"
            "한 명이 벌고 한 명이 관리하든, 둘 다 벌든 — *역할 분담*이 자연스럽게 정리됩니다. 큰 재정적 의사결정도 합의가 빠릅니다.",
            "*경제관념*이 잘 맞는 두 분입니다. 소비·저축·투자에 대한 기본 태도가 비슷해 돈 문제로 다툴 일이 거의 없습니다.\n\n"
            "이런 페어는 *공동 자산*을 일찍 만들어 함께 키우는 게 정답. 결혼 후라면 공동 통장, 미혼이라면 함께하는 작은 적금·여행 자금 등이 시너지를 만듭니다."
        ],
        "mid":  [
            "재물 관념이 *적당히 다른* 페어. 한쪽이 절약형, 한쪽이 소비형이면 *서로의 균형*이 됩니다.\n\n"
            "역할이 명확히 분리되면 강력한 페어가 되지만, *돈에 대한 가치 차이*가 자주 부딪히면 갈등의 씨앗이 됩니다. "
            "*공동 가계부*를 세팅해 두는 것이 추천 솔루션.",
            "재물의 흐름은 *기복*이 있는 페어. 좋은 시기와 잠잠한 시기가 번갈아 오니, *비축의 습관*이 중요합니다.\n\n"
            "큰 투자는 둘이서 *3일 이상 숙고*한 뒤에 결정하는 룰을 만들어 두면 후회가 적어집니다."
        ],
        "low":  [
            "재물 관념의 *큰 차이*가 있는 페어. 한쪽은 저축 중시, 다른 쪽은 경험 중시 — 자주 부딪힐 수 있습니다.\n\n"
            "이런 페어는 *각자의 영역*을 분명히 나누는 게 답입니다. 공동 비용은 명확히, 개인 지출은 서로 간섭하지 않는 룰. "
            "공동 자산을 무리하게 합치기보다 *각자 + 일부 공동* 구조가 안전합니다.",
            "함께 있을 때 *지출이 빨라지는* 흐름이 있는 페어. 즐거운 시간이 많아 좋지만, *장기 자산 관리*에는 의식적인 노력이 필요합니다.\n\n"
            "월 1회 *재정 점검 데이트*를 정해 두고 함께 숫자를 보는 시간을 갖는 것이 큰 도움이 됩니다."
        ],
    },
    "work": {
        "high": [
            "두 분이 함께 *일이나 관계*를 풀어갈 때 시너지가 강한 페어입니다. 협업이 잘 되어 *공동 사업*에도 어울립니다.\n\n"
            "역할 분담이 자연스럽게 잡히고, 의사결정 속도도 빠릅니다. 함께 일하는 것이 부담이 아니라 *동력*이 되는 흐름.",
            "*사람을 보는 눈*이 비슷한 두 분. 함께 만나는 사람들과의 관계도 잘 풀리고, 공통 인맥이 늘어날수록 인생의 폭이 넓어집니다.\n\n"
            "*공동 모임* (취미·종교·동호회 등)을 함께 갖는 것이 좋습니다. 같은 사람들 속에서 함께 자라는 페어입니다."
        ],
        "mid":  [
            "*일하는 방식*이 약간 다른 페어. 한쪽이 빠르고, 한쪽이 꼼꼼하다면 *상호 보완*으로 잘 풀립니다.\n\n"
            "다만 의사결정 속도가 다르면 *작은 답답함*이 쌓일 수 있으니, *데드라인*을 미리 합의하는 습관을 들이세요.",
            "관계망(친구·동료)에서 *공통점과 차이점이 섞인* 페어. 한쪽 인맥에 다른 쪽이 따라가면 *새로운 자극*이 됩니다.\n\n"
            "*독자적인 영역*도 존중해 주는 것이 좋은 페어입니다. 모든 관계를 함께할 필요는 없습니다."
        ],
        "low":  [
            "*일하는 스타일*과 *사람을 대하는 태도*가 다른 페어. 함께 일하면 부딪히기 쉽고, 공통 모임에서도 다른 반응을 보일 때가 있습니다.\n\n"
            "*같은 영역에 같이 들어가지 않는* 룰이 답입니다. 일은 각자 영역에서, 친목은 *둘만의 시간*을 우선하는 게 안정적인 페어입니다.",
            "둘이 함께 *공동 작업*을 하면 *예상치 못한 갈등*이 생기는 페어. 일이나 사업을 함께하는 건 신중히 결정하세요.\n\n"
            "관계의 질은 *서로의 영역을 인정*하는 데서 나옵니다. *간섭하지 않는 것*이 사랑의 한 형태가 되는 페어입니다."
        ],
    },
    "lifelong": {
        "high": [
            "*평생 흐름*이 함께 위로 올라가는 페어입니다. 한 명이 좋을 때 다른 명도 좋고, 어려울 때도 같이 견디는 구성.\n\n"
            "이런 페어는 *오래 갑니다*. 결혼·동업·평생 친구 어떤 형태로든 *시간이 깊이를 만드는* 관계입니다. "
            "초반에 큰 사건이 없어도 5년·10년 뒤를 보면 든든한 동반자가 되어 있을 가능성이 큽니다.",
            "*인생의 큰 흐름*이 잘 맞물리는 두 분. 서로의 좋은 시기에 함께 기뻐하고, 어려운 시기엔 *진심의 동반자*가 되어 줄 수 있습니다.\n\n"
            "*함께한 시간이 자산*이 되는 페어이니, 사소한 일로 멀어지지 마시고 *긴 호흡*으로 관계를 보세요."
        ],
        "mid":  [
            "평생 흐름이 *교차*하는 페어. 한 명이 어려울 때 다른 명이 좋고, 그 반대도 있습니다. *서로 지탱*해 주는 구성이 됩니다.\n\n"
            "이런 페어는 *위기에 강합니다*. 혼자 힘들 때 옆에 있어주는 사람이 있다는 게 큰 힘입니다.",
            "흐름의 *부분 일치*가 있는 페어. 큰 시기는 비슷하게 가지만 *세부 흐름*에서 차이가 있어 가끔 어긋남이 생깁니다.\n\n"
            "이럴 때 *기다려 주는 자세*가 핵심. 상대가 지금 다른 흐름에 있을 뿐, 곧 함께 갈 시기가 옵니다."
        ],
        "low":  [
            "평생 흐름의 *방향이 다른* 페어. 한 명이 상승할 때 다른 명이 하강하는 등 시기가 어긋날 수 있습니다.\n\n"
            "함께 가려면 *상대의 시기*를 인정하는 자세가 필요합니다. 내 시기가 좋다고 상대를 끌어당기지 말고, 내 시기가 어렵다고 상대를 의지하지 말고 — *각자의 흐름*을 존중하는 거리감.",
            "큰 흐름의 어긋남이 있는 페어. *짧은 인연*으로는 어울리지만 *평생 동반*은 의식적인 노력이 더 필요합니다.\n\n"
            "*공동의 작은 목표*를 정기적으로 만드는 것 (분기당 한 번씩)이 어긋남을 줄여 주는 핵심입니다."
        ],
    },
}


def _branch_relation_label(b1: str, b2: str) -> tuple:
    """두 일지의 관계 → (label, score_delta)."""
    if not b1 or not b2:
        return ("", 0)
    if b1 == b2:
        return ("일지 동일 (비견)", 5)
    if _BRANCH_HARMONY.get(b1) == b2:
        return ("육합 (六合)", 18)
    if _BRANCH_CONFLICT_PAIR.get(b1) == b2:
        return ("충 (沖)", -15)
    return ("일반", 0)


_COMPAT_GRADE_VISUAL = {
    # 등급키 → (이모지, 카드 배경 그라디언트용 헥스)
    "천생연분":     ("💎", "linear-gradient(135deg,#fbbf24,#f59e0b)"),
    "백년가약":     ("🌟", "linear-gradient(135deg,#fde047,#facc15)"),
    "연리지":       ("🌿", "linear-gradient(135deg,#86efac,#4ade80)"),
    "좋은인연":     ("✨", "linear-gradient(135deg,#a7f3d0,#6ee7b7)"),
    "무난한인연":   ("🙂", "linear-gradient(135deg,#bfdbfe,#93c5fd)"),
    "보통인연":     ("🌤️", "linear-gradient(135deg,#cbd5e1,#94a3b8)"),
    "맞춰가는인연": ("🤝", "linear-gradient(135deg,#fcd34d,#fbbf24)"),
    "노력필요":     ("🛠️", "linear-gradient(135deg,#f9a8d4,#f472b6)"),
    "어려운인연":   ("⚠️", "linear-gradient(135deg,#fca5a5,#f87171)"),
}

# 등급별 "개선 여지" 한 줄 카피 (구매 권유 톤 X — 정보 톤)
_COMPAT_IMPROVE_COPY = {
    "천생연분":     "타고난 깊은 인연 — 시기별 흐름을 따라가면 더 단단해집니다.",
    "백년가약":     "이미 든든한 기반 — 미세 조정으로 평생 동행이 자연스러워집니다.",
    "연리지":       "잘 맞는 결 — 작은 의식적 노력으로 더 깊어질 수 있습니다.",
    "좋은인연":     "현재 상위 25% — 약점 한두 가지만 살피면 80+ 진입이 가능합니다.",
    "무난한인연":   "상위 40% — 대화 패턴·시기 인식 보강만으로 70+ 진입 가능합니다.",
    "보통인연":     "상위 55% — 차이를 메울 영역이 분명합니다. 구체 보완안이 효과적입니다.",
    "맞춰가는인연": "상위 70% — 차이가 있지만 보완 방향이 분명한 관계입니다.",
    "노력필요":     "차이가 큰 편 — 의식적 노력이 점수에 직접 반영되는 구간입니다.",
    "어려운인연":   "구조적 차이 — 일상의 작은 합의가 관계 유지의 핵심입니다.",
}

# PDF 풀상품에 포함되는 섹션 목록 (정적, 22개 대표)
_COMPAT_PDF_TOC = [
    "일간 상성", "오행 보완", "용신 교차", "십성 관계",
    "친밀도", "합충 교차", "인연의 깊이 (천을귀인)",
    "갈등 포인트", "대화 스타일", "재물 궁합", "자녀운",
    "대운 시기", "결혼 적기", "위기 시기",
    "신살 교차", "12운성 교차", "격국 매트릭스",
    "세운 동적 궁합", "월운 동적 궁합", "천을귀인 대운 이동",
    "잠자리 궁합 (房事)", "건강 궁합 교차",
]


def _compat_data(self_data: dict, partner_acq: dict) -> dict | None:
    """본인 + 상대(지인) → 짝궁합 데이터.
    풀 상품 엔진(compatibility_calc.js) 호출 결과 기반.
    엔진 호출 실패 시 None (페이지에서 '상대 선택' 안내 노출)."""
    if not partner_acq:
        return None

    # 페어 카드용 saju (용신·일간한글 등 표시 데이터)
    self_saju = _call_saju_calc(self_data)
    partner_subject = {
        "id":            -int(partner_acq["id"]),
        "name":          partner_acq.get("name", ""),
        "gender":        partner_acq.get("gender", "남"),
        "birth_year":    partner_acq.get("birth_year"),
        "birth_month":   partner_acq.get("birth_month"),
        "birth_day":     partner_acq.get("birth_day"),
        "birth_time":    partner_acq.get("birth_time", "모름"),
        "lunar_yn":      partner_acq.get("lunar_yn", 0),
        "leap_month_yn": partner_acq.get("leap_month_yn", 0),
    }
    partner_saju = _call_saju_calc(partner_subject)
    if not self_saju or not partner_saju:
        return None

    # 풀 상품 엔진 호출 (점수·등급·항목 일체)
    cc = _call_compat_calc(self_data, partner_acq, partner_acq.get("relation", ""))
    if not cc:
        return None

    self_yong = self_saju.get("용신")

    total = int(cc.get("종합") or 0)
    grade_text = cc.get("등급") or "보통"
    grade_key  = cc.get("등급키") or "보통인연"
    grade_emoji, grade_color = _COMPAT_GRADE_VISUAL.get(grade_key, ("🙂", "#9ca3af"))

    # 일지 합/충 라벨 (비교표 마지막 행 — 호환 유지)
    branch_label, _ = _branch_relation_label(
        self_saju.get("일지", ""), partner_saju.get("일지", "")
    )

    # ── 6~7차원 카드 (calc 점수상세 기반) ──
    sd = cc.get("점수상세") or {}
    def _first_line(v) -> str:
        if isinstance(v, list):
            return (v[0] if v else "")
        return str(v or "")

    ilgan_rel = (cc.get("일간상성") or {}).get("관계", "")
    hap_chung = cc.get("합충교차") or {}
    hc_counts = []
    for k, kr in [("합","육합"), ("충","충"), ("형","형"), ("천간합","천간합")]:
        n = len(hap_chung.get(k) or [])
        if n: hc_counts.append(f"{kr} {n}")
    hc_sub = " · ".join(hc_counts) if hc_counts else "일반"

    sip = cc.get("십성관계") or {}
    sip_a = (sip.get("AtoB") or {}).get("십성", "")
    sip_b = (sip.get("BtoA") or {}).get("십성", "")
    sip_sub = f"{sip_a} ↔ {sip_b}" if (sip_a and sip_b) else "십성 분석"

    daewoon_for_dim = cc.get("대운시기") or {}
    n_good    = len(daewoon_for_dim.get("같이좋은")    or [])
    n_bad     = len(daewoon_for_dim.get("같이나쁜")    or [])
    n_crossed = len(daewoon_for_dim.get("엇갈리는")    or [])
    if n_good or n_bad or n_crossed:
        flow_sub = " · ".join([s for s in [
            f"좋은 시기 {n_good}" if n_good else "",
            f"어려운 시기 {n_bad}" if n_bad else "",
            f"엇갈림 {n_crossed}" if n_crossed else "",
        ] if s])
    else:
        flow_sub = "현재 대운 비교"

    dimensions = [
        {"key":"ilgan",    "icon":"🪐", "label":"일간 상성", "score":int(sd.get("일간상성") or 50),
         "sub": ilgan_rel or "일간 분석"},
        {"key":"ohaeng",   "icon":"⚖️", "label":"오행 보완", "score":int(sd.get("오행보완") or 50),
         "sub": _first_line(cc.get("오행보완분석"))[:36] or "오행 균형"},
        {"key":"yong",     "icon":"✨", "label":"용신 교차", "score":int(sd.get("용신교차") or 50),
         "sub": _first_line(cc.get("용신교차분석"))[:36] or "용신 분석"},
        {"key":"hapchung", "icon":"🔗", "label":"합충 교차", "score":int(sd.get("합충교차") or 50),
         "sub": hc_sub},
        {"key":"chinmil",  "icon":"💗", "label":"친밀도",    "score":int(sd.get("친밀도") or 50),
         "sub": _first_line(cc.get("친밀도분석"))[:36] or "친밀도 분석"},
        {"key":"sipseong", "icon":"🎭", "label":"십성 관계", "score":int(sd.get("십성관계") or 50),
         "sub": sip_sub},
        {"key":"inyeon",   "icon":"🌌", "label":"인연 깊이", "score":int(sd.get("인연깊이") or 50),
         "sub": _first_line(cc.get("인연깊이분석"))[:36] or "천을귀인 분석"},
        {"key":"flow",     "icon":"🌊", "label":"시기 흐름", "score":int(sd.get("대운시기") or 50),
         "sub": flow_sub},
    ]

    # ── 5섹션 풀이 (calc 데이터 기반) ──
    def _band(s):
        return "high" if s >= 75 else ("low" if s < 55 else "mid")

    sec_personality = (sip.get("AtoB") or {}).get("해석", "") or (sip.get("BtoA") or {}).get("해석", "") or ""
    sec_values     = _first_line(cc.get("용신교차분석")) or _first_line(cc.get("오행보완분석"))
    sec_money_hint = _first_line(cc.get("오행보완분석"))
    sec_work       = _first_line(cc.get("친밀도분석")) or "친밀도 분석"
    daewoon = cc.get("대운시기") or {}
    sec_lifelong   = _first_line(daewoon.get("분석") or [])

    sections = [
        {"key":"personality", "label":"💞 성격 궁합", "band": _band(sd.get("일간상성", 50)), "text": sec_personality},
        {"key":"values",      "label":"🎯 가치관 궁합", "band": _band(sd.get("용신교차", 50)), "text": sec_values},
        {"key":"money",       "label":"💰 재물 궁합",  "band": _band(sd.get("재물궁합", 50)), "text": sec_money_hint or "두 분의 오행 보완 흐름이 재물 궁합의 기반입니다."},
        {"key":"work",        "label":"💼 일·관계 궁합","band": _band(sd.get("친밀도", 50)), "text": sec_work},
        {"key":"lifelong",    "label":"🌊 평생 흐름",  "band": _band(sd.get("대운시기", 50)), "text": sec_lifelong or "두 분의 대운 흐름은 시기별 분석 영역에서 다룹니다."},
    ]

    # ── 잠긴 섹션 티저: 개인화 1~2줄 (calc 결과에서 추출) ──
    teasers = []
    # 천간합 1건이라도 있으면 강한 끌림 신호
    cheon_hap = (hap_chung.get("천간합") or [])
    if cheon_hap:
        teasers.append({"icon":"🔒", "label":"천간 합", "text": cheon_hap[0]})
    # 일지 합/충 1건
    elif (hap_chung.get("합") or []):
        teasers.append({"icon":"🔒", "label":"지지 합", "text": (hap_chung["합"])[0]})
    elif (hap_chung.get("충") or []):
        teasers.append({"icon":"🔒", "label":"지지 충", "text": (hap_chung["충"])[0]})

    # 대운시기 1건 (구체 연도 포함)
    same_good = daewoon.get("같이좋은") or []
    same_bad  = daewoon.get("같이나쁜") or []
    crossed   = daewoon.get("엇갈리는") or []
    if same_good:
        teasers.append({"icon":"🔒", "label":"함께 좋은 시기", "text": same_good[0]})
    elif same_bad:
        teasers.append({"icon":"🔒", "label":"함께 어려운 시기", "text": same_bad[0]})
    elif crossed:
        teasers.append({"icon":"🔒", "label":"엇갈리는 시기", "text": crossed[0]})

    # 인연깊이 첫 분석
    in_anal = cc.get("인연깊이분석") or []
    if in_anal:
        teasers.append({"icon":"🔒", "label":"인연 깊이", "text": in_anal[0]})

    teasers = teasers[:3]  # 최대 3개

    improve_copy = _COMPAT_IMPROVE_COPY.get(grade_key, "")

    # 페어 카드 표시 데이터
    def _fmt_birth(d: dict) -> str:
        try:
            y = int(d.get("birth_year") or 0)
            m = int(d.get("birth_month") or 0)
            dd = int(d.get("birth_day") or 0)
            if not (y and m and dd):
                return ""
            base = f"{y}.{m:02d}.{dd:02d}"
            if d.get("lunar_yn"):
                base += "(음" + ("·윤" if d.get("leap_month_yn") else "") + ")"
            return base
        except (TypeError, ValueError):
            return ""

    _BIRTH_TIME_RANGE = {
        "자시": "23:30~01:29", "축시": "01:30~03:29", "인시": "03:30~05:29",
        "묘시": "05:30~07:29", "진시": "07:30~09:29", "사시": "09:30~11:29",
        "오시": "11:30~13:29", "미시": "13:30~15:29", "신시": "15:30~17:29",
        "유시": "17:30~19:29", "술시": "19:30~21:29", "해시": "21:30~23:29",
    }
    def _fmt_birth_time(t: str) -> str:
        t = t or "모름"
        rng = _BIRTH_TIME_RANGE.get(t)
        return f"{t} ({rng})" if rng else t

    pair = {
        "self": {
            "name":     self_data.get("name", ""),
            "gender":   self_data.get("gender", ""),
            "birth":    _fmt_birth(self_data),
            "birth_time": _fmt_birth_time(self_data.get("birth_time", "모름")),
            "ilgan":    self_saju.get("일간", ""),
            "ilgan_kr": self_saju.get("일간한글", ""),
            "ilji":     self_saju.get("일지", ""),
            "ilji_emoji": _BRANCH_EMOJI.get(self_saju.get("일지", ""), "🌠"),
            "ilji_kr":  _BRANCH_KR.get(self_saju.get("일지", ""), ""),
            "yong":     self_yong or "",
        },
        "partner": {
            "name":     partner_acq.get("name", ""),
            "gender":   partner_acq.get("gender", ""),
            "relation": partner_acq.get("relation", ""),
            "birth":    _fmt_birth(partner_acq),
            "birth_time": _fmt_birth_time(partner_acq.get("birth_time", "모름")),
            "ilgan":    partner_saju.get("일간", ""),
            "ilgan_kr": partner_saju.get("일간한글", ""),
            "ilji":     partner_saju.get("일지", ""),
            "ilji_emoji": _BRANCH_EMOJI.get(partner_saju.get("일지", ""), "🌠"),
            "ilji_kr":  _BRANCH_KR.get(partner_saju.get("일지", ""), ""),
            "yong":     partner_saju.get("용신", ""),
        },
    }

    # 적용 중인 관계단계 + 부가 정보 채움 여부 (UI 안내용)
    explicit_stage = (partner_acq.get("relation_stage") or "").strip()
    if explicit_stage in _COMPAT_STAGE_OPTIONS:
        active_stage = explicit_stage
    else:
        active_stage = _RELATION_TO_STAGE.get(partner_acq.get("relation") or "", "연인")
    extras_filled = bool(
        explicit_stage
        or partner_acq.get("relation_years") not in (None, "")
        or partner_acq.get("children_count") not in (None, "")
        or partner_acq.get("marriage_date")
    )

    return {
        "pair":          pair,
        "total":         total,
        "grade":         grade_text,
        "grade_key":     grade_key,
        "grade_emoji":   grade_emoji,
        "grade_color":   grade_color,
        "tier_top_pct":  int(cc.get("상위퍼센트") or 0),
        "tier_bot_pct":  int(cc.get("하위퍼센트") or 0),
        "stars":         max(1, min(5, total // 20)),
        "improve_copy":  improve_copy,
        "dimensions":    dimensions,
        "sections":      sections,
        "teasers":       teasers,
        "toc":           _COMPAT_PDF_TOC,
        "branch_label":  branch_label,
        "active_stage":  active_stage,
        "extras_filled": extras_filled,
        "stage_options": _COMPAT_STAGE_OPTIONS,
        # 폼 prefill용 — 현재 저장된 부가 정보
        "extras_current": {
            "relation_stage":  partner_acq.get("relation_stage") or "",
            "relation_years": partner_acq.get("relation_years") if partner_acq.get("relation_years") not in (None, "") else "",
            "children_count":  partner_acq.get("children_count") if partner_acq.get("children_count") not in (None, "") else "",
            "marriage_date":   partner_acq.get("marriage_date") or "",
        },
        "partner_id":    int(partner_acq.get("id") or 0),
    }


async def _compat(request: Request, master_id: str):
    """짝궁합 페이지 — 본인 고정 + 지인 1명 페어 분석."""
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    client = _get_client_session(request, master_id)
    if not client:
        return RedirectResponse(_brand_url(request, master_id, "login"))
    today = date.today()
    acqs  = db.get_acquaintances_by_client(client["id"]) or []

    # ?with=<acq_id> 처리
    qp = request.query_params.get("with")
    partner_acq = None
    if qp:
        try:
            pid = int(qp)
            target = db.get_acquaintance(pid)
            if target and target.get("client_id") == client["id"]:
                partner_acq = target
        except (TypeError, ValueError):
            partner_acq = None

    compat = _compat_data(client, partner_acq) if partner_acq else None

    _greet_seed = int(hashlib.md5(
        f"{client.get('id',0)}_{today.year}_{today.month}_{today.day}".encode()
    ).hexdigest(), 16)
    greeting = GREETINGS[_greet_seed % len(GREETINGS)]

    extras_saved = (request.query_params.get("saved") == "1")

    ctx = _brand_ctx(master, request)
    ctx.update({
        "client":        client,
        "subject":       client,           # chrome sheet 호환
        "subject_label": client.get("name", ""),
        "is_self":       partner_acq is None,
        "acquaintances": acqs,
        "today_str":     today.strftime("%Y년 %m월 %d일"),
        "weekday":       WEEKDAYS[today.weekday()],
        "compat":        compat,
        "partner_acq":   partner_acq,
        "greeting":      greeting,
        "extras_saved":  extras_saved,
    })
    return templates.TemplateResponse(request, "brand/compat.html", ctx)


async def _profile(request: Request, master_id: str):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    client = _get_client_session(request, master_id)
    if not client:
        return RedirectResponse(_brand_url(request, master_id, "login"))
    # 자가응답 Q1~Q7 + 활동/가족/부모 필드는 member 테이블에 저장 → 함께 로드
    member = {}
    member_id = client.get("member_id")
    if member_id:
        member = db.get_member(member_id) or {}
    # client에 member 필드 병합 (template에서 client.* 로 접근 가능하도록)
    for k in ("activity_type","marital_status","has_children","has_siblings","parent_status",
              "self_q1","self_q2","self_q3","self_q4","self_q5","self_q6","self_q7"):
        if k not in client or not client.get(k):
            client[k] = member.get(k, "")
    ctx = _brand_ctx(master, request)
    ctx["client"]     = client
    ctx["birth_info"] = _birth_info(client)
    ctx["msg"]        = request.query_params.get("msg", "")
    ctx["errors"]     = []
    return templates.TemplateResponse(request, "brand/profile.html", ctx)


async def _profile_post(
    request: Request, master_id: str,
    name: str, email: str, password: str, password_confirm: str,
    gender: str, birth_year: int, birth_month: int, birth_day: int,
    birth_time: str, lunar_yn, leap_month_yn,
    activity_type: str = "직장인", marital_status: str = "미혼",
    has_children: str = "없음", has_siblings: str = "있음",
    parent_status: str = "양친",
    self_q1: str = "", self_q2: str = "", self_q3: str = "",
    self_q4: str = "", self_q5: str = "", self_q6: str = "", self_q7: str = "",
):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    client = _get_client_session(request, master_id)
    if not client:
        return RedirectResponse(_brand_url(request, master_id, "login"))
    ctx = _brand_ctx(master, request)
    errors = []
    name  = (name or "").strip()
    email = (email or "").strip().lower()
    if not name:
        errors.append("이름은 필수입니다.")
    import re
    EMAIL_RE = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
    if not email or not re.match(EMAIL_RE, email):
        errors.append("올바른 이메일 형식이 아닙니다.")
    if email and email != client.get("email", "").lower():
        existing = db.get_client_by_email(master_id, email)
        if existing and existing["id"] != client["id"]:
            errors.append("이미 사용 중인 이메일입니다.")
    update_client = {"name": name, "email": email}
    if password:
        if len(password) < 6:
            errors.append("비밀번호는 6자 이상이어야 합니다.")
        elif password != password_confirm:
            errors.append("비밀번호가 일치하지 않습니다.")
        else:
            update_client["password_hash"] = hashlib.sha256(password.encode()).hexdigest()
    update_member = {
        "name":          name,
        "email":         email,
        "birth_year":    int(birth_year),
        "birth_month":   int(birth_month),
        "birth_day":     int(birth_day),
        "birth_time":    birth_time,
        "gender":        gender,
        "lunar_yn":      1 if lunar_yn else 0,
        "leap_month_yn": 1 if leap_month_yn else 0,
        # 자가응답 + 활동/가족/부모 정보
        "activity_type":  (activity_type or "").strip() or "직장인",
        "marital_status": (marital_status or "").strip() or "미혼",
        "has_children":   (has_children or "").strip() or "없음",
        "has_siblings":   (has_siblings or "").strip() or "있음",
        "parent_status":  (parent_status or "").strip() or "양친",
        "self_q1":        (self_q1 or "").strip(),
        "self_q2":        (self_q2 or "").strip(),
        "self_q3":        (self_q3 or "").strip(),
        "self_q4":        (self_q4 or "").strip(),
        "self_q5":        (self_q5 or "").strip(),
        "self_q6":        (self_q6 or "").strip(),
        "self_q7":        (self_q7 or "").strip(),
    }
    if errors:
        # 입력값 유지하면서 에러 표시
        for k, v in {**update_member, "email": email}.items():
            client[k] = v
        ctx["client"]     = client
        ctx["birth_info"] = _birth_info(client)
        ctx["msg"]        = ""
        ctx["errors"]     = errors
        return templates.TemplateResponse(request, "brand/profile.html", ctx)
    db.update_client(client["id"], update_client)
    member_id = client.get("member_id")
    if member_id:
        db.update_member(member_id, update_member)
    # 프로필 변경 → 사용자 전체 캐시 무효화 (newyear/traditional/오늘운세 등 입력 변경 가능성)
    cache_store.invalidate(client["id"])
    request.session[f"client_name_{master_id}"] = name
    db.log_action(master_id, "B2C회원수정", f"{name} ({email})")
    from urllib.parse import quote
    return RedirectResponse(
        _brand_url(request, master_id, "profile") + "?msg=" + quote("변경되었습니다."),
        status_code=303
    )


# ---------------------------------------------------------
# 서브도메인 라우터 (banya.sajumaster.com/xxx)
# ---------------------------------------------------------

@router.get("/register", response_class=HTMLResponse)
async def brand_sub_register_form(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _register_form(request, master_id)


@router.post("/register", response_class=HTMLResponse)
async def brand_sub_register_post(
    request: Request,
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    password_confirm: str = Form(...),
    gender: str = Form("남"),
    birth_year: int = Form(...),
    birth_month: int = Form(...),
    birth_day: int = Form(...),
    birth_time: str = Form("모름"),
    lunar_yn: Optional[str] = Form(None),
    leap_month_yn: Optional[str] = Form(None),
):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _register_post(
        request, master_id, name, email, password, password_confirm,
        gender, birth_year, birth_month, birth_day, birth_time,
        lunar_yn, leap_month_yn
    )


@router.get("/login", response_class=HTMLResponse)
async def brand_sub_login_form(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _login_form(request, master_id)


@router.post("/login", response_class=HTMLResponse)
async def brand_sub_login_post(
    request: Request,
    login_id: str = Form(...),
    password: str = Form(...),
    remember: Optional[str] = Form(None),
):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _login_post(request, master_id, login_id, password, remember)


@router.get("/forgot-password", response_class=HTMLResponse)
async def brand_sub_forgot_form(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _forgot_form(request, master_id)

@router.post("/forgot-password", response_class=HTMLResponse)
async def brand_sub_forgot_post(request: Request, email: str = Form(...)):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _forgot_post(request, master_id, email)

def _resolve_master_from_token(request: Request, token: str) -> str:
    """서브도메인 brand_id가 없으면 token으로 client→master_id 추적 (인트라넷 호환)"""
    master_id = getattr(request.state, "brand_id", None)
    if master_id:
        return master_id
    if token:
        client = db.get_password_reset_token(token)
        if client:
            return client.get("master_id", "")
    return ""

@router.get("/reset-password", response_class=HTMLResponse)
async def brand_sub_reset_form(request: Request, token: str = ""):
    master_id = _resolve_master_from_token(request, token)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _reset_form(request, master_id, token)

@router.post("/reset-password", response_class=HTMLResponse)
async def brand_sub_reset_post(
    request: Request,
    token: str = Form(...),
    password: str = Form(...),
    password_confirm: str = Form(...),
):
    master_id = _resolve_master_from_token(request, token)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _reset_post(request, master_id, token, password, password_confirm)

@router.get("/logout")
async def brand_sub_logout(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _logout(request, master_id)


@router.get("/home", response_class=HTMLResponse)
async def brand_sub_home(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _home(request, master_id)


@router.get("/welcome", response_class=HTMLResponse)
async def brand_sub_welcome(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id or master_id == "admin":
        raise HTTPException(status_code=404)
    return await _welcome(request, master_id)


@router.get("/tarot", response_class=HTMLResponse)
async def brand_sub_tarot(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id or master_id == "admin":
        raise HTTPException(status_code=404)
    return await _tarot(request, master_id)


@router.get("/newyear", response_class=HTMLResponse)
async def brand_sub_newyear(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id or master_id == "admin":
        raise HTTPException(status_code=404)
    return await _newyear(request, master_id)


@router.get("/traditional", response_class=HTMLResponse)
async def brand_sub_traditional(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id or master_id == "admin":
        raise HTTPException(status_code=404)
    return await _traditional(request, master_id)


@router.get("/compat", response_class=HTMLResponse)
async def brand_sub_compat(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id or master_id == "admin":
        raise HTTPException(status_code=404)
    return await _compat(request, master_id)


async def _save_compat_extras(request: Request, master_id: str, acq_id: int):
    """짝궁합 부가 정보 저장 (관계단계·기간·자녀수·결혼예정일).
    저장 후 같은 페어로 /compat?with=<acq_id> 리다이렉트."""
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    client = _get_client_session(request, master_id)
    if not client:
        return RedirectResponse(_brand_url(request, master_id, "login"), status_code=303)
    target = db.get_acquaintance(acq_id)
    if not target or target.get("client_id") != client["id"]:
        raise HTTPException(status_code=404)

    form = await request.form()
    stage = (form.get("relation_stage") or "").strip()
    if stage and stage not in _COMPAT_STAGE_OPTIONS:
        stage = ""

    years_raw = (form.get("relation_years") or "").strip()
    children_raw = (form.get("children_count") or "").strip()
    mdate = (form.get("marriage_date") or "").strip()

    def _opt_int(s: str, lo: int, hi: int):
        if not s: return None
        try:
            v = int(s)
            return v if lo <= v <= hi else None
        except (TypeError, ValueError):
            return None

    data = {
        "relation_stage":  stage or None,
        "relation_years":  _opt_int(years_raw, 0, 100),
        "children_count":  _opt_int(children_raw, 0, 20),
        "marriage_date":   mdate or None,
    }
    db.update_acquaintance(acq_id, data)

    # 저장 즉시 캐시 무효화 — 다음 GET에서 새 관계정보로 재계산
    _COMPAT_CACHE.clear()
    cache_store.invalidate(client["id"])

    redirect_url = _brand_url(request, master_id, f"compat?with={acq_id}&saved=1")
    return RedirectResponse(redirect_url, status_code=303)


@router.post("/compat/{acq_id}/extras")
async def brand_sub_compat_extras(request: Request, acq_id: int):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id or master_id == "admin":
        raise HTTPException(status_code=404)
    return await _save_compat_extras(request, master_id, acq_id)


@router.get("/acquaintances", response_class=HTMLResponse)
async def brand_sub_acquaintances(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id or master_id == "admin":
        raise HTTPException(status_code=404)
    return await _acquaintances_page(request, master_id)


@router.post("/acquaintances", response_class=HTMLResponse)
async def brand_sub_acquaintance_create(
    request: Request,
    name: str = Form(...),
    gender: str = Form("남"),
    birth_year: int = Form(...),
    birth_month: int = Form(...),
    birth_day: int = Form(...),
    birth_time: str = Form("모름"),
    lunar_yn: Optional[str] = Form(None),
    leap_month_yn: Optional[str] = Form(None),
    relation: str = Form("기타"),
    memo: str = Form(""),
):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id or master_id == "admin":
        raise HTTPException(status_code=404)
    return await _acquaintance_create(
        request, master_id, name, gender, birth_year, birth_month, birth_day,
        birth_time, lunar_yn, leap_month_yn, relation, memo
    )


@router.post("/acquaintances/{acq_id}/edit", response_class=HTMLResponse)
async def brand_sub_acquaintance_update(
    request: Request, acq_id: int,
    name: str = Form(...),
    gender: str = Form("남"),
    birth_year: int = Form(...),
    birth_month: int = Form(...),
    birth_day: int = Form(...),
    birth_time: str = Form("모름"),
    lunar_yn: Optional[str] = Form(None),
    leap_month_yn: Optional[str] = Form(None),
    relation: str = Form("기타"),
    memo: str = Form(""),
):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id or master_id == "admin":
        raise HTTPException(status_code=404)
    return await _acquaintance_update(
        request, master_id, acq_id, name, gender, birth_year, birth_month, birth_day,
        birth_time, lunar_yn, leap_month_yn, relation, memo
    )


@router.post("/acquaintances/{acq_id}/delete", response_class=HTMLResponse)
async def brand_sub_acquaintance_delete(request: Request, acq_id: int):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id or master_id == "admin":
        raise HTTPException(status_code=404)
    return await _acquaintance_delete(request, master_id, acq_id)


@router.get("/profile", response_class=HTMLResponse)
async def brand_sub_profile(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _profile(request, master_id)


async def _profile_leave(request: Request, master_id: str):
    """회원 탈퇴 처리 — clients/members 소프트 삭제 + 세션 클리어 + 인트로로 리다이렉트."""
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    client = _get_client_session(request, master_id)
    if not client:
        return RedirectResponse(_brand_url(request, master_id, "login"), status_code=303)
    cid = int(client["id"])
    name = client.get("name", "")
    email = client.get("email", "")
    db.soft_delete_client(cid)
    cache_store.invalidate(cid)
    # 세션 클리어 (해당 master 키들만)
    for k in [f"client_{master_id}", f"client_name_{master_id}",
              f"client_email_{master_id}"]:
        request.session.pop(k, None)
    db.log_action(master_id, "B2C회원탈퇴", f"{name} ({email})")
    from urllib.parse import quote
    return RedirectResponse(
        _brand_url(request, master_id, "") + "?msg=" + quote("탈퇴 처리되었습니다."),
        status_code=303
    )


@router.post("/profile/leave")
async def brand_sub_profile_leave(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _profile_leave(request, master_id)


@router.post("/profile", response_class=HTMLResponse)
async def brand_sub_profile_post(
    request: Request,
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(""),
    password_confirm: str = Form(""),
    gender: str = Form("남"),
    birth_year: int = Form(...),
    birth_month: int = Form(...),
    birth_day: int = Form(...),
    birth_time: str = Form("모름"),
    lunar_yn: Optional[str] = Form(None),
    leap_month_yn: Optional[str] = Form(None),
    activity_type: str = Form("직장인"),
    marital_status: str = Form("미혼"),
    has_children: str = Form("없음"),
    has_siblings: str = Form("있음"),
    parent_status: str = Form("양친"),
    self_q1: str = Form(""),
    self_q2: str = Form(""),
    self_q3: str = Form(""),
    self_q4: str = Form(""),
    self_q5: str = Form(""),
    self_q6: str = Form(""),
    self_q7: str = Form(""),
):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _profile_post(
        request, master_id, name, email, password, password_confirm,
        gender, birth_year, birth_month, birth_day, birth_time,
        lunar_yn, leap_month_yn,
        activity_type, marital_status, has_children, has_siblings, parent_status,
        self_q1, self_q2, self_q3, self_q4, self_q5, self_q6, self_q7,
    )


# ---------------------------------------------------------
# 경로 방식 라우터 /expert/{master_id}/xxx (하위 호환)
# ---------------------------------------------------------

@router.get("/expert/{master_id}", response_class=HTMLResponse)
async def brand_landing(request: Request, master_id: str):
    """경로 방식 진입점 — 서브도메인 진입과 동일하게 인트로 거침."""
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404, detail="브랜드를 찾을 수 없습니다.")
    client = _get_client_session(request, master_id)
    if client:
        db.update_client_visit(client["id"])
    ctx = _brand_ctx(master, request)
    ctx["client"] = client
    return templates.TemplateResponse(request, "brand/intro.html", ctx)


@router.get("/expert/{master_id}/register", response_class=HTMLResponse)
async def brand_register_form(request: Request, master_id: str):
    return await _register_form(request, master_id)


@router.post("/expert/{master_id}/register", response_class=HTMLResponse)
async def brand_register_post(
    request: Request, master_id: str,
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    password_confirm: str = Form(...),
    gender: str = Form("남"),
    birth_year: int = Form(...),
    birth_month: int = Form(...),
    birth_day: int = Form(...),
    birth_time: str = Form("모름"),
    lunar_yn: Optional[str] = Form(None),
    leap_month_yn: Optional[str] = Form(None),
):
    return await _register_post(
        request, master_id, name, email, password, password_confirm,
        gender, birth_year, birth_month, birth_day, birth_time,
        lunar_yn, leap_month_yn
    )


@router.get("/expert/{master_id}/login", response_class=HTMLResponse)
async def brand_login_form(request: Request, master_id: str):
    return await _login_form(request, master_id)


@router.post("/expert/{master_id}/login", response_class=HTMLResponse)
async def brand_login_post(
    request: Request, master_id: str,
    login_id: str = Form(...),
    password: str = Form(...),
    remember: Optional[str] = Form(None),
):
    return await _login_post(request, master_id, login_id, password, remember)


@router.get("/expert/{master_id}/forgot-password", response_class=HTMLResponse)
async def brand_forgot_form(request: Request, master_id: str):
    return await _forgot_form(request, master_id)

@router.post("/expert/{master_id}/forgot-password", response_class=HTMLResponse)
async def brand_forgot_post(request: Request, master_id: str, email: str = Form(...)):
    return await _forgot_post(request, master_id, email)

@router.get("/expert/{master_id}/reset-password", response_class=HTMLResponse)
async def brand_reset_form(request: Request, master_id: str, token: str = ""):
    return await _reset_form(request, master_id, token)

@router.post("/expert/{master_id}/reset-password", response_class=HTMLResponse)
async def brand_reset_post(
    request: Request, master_id: str,
    token: str = Form(...),
    password: str = Form(...),
    password_confirm: str = Form(...),
):
    return await _reset_post(request, master_id, token, password, password_confirm)

@router.get("/expert/{master_id}/logout")
async def brand_logout(request: Request, master_id: str):
    return await _logout(request, master_id)


@router.get("/expert/{master_id}/home", response_class=HTMLResponse)
async def brand_home(request: Request, master_id: str):
    return await _home(request, master_id)


@router.get("/expert/{master_id}/welcome", response_class=HTMLResponse)
async def brand_welcome(request: Request, master_id: str):
    return await _welcome(request, master_id)


@router.get("/expert/{master_id}/tarot", response_class=HTMLResponse)
async def brand_tarot(request: Request, master_id: str):
    return await _tarot(request, master_id)


@router.get("/expert/{master_id}/newyear", response_class=HTMLResponse)
async def brand_newyear(request: Request, master_id: str):
    return await _newyear(request, master_id)


@router.get("/expert/{master_id}/traditional", response_class=HTMLResponse)
async def brand_traditional(request: Request, master_id: str):
    return await _traditional(request, master_id)


@router.get("/expert/{master_id}/compat", response_class=HTMLResponse)
async def brand_compat(request: Request, master_id: str):
    return await _compat(request, master_id)


@router.post("/expert/{master_id}/compat/{acq_id}/extras")
async def brand_compat_extras(request: Request, master_id: str, acq_id: int):
    return await _save_compat_extras(request, master_id, acq_id)


@router.get("/expert/{master_id}/acquaintances", response_class=HTMLResponse)
async def brand_acquaintances(request: Request, master_id: str):
    return await _acquaintances_page(request, master_id)


@router.post("/expert/{master_id}/acquaintances", response_class=HTMLResponse)
async def brand_acquaintance_create(
    request: Request, master_id: str,
    name: str = Form(...),
    gender: str = Form("남"),
    birth_year: int = Form(...),
    birth_month: int = Form(...),
    birth_day: int = Form(...),
    birth_time: str = Form("모름"),
    lunar_yn: Optional[str] = Form(None),
    leap_month_yn: Optional[str] = Form(None),
    relation: str = Form("기타"),
    memo: str = Form(""),
):
    return await _acquaintance_create(
        request, master_id, name, gender, birth_year, birth_month, birth_day,
        birth_time, lunar_yn, leap_month_yn, relation, memo
    )


@router.post("/expert/{master_id}/acquaintances/{acq_id}/edit", response_class=HTMLResponse)
async def brand_acquaintance_update(
    request: Request, master_id: str, acq_id: int,
    name: str = Form(...),
    gender: str = Form("남"),
    birth_year: int = Form(...),
    birth_month: int = Form(...),
    birth_day: int = Form(...),
    birth_time: str = Form("모름"),
    lunar_yn: Optional[str] = Form(None),
    leap_month_yn: Optional[str] = Form(None),
    relation: str = Form("기타"),
    memo: str = Form(""),
):
    return await _acquaintance_update(
        request, master_id, acq_id, name, gender, birth_year, birth_month, birth_day,
        birth_time, lunar_yn, leap_month_yn, relation, memo
    )


@router.post("/expert/{master_id}/acquaintances/{acq_id}/delete", response_class=HTMLResponse)
async def brand_acquaintance_delete(request: Request, master_id: str, acq_id: int):
    return await _acquaintance_delete(request, master_id, acq_id)


@router.get("/expert/{master_id}/profile", response_class=HTMLResponse)
async def brand_profile(request: Request, master_id: str):
    return await _profile(request, master_id)


@router.post("/expert/{master_id}/profile/leave")
async def brand_profile_leave(request: Request, master_id: str):
    return await _profile_leave(request, master_id)


@router.post("/expert/{master_id}/profile", response_class=HTMLResponse)
async def brand_profile_post(
    request: Request, master_id: str,
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(""),
    password_confirm: str = Form(""),
    gender: str = Form("남"),
    birth_year: int = Form(...),
    birth_month: int = Form(...),
    birth_day: int = Form(...),
    birth_time: str = Form("모름"),
    lunar_yn: Optional[str] = Form(None),
    leap_month_yn: Optional[str] = Form(None),
    activity_type: str = Form("직장인"),
    marital_status: str = Form("미혼"),
    has_children: str = Form("없음"),
    has_siblings: str = Form("있음"),
    parent_status: str = Form("양친"),
    self_q1: str = Form(""),
    self_q2: str = Form(""),
    self_q3: str = Form(""),
    self_q4: str = Form(""),
    self_q5: str = Form(""),
    self_q6: str = Form(""),
    self_q7: str = Form(""),
):
    return await _profile_post(
        request, master_id, name, email, password, password_confirm,
        gender, birth_year, birth_month, birth_day, birth_time,
        lunar_yn, leap_month_yn,
        activity_type, marital_status, has_children, has_siblings, parent_status,
        self_q1, self_q2, self_q3, self_q4, self_q5, self_q6, self_q7,
    )
