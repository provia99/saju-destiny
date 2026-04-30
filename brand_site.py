"""
brand_site.py  -  브랜드별 고객 앱 라우터

URL 구조 (두 가지 방식 모두 지원):

  [서브도메인 방식 - 권장]
  banya.sajumaster.com/          -> 인트로 / 홈 리다이렉트
  banya.sajumaster.com/register  -> 회원가입
  banya.sajumaster.com/login     -> 로그인
  banya.sajumaster.com/home      -> 나의 사주 홈
  banya.sajumaster.com/logout    -> 로그아웃
  banya.sajumaster.com/profile   -> 내 정보

  [경로 방식 - 하위 호환]
  /expert/{master_id}            -> 인트로
  /expert/{master_id}/register   -> 회원가입
  /expert/{master_id}/login      -> 로그인
  /expert/{master_id}/home       -> 나의 사주 홈
  /expert/{master_id}/logout     -> 로그아웃
  /expert/{master_id}/profile    -> 내 정보
"""

import hashlib
import random
from datetime import date
from fastapi import APIRouter, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from typing import Optional

import db
from utils import templates
from config import BASE_DOMAIN

router = APIRouter()

# ---------------------------------------------------------
# 상수
# ---------------------------------------------------------
REMEMBER_DAYS = 30
WEEKDAYS = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"]


# ---------------------------------------------------------
# 헬퍼
# ---------------------------------------------------------

def _brand_ctx(master: dict, request=None) -> dict:
    brand_color = master.get("브랜드색상", "#1A3A6A")
    gold_color  = master.get("금색", "#C8B860")
    try:
        r = int(brand_color[1:3], 16)
        g = int(brand_color[3:5], 16)
        b = int(brand_color[5:7], 16)
        brand_rgb = f"{r},{g},{b}"
    except Exception:
        brand_rgb = "26,58,106"
    master_id = master.get("master_id", "")
    # base_url: 서브도메인이면 "" (상대경로), 경로 방식이면 "/expert/{master_id}"
    if request is not None:
        brand_id = getattr(request.state, "brand_id", None)
        base_url = "" if brand_id == master_id else f"/expert/{master_id}"
    else:
        base_url = f"/expert/{master_id}"
    return {
        "master":      master,
        "master_id":   master_id,
        "brand_name":  master.get("선생님이름", ""),
        "brand_color": brand_color,
        "gold_color":  gold_color,
        "brand_rgb":   brand_rgb,
        "base_domain": BASE_DOMAIN,
        "base_url":    base_url,
    }


def _brand_url(request: Request, master_id: str, path: str = "") -> str:
    """서브도메인 접속이면 상대경로, 아니면 /expert/{master_id}/path"""
    brand_id = getattr(request.state, "brand_id", None)
    if brand_id == master_id:
        return f"/{path}" if path else "/"
    return f"/expert/{master_id}/{path}" if path else f"/expert/{master_id}"


def _get_client_session(request: Request, master_id: str):
    client_id = request.session.get(f"client_{master_id}")
    if not client_id:
        return None
    client = db.get_client(client_id)
    if not client:
        return None
    # members 테이블에서 사주 정보 병합 (방향 A)
    member = db.get_member_by_client(master_id, client_id)
    if member:
        for key in ['birth_year', 'birth_month', 'birth_day', 'birth_time',
                    'gender', 'lunar_yn', 'leap_month_yn',
                    'activity_type', 'marital_status', 'concern_area']:
            client[key] = member.get(key, client.get(key))
        client['member_id'] = member.get('id')
    return client


def _birth_info(client: dict) -> str:
    y = client.get("birth_year")
    m = client.get("birth_month")
    d = client.get("birth_day")
    t = client.get("birth_time", "모름")
    if y and m and d:
        lunar = " (음력)" if client.get("lunar_yn") else ""
        leap  = " [윤달]" if client.get("leap_month_yn") else ""
        return f"{y}년 {m}월 {d}일 {t}{lunar}{leap}"
    return "사주 정보 없음"


