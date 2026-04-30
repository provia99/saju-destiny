# banya_web — 반야선생 사주 관리 웹앱

사주 전문가(마스터)가 고객 사주를 관리하고 사주 해석서를 자동 집필하는 SaaS 플랫폼.

이 파일은 Claude Code/Antigravity 등 AI 도구가 프로젝트 작업 시 자동 로드되는 컨텍스트입니다.

---

## 기술 스택

- **Backend**: FastAPI (Python 3.14) + SQLite (WAL 모드)
- **Frontend**: Jinja2 템플릿 + 바닐라 CSS/JS (모바일 우선)
- **사주 집필 엔진**: Node.js (`engine/`)
- **세션**: Starlette SessionMiddleware (8시간)
- **동시 집필**: ThreadPoolExecutor (max_workers=3)
- **AI 챗봇**: Ollama + Gemma 4 (로컬, 추후 통합 예정)

## 실행

```bash
# 가상환경 활성
.venv\Scripts\activate     # Windows
# source .venv/bin/activate # Linux/Mac

# 실행
python main.py
# 또는
uvicorn main:app --reload --port 8000
```

- 관리자: http://localhost:8000/login (admin / admin1234)
- 고객 랜딩: http://localhost:8000/expert/{master_id}
- 서브도메인 방식: `{master_id}.sajumaster.com` (로컬은 경로 방식만)

---

## 폴더 구조

```
main.py                # FastAPI 진입점
db.py                  # SQLite CRUD + migrate()
config.py              # 설정 (DB_PATH, SECRET_KEY, BASE_DOMAIN)
saju_writer.py         # 집필 엔진 호출 클래스 (SajuWriter)
engine_pool.py         # ThreadPoolExecutor (workers=3)
cache_store.py         # 사용자별 결과 캐시 (in-memory, 차후 SQLite 전환 가능)
ai_client.py           # LLM 추상화 (Ollama 기본)
chatbot/               # 챗봇 모듈 (date_parser 완성, 코어는 PC 이전 후)

routers/
├── auth.py            # /login, /logout
├── admin.py           # /admin/* (운영자, 마스터 CRUD)
├── members.py         # /members/* (마스터, 회원/프로필)
├── saju.py            # /saju/* (집필/조회/편집/다운로드)
└── brand_site.py      # /expert/{master_id}/* (고객 사이트)

engine/                # Node.js 집필 엔진 (Korean filenames in some)
├── saju_calc.js       # 사주 계산 단일 소스 (★ Single Source of Truth)
├── run_all.js         # 메인 진입점
├── ch00~ch18 *.js     # 챕터별 생성 스크립트 + 템플릿
├── products/          # 상품별 엔진 (compatibility/ 등)
│   ├── compatibility/  # 궁합 상품 (calc·db·fortune·cover·표 generators)
│   └── fullbook/       # 총본 (saju_full)
├── fonts/             # PDF용 한글 폰트 (★ 외부 폰트 금지)
├── images/            # PDF 배경·일러스트
└── queue/             # 입출력 작업 폴더

saju_engine/           # Python 사주 계산 (heavenly_earthly·ohaeng_analyzer 등)
templates/brand/       # 고객 사이트 (모바일 SPA-style nav)
templates/master/      # 마스터 백오피스
static/                # CSS/JS, 폰트, 타로 이미지, filler PDF
data/banya.db          # SQLite (★ Git 제외)
.env                   # 비밀키·SMTP·토스결제키 (★ Git 제외)
```

---

## DB 핵심 테이블

| 테이블 | 역할 |
|---|---|
| `masters` | 마스터 계정 (login_id, 선생님이름, 브랜드색상, role, plan, status) |
| `members` | 마스터 측 등록 회원 (사주 정보 + 자가응답 self_q1~q7) |
| `clients` | B2C 손님 (master_id별 가입, phone/email 로그인, status='탈퇴' 가능) |
| `saju_books` | 집필 작업 (member_id, book_year, status: 대기/생성중/완료/오류, pdf_path) |
| `acquaintances` | 손님이 등록한 지인 (사주 + relation_stage / relation_years / children_count / marriage_date) |
| `logs` | 작업 로그 (db.log_action) |

---

## 사주 집필 파이프라인

1. `POST /saju/write/{member_id}` → `db.insert_book()` → status='생성중'
2. BackgroundTask → `run_saju_background()` → ThreadPoolExecutor
3. `SajuWriter.write()`:
   - `_build_master_json()` — 회원+마스터 정보 → master.json
   - `_save_master_json()` — `engine/queue/{slot}/master.json`
   - `_run_engine()` — `node run_all.js {path}` (timeout=300s)
   - `_move_to_output()` → `output/{master_id}/` 백업
