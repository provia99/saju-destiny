import os

# 폴더 생성
os.makedirs("templates/shop", exist_ok=True)
os.makedirs("routers", exist_ok=True)

print("✅ 폴더 생성 완료!")

# ===== routers/shop.py =====
shop_router = '''"""
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
        p["delivery_info"] = "즉시 배송" if p["delivery_type"] == "immediate" else f"{p[\'delivery_delay_hours\']}시간 후 배송"
    return templates.TemplateResponse("shop/products.html", {"request": request, "products": products})

@router.get("/products/{product_id}", response_class=HTMLResponse)
async def shop_product_detail(request: Request, product_id: int):
    product = db.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다")
    if product["delivery_type"] == "immediate":
        product["delivery_info"] = "즉시 배송"
        product["delivery_time"] = "주문 후 즉시"
    else:
        product["delivery_info"] = f"{product[\'delivery_delay_hours\']}시간 후 배송"
        dt = datetime.now() + timedelta(hours=product["delivery_delay_hours"])
        product["delivery_time"] = dt.strftime("%Y-%m-%d %H:%M")
    return templates.TemplateResponse("shop/product_detail.html", {"request": request, "product": product})

@router.get("/cart", response_class=HTMLResponse)
async def cart_page(request: Request):
    return templates.TemplateResponse("shop/cart.html", {"request": request})

@router.get("/checkout", response_class=HTMLResponse)
async def checkout_page(request: Request):
    return templates.TemplateResponse("shop/checkout.html", {"request": request})

@router.post("/cart/add")
async def add_to_cart(request: Request):
    data = await request.json()
    product_id = data.get("product_id")
    quantity = data.get("quantity", 1)
    product = db.get_product(int(product_id))
    if not product:
        return JSONResponse(status_code=404, content={"success": False, "message": "상품을 찾을 수 없습니다"})
    return JSONResponse(content={"success": True, "message": f"장바구니에 추가되었습니다", "cart_count": 1})
'''

with open("routers/shop.py", "w", encoding="utf-8") as f:
    f.write(shop_router)
print("✅ routers/shop.py 생성 완료!")

