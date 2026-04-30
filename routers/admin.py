from fastapi import APIRouter, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from utils import templates
import db, brand, uuid
from config import BRANDS_DIR

router = APIRouter()


def check_admin(request: Request):
    if request.session.get("role") != "admin":
        raise HTTPException(status_code=302, headers={"Location": "/login"})

# GET /admin/dashboard
@router.get("/dashboard", response_class=HTMLResponse)
async def admin_dashboard(request: Request):
    check_admin(request)
    masters = db.get_all_masters()
    stats = {
        "전체마스터": len(masters),
        "활성": len([m for m in masters if m["status"]=="활성"]),
        "대기": len([m for m in masters if m["status"]=="대기"]),
        "정지": len([m for m in masters if m["status"]=="정지"]),
    }
    return templates.TemplateResponse(request, "admin/dashboard.html",
        {"request": request, "masters": masters, "stats": stats,
         "user": request.session, "brand_color": "#C8B860"})


# GET /admin/overview - 전체 시스템 한눈 (마스터·client·매출·등급분포)
@router.get("/overview", response_class=HTMLResponse)
async def admin_overview(request: Request):
    check_admin(request)
    conn = db.get_conn()
    c = conn.cursor()

    # 1) 전체 마스터·client·member·book 카운트
    sys_stats = {}
    for sql, key in [
        ("SELECT COUNT(*) FROM masters", "masters"),
        ("SELECT COUNT(*) FROM clients", "clients"),
        ("SELECT COUNT(*) FROM members WHERE status='활성'", "members_active"),
        ("SELECT COUNT(*) FROM members", "members_total"),
        ("SELECT COUNT(*) FROM saju_books", "books"),
        ("SELECT COUNT(*) FROM saju_books WHERE paid_yn=1", "books_paid"),
        ("SELECT COALESCE(SUM(price),0) FROM saju_books WHERE paid_yn=1", "revenue_books"),
    ]:
        try:
            c.execute(sql); sys_stats[key] = int(c.fetchone()[0] or 0)
        except Exception: sys_stats[key] = 0
    try:
        c.execute("SELECT COALESCE(SUM(amount),0) FROM orders WHERE status IN ('paid','completed','done','승인','완료')")
        sys_stats["revenue_orders"] = int(c.fetchone()[0] or 0)
    except Exception: sys_stats["revenue_orders"] = 0
    sys_stats["revenue_total"] = sys_stats["revenue_books"] + sys_stats["revenue_orders"]

    # 2) 마스터별 상세 (각 마스터의 client·member·매출)
    c.execute("SELECT * FROM masters ORDER BY created_at DESC")
    masters = [dict(r) for r in c.fetchall()]
    for m in masters:
        c.execute("SELECT COUNT(*) FROM clients WHERE master_id=?", (m["master_id"],))
        m["clients_cnt"] = int(c.fetchone()[0] or 0)
        c.execute("SELECT COUNT(*) FROM members WHERE master_id=? AND status='활성'", (m["master_id"],))
        m["members_cnt"] = int(c.fetchone()[0] or 0)
        c.execute("SELECT COALESCE(SUM(price),0) FROM saju_books WHERE master_id=? AND paid_yn=1", (m["master_id"],))
        m["revenue"] = int(c.fetchone()[0] or 0)

    # 3) 등급 분포 (전체 client)
    c.execute("SELECT id FROM clients")
    all_client_ids = [r[0] for r in c.fetchall()]
    tier_dist = {5: 0, 10: 0, 20: 0, 50: 0}
    top_clients = []
    for cid in all_client_ids:
        t = db.get_member_limit(cid)
        tier_dist[t["limit"]] = tier_dist.get(t["limit"], 0) + 1
        if t["paid"] > 0:
            top_clients.append({"client_id": cid, **t})
    top_clients.sort(key=lambda x: x["paid"], reverse=True)
    top_clients = top_clients[:10]
    # client name 보강
    for tc in top_clients:
        c.execute("SELECT name, master_id, email FROM clients WHERE id=?", (tc["client_id"],))
        r = c.fetchone()
        if r:
            tc["name"], tc["master_id"], tc["email"] = r[0], r[1], r[2]

    conn.close()

    return templates.TemplateResponse(request, "admin/overview.html", {
        "request": request, "user": request.session,
        "sys_stats": sys_stats, "masters": masters,
        "tier_dist": tier_dist, "top_clients": top_clients,
        "brand_color": "#C8B860",
    })

# GET /admin/masters  (목록)
@router.get("/masters", response_class=HTMLResponse)
async def master_list(request: Request, search: str = "", status: str = "전체"):
    check_admin(request)
    masters = db.get_all_masters(search=search or None, status=status or None)
    return templates.TemplateResponse(request, "admin/master_list.html", 
        {"request": request, "masters": masters,
         "search": search, "status": status,
         "user": request.session, "brand_color": "#C8B860"})