def _generate_daily_fortune(client: dict, today: date) -> dict:
    seed_str = (f"{client.get('birth_year',1990)}"
                f"{client.get('birth_month',1)}"
                f"{client.get('birth_day',1)}"
                f"{today.year}{today.month}{today.day}")
    seed = int(hashlib.md5(seed_str.encode()).hexdigest(), 16) % (2**32)
    rng  = random.Random(seed)

    total  = rng.randint(55, 95)
    money  = rng.randint(40, 100)
    love   = rng.randint(40, 100)
    work   = rng.randint(40, 100)
    health = rng.randint(40, 100)
    stars  = "★" * (total // 20) + "☆" * (5 - total // 20)

    if   total >= 90: label, text = "대길 (大吉)", "오늘은 모든 일이 순조롭게 풀리는 최고의 날입니다. 중요한 결정이나 새로운 시작에 더없이 좋은 날이니 적극적으로 행동하세요."
    elif total >= 75: label, text = "길 (吉)",     "전반적으로 좋은 기운이 감돌고 있습니다. 계획한 일들이 잘 진행되며 주변의 도움도 기대할 수 있습니다."
    elif total >= 60: label, text = "평 (平)",     "평범하지만 안정적인 하루입니다. 무리하지 말고 꾸준히 나아가면 좋은 결과를 얻을 수 있습니다."
    else:             label, text = "주의 (注意)", "오늘은 신중하게 행동하는 것이 좋습니다. 중요한 결정은 잠시 미루고 주변을 잘 살피세요."

    colors = [
        ("빨강","#FF4444"),("파랑","#4488FF"),("초록","#44BB44"),
        ("노랑","#FFCC00"),("보라","#8844CC"),("흰색","#FFFFFF"),
        ("검정","#333333"),("금색","#C8B860"),("하늘색","#88CCFF"),
    ]
    directions = ["동","서","남","북","동남","동북","서남","서북"]
    lucky_color, lucky_color_hex = colors[rng.randint(0, len(colors)-1)]
    advices = [
        "오늘은 새로운 인연을 만날 기회가 있습니다. 열린 마음으로 대화해 보세요.",
        "재물운이 좋으니 소소한 투자나 저축을 시작해 보는 것도 좋습니다.",
        "건강 관리에 신경 쓰세요. 충분한 수면과 규칙적인 식사가 도움이 됩니다.",
        "주변 사람들과의 소통이 중요한 날입니다. 먼저 연락해 보세요.",
        "창의적인 아이디어가 떠오르는 날입니다. 메모해 두면 나중에 도움이 됩니다.",
        "오늘은 감사한 마음을 표현해 보세요. 좋은 기운이 돌아옵니다.",
        "서두르지 말고 차분하게 일을 처리하면 좋은 결과를 얻을 수 있습니다.",
    ]
    return {
        "total_score":     total,
        "total_label":     label,
        "total_text":      text,
        "stars":           stars,
        "money_score":     money,
        "love_score":      love,
        "work_score":      work,
        "health_score":    health,
        "lucky_color":     lucky_color,
        "lucky_color_hex": lucky_color_hex,
        "lucky_number":    rng.randint(1, 99),
        "lucky_direction": directions[rng.randint(0, len(directions)-1)],
        "advice":          advices[rng.randint(0, len(advices)-1)],
    }


def _generate_monthly_fortune(client: dict, year: int, month: int) -> str:
    seed_str = f"{client.get('birth_year',1990)}{client.get('birth_month',1)}{year}{month}"
    seed = int(hashlib.md5(seed_str.encode()).hexdigest(), 16) % (2**32)
    rng  = random.Random(seed)
    fortunes = [
        "이달은 새로운 기회가 찾아오는 달입니다. <strong>변화를 두려워하지 말고</strong> 적극적으로 도전해 보세요. 특히 중순 이후로 좋은 소식이 기대됩니다.",
        "재물운이 상승하는 달입니다. 그동안 준비해 온 일들이 <strong>결실을 맺을 가능성</strong>이 높으니 꾸준히 노력하세요. 다만 충동적인 지출은 주의하세요.",
        "인간관계에서 좋은 인연이 생기는 달입니다. <strong>주변 사람들과의 소통</strong>을 늘리고 협력하면 큰 도움을 받을 수 있습니다.",
        "건강 관리가 중요한 달입니다. 무리한 일정보다는 <strong>규칙적인 생활 패턴</strong>을 유지하는 것이 중요합니다. 하반월에 기운이 회복됩니다.",
        "직장과 사업에서 발전이 기대되는 달입니다. <strong>꼼꼼한 준비와 계획</strong>이 성공의 열쇠입니다. 상사나 선배의 조언을 귀담아 들으세요.",
    ]
    return fortunes[rng.randint(0, len(fortunes)-1)]


# ---------------------------------------------------------
# 서브도메인 진입점 (main.py의 root()에서 호출)
# ---------------------------------------------------------

async def brand_subdomain_root(request: Request, master_id: str):
    """서브도메인 루트(/) 처리 - main.py SubdomainMiddleware에서 호출 → 인트로로 이동"""
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404, detail="브랜드를 찾을 수 없습니다.")
    return await _intro(request, master_id)


