from fastapi import APIRouter, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from utils import templates
import db, brand

router = APIRouter()


def get_user(request: Request):
    mid = request.session.get("master_id")
    if not mid: raise HTTPException(302, headers={"Location": "/login"})
    return request.session

# GET /members/dashboard
@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    user = get_user(request)
    master_id = user["master_id"]
    stats = db.get_stats(master_id)
    recent = db.get_members(master_id, status="활성")[:5]
    return templates.TemplateResponse(request, "master/dashboard.html", 
        {"request": request, "user": user, "stats": stats,
         "recent": recent, "brand_color": user.get("브랜드색상","#1A3A6A")})

# GET /members/list
@router.get("/list", response_class=HTMLResponse)
async def member_list(request: Request, search: str = "", status: str = "활성"):
    user = get_user(request)
    members = db.get_members_with_requests(user["master_id"])
    
    show = request.query_params.get("show", "all")
    if show == "requests":
        members = [m for m in members if m.get('client_id') and
                   m.get('request_status') in ['신청완료','대기']]
    else:
        if search:
            members = [m for m in members if search in m['name'] or search in m.get('email', '')]
        if status and status != "전체":
            members = [m for m in members if m['status'] == status]

    # 각 회원의 최신 집필 상태 추가
    for m in members:
        books = db.get_books(member_id=m["id"])
        m["집필상태"] = books[0]["status"] if books else "-"

    # client별 등급/한도 정보 (해당 client의 멤버 행마다 같은 값 노출)
    tier_by_client = {}
    for m in members:
        cid = m.get("client_id")
        if cid and cid not in tier_by_client:
            tier_by_client[cid] = db.get_member_limit(cid)
        m["등급정보"] = tier_by_client.get(cid)

    return templates.TemplateResponse(request, "master/member_list.html",
        {"request": request, "user": user, "members": members,
         "search": search, "status": status, "show": show,
         "tier_by_client": tier_by_client,
         "brand_color": user.get("브랜드색상","#1A3A6A")})

# GET /members/profile
@router.get("/profile", response_class=HTMLResponse)
async def profile_form(request: Request):
    user = get_user(request)
    master = db.get_master(user["master_id"])
    return templates.TemplateResponse(request, "master/profile.html", 
        {"request": request, "user": user, "master": master,
         "brand_color": user.get("브랜드색상","#1A3A6A")})

# POST /members/profile
@router.post("/profile")
async def profile_post(request: Request,
    선생님이름: str = Form(...), 연구소명: str = Form(""),
    서명문구: str = Form(""), 마무리인사: str = Form(""),
    호칭조사: str = Form("이"), 연락처: str = Form(""),
    이메일: str = Form(""), 홈페이지: str = Form(""),
    카카오채널: str = Form(""), 브랜드색상: str = Form("#1A3A6A"),
    금색: str = Form("#C8B860"),
    current_pw: str = Form(""), new_pw: str = Form(""), new_pw2: str = Form("")):
    user = get_user(request)
    master_id = user["master_id"]
    errors = []

    data = dict(선생님이름=선생님이름, 연구소명=연구소명, 서명문구=서명문구,
                마무리인사=마무리인사, 호칭조사=호칭조사, 연락처=연락처,
                이메일=이메일, 홈페이지=홈페이지, 카카오채널=카카오채널,
                브랜드색상=브랜드색상, 금색=금색)

    if new_pw:
        master = db.get_master(master_id)
        if not db.verify_pw(current_pw, master["password_hash"]):
            errors.append("현재 비밀번호가 틀렸습니다.")
        elif len(new_pw) < 8:
            errors.append("새 비밀번호 8자 이상")
        elif new_pw != new_pw2:
            errors.append("새 비밀번호 불일치")
        else:
            data["password_hash"] = db.hash_pw(new_pw)

    if errors:
        master = db.get_master(master_id)
        return templates.TemplateResponse(request, "master/profile.html", 
            {"request": request, "user": user, "master": master,
             "errors": errors, "brand_color": user.get("브랜드색상","#1A3A6A")})

    db.update_master(master_id, data)
    brand.update_brand_profile(master_id, data)
    # 세션 업데이트
    request.session["선생님이름"] = 선생님이름
    request.session["브랜드색상"] = 브랜드색상
    request.session["금색"] = 금색
    db.log_action(master_id, "설정수정", "브랜드 정보 수정")
    return RedirectResponse("/members/profile?msg=저장완료", status_code=302)

# GET /members/new
@router.get("/new", response_class=HTMLResponse)
async def member_new_form(request: Request):
    user = get_user(request)
    return templates.TemplateResponse(request, "master/member_form.html", 
        {"request": request, "user": user, "mode": "new", "member": {},
         "brand_color": user.get("브랜드색상","#1A3A6A")})

