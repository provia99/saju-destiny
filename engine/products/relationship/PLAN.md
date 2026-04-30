# 인간관계도 상품 — 개발 계획서

**작성일**: 2026-04-27
**현재 상태**: Phase 1 완료 (계산 엔진), Phase 2/3 대기

---

## 1. 상품 개요

### 핵심 가치
> "**나를 중심으로 가족·친구·직장 동료의 운명적 매칭을 한눈에**"

### 기존 궁합 상품과의 차별점
- **N명 동시 분석** (궁합은 1:1)
- **관계 유형별 맞춤 가중치** (직장·가족·친구마다 중요한 축이 다름)
- **운명적 패턴 자동 감지** (고부 갈등·멘토 인연 등 16종)

### 결정사항 (확정)
- **소유자 모델**: 사적 — 개인(고객) 본인용 (옵션 B)
- **단일 소스 원칙**: saju_calc만 의존 (compatibility_calc 호출 X)
- **나머지 모듈은 모두 독립** (engine/products/relationship/ 격리)

---

## 2. Phase 1 ✅ 완료 — 계산 엔진

### 작성 파일
- [`engine/products/relationship/relationship_calc.js`](relationship_calc.js) (~450줄)
- [`engine/products/relationship/test_relationship.js`](test_relationship.js) — CLI 검증 스크립트
- [`engine/products/relationship/PLAN.md`](PLAN.md) — 본 문서

### 핵심 함수
```js
// 1:1 분석
const r = 관계분석(meInput, otherInput, '직장상사');

// N명 일괄 분석 (점수순 정렬)
const list = 관계도분석(meInput, [
  { ...person1, relationType: '부모자녀', displayName: '엄마' },
  { ...person2, relationType: '직장동료', displayName: '김대리' },
  ...
]);
```

### 관계 유형 16종 가중치 (RELATION_WEIGHTS)
| 카테고리 | 유형 | 핵심 축 |
|---|---|---|
| **연애** | 연인 / 부부 | 친밀도 + 용신교차 + 일간상성 |
| **가족** | 부모자녀 | 십성관계 0.30 + 오행보완 0.20 + 일간상성 0.20 |
| | 형제자매 | 일간상성 0.30 + 오행보완 0.20 |
| | 시댁처가 | 신살교차 0.20 + 십성관계 0.25 |
| | 조부모손주 | 년주관계 0.30 + 시주관계 0.30 (격대) |
| | 친척 | 인연깊이 0.30 + 일지관계 0.25 |
| **직장** | 직장상사 / 직장부하 | 십성관계 0.35 + 용신교차 0.25 |
| | 직장동료 | 십성관계 0.30 + 용신교차 0.25 |
| | 비즈니스 | 용신교차 0.25 + 십성관계 0.25 |
| **기타** | 친구 | 일간상성 0.25 + 오행보완 0.25 |
| | 스승 / 제자 | 십성관계 0.35 + 인연깊이 0.20 |
| | 경쟁자 | 합충교차 0.30 + 일간상성 0.30 |
| | 기타 | 균등 분배 |

### 점수 함수 12종
일간상성 · 오행보완 · 용신교차 · 합충교차 · 십성관계 · 친밀도 · 대운시기 · 인연깊이 · 년주관계 · 시주관계 · 일지관계 · 신살교차

### 패턴 진단 16종
| ID | 적용 관계 | 의미 |
|---|---|---|
| 부모권위반항 | 부모자녀 | 일간 천간충 |
| 자녀부담 | 부모자녀 | 자녀 일간 = 부모 기신 |
| 형제재물다툼 | 형제자매 | 비겁과다 + 같은 오행 |
| 고부갈등 | 시댁처가 | 시부모 일간 = 본인 기신 |
| 천생가족 | 가족 5종 | 상대 일간 = 본인 용신 |
| 격대사랑 | 조부모손주 | 일지 ↔ 년지 합/삼합 |
| 천생연분동료 | 직장 3종 | 상호 용신 교차 |
| 에너지뺏김 | 직장+비즈 | 상대 일간 = 본인 기신 |
| 멘토인연 | 상사·스승 | 상대가 본인 인성 |
| 제자인연 | 부하·제자 | 상대가 본인 식상 |
| 권위충돌 | 직장상하 | 일간 천간충 |
| 평생친구 | 친구 | 천간합 또는 일지 삼합 |
| 라이벌 | 경쟁/형제/동료 | 같은 일간 다른 일지 |
| 원진관계 | 전체 | 일지 원진살 |
| 귀문관살 | 전체 | 일지 귀문 |
| 운명적인연 | 전체 | 천간합 + 삼합 |

### 검증 결과 (정종욱 + 6명)
| 관계 | 점수 | 라벨 | 검출 패턴 |
|---|---|---|---|
| 최규철 (직장동료) | 67 | 무난 | — |
| 정래호 (형제) | 67 | 무난 | ✨ 천생 가족 |
| 임효원 (배우자) | 64 | 무난 | (일간합 90점) |
| 아라 (제자) | 63 | 무난 | 🌱 제자 인연 |
| 윤님 (상사) | 53 | ⚠️ 주의 | 😩 에너지 뺏김 |
| 김나은 (친구) | 52 | ⚠️ 주의 | 🤝 평생 친구 |

