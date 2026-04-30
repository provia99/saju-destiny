"""
마스터 시점의 client(손님) 한눈 화면.
- /clients/list  : 자기 마스터의 client 전체 목록 (등급·결제·등록 멤버 수)
- /clients/{id}  : 한 client 상세 (등록 멤버 + 결제 이력 + 책 이력)
"""
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import HTMLResponse
from utils import templates
import db

router = APIRouter()


def _get_user(request: Request):
    mid = request.session.get("master_id")
    if not mid:
        raise HTTPException(302, headers={"Location": "/login"})
    return request.session


def _get_clients_with_summary(master_id: str):
    """마스터의 모든 client + 등급/결제/멤버 요약."""
    conn = db.get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM clients WHERE master_id=? ORDER BY created_at DESC", (master_id,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    for r in rows:
        r["등급정보"] = db.get_member_limit(r["id"])
    return rows


@router.get("/list", response_class=HTMLResponse)
async def clients_list(request: Request):
    user = _get_user(request)
    clients = _get_clients_with_summary(user["master_id"])
    return templates.TemplateResponse(request, "master/client_list.html", {
        "request": request, "user": user, "clients": clients,
        "brand_color": user.get("브랜드색상", "#1A3A6A"),
    })


@router.get("/{client_id}", response_class=HTMLResponse)
async def client_detail(request: Request, client_id: int):
    user = _get_user(request)
    master_id = user["master_id"]

    client = db.get_client(client_id)
    if not client or client["master_id"] != master_id:
        raise HTTPException(404, detail="존재하지 않는 client 입니다.")

    tier = db.get_member_limit(client_id)

    # 등록된 모든 member (활성·비활성·삭제 포함)
    conn = db.get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM members WHERE client_id=? ORDER BY created_at DESC", (client_id,))
    members = [dict(r) for r in c.fetchall()]

    # 책 이력 (member별 그룹)
    member_ids = [m["id"] for m in members]
    books_by_member = {mid: [] for mid in member_ids}
    if member_ids:
        placeholder = ",".join("?" * len(member_ids))
        c.execute(f"SELECT * FROM saju_books WHERE member_id IN ({placeholder}) ORDER BY created_at DESC",
                  member_ids)
        for b in [dict(r) for r in c.fetchall()]:
            books_by_member.setdefault(b["member_id"], []).append(b)
    for m in members:
        m["books"] = books_by_member.get(m["id"], [])

    # 결제 이력 — orders + saju_books (paid_yn=1)
    orders = []
    try:
        c.execute("SELECT * FROM orders WHERE client_id=? ORDER BY created_at DESC", (client_id,))
        orders = [dict(r) for r in c.fetchall()]
    except Exception:
        pass

    paid_books = []
    if member_ids:
        placeholder = ",".join("?" * len(member_ids))
        c.execute(f"SELECT * FROM saju_books WHERE member_id IN ({placeholder}) AND paid_yn=1 ORDER BY completed_at DESC",
                  member_ids)
        paid_books = [dict(r) for r in c.fetchall()]
    conn.close()

    return templates.TemplateResponse(request, "master/client_detail.html", {
        "request": request, "user": user, "client": client, "tier": tier,
        "members": members, "orders": orders, "paid_books": paid_books,
        "brand_color": user.get("브랜드색상", "#1A3A6A"),
    })