# POST /members/new
@router.post("/new")
async def member_new_post(request: Request,
    name: str = Form(...),
    phone: str = Form(""), email: str = Form(...),  # email 필수
    birth_year: int = Form(...), birth_month: int = Form(...),
    birth_day: int = Form(...), birth_time: str = Form(...),
    gender: str = Form(...), lunar_yn: int = Form(0), leap_month_yn: int = Form(0),
    activity_type: str = Form("직장인"),
    marital_status: str = Form("미혼"),
    has_children: str = Form("없음"),
    concern_area: str = Form("종합"),
    has_siblings: str = Form("있음"),
    parent_status: str = Form("양친"),
    health_concern: str = Form("없음"),
    memo: str = Form(""),
    birth_region: str = Form(""),
    birth_time_accuracy: str = Form(""),
    self_q1: str = Form(""), self_q2: str = Form(""), self_q3: str = Form(""),
    self_q4: str = Form(""), self_q5: str = Form(""), self_q6: str = Form(""), self_q7: str = Form(""),
    good_periods: str = Form(""), bad_periods: str = Form("")):
    user = get_user(request)
    master_id = user["master_id"]

    errors = []
    if not name: errors.append("이름 필수")
    if not email: errors.append("이메일 필수")
    if not (1900 <= birth_year <= 2030): errors.append("생년 범위 오류 (1900~2030)")
    if not birth_time: errors.append("생시 필수")
    if not gender: errors.append("성별 필수")

    # 중복 확인 (테스트 이메일은 우회)
    from config import is_test_email
    if not is_test_email(email):
        conn = db.get_conn()
        c = conn.cursor()
        c.execute("""SELECT COUNT(*) FROM members
                     WHERE master_id=? AND name=? AND birth_year=? AND birth_month=? AND birth_day=?""",
                  (master_id, name, birth_year, birth_month, birth_day))
        if c.fetchone()[0] > 0: errors.append("동일 이름·생년월일 회원이 이미 있습니다.")
        conn.close()

    if errors:
        return templates.TemplateResponse(request, "master/member_form.html", 
            {"request": request, "user": user, "mode": "new",
             "errors": errors, "member": dict(await request.form()),
             "brand_color": user.get("브랜드색상","#1A3A6A")})

    # Auto-create or link client account by email (이메일 기반)
    # 테스트 이메일은 client 생성/연결을 건너뛰어 회원별 결제 충돌 방지
    client_id = None
    if email and not is_test_email(email):
        client = db.get_client_by_email(master_id, email)
        if client:
            client_id = client['id']
        else:
            client_id = db.insert_client({
                "master_id": master_id,
                "name": name,
                "email": email,
                "password_hash": db.hash_pw(email),  # 초기 비번 = 이메일 (사용자가 변경)
                "phone": ""
            })

        # ── 등급제 한도 체크 (client 밑에 추가 멤버 등록 시) ──
        if client_id:
            tier = db.get_member_limit(client_id)
            if tier["count"] >= tier["limit"]:
                next_msg = ""
                if tier["next_threshold"]:
                    nt_amt, nt_lim = tier["next_threshold"]
                    next_msg = f" (현재 누적 결제 {tier['paid']:,}원 — {nt_amt:,}원 결제 시 {nt_lim}명까지 등록 가능)"
                errors.append(
                    f"등록 한도 초과: 현재 등급 한도 {tier['limit']}명, 활성 회원 {tier['count']}명{next_msg}"
                )
                return templates.TemplateResponse(request, "master/member_form.html",
                    {"request": request, "user": user, "mode": "new",
                     "errors": errors, "member": dict(await request.form()),
                     "brand_color": user.get("브랜드색상","#1A3A6A")})

    data = dict(master_id=master_id, client_id=client_id, name=name, phone=phone, email=email,
                birth_year=birth_year, birth_month=birth_month, birth_day=birth_day,
                birth_time=birth_time, gender=gender, lunar_yn=lunar_yn,
                leap_month_yn=leap_month_yn,
                activity_type=activity_type, marital_status=marital_status,
                has_children=has_children, concern_area=concern_area,
                has_siblings=has_siblings, parent_status=parent_status,
                health_concern=health_concern, memo=memo,
                birth_region=birth_region, birth_time_accuracy=birth_time_accuracy,
                self_q1=self_q1, self_q2=self_q2, self_q3=self_q3,
                self_q4=self_q4, self_q5=self_q5, self_q6=self_q6, self_q7=self_q7,
                good_periods=good_periods, bad_periods=bad_periods)
    new_id = db.insert_member(data)
    db.log_action(master_id, "회원등록", name, new_id)
    return RedirectResponse(f"/members/list?msg=등록완료", status_code=302)