→ 패턴 감지 정확. saju_calc 단일 소스 작동 확인.

---

## 3. Phase 2 — 웹 UI (대기)

### DB 스키마 추가 ([db.py](../../../db.py))
```sql
CREATE TABLE IF NOT EXISTS relationship_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    master_id TEXT NOT NULL,
    member_id INTEGER NOT NULL,           -- 관계도 주인 (본인)
    name TEXT NOT NULL,                   -- "내 인간관계 2026"
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (master_id) REFERENCES masters(master_id),
    FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE TABLE IF NOT EXISTS relationship_persons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    birth_year INTEGER NOT NULL,
    birth_month INTEGER NOT NULL,
    birth_day INTEGER NOT NULL,
    birth_time TEXT DEFAULT '모름',
    gender TEXT NOT NULL,
    lunar_yn INTEGER DEFAULT 0,
    leap_month_yn INTEGER DEFAULT 0,
    relation_type TEXT NOT NULL,          -- '부모자녀', '직장상사' 등 16종
    relation_subtype TEXT DEFAULT '',     -- '엄마', '김대리' 등 자유 메모
    memo TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (group_id) REFERENCES relationship_groups(id)
);
CREATE INDEX IF NOT EXISTS idx_rel_persons_group ON relationship_persons(group_id);
```

마이그레이션 함수 (db.py:migrate)에서 try/except 패턴으로 추가.

### 라우터 ([routers/relationship.py](../../../routers/relationship.py)) — 신규
```
GET  /relationship/{member_id}              — 관계도 화면 (리스트뷰)
POST /relationship/{member_id}/add          — 사람 추가
POST /relationship/{member_id}/edit/{pid}   — 수정
POST /relationship/{member_id}/delete/{pid} — 삭제
GET  /relationship/api/calc/{member_id}     — 일괄 계산 결과 JSON
```

main.py에 등록:
```python
from routers import auth, admin, members, saju, brand_site, shop, relationship
app.include_router(relationship.router, prefix="/relationship")
```

### 템플릿 (templates/master/)
| 파일 | 역할 |
|---|---|
| `relationship_list.html` | 메인 화면 — 사람 목록 + 점수 카드 + 그래프 |
| `relationship_form.html` | 사람 추가/수정 폼 |

### 주요 UX
1. 본인 회원 페이지 → "인간관계도" 메뉴
2. 사람 추가 폼:
   - 이름, 생년월일, 시간, 성별, 음력
   - **관계 유형 드롭다운** (16종)
   - 자유 메모 (예: "엄마", "김대리")
3. 추가 후 자동으로 점수 계산 + 카드 표시
4. 카드: 이름·관계 · 점수 · 4단계 라벨 · 검출 패턴 · 본인 기준 상대 십성

### 일괄 계산 흐름
- 회원 master.json 읽음 (본인)
- DB에서 relationship_persons 조회
- relationship_calc.관계도분석() 호출
- 결과를 화면에 카드로 렌더 (캐시 안 함 — saju_calc 빨라서)

---

## 4. Phase 3 — 시각화 + PDF (대기)

### 시각화 옵션
- **A) 단순 리스트** (이미 Phase 2에서 구현)
- **B) 방사형 그래프** — 본인 중심, 관계자가 점수에 따라 거리·색상 표시 (SVG)
- **C) 카테고리별 그룹** — 가족/직장/친구 섹션 분리

### PDF 출력
- `engine/products/relationship/run_relationship.js` — 독립 실행기
- `engine/products/relationship/generate_관계도표.js` — HTML 표 생성
- 표지 + 본인 사주 + 관계자 N명 카드 + 종합 진단

### 결제 연동
- 단발 결제 (5만원~) 또는 사주서 부록
- 기존 saju_books 테이블 product_type='relationship' 추가

---

## 5. 재개 시 시작 명령

### 즉시 검증
```bash
cd c:/Users/provi/Desktop/banya_web/engine/products/relationship
node test_relationship.js
```

### Phase 2 시작
```
1. db.py에 relationship_groups, relationship_persons 테이블 추가
2. routers/relationship.py 신규 작성
3. main.py에 router 등록
4. templates/master/relationship_list.html, relationship_form.html 작성
5. 정종욱 회원 페이지에서 테스트
```

---

## 6. 코드 의존성

```
relationship_calc.js
    └── ../../saju_calc.js                  ← 유일한 의존성

test_relationship.js
    └── ./relationship_calc.js
    └── ../../queue/sample/{회원}/saju/2026/master.json (테스트용)
```

다른 모듈(compatibility_calc, generate_*, ch_*_db) 의존성 **0**.

---

## 7. 향후 확장 아이디어

- **그룹 비교**: 가족 그룹·직장 그룹 등 카테고리별 평균 점수
- **시기 추천**: 관계자별로 좋은 만남 시기·피해야 할 시기
- **AI 보조**: 패턴 감지 결과를 LLM에 던져 자연어 조언 생성
- **모바일 앱**: 관계도를 휴대폰 위젯으로
- **공유 기능**: 본인 + 관계자 1명 점수 카드를 카톡 공유

---

**다음 작업 진입 시 본 PLAN.md 다시 읽고 Phase 2부터 진행.**