# ===== templates/shop/products.html =====
products_html = open("templates/shop/products.html", "w", encoding="utf-8")
products_html.write("""<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>반야 쇼핑몰 - 상품 목록</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; background: #f5f5f5; }
        header { background: linear-gradient(135deg, #1a3a6a, #2c5aa0); color: white; padding: 20px; }
        .header-content { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-size: 24px; font-weight: bold; }
        nav a { color: white; text-decoration: none; margin-left: 20px; }
        .container { max-width: 1200px; margin: 40px auto; padding: 0 20px; }
        h1 { color: #1a3a6a; margin-bottom: 10px; }
        .subtitle { color: #666; margin-bottom: 30px; }
        .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
        .product-card { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.3s; }
        .product-card:hover { transform: translateY(-5px); }
        .product-thumb { height: 180px; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; font-size: 60px; }
        .product-body { padding: 15px; }
        .product-name { font-weight: bold; color: #1a3a6a; margin-bottom: 8px; }
        .badge { display: inline-block; background: #e8f0ff; color: #1a3a6a; padding: 3px 8px; border-radius: 4px; font-size: 12px; margin-bottom: 8px; }
        .delivery { font-size: 12px; color: #666; margin-bottom: 8px; }
        .price { font-size: 20px; font-weight: bold; color: #e53935; margin-bottom: 12px; }
        .btn-group { display: flex; gap: 8px; }
        .btn { flex: 1; padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .btn-primary { background: #1a3a6a; color: white; }
        .btn-secondary { background: #f0f0f0; color: #333; }
        .empty { text-align: center; padding: 80px 20px; color: #999; }
        .empty-icon { font-size: 64px; margin-bottom: 20px; }
        footer { background: #1a3a6a; color: white; padding: 30px; text-align: center; margin-top: 60px; }
    </style>
</head>
<body>
<header>
    <div class="header-content">
        <div class="logo">🔮 반야 쇼핑몰</div>
        <nav>
            <a href="/">홈</a>
            <a href="/shop/products">상품</a>
            <a href="/shop/cart">🛒 장바구니</a>
        </nav>
    </div>
</header>
<div class="container">
    <h1>사주 상품</h1>
    <p class="subtitle">당신의 운명을 알아보세요</p>
    <div class="products-grid" id="products-grid"></div>
    <div class="empty" id="empty" style="display:none">
        <div class="empty-icon">📦</div>
        <h2>상품이 없습니다</h2>
        <p>곧 새로운 상품이 추가될 예정입니다.</p>
    </div>
</div>
<footer><p>&copy; 2024 반야 쇼핑몰</p></footer>
<script>
document.addEventListener('DOMContentLoaded', async function() {
    const res = await fetch('/shop/api/products');
    const products = await res.json();
    const grid = document.getElementById('products-grid');
    if (products.length === 0) {
        document.getElementById('empty').style.display = 'block';
        return;
    }
    products.forEach(p => {
        const delivery = p.delivery_type === 'immediate' ? '즉시 배송' : p.delivery_delay_hours + '시간 후 배송';
        const type = p.product_type === 'pdf' ? 'PDF' : '책';
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-thumb">📖</div>
            <div class="product-body">
                <div class="product-name">${p.name}</div>
                <span class="badge">${type}</span>
                <div class="delivery">⏱️ ${delivery}</div>
                <div class="price">₩${p.price.toLocaleString()}</div>
                <div class="btn-group">
                    <button class="btn btn-primary" onclick="addCart(${p.id}, '${p.name}', ${p.price}, '${p.product_type}')">담기</button>
                    <button class="btn btn-secondary" onclick="location.href='/shop/products/${p.id}'">상세</button>
                </div>
            </div>`;
        grid.appendChild(card);
    });
});
function addCart(id, name, price, type) {
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const idx = cart.findIndex(i => i.product_id === id);
    if (idx >= 0) { cart[idx].quantity++; }
    else { cart.push({product_id: id, name, price, quantity: 1, product_type: type}); }
    localStorage.setItem('cart', JSON.stringify(cart));
    alert(name + '이(가) 장바구니에 추가되었습니다!');
}
</script>
</body>
</html>""")
products_html.close()
print("✅ templates/shop/products.html 생성 완료!")