# GET /members/{member_id}/edit
@router.get("/{member_id}/edit", response_class=HTMLResponse)
async def member_edit_form(request: Request, member_id: int):
    user = get_user(request)
    member = db.get_member(member_id)
    if not member or member["master_id"] != user["master_id"]:
        raise HTTPException(status_code=403)
    return templates.TemplateResponse(request, "master/member_form.html", 
        {"request": request, "user": user, "mode": "edit", "member": member,
         "brand_color": user.get("브랜드색상","#1A3A6A")})

# POST /members/{member_id}/edit
@router.post("/{member_id}/edit")
async def member_edit_post(request: Request, member_id: int,
    name: str = Form(...), phone: str = Form(""), email: str = Form(...),  # email 필수
    activity_type: str = Form("직장인"), marital_status: str = Form("미혼"),
    has_children: str = Form("없음"), concern_area: str = Form("종합"),
    has_siblings: str = Form("있음"), parent_status: str = Form("양친"),
    birth_year: int = Form(...), birth_month: int = Form(...),
    birth_day: int = Form(...), birth_time: str = Form(...),
    gender: str = Form(...), lunar_yn: int = Form(0), leap_month_yn: int = Form(0),
    health_concern: str = Form("없음"), memo: str = Form(""),
    status: str = Form("활성"),
    birth_region: str = Form(""), birth_time_accuracy: str = Form(""),
    self_q1: str = Form(""), self_q2: str = Form(""), self_q3: str = Form(""),
    self_q4: str = Form(""), self_q5: str = Form(""), self_q6: str = Form(""), self_q7: str = Form(""),
    good_periods: str = Form(""), bad_periods: str = Form("")):
    user = get_user(request)
    member = db.get_member(member_id)
    if not member or member["master_id"] != user["master_id"]:
        raise HTTPException(status_code=403)
    errors = []
    if not name: errors.append("이름 필수")
    if not email: errors.append("이메일 필수")
    if not (1900 <= birth_year <= 2030): errors.append("생년 범위 오류 (1900~2030)")

    if errors:
        return templates.TemplateResponse(request, "master/member_form.html",  {
             "request": request, "mode": "edit", "user": user, 
             "errors": errors, "member": dict(await request.form()),
             "brand_color": user.get("브랜드색상","#1A3A6A")})

    db.update_member(member_id, dict(name=name, phone=phone, email=email,
        birth_year=birth_year, birth_month=birth_month, birth_day=birth_day,
        birth_time=birth_time, gender=gender, lunar_yn=lunar_yn, leap_month_yn=leap_month_yn,
        activity_type=activity_type, marital_status=marital_status,
        has_children=has_children, concern_area=concern_area,
        has_siblings=has_siblings, parent_status=parent_status,
        health_concern=health_concern, memo=memo, status=status,
        birth_region=birth_region, birth_time_accuracy=birth_time_accuracy,
        self_q1=self_q1, self_q2=self_q2, self_q3=self_q3,
        self_q4=self_q4, self_q5=self_q5, self_q6=self_q6, self_q7=self_q7,
        good_periods=good_periods, bad_periods=bad_periods))
    db.log_action(user["master_id"], "회원수정", name, member_id)
    return RedirectResponse("/members/list?msg=수정완료", status_code=302)

# POST /members/{member_id}/delete
@router.post("/{member_id}/delete")
async def member_delete(request: Request, member_id: int,
                        delete_type: str = Form("비활성")):
    user = get_user(request)
    member = db.get_member(member_id)
    if not member or member["master_id"] != user["master_id"]:
        raise HTTPException(status_code=403)
    if delete_type == "완전삭제":
        db.delete_member(member_id)
        db.log_action(user["master_id"], "회원완전삭제", member["name"], member_id)
    else:
        db.update_member(member_id, {"status": "비활성"})
        db.log_action(user["master_id"], "회원비활성", member["name"], member_id)
    return RedirectResponse("/members/list?msg=처리완료", status_code=302)

# POST /members/{member_id}/approve
@router.post("/{member_id}/approve")
async def approve_member(request: Request, member_id: int):
    user = get_user(request)
    member = db.get_member(member_id)
    if not member or member["master_id"] != user["master_id"]:
        raise HTTPException(status_code=403)
    db.approve_member_request(member_id)
    db.log_action(user["master_id"], "고객신청승인", member["name"], member_id)
    return RedirectResponse(f"/saju/write/{member_id}", status_code=302)
