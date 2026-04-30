import db

# 상품 1: 기본 사주 분석 PDF (즉시 배송)
db.insert_product({
    'name': '기본 사주 분석 PDF',
    'price': 29000,
    'delivery_type': 'immediate',
    'delivery_delay_hours': 0,
    'product_type': 'pdf'
})

# 상품 2: 프리미엄 사주 분석 PDF (24시간 후 배송)
db.insert_product({
    'name': '프리미엄 사주 분석 PDF',
    'price': 59000,
    'delivery_type': 'delayed',
    'delivery_delay_hours': 24,
    'product_type': 'pdf'
})

# 상품 3: 사주 책 (48시간 후 배송)
db.insert_product({
    'name': '나의 사주 이야기 책',
    'price': 89000,
    'delivery_type': 'delayed',
    'delivery_delay_hours': 48,
    'product_type': 'book'
})

products = db.get_products()
print(f'총 {len(products)}개 상품 추가 완료!')
for p in products:
    print(f'  - {p["name"]} / {p["price"]}원 / {p["delivery_type"]}')