# ===== templates/shop/product_detail.html =====
with open("templates/shop/product_detail.html", "w", encoding="utf-8") as f:
    f.write("""<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>상품 상세 - 반야 쇼핑몰</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; background: #f5f5f5; }
        header { background: linear-gradient(135deg, #1a3a6a, #2c5aa0); color: white; padding: 20px; }
        .header-content { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-size: 24px; font-weight: bold; }
        nav a { color: white; text-decoration: none; margin-left: 20px; }
        .container { max-width: 1200px; margin: 40px auto; padding: 0 20px; }
        .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .product-thumb { height: 400px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 120px; }
        h1 { color: #1a3a6a; margin-bottom: 15px; }
        .badge { display: inline-block; background: #e8f0ff; color: #1a3a6a; padding: 5px 12px; border-radius: 20px; font-size: 12px; margin-right: 8px; }
        .price { font-size: 36px; font-weight: bold; color: #e53935; margin: 20px 0; }
        .delivery-box { background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .qty-row { display: flex; align-items: center; gap: 10px; margin: 20px 0; }
        .qty-btn { width: 36px; height: 36px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; font-size: 18px; }
        .qty-input { width: 56px; height: 36px; text-align: center; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; }
        .btn-group { display: flex; gap: 12px; margin-top: 20px; }
        .btn { flex: 1; padding: 14px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: bold; }
        .btn-primary { background: #1a3a6a; color: white; }
        .btn-secondary { background: #f0f0f0; color: #333; }
        footer { background: #1a3a6a; color: white; padding: 30px; text-align: center; margin-top: 60px; }
        @media(max-width:768px) { .detail-grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
<header>
    <div class="header-content">
        <div class="logo">🔮 반야 쇼핑몰</div>
        <nav>
            <a href="/">홈</a>
            <a href="/shop/products">상품</a>
            <a href="/shop/cart">🛒 장바구니</a>
        </nav>
    </div>
</header>
<div class="container">
    <p style="margin-bottom:20px; color:#666;"><a href="/shop/products" style="color:#1a3a6a;">상품 목록</a> &gt; <span id="pname">상품</span></p>
    <div class="detail-grid">
        <div class="product-thumb">📖</div>
        <div>
            <h1 id="title"></h1>
            <div>
                <span class="badge" id="type-badge"></span>
                <span class="badge" id="delivery-badge" style="background:#fff3e0; color:#e65100;"></span>
            </div>
            <div class="price" id="price"></div>
            <div class="delivery-box">
                <strong>📦 배송 정보</strong>
                <p id="delivery-detail" style="margin-top:8px; color:#666;"></p>
            </div>
            <div class="qty-row">
                <label><strong>수량:</strong></label>
                <button class="qty-btn" onclick="document.getElementById('qty').value=Math.max(1,+document.getElementById('qty').value-1)">−</button>
                <input type="number" id="qty" class="qty-input" value="1" min="1">
                <button class="qty-btn" onclick="document.getElementById('qty').value=+document.getElementById('qty').value+1">+</button>
            </div>
            <div class="btn-group">
                <button class="btn btn-primary" onclick="addCart()">🛒 장바구니 추가</button>
                <button class="btn btn-secondary" onclick="addCart(); setTimeout(()=>location.href='/shop/cart',300)">💳 바로 구매</button>
            </div>
        </div>
    </div>
</div>
<footer><p>&copy; 2024 반야 쇼핑몰</p></footer>
<script>
const pid = location.pathname.split('/').pop();
let product = null;
fetch('/shop/api/products/' + pid).then(r=>r.json()).then(p => {
    product = p;
    document.getElementById('pname').textContent = p.name;
    document.getElementById('title').textContent = p.name;
    document.getElementById('price').textContent = '₩' + p.price.toLocaleString();
    document.getElementById('type-badge').textContent = p.product_type === 'pdf' ? 'PDF' : '책';
    const d = p.delivery_type === 'immediate' ? '즉시 배송' : p.delivery_delay_hours + '시간 후 배송';
    document.getElementById('delivery-badge').textContent = d;
    document.getElementById('delivery-detail').textContent = p.delivery_type === 'immediate' ? '주문 후 즉시 이메일로 전달됩니다.' : '주문 후 ' + p.delivery_delay_hours + '시간 후에 이메일로 전달됩니다.';
});
function addCart() {
    if (!product) return;
    const qty = parseInt(document.getElementById('qty').value);
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const idx = cart.findIndex(i => i.product_id === product.id);
    if (idx >= 0) { cart[idx].quantity += qty; }
    else { cart.push({product_id: product.id, name: product.name, price: product.price, quantity: qty, product_type: product.product_type}); }
    localStorage.setItem('cart', JSON.stringify(cart));
    alert(product.name + '이(가) 장바구니에 추가되었습니다!');
}
</script>
</body>
</html>""")
print("✅ templates/shop/product_detail.html 생성 완료!")

