from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware
import os
import db
from config import (
    SECRET_KEY, APP_TITLE, BASE_DOMAIN,
    ENABLE_HOST_GUARD, ADMIN_HOST, MASTER_HOST, LOCAL_DEV_HOSTS,
    MASTER_SESSION_TIMEOUT, ADMIN_SESSION_TIMEOUT,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    from engine_pool import executor
    executor.shutdown(wait=False)


app = FastAPI(title=APP_TITLE, lifespan=lifespan)

# ─────────────────────────────────────────────
# 서브도메인 미들웨어
# banya.sajumaster.com → request.state.brand_id = "banya"
# sajumaster.com       → request.state.brand_id = None
# admin.sajumaster.com → request.state.brand_id = "admin"
# ─────────────────────────────────────────────
class SubdomainMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        host = request.headers.get("host", "").split(":")[0]  # 포트 제거
        brand_id = None
        if host.endswith(f".{BASE_DOMAIN}"):
            subdomain = host[: -(len(BASE_DOMAIN) + 1)]
            if subdomain and subdomain not in ("www",):
                brand_id = subdomain
        request.state.brand_id = brand_id
        response = await call_next(request)
        # 동적 페이지(/expert/*) 응답에 캐시 차단 헤더 추가 — 지인 전환 시 즉시 반영 보장
        path = request.url.path
        if path.startswith("/expert/") and not path.startswith("/static/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response

app.add_middleware(SubdomainMiddleware)


# ─────────────────────────────────────────────
# 호스트별 접근 가드 — 옵션 A (서브도메인 분리)
# ENABLE_HOST_GUARD=true 일 때만 적용 (기본 false: 단일 호스트 모드)
#
# admin.*  : /admin 만 허용
# master.* : /members, /clients, /saju 만 허용
# 그 외    : /admin·/members·/clients·/saju/(edit|write) 차단 (B2C 공개용)
#
# 공통 허용: /, /login, /logout, /static, /favicon.ico, /saju/api (브랜드 페이지에서도 일부 호출)
# 로컬 개발 (localhost·127.0.0.1) : 가드 미적용
# ─────────────────────────────────────────────
class AccessGuardMiddleware(BaseHTTPMiddleware):
    PUBLIC_PREFIXES = ("/static", "/favicon.ico", "/login", "/logout")
    ADMIN_PREFIXES = ("/admin",)
    MASTER_PREFIXES = ("/members", "/clients")
    MASTER_SAJU_PATHS = ("/saju/edit", "/saju/write", "/saju/api/render_component")

    @classmethod
    def _is_master_path(cls, path: str) -> bool:
        if path.startswith(cls.MASTER_PREFIXES):
            return True
        return any(path.startswith(p) for p in cls.MASTER_SAJU_PATHS)

    @classmethod
    def _is_admin_path(cls, path: str) -> bool:
        return path.startswith(cls.ADMIN_PREFIXES)

    @classmethod
    def _is_public_allowed(cls, path: str) -> bool:
        return path == "/" or path.startswith(cls.PUBLIC_PREFIXES)

    async def dispatch(self, request: Request, call_next):
        if not ENABLE_HOST_GUARD:
            return await call_next(request)

        host = request.headers.get("host", "").split(":")[0].lower()
        path = request.url.path

        # 로컬 개발 호스트는 가드 적용 안 함
        if host in LOCAL_DEV_HOSTS or host.endswith(".localhost"):
            return await call_next(request)

        # 공통 허용 (로그인·정적·루트)
        if self._is_public_allowed(path):
            return await call_next(request)

        if host == ADMIN_HOST:
            # admin 호스트: /admin 만 허용
            if not self._is_admin_path(path):
                return JSONResponse(status_code=404, content={"detail": "Not found"})
        elif host == MASTER_HOST:
            # master 호스트: /members·/clients·/saju/(edit|write|api/render_component) 허용
            if not self._is_master_path(path):
                return JSONResponse(status_code=404, content={"detail": "Not found"})
        else:
            # public 호스트(메인 도메인 또는 브랜드 서브도메인):
            # admin·master 전용 경로는 차단
            if self._is_admin_path(path) or self._is_master_path(path):
                return JSONResponse(status_code=404, content={"detail": "Not found"})

        return await call_next(request)


app.add_middleware(AccessGuardMiddleware)


# ─────────────────────────────────────────────
# 마스터·어드민 idle 타임아웃 미들웨어
# 마지막 활동 시각부터 일정 시간 지나면 자동 로그아웃 (B2C client는 영향 없음)
# ─────────────────────────────────────────────
class MasterIdleTimeoutMiddleware(BaseHTTPMiddleware):
    MASTER_PATHS = ("/members", "/clients")
    MASTER_SAJU_PATHS = ("/saju/edit", "/saju/write", "/saju/api/render_component")
    ADMIN_PATHS = ("/admin",)

    @classmethod
    def _is_admin(cls, path: str) -> bool:
        return path.startswith(cls.ADMIN_PATHS)

    @classmethod
    def _is_master(cls, path: str) -> bool:
        if path.startswith(cls.MASTER_PATHS):
            return True
        return any(path.startswith(p) for p in cls.MASTER_SAJU_PATHS)

    async def dispatch(self, request: Request, call_next):
        import time
        path = request.url.path
        is_admin = self._is_admin(path)
        is_master = self._is_master(path)

        if not (is_admin or is_master):
            return await call_next(request)

        # 마스터/어드민 세션이 있어야 검사 의미 있음
        if not request.session.get("master_id"):
            return await call_next(request)

        timeout = ADMIN_SESSION_TIMEOUT if is_admin else MASTER_SESSION_TIMEOUT
        now = int(time.time())
        last = request.session.get("last_activity_at")
        if isinstance(last, int) and (now - last) > timeout:
            # 만료 — 세션 클리어 후 로그인으로
            request.session.clear()
            return RedirectResponse("/login?reason=timeout", status_code=302)
        # 활동 갱신
        request.session["last_activity_at"] = now
        return await call_next(request)


app.add_middleware(MasterIdleTimeoutMiddleware)

# 세션 미들웨어 (로그인 상태 유지 - 30일)
# 가장 마지막에 add → outermost (가장 먼저 실행) → 다른 미들웨어가 request.session 접근 가능
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY, max_age=2592000)

# 정적 파일·템플릿 설정
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# 라우터 등록
from routers import auth, admin, members, saju, brand_site, shop, payments, clients
app.include_router(auth.router)
app.include_router(admin.router, prefix="/admin")
app.include_router(members.router, prefix="/members")
app.include_router(clients.router, prefix="/clients")
app.include_router(saju.router, prefix="/saju")
app.include_router(brand_site.router)
app.include_router(shop.router)
app.include_router(payments.router)


@app.get("/")
async def root(request: Request):
    # ── 서브도메인 접속 처리 ──
    brand_id = getattr(request.state, "brand_id", None)
    if brand_id and brand_id != "admin":
        # 브랜드 서브도메인 → 브랜드 앱 랜딩으로 위임
        return await brand_site.brand_subdomain_root(request, brand_id)

    # ── 메인 도메인 접속 처리 ──

    # 1) 세션이 살아있으면 바로 대시보드로
    if request.session.get("master_id"):
        role = request.session.get("role")
        if role == "admin":
            return RedirectResponse("/admin/dashboard")
        return RedirectResponse("/members/dashboard")

    # 2) 세션은 없지만 remember 쿠키가 있으면 자동 로그인
    from routers.auth import REMEMBER_COOKIE
    token = request.cookies.get(REMEMBER_COOKIE)
    if token:
        user = db.get_remember_token(token)
        if user:
            request.session["master_id"]  = user["master_id"]
            request.session["선생님이름"] = user["선생님이름"]
            request.session["role"]       = user["role"]
            request.session["브랜드색상"] = user["브랜드색상"]
            request.session["금색"]       = user["금색"]
            db.log_action(user["master_id"], "자동로그인", "remember_token")
            role = user["role"]
            if role == "admin":
                return RedirectResponse("/admin/dashboard")
            return RedirectResponse("/members/dashboard")
        else:
            # 만료된 토큰 → 쿠키 삭제 후 인트로 페이지
            from utils import templates
            resp = templates.TemplateResponse(request, "index.html", {"request": request})
            resp.delete_cookie(REMEMBER_COOKIE)
            return resp

    # 3) 비로그인 → 인트로 페이지
    from utils import templates
    return templates.TemplateResponse(request, "index.html", {"request": request})


def get_session_user(request: Request):
    master_id = request.session.get("master_id")
    if not master_id:
        return None
    return {
        "master_id":  master_id,
        "선생님이름": request.session.get("선생님이름", ""),
        "role":       request.session.get("role", "master"),
        "브랜드색상": request.session.get("브랜드색상", "#1A3A6A"),
        "금색":       request.session.get("금색", "#C8B860"),
    }


def require_login(request: Request):
    user = get_session_user(request)
    if not user:
        raise HTTPException(status_code=302, headers={"Location": "/login"})
    return user


def require_admin(request: Request):
    user = require_login(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="관리자만 접근 가능합니다.")
    return user


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["routers", "templates", "saju_engine", "."],
        reload_includes=["*.py", "*.html"],
        reload_excludes=["engine/queue/*", "data/*", ".git/*", ".claude/*"],
    )
