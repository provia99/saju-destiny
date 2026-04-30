"""
routers/shop.py - 쇼핑몰 라우터
"""
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from datetime import datetime, timedelta
import db

router = APIRouter(prefix="/shop", tags=["shop"])
templates = Jinja2Templates(directory="templates")

@router.get("/api/products")
async def get_all_products():
    products = db.get_products(is_active=True)
    return products

@router.get("/api/products/{product_id}")
async def get_product_detail(product_id: int):
    product = db.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다")
    return product

@router.get("/products", response_class=HTMLResponse)
async def shop_products_page(request: Request):
    products = db.get_products(is_active=True)
    for p in products:
        p["delivery_info"] = "즉시 배송" if p["delivery_type"] == "immediate" else f"{p['delivery_delay_hours']}시간 후 배송"
    return templates.TemplateResponse(request, "shop/products.html", {"products": products})

@router.get("/products/{product_id}", response_class=HTMLResponse)
async def shop_product_detail(request: Request, product_id: int):
    product = db.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다")
    if product["delivery_type"] == "immediate":
        product["delivery_info"] = "즉시 배송"
        product["delivery_time"] = "주문 후 즉시"
    else:
        product["delivery_info"] = f"{product['delivery_delay_hours']}시간 후 배송"
        dt = datetime.now() + timedelta(hours=product["delivery_delay_hours"])
        product["delivery_time"] = dt.strftime("%Y-%m-%d %H:%M")
    return templates.TemplateResponse(request, "shop/product_detail.html", {"product": product})

@router.get("/cart", response_class=HTMLResponse)
async def cart_page(request: Request):
    return templates.TemplateResponse(request, "shop/cart.html", {})

@router.get("/checkout", response_class=HTMLResponse)
async def checkout_page(request: Request):
    return templates.TemplateResponse(request, "shop/checkout.html", {})

@router.post("/cart/add")
async def add_to_cart(request: Request):
    data = await request.json()
    product_id = data.get("product_id")
    quantity = data.get("quantity", 1)
    product = db.get_product(int(product_id))
    if not product:
        return JSONResponse(status_code=404, content={"success": False, "message": "상품을 찾을 수 없습니다"})
    return JSONResponse(content={"success": True, "message": f"장바구니에 추가되었습니다", "cart_count": 1})