# ===== templates/shop/cart.html =====
with open("templates/shop/cart.html", "w", encoding="utf-8") as f:
    f.write("""<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>장바구니 - 반야 쇼핑몰</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; background: #f5f5f5; }
        header { background: linear-gradient(135deg, #1a3a6a, #2c5aa0); color: white; padding: 20px; }
        .header-content { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-size: 24px; font-weight: bold; }
        nav a { color: white; text-decoration: none; margin-left: 20px; }
        .container { max-width: 1200px; margin: 40px auto; padding: 0 20px; }
        h1 { color: #1a3a6a; margin-bottom: 30px; }
        .layout { display: grid; grid-template-columns: 2fr 1fr; gap: 30px; }
        .cart-box { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .cart-item { display: flex; align-items: center; gap: 15px; padding: 15px 0; border-bottom: 1px solid #eee; }
        .item-thumb { width: 70px; height: 70px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 36px; flex-shrink: 0; }
        .item-info { flex: 1; }
        .item-name { font-weight: bold; color: #1a3a6a; }
        .item-price { color: #e53935; font-weight: bold; margin-top: 4px; }
        .qty-row { display: flex; align-items: center; gap: 8px; }
        .qty-btn { width: 28px; height: 28px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; }
        .qty-input { width: 44px; text-align: center; border: 1px solid #ddd; padding: 4px; border-radius: 4px; }
        .item-total { min-width: 90px; text-align: right; font-weight: bold; color: #e53935; }
        .remove-btn { background: #ff6b6b; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
        .summary { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); height: fit-content; }
        .summary h2 { color: #1a3a6a; margin-bottom: 20px; }
        .sum-row { display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #eee; }
        .total-row { display: flex; justify-content: space-between; font-size: 20px; font-weight: bold; color: #e53935; margin-top: 15px; padding-top: 15px; border-top: 2px solid #eee; }
        .btn { width: 100%; padding: 14px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: bold; margin-top: 12px; }
        .btn-primary { background: #1a3a6a; color: white; }
        .btn-secondary { background: #f0f0f0; color: #333; }
        .empty { text-align: center; padding: 60px; color: #999; }
        footer { background: #1a3a6a; color: white; padding: 30px; text-align: center; margin-top: 60px; }
        @media(max-width:768px) { .layout { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
<header>
    <div class="header-content">
        <div class="logo">🔮 반야 쇼핑몰</div>
        <nav>
            <a href="/">홈</a>
            <a href="/shop/products">상품</a>
            <a href="/shop/cart">🛒 장바구니</a>
        </nav>
    </div>
</header>
<div class="container">
    <h1>🛒 장바구니</h1>
    <div class="layout">
        <div class="cart-box" id="cart-items"></div>
        <div class="summary" id="summary" style="display:none">
            <h2>주문 요약</h2>
            <div class="sum-row"><span>상품 금액</span><span id="subtotal">₩0</span></div>
            <div class="sum-row"><span>배송료</span><span>₩0 (무료)</span></div>
            <div class="total-row"><span>총 결제액</span><span id="total">₩0</span></div>
            <button class="btn btn-primary" onclick="location.href='/shop/checkout'">결제하기</button>
            <button class="btn btn-secondary" onclick="location.href='/shop/products'">쇼핑 계속하기</button>
        </div>
    </div>
</div>
<footer><p>&copy; 2024 반야 쇼핑몰</p></footer>
<script>
function renderCart() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const box = document.getElementById('cart-items');
    if (cart.length === 0) {
        box.innerHTML = '<div class="empty"><div style="font-size:64px">🛒</div><h2>장바구니가 비어있습니다</h2><button class="btn btn-primary" onclick="location.href=\'/shop/products\'" style="width:auto;padding:12px 24px;margin-top:20px;">쇼핑하러 가기</button></div>';
        document.getElementById('summary').style.display = 'none';
        return;
    }
    let subtotal = 0;
    box.innerHTML = '';
    cart.forEach((item, i) => {
        const total = item.price * item.quantity;
        subtotal += total;
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `<div class="item-thumb">📖</div>
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-price">₩${item.price.toLocaleString()}</div>
                <div class="qty-row">
                    <button class="qty-btn" onclick="changeQty(${i},-1)">−</button>
                    <input class="qty-input" type="number" value="${item.quantity}" onchange="setQty(${i},this.value)" min="1">
                    <button class="qty-btn" onclick="changeQty(${i},1)">+</button>
                </div>
            </div>
            <div class="item-total">₩${total.toLocaleString()}</div>
            <button class="remove-btn" onclick="removeItem(${i})">제거</button>`;
        box.appendChild(div);
    });
    document.getElementById('subtotal').textContent = '₩' + subtotal.toLocaleString();
    document.getElementById('total').textContent = '₩' + subtotal.toLocaleString();
    document.getElementById('summary').style.display = 'block';
}
function changeQty(i, d) {
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cart[i].quantity = Math.max(1, cart[i].quantity + d);
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCart();
}
function setQty(i, v) {
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cart[i].quantity = Math.max(1, parseInt(v) || 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCart();
}
function removeItem(i) {
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cart.splice(i, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCart();
}
renderCart();
</script>
</body>
</html>""")
print("✅ templates/shop/cart.html 생성 완료!")

