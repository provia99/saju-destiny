from fastapi import APIRouter, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from utils import templates
import db

router = APIRouter()

REMEMBER_COOKIE = "banya_remember"
COOKIE_MAX_AGE  = 60 * 60 * 24 * 30  # 30일 (초)


def _set_session(request: Request, user: dict):
    """세션에 사용자 정보 저장"""
    import time
    request.session["master_id"]  = user["master_id"]
    request.session["선생님이름"] = user["선생님이름"]
    request.session["role"]       = user["role"]
    request.session["브랜드색상"] = user["브랜드색상"]
    request.session["금색"]       = user["금색"]
    # 무활동 타임아웃 추적용
    request.session["last_activity_at"] = int(time.time())


@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, error: str = "", reason: str = ""):
    if request.session.get("master_id"):
        return RedirectResponse("/")
    # 무활동 타임아웃 메시지
    if reason == "timeout" and not error:
        error = "장시간 활동이 없어 자동 로그아웃되었습니다. 다시 로그인해주세요."
    return templates.TemplateResponse(request, "login.html",
        {"request": request, "error": error, "title": "로그인"})


@router.post("/login")
async def login_post(
    request: Request,
    login_id: str = Form(...),
    password: str = Form(...),
    remember: str = Form(""),   # 체크박스: "on" or ""
):
    user = db.login(login_id, password)
    if not user:
        return RedirectResponse("/login?error=아이디 또는 비밀번호가 틀렸습니다.",
                                status_code=302)
    if user["status"] == "대기":
        return RedirectResponse("/login?error=승인 대기 중입니다. 운영자에게 문의하세요.",
                                status_code=302)
    if user["status"] == "정지":
        return RedirectResponse("/login?error=계정이 정지되었습니다.",
                                status_code=302)

    # 세션에 저장
    _set_session(request, user)
    db.log_action(user["master_id"], "로그인", login_id)

    response = RedirectResponse("/", status_code=302)

    # 로그인 유지 체크 시 → 30일 쿠키 발급
    if remember == "on":
        token = db.create_remember_token(user["master_id"])
        response.set_cookie(
            key=REMEMBER_COOKIE,
            value=token,
            max_age=COOKIE_MAX_AGE,
            httponly=True,
            samesite="lax",
        )

    return response


@router.get("/logout")
async def logout(request: Request):
    master_id = request.session.get("master_id", "")

    # remember 쿠키가 있으면 DB 토큰도 삭제
    token = request.cookies.get(REMEMBER_COOKIE)
    if token:
        db.delete_remember_token(token)

    request.session.clear()
    db.log_action(master_id, "로그아웃", "")

    response = RedirectResponse("/login", status_code=302)
    response.delete_cookie(REMEMBER_COOKIE)
    return response