# ---------------------------------------------------------
# 공통 로직 함수 (서브도메인 / 경로 방식 공유)
# ---------------------------------------------------------

async def _register_form(request: Request, master_id: str):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    if _get_client_session(request, master_id):
        return RedirectResponse(_brand_url(request, master_id, "home"))
    ctx = _brand_ctx(master, request)
    ctx["error"] = None
    ctx["form"]  = {}
    return templates.TemplateResponse(request, "brand/register.html", ctx)


async def _register_post(
    request: Request, master_id: str,
    name: str, email: str, password: str, password_confirm: str,
    gender: str, birth_year: int, birth_month: int, birth_day: int,
    birth_time: str, lunar_yn, leap_month_yn
):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    ctx = _brand_ctx(master, request)
    ctx["form"] = {
        "name": name, "email": email, "gender": gender,
        "birth_year": birth_year, "birth_month": birth_month,
        "birth_day": birth_day, "birth_time": birth_time,
        "lunar_yn": 1 if lunar_yn else 0,
        "leap_month_yn": 1 if leap_month_yn else 0,
    }
    if not name or not email:
        ctx["error"] = "이름과 이메일은 필수입니다."
        return templates.TemplateResponse(request, "brand/register.html", ctx)
    # 이메일 형식 검증
    import re
    email = email.strip().lower()
    ctx["form"]["email"] = email
    EMAIL_RE = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
    if not re.match(EMAIL_RE, email):
        ctx["error"] = "올바른 이메일 형식이 아닙니다. (예: name@example.com)"
        return templates.TemplateResponse(request, "brand/register.html", ctx)
    if not password or len(password) < 6:
        ctx["error"] = "비밀번호는 6자 이상이어야 합니다."
        return templates.TemplateResponse(request, "brand/register.html", ctx)
    if password != password_confirm:
        ctx["error"] = "비밀번호가 일치하지 않습니다."
        return templates.TemplateResponse(request, "brand/register.html", ctx)
    if db.get_client_by_email(master_id, email):
        ctx["error"] = "이미 가입된 이메일입니다. 비밀번호 찾기를 이용하세요."
        return templates.TemplateResponse(request, "brand/register.html", ctx)
    try:
        client_id = db.insert_client({
            "master_id":     master_id,
            "name":          name,
            "email":         email,
            "password_hash": hashlib.sha256(password.encode()).hexdigest(),
            "phone":         "",
            "birth_year":    birth_year,
            "birth_month":   birth_month,
            "birth_day":     birth_day,
            "birth_time":    birth_time,
            "gender":        gender,
            "lunar_yn":      1 if lunar_yn else 0,
            "leap_month_yn": 1 if leap_month_yn else 0,
        })
    except Exception:
        ctx["error"] = "가입 중 오류가 발생했습니다. 다시 시도해 주세요."
        return templates.TemplateResponse(request, "brand/register.html", ctx)
    request.session[f"client_{master_id}"] = client_id
    request.session[f"client_name_{master_id}"] = name
    db.log_action(master_id, "B2C회원가입", f"{name} ({email})")
    return RedirectResponse(_brand_url(request, master_id, "home"), status_code=303)