# ===== templates/shop/checkout.html =====
with open("templates/shop/checkout.html", "w", encoding="utf-8") as f:
    f.write("""<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>결제 - 반야 쇼핑몰</title>
    <script src="https://js.tosspayments.com/v1/payment"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; background: #f5f5f5; }
        header { background: linear-gradient(135deg, #1a3a6a, #2c5aa0 ); color: white; padding: 20px; }
        .header-content { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-size: 24px; font-weight: bold; }
        .container { max-width: 1200px; margin: 40px auto; padding: 0 20px; }
        h1 { color: #1a3a6a; margin-bottom: 30px; }
        .layout { display: grid; grid-template-columns: 2fr 1fr; gap: 30px; }
        .form-box { background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .form-box h2 { color: #1a3a6a; margin-bottom: 20px; border-bottom: 2px solid #1a3a6a; padding-bottom: 10px; }
        .form-group { margin-bottom: 18px; }
        .form-group label { display: block; font-weight: bold; margin-bottom: 6px; }
        .form-group input { width: 100%; padding: 11px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
        .form-group input:focus { outline: none; border-color: #1a3a6a; }
        .required { color: #e53935; }
        .pay-method { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
        .pay-option { flex: 1; min-width: 120px; padding: 14px; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; text-align: center; transition: all 0.2s; }
        .pay-option.active { border-color: #1a3a6a; background: #f0f4ff; }
        .agree-box { background: #f9f9f9; padding: 15px; border-radius: 8px; margin-top: 10px; }
        .agree-box label { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; cursor: pointer; font-size: 14px; color: #555; }
        .summary { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); height: fit-content; position: sticky; top: 20px; }
        .summary h2 { color: #1a3a6a; margin-bottom: 20px; }
        .order-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .sum-row { display: flex; justify-content: space-between; margin: 12px 0; color: #666; }
        .total-row { display: flex; justify-content: space-between; font-size: 20px; font-weight: bold; color: #e53935; margin-top: 15px; padding-top: 15px; border-top: 2px solid #eee; }
        .btn { width: 100%; padding: 15px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: bold; margin-top: 12px; }
        .btn-primary { background: #1a3a6a; color: white; }
        .btn-secondary { background: #f0f0f0; color: #333; }
        footer { background: #1a3a6a; color: white; padding: 30px; text-align: center; margin-top: 60px; }
        @media(max-width:768px) { .layout { grid-template-columns: 1fr; } .summary { position: static; } }
    </style>
</head>
<body>
<header>
    <div class="header-content">
        <div class="logo">🔮 반야 쇼핑몰</div>
    </div>
</header>
<div class="container">
    <h1>💳 결제</h1>
    <div class="layout">
        <div>
            <div class="form-box">
                <h2>📦 배송 정보</h2>
                <div class="form-group"><label>이름 <span class="required">*</span></label><input type="text" id="name" placeholder="고객명"></div>
                <div class="form-group"><label>이메일 <span class="required">*</span></label><input type="email" id="email" placeholder="이메일 주소"></div>
                <div class="form-group"><label>휴대폰 <span class="required">*</span></label><input type="tel" id="phone" placeholder="010-0000-0000"></div>
            </div>
            <div class="form-box">
                <h2>💰 결제 방법</h2>
                <div class="pay-method">
                    <div class="pay-option active" onclick="selectPay(this,'card')">💳 신용카드</div>
                    <div class="pay-option" onclick="selectPay(this,'transfer')">🏦 계좌이체</div>
                    <div class="pay-option" onclick="selectPay(this,'phone')">📱 휴대폰</div>
                </div>
                <input type="hidden" id="pay-method" value="card">
            </div>
            <div class="form-box">
                <h2>✓ 약관 동의</h2>
                <div class="agree-box">
                    <label><input type="checkbox" id="agree1"> 주문 및 결제에 동의합니다 (필수)</label>
                    <label><input type="checkbox" id="agree2"> 개인정보 수집 및 이용에 동의합니다 (필수)</label>
                    <label><input type="checkbox" id="agree3"> 마케팅 정보 수신에 동의합니다 (선택)</label>
                </div>
            </div>
        </div>
        <div class="summary">
            <h2>주문 요약</h2>
            <div id="order-items"></div>
            <div class="sum-row"><span>상품 금액</span><span id="subtotal">₩0</span></div>
            <div class="sum-row"><span>배송료</span><span>₩0 (무료)</span></div>
            <div class="total-row"><span>총 결제액</span><span id="total">₩0</span></div>
            <button class="btn btn-primary" onclick="pay()">결제하기</button>
            <button class="btn btn-secondary" onclick="location.href='/shop/cart'">장바구니로 돌아가기</button>
        </div>
    </div>
</div>
<footer><p>&copy; 2024 반야 쇼핑몰</p></footer>
<script>
const cart = JSON.parse(localStorage.getItem('cart') || '[]');
if (!cart.length) { alert('장바구니가 비어있습니다.'); location.href='/shop/products'; }
let total = 0;
const itemsDiv = document.getElementById('order-items');
cart.forEach(item => {
    const t = item.price * item.quantity;
    total += t;
    const d = document.createElement('div');
    d.className = 'order-item';
    d.innerHTML = `<span>${item.name} x${item.quantity}</span><span style="color:#e53935;font-weight:bold">₩${t.toLocaleString()}</span>`;
    itemsDiv.appendChild(d);
});
document.getElementById('subtotal').textContent = '₩' + total.toLocaleString();
document.getElementById('total').textContent = '₩' + total.toLocaleString();
function selectPay(el, val) {
    document.querySelectorAll('.pay-option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('pay-method').value = val;
}
async function pay() {
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    if (!name || !email || !phone) { alert('필수 정보를 입력해주세요.'); return; }
    if (!document.getElementById('agree1').checked || !document.getElementById('agree2').checked) { alert('필수 약관에 동의해주세요.'); return; }
    try {
        const res = await fetch('/payments/create-order', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({customer_name: name, customer_email: email, customer_phone: phone, cart, total_amount: total})
        });
        const result = await res.json();
        if (result.success) {
            const tossPayments = window.TossPayments(result.client_key);
            tossPayments.requestPayment('카드', {
                amount: total,
                orderId: result.order_id,
                orderName: '반야 사주 상품',
                customerName: name,
                customerEmail: email,
                successUrl: window.location.origin + '/payments/success',
                failUrl: window.location.origin + '/payments/fail'
            });
        } else {
            alert('주문 생성 실패: ' + result.message);
        }
    } catch(e) {
        alert('결제 처리 중 오류가 발생했습니다.');
    }
}
</script>
</body>
</html>""")
print("✅ templates/shop/checkout.html 생성 완료!")

print("")
print("🎉 모든 파일 생성 완료!")
print("📂 생성된 파일:")
print("   - routers/shop.py")
print("   - templates/shop/products.html")
print("   - templates/shop/product_detail.html")
print("   - templates/shop/cart.html")
print("   - templates/shop/checkout.html")