4. `db.update_book(status='완료', pdf_path)`
5. `GET /saju/status/{book_id}/json` — 폴링으로 상태 확인

---

## ★ 핵심 원칙

### 1. 단일 계산 소스 (Single Source of Truth)
모든 사주 상품(총본·요약본·신수풀이·궁합·재물·건강·기질)은 **`saju_calc.js` 한 곳에서만 계산**. 자체 계산 로직 만들지 말 것.

- 새 상품 추가 시: `전체사주계산()` 또는 개별 함수 호출로 충분한지 먼저 확인. 부족하면 saju_calc에 함수 추가
- 상수 테이블(천간합표·지지육합표·상생맵·천을귀인표 등)도 saju_calc에서 import. 복붙 금지
- 합충형 리소스: `천간합표/충표/육합표/충표/형표/파표/해표` (Single Source) + 자동 파생 Map
- 2026-04-27: `_setIfEmpty` 동작 변경 — saju_calc 값이 비어있지 않으면 **항상 덮어씀** (ch03 stale 데이터 영구 해결)

### 2. 폰트 사용 규칙
집필(엔진) 관련 모든 폰트는 반드시 `engine/fonts/` 안의 폰트만 사용. 외부 CDN(Google Fonts) / 시스템 폰트 금지.

**Why:** 오프라인·다른 환경에서 렌더링 깨짐 방지

### 3. 상품별 전용 표지 생성기
새로 만드는 모든 상품은 `engine/products/{상품}/generate_cover_{상품}.js` 형태로 전용 표지 생성기를 둘 것. 총본의 `engine/generate_cover.js` 를 그대로 호출하지 말 것.

**Why:** 상품마다 제목·구성 다름. 공용 cover 호출 시 저장 위치가 총본 폴더로 새는 버그 발생 (2026-04-24 확인).

**참조 구현**: `engine/products/compatibility/generate_cover_compat.js`

### 4. 폴더 구조 (집필 큐)
`engine/queue/{brand}/{이름}_{전화번호}/{상품}/{연도}/`
예: `engine/queue/sample/정종욱_88083038/saju/2026/`

### 5. 마스터 폼과 B2C 폼의 필드 정합성
- B2C `profile.html` 카드 4개 ↔ 마스터 `member_form.html` 필드 정확히 일치
- B2C `compat extras` 4필드 ↔ 마스터 `write.html` 동일 의미 (단, 컬럼명 `relation_*` vs `relationship_*` 미세 차이는 백엔드 매핑)

---

## 주요 버그 수정 기록 (참고용)

### 용신 판단 — 중화형신강 분기 (2026-04-24)
- 중화형신강이 신약 분기에 포함되어 인성을 용신으로 잡던 오류 수정
- `saju_calc.js:3244~3279` (억부용신) `:3815~3840` (절충법)
- 검증: 자평진전·궁통보감·적천수 원전 대조 100% 일치 (조후용신 120조합)

### 5신 체계 신강·신약 분기 (2026-04-27)
- 극신강 戊土 + 식상용신(金) 케이스에서 역상생[金]=土 가 희신으로 잘못 잡히던 문제 수정
- 신약: 인성/비겁 용신 → 희신=역상생[용신]
- 신강 + 식상/재성 용신 → 희신=상생[용신], 기신=일간오행
- 신강 + 관성 용신 → 희신=역상생[용신], 기신=일간오행

### 대운길흉 단일 소스 통합 (2026-04-27)
- 명식표·챕터·사주기본표 14곳에서 자체 분류하던 대운 길흉을 `d.대운길흉` 직접 사용으로 통합
- 검증: `node engine/_check_discrepancy.js` 명식표·본문·saju_calc 3자 비교

### 합충 보정 계수 주류 중앙값 정렬 (2026-04-24)
- 지지충 0.3→0.35, 천간충 0.2→0.25, 자형 0.1→0.13
- 지장간 암합 4단계: 본기↔본기 0.10 > 본기↔중기 0.07 > 중기↔중기 0.04 > 여기 0.02

---

## 궁합 상품 (`engine/products/compatibility/`)

