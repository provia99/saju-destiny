# main.py의 root 함수를 아래 코드로 교체하세요

from routers.auth import REMEMBER_COOKIE  # 파일 상단 import 목록에 추가

@app.get("/")
async def root(request: Request):
    # 1) 세션이 살아있으면 바로 대시보드로
    if request.session.get("master_id"):
        role = request.session.get("role")
        if role == "admin":
            return RedirectResponse("/admin/dashboard")
        return RedirectResponse("/members/dashboard")

    # 2) 세션은 없지만 remember 쿠키가 있으면 자동 로그인
    token = request.cookies.get(REMEMBER_COOKIE)
    if token:
        user = db.get_remember_token(token)
        if user:
            # 세션 복원
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
            # 만료된 토큰이면 쿠키 삭제 후 인트로 페이지
            from fastapi.responses import HTMLResponse
            from utils import templates
            resp = templates.TemplateResponse(request, "index.html", {"request": request})
            resp.delete_cookie(REMEMBER_COOKIE)
            return resp

    # 3) 비로그인 → 인트로 페이지
    from utils import templates
    return templates.TemplateResponse(request, "index.html", {"request": request})