async def _login_form(request: Request, master_id: str):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    if _get_client_session(request, master_id):
        return RedirectResponse(_brand_url(request, master_id, "home"))
    ctx = _brand_ctx(master, request)
    ctx["error"] = None
    ctx["form"]  = {}
    return templates.TemplateResponse(request, "brand/login.html", ctx)


async def _login_post(
    request: Request, master_id: str,
    login_id: str, password: str, remember
):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    ctx = _brand_ctx(master, request)
    ctx["form"] = {"login_id": login_id}
    client = db.client_login(master_id, login_id, password)
    if not client:
        ctx["error"] = "이메일 또는 비밀번호가 올바르지 않습니다."
        return templates.TemplateResponse(request, "brand/login.html", ctx)
    request.session[f"client_{master_id}"] = client["id"]
    request.session[f"client_name_{master_id}"] = client["name"]
    db.update_client_visit(client["id"])
    db.log_action(master_id, "B2C로그인", f"{client['name']} ({login_id})")
    resp = RedirectResponse(_brand_url(request, master_id, "home"), status_code=303)
    if remember:
        import secrets as _secrets
        resp.set_cookie(
            key=f"b2c_{master_id}",
            value=f"{client['id']}:{_secrets.token_urlsafe(48)}",
            max_age=REMEMBER_DAYS * 86400,
            httponly=True, samesite="lax"
        )
    return resp



# ---------------------------------------------------------
# 비밀번호 재설정 헬퍼
# ---------------------------------------------------------
async def _forgot_form(request: Request, master_id: str):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    ctx = _brand_ctx(master, request)
    ctx["error"] = None
    ctx["success"] = None
    return templates.TemplateResponse(request, "brand/forgot_password.html", ctx)

