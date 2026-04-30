"""
routers/payments.py - Toss Payments 결제 라우터
결제 요청, 승인, 성공/실패 처리
"""
import httpx
import base64
import uuid
import hashlib
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from datetime import datetime, timedelta
from config import TOSS_CLIENT_KEY, TOSS_SECRET_KEY
import db

router = APIRouter(prefix="/payments", tags=["payments"])
templates = Jinja2Templates(directory="templates")

# B2C 전용 master_id (쇼핑몰 공용)
B2C_MASTER_ID = "b2c_shop"


def get_toss_auth_header():
    """Toss Payments 인증 헤더 생성"""
    credentials = base64.b64encode(f"{TOSS_SECRET_KEY}:".encode()).decode()
    return {
        "Authorization": f"Basic {credentials}",
        "Content-Type": "application/json"
    }


def hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


@router.post("/create-order")
async def create_order(request: Request):
    """결제 전 주문 생성"""
    try:
        data = await request.json()

        customer_name  = data.get("customer_name", "").strip()
        customer_email = data.get("customer_email", "").strip()
        customer_phone = data.get("customer_phone", "").strip()
        cart           = data.get("cart", [])
        total_amount   = data.get("total_amount", 0)

        if not customer_name or not customer_email or not cart:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "필수 정보가 없습니다."}
            )

        # 고객 조회 또는 생성 (B2C 전용 master_id 사용)
        client = db.get_client_by_email(B2C_MASTER_ID, customer_email)
        if not client:
            client_id = db.insert_client({
                "master_id":     B2C_MASTER_ID,
                "name":          customer_name,
                "email":         customer_email,
                "password_hash": hash_pw(customer_email),  # 임시 비밀번호
                "phone":         customer_phone,
            })
        else:
            client_id = client["id"]

        # 장바구니 상품별 주문 생성
        order_ids = []
        for item in cart:
            product_id = item.get("product_id")
            quantity   = item.get("quantity", 1)
            product    = db.get_product(int(product_id))

            if not product:
                continue

            item_amount = product["price"] * quantity

            order_pk = db.insert_order({
                "client_id":      client_id,
                "product_id":     product["id"],
                "amount":         item_amount,
                "payment_method": "toss",
            })
            order_ids.append(order_pk)

        # Toss에 전달할 고유 주문 ID
        toss_order_id = f"BANYA-{uuid.uuid4().hex[:16].upper()}"

        # 세션에 주문 정보 저장
        request.session["pending_order"] = {
            "toss_order_id":  toss_order_id,
            "order_ids":      order_ids,
            "total_amount":   total_amount,
            "customer_name":  customer_name,
            "customer_email": customer_email,
            "customer_phone": customer_phone,
            "cart":           cart,
        }

        return JSONResponse(content={
            "success":    True,
            "order_id":   toss_order_id,
            "client_key": TOSS_CLIENT_KEY,
        })

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": str(e)}
        )


@router.get("/success")
async def payment_success(
    request: Request,
    paymentKey: str,
    orderId: str,
    amount: int
):
    """Toss Payments 결제 성공 콜백 - 결제 승인 처리"""
    try:
        # Toss Payments 결제 승인 API 호출
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.tosspayments.com/v1/payments/confirm",
                headers=get_toss_auth_header(),
                json={
                    "paymentKey": paymentKey,
                    "orderId":    orderId,
                    "amount":     amount,
                }
            )

        result = response.json()

        if response.status_code != 200:
            error_msg = result.get("message", "결제 승인 실패")
            return RedirectResponse(
                url=f"/payments/fail?message={error_msg}",
                status_code=302
            )

        # 세션에서 주문 정보 가져오기
        pending        = request.session.get("pending_order", {})
        order_ids      = pending.get("order_ids", [])
        customer_email = pending.get("customer_email", "")
        cart           = pending.get("cart", [])

        # 주문 상태 업데이트 및 배송 생성
        for i, order_pk in enumerate(order_ids):
            db.update_order(order_pk, {
                "status":         "paid",
                "payment_key":    paymentKey,
                "payment_method": result.get("method", "카드"),
            })

            if i < len(cart):
                item    = cart[i]
                product = db.get_product(int(item.get("product_id")))
                if product:
                    if product["delivery_type"] == "immediate":
                        scheduled_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    else:
                        delay_hours    = product.get("delivery_delay_hours", 24)
                        scheduled_time = (
                            datetime.now() + timedelta(hours=delay_hours)
                        ).strftime("%Y-%m-%d %H:%M:%S")

                    db.insert_delivery(order_pk, scheduled_time)

        # 세션 정리
        request.session.pop("pending_order", None)

        return templates.TemplateResponse(
            request,
            "shop/payment_success.html",
            {
                "payment_key":    paymentKey,
                "order_id":       orderId,
                "amount":         amount,
                "customer_email": customer_email,
                "method":         result.get("method", "카드"),
                "approved_at":    result.get("approvedAt", ""),
            }
        )

    except Exception as e:
        return RedirectResponse(
            url=f"/payments/fail?message={str(e)}",
            status_code=302
        )


@router.get("/fail")
async def payment_fail(request: Request, message: str = "결제에 실패했습니다."):
    """결제 실패 페이지"""
    return templates.TemplateResponse(
        request,
        "shop/payment_fail.html",
        {"message": message}
    )
