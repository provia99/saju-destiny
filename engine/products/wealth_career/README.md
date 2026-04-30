# 재물·직업·창업 풀이 (wealth_career)

가격: 79,000원 / 분량: 25,000~90,000자 / cover 동물 있음

## 필요한 추가 입력 (구매 시 폼)
- 현재 직업/직군 (선택, 없으면 무직/구직중)
- 창업/사업 관심 분야 (선택)
- 주 소득원 (월급/사업/투자/혼합)
- 재테크 관심도 (보수형/안정형/공격형)

## 필수 표 (PRODUCT_SPECS.required_tables)
- cover (재물·직업·창업 전용 cover, 총본 cover 공유 금지)
- 명식표
- 인적사항표
- 사주기본표
- 재물전략표
- 직업표
- 신강약직업표
- 용신가이드카드

## 필수 본문 (PRODUCT_SPECS.required_data)
- ch03 (재물운)
- ch08 (직업운)
- ch11 (창업·사업)

## 구현 파일 (TODO)
- generate_cover_wealth.js — 상품별 전용 cover (per-product 원칙)
- generate_재물전략표.js
- generate_신강약직업표.js
- run_wealth_career.js — 메인 runner (run_all.js 패턴 차용)

## 참고
- saju_calc 단일소스 원칙: 모든 5신/대운길흉은 saju_calc 결과를 그대로 사용
- 폰트는 engine/fonts 폴더 폰트만 사용
