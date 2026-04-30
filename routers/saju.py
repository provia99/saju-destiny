from fastapi import APIRouter, Request, Form, BackgroundTasks, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, FileResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from saju_writer import run_saju_background
from engine_pool import executor
from utils import format_phone
from slot_path import find_slot_dir


def resolve_slot_dir(book, member, *, default_year=None, slot_subdir=None):
    """슬롯 경로 결정 — DB의 book.slot_dir이 진실 소스.
    없거나 존재하지 않으면 find_slot_dir로 fallback (마이그레이션 안 된 책)."""
    if book and book.get('slot_dir'):
        p = Path(book['slot_dir'])
        if p.exists():
            return p
    # fallback: 검색 기반
    if slot_subdir is None:
        slot_subdir = "compatibility" if (book and book.get("product_type") == "compatibility") else "saju"
    year = (book.get('book_year') if book else None) or default_year
    return find_slot_dir(
        Path("engine/queue"),
        (book['master_id'] if book else None) or member.get('master_id'),
        member['name'],
        str(member.get("phone", "") or ""),
        slot_subdir,
        member.get('id') or (book.get('member_id', 0) if book else 0),
        year,
    )
from pathlib import Path
import db, os, sys, json, logging, re, subprocess
from datetime import datetime
from saju_engine import calculate_saju, analyze_ohaeng, calculate_daeun

router = APIRouter()
from utils import templates

# ═══════════════════════════════════════════════
# 상품별 검증 스펙
# ═══════════════════════════════════════════════
# 4가지 상품(총본/요약본/궁합/연간운세)의 구조 차이를 반영
PRODUCT_SPECS = {
    "saju_full": {
        "label": "총본",
        "result_subdir": "saju",
        "min_chars": 150_000,
        "max_chars": 400_000,
        # 총본은 "☯ 서장.", "✦ 서장.", "1장 ...", "16장 ...", "종장 ..." 등 다양한 선행 기호 허용
        "chapter_regex": r'^\s*[☯✦]?\s*(서장|종장|\d+장)[.\s]',
        "expected_chapters": [
            "서장", "1장", "2장", "3장", "4장", "5장", "6장", "7장", "8장",
            "9장", "10장", "11장", "12장", "13장", "14장", "15장", "16장", "종장"
        ],
        "required_tables": [
            "cover", "명식표", "인적사항표", "사주기본표", "4신요약표",
            "격국분석표", "용신가이드카드", "오행균형표", "십성배치표", "대운로드맵",
        ],
        # 표 generator가 의존하는 ch* 슬롯 데이터 (runner가 보장해야 함)
        "required_data": [
            "ch00", "ch01", "ch02", "ch03", "ch04", "ch05", "ch06", "ch07", "ch08",
            "ch09", "ch10", "ch11", "ch14", "ch15", "ch16", "ch17", "ch18",
            "ch_interior", "ch_kijil",
        ],
        "has_cover_animal": True,
        "is_compatibility": False,
    },
    "saju_summary": {
        "label": "요약본",
        "result_subdir": "saju",
        "min_chars": 20_000,
        "max_chars": 60_000,
        "chapter_regex": r'^✺\s*(\d+)장\.',
        "expected_chapters": [f"{i}장" for i in range(1, 20)],
        "required_tables": [
            "cover", "명식표", "인적사항표", "사주기본표",
            "용신가이드카드", "오행점수표",
        ],
        # 요약본 본문 + 표 데이터: ch03 (표 인적), ch10 (건강표), ch11 (직업표), ch_summary (본문)
        "required_data": ["ch03", "ch10", "ch11", "ch_summary"],
        "has_cover_animal": True,
        "is_compatibility": False,
    },
    "compatibility": {
        "label": "궁합분석",
        "result_subdir": "compatibility",
        "min_chars": 10_000,
        "max_chars": 80_000,
        "chapter_regex": None,
        "expected_chapters": [],
        "required_tables": [
            "궁합인적사항표", "궁합한눈표", "궁합종합점수표", "궁합사주비교표", "궁합오행비교표",
            "궁합용신교차표", "궁합십성관계표", "궁합친밀도표",
            "궁합합충교차표", "궁합인연깊이표",
            "궁합신살교차표", "궁합공망교차표", "궁합지장간암합표", "궁합12운성교차표", "궁합격국조합표",
            "궁합세운동적표", "궁합월운동적표", "궁합천을귀인대운표",
            "궁합12신살교차표", "궁합일주궁합표", "궁합건강교차표", "궁합에너지흐름표",
        ],
        # 궁합은 자체 calc 사용 (relationship_calc/compatibility_calc) — ch* 의존 없음
        "required_data": [],
        "has_cover_animal": False,
        "is_compatibility": True,
    },
    "yearly_fortune": {
        "label": "연간운세",
        "result_subdir": "saju",
        "min_chars": 30_000,
        "max_chars": 180_000,
        "chapter_regex": None,
        "expected_chapters": [],
        "required_tables": [
            "cover", "명식표", "인적사항표", "사주기본표",
            "세운대운교차표", "세운월운달력", "연간운세요약표", "전환점타임라인",
        ],
        # 연간운세: ch03 (인적), ch08 (대운), ch09 (세운/월운)
        "required_data": ["ch03", "ch08", "ch09"],
        "has_cover_animal": True,
        "is_compatibility": False,
    },
    "wealth_career": {
        "label": "재물·직업·창업",
        "result_subdir": "saju",
        "min_chars": 25_000,
        "max_chars": 90_000,
        "chapter_regex": None,
        "expected_chapters": [],
        "required_tables": [
            "cover", "명식표", "인적사항표", "사주기본표",
            "재물전략표", "직업표", "신강약직업표", "용신가이드카드",
        ],
        # 재물·직업: ch03 (인적), ch08 (대운/재물 위험), ch11 (직업 분석)
        "required_data": ["ch03", "ch08", "ch11"],
        "has_cover_animal": True,
        "is_compatibility": False,
        # 추가 입력 폼 (별도 페이지): 현재 직업, 창업/이직 검토, 투자성향, 동업자 사주(선택)
    },
    "feng_shui": {
        "label": "풍수·인테리어",
        "result_subdir": "saju",
        "min_chars": 20_000,
        "max_chars": 70_000,
        "chapter_regex": None,
        "expected_chapters": [],
        "required_tables": [
            "cover", "명식표", "인적사항표", "사주기본표",
            "오행인테리어비교표", "용신가이드카드", "지지계절방위표",
        ],
        # 풍수: ch03 (인적), ch_interior (방위·색상·인테리어)
        "required_data": ["ch03", "ch_interior"],
        "has_cover_animal": True,
        "is_compatibility": False,
        # 추가 입력 폼: 현재 거주지 방향, 이사 검토 여부, 후보지 방향, 침실/사무실 위치 변경 가능 여부
    },
    "auspicious_day": {
        "label": "택일",
        "result_subdir": "saju",
        "min_chars": 15_000,
        "max_chars": 60_000,
        "chapter_regex": None,
        "expected_chapters": [],
        "required_tables": [
            "cover", "명식표", "인적사항표", "사주기본표",
            "운세달력_전체", "운세달력_표지", "용신가이드카드",
        ],
        # 택일: ch03 (인적), ch08 (대운), ch09 (세운·월운·일진)
        "required_data": ["ch03", "ch08", "ch09"],
        "has_cover_animal": True,
        "is_compatibility": False,
        # 추가 입력 폼: 행사 종류(결혼/이사/개업/계약), 희망 시기, 관련자 사주(결혼=양가·동업=동업자), 피할 날짜
    },
}

def resolve_product_spec(product_hint: str | None) -> tuple[str, dict]:
    """쿼리 파라미터 product 값을 검증 스펙으로 정규화."""
    key = (product_hint or "saju_full").strip()
    if key not in PRODUCT_SPECS:
        key = "saju_full"
    return key, PRODUCT_SPECS[key]


def get_master_id(request: Request):
    return request.session.get("master_id")

@router.get("/write/{member_id}", response_class=HTMLResponse)
async def write_form(request: Request, member_id: int):
    master_id = get_master_id(request)
    if not master_id:
        return RedirectResponse("/login")

    member = db.get_member(member_id)
    if not member or member["master_id"] != master_id:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")

    books = db.get_books(member_id=member_id)
    curr_year = datetime.now().year
    years = [curr_year - 1, curr_year, curr_year + 1]

    # 궁합 파트너 선택용 — 본인 제외 전체 회원 목록 (이름·성별·생년월일만)
    _all = db.get_members(master_id) or []
    partner_candidates = [
        {
            "id": m["id"],
            "name": m["name"],
            "gender": m.get("gender", ""),
            "birth_year": m.get("birth_year"),
            "birth_month": m.get("birth_month"),
            "birth_day": m.get("birth_day"),
            "birth_time": m.get("birth_time", ""),
            "lunar_yn": m.get("lunar_yn", 0),
            "leap_month_yn": m.get("leap_month_yn", 0),
        }
        for m in _all if m["id"] != member_id
    ]

    return templates.TemplateResponse(request, "master/write.html", {
        "member": member,
        "books": books,
        "years": years,
        "curr_year": curr_year,
        "status_mode": False,
        "partner_candidates": partner_candidates,
    })

