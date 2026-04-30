"""
admin_orders.py - 관리자 주문 관리 라우터
기존 admin.py에 추가할 주문 관련 엔드포인트
"""
import sqlite3
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from datetime import datetime

templates = Jinja2Templates(directory="templates")


def check_admin(request: Request):
    if request.session.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="관리자만 접근 가능합니다")


def get_all_orders(status_filter=None, search=None):
    """모든 주문 조회 (고객 정보, 상품명, 배송상태 포함)"""
    from config import DB_PATH
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    query = """
        SELECT 
            o.id, o.order_id, o.amount, o.status, o.payment_method,
            o.payment_key, o.created_at, o.updated_at,
            c.name as client_name, c.email as client_email, c.phone as client_phone,
            p.name as product_name, p.product_type, p.delivery_type,
            d.status as delivery_status, d.scheduled_delivery_time, d.actual_delivery_time
        FROM orders o
        LEFT JOIN clients c ON o.client_id = c.id
        LEFT JOIN products p ON o.product_id = p.id
        LEFT JOIN deliveries d ON d.order_id = o.id
        WHERE 1=1
    """
    params = []

    if status_filter:
        query += " AND o.status = ?"
        params.append(status_filter)

    if search:
        query += " AND (c.name LIKE ? OR c.email LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])

    query += " ORDER BY o.created_at DESC"

    c.execute(query, params)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def get_order_stats():
    """주문 통계"""
    from config import DB_PATH
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute("SELECT COUNT(*) as total FROM orders")
    total = c.fetchone()['total']

    c.execute("SELECT COUNT(*) as cnt FROM orders WHERE status='paid'")
    paid = c.fetchone()['cnt']

    c.execute("SELECT COUNT(*) as cnt FROM orders WHERE status='pending'")
    pending = c.fetchone()['cnt']

    c.execute("SELECT COALESCE(SUM(amount), 0) as rev FROM orders WHERE status='paid'")
    revenue = c.fetchone()['rev']

    conn.close()
    return {
        'total': total,
        'paid': paid,
        'pending': pending,
        'revenue': revenue,
    }


# ===== 라우터 함수들 (기존 admin.py에 추가) =====

async def admin_orders_list(request: Request):
    """주문 목록 페이지"""
    check_admin(request)
    status_filter = request.query_params.get('status', '')
    search = request.query_params.get('search', '')

    orders = get_all_orders(
        status_filter=status_filter or None,
        search=search or None
    )
    stats = get_order_stats()

    return templates.TemplateResponse(
        request,
        "admin/orders.html",
        {
            "orders": orders,
            "stats": stats,
            "status_filter": status_filter,
            "search": search,
            "brand_color": "#C8B860",
            "user": request.session,
        }
    )


async def admin_order_detail(request: Request, order_id: int):
    """주문 상세 페이지"""
    check_admin(request)
    from config import DB_PATH
    import db

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute("""
        SELECT o.*, p.name as product_name, p.product_type, p.delivery_type
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        WHERE o.id = ?
    """, (order_id,))
    order = c.fetchone()
    if not order:
        conn.close()
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다")
    order = dict(order)

    client = db.get_client(order['client_id']) if order.get('client_id') else None
    delivery = db.get_delivery_by_order(order_id)
    conn.close()

    return templates.TemplateResponse(
        request,
        "admin/order_detail.html",
        {
            "order": order,
            "client": client,
            "delivery": delivery,
            "brand_color": "#C8B860",
            "user": request.session,
        }
    )


async def admin_order_deliver(request: Request, order_id: int):
    """배송 완료 처리"""
    check_admin(request)
    import db

    delivery = db.get_delivery_by_order(order_id)
    if delivery:
        db.update_delivery(delivery['id'], {
            'status': 'delivered',
            'actual_delivery_time': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })

    return RedirectResponse(
        url=f"/admin/orders/{order_id}?msg=배송완료처리되었습니다",
        status_code=302
    )
