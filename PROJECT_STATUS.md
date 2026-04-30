# banya_web — 프로젝트 현황

> 사주명리 기반 책자 자동 집필·납품 SaaS. 마스터(선생님)가 회원 사주를 입력하면 PDF 책자를 생성하여 고객에게 전달하는 시스템.

---

## 1. 기술 스택

| 영역 | 사용 기술 |
|---|---|
| **백엔드** | Python · **FastAPI** (uvicorn ASGI) |
| **템플릿** | Jinja2 |
| **세션** | Starlette SessionMiddleware (쿠키 기반, 8시간 유지) |
| **사주 엔진** | **Node.js (JavaScript)** — `engine/saju_calc.js` 등 |
| **렌더링** | HTML/CSS → Python `txt_to_html.py` 어셈블러 → PDF |
| **프론트엔드** | 서버사이드 렌더링 + Bootstrap 기반 CSS |
| **실행 모델** | `engine_pool.py`의 ProcessPoolExecutor로 사주 집필 비동기 처리 |

**의존성** (`requirements.txt`): `fastapi`, `uvicorn[standard]`, `jinja2`, `python-multipart`, `itsdangerous`, `aiofiles`

**서버**: `http://0.0.0.0:8000` (LAN 직접 접속 가능, [main.py:76-83](main.py#L76-L83))

---

## 2. 데이터베이스

**SQLite** (`banya.db`, WAL 모드 — 동시 읽기/쓰기 허용)

### 테이블 구조 ([db.py](db.py))

| 테이블 | 용도 |
|---|---|
| `masters` | 마스터(선생님) 계정 — 로그인, 브랜드 색상, 연구소명, 플랜 등 |
| `members` | 회원(고객) 정보 — 생년월일·생시·결혼/자녀/건강 메타데이터 |
| `saju_books` | 집필된 책자 레코드 — 상품 종류, master_json 스냅샷, PDF 경로, 결제 여부 |
| `logs` | 액션 로그 — 누가 무엇을 했는지 |
| `clients` | 고객 자가 가입 계정 (브랜드 사이트용) |

---

## 3. 페이지 구조

라우터별 4계층:
1. **공용** (`auth.py`) — 마스터/관리자 로그인
2. **관리자** (`admin.py`, `/admin/*`) — 마스터 계정 관리
3. **마스터** (`members.py` + `saju.py`, `/members/*`, `/saju/*`) — 회원·책자 관리, 집필
4. **브랜드 사이트** (`brand_site.py`, `/{master_id}/*`) — 고객 자가 가입·신청 페이지

### 3-1. 인증·홈

| 경로 | 용도 | 템플릿 |
|---|---|---|
| `GET /` | 세션 따라 분기(관리자→/admin/dashboard, 마스터→/members/dashboard) | — |
| `GET /login`, `POST /login` | 마스터 로그인 | `login.html` |
| `GET /logout` | 로그아웃 | — |

### 3-2. 관리자 페이지 (`/admin`)

| 경로 | 용도 | 템플릿 |
|---|---|---|
| `GET /admin/dashboard` | 관리자 대시보드 | `admin/dashboard.html` |
| `GET /admin/masters` | 마스터 목록 | `admin/master_list.html` |
| `GET/POST /admin/masters/new` | 마스터 신규 생성 | `admin/master_form.html` |
| `GET/POST /admin/masters/{id}/edit` | 마스터 수정 | `admin/master_form.html` |
| `POST /admin/masters/{id}/toggle` | 마스터 활성/비활성 토글 | — |

### 3-3. 마스터 페이지 (`/members`, `/saju`)

| 경로 | 용도 | 템플릿 |
|---|---|---|
| `GET /members/dashboard` | 마스터 대시보드 | `master/dashboard.html` |
| `GET /members/list` | 회원 목록 | `master/member_list.html` |
| `GET /members/profile`, `POST /members/profile` | 마스터 본인 프로필 (브랜드 색상·연구소명) | `master/profile.html` |
| `GET/POST /members/new` | 회원 신규 등록 (생년월일·생시·결혼·자녀·건강) | `master/member_form.html` |
| `GET/POST /members/{id}/edit` | 회원 정보 수정 | `master/member_form.html` |
| `POST /members/{id}/delete` | 회원 삭제 | — |
| `POST /members/{id}/approve` | 고객 신청 회원 승인 | — |
| `GET/POST /saju/write/{member_id}` | **집필 시작 페이지** (상품 선택 → 백그라운드 집필) | `master/write.html` |
| `GET /saju/status/{book_id}` | 집필 진행상황 | (JSON 또는 HTML) |
| `GET /saju/history` | 집필 이력 | `master/history.html` |
| `GET /saju/edit/{book_id}` | **에디터** (집필 결과 직접 수정) | `master/edit_ck.html` 외 상품별 |
| `POST /saju/save/{book_id}` | 에디터 저장 | — |
| `POST /saju/export_pdf/{book_id}` | PDF 출력 | — |
| `GET /saju/download/{book_id}` | PDF 다운로드 | — |
| `GET /saju/print_tables/{member_id}` | 표만 인쇄용 | — |
| `GET /saju/verify/{member_id}` | 집필 결과 검증 (오류·통과 체크) | — |
| `GET /saju/api/calc_daewoon` | 대운 계산 API (JSON) | — |
| `GET /saju/api/render_component` | 표 컴포넌트 렌더 API | — |

### 3-4. 브랜드 사이트 (`/{master_id}` — 고객용)

각 마스터별 독립 도메인처럼 동작 (예: `/baekyeon`, `/jeongmaster`).

| 경로 | 용도 | 템플릿 |
|---|---|---|
| `GET /{master_id}` | 브랜드 랜딩 | `brand/landing.html` |
| `GET/POST /{master_id}/register` | 고객 회원가입 | `brand/register.html` |
| `GET/POST /{master_id}/login` | 고객 로그인 | `brand/login.html` |
| `GET /{master_id}/logout` | 로그아웃 | — |
| `GET/POST /{master_id}/saju/new` | 사주 입력 폼 | `brand/saju_form.html` |
| `GET /{master_id}/saju/confirm` | 입력 내용 확인 | `brand/saju_confirm.html` |
| `POST /{master_id}/saju/request` | 집필 신청 | — |
| `GET /{master_id}/mypage` | 내 신청·완성본 목록 | `brand/mypage.html` |
| `GET /{master_id}/profile`, `POST` | 내 정보 수정 | `brand/profile.html` |
| `GET /{master_id}/download/{book_id}` | 완성본 다운로드 | — |

---

## 4. 주요 기능

### 4-1. 사주 계산 엔진 (`engine/saju_calc.js`)

- 양력/음력(윤달 포함) 사주 변환 — `korean-lunar-calendar` 패키지
- **원국**: 년주·월주·일주·시주, 천간·지지·지장간
- **오행**: 점수, 균형, 순위
- **십성·신강약**: 6단계 (극신강~극신약)
- **격국 판정**: 정관·편관·정인·편인·정재·편재·식신·상관·비견·겁재 + 종격·전왕격·화격·잡기격
- **용신**: 억부·조후·격국·통관 + 절충 (5신 체계: 용신·희신·기신·구신·한신)
- **합충형파해·공망·신살** 전수 계산
- **대운**: 순행/역행, 소운, 현재대운 + 길흉
- **세운·월운**: 현재·삼재 여부 포함

> 단일 소스 원칙: 모든 상품은 `saju_calc`만 사용 (자체 계산 금지)

### 4-2. 책자 상품 (`engine/products/`)

| 상품 | 폴더 | 설명 | 분량 |
|---|---|---|---|
| **총본** | `fullbook/` | 18개 챕터 + 표·필러 종합 | ~246,000자 |
| **요약본** | `summary/` | 핵심만 압축 | — |
| **연간운세** | `yearly/` | 1년치 운세 + 운세달력 | — |
| **궁합** | `compatibility/` | 두 사람 비교, 27개 표 + 31개 풀이 섹션 | ~22,000자 |
| **재물·직업** | `wealth_career/` | 재물·커리어 특화 | — |
| **건강** | `health/` | 건강·양생식품 | — |
| **성격·기질** | `personality/` | 성격 분석 | — |

### 4-3. 회원 관리

- 회원 등록 (생년월일·생시·결혼·자녀·건강·관심영역)
- 마스터별 격리 (멀티테넌트)
- 고객 자가 가입 → 마스터 승인 플로우 (`brand_site.py`)

### 4-4. 집필·렌더링 파이프라인

1. **입력** → `master.json` (회원 메타데이터)
2. **사주 계산** → `saju_calc.js` 실행, 결과 JSON 저장
3. **챕터 생성** → `generate_ch00.js` ~ `generate_ch18.js` (DB 기반 텍스트 조립)
4. **표 생성** → `generate_*.js` 50+개 (오행점수표·명식표·인적사항표·운세달력 등)
5. **본문 합본** → `result.txt` (TABLE 마커 포함)
6. **HTML 변환** → `txt_to_html.py`가 마커 해석하여 최종 HTML
7. **PDF 출력** → 브라우저/wkhtmltopdf

### 4-5. 검증 시스템

- `/saju/verify/{member_id}` — 36개 체크 항목 (오류·경고·통과)
- 사주 계산 정확성, 표 누락, 일간/용신 일치, 격국 유효성 등 자동 검증

---

## 5. 폴더 구조 (브랜드/개인/상품/연도 4단계)

```
engine/queue/sample/<회원이름>_<ID>/<상품>/<연도>/
├── master.json
├── result.txt           — 합본 텍스트
├── final.html           — 최종 HTML
├── cover.html           — 표지
└── tables/              — 50+개 표 HTML
```

---

## 6. 현재 진행 상황

- **완료**: 총본·궁합·요약본·연간운세 등 7개 상품 풀 파이프라인, 사주 엔진 학술 검증 (97~99% 일치율), 회원 전수 검증, 인적사항표 오행 분포 추가, 자녀운 분석 확장
- **진행 중**: 사람 간 관계도 (허브-스포크 + 오행 에너지 맵), 성격 설문 기반 오행 추정
- **예정**: 고객 결제 → 자동 집필 플로우 완성, 운세달력 절기 세밀화

---

## 7. 실행 방법

```bash
python main.py
# 또는
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

접속: `http://localhost:8000` (또는 LAN IP:8000)