@router.post("/write/{member_id}")
async def write_execute(
    request: Request,
    member_id: int,
    background_tasks: BackgroundTasks,
    book_year: int = Form(...),
    edition: str = Form("초판"),
    product_type: str = Form("saju_full"),
    # ── 궁합 전용 Form 필드 ──
    partner_mode: str = Form("existing"),
    partner_member_id: str = Form(""),
    partner_name: str = Form(""),
    partner_gender: str = Form("남"),
    partner_birth_year: str = Form(""),
    partner_birth_month: str = Form(""),
    partner_birth_day: str = Form(""),
    partner_birth_time: str = Form("모름"),
    partner_lunar: str = Form(""),
    partner_leap: str = Form(""),
    relationship_stage: str = Form("연인"),
    relationship_years: str = Form(""),
    children_count: str = Form(""),
    marriage_date: str = Form(""),
):
    master_id = get_master_id(request)
    if not master_id:
        return RedirectResponse("/login")

    member = db.get_member(member_id)
    if not member or member["master_id"] != master_id:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")

    # product_type 유효성 검사
    valid_types = ("saju_full", "saju_summary", "yearly_fortune", "compatibility", "wealth_career", "feng_shui", "auspicious_day", "health", "personality", "custom")
    if product_type not in valid_types:
        product_type = "saju_full"

    # ── 궁합인 경우: partner 데이터 조립 + 유효성 검증 ──
    partner_data = None
    if product_type == "compatibility":
        if partner_mode == "existing":
            # 기존 회원 ID 기반
            if not partner_member_id or not partner_member_id.isdigit():
                raise HTTPException(status_code=400, detail="파트너를 선택해주세요.")
            p = db.get_member(int(partner_member_id))
            if not p or p["master_id"] != master_id:
                raise HTTPException(status_code=403, detail="파트너 회원을 찾을 수 없습니다.")
            partner_data = {
                "이름": p["name"],
                "성별": p.get("gender") or "남",
                "생년": int(p["birth_year"]),
                "생월": int(p["birth_month"]),
                "생일": int(p["birth_day"]),
                "생시": p.get("birth_time") or "모름",
                "음력입력": bool(p.get("lunar_yn", 0)),
                "윤달": bool(p.get("leap_month_yn", 0)),
                "_source_member_id": p["id"],
            }
        else:
            # 직접 입력
            if not (partner_name and partner_birth_year and partner_birth_month and partner_birth_day):
                raise HTTPException(status_code=400, detail="파트너 이름·생년월일은 필수입니다.")
            partner_data = {
                "이름": partner_name.strip(),
                "성별": partner_gender if partner_gender in ("남", "여") else "남",
                "생년": int(partner_birth_year),
                "생월": int(partner_birth_month),
                "생일": int(partner_birth_day),
                "생시": partner_birth_time or "모름",
                "음력입력": bool(partner_lunar),
                "윤달": bool(partner_leap),
            }

    # 관계 정보 (궁합에만 의미 있음)
    relationship_info = None
    if product_type == "compatibility":
        relationship_info = {
            "관계단계": relationship_stage if relationship_stage in (
                "썸", "연인", "예비부부", "부부", "재혼준비", "재혼", "별거", "이혼고민"
            ) else "연인",
            "관계기간개월": int(relationship_years) * 12 if relationship_years and relationship_years.isdigit() else None,
            "자녀수": int(children_count) if children_count and children_count.isdigit() else None,
            "결혼예정일": marriage_date or None,
        }

    # 1) DB에 기록
    book_id = db.insert_book({
        "master_id": master_id,
        "member_id": member_id,
        "book_year": book_year,
        "edition": edition,
        "product_type": product_type
    })
    # 궁합인 경우 partner의 member_id 기록 (재사용·관계도 확장에 사용)
    _partner_ids_json = ""
    if partner_data and partner_data.get("_source_member_id"):
        import json as _json
        _partner_ids_json = _json.dumps([partner_data["_source_member_id"]])
    db.update_book(book_id, {"status": "생성중", "partner_member_ids": _partner_ids_json})
    db.log_action(master_id, "집필시작", member["name"], member_id)

    # 2) 완료 콜백
    def on_complete(output_path, chars):
        db.update_book(book_id, {
            "status": "완료",
            "pdf_path": output_path,
            "completed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })
        db.log_action(master_id, "집필완료", f"{member['name']} ({chars:,}자)", member_id)

    # 3) 오류 콜백
    def on_error(error_msg):
        db.update_book(book_id, {
            "status": "오류",
            "error_msg": str(error_msg)[:500]
        })
        db.log_action(master_id, "집필오류", str(error_msg)[:200], member_id)

    # 4) 백그라운드 태스크 실행 (궁합이면 partner_data + relationship_info 전달)
    background_tasks.add_task(
        run_saju_background,
        book_id=book_id,
        member=dict(member),
        master_id=master_id,
        book_year=book_year,
        on_complete=on_complete,
        on_error=on_error,
        executor=executor,
        product_type=product_type,
        partner_data=partner_data,
        relationship_info=relationship_info,
    )

    return RedirectResponse(f"/saju/status/{book_id}", status_code=302)

@router.get("/status/{book_id}", response_class=HTMLResponse)
async def status_page(request: Request, book_id: int):
    master_id = get_master_id(request)
    if not master_id:
        return RedirectResponse("/login")
    
    book = db.get_book(book_id)
    if not book or book["master_id"] != master_id:
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없습니다.")
    
    member = db.get_member(book["member_id"])
    
    return templates.TemplateResponse(request, "master/write.html", {
        "member": member,
        "book": book,
        "status_mode": True
    })

@router.get("/status/{book_id}/json")
async def status_json(request: Request, book_id: int):
    master_id = get_master_id(request)
    if not master_id:
        return {"error": "Unauthorized"}
    
    book = db.get_book(book_id)
    if not book or book["master_id"] != master_id:
        return {"error": "Not Found"}
        
    return JSONResponse(
        content={
            "status": book["status"],
            "error_msg": book.get("error_msg") or ""
        },
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

@router.get("/history", response_class=HTMLResponse)
async def history_list(request: Request, status: str = "전체"):
    master_id = get_master_id(request)
    if not master_id:
        return RedirectResponse("/login")
    
    books = db.get_books(master_id=master_id)
    if status != "전체":
        books = [b for b in books if b["status"] == status]
        
    for b in books:
        m = db.get_member(b["member_id"])
        b["member_name"] = m["name"] if m else "?"
        
    return templates.TemplateResponse(request, "master/history.html", {
        "books": books,
        "curr_status": status
    })


def get_saju_slots(member):
    """회원 정보를 기반으로 사주 슬롯 데이터를 계산하여 반환"""
    try:
        # 시간 파싱
        hour = 0
        b_time = str(member.get('birth_time', '00:00'))
        if ':' in b_time:
            try: hour = int(b_time.split(':')[0])
            except: hour = 0
        else:
            time_map = {'자':0,'축':2,'인':4,'묘':6,'진':8,'사':10,'오':12,'미':14,'신':16,'유':18,'술':20,'해':22}
            for k, v in time_map.items():
                if k in b_time: hour = v; break
        
        # 사주 계산
        birth_year = int(member['birth_year'])
        res = calculate_saju(
            birth_year, int(member['birth_month']), int(member['birth_day']),
            hour, 0,
            is_lunar=bool(member.get('lunar_yn', 0)),
            is_leap=bool(member.get('leap_month_yn', 0)),
            gender='M' if member['gender'] == '남' else 'F'
        )
        
        # 오행 분석
        ohaeng_res = analyze_ohaeng(res)
        
        # 대운 계산
        daeun_list = calculate_daeun(res, birth_year, num_periods=10, day_stem=res['day_stem']['stem'])
        
        # 슬롯 맵핑
        p = res['pillars']
        sp = res['sipseong']
        ms = res['manseryeok']
        
        # 오행 영문 변환 (CSS 클래스용)
        oh_eng = {'목':'wood', '화':'fire', '토':'earth', '금':'metal', '수':'water'}
        from saju_engine.heavenly_earthly import HEAVENLY_OHAENG, EARTHLY_OHAENG, to_korean_reading
        
        slots = {
            "이름": member['name'],
            "성별": member['gender'],
            "만나이": datetime.now().year - birth_year,
            "일주한자": p['day']['ganji'],
            "일주한글": p['day']['ganji_kr'],
            "일지한자": p['day']['branch'],
            "띠": member.get('memo', '').split(' ')[0] if '띠' in member.get('memo','') else '용', # 임시
            "양력": res['input']['solar_date'],
            "음력": res['input']['lunar_date'],
            
            "있는십성목록": "·".join(set(sp.values())),
            "최다십성계열": "", # 후속 계산
            "용신오행": ohaeng_res['strength'].get('yongshin', '목'),
            "신강약": ohaeng_res['strength']['day_stem_strength'],
        }

        # 주별 정보 상세 맵핑
        for j in ['year', 'month', 'day', 'time']:
            j_kr = {'year':'년주','month':'월주','day':'일주','time':'시주'}[j]
            stem = p[j]['stem']
            branch = p[j]['branch']
            slots[f"{j_kr}_천간"] = stem
            slots[f"{j_kr}_지지"] = branch
            slots[f"{j_kr}_천간_음"] = to_korean_reading(stem)
            slots[f"{j_kr}_지지_음"] = to_korean_reading(branch)
            slots[f"{j_kr}_천간_오행"] = oh_eng.get(HEAVENLY_OHAENG.get(stem), 'earth')
            slots[f"{j_kr}_지지_오행"] = oh_eng.get(EARTHLY_OHAENG.get(branch), 'earth')
            slots[f"{j_kr}_천간_십성"] = ms[j]['sipseong_stem']
            slots[f"{j_kr}_지지_십성"] = ms[j]['sipseong_branch']
            slots[f"{j_kr}_12운성"] = ms[j]['unseong']
            slots[f"{j_kr}_지장간_HTML"] = "<br>".join([f"{x['stem']}({x['sipseong']})" for x in ms[j]['jijanggan']])
            slots[f"{j_kr}_신살_HTML"] = ms[j]['shinsal'].replace(',', '<br>')

        # 대운 목록 텍스트 필드 (대운 그리드용)
        daeun_lines = []
        for d in daeun_list:
            line = f"{d['ganji']}|{d['age_range']}|{d['year_range']}|{d['unseong']}|{d['shinsal']}|천간:{d.get('sipseong_stem','')}|지지:{d.get('sipseong_branch','')}"
            daeun_lines.append(line)
        slots["대운목록_10기"] = "\n".join(daeun_lines)
        slots["현재대운나이범위"] = daeun_list[0]['age_range'] # 임시: 첫번째 대운

        # 합충 관련 (분석표용)
        hc = res['hapchung']
        slots["천간합목록"] = "\n".join([f"{h['pair']}: {h['result']}" for h in hc['cheongan_hap']]) or "없음"
        slots["지지삼합목록"] = "없음" # 엔진 보강 필요
        slots["지지합목록"] = "\n".join([f"{h['pair']}: {h['result']}" for h in hc['jiji_hap'] if h['type']=='육합']) or "없음"
        slots["지지충목록"] = "\n".join([f"{h['pair']}" for h in hc['chung']]) or "없음"
        slots["지지형목록"] = "\n".join([f"{h['type']}" for h in hc['hyung']]) or "없음"
        
        # 오행 등급
        for oh in ['목','화','토','금','수']:
            slots[f"{oh}등급"] = "보통" # 임시
            
        return slots
    except Exception as e:
        print(f"Error calculating saju slots: {e}")
        import traceback
        traceback.print_exc()
        return {"이름": member['name']}

def slots_to_table_data(slots: dict) -> dict:
    """saju slots dict → 만세력표 JS 데이터 구조로 변환"""
    SIPSEONG_HANJA = {
        '비견': '比肩', '겁재': '劫財', '식신': '食神', '상관': '傷官',
        '편재': '偏財', '정재': '正財', '편관': '偏官', '정관': '正官',
        '편인': '偏印', '정인': '正印'
    }
    UNSEONG_HANJA = {
        '장생': '長生', '목욕': '沐浴', '관대': '冠帶', '건록': '建祿',
        '제왕': '帝旺', '쇠': '衰', '병': '病', '사': '死', '묘': '墓',
        '절': '絶', '태': '胎', '양': '養'
    }

    def html_to_list(html_str):
        return [x.strip() for x in (html_str or '').replace('<br>', '\n').split('\n') if x.strip()] or ['-']

    def make_ju(prefix, is_day=False):
        cheongan_ss = slots.get(f'{prefix}_천간_십성', '')
        jiji_ss     = slots.get(f'{prefix}_지지_십성', '')
        unseong     = slots.get(f'{prefix}_12운성', '')
        return {
            'cheonganSipseong': (
                {'name': slots.get('이름', ''), 'hanja': '일원(나)', 'isPrimary': True}
                if is_day else
                {'name': cheongan_ss, 'hanja': SIPSEONG_HANJA.get(cheongan_ss, ''), 'isPrimary': False}
            ),
            'cheongan': {
                'hanja':  slots.get(f'{prefix}_천간', ''),
                'hangul': slots.get(f'{prefix}_천간_음', ''),
                'ohaeng': slots.get(f'{prefix}_천간_오행', 'earth'),
            },
            'jiji': {
                'hanja':  slots.get(f'{prefix}_지지', ''),
                'hangul': slots.get(f'{prefix}_지지_음', ''),
                'ohaeng': slots.get(f'{prefix}_지지_오행', 'earth'),
            },
            'jijiSipseong': {
                'name': jiji_ss, 'hanja': SIPSEONG_HANJA.get(jiji_ss, ''), 'isPrimary': False
            },
            'sipseongDetail': html_to_list(slots.get(f'{prefix}_지장간_HTML', '')),
            'unseong': {'name': unseong, 'hanja': UNSEONG_HANJA.get(unseong, unseong)},
            'sinsal':  html_to_list(slots.get(f'{prefix}_신살_HTML', '')),
        }

    return {
        'hour':  make_ju('시주'),
        'day':   make_ju('일주', is_day=True),
        'month': make_ju('월주'),
        'year':  make_ju('년주'),
    }


@router.get("/edit/{book_id}")
async def edit_form(request: Request, book_id: int):
    m_id = request.session.get("master_id")
    if not m_id: return RedirectResponse("/login")
    
    book = db.get_book(book_id)
    if not book or book['master_id'] != m_id:
        return templates.TemplateResponse(request, "error.html", {"msg": "접근 권한이 없거나 존재하지 않는 데이터입니다."})
    

    member = db.get_member(book['member_id'])

    # 사주 슬롯 데이터 계산
    slots = get_saju_slots(member)
    saju_slots_json = json.dumps(slots, ensure_ascii=False)

    # 상품별 슬롯 서브디렉토리 결정 (궁합은 compatibility/, 그 외는 saju/)
    _slot_subdir = "compatibility" if book.get("product_type") == "compatibility" else "saju"

    # 텍스트 파일 내용 읽기 》 queue 슬롯 폴더 우선
    content = ""
    _slot_dir = resolve_slot_dir(book, member, slot_subdir=_slot_subdir)
    _slot_result = _slot_dir / "result.txt"
    if _slot_result.exists():
        with open(_slot_result, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    elif book['pdf_path'] and os.path.exists(book['pdf_path']):
        with open(book['pdf_path'], "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            
    # 데이터 무결성 점검
    member_name = member.get('name', '회원') if member else '회원'

    # 선생님이름 + 파트너이름 가져오기 (master.json → DB master → 기본값)
    _teacher_name = '반야선생'
    _partner_name = ''
    _book_year = book.get('book_year', '') or ''
    try:
        _master_json = _slot_dir / "master.json"
        if _master_json.exists():
            import json as _jt
            _mdata = _jt.loads(_master_json.read_text(encoding='utf-8'))
            _teacher_name = _mdata.get('선생님이름', '반야선생')
            # 궁합: partner 이름 추출
            _p = _mdata.get('partner') or {}
            _partner_name = str(_p.get('이름', '') or '').strip()
    except: pass

    # 저장 폴더 경로 (연도 제외한 상품 폴더까지) — PDF 수동 저장 시 안내용
    try:
        _save_folder = str(_slot_dir.parent.resolve())  # 2026/ 의 부모 = compatibility/
    except Exception:
        _save_folder = ''

    try:
        # 상품별 에디터 템플릿 선택 (각 상품 독립 파일, 공용 금지)
        _product_type = book.get("product_type", "saju_full")
        if _product_type == "compatibility":
            _editor_template = "master/edit_compatibility.html"
        elif _product_type == "saju_summary":
            _editor_template = "master/edit_summary.html"
        elif _product_type == "yearly_fortune":
            _editor_template = "master/edit_yearly_fortune.html"
        else:
            _editor_template = "master/edit_ck.html"
        print(f"[edit] book_id={book_id} product_type={_product_type} template={_editor_template}")
        return templates.TemplateResponse(request, _editor_template, {
            "book": book,
            "member": member or {"name": "회원"},
            "member_name": member_name,
            "partner_name": _partner_name,
            "book_year": _book_year,
            "product_type": _product_type,
            "save_folder": _save_folder,
            "teacher_name": _teacher_name,
            "content": content,
            "backup_content": content,
            "saju_slots_json": saju_slots_json
        })
    except Exception as e:
        import traceback
        logging.error(f"Template Rendering Error: {e}")
        logging.error(traceback.format_exc())
        return templates.TemplateResponse(request, "error.html", {"msg": f"보고서 렌더링 중 오류가 발생했습니다: {str(e)}"})

@router.post("/export_pdf/{book_id}")
async def export_pdf(request: Request, book_id: int):
    """편집기 현재 상태를 PDF로 렌더해 의뢰자 폴더(연도 제외)에 저장 · 덮어쓰기"""
    m_id = request.session.get("master_id")
    if not m_id:
        return JSONResponse({"success": False, "msg": "로그인 필요"}, status_code=401)
    book = db.get_book(book_id)
    if not book or book['master_id'] != m_id:
        return JSONResponse({"success": False, "msg": "권한 없음"}, status_code=403)
    member = db.get_member(book.get('member_id'))
    if not member:
        return JSONResponse({"success": False, "msg": "회원 정보 없음"}, status_code=400)

    _save_subdir = "compatibility" if book.get("product_type") == "compatibility" else "saju"
    _sd = find_slot_dir(Path("engine/queue"), book['master_id'], member['name'],
                        str(member.get("phone","") or ""), _save_subdir,
                        book.get('member_id', 0), book.get('book_year'))
    # 저장 폴더: 궁합은 연도 제외(상품 폴더), 그 외는 연도 폴더에 저장
    if book.get("product_type") == "compatibility":
        _save_dir = _sd.parent.resolve()  # .../compatibility/
    else:
        _save_dir = _sd.resolve()           # .../saju/{year}/
    _save_dir.mkdir(parents=True, exist_ok=True)

    # 파트너 이름 추출 (파일명용)
    partner_name = ''
    try:
        _mj = _sd / "master.json"
        if _mj.exists():
            _mdata = json.loads(_mj.read_text(encoding='utf-8'))
            _p = _mdata.get('partner') or {}
            partner_name = str(_p.get('이름', '') or '').strip()
    except Exception:
        pass

    member_name = member.get('name', '회원')
    year = book.get('book_year', '') or ''
    year_suffix = f"_{year}" if year else ''
    _ptype = book.get("product_type", "saju_full")
    if _ptype == "compatibility" and partner_name:
        filename = f"{member_name}♡{partner_name}_궁합분석{year_suffix}.pdf"
    elif _ptype == "saju_summary":
        filename = f"{member_name}_half{year_suffix}.pdf"
    elif _ptype == "yearly_fortune":
        filename = f"{member_name}_{year}년_운세.pdf" if year else f"{member_name}_연간운세.pdf"
    else:  # saju_full 및 기타
        filename = f"{member_name}_full{year_suffix}.pdf"
    # 파일명 안전화 (Windows 금지 문자 \ / : * ? " < > | 제거)
    safe_filename = re.sub(r'[\\/:*?"<>|]', '_', filename)
    pdf_path = _save_dir / safe_filename

    # 세션 쿠키 추출 (Playwright가 로그인된 상태로 편집기 URL 접근)
    session_cookie = request.cookies.get('session', '')
    base_url = str(request.base_url).rstrip('/')
    edit_url = f"{base_url}/saju/edit/{book_id}"

    # Windows 이벤트 루프 제약 우회 → 완전 독립 Python 프로세스로 Playwright 실행
    host = request.url.hostname or 'localhost'
    render_script = Path("engine/pdf_render.py").resolve()
    if not render_script.exists():
        return JSONResponse({"success": False, "msg": f"렌더 스크립트 없음: {render_script}"}, status_code=500)
    cmd = [sys.executable, str(render_script), edit_url, str(pdf_path), session_cookie, host]
    try:
        import asyncio
        def _run():
            return subprocess.run(cmd, capture_output=True, text=True, timeout=120, encoding='utf-8')
        proc = await asyncio.to_thread(_run)
        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout or '').strip()[:300]
            logging.error(f"[export_pdf] subprocess failed: {err}")
            return JSONResponse({"success": False, "msg": f"PDF 생성 실패: {err}"}, status_code=500)
        if not pdf_path.exists():
            return JSONResponse({"success": False, "msg": "PDF 파일이 생성되지 않음"}, status_code=500)
    except subprocess.TimeoutExpired:
        return JSONResponse({"success": False, "msg": "PDF 생성 타임아웃 (120초)"}, status_code=500)
    except Exception as e:
        logging.error(f"[export_pdf] {e}", exc_info=True)
        return JSONResponse({"success": False, "msg": f"PDF 생성 실패: {str(e)[:200]}"}, status_code=500)

    return JSONResponse({
        "success": True,
        "msg": "PDF 저장 완료",
        "path": str(pdf_path),
        "folder": str(_save_dir),
        "filename": safe_filename,
    })


@router.post("/save/{book_id}")
async def save_edit(request: Request, book_id: int, content: str = Form(...)):
    m_id = request.session.get("master_id")
    if not m_id: return JSONResponse({"success": False, "msg": "로그인 필요"})
    
    book = db.get_book(book_id)
    if not book or book['master_id'] != m_id:
        return JSONResponse({"success": False, "msg": "권한 없음"})
    
    # queue 슬롯 폴더의 result.txt에 저장 (단일 경로)
    member = db.get_member(book.get('member_id'))
    if member:
        _save_subdir = "compatibility" if book.get("product_type") == "compatibility" else "saju"
        _sd = find_slot_dir(Path("engine/queue"), book['master_id'], member['name'], str(member.get("phone","") or ""), _save_subdir, book.get('member_id', 0), book.get('book_year'))
        _sr = _sd / "result.txt"
        if _sd.exists():
            # 줄바꿈 정규화 + TABLE 중복 제거
            import re as _re2
            content = content.replace('\r\n', '\n').replace('\r', '\n')
            content = _re2.sub(r'\n{3,}', '\n\n', content)
            _seen_t = set()
            _clean_lines = []
            for _line in content.split('\n'):
                _tm = _re2.match(r'^\[\[TABLE:(.+?)\]\]$', _line.strip())
                if _tm:
                    if _tm.group(1) in _seen_t:
                        continue
                    _seen_t.add(_tm.group(1))
                _clean_lines.append(_line)
            content = '\n'.join(_clean_lines)

            with open(_sr, "w", encoding="utf-8") as sf:
                sf.write(content)


    db.update_book(book_id, {"completed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")})

    return JSONResponse({"success": True})

@router.post("/save_table_layout")
async def save_table_layout_direct(request: Request, content: str = Form(...), member_id: int = Form(...), book_id: int = Form(...)):
    m_id = request.session.get("master_id")
    if not m_id:
        return JSONResponse({"success": False})
    member = db.get_member(member_id)
    if not member:
        return JSONResponse({"success": False})
    book = db.get_book(book_id)
    _tl_subdir = "compatibility" if (book and book.get("product_type") == "compatibility") else "saju"
    _sd = find_slot_dir(Path("engine/queue"), book['master_id'] if book else m_id, member['name'], str(member.get("phone","") or ""), _tl_subdir, member_id, book.get('book_year') if book else None)
    if _sd.exists():
        _lp = _sd / "table_layout.json"
        with open(_lp, "w", encoding="utf-8") as f:
            f.write(content)
    return JSONResponse({"success": True})

@router.post("/template/table_layout")
async def save_table_layout(request: Request, layout: str = Form(...)):
    """TABLE 배치 레이아웃을 마스터 템플릿으로 저장 》 이후 모든 집필에 자동 적용"""
    m_id = request.session.get("master_id")
    if not m_id:
        return JSONResponse({"success": False, "msg": "로그인 필요"})
    import json as _json
    try:
        layout_data = _json.loads(layout)
    except Exception:
        return JSONResponse({"success": False, "msg": "layout JSON 파싱 오류"})

    try:
        layout_dir = Path("output") / m_id
        layout_dir.mkdir(parents=True, exist_ok=True)
        layout_path = layout_dir / "table_template.json"
        with open(layout_path, "w", encoding="utf-8") as f:
            _json.dump(layout_data, f, ensure_ascii=False, indent=2)
        logging.info(f"[{m_id}] table_template.json 저장 ({len(layout_data)}개 항목)")
        return JSONResponse({"success": True, "count": len(layout_data)})
    except Exception as e:
        logging.error(f"table_template.json 저장 실패: {e}")
        return JSONResponse({"success": False, "msg": f"파일 저장 오류: {str(e)}"})


@router.post("/template/save")
async def save_template(request: Request, chapter: str = Form(...), content: str = Form(...)):
    m_id = request.session.get("master_id")
    if not m_id: return JSONResponse({"success": False})
    
    # 마스터 전용 템플릿 폴더 생성 및 저장
    tpl_dir = Path(f"engine/brands/{m_id}/templates")
    tpl_dir.mkdir(parents=True, exist_ok=True)
    
    tpl_file = tpl_dir / f"{chapter}_template.txt"
    with open(tpl_file, "w", encoding="utf-8") as f:
        f.write(content)
        
    return JSONResponse({"success": True})

@router.get("/verify/{member_id}")
async def verify_member(request: Request, member_id: int, year: int = None, product: str = None):
    """사주 해석서 검증 API — 상품별(총본/요약본/궁합/연운) 분기 검증"""
    m_id = get_master_id(request)
    if not m_id:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    member = db.get_member(member_id)
    if not member or member["master_id"] != m_id:
        return JSONResponse({"error": "Forbidden"}, status_code=403)

    member_name = member.get("name", "")

    # ── 상품 타입 결정: 쿼리 우선 → master.json fallback → saju_full 기본값 ──
    product_key, spec = resolve_product_spec(product)
    _sd = find_slot_dir(
        Path("engine/queue"), m_id, member_name,
        str(member.get("phone", "") or ""), spec["result_subdir"],
        member_id, int(year) if year else None
    )
    # master.json의 product_type을 확인해 쿼리가 없거나 불일치하면 보정
    _mj_path = _sd / "master.json"
    if _mj_path.exists():
        try:
            _mj = json.loads(_mj_path.read_text(encoding="utf-8"))
            _mj_pt = (_mj.get("product_type") or "").strip()
            if _mj_pt and _mj_pt in PRODUCT_SPECS and _mj_pt != product_key:
                # 쿼리가 명시적이지 않을 때만 master.json을 따름
                if product is None:
                    product_key, spec = resolve_product_spec(_mj_pt)
                    _sd = find_slot_dir(
                        Path("engine/queue"), m_id, member_name,
                        str(member.get("phone", "") or ""), spec["result_subdir"],
                        member_id, int(year) if year else None
                    )
        except Exception:
            pass

    result_path = _sd / "result.txt"
    tables_dir = _sd / "tables"

    # ── result.txt 읽기 + TABLE 중복 자동 제거 ──
    result_text = ""
    result_lines = []
    if result_path.exists():
        with open(result_path, "r", encoding="utf-8", errors="ignore") as f:
            result_text = f.read()
        # TABLE 중복 자동 제거 (첫 번째만 유지)
        _seen_tables = set()
        _clean_lines = []
        _changed = False
        for _line in result_text.split("\n"):
            _tm = re.match(r'^\[\[TABLE:(.+?)\]\]$', _line.strip())
            if _tm:
                if _tm.group(1) in _seen_tables:
                    _changed = True
                    continue
                _seen_tables.add(_tm.group(1))
            _clean_lines.append(_line)
        if _changed:
            result_text = "\n".join(_clean_lines)
            with open(result_path, "w", encoding="utf-8") as f:
                f.write(result_text)
        result_lines = result_text.split("\n")

    if not result_text.strip():
        return JSONResponse({
            "member_name": member_name,
            "total_checks": 0,
            "errors": [],
            "warnings": [],
            "passed": [],
            "summary": {"error": 0, "warning": 0, "pass": 0},
            "message": "result.txt가 비어 있거나 존재하지 않습니다."
        })

    # ── saju_calc.js 로 truth 데이터 계산 ──
    truth = {}
    try:
        b_time = str(member.get("birth_time", "00:00") or "00:00")
        gender_str = "남" if member["gender"] == "남" else "여"
        lunar_val = "true" if member.get("lunar_yn") else "false"
        leap_val = "true" if member.get("leap_month_yn") else "false"
        name_esc = member_name.replace("'", "\\'")

        script = f"""
const {{전체사주계산}} = require('./saju_calc');
const r = 전체사주계산({{
  이름: '{name_esc}', 성별: '{gender_str}',
  년: {int(member['birth_year'])}, 월: {int(member['birth_month'])}, 일: {int(member['birth_day'])},
  시간: '{b_time}', 음력입력: {lunar_val}, 윤달: {leap_val}
}});
console.log(JSON.stringify({{
  용신: r.용신, 기신: r.기신, 희신: r.희신, 구신: r.구신, 한신: r.한신,
  억부용신: r.억부용신, 조후용신: r.조후용신,
  신강약: r.신강약, 격국명: r.格국명, 일간: r.일간, 일간오행: r.일간오행,
  일간음양: r.일간음양, 일지: r.원국.일주.지지,
  년주천간: r.원국.년주.천간, 년주지지: r.원국.년주.지지,
  월주천간: r.원국.월주.천간, 월주지지: r.원국.월주.지지,
  일주천간: r.원국.일주.천간, 일주지지: r.원국.일주.지지,
  시주천간: r.원국.시주.천간, 시주지지: r.원국.시주.지지,
  오행점수: r.오행점수,
}}));
"""
        proc = subprocess.run(
            ["node", "-e", script],
            cwd=str(Path("engine").resolve()),
            capture_output=True, text=True, timeout=15, encoding="utf-8"
        )
        if proc.returncode == 0 and proc.stdout.strip():
            truth = json.loads(proc.stdout.strip())
    except Exception as e:
        logging.error(f"[verify] saju_calc error: {e}")

    # ── master.json 읽기 ──
    master_json_data = {}
    try:
        _mj = _sd / "master.json"
        if _mj.exists():
            master_json_data = json.loads(_mj.read_text(encoding="utf-8"))
    except Exception:
        pass

    # ── 오행 매핑 ──
    OHAENG_HANJA = {"木": "목", "火": "화", "土": "토", "金": "금", "水": "수"}
    # 원국 8글자 (궁합이면 본인 + partner 모두 허용)
    wonguk_chars = set()
    for k in ["년주천간", "년주지지", "월주천간", "월주지지", "일주천간", "일주지지", "시주천간", "시주지지"]:
        if truth.get(k):
            wonguk_chars.add(truth[k])

    # ── 궁합 전용: partner truth 계산 ──
    partner_truth = {}
    partner_info = {}
    if spec["is_compatibility"]:
        partner_info = master_json_data.get("partner") or {}
        if partner_info and partner_info.get("생년"):
            try:
                _pname = str(partner_info.get("이름", "")).replace("'", "\\'")
                _pgender = "남" if partner_info.get("성별") == "남" else "여"
                _plunar = "true" if partner_info.get("음력입력") else "false"
                _pleap = "true" if partner_info.get("윤달") else "false"
                _ptime = str(partner_info.get("생시") or "00:00")
                _pscript = f"""
const {{전체사주계산}} = require('./saju_calc');
const r = 전체사주계산({{
  이름: '{_pname}', 성별: '{_pgender}',
  년: {int(partner_info['생년'])}, 월: {int(partner_info['생월'])}, 일: {int(partner_info['생일'])},
  시간: '{_ptime}', 음력입력: {_plunar}, 윤달: {_pleap}
}});
console.log(JSON.stringify({{
  용신: r.용신, 기신: r.기신, 희신: r.희신, 신강약: r.신강약, 격국명: r.格국명,
  일간: r.일간, 일간오행: r.일간오행,
  년주천간: r.원국.년주.천간, 년주지지: r.원국.년주.지지,
  월주천간: r.원국.월주.천간, 월주지지: r.원국.월주.지지,
  일주천간: r.원국.일주.천간, 일주지지: r.원국.일주.지지,
  시주천간: r.원국.시주.천간, 시주지지: r.원국.시주.지지,
}}));
"""
                pproc = subprocess.run(
                    ["node", "-e", _pscript],
                    cwd=str(Path("engine").resolve()),
                    capture_output=True, text=True, timeout=15, encoding="utf-8"
                )
                if pproc.returncode == 0 and pproc.stdout.strip():
                    partner_truth = json.loads(pproc.stdout.strip())
                    # partner 원국 글자도 wonguk_chars에 합침 (CHECK 17 허용)
                    for k in ["년주천간", "년주지지", "월주천간", "월주지지",
                              "일주천간", "일주지지", "시주천간", "시주지지"]:
                        if partner_truth.get(k):
                            wonguk_chars.add(partner_truth[k])
            except Exception as e:
                logging.error(f"[verify] partner saju_calc error: {e}")

    # 궁합 전용: 파트너 이름 (라인이 파트너에 관한 것인지 판단에 사용)
    partner_name = str(partner_info.get("이름", "")).strip() if partner_info else ""

    def _is_partner_line(line: str) -> bool:
        """궁합 책에서 이 줄이 파트너를 가리키는가? (주체 검증에서 제외해야 함)"""
        if not spec.get("is_compatibility") or not partner_name:
            return False
        # 파트너 이름이 포함된 줄
        if partner_name in line:
            return True
        # "두 분", "두 사람", "모두", "서로", "상대방" 등 양측 공통 서술
        if re.search(r"두\s*[분사람]|모두|서로|상대방|양방향|쌍방", line):
            return True
        return False

    issues = []

    # ── 장(chapter) 경계 매핑 (상품별 분기) ──
    chapter_ranges = []  # [(line_idx_0based, chapter_label), ...]
    _chapter_regex = spec.get("chapter_regex")
    if _chapter_regex:
        _chap_pat = re.compile(_chapter_regex)
        for ci, cline in enumerate(result_lines):
            m = _chap_pat.search(cline)
            if m:
                # saju_summary는 (\d+) 캡처, saju_full은 (서장|종장|\d+장) 캡처
                grp = m.group(1) if m.lastindex else None
                if grp:
                    label = f"{grp}장" if grp.isdigit() else grp
                    chapter_ranges.append((ci, label))

    ch_label_to_id = {
        '서장': 'ch00', '1장': 'ch01', '2장': 'ch02', '3장': 'ch03',
        '4장': 'ch04', '5장': 'ch05', '6장': 'ch06', '7장': 'ch07',
        '8장': 'ch08', '9장': 'ch09', '10장': 'ch10', '11장': 'ch11',
        '12장': 'ch12', '13장': 'ch13', '14장': 'ch14', '15장': 'ch15',
        '16장': 'ch16', '17장': 'ch17', '18장': 'ch18', '19장': 'ch19',
        '종장': 'ch17',
    }

    def _find_chapter_for_line(line_num_1based):
        """1-based 줄번호 → (chapter_label, chapter_id) 또는 None"""
        idx = line_num_1based - 1
        matched_label = None
        for ci_idx, (start_idx, label) in enumerate(chapter_ranges):
            if idx >= start_idx:
                matched_label = label
            else:
                break
        if matched_label:
            return matched_label, ch_label_to_id.get(matched_label, matched_label)
        return None, None

    def _build_root_causes(category, line_num=None, slot_name="", extra_file=None):
        """에러 카테고리 + 줄번호 → root_causes 리스트 생성"""
        causes = []
        ch_label, ch_id = (None, None)
        if line_num:
            ch_label, ch_id = _find_chapter_for_line(line_num)

        if not ch_id:
            ch_id = "ch00"  # fallback

        gen_file = f"generate_{ch_id}.js"
        db_file = f"{ch_id}_db.js"
        tpl_file = f"{ch_id}_template.txt"

        if category in ("기신불일치", "용신불일치", "희신불일치", "구신불일치", "한신불일치"):
            신_name = category.replace("불일치", "")
            causes.append({
                "file": gen_file,
                "line_hint": f"{신_name}오행 슬롯 정의",
                "action": f"결과.{신_name} 참조가 올바른지 확인"
            })
            causes.append({
                "file": db_file,
                "line_hint": f"{{{{{신_name}오행}}}} 사용 위치",
                "action": f"하드코딩된 오행 값이 있는지 확인"
            })
        elif category == "신강약불일치":
            causes.append({
                "file": "generate_ch00.js",
                "line_hint": "신강약단 슬롯 정의 (극신강/극신약 처리)",
                "action": "결과.신강약 참조가 올바른지 확인"
            })
            causes.append({
                "file": db_file,
                "line_hint": "신강/신약 하드코딩 위치",
                "action": "하드코딩된 신강 또는 신약이 있는지 확인"
            })
        elif category == "격국불일치":
            causes.append({
                "file": db_file,
                "line_hint": "격국명 하드코딩 위치",
                "action": "하드코딩된 격국명(정재격 등)이 있는지 확인"
            })
            causes.append({
                "file": "generate_ch05.js",
                "line_hint": "격국명 슬롯 정의",
                "action": "격국명 슬롯이 올바르게 설정되는지 확인"
            })
        elif category == "슬롯미치환":
            if slot_name:
                causes.append({
                    "file": gen_file,
                    "line_hint": f"{{{{{slot_name}}}}} 슬롯을 생성하는 위치",
                    "action": f"해당 슬롯이 누락되었거나 조건부로 생략되는지 확인"
                })
                if slot_name in ("선생님이름", "브랜드명", "전화번호"):
                    causes.append({
                        "file": "master.json",
                        "line_hint": f"{slot_name} 필드",
                        "action": "master.json에 값이 정의되어 있는지 확인"
                    })
                else:
                    causes.append({
                        "file": tpl_file,
                        "line_hint": f"{{{{{slot_name}}}}} 템플릿 사용 위치",
                        "action": "템플릿에서 해당 슬롯이 올바르게 사용되는지 확인"
                    })
        elif category == "표5신불일치":
            causes.append({
                "file": "generate_사주원국요약.js",
                "line_hint": "5신 데이터 소스",
                "action": "요약표 생성 시 5신 값 참조가 올바른지 확인"
            })
        elif category == "병신잔재":
            causes.append({
                "file": db_file,
                "line_hint": "병신(病神) 텍스트 잔재",
                "action": "'병신(病神)'을 '기신(忌神)'으로 수정"
            })
            causes.append({
                "file": tpl_file,
                "line_hint": "병신(病神) 텍스트 잔재",
                "action": "템플릿에서도 '병신(病神)'이 남아 있는지 확인"
            })
        elif category == "일간불일치":
            causes.append({
                "file": gen_file,
                "line_hint": "일간 슬롯 정의",
                "action": "결과.일간 참조가 올바른지 확인"
            })
            causes.append({
                "file": db_file,
                "line_hint": "일간 하드코딩 위치",
                "action": "하드코딩된 천간 값이 있는지 확인"
            })
        elif category == "음양불일치":
            causes.append({
                "file": gen_file,
                "line_hint": "음양 슬롯 정의",
                "action": "결과.일간음양 참조가 올바른지 확인"
            })
        elif category == "반야선생하드코딩":
            causes.append({
                "file": "master.json",
                "line_hint": "선생님이름 필드",
                "action": "master.json에 선생님이름이 올바르게 설정되어 있는지 확인"
            })
            causes.append({
                "file": gen_file,
                "line_hint": "{{선생님이름}} 슬롯 치환",
                "action": "선생님이름 슬롯이 master.json에서 올바르게 읽히는지 확인"
            })
            causes.append({
                "file": db_file,
                "line_hint": "'반야선생' 하드코딩 위치",
                "action": "DB 텍스트에 '반야선생'이 하드코딩되어 있는지 확인"
            })
        elif category == "표파일누락":
            causes.append({
                "file": gen_file,
                "line_hint": "[[TABLE:...]] 태그 삽입 위치",
                "action": "표 이름이 올바른지, 표 생성 함수가 해당 파일을 만드는지 확인"
            })

        if extra_file:
            causes.append(extra_file)

        # 장 정보 추가
        if ch_label and causes:
            for c in causes:
                c["chapter"] = ch_label

        return causes

    def add_issue(level, category, line=None, text="", expected="", actual="", message="", root_causes=None):
        issue = {
            "level": level,
            "category": category,
            "line": line,
            "text": text[:200] if text else "",
            "expected": expected,
            "actual": actual,
            "message": message
        }
        if root_causes is not None:
            issue["root_causes"] = root_causes
        elif level in ("error", "warning") and line:
            issue["root_causes"] = _build_root_causes(category, line)
        issues.append(issue)

    # ═══════════════════════════════════════════════
    # CHECK 1: 슬롯 미치환 ({{...}} 잔존)
    # ═══════════════════════════════════════════════
    check1_found = False
    for i, line in enumerate(result_lines, 1):
        for m in re.finditer(r'\{\{(.+?)\}\}', line):
            check1_found = True
            add_issue("error", "슬롯미치환", i, line.strip(), "", m.group(0),
                      f"미치환 슬롯 '{{{{{m.group(1)}}}}}' 발견",
                      root_causes=_build_root_causes("슬롯미치환", i, slot_name=m.group(1)))
    if not check1_found:
        add_issue("pass", "슬롯미치환", message="미치환 슬롯 없음")

    # ═══════════════════════════════════════════════
    # CHECK 2: 빈 슬롯 (": " 뒤 공백)
    # ═══════════════════════════════════════════════
    check2_found = False
    for i, line in enumerate(result_lines, 1):
        stripped = line.rstrip()
        if re.search(r':\s*$', stripped) and len(stripped) > 2 and not stripped.startswith("http"):
            # 마크업 기호 줄(☯, ✺ 등)은 제외
            if not re.match(r'^\s*[☯✺✦★◎▸◈※]', stripped):
                # 다음 1~2줄에 내용이 이어지는 패턴은 제외
                next1 = result_lines[i].strip() if i < len(result_lines) else ""
                next2 = result_lines[i+1].strip() if i+1 < len(result_lines) else ""
                has_content_after = (next1 and not next1.endswith(":")) or (not next1 and next2 and not next2.endswith(":"))
                if has_content_after:
                    continue
                check2_found = True
                add_issue("warning", "빈슬롯", i, stripped, "", "",
                          "값이 비어 있는 항목 발견")
    if not check2_found:
        add_issue("pass", "빈슬롯", message="빈 슬롯 없음")

    # ═══════════════════════════════════════════════
    # CHECK 3: 기신 오행 불일치
    # ═══════════════════════════════════════════════
    truth_gisin = truth.get("기신", "")
    truth_gisin_kr = OHAENG_HANJA.get(truth_gisin, truth_gisin)
    check3_found = False
    if truth_gisin:
        gisin_pattern = re.compile(r'기신[^가-힣]*[(:：]\s*([木火土金水목화토금수])')
        for i, line in enumerate(result_lines, 1):
            if _is_partner_line(line):
                continue
            for m in gisin_pattern.finditer(line):
                actual_oh = m.group(1)
                actual_kr = OHAENG_HANJA.get(actual_oh, actual_oh)
                if actual_kr != truth_gisin_kr and actual_oh != truth_gisin:
                    check3_found = True
                    add_issue("error", "기신불일치", i, line.strip(),
                              f"{truth_gisin}({truth_gisin_kr})", actual_oh,
                              f"기신이 {truth_gisin}이어야 하는데 {actual_oh}(으)로 기술됨")
        # 忌神 한자 패턴도 검사
        gisin_hanja_pat = re.compile(r'忌神[^가-힣]*[(:：]\s*([木火土金水목화토금수])')
        for i, line in enumerate(result_lines, 1):
            if _is_partner_line(line):
                continue
            for m in gisin_hanja_pat.finditer(line):
                actual_oh = m.group(1)
                actual_kr = OHAENG_HANJA.get(actual_oh, actual_oh)
                if actual_kr != truth_gisin_kr and actual_oh != truth_gisin:
                    check3_found = True
                    add_issue("error", "기신불일치", i, line.strip(),
                              f"{truth_gisin}({truth_gisin_kr})", actual_oh,
                              f"忌神이 {truth_gisin}이어야 하는데 {actual_oh}(으)로 기술됨")
    if not check3_found:
        add_issue("pass", "기신불일치", message="기신 오행 일치 확인됨" if truth_gisin else "기신 데이터 없음 (스킵)")

    # ═══════════════════════════════════════════════
    # CHECK 4: 용신 오행 불일치
    # ═══════════════════════════════════════════════
    truth_yong = truth.get("용신", "")
    truth_yong_kr = OHAENG_HANJA.get(truth_yong, truth_yong)
    check4_found = False
    if truth_yong:
        yong_pattern = re.compile(r'용신[^가-힣]*[(:：]\s*([木火土金水목화토금수])')
        for i, line in enumerate(result_lines, 1):
            # 조후용신/억부용신은 최종용신과 다를 수 있으므로 제외
            if re.search(r'조후.*용신|억부.*용신', line):
                continue
            # 궁합: 파트너 관련 줄은 주체 용신 검증에서 제외
            if _is_partner_line(line):
                continue
            for m in yong_pattern.finditer(line):
                actual_oh = m.group(1)
                actual_kr = OHAENG_HANJA.get(actual_oh, actual_oh)
                if actual_kr != truth_yong_kr and actual_oh != truth_yong:
                    check4_found = True
                    add_issue("error", "용신불일치", i, line.strip(),
                              f"{truth_yong}({truth_yong_kr})", actual_oh,
                              f"용신이 {truth_yong}이어야 하는데 {actual_oh}(으)로 기술됨")
    if not check4_found:
        add_issue("pass", "용신불일치", message="용신 오행 일치 확인됨" if truth_yong else "용신 데이터 없음 (스킵)")

    # ═══════════════════════════════════════════════
    # CHECK 5: 신강약 불일치
    # ═══════════════════════════════════════════════
    truth_strength = truth.get("신강약", "")
    check5_found = False
    if truth_strength:
        # 신강 계열: 극신강, 신강, 중화형신강
        # 신약 계열: 극신약, 신약
        is_strong = truth_strength in ("극신강", "신강", "중화형신강")
        # 개인 맥락에서 신강/신약 판단 오류 찾기
        for i, line in enumerate(result_lines, 1):
            stripped = line.strip()
            # "님" 또는 사람이름이 포함된 줄에서 신강/신약 언급 검사
            personal_context = member_name in stripped or "님" in stripped or "본인" in stripped or "사주" in stripped
            if not personal_context:
                continue
            # 교육적 맥락 제외: 양쪽을 동시에 설명하거나 일반론을 기술하는 줄
            is_educational = (("신강" in stripped and "신약" in stripped)
                              or re.search(r'신강한\s*(경우|사주라면|사주는)|신약한\s*(경우|사주라면|사주는)', stripped)
                              or re.search(r'(신강이든|신약이든|신강약에)', stripped)
                              or re.search(r'(신약|신강)\s*사주에서\s*(좋은|주의)', stripped)
                              or re.search(r'(신약|신강)\s*사주의\s*(대운|직업|전략)', stripped)
                              or re.search(r'(신약|신강)\s*사주에게', stripped)
                              or re.search(r'(신약|신강)하면\s', stripped)
                              or re.search(r'(신약|신강)\s*기질은', stripped)
                              or re.search(r'신강\(身强\)[과와·].*신약\(身弱\)|신약\(身弱\)[과와·].*신강\(身强\)', stripped)
                              or re.search(r'★\s*(신약|신강)', stripped))
            if is_educational:
                continue
            if is_strong and re.search(r'신약', stripped) and not re.search(r'극신약|신약한|신약자|신약인|신약\s*사주에서|신약\s*사주를|신강약|조견|일람|일반적', stripped):
                check5_found = True
                add_issue("error", "신강약불일치", i, stripped, truth_strength, "신약",
                          f"신강약이 '{truth_strength}'인데 '신약'으로 기술됨")
            elif not is_strong and re.search(r'(?<!극)신강', stripped) and not re.search(r'극신강|신강한|신강자|신강인|신강\s*사주를|신강약|조견|일람|일반적', stripped):
                check5_found = True
                add_issue("error", "신강약불일치", i, stripped, truth_strength, "신강",
                          f"신강약이 '{truth_strength}'인데 '신강'으로 기술됨")
    if not check5_found:
        add_issue("pass", "신강약불일치", message="신강약 일치 확인됨" if truth_strength else "신강약 데이터 없음 (스킵)")

    # ═══════════════════════════════════════════════
    # CHECK 6: 격국 불일치
    # ═══════════════════════════════════════════════
    truth_gyeok = truth.get("격국명", "")
    check6_found = False
    if truth_gyeok:
        # 격국명에서 핵심 키워드 추출 (예: "편관격(偏官格)" → "편관격")
        gyeok_core = re.sub(r'\(.*?\)', '', truth_gyeok).strip()
        gyeok_list = ["비견격", "겁재격", "식신격", "상관격", "편재격", "정재격",
                      "편관격", "정관격", "편인격", "정인격", "건록격", "양인격", "잡기격"]
        wrong_gyeoks = [g for g in gyeok_list if g != gyeok_core]
        for i, line in enumerate(result_lines, 1):
            stripped = line.strip()
            # 개인 맥락 검사
            personal = member_name in stripped or "님" in stripped or "본인" in stripped
            if not personal:
                continue
            # 궁합: 파트너 관련 줄은 주체 격국 검증에서 제외
            if _is_partner_line(stripped):
                continue
            for wg in wrong_gyeoks:
                if wg in stripped and gyeok_core not in stripped:
                    check6_found = True
                    add_issue("error", "격국불일치", i, stripped, gyeok_core, wg,
                              f"격국이 '{gyeok_core}'인데 '{wg}'(으)로 기술됨")
                    break
    if not check6_found:
        add_issue("pass", "격국불일치", message="격국 일치 확인됨" if truth_gyeok else "격국 데이터 없음 (스킵)")

    # ═══════════════════════════════════════════════
    # CHECK 7: 일간 불일치
    # ═══════════════════════════════════════════════
    truth_ilgan = truth.get("일간", "")
    check7_found = False
    if truth_ilgan:
        all_stems = {"甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"}
        wrong_stems = all_stems - {truth_ilgan}
        ilgan_pat = re.compile(r'일간[^가-힣]*[(:：은는이가의]\s*([甲乙丙丁戊己庚辛壬癸])')
        for i, line in enumerate(result_lines, 1):
            for m in ilgan_pat.finditer(line):
                found_stem = m.group(1)
                if found_stem in wrong_stems:
                    check7_found = True
                    add_issue("error", "일간불일치", i, line.strip(), truth_ilgan, found_stem,
                              f"일간이 '{truth_ilgan}'인데 '{found_stem}'(으)로 기술됨")
    if not check7_found:
        add_issue("pass", "일간불일치", message="일간 일치 확인됨" if truth_ilgan else "일간 데이터 없음 (스킵)")

    # ═══════════════════════════════════════════════
    # CHECK 8: 표 파일 존재 확인
    # ═══════════════════════════════════════════════
    table_tags = re.findall(r'\[\[TABLE:(.+?)\]\]', result_text)
    check8_found = False
    # 표 태그 줄번호 매핑
    table_line_map = {}
    for ti, tline in enumerate(result_lines, 1):
        tm = re.search(r'\[\[TABLE:(.+?)\]\]', tline)
        if tm:
            table_line_map[tm.group(1)] = ti
    for tname in table_tags:
        tpath = tables_dir / f"{tname}.html"
        # common 폴더도 체크
        common_path = Path("engine/tables/common") / f"{tname}.html"
        current_path = Path("engine/tables/current") / f"{tname}.html"
        if not tpath.exists() and not common_path.exists() and not current_path.exists():
            check8_found = True
            t_line = table_line_map.get(tname)
            add_issue("warning", "표파일누락", line=t_line, text=f"[[TABLE:{tname}]]", expected=f"{tname}.html",
                      message=f"표 파일 '{tname}.html'이 존재하지 않음",
                      root_causes=_build_root_causes("표파일누락", t_line))
    # 상품별 필수 표 누락 검사 (본문의 태그로 탐지되지 않는 경우 대비)
    _missing_required = []
    for tname in spec.get("required_tables", []):
        if tname in table_tags:
            continue
        tpath = tables_dir / f"{tname}.html"
        common_path = Path("engine/tables/common") / f"{tname}.html"
        current_path = Path("engine/tables/current") / f"{tname}.html"
        if not tpath.exists() and not common_path.exists() and not current_path.exists():
            _missing_required.append(tname)
    if _missing_required:
        check8_found = True
        add_issue("error", "필수표누락",
                  expected=",".join(_missing_required),
                  message=f"[{spec['label']}] 필수 표 누락: {', '.join(_missing_required)}")
    if not check8_found:
        add_issue("pass", "표파일누락",
                  message=f"[{spec['label']}] 모든 표 파일 존재 확인됨 ({len(table_tags)}개 + 필수 {len(spec.get('required_tables',[]))}개)")

    # ═══════════════════════════════════════════════
    # CHECK 9: 표 중복
    # ═══════════════════════════════════════════════
    from collections import Counter
    tag_counts = Counter(table_tags)
    check9_found = False
    for tname, cnt in tag_counts.items():
        if cnt > 1:
            check9_found = True
            add_issue("warning", "표중복", text=f"[[TABLE:{tname}]]", actual=str(cnt),
                      message=f"'{tname}' 표가 {cnt}회 중복 삽입됨")
    if not check9_found:
        add_issue("pass", "표중복", message="표 중복 없음")

    # ═══════════════════════════════════════════════
    # CHECK 10: 표 내 5신 데이터 확인
    # ═══════════════════════════════════════════════
    check10_found = False
    summary_table = tables_dir / "사주원국요약표.html"
    if summary_table.exists() and truth_gisin:
        try:
            thtml = summary_table.read_text(encoding="utf-8", errors="ignore")
            # HTML 태그 제거 후 텍스트만 검사 (태그 내 class명 등 오탐 방지)
            thtml_text = re.sub(r'<[^>]+>', ' ', thtml)
            for label, truth_val in [("기신", truth_gisin), ("한신", truth.get("한신", ""))]:
                if not truth_val:
                    continue
                tv_kr = OHAENG_HANJA.get(truth_val, truth_val)
                # "忌神(기신)" 뒤 가까운 위치에서 오행 값 검사
                pat = re.compile(r'忌神\s*\(' + label + r'\)\s*[^木火土金水목화토금수]{0,30}([木火土金水목화토금수])' if label == "기신"
                                 else r'閑神\s*\(' + label + r'\)\s*[^木火土金水목화토금수]{0,30}([木火土金水목화토금수])')
                for m in pat.finditer(thtml_text):
                    found = m.group(1)
                    found_kr = OHAENG_HANJA.get(found, found)
                    if found_kr != tv_kr and found != truth_val:
                        check10_found = True
                        add_issue("error", "표5신불일치", text=f"사주원국요약표 > {label}",
                                  expected=truth_val, actual=found,
                                  message=f"요약표의 {label}이 {truth_val}이어야 하는데 {found}(으)로 표시됨",
                                  root_causes=_build_root_causes("표5신불일치"))
        except Exception:
            pass
    if not check10_found:
        add_issue("pass", "표5신불일치", message="표 내 5신 데이터 일치 확인됨" if summary_table.exists() else "사주원국요약표 없음 (스킵)")

    # ═══════════════════════════════════════════════
    # CHECK 11: "없음" 플레이스홀더
    # ═══════════════════════════════════════════════
    check11_found = False
    placeholder_pat = re.compile(r'(?:초년|중년|말년|운세|시기|특징|방향|성격|재물|건강|직업)[^:：]*[：:]\s*없음')
    for i, line in enumerate(result_lines, 1):
        if placeholder_pat.search(line):
            check11_found = True
            add_issue("warning", "없음플레이스홀더", i, line.strip(),
                      message="값이 '없음'인 항목 — 내용 보충 필요")
    if not check11_found:
        add_issue("pass", "없음플레이스홀더", message="'없음' 플레이스홀더 없음")

    # ═══════════════════════════════════════════════
    # CHECK 12: 병신(病神) 잔재
    # ═══════════════════════════════════════════════
    check12_found = False
    for i, line in enumerate(result_lines, 1):
        # 병신(病神) 검출하되, 丙申(병신) 간지는 제외
        if "병신" in line or "病神" in line:
            # 丙申 맥락 제외: "丙申" 또는 "병신일주" 등 간지 맥락
            is_byungsin_ganji = "丙申" in line or re.search(r'병신[일월년시]주', line)
            if not is_byungsin_ganji and ("病神" in line or re.search(r'병신\s*[(:：]', line) or "병신의" in line or "병신을" in line or "병신은" in line):
                check12_found = True
                add_issue("warning", "병신잔재", i, line.strip(),
                          expected="기신(忌神)", actual="병신(病神)",
                          message="'병신(病神)'이 '기신(忌神)'으로 수정되어야 함")
    if not check12_found:
        add_issue("pass", "병신잔재", message="병신(病神) 잔재 없음")

    # ═══════════════════════════════════════════════
    # CHECK 13: 음양 불일치
    # ═══════════════════════════════════════════════
    truth_eumyang = truth.get("일간음양", "")
    check13_found = False
    if truth_eumyang:
        opposite = "음" if truth_eumyang == "양" else "양"
        opposite_hanja = "陰" if truth_eumyang == "양" else "陽"
        correct_hanja = "陽" if truth_eumyang == "양" else "陰"
        eumyang_pat = re.compile(
            r'(?:일간|' + re.escape(member_name) + r'|님)[^.。\n]{0,20}' +
            r'(' + re.escape(opposite) + r'\s*[((]' + re.escape(opposite_hanja) + r'|' +
            re.escape(opposite_hanja) + r')'
        )
        for i, line in enumerate(result_lines, 1):
            # 신살 이름(음양차착살 등)은 제외
            if "음양차착" in line or "陰陽差錯" in line:
                continue
            # 궁합: 파트너 관련 줄 또는 양측 공통 설명문은 주체 음양 검증에서 제외
            if _is_partner_line(line):
                continue
            if eumyang_pat.search(line):
                check13_found = True
                add_issue("warning", "음양불일치", i, line.strip(),
                          expected=f"{truth_eumyang}({correct_hanja})",
                          actual=f"{opposite}({opposite_hanja})",
                          message=f"일간 음양이 '{truth_eumyang}'인데 '{opposite}'(으)로 기술됨")
    if not check13_found:
        add_issue("pass", "음양불일치", message="음양 일치 확인됨" if truth_eumyang else "음양 데이터 없음 (스킵)")

    # ═══════════════════════════════════════════════
    # CHECK 14: 빈줄 과다 (3줄 이상 연속)
    # ═══════════════════════════════════════════════
    check14_found = False
    consecutive_empty = 0
    empty_start = 0
    for i, line in enumerate(result_lines, 1):
        if not line.strip():
            if consecutive_empty == 0:
                empty_start = i
            consecutive_empty += 1
        else:
            if consecutive_empty >= 4:
                check14_found = True
                add_issue("warning", "빈줄과다", empty_start, f"(빈줄 {consecutive_empty}개 연속)",
                          message=f"{empty_start}행부터 빈줄 {consecutive_empty}개 연속")
            consecutive_empty = 0
    if consecutive_empty >= 3:
        check14_found = True
        add_issue("warning", "빈줄과다", empty_start, f"(빈줄 {consecutive_empty}개 연속)",
                  message=f"{empty_start}행부터 빈줄 {consecutive_empty}개 연속")
    if not check14_found:
        add_issue("pass", "빈줄과다", message="빈줄 과다 없음")

    # ═══════════════════════════════════════════════
    # CHECK 15: 연속 TABLE
    # ═══════════════════════════════════════════════
    check15_found = False
    prev_was_table = False
    prev_table_name = ""
    for i, line in enumerate(result_lines, 1):
        tmatch = re.match(r'^\[\[TABLE:(.+?)\]\]$', line.strip())
        if tmatch:
            cur_name = tmatch.group(1)
            # 운세달력 월별 표는 의도적으로 연속 배치
            is_calendar = ("운세달력" in prev_table_name and "운세달력" in cur_name)
            if prev_was_table and not is_calendar:
                check15_found = True
                add_issue("warning", "연속TABLE", i, line.strip(),
                          message=f"'{prev_table_name}'과 '{cur_name}' 사이에 본문 텍스트 없음")
            prev_was_table = True
            prev_table_name = cur_name
        elif line.strip():
            prev_was_table = False
            prev_table_name = ""
        # 빈줄은 prev_was_table 유지
    if not check15_found:
        add_issue("pass", "연속TABLE", message="연속 TABLE 없음")

    # ═══════════════════════════════════════════════
    # CHECK 16: "반야선생" 하드코딩 확인 (본문 + 표 HTML)
    # ═══════════════════════════════════════════════
    teacher_name = master_json_data.get("선생님이름", "반야선생")
    check16_found = False
    if teacher_name and teacher_name != "반야선생":
        # 본문 검사
        for i, line in enumerate(result_lines, 1):
            if "반야선생" in line:
                check16_found = True
                add_issue("warning", "반야선생하드코딩", i, line.strip(),
                          expected=teacher_name, actual="반야선생",
                          message=f"선생님이름이 '{teacher_name}'인데 '반야선생'이 남아 있음")
        # 표 HTML 검사
        if tables_dir.exists():
            for tfile in tables_dir.iterdir():
                if tfile.suffix == '.html':
                    try:
                        thtml = tfile.read_text(encoding="utf-8", errors="ignore")
                        if "반야선생" in thtml:
                            check16_found = True
                            add_issue("warning", "반야선생하드코딩", text=f"표: {tfile.name}",
                                      expected=teacher_name, actual="반야선생",
                                      message=f"표 '{tfile.name}'에 '반야선생' 하드코딩 발견",
                                      root_causes=_build_root_causes("반야선생하드코딩"))
                    except Exception:
                        pass
    if not check16_found:
        msg = "반야선생 하드코딩 없음 (본문+표)" if teacher_name != "반야선생" else "선생님이름이 '반야선생' (스킵)"
        add_issue("pass", "반야선생하드코딩", message=msg)

    # ═══════════════════════════════════════════════
    # CHECK 17: 다른 사람 데이터 혼입
    # ═══════════════════════════════════════════════
    check17_found = False
    if wonguk_chars:
        all_stems_set = {"甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"}
        all_branches_set = {"子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"}
        for i, line in enumerate(result_lines, 1):
            if "원국" in line and ("님" in line or member_name in line):
                # 이 줄 근처에서 원국 글자가 아닌 간지 조합 검출
                ganji_in_line = set()
                for ch in line:
                    if ch in all_stems_set or ch in all_branches_set:
                        ganji_in_line.add(ch)
                foreign = ganji_in_line - wonguk_chars
                if len(foreign) >= 3:
                    check17_found = True
                    add_issue("warning", "데이터혼입", i, line.strip(),
                              expected="원국: " + " ".join(sorted(wonguk_chars)),
                              actual="발견: " + " ".join(sorted(foreign)),
                              message=f"원국 글자가 아닌 간지({', '.join(sorted(foreign))})가 원국 맥락에서 발견됨")
    if not check17_found:
        add_issue("pass", "데이터혼입", message="데이터 혼입 없음" if wonguk_chars else "원국 데이터 없음 (스킵)")

    # ═══════════════════════════════════════════════
    # CHECK 18: 장(章) 누락 확인 (상품별 분기)
    # ═══════════════════════════════════════════════
    expected_chapters = spec.get("expected_chapters") or []
    if expected_chapters and _chapter_regex:
        found_chapters = {label for _, label in chapter_ranges}
        missing = [ch for ch in expected_chapters if ch not in found_chapters]
        if missing:
            add_issue("error", "장누락",
                      message=f"[{spec['label']}] 누락된 장: {', '.join(missing)}")
        else:
            add_issue("pass", "장누락",
                      message=f"[{spec['label']}] 모든 장 존재 확인됨 ({len(found_chapters)}개)")
    else:
        add_issue("pass", "장누락", message=f"[{spec['label']}] 장 구조 검증 대상 아님 (스킵)")

    # ═══════════════════════════════════════════════
    # CHECK 19: 생년월일 일치
    # ═══════════════════════════════════════════════
    check19_found = False
    birth_year = str(member.get("birth_year", ""))
    birth_month = str(member.get("birth_month", ""))
    birth_day = str(member.get("birth_day", ""))
    if birth_year and birth_month and birth_day:
        found_birth = False
        # DB 생년월일(음력일 수 있음) + 양력 변환 날짜 모두 확인
        search_dates = [(birth_year, birth_month, birth_day)]
        # truth 데이터에서 양력 정보 추출 시도
        try:
            solar_script = f"""
const {{전체사주계산}} = require('./saju_calc');
const r = 전체사주계산({{이름:'test',년:{int(birth_year)},월:{int(birth_month)},일:{int(birth_day)},
  시간:'00:00',음력입력:{'true' if member.get('lunar_yn') else 'false'},윤달:{'true' if member.get('leap_month_yn') else 'false'}}});
console.log(r.양력정보||'');
"""
            sp = subprocess.run(["node","-e",solar_script], cwd=str(Path("engine").resolve()),
                                capture_output=True, text=True, timeout=10, encoding="utf-8")
            if sp.returncode == 0 and sp.stdout.strip():
                # "1968년 2월 28일" 형식 파싱
                sm = re.search(r'(\d+)년\s*(\d+)월\s*(\d+)일', sp.stdout.strip())
                if sm:
                    search_dates.append((sm.group(1), sm.group(2), sm.group(3)))
        except Exception:
            pass
        # 본문 검색
        for sy, sm2, sd in search_dates:
            for line in result_lines:
                if sy in line and f"{sm2}월" in line and f"{sd}일" in line:
                    found_birth = True
                    break
            if found_birth:
                break
        # 표 HTML 검색 (인적사항표, 명식표 등)
        if not found_birth and tables_dir.exists():
            for tfile in tables_dir.iterdir():
                if tfile.suffix == '.html':
                    try:
                        thtml = tfile.read_text(encoding="utf-8", errors="ignore")
                        for sy, sm2, sd in search_dates:
                            if sy in thtml and sm2 in thtml and sd in thtml:
                                found_birth = True
                                break
                    except Exception:
                        pass
                if found_birth:
                    break
        if not found_birth:
            check19_found = True
            add_issue("warning", "생년월일불일치", message=f"DB 생년월일({birth_year}년 {birth_month}월 {birth_day}일)이 본문에서 발견되지 않음")
    if not check19_found:
        add_issue("pass", "생년월일불일치", message="생년월일 일치 확인됨" if birth_year else "생년월일 데이터 없음 (스킵)")

    # ═══════════════════════════════════════════════
    # CHECK 20: 희신 오행 불일치
    # ═══════════════════════════════════════════════
    truth_huisin = truth.get("희신", "")
    truth_huisin_kr = OHAENG_HANJA.get(truth_huisin, truth_huisin)
    check20_found = False
    if truth_huisin:
        hui_pattern = re.compile(r'희신[^가-힣]*[(:：]\s*([木火土金水목화토금수])')
        for i, line in enumerate(result_lines, 1):
            for m in hui_pattern.finditer(line):
                actual_oh = m.group(1)
                actual_kr = OHAENG_HANJA.get(actual_oh, actual_oh)
                if actual_kr != truth_huisin_kr and actual_oh != truth_huisin:
                    check20_found = True
                    add_issue("error", "희신불일치", i, line.strip(),
                              f"{truth_huisin}({truth_huisin_kr})", actual_oh,
                              f"희신이 {truth_huisin}이어야 하는데 {actual_oh}(으)로 기술됨")
    if not check20_found:
        add_issue("pass", "희신불일치", message="희신 오행 일치 확인됨" if truth_huisin else "희신 데이터 없음 (스킵)")

    # ═══════════════════════════════════════════════
    # CHECK 21: 총 글자수 범위 (상품별 분기)
    # ═══════════════════════════════════════════════
    char_count = len(result_text)
    _min_c = spec["min_chars"]
    _max_c = spec["max_chars"]
    _lbl = spec["label"]
    if char_count < _min_c:
        add_issue("warning", "글자수부족",
                  message=f"[{_lbl}] 총 글자수 {char_count:,}자 — 최소 {_min_c:,}자 미만")
    elif char_count > _max_c:
        add_issue("warning", "글자수초과",
                  message=f"[{_lbl}] 총 글자수 {char_count:,}자 — 최대 {_max_c:,}자 초과")
    else:
        add_issue("pass", "글자수범위",
                  message=f"[{_lbl}] 총 글자수 {char_count:,}자 (정상 범위 {_min_c:,}~{_max_c:,})")

    # ═══════════════════════════════════════════════
    # CHECK 22: 커버 존재 및 이름 확인 (상품별 분기)
    # ═══════════════════════════════════════════════
    # 궁합은 cover.html이 슬롯 루트에, 나머지는 tables/ 아래
    if spec["is_compatibility"]:
        cover_path = _sd / "cover.html"
    else:
        cover_path = tables_dir / "cover.html"
    check22_found = False
    if not cover_path.exists():
        check22_found = True
        add_issue("warning", "커버누락", message=f"[{spec['label']}] cover.html이 존재하지 않음")
    else:
        try:
            cover_html = cover_path.read_text(encoding="utf-8", errors="ignore")
            if member_name and member_name not in cover_html:
                check22_found = True
                add_issue("warning", "커버이름불일치",
                          message=f"[{spec['label']}] cover.html에 '{member_name}' 이름이 없음")
            # 궁합: partner 이름도 커버에 있어야 함
            if spec["is_compatibility"]:
                _pname = partner_info.get("이름", "")
                if _pname and _pname not in cover_html:
                    check22_found = True
                    add_issue("warning", "커버파트너이름불일치",
                              message=f"[{spec['label']}] cover.html에 파트너 '{_pname}' 이름이 없음")
        except Exception:
            pass
    if not check22_found:
        add_issue("pass", "커버확인", message=f"[{spec['label']}] 커버 존재 및 이름 확인됨")

    # ═══════════════════════════════════════════════
    # CHECK 33: 커버 일주동물 이미지 확인 (총본/요약본/연운 전용)
    # ═══════════════════════════════════════════════
    check33_found = False
    if not spec.get("has_cover_animal"):
        add_issue("pass", "커버동물이미지", message=f"[{spec['label']}] 일주동물 검증 대상 아님 (스킵)")
    elif cover_path.exists():
        try:
            cover_html = cover_path.read_text(encoding="utf-8", errors="ignore")
            has_base64_img = "base64" in cover_html and "animal-img" in cover_html
            has_placeholder = "animal-placeholder" in cover_html
            if has_placeholder and not has_base64_img:
                check33_found = True
                ilji = truth.get("일주지지", "")
                ilgan = truth.get("일주천간", "")
                add_issue("error", "커버동물이미지누락",
                          text=f"일간={ilgan} 일지={ilji}",
                          message=f"커버에 일주동물 이미지가 없음 (placeholder만 표시). 이미지 파일 확인 필요")
            elif not has_base64_img and not has_placeholder:
                check33_found = True
                add_issue("warning", "커버이미지없음", message="커버에 이미지 태그 자체가 없음")
        except Exception:
            pass
    if not check33_found:
        add_issue("pass", "커버동물이미지", message="커버 일주동물 이미지 확인됨" if cover_path.exists() else "커버 없음 (스킵)")

    # ═══════════════════════════════════════════════
    # CHECK 23: 표 내 이름 확인
    # ═══════════════════════════════════════════════
    check23_found = False
    if member_name and tables_dir.exists():
        key_tables = ["사주기본표", "사주원국요약표", "대운로드맵"]
        for tname in key_tables:
            tpath = tables_dir / f"{tname}.html"
            if tpath.exists():
                try:
                    thtml = tpath.read_text(encoding="utf-8", errors="ignore")
                    if member_name not in thtml:
                        check23_found = True
                        add_issue("warning", "표이름불일치", text=tname,
                                  message=f"'{tname}'에 '{member_name}' 이름이 없음")
                except Exception:
                    pass
    if not check23_found:
        add_issue("pass", "표이름확인", message="주요 표에 이름 확인됨")

    # ═══════════════════════════════════════════════
    # CHECK 24: 대운 시작나이/방향 검증
    # ═══════════════════════════════════════════════
    check24_found = False
    if truth.get("년주천간") and member.get("gender"):
        yang_stems = {"甲", "丙", "戊", "庚", "壬"}
        year_stem = truth["년주천간"]
        is_yang = year_stem in yang_stems
        is_male = member["gender"] == "남"
        expected_dir = "순행" if (is_yang and is_male) or (not is_yang and not is_male) else "역행"
        # result.txt에서 대운 방향 확인
        for line in result_lines:
            if "순행" in line or "역행" in line:
                if expected_dir == "순행" and "역행" in line and "순행" not in line:
                    check24_found = True
                    add_issue("error", "대운방향불일치", text=line.strip()[:100],
                              expected=expected_dir, actual="역행",
                              message=f"대운 방향이 '{expected_dir}'이어야 하는데 '역행'으로 기술됨")
                elif expected_dir == "역행" and "순행" in line and "역행" not in line:
                    check24_found = True
                    add_issue("error", "대운방향불일치", text=line.strip()[:100],
                              expected=expected_dir, actual="순행",
                              message=f"대운 방향이 '{expected_dir}'이어야 하는데 '순행'으로 기술됨")
                break
    if not check24_found:
        add_issue("pass", "대운방향확인", message="대운 방향 확인됨" if truth.get("년주천간") else "대운 데이터 없음 (스킵)")

    # ═══════════════════════════════════════════════
    # CHECK 25: 억부용신 불일치
    # ═══════════════════════════════════════════════
    truth_eobu = truth.get("억부용신", "")
    truth_eobu_kr = OHAENG_HANJA.get(truth_eobu, truth_eobu)
    check25_found = False
    if truth_eobu:
        eobu_pat = re.compile(r'억부[^가-힣]*용신[^가-힣]*[:：은는]?\s*([木火土金水목화토금수])')
        for i, line in enumerate(result_lines, 1):
            for m in eobu_pat.finditer(line):
                actual_oh = m.group(1)
                actual_kr = OHAENG_HANJA.get(actual_oh, actual_oh)
                if actual_kr != truth_eobu_kr and actual_oh != truth_eobu:
                    check25_found = True
                    add_issue("error", "억부용신불일치", i, line.strip()[:120],
                              f"{truth_eobu}({truth_eobu_kr})", actual_oh,
                              f"억부용신이 {truth_eobu}이어야 하는데 {actual_oh}(으)로 기술됨")
    if not check25_found:
        add_issue("pass", "억부용신확인", message="억부용신 일치 확인됨" if truth_eobu else "억부용신 데이터 없음 (스킵)")

    # ═══════════════════════════════════════════════
    # CHECK 26: 조후용신 불일치
    # ═══════════════════════════════════════════════
    truth_johu = truth.get("조후용신", "")
    truth_johu_kr = OHAENG_HANJA.get(truth_johu, "") if truth_johu else ""
    check26_found = False
    if truth_johu:
        johu_pat = re.compile(r'조후[^가-힣]*용신[^가-힣]*[:：은는]?\s*([木火土金水목화토금수])')
        for i, line in enumerate(result_lines, 1):
            for m in johu_pat.finditer(line):
                actual_oh = m.group(1)
                actual_kr = OHAENG_HANJA.get(actual_oh, actual_oh)
                if actual_kr != truth_johu_kr and actual_oh != truth_johu:
                    check26_found = True
                    add_issue("error", "조후용신불일치", i, line.strip()[:120],
                              f"{truth_johu}({truth_johu_kr})", actual_oh,
                              f"조후용신이 {truth_johu}이어야 하는데 {actual_oh}(으)로 기술됨")
    if not check26_found:
        add_issue("pass", "조후용신확인", message="조후용신 일치 확인됨" if truth_johu else "조후용신 데이터 없음 (스킵)")

    # ═══════════════════════════════════════════════
    # CHECK 27: 구신 오행 불일치
    # ═══════════════════════════════════════════════
    truth_gusin = truth.get("구신", "")
    truth_gusin_kr = OHAENG_HANJA.get(truth_gusin, truth_gusin)
    check27_found = False
    if truth_gusin:
        gusin_pat = re.compile(r'구신[^가-힣]*[(:：]\s*([木火土金水목화토금수])')
        for i, line in enumerate(result_lines, 1):
            for m in gusin_pat.finditer(line):
                actual_oh = m.group(1)
                actual_kr = OHAENG_HANJA.get(actual_oh, actual_oh)
                if actual_kr != truth_gusin_kr and actual_oh != truth_gusin:
                    check27_found = True
                    add_issue("error", "구신불일치", i, line.strip()[:120],
                              f"{truth_gusin}({truth_gusin_kr})", actual_oh,
                              f"구신이 {truth_gusin}이어야 하는데 {actual_oh}(으)로 기술됨")
    if not check27_found:
        add_issue("pass", "구신확인", message="구신 오행 일치 확인됨" if truth_gusin else "구신 데이터 없음 (스킵)")

    # ═══════════════════════════════════════════════
    # CHECK 28: 한신 오행 불일치
    # ═══════════════════════════════════════════════
    truth_hansin = truth.get("한신", "")
    truth_hansin_kr = OHAENG_HANJA.get(truth_hansin, truth_hansin)
    check28_found = False
    if truth_hansin:
        hansin_pat = re.compile(r'한신[^가-힣]*[(:：]\s*([木火土金水목화토금수])')
        for i, line in enumerate(result_lines, 1):
            for m in hansin_pat.finditer(line):
                actual_oh = m.group(1)
                actual_kr = OHAENG_HANJA.get(actual_oh, actual_oh)
                if actual_kr != truth_hansin_kr and actual_oh != truth_hansin:
                    check28_found = True
                    add_issue("error", "한신불일치", i, line.strip()[:120],
                              f"{truth_hansin}({truth_hansin_kr})", actual_oh,
                              f"한신이 {truth_hansin}이어야 하는데 {actual_oh}(으)로 기술됨")
    if not check28_found:
        add_issue("pass", "한신확인", message="한신 오행 일치 확인됨" if truth_hansin else "한신 데이터 없음 (스킵)")

    # ═══════════════════════════════════════════════
    # CHECK 29: 표 내 억부/조후 용신 확인
    # ═══════════════════════════════════════════════
    check29_found = False
    if tables_dir.exists() and (truth_eobu or truth_johu):
        _current_pkg29 = set(spec.get("required_tables") or [])
        for html_file in tables_dir.glob("*.html"):
            if html_file.name.startswith("filler"):
                continue
            # 현 패키지에 없는 옛 product 잔재 표는 검증 제외
            if _current_pkg29 and html_file.stem not in _current_pkg29:
                continue
            try:
                html_text = html_file.read_text(encoding="utf-8", errors="ignore")
                # 표 내 억부용신 확인
                if truth_eobu:
                    for m in re.finditer(r'억부[^가-힣]*용신[^가-힣]*[:：]?\s*([木火土金水])', html_text):
                        actual_oh = m.group(1)
                        if actual_oh != truth_eobu:
                            check29_found = True
                            add_issue("error", "표억부용신불일치", text=f"{html_file.name}",
                                      expected=truth_eobu, actual=actual_oh,
                                      message=f"표 {html_file.name}에서 억부용신이 {truth_eobu}이어야 하는데 {actual_oh}")
                # 표 내 조후용신 확인
                if truth_johu:
                    for m in re.finditer(r'조후[^가-힣]*용신[^가-힣]*[:：]?\s*([木火土金水])', html_text):
                        actual_oh = m.group(1)
                        if actual_oh != truth_johu:
                            check29_found = True
                            add_issue("error", "표조후용신불일치", text=f"{html_file.name}",
                                      expected=truth_johu, actual=actual_oh,
                                      message=f"표 {html_file.name}에서 조후용신이 {truth_johu}이어야 하는데 {actual_oh}")
            except Exception:
                pass
    if not check29_found:
        add_issue("pass", "표억부조후확인", message="표 내 억부/조후 용신 일치 확인됨" if (truth_eobu or truth_johu) else "스킵")

    # ═══════════════════════════════════════════════
    # CHECK 30: 오행점수 합계 검증
    # ═══════════════════════════════════════════════
    check30_found = False
    oh_scores = truth.get("오행점수", {})
    if oh_scores:
        total = sum(float(v) for v in oh_scores.values())
        if total < 1.0:
            check30_found = True
            add_issue("error", "오행점수이상", message=f"오행점수 합계가 {total:.2f}으로 비정상 (계산 오류 의심)")
        elif total > 30.0:
            check30_found = True
            add_issue("warning", "오행점수이상", message=f"오행점수 합계가 {total:.2f}으로 비정상적으로 높음")
        # 모든 오행이 0인지 확인
        zero_count = sum(1 for v in oh_scores.values() if float(v) == 0)
        if zero_count >= 4:
            check30_found = True
            add_issue("warning", "오행점수이상", message=f"5개 오행 중 {zero_count}개가 0점 — 계산 오류 가능성")
    if not check30_found:
        add_issue("pass", "오행점수확인", message="오행점수 정상 범위" if oh_scores else "오행점수 데이터 없음 (스킵)")

    # ═══════════════════════════════════════════════
    # CHECK 31: 전체 표 용신/기신/희신 검증
    # ═══════════════════════════════════════════════
    check31_found = False
    if tables_dir.exists() and truth_yong:
        # 패턴: "용신(用神) 金" 또는 "용신(用神): 金" — 역할명 바로 뒤 오행만 매칭
        # (오행분포표에서 "①용신(用神)" 라벨 옆 다른 오행 칸이 매칭되는 오탐 방지)
        _5sin_checks = [
            ("용신", truth_yong, re.compile(r'용신\s*\(?\s*用神\s*\)?[\s:：]*([木火土金水])\s*[\(（]')),
            ("기신", truth_gisin, re.compile(r'기신\s*\(?\s*忌神\s*\)?[\s:：]*([木火土金水])\s*[\(（]')),
            ("희신", truth.get("희신",""), re.compile(r'희신\s*\(?\s*喜神\s*\)?[\s:：]*([木火土金水])\s*[\(（]')),
        ]
        # 오행분포 레이아웃 표(균형표/점수표/생극도)는 태그 제거 시 5신 라벨과 다른 오행이 인접해 오탐 발생
        _skip_layout_tables = {"오행균형표.html", "오행점수표.html", "오행생극도.html", "오행조견표.html"}
        # 현 상품 패키지 표만 검증 (옛 product_type 잔재 표는 무시)
        # required_tables가 정의된 경우에만 적용; 없으면 모든 표 검사 (하위호환)
        _current_pkg = set(spec.get("required_tables") or [])
        for html_file in tables_dir.glob("*.html"):
            if html_file.name.startswith("filler") or html_file.name.startswith("운세달력"):
                continue
            if html_file.name in _skip_layout_tables:
                continue
            # 현 패키지에 속하지 않는 표(옛 product 잔재)는 검증 대상에서 제외
            if _current_pkg and html_file.stem not in _current_pkg:
                continue
            try:
                raw = html_file.read_text(encoding="utf-8", errors="ignore")
                plain = re.sub(r'<[^>]+>', ' ', raw)  # HTML 태그 제거
                for label, truth_val, pat in _5sin_checks:
                    if not truth_val:
                        continue
                    tv_kr = OHAENG_HANJA.get(truth_val, truth_val)
                    for m in pat.finditer(plain):
                        actual = m.group(1)
                        actual_kr = OHAENG_HANJA.get(actual, actual)
                        if actual_kr != tv_kr and actual != truth_val:
                            check31_found = True
                            add_issue("error", "표5신전체불일치",
                                      text=f"{html_file.name} > {label}",
                                      expected=f"{truth_val}({tv_kr})", actual=actual,
                                      message=f"표 {html_file.name}의 {label}이 {truth_val}이어야 하는데 {actual}")
            except Exception:
                pass
    if not check31_found:
        add_issue("pass", "표5신전체확인", message="전체 표 용신/기신/희신 일치" if (tables_dir.exists() and truth_yong) else "스킵")

    # ═══════════════════════════════════════════════
    # CHECK 32: 표 내 신강약 확인
    # ═══════════════════════════════════════════════
    truth_sk = truth.get("신강약", "")
    check32_found = False
    if tables_dir.exists() and truth_sk:
        sk_is_strong = "신강" in truth_sk and "신약" not in truth_sk
        sk_is_weak = "신약" in truth_sk
        _current_pkg32 = set(spec.get("required_tables") or [])
        for html_file in tables_dir.glob("*.html"):
            if html_file.name.startswith("filler") or html_file.name.startswith("운세달력"):
                continue
            # 현 패키지에 없는 옛 product 잔재 표는 검증 제외
            if _current_pkg32 and html_file.stem not in _current_pkg32:
                continue
            try:
                raw = html_file.read_text(encoding="utf-8", errors="ignore")
                plain = re.sub(r'<[^>]+>', ' ', raw)
                # 표에서 "신강" 또는 "신약" 명시된 부분 확인
                if sk_is_strong and re.search(r'신약\s*\(?\s*身弱\s*\)?', plain) and not re.search(r'신강', plain):
                    check32_found = True
                    add_issue("error", "표신강약불일치", text=html_file.name,
                              expected=truth_sk, actual="신약",
                              message=f"표 {html_file.name}에서 {truth_sk}이어야 하는데 신약으로 표시됨")
                elif sk_is_weak and re.search(r'신강\s*\(?\s*身强\s*\)?', plain) and not re.search(r'신약', plain):
                    check32_found = True
                    add_issue("error", "표신강약불일치", text=html_file.name,
                              expected=truth_sk, actual="신강",
                              message=f"표 {html_file.name}에서 {truth_sk}이어야 하는데 신강으로 표시됨")
            except Exception:
                pass
    if not check32_found:
        add_issue("pass", "표신강약확인", message="표 내 신강약 일치 확인됨" if (tables_dir.exists() and truth_sk) else "스킵")

    # ═══════════════════════════════════════════════
    # 궁합 전용 검증 (CHECK 34~38)
    # ═══════════════════════════════════════════════
    if spec["is_compatibility"]:
        # ── CHECK 34: partner 필수 필드 ──
        _partner_missing = []
        for _fld in ["이름", "성별", "생년", "생월", "생일"]:
            if not partner_info.get(_fld):
                _partner_missing.append(_fld)
        if _partner_missing:
            add_issue("error", "파트너정보누락",
                      expected=",".join(_partner_missing),
                      message=f"master.json.partner 필수 필드 누락: {', '.join(_partner_missing)}")
        else:
            add_issue("pass", "파트너정보",
                      message=f"파트너 '{partner_info.get('이름')}' 필수 필드 확인됨")

        # ── CHECK 35: partner 생년월일이 본문에 등장 ──
        _p_by = str(partner_info.get("생년", ""))
        _p_bm = str(partner_info.get("생월", ""))
        _p_bd = str(partner_info.get("생일", ""))
        if _p_by and _p_bm and _p_bd:
            _p_found = False
            _p_targets = [(_p_by, _p_bm, _p_bd)]
            # 양력 변환 시도
            try:
                _p_solar = f"""
const {{전체사주계산}} = require('./saju_calc');
const r = 전체사주계산({{이름:'p',년:{int(_p_by)},월:{int(_p_bm)},일:{int(_p_bd)},
  시간:'00:00',음력입력:{'true' if partner_info.get('음력입력') else 'false'},
  윤달:{'true' if partner_info.get('윤달') else 'false'}}});
console.log(r.양력정보||'');
"""
                _sp = subprocess.run(["node","-e",_p_solar], cwd=str(Path("engine").resolve()),
                                     capture_output=True, text=True, timeout=10, encoding="utf-8")
                if _sp.returncode == 0 and _sp.stdout.strip():
                    _sm = re.search(r'(\d+)년\s*(\d+)월\s*(\d+)일', _sp.stdout.strip())
                    if _sm:
                        _p_targets.append((_sm.group(1), _sm.group(2), _sm.group(3)))
            except Exception:
                pass
            for _sy, _smo, _sda in _p_targets:
                for line in result_lines:
                    if _sy in line and f"{_smo}월" in line and f"{_sda}일" in line:
                        _p_found = True
                        break
                if _p_found:
                    break
            if not _p_found and tables_dir.exists():
                for tfile in tables_dir.iterdir():
                    if tfile.suffix == '.html':
                        try:
                            thtml = tfile.read_text(encoding="utf-8", errors="ignore")
                            for _sy, _smo, _sda in _p_targets:
                                if _sy in thtml and _smo in thtml and _sda in thtml:
                                    _p_found = True
                                    break
                        except Exception:
                            pass
                    if _p_found:
                        break
            if not _p_found:
                add_issue("warning", "파트너생년월일불일치",
                          message=f"파트너 생년월일({_p_by}.{_p_bm}.{_p_bd})이 본문/표에서 발견되지 않음")
            else:
                add_issue("pass", "파트너생년월일", message="파트너 생년월일 일치 확인됨")

        # ── CHECK 36: 관계단계 유효성 (8단계 중 하나) ──
        _valid_stages = ["썸","연인","예비부부","부부","재혼준비","재혼","별거","이혼고민"]
        _stage = master_json_data.get("관계단계")
        if _stage:
            if _stage not in _valid_stages:
                add_issue("error", "관계단계무효",
                          actual=_stage,
                          message=f"관계단계 '{_stage}'가 유효 목록에 없음 (8단계: {'/'.join(_valid_stages)})")
            else:
                add_issue("pass", "관계단계", message=f"관계단계 '{_stage}' 확인됨")
        else:
            add_issue("pass", "관계단계", message="관계단계 미지정 (기본값 '연인' 사용)")

        # ── CHECK 37: 궁합 점수 — 궁합종합점수표 HTML 내 0~100 숫자 ──
        _score_path = tables_dir / "궁합종합점수표.html"
        _score_found = False
        if _score_path.exists():
            try:
                _s_html = _score_path.read_text(encoding="utf-8", errors="ignore")
                # "종합 점수" 라벨 이후 또는 score-big/hdr-score 클래스 내 숫자
                _s_m = (
                    re.search(r'class="[^"]*(?:score-big|hdr-score)[^"]*"[^>]*>\s*(\d{1,3})', _s_html)
                    or re.search(r'종합\s*점수[^\d]*(\d{1,3})', re.sub(r'<[^>]+>', ' ', _s_html))
                )
                if _s_m:
                    _score = int(_s_m.group(1))
                    if 0 <= _score <= 100:
                        _score_found = True
                        add_issue("pass", "궁합점수",
                                  message=f"궁합 종합점수 {_score}점 (0~100 범위)")
                    else:
                        add_issue("error", "궁합점수범위",
                                  actual=str(_score),
                                  message=f"궁합 종합점수 {_score}점이 0~100 범위 밖")
            except Exception:
                pass
            if not _score_found:
                add_issue("warning", "궁합점수검출실패",
                          message="궁합종합점수표.html에서 종합 점수를 찾을 수 없음")
        else:
            add_issue("error", "궁합점수표누락",
                      expected="궁합종합점수표.html",
                      message="궁합종합점수표.html이 존재하지 않음")

        # ── CHECK 38: 궁합 필수 섹션 본문 존재 ──
        # 섹션별 표기 변형 허용을 위해 정규식 리스트 사용
        _required_sections = [
            ("일간 상성", r'일간\s*상성'),
            ("오행 비교/보완", r'오행\s*(?:균형|비교|보완)'),
            ("용신 교차", r'용신\s*교차'),
            ("십성 관계", r'(?:십성|서로에게 어떤)'),
            ("친밀도", r'친밀도'),
            ("합충 교차", r'합충\s*교차'),
            ("인연 깊이", r'인연\s*깊이'),
            ("갈등 포인트", r'갈등'),
            ("재물 궁합", r'재물'),
            ("자녀 운", r'자녀'),
        ]
        _missing_sec = []
        for _label, _rgx in _required_sections:
            if not re.search(_rgx, result_text):
                _missing_sec.append(_label)
        if _missing_sec:
            add_issue("warning", "궁합섹션누락",
                      expected=",".join(_missing_sec),
                      message=f"궁합 필수 섹션 누락 의심: {', '.join(_missing_sec)}")
        else:
            add_issue("pass", "궁합섹션", message=f"궁합 필수 섹션 {len(_required_sections)}개 확인됨")

        # ── CHECK 39: partner 용신/신강약 표 일치 (궁합사주비교표) ──
        _cmp_path = tables_dir / "궁합사주비교표.html"
        if _cmp_path.exists() and partner_truth:
            try:
                _cmp_html = _cmp_path.read_text(encoding="utf-8", errors="ignore")
                _cmp_plain = re.sub(r'<[^>]+>', ' ', _cmp_html)
                _p_yong = partner_truth.get("용신", "")
                # partner 용신이 궁합사주비교표에 등장하는지
                if _p_yong and _p_yong not in _cmp_plain and OHAENG_HANJA.get(_p_yong, "") not in _cmp_plain:
                    add_issue("warning", "궁합비교표파트너용신누락",
                              expected=_p_yong,
                              message=f"궁합사주비교표에 파트너 용신({_p_yong})이 보이지 않음")
                else:
                    add_issue("pass", "궁합비교표파트너",
                              message=f"궁합사주비교표에 파트너 용신({_p_yong}) 확인됨")
            except Exception:
                pass

    # ═══════════════════════════════════════════════
    # CHECK 40: 표지 4기둥(年/月/日/時) 모두 채워졌는지
    # ═══════════════════════════════════════════════
    if cover_path.exists():
        try:
            _cov = cover_path.read_text(encoding="utf-8", errors="ignore")
            # saju-table 영역 추출
            _tbl_match = re.search(r'<table[^>]*class="[^"]*saju-table[^"]*"[^>]*>(.*?)</table>', _cov, re.S)
            if _tbl_match:
                _tds = re.findall(r'<td[^>]*>([^<]*)</td>', _tbl_match.group(1))
                _empty_pillars = [v for v in _tds if v.strip() in ('', '-', '—', '－')]
                if len(_empty_pillars) > 0:
                    add_issue("error", "표지4기둥누락",
                              actual=f"빈칸 {len(_empty_pillars)}개",
                              message=f"[{spec['label']}] 표지 4기둥 중 {len(_empty_pillars)}개가 비어있음(년/월/일/시 누락)")
                else:
                    add_issue("pass", "표지4기둥", message="표지 4기둥 모두 채움 확인")
        except Exception:
            pass

    # ═══════════════════════════════════════════════
    # CHECK 41: 인적사항표 핵심 필드(띠·만나이·생시·일간오행) 누락
    # ═══════════════════════════════════════════════
    _info_path = tables_dir / "인적사항표.html"
    if not _info_path.exists():
        # 궁합은 궁합인적사항표
        _info_path = tables_dir / "궁합인적사항표.html"
    if _info_path.exists():
        try:
            _info = _info_path.read_text(encoding="utf-8", errors="ignore")
            _missing = []
            # 띠: "X띠" 형태가 있어야 함 (X는 12지 동물)
            if not re.search(r'(쥐|소|호랑이|토끼|용|뱀|말|양|원숭이|닭|개|돼지)띠', _info):
                _missing.append("띠")
            # 만나이: "만N세"
            if not re.search(r'만\d+세', _info):
                _missing.append("만나이")
            # 일간오행: "일간오행" 라벨 + 오행 값
            if not re.search(r'일간오행.*?[木火土金水]', _info, re.S):
                _missing.append("일간오행")
            if _missing:
                add_issue("warning", "인적사항표필드누락",
                          actual=",".join(_missing),
                          message=f"[{spec['label']}] 인적사항표에 누락 필드: {', '.join(_missing)}")
            else:
                add_issue("pass", "인적사항표완전성", message="인적사항표 필수 필드(띠·만나이·일간오행) 확인됨")
        except Exception:
            pass

    # ═══════════════════════════════════════════════
    # CHECK 42: 표지에 본인이 아닌 다른 회원 이름 혼입 여부
    # ═══════════════════════════════════════════════
    if cover_path.exists() and member_name:
        try:
            _cov = cover_path.read_text(encoding="utf-8", errors="ignore")
            # 본인 이름이 N번 + 다른 한글 이름이 본인 이름보다 많이 등장하면 혼입 의심
            _self_count = _cov.count(member_name)
            # 본인 이외의 2~5자 한글 이름 후보 추출 (브랜드/연구소 제외)
            _candidates = set(re.findall(r'([가-힣]{2,5})\s*님의\s*천명', _cov))
            _foreign = [n for n in _candidates if n != member_name]
            if _foreign:
                add_issue("error", "표지타인이름혼입",
                          actual=",".join(_foreign),
                          message=f"[{spec['label']}] 표지에 본인이 아닌 이름 발견: {', '.join(_foreign)} (본인: {member_name})")
            elif _self_count == 0:
                add_issue("error", "표지본인이름누락",
                          message=f"[{spec['label']}] 표지에 본인 이름({member_name})이 한 번도 등장하지 않음")
            else:
                add_issue("pass", "표지이름순수성", message=f"표지 이름 순수성 확인 ({member_name} {_self_count}회)")
        except Exception:
            pass

    # ═══════════════════════════════════════════════
    # CHECK 43: 슬롯에 다른 상품의 잔재 표 존재 (정보용 warning)
    # ═══════════════════════════════════════════════
    # spec["required_tables"] 범주에 없는 표가 슬롯에 너무 많이 있으면 옛 product_type 잔재 가능성
    if tables_dir.exists():
        try:
            _all_html = [f.name for f in tables_dir.glob("*.html") if not f.name.startswith("filler") and not f.name.startswith("운세달력")]
            _expected = set(spec.get("required_tables", []))
            # cover/돛단배/지장간요약표/용신가이드카드 등은 spec에 없어도 정상 부수 표
            _allowed_extras = {"cover.html", "돛단배_삽화.html", "지장간요약표.html", "용신가이드카드.html",
                               "운세달력_전체.html", "연간운세요약표.html"}
            _expected_files = {f"{n}.html" for n in _expected} | _allowed_extras
            _stale = [f for f in _all_html if f not in _expected_files]
            if len(_stale) > 5:  # 5개 이상이면 명백한 잔재
                add_issue("warning", "옛상품표잔재",
                          actual=f"{len(_stale)}개 ({', '.join(_stale[:5])}...)",
                          message=f"[{spec['label']}] 현 상품과 무관한 표 {len(_stale)}개 잔류 — 옛 product_type 결과물 가능성")
        except Exception:
            pass

    # ═══════════════════════════════════════════════
    # CHECK 44: 표 데이터 충실도 — "—"/"없음"/빈 슬롯 비율 측정
    # ═══════════════════════════════════════════════
    # 표 HTML 안에 데이터가 채워지지 않은 placeholder가 너무 많으면 의존성 사슬 끊김
    # 예: 요약본이 ch10/ch11 생성 누락 → 건강표·직업표 모든 슬롯 "—"
    if tables_dir.exists():
        try:
            # 진짜 빈 슬롯 — 셀 안에 "—"/"–"/"-" 단독, 또는 "미상", "N/A" 만 있을 때
            # "❌ 없음", "✓ 없음" 같은 의도된 표시는 제외 (십성배치표 등의 디자인된 placeholder)
            _empty_pat = re.compile(r'>\s*(?:—|–|-|미상|N/A|데이터\s*없음)\s*<')
            # 셀 개수: <td>...</td> + 인적사항표/직업표용 .attr-val·.value·.info-value 등 데이터 슬롯
            _cell_pat  = re.compile(r'<(?:td|div\s+class="[^"]*(?:val|value|attr-val|info-val|fm-text)[^"]*")\b[^>]*>([^<]{0,80})</(?:td|div)>')
            # 십성배치표: "없음/있음" 디자인이 의도된 표시이므로 데이터부족 검사에서 제외
            _excluded_for_empty_check = {"십성배치표", "부재십성보완표"}
            _required = spec.get("required_tables", [])
            _empty_alerts = []
            for _name in _required:
                if _name == "cover" or _name in _excluded_for_empty_check:
                    continue
                _tp = tables_dir / f"{_name}.html"
                if not _tp.exists():
                    continue
                try:
                    _h = _tp.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue
                _empty_count = len(_empty_pat.findall(_h))
                _cell_count  = len(_cell_pat.findall(_h))
                # 셀 5개 미만이면 표 자체가 단순(검사 의미 없음)
                if _cell_count < 5:
                    continue
                _ratio = _empty_count / max(_cell_count, 1)
                if _ratio >= 0.30:
                    _empty_alerts.append(f"{_name}({_empty_count}/{_cell_count}={_ratio:.0%})")
            if _empty_alerts:
                add_issue("warning", "표데이터부족",
                          actual=", ".join(_empty_alerts[:5]),
                          message=f"[{spec['label']}] 데이터 30% 이상 비어있는 표 발견: {', '.join(_empty_alerts[:5])} — ch* 생성 누락 가능성")
            else:
                if _required:
                    add_issue("pass", "표데이터충실도", message="모든 표 데이터 30% 이상 채워짐")
        except Exception:
            pass

    # ═══════════════════════════════════════════════
    # CHECK 45: 필수 데이터 슬롯 존재 (required_data)
    # ═══════════════════════════════════════════════
    # spec.required_data에 명시된 ch*.json 파일이 슬롯에 모두 있는지 검사
    # → 새 상품 추가나 runner 수정 시 데이터 생성 누락을 즉시 잡음
    _required_data = spec.get("required_data", [])
    if _required_data:
        try:
            # ch03.json, ch10.json 등을 sample_NNN_chXX.json 패턴으로 찾음
            _slot_files = {f.name for f in _sd.iterdir() if f.is_file()}
            _missing_data = []
            for _ch in _required_data:
                # sample_*_chXX.json 또는 sample_*_ch_XXX.json 형식
                _pat = re.compile(rf'^sample_\d+_{re.escape(_ch)}(?:_result)?\.json$')
                if not any(_pat.match(f) for f in _slot_files):
                    _missing_data.append(_ch)
            if _missing_data:
                add_issue("error", "필수데이터누락",
                          actual=",".join(_missing_data),
                          message=f"[{spec['label']}] 필수 데이터 슬롯 누락: {', '.join(_missing_data)} — 표가 비어있을 수 있음")
            else:
                add_issue("pass", "필수데이터완전성", message=f"필수 데이터 슬롯 {len(_required_data)}개 모두 존재")
        except Exception:
            pass

    # ── 결과 분류 ──
    errors = [x for x in issues if x["level"] == "error"]
    warnings = [x for x in issues if x["level"] == "warning"]
    passed = [x for x in issues if x["level"] == "pass"]

    return JSONResponse({
        "member_name": member_name,
        "product_type": product_key,
        "product_label": spec["label"],
        "total_checks": len(issues),
        "errors": errors,
        "warnings": warnings,
        "passed": passed,
        "summary": {
            "error": len(errors),
            "warning": len(warnings),
            "pass": len(passed)
        }
    })


@router.get("/download/{book_id}")
async def download_book(request: Request, book_id: int):
    master_id = get_master_id(request)
    if not master_id:
        return RedirectResponse("/login")
    
    book = db.get_book(book_id)
    if not book or book["master_id"] != master_id:
        raise HTTPException(status_code=403)
        
    if not book["pdf_path"] or not os.path.exists(book["pdf_path"]):
        raise HTTPException(status_code=404, detail="파일이 존재하지 않습니다.")
        
    member = db.get_member(book["member_id"])
    member_name = member["name"] if member else "회원"
    filename = f"{member_name}_사주해석서_{book['book_year']}.txt"
    
    return FileResponse(
        path=book["pdf_path"],
        filename=filename,
        media_type="text/plain; charset=utf-8"
    )

@router.get("/print_tables/{member_id}", response_class=HTMLResponse)
async def print_tables(request: Request, member_id: int, year: int = None):
    master_id = get_master_id(request)
    if not master_id:
        return RedirectResponse("/login")
    member = db.get_member(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="회원 없음")
    _sd = find_slot_dir(Path("engine/queue"), master_id, member['name'], str(member.get("phone","") or ""), "saju", member_id, year)
    tables_dir = _sd / "tables"
    if not tables_dir.exists():
        raise HTTPException(status_code=404, detail="표 폴더가 없습니다. 먼저 집필을 실행하세요.")
    t_files = sorted([f for f in tables_dir.iterdir() if f.suffix == '.html' and f.stem != 'cover'])
    if not t_files:
        raise HTTPException(status_code=404, detail="표 파일이 없습니다. 먼저 집필을 실행하세요.")
    table_names = [tf.stem for tf in t_files]
    name = member.get('name', '')
    html = f'''<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>{name} 님 전체 표 미리보기</title>
<style>
body {{ background:#e5e5e5;margin:0;padding:20px;font-family:'Noto Sans KR',sans-serif; }}
.table-section {{ background:#fff;width:800px;max-width:95vw;margin:0 auto 20px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.1);overflow:hidden; }}
.section-header {{ font-size:13px;color:#8a7e6c;border-bottom:1px solid #e0d8c8;padding:10px 16px;background:#faf8f4; }}
.section-header span {{ font-weight:600;color:#5a4e3c;font-size:15px; }}
.table-frame {{ width:100%;border:none;display:block; }}
.toolbar {{ position:fixed;top:0;left:0;right:0;background:#1a1a2e;color:#fff;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.3); }}
.toolbar h1 {{ font-size:16px;font-weight:500;margin:0; }}
.spacer {{ height:60px; }}
</style></head><body>
<div class="toolbar"><h1>{name} 님 전체 표 미리보기 ({len(table_names)}개)</h1></div>
<div class="spacer"></div>\n'''
    for i, tn in enumerate(table_names):
        src = f"/saju/api/render_component?name=TABLE:{tn}&member_id={member_id}"
        html += f'<div class="table-section"><div class="section-header"><span>{i+1}.</span> {tn}</div><iframe class="table-frame" src="{src}" onload="this.style.height=this.contentWindow.document.body.scrollHeight+20+\'px\'"></iframe></div>\n'
    html += '</body></html>'
    return HTMLResponse(content=html)

@router.get("/api/calc_daewoon")
async def calc_daewoon(request: Request, year: int, month: int, day: int, hour: str = "모름", gender: str = "남", lunar: bool = True, leap: bool = False):
    """생년월일로 대운 계산 → 10년 단위 리스트 반환"""
    try:
        script = f"""
const {{전체사주계산}} = require('./saju_calc');
const r = 전체사주계산({{이름:'test', 성별:'{gender}', 년:{year}, 월:{month}, 일:{day}, 시간:'{hour}', 음력입력:{str(lunar).lower()}, 윤달:{str(leap).lower()}}});
const result = {{
  일간: r.일간, 일간오행: r.일간오행, 신강약: r.신강약,
  용신: r.용신, 희신: r.희신, 기신: r.기신, 구신: r.구신, 한신: r.한신,
  억부용신: r.억부용신, 격국용신: r.격국용신,
  대운목록: r.대운목록.map(d => ({{
    천간: d.천간, 지지: d.지지, 시작나이: d.시작나이,
    천간오행: d.천간오행||'', 지지오행: d.지지오행||'',
    길흉: d.대운길흉||''
  }})),
  만나이: r.만나이
}};
console.log(JSON.stringify(result));
"""
        proc = subprocess.run(
            ["node", "-e", script],
            cwd=str(Path("engine").resolve()),
            capture_output=True, text=True, timeout=15, encoding="utf-8"
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return JSONResponse(json.loads(proc.stdout.strip()))
        return JSONResponse({"error": proc.stderr[:200]}, status_code=500)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@router.get("/api/render_component")
async def render_component(request: Request, name: str, member_id: int):
    master_id = get_master_id(request)
    if not master_id:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    # TABLE: 접두사 처리 》 회원별 슬롯 폴더에서만 조회. 회원 고유 표가 없으면 404.
    # 공용 조견표(60갑자표 등)만 common/ fallback. current/ fallback은 직전 회원 데이터가 새어들어가 금지.
    if name.upper().startswith("TABLE:"):
        component_name = name.split(":", 1)[1].strip()
        member = db.get_member(member_id)
        if not member:
            return JSONResponse({"error": "Member not found"}, status_code=404)

        # 회원 슬롯 폴더: 브랜드/개인/상품/연도 구조
        _year = request.query_params.get("year", None)
        _year_int = int(_year) if _year else None
        _phone = str(member.get("phone", "") or "")

        # 단일 소스 원칙: 각 상품은 자기 슬롯 폴더에서만 리소스를 찾는다.
        # saju_calc 외에는 상품 간 공유 없음. 궁합=compatibility/, 그 외=saju/.
        _product_q = (request.query_params.get("product", "") or "").strip()
        _is_compat = (
            _product_q == "compatibility"
            or "궁합" in component_name
            or component_name == "잠자리궁합표"
        )
        _slot_sub = "compatibility" if _is_compat else "saju"

        # 상품별 슬롯 폴더에서만 표 탐색 (tables/ 안 + 슬롯 루트)
        # 우선 DB에서 해당 (member, product, year)의 책을 찾아 book.slot_dir 사용 — 진실 소스
        member_table_path = None
        _book_for_slot = None
        try:
            _books = db.get_books(master_id=master_id, member_id=member_id) or []
            # 상품군 매칭: 궁합이면 compatibility, 그 외엔 saju 계열 (총본/요약/연운 모두 saju 폴더 공유)
            for _b in _books:
                _bp = _b.get('product_type', 'saju_full')
                _is_b_compat = (_bp == 'compatibility')
                if _is_compat != _is_b_compat:
                    continue
                if _year_int and _b.get('book_year') and int(_b['book_year']) != _year_int:
                    continue
                if _b.get('slot_dir'):
                    _book_for_slot = _b
                    break
                if _book_for_slot is None:
                    _book_for_slot = _b
        except Exception:
            pass
        if _book_for_slot:
            _sd = resolve_slot_dir(_book_for_slot, member, slot_subdir=_slot_sub)
        else:
            _sd = find_slot_dir(Path("engine/queue"), master_id, member['name'], _phone, _slot_sub, member_id, _year_int)
        for _rel in (f"tables/{component_name}.html", f"{component_name}.html"):
            _p = _sd / _rel
            if _p.exists():
                member_table_path = _p
                break

        # 경로 결정 — 궁합은 자기 폴더에만 의존 (공용 current/common 사용 금지)
        if member_table_path and member_table_path.exists():
            table_path = member_table_path
        elif _is_compat:
            # 궁합 전용: 공용 폴더로 fallback하지 않음
            return JSONResponse(
                {"error": f"TABLE:{component_name} 없음 》 궁합 집필을 먼저 실행하세요 ({_sd})"},
                status_code=404,
            )
        else:
            # 총본/요약본/연운: 공용 조견표(common/)만 fallback 허용.
            # current/는 '직전 실행 회원'의 표가 들어있어 다른 회원의 데이터가 새어들어가므로 사용 금지.
            table_path = Path("engine/tables/common") / f"{component_name}.html"

        if not table_path.exists():
            return JSONResponse({"error": f"TABLE:{component_name} 없음 》 이 회원의 집필을 먼저 실행하세요"}, status_code=404)
        slots = get_saju_slots(member)
        birth_year = int(member['birth_year'])
        context = {
            "user_profile": {
                "name": member['name'],
                "gender_kr": member['gender'],
                "age": datetime.now().year - birth_year,
                "birth_solar": slots.get('양력', ''),
                "birth_lunar": slots.get('음력', ''),
            },
            "saju_data": {
                "year_animal_emoji": "🐉",
                "ilju_animal": slots.get('일주한자', '') + " " + slots.get('일주한글', ''),
                "hour_name": "",
            },
            "saju_table_json": json.dumps(slots_to_table_data(slots), ensure_ascii=False),
            "saju_table_data": slots_to_table_data(slots),
        }
        try:
            import re as _re
            from jinja2 import Template
            _content = table_path.read_text(encoding="utf-8")
            rendered = Template(_content).render(**context)
            # <head> 안 <style> 태그 추출 (CSS 유지)
            head_match = _re.search(r'<head[^>]*>(.*?)</head>', rendered, _re.DOTALL | _re.IGNORECASE)
            head_styles = ""
            if head_match:
                styles = _re.findall(r'<style[^>]*>.*?</style>', head_match.group(1), _re.DOTALL | _re.IGNORECASE)
                # @font-face 제외 (서버에서 file:// 경로 불필요)
                # 전역 셀렉터( * {} body {} html {} )도 제외 》 에디터 CSS 오염 방지
                for s in styles:
                    inner = _re.sub(r'@font-face\s*\{[^}]*\}', '', s, flags=_re.DOTALL)
                    inner = _re.sub(r'\*\s*\{[^}]*\}', '', inner, flags=_re.DOTALL)
                    inner = _re.sub(r'(?<![.\w#])body\s*\{[^}]*\}', '', inner, flags=_re.DOTALL)
                    inner = _re.sub(r'(?<![.\w#])html\s*\{[^}]*\}', '', inner, flags=_re.DOTALL)
                    if inner.strip().replace('<style>','').replace('</style>','').strip():
                        head_styles += inner
            body_match = _re.search(r'<body[^>]*>(.*?)</body>', rendered, _re.DOTALL | _re.IGNORECASE)
            body_content = body_match.group(1).strip() if body_match else rendered
            return HTMLResponse(content=head_styles + body_content)
        except Exception as e:
            logging.error(f"Error rendering table component {component_name}: {e}")
            return JSONResponse({"error": f"render error: {str(e)}"}, status_code=500)

    cache_path = Path(f"output/rendered_html/{member_id}/{name}.html")
    if cache_path.exists():
        try:
            with open(cache_path, "r", encoding="utf-8") as f_cache:
                return HTMLResponse(content=f_cache.read())
        except Exception as e:
            logging.error(f"Error reading cached component {name}: {e}")

    member = db.get_member(member_id)
    if not member:
        return JSONResponse({"error": "Member not found"}, status_code=404)

    hour = 0
    b_time = str(member.get('birth_time', '00:00'))
    if ':' in b_time:
        try: hour = int(b_time.split(':')[0])
        except: hour = 0

    birth_year = int(member['birth_year'])
    res = calculate_saju(
        birth_year, int(member['birth_month']), int(member['birth_day']),
        hour, 0,
        is_lunar=bool(member.get('lunar_yn', 0)),
        is_leap=bool(member.get('leap_month_yn', 0)),
        gender='M' if member['gender'] == '남' else 'F'
    )

    ohaeng_res = analyze_ohaeng(res)
    daeun_list = calculate_daeun(res, birth_year, num_periods=10, day_stem=res['day_stem']['stem'])

    context2 = {
        "request": request,
        "user_profile": {
            "name": member['name'],
            "gender_kr": member['gender'],
            "age": datetime.now().year - birth_year + 1,
            "birth_solar": res['input']['solar_date'],
            "birth_lunar": res['input']['lunar_date'],
        },
        "manseryeok": res['manseryeok'],
        "ohaeng": ohaeng_res,
        "daeun": daeun_list,
    }
    try:
        return templates.TemplateResponse(f"components/{name}.html", context2)
    except Exception as e:
        return JSONResponse({"error": f"Template not found: {str(e)}"}, status_code=500)