# GET /admin/masters/new  (등록 폼)
@router.get("/masters/new", response_class=HTMLResponse)
async def master_new_form(request: Request):
    check_admin(request)
    return templates.TemplateResponse(request, "admin/master_form.html", 
        {"request": request, "mode": "new", "master": {},
         "user": request.session, "brand_color": "#C8B860"})

# POST /admin/masters/new  (등록 처리)
@router.post("/masters/new")
async def master_new_post(request: Request,
    login_id: str = Form(...), password: str = Form(...), password2: str = Form(...),
    선생님이름: str = Form(...), 연구소명: str = Form(""),
    서명문구: str = Form(""), 마무리인사: str = Form(""),
    호칭조사: str = Form("이"), 연락처: str = Form(""),
    이메일: str = Form(""), 홈페이지: str = Form(""),
    카카오채널: str = Form(""), 브랜드색상: str = Form("#1A3A6A"),
    금색: str = Form("#C8B860"), plan: str = Form("basic"),
    status: str = Form("대기"), memo: str = Form("")):
    check_admin(request)

    errors = []
    if not login_id: errors.append("로그인 ID 필수")
    if len(password) < 8: errors.append("비밀번호 8자 이상")
    if password != password2: errors.append("비밀번호 불일치")
    if not 선생님이름: errors.append("선생님 이름 필수")
    if db.get_master(login_id): errors.append("이미 존재하는 ID")
    if errors:
        return templates.TemplateResponse(request, "admin/master_form.html", 
            {"request": request, "mode": "new", "errors": errors,
             "master": dict(request._form),
             "user": request.session, "brand_color": "#C8B860"})

    data = {
        "master_id": login_id, "login_id": login_id,
        "password_hash": db.hash_pw(password),
        "선생님이름": 선생님이름, "연구소명": 연구소명,
        "서명문구": 서명문구, "마무리인사": 마무리인사,
        "호칭조사": 호칭조사, "연락처": 연락처,
        "이메일": 이메일, "홈페이지": 홈페이지,
        "카카오채널": 카카오채널, "브랜드색상": 브랜드색상,
        "금색": 금색, "plan": plan, "status": status, "memo": memo,
        "api_key": f"{login_id}-{uuid.uuid4().hex[:8]}",
    }
    db.insert_master(data)
    brand.create_brand_profile(data)
    db.log_action("admin", "마스터등록", login_id)
    return RedirectResponse("/admin/masters?msg=등록완료", status_code=302)

# GET /admin/masters/{master_id}/edit  (수정 폼)
@router.get("/masters/{master_id}/edit", response_class=HTMLResponse)
async def master_edit_form(request: Request, master_id: str):
    check_admin(request)
    master = db.get_master(master_id)
    if not master: raise HTTPException(status_code=404)
    return templates.TemplateResponse(request, "admin/master_form.html", 
        {"request": request, "mode": "edit", "master": master,
         "user": request.session, "brand_color": "#C8B860"})

# POST /admin/masters/{master_id}/edit  (수정 처리)
@router.post("/masters/{master_id}/edit")
async def master_edit_post(request: Request, master_id: str,
    선생님이름: str = Form(...), 연구소명: str = Form(""),
    서명문구: str = Form(""), 마무리인사: str = Form(""),
    호칭조사: str = Form("이"), 연락처: str = Form(""),
    이메일: str = Form(""), 홈페이지: str = Form(""),
    카카오채널: str = Form(""), 브랜드색상: str = Form("#1A3A6A"),
    금색: str = Form("#C8B860"), plan: str = Form("basic"),
    status: str = Form("활성"), memo: str = Form(""),
    new_password: str = Form("")):
    check_admin(request)
    data = dict(선생님이름=선생님이름, 연구소명=연구소명, 서명문구=서명문구,
                마무리인사=마무리인사, 호칭조사=호칭조사, 연락처=연락처,
                이메일=이메일, 홈페이지=홈페이지, 카카오채널=카카오채널,
                브랜드색상=브랜드색상, 금색=금색, plan=plan,
                status=status, memo=memo)
    if new_password and len(new_password) >= 8:
        data["password_hash"] = db.hash_pw(new_password)
    db.update_master(master_id, data)
    brand.update_brand_profile(master_id, data)
    db.log_action("admin", "마스터수정", master_id)
    return RedirectResponse("/admin/masters?msg=수정완료", status_code=302)

