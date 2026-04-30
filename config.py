DB_PATH          = "data/banya.db"
BRANDS_DIR       = "brands"
OUTPUT_DIR       = "output"
SAJU_ENGINE_PATH = "../saju_book"   # Node.js 집필 엔진 경로

SECRET_KEY       = "banya-secret-key-change-this-2026"
SESSION_MAX_AGE  = 60 * 60 * 8    # 8시간 (B2C client 등 일반 세션 — 쿠키 기준)

# ── 마스터·어드민 idle 타임아웃 (보안 강화) ────────────────
# 쿠키는 SESSION_MAX_AGE 동안 유지되지만, 마스터/어드민 경로는 마지막 활동 시각부터
# 아래 시간이 지나면 강제 로그아웃됨 (활동이 있으면 자동 갱신).
MASTER_SESSION_TIMEOUT = 60 * 60          # 마스터: 1시간 idle
ADMIN_SESSION_TIMEOUT  = 60 * 30          # 어드민: 30분 idle (더 엄격)
APP_TITLE        = "반야선생 사주 관리 시스템"
APP_VERSION      = "v1.0"

# 서브도메인 설정
# 로컬 테스트: hosts 파일에 127.0.0.1 *.saju8ja.co.kr 등록
# 실제 배포: DNS에 *.saju8ja.co.kr A 레코드 설정
BASE_DOMAIN      = "saju8ja.co.kr"

# ── 호스트 분리 설정 (서브도메인별 접근 가드) ────────────────
# - 일반 사용자(client/B2C)  : {BASE_DOMAIN} 또는 브랜드 서브도메인
# - 마스터(브랜더)            : MASTER_HOST (default: master.{BASE_DOMAIN})
# - 어드민(시스템)            : ADMIN_HOST  (default: admin.{BASE_DOMAIN})
#
# 로컬 개발: hosts 파일에 다음 라인 추가
#   127.0.0.1 master.localhost admin.localhost
# 그리고 .env에 ENABLE_HOST_GUARD=true 로 활성화 (기본값 false — 한 호스트에서 모두 접근 가능)

import os
from dotenv import load_dotenv
load_dotenv()

TOSS_CLIENT_KEY = os.getenv("TOSS_CLIENT_KEY", "")
TOSS_SECRET_KEY = os.getenv("TOSS_SECRET_KEY", "")

# SMTP 이메일 발송 설정 (Gmail 기준)
# Gmail 앱 비밀번호 발급: https://myaccount.google.com/apppasswords
# .env 파일에 아래 항목을 설정하세요:
#   SMTP_USER=your@gmail.com
#   SMTP_PASS=앱비밀번호16자리
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")   # Gmail 주소
SMTP_PASS = os.getenv("SMTP_PASS", "")   # Gmail 앱 비밀번호
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)  # 발신자 주소

# 호스트 분리 활성화 여부 + 분리 호스트명
ENABLE_HOST_GUARD = os.getenv("ENABLE_HOST_GUARD", "false").lower() == "true"
ADMIN_HOST  = os.getenv("ADMIN_HOST",  f"admin.{BASE_DOMAIN}")
MASTER_HOST = os.getenv("MASTER_HOST", f"master.{BASE_DOMAIN}")
# 로컬 개발 호스트 (모든 분리 무시) — localhost·127.0.0.1·*.localhost
LOCAL_DEV_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0"}

# ── 테스트 이메일 화이트리스트 ─────────────────────────────────
# 마스터(브랜더)가 회원 등록(/members/new) 시에만 적용:
#   - 동일 이름+생년월일 중복 검사 우회
#   - clients 테이블 연결 스킵 (client_id=NULL)
# 회원 본인 가입(/register)·프로필 수정(/profile)에는 적용되지 않음 (로그인 충돌 방지)
# 테스트 종료 후 빈 set 으로 비우거나 항목을 제거하세요.
TEST_EMAIL_WHITELIST = {"test@test.com"}

def is_test_email(email: str) -> bool:
    return bool(email) and email.strip().lower() in TEST_EMAIL_WHITELIST