async def _forgot_post(request: Request, master_id: str, email: str):
    from config import BASE_DOMAIN, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    ctx = _brand_ctx(master, request)
    ctx["error"] = None
    ctx["success"] = None
    client = db.get_client_by_email(master_id, email)
    if client:
        token = db.create_password_reset_token(client["id"])
        # 재설정 링크 생성 — Host가 서브도메인이면 /reset-password, 아니면 path 방식
        host = request.headers.get("host", f"{master_id}.{BASE_DOMAIN}")
        host_only = host.split(":")[0]
        if host_only.endswith(f".{BASE_DOMAIN}"):
            reset_url = f"http://{host}/reset-password?token={token}"
        else:
            # 인트라넷·로컬 등 — path 방식 사용
            reset_url = f"http://{host}/expert/{master_id}/reset-password?token={token}"
        # 이메일 발송
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"[{master.get('연구소명') or master.get('선생님이름')}] 비밀번호 재설정"
            msg["From"] = SMTP_FROM
            msg["To"] = email
            html_body = f"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
                <h2 style="color:#1A3A6A;">비밀번호 재설정</h2>
                <p>안녕하세요, {client['name']}님.</p>
                <p>아래 버튼을 클릭하여 비밀번호를 재설정하세요.<br>
                   링크는 <strong>1시간</strong> 동안 유효합니다.</p>
                <a href="{reset_url}" style="display:inline-block;margin:24px 0;padding:14px 32px;
                   background:#1A3A6A;color:#fff;text-decoration:none;border-radius:8px;font-size:1rem;">
                   비밀번호 재설정하기
                </a>
                <p style="color:#999;font-size:0.85rem;">
                   이 메일을 요청하지 않으셨다면 무시하셔도 됩니다.
                </p>
            </div>
            """
            msg.attach(MIMEText(html_body, "html", "utf-8"))
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
                s.ehlo()
                s.starttls()
                s.login(SMTP_USER, SMTP_PASS)
                s.sendmail(SMTP_FROM, [email], msg.as_string())
            db.log_action(master_id, "비밀번호재설정요청", f"{email}")
        except Exception as e:
            db.log_action(master_id, "이메일발송실패", str(e))
    # 보안상 이메일 존재 여부 노출 안 함
    ctx["success"] = "입력하신 이메일로 재설정 링크를 발송했습니다. (이메일이 등록된 경우)"
    return templates.TemplateResponse(request, "brand/forgot_password.html", ctx)

async def _reset_form(request: Request, master_id: str, token: str):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    ctx = _brand_ctx(master, request)
    ctx["token"] = token
    ctx["error"] = None
    client = db.get_password_reset_token(token)
    if not client:
        ctx["error"] = "유효하지 않거나 만료된 링크입니다. 다시 요청해 주세요."
        ctx["token"] = None
    return templates.TemplateResponse(request, "brand/reset_password.html", ctx)

async def _reset_post(request: Request, master_id: str, token: str, password: str, password_confirm: str):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    ctx = _brand_ctx(master, request)
    ctx["token"] = token
    ctx["error"] = None
    if password != password_confirm:
        ctx["error"] = "비밀번호가 일치하지 않습니다."
        return templates.TemplateResponse(request, "brand/reset_password.html", ctx)
    if len(password) < 6:
        ctx["error"] = "비밀번호는 6자 이상이어야 합니다."
        return templates.TemplateResponse(request, "brand/reset_password.html", ctx)
    ok = db.use_password_reset_token(token, password)
    if not ok:
        ctx["error"] = "유효하지 않거나 만료된 링크입니다. 다시 요청해 주세요."
        ctx["token"] = None
        return templates.TemplateResponse(request, "brand/reset_password.html", ctx)
    db.log_action(master_id, "비밀번호재설정완료", "token 사용")
    return templates.TemplateResponse(request, "brand/reset_password.html", {
        **ctx, "token": None, "error": None, "success": True
    })

async def _intro(request: Request, master_id: str):
    """인트로 페이지 - 첫 접속 시 항상 표시 (회원/비회원 분기는 JS에서 처리)"""
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    client = _get_client_session(request, master_id)
    ctx = _brand_ctx(master, request)
    ctx["client"] = client
    ctx["is_logged_in"] = 1 if client else 0
    return templates.TemplateResponse(request, "brand/intro.html", ctx)


async def _welcome(request: Request, master_id: str):
    """비회원용 랜딩 페이지 - 서비스 소개 + 가입 유도"""
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    client = _get_client_session(request, master_id)
    if client:
        # 이미 로그인된 경우 홈으로 리다이렉트
        return RedirectResponse(_brand_url(request, master_id, "home"))
    products = db.get_products(active_only=True)[:4]
    ctx = _brand_ctx(master, request)
    ctx["products"] = products
    return templates.TemplateResponse(request, "brand/welcome.html", ctx)


async def _logout(request: Request, master_id: str):
    request.session.pop(f"client_{master_id}", None)
    request.session.pop(f"client_name_{master_id}", None)
    resp = RedirectResponse(_brand_url(request, master_id, ""))
    resp.delete_cookie(f"b2c_{master_id}")
    return resp


async def _home(request: Request, master_id: str):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    client = _get_client_session(request, master_id)
    if not client:
        return RedirectResponse(_brand_url(request, master_id, "login"))
    db.update_client_visit(client["id"])
    today    = date.today()
    fortune  = _generate_daily_fortune(client, today)
    monthly  = _generate_monthly_fortune(client, today.year, today.month)
    products = db.get_products(active_only=True)[:4]
    orders   = db.get_orders_by_client(client["id"])[:5]
    ctx = _brand_ctx(master, request)
    ctx.update({
        "client":          client,
        "birth_info":      _birth_info(client),
        "today_str":       today.strftime("%Y년 %m월 %d일"),
        "weekday":         WEEKDAYS[today.weekday()],
        "month_str":       today.strftime("%Y년 %m월"),
        "fortune":         fortune,
        "monthly_fortune": monthly,
        "products":        products,
        "orders":          orders,
    })
    return templates.TemplateResponse(request, "brand/home.html", ctx)


async def _profile(request: Request, master_id: str):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    client = _get_client_session(request, master_id)
    if not client:
        return RedirectResponse(_brand_url(request, master_id, "login"))
    ctx = _brand_ctx(master, request)
    ctx["client"]     = client
    ctx["birth_info"] = _birth_info(client)
    ctx["msg"]        = request.query_params.get("msg", "")
    ctx["errors"]     = []
    return templates.TemplateResponse(request, "brand/profile.html", ctx)


async def _profile_post(
    request: Request, master_id: str,
    name: str, email: str, password: str, password_confirm: str,
    gender: str, birth_year: int, birth_month: int, birth_day: int,
    birth_time: str, lunar_yn, leap_month_yn
):
    master = db.get_master(master_id)
    if not master or master.get("status") != "활성":
        raise HTTPException(status_code=404)
    client = _get_client_session(request, master_id)
    if not client:
        return RedirectResponse(_brand_url(request, master_id, "login"))
    ctx = _brand_ctx(master, request)
    errors = []
    name  = (name or "").strip()
    email = (email or "").strip().lower()
    if not name:
        errors.append("이름은 필수입니다.")
    import re
    EMAIL_RE = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
    if not email or not re.match(EMAIL_RE, email):
        errors.append("올바른 이메일 형식이 아닙니다.")
    if email and email != client.get("email", "").lower():
        existing = db.get_client_by_email(master_id, email)
        if existing and existing["id"] != client["id"]:
            errors.append("이미 사용 중인 이메일입니다.")
    update_client = {"name": name, "email": email}
    if password:
        if len(password) < 6:
            errors.append("비밀번호는 6자 이상이어야 합니다.")
        elif password != password_confirm:
            errors.append("비밀번호가 일치하지 않습니다.")
        else:
            update_client["password_hash"] = hashlib.sha256(password.encode()).hexdigest()
    update_member = {
        "name":          name,
        "email":         email,
        "birth_year":    int(birth_year),
        "birth_month":   int(birth_month),
        "birth_day":     int(birth_day),
        "birth_time":    birth_time,
        "gender":        gender,
        "lunar_yn":      1 if lunar_yn else 0,
        "leap_month_yn": 1 if leap_month_yn else 0,
    }
    if errors:
        # 입력값 유지하면서 에러 표시
        for k, v in {**update_member, "email": email}.items():
            client[k] = v
        ctx["client"]     = client
        ctx["birth_info"] = _birth_info(client)
        ctx["msg"]        = ""
        ctx["errors"]     = errors
        return templates.TemplateResponse(request, "brand/profile.html", ctx)
    db.update_client(client["id"], update_client)
    member_id = client.get("member_id")
    if member_id:
        db.update_member(member_id, update_member)
    request.session[f"client_name_{master_id}"] = name
    db.log_action(master_id, "B2C회원수정", f"{name} ({email})")
    from urllib.parse import quote
    return RedirectResponse(
        _brand_url(request, master_id, "profile") + "?msg=" + quote("변경되었습니다."),
        status_code=303
    )


# ---------------------------------------------------------
# 서브도메인 라우터 (banya.sajumaster.com/xxx)
# ---------------------------------------------------------

@router.get("/register", response_class=HTMLResponse)
async def brand_sub_register_form(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _register_form(request, master_id)


@router.post("/register", response_class=HTMLResponse)
async def brand_sub_register_post(
    request: Request,
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    password_confirm: str = Form(...),
    gender: str = Form("남"),
    birth_year: int = Form(...),
    birth_month: int = Form(...),
    birth_day: int = Form(...),
    birth_time: str = Form("모름"),
    lunar_yn: Optional[str] = Form(None),
    leap_month_yn: Optional[str] = Form(None),
):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _register_post(
        request, master_id, name, email, password, password_confirm,
        gender, birth_year, birth_month, birth_day, birth_time,
        lunar_yn, leap_month_yn
    )


@router.get("/login", response_class=HTMLResponse)
async def brand_sub_login_form(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _login_form(request, master_id)


@router.post("/login", response_class=HTMLResponse)
async def brand_sub_login_post(
    request: Request,
    login_id: str = Form(...),
    password: str = Form(...),
    remember: Optional[str] = Form(None),
):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _login_post(request, master_id, login_id, password, remember)


@router.get("/forgot-password", response_class=HTMLResponse)
async def brand_sub_forgot_form(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _forgot_form(request, master_id)

@router.post("/forgot-password", response_class=HTMLResponse)
async def brand_sub_forgot_post(request: Request, email: str = Form(...)):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _forgot_post(request, master_id, email)

def _resolve_master_from_token(request: Request, token: str) -> str:
    """서브도메인 brand_id가 없으면 token으로 client→master_id 추적 (인트라넷 호환)"""
    master_id = getattr(request.state, "brand_id", None)
    if master_id:
        return master_id
    if token:
        client = db.get_password_reset_token(token)
        if client:
            return client.get("master_id", "")
    return ""

@router.get("/reset-password", response_class=HTMLResponse)
async def brand_sub_reset_form(request: Request, token: str = ""):
    master_id = _resolve_master_from_token(request, token)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _reset_form(request, master_id, token)

@router.post("/reset-password", response_class=HTMLResponse)
async def brand_sub_reset_post(
    request: Request,
    token: str = Form(...),
    password: str = Form(...),
    password_confirm: str = Form(...),
):
    master_id = _resolve_master_from_token(request, token)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _reset_post(request, master_id, token, password, password_confirm)

@router.get("/logout")
async def brand_sub_logout(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _logout(request, master_id)


@router.get("/intro", response_class=HTMLResponse)
async def brand_sub_intro(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _intro(request, master_id)


@router.get("/welcome", response_class=HTMLResponse)
async def brand_sub_welcome(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _welcome(request, master_id)


@router.get("/home", response_class=HTMLResponse)
async def brand_sub_home(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _home(request, master_id)


@router.get("/profile", response_class=HTMLResponse)
async def brand_sub_profile(request: Request):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _profile(request, master_id)


@router.post("/profile", response_class=HTMLResponse)
async def brand_sub_profile_post(
    request: Request,
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(""),
    password_confirm: str = Form(""),
    gender: str = Form("남"),
    birth_year: int = Form(...),
    birth_month: int = Form(...),
    birth_day: int = Form(...),
    birth_time: str = Form("모름"),
    lunar_yn: Optional[str] = Form(None),
    leap_month_yn: Optional[str] = Form(None),
):
    master_id = getattr(request.state, "brand_id", None)
    if not master_id:
        raise HTTPException(status_code=404)
    return await _profile_post(
        request, master_id, name, email, password, password_confirm,
        gender, birth_year, birth_month, birth_day, birth_time,
        lunar_yn, leap_month_yn
    )


# ---------------------------------------------------------
# 경로 방식 라우터 /expert/{master_id}/xxx (하위 호환)
# ---------------------------------------------------------

@router.get("/expert/{master_id}", response_class=HTMLResponse)
async def brand_landing(request: Request, master_id: str):
    """첫 접속 → 인트로 페이지 표시"""
    return await _intro(request, master_id)


@router.get("/expert/{master_id}/intro", response_class=HTMLResponse)
async def brand_intro(request: Request, master_id: str):
    return await _intro(request, master_id)


@router.get("/expert/{master_id}/welcome", response_class=HTMLResponse)
async def brand_welcome(request: Request, master_id: str):
    return await _welcome(request, master_id)


@router.get("/expert/{master_id}/register", response_class=HTMLResponse)
async def brand_register_form(request: Request, master_id: str):
    return await _register_form(request, master_id)


@router.post("/expert/{master_id}/register", response_class=HTMLResponse)
async def brand_register_post(
    request: Request, master_id: str,
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    password_confirm: str = Form(...),
    gender: str = Form("남"),
    birth_year: int = Form(...),
    birth_month: int = Form(...),
    birth_day: int = Form(...),
    birth_time: str = Form("모름"),
    lunar_yn: Optional[str] = Form(None),
    leap_month_yn: Optional[str] = Form(None),
):
    return await _register_post(
        request, master_id, name, email, password, password_confirm,
        gender, birth_year, birth_month, birth_day, birth_time,
        lunar_yn, leap_month_yn
    )


@router.get("/expert/{master_id}/login", response_class=HTMLResponse)
async def brand_login_form(request: Request, master_id: str):
    return await _login_form(request, master_id)


@router.post("/expert/{master_id}/login", response_class=HTMLResponse)
async def brand_login_post(
    request: Request, master_id: str,
    login_id: str = Form(...),
    password: str = Form(...),
    remember: Optional[str] = Form(None),
):
    return await _login_post(request, master_id, login_id, password, remember)


@router.get("/expert/{master_id}/forgot-password", response_class=HTMLResponse)
async def brand_forgot_form(request: Request, master_id: str):
    return await _forgot_form(request, master_id)

@router.post("/expert/{master_id}/forgot-password", response_class=HTMLResponse)
async def brand_forgot_post(request: Request, master_id: str, email: str = Form(...)):
    return await _forgot_post(request, master_id, email)

@router.get("/expert/{master_id}/reset-password", response_class=HTMLResponse)
async def brand_reset_form(request: Request, master_id: str, token: str = ""):
    return await _reset_form(request, master_id, token)

@router.post("/expert/{master_id}/reset-password", response_class=HTMLResponse)
async def brand_reset_post(
    request: Request, master_id: str,
    token: str = Form(...),
    password: str = Form(...),
    password_confirm: str = Form(...),
):
    return await _reset_post(request, master_id, token, password, password_confirm)

@router.get("/expert/{master_id}/logout")
async def brand_logout(request: Request, master_id: str):
    return await _logout(request, master_id)


@router.get("/expert/{master_id}/home", response_class=HTMLResponse)
async def brand_home(request: Request, master_id: str):
    return await _home(request, master_id)


@router.get("/expert/{master_id}/profile", response_class=HTMLResponse)
async def brand_profile(request: Request, master_id: str):
    return await _profile(request, master_id)


@router.post("/expert/{master_id}/profile", response_class=HTMLResponse)
async def brand_profile_post(
    request: Request, master_id: str,
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(""),
    password_confirm: str = Form(""),
    gender: str = Form("남"),
    birth_year: int = Form(...),
    birth_month: int = Form(...),
    birth_day: int = Form(...),
    birth_time: str = Form("모름"),
    lunar_yn: Optional[str] = Form(None),
    leap_month_yn: Optional[str] = Form(None),
):
    return await _profile_post(
        request, master_id, name, email, password, password_confirm,
        gender, birth_year, birth_month, birth_day, birth_time,
        lunar_yn, leap_month_yn
    )