# POST /admin/masters/{master_id}/toggle  (활성화↔정지)
@router.post("/masters/{master_id}/toggle")
async def master_toggle(request: Request, master_id: str):
    check_admin(request)
    master = db.get_master(master_id)
    if not master: raise HTTPException(status_code=404)
    new_status = "정지" if master["status"] == "활성" else "활성"
    db.update_master(master_id, {"status": new_status})
    db.log_action("admin", f"마스터{new_status}", master_id)
    return RedirectResponse("/admin/masters?msg=상태변경완료", status_code=302)

# ===== 주문 관리 =====
@router.get("/orders", response_class=HTMLResponse)
async def orders_list(request: Request, status: str = "", search: str = ""):
    from admin_orders_router import admin_orders_list
    return await admin_orders_list(request)

@router.get("/orders/{order_id}", response_class=HTMLResponse)
async def order_detail(request: Request, order_id: int):
    from admin_orders_router import admin_order_detail
    return await admin_order_detail(request, order_id)

@router.post("/orders/{order_id}/deliver")
async def order_deliver(request: Request, order_id: int):
    from admin_orders_router import admin_order_deliver
    return await admin_order_deliver(request, order_id)


# ===== 메인 배너 슬라이더 관리 =====
@router.get("/banners", response_class=HTMLResponse)
async def banner_list(request: Request, master_id: str = ""):
    check_admin(request)
    # 마스터 필터: master_id="" → 전체, "global" → 전역만, 그 외 → 그 마스터만
    conn = db.get_conn()
    c = conn.cursor()
    if master_id == "global":
        c.execute("SELECT * FROM banners WHERE master_id='' ORDER BY position, id")
    elif master_id:
        c.execute("SELECT * FROM banners WHERE master_id=? ORDER BY position, id", (master_id,))
    else:
        c.execute("SELECT * FROM banners ORDER BY master_id, position, id")
    banners = [dict(r) for r in c.fetchall()]
    conn.close()
    masters = db.get_all_masters()
    return templates.TemplateResponse(request, "admin/banner_list.html", {
        "request": request, "banners": banners, "masters": masters,
        "filter_master": master_id, "user": request.session, "brand_color": "#C8B860",
    })


@router.get("/banners/new", response_class=HTMLResponse)
async def banner_new_form(request: Request):
    check_admin(request)
    masters = db.get_all_masters()
    return templates.TemplateResponse(request, "admin/banner_form.html", {
        "request": request, "mode": "new", "banner": {},
        "masters": masters, "user": request.session, "brand_color": "#C8B860",
    })


@router.post("/banners/new")
async def banner_new_post(request: Request,
    master_id:    str = Form(""),
    badge:        str = Form(""),
    title_top:    str = Form(""),
    title_bottom: str = Form(""),
    sub:          str = Form(""),
    icon:         str = Form(""),
    href:         str = Form(""),
    position:     int = Form(0),
    is_active:    int = Form(1)):
    check_admin(request)
    db.insert_banner({
        "master_id": master_id.strip(),
        "badge": badge, "title_top": title_top, "title_bottom": title_bottom,
        "sub": sub, "icon": icon, "href": href,
        "position": position, "is_active": is_active,
    })
    db.log_action("admin", "배너등록", title_top or badge)
    return RedirectResponse("/admin/banners?msg=등록완료", status_code=302)


@router.get("/banners/{banner_id}/edit", response_class=HTMLResponse)
async def banner_edit_form(request: Request, banner_id: int):
    check_admin(request)
    banner = db.get_banner(banner_id)
    if not banner:
        raise HTTPException(404, detail="배너 없음")
    masters = db.get_all_masters()
    return templates.TemplateResponse(request, "admin/banner_form.html", {
        "request": request, "mode": "edit", "banner": banner,
        "masters": masters, "user": request.session, "brand_color": "#C8B860",
    })


@router.post("/banners/{banner_id}/edit")
async def banner_edit_post(request: Request, banner_id: int,
    master_id:    str = Form(""),
    badge:        str = Form(""),
    title_top:    str = Form(""),
    title_bottom: str = Form(""),
    sub:          str = Form(""),
    icon:         str = Form(""),
    href:         str = Form(""),
    position:     int = Form(0),
    is_active:    int = Form(1)):
    check_admin(request)
    db.update_banner(banner_id, {
        "master_id": master_id.strip(),
        "badge": badge, "title_top": title_top, "title_bottom": title_bottom,
        "sub": sub, "icon": icon, "href": href,
        "position": position, "is_active": is_active,
    })
    db.log_action("admin", "배너수정", f"#{banner_id} {title_top or badge}")
    return RedirectResponse("/admin/banners?msg=수정완료", status_code=302)


@router.post("/banners/{banner_id}/delete")
async def banner_delete(request: Request, banner_id: int):
    check_admin(request)
    db.delete_banner(banner_id)
    db.log_action("admin", "배너삭제", f"#{banner_id}")
    return RedirectResponse("/admin/banners?msg=삭제완료", status_code=302)