- `compatibility_calc.js` (1441줄) — 21개 가중요소
- `compatibility_db.js` (1160줄) — 33 테이블, 437 항목
- `compatibility_fortune.js` (1169줄) — 27~29 섹션
- `generate_궁합표.js` (500+줄) — HTML 표 11~12종
- 9단계 등급: 천생연분/백년가약/연리지/좋은인연/무난한인연/보통인연/맞춰가는인연/노력필요/어려운인연
- 8단계 관계: 썸·연인·예비부부·부부·재혼준비·재혼·별거·이혼고민
- 동성 커플 자동 감지 (`inputA.성별 === inputB.성별` → 메타.동성커플)
- 최종 결과물: ~19,000자 / 497줄 (단계별 변동)

---

## B2C 사이트 핵심 페이지

| 경로 | 설명 |
|---|---|
| `/expert/{m}/home` | 오늘의 운세 (시드 + saju_calc 헤드라인) |
| `/expert/{m}/newyear` | 신년운세 (캐릭터·12개월·5분야·3미션) |
| `/expert/{m}/traditional` | 정통사주 (명식판·오행 도넛·대운 타임라인) |
| `/expert/{m}/compat?with={id}` | 짝궁합 (풀 엔진 호출, 9등급, 7차원, 잠긴 티저, PDF 목차) |
| `/expert/{m}/tarot` | 오늘의 타로 |
| `/expert/{m}/profile` | 내 정보 수정 (5카드 아코디언 + 회원탈퇴) |
| `/expert/{m}/acquaintances` | 지인 등록·수정·삭제 |
| `/expert/{m}/shop` | 상품 구매 (개발 예정) |

### 공통 UX 컴포넌트
- 로딩 오버레이: 페이지 진입 시 1.8~2.4초 크로스페이드 (`.cp-loader` + `.cp-results`, chrome.html 공통)
- 헤더 펄스 점: `body.brand-busy` 시 ✦선생님 옆 골드 점 펄스
- 사용자별 결과 캐시: `cache_store` 모듈 — 입력 해시 기반, 프로필/지인 변경 시 자동 무효화

---

## 진행 중 / 예정

### 🟡 PC 이전 후 시작 예정
- **챗봇 (Phase 1 MVP)**: ai_client.py, date_parser.py 까지 완료. 인텐트 분류·UI·DB 연동·풀 통합 남음
- **결제·자동집필 플로우**: 회원→상품선택→결제(토스)→자동집필 트리거→PDF 다운로드
- **운세 페이지 엔진 일괄 통합**: 오늘의/신년/타로 — 시드 풀로 1차 빌드 후 saju_calc 일괄 통합 (2026-04-28 결정)
- **날씨·대기질 통합**: 헤더 `🌙 18℃ 맑음` 현재 더미. 기상청 단기예보 + air_korea API (~2~3시간)
- **PWA 화**: manifest.json + 아이콘 (반나절). Service Worker 는 출시 직전에
- **클라우드 배포**: Vercel/Render/오라클 등 — 트래픽 검증 후

### 🔵 출시 후
- Capacitor 앱화 (Android 우선 → iOS는 IAP 정책 검토 후)
- cache_store 인메모리 → SQLite 전환 (트래픽 1만+ 시점)
- 챗봇 인텐트 확장 (이사·만남·사업·시험·건강 등)

---

## 자산 (Git 제외, 별도 관리)

USB·NAS 등으로 옮기는 자산:
- `engine/fonts/` (288M) — PDF 폰트 (★ critical)
- `engine/images/` (511M) — PDF 배경·일러스트
- `static/fonts/` (178M) — 웹 폰트
- `static/filler/` (402M) — PDF 패딩 페이지
- `static/tarot/` (20M) — 타로 이미지
- `templates/imagefolder/` (105M) — 띠 그림
- `data/banya.db` — DB
- `.env` — 비밀키

---

## How to apply (AI 작업 시)

- **새 기능 추가**: routers/에 엔드포인트, DB 변경 시 db.py migrate()에 ALTER TABLE
- **사주 계산 관련**: saju_calc.js 만 건드림. 상품 파일에 자체 계산 추가 금지
- **새 상품**: `engine/products/{상품}/` + 전용 cover 생성기
- **합충형 보정 계수 수정**: 회귀 테스트 필수 (`node engine/_check_discrepancy.js`)
- **B2C 폼 변경**: 마스터 폼과 동일성 유지
- **로깅**: `db.log_action(master_id, action, detail)` 사용
- **폰트 추가**: 반드시 `engine/fonts/` 또는 `static/fonts/` 에 다운로드 후 @font-face 등록
- **destructive 액션** (DB 마이그레이션·파일 삭제·force push): 사용자 명시 승인 필요
