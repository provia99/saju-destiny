import sys
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv()

from config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# 테스트할 이메일 주소 (실제 받을 주소로 변경)
TEST_EMAIL = "hello.saju8ja@gmail.com"

print(f"SMTP_HOST: {SMTP_HOST}")
print(f"SMTP_PORT: {SMTP_PORT}")
print(f"SMTP_USER: {SMTP_USER}")
print(f"SMTP_FROM: {SMTP_FROM}")

try:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "[반야] 비밀번호 재설정 테스트"
    msg["From"] = SMTP_FROM
    msg["To"] = TEST_EMAIL

    html_body = """
    <div style="font-family:sans-serif;padding:32px;">
        <h2>비밀번호 재설정 테스트</h2>
        <p>이 메일이 보이면 정상입니다! ✅</p>
    </div>
    """
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
        s.ehlo()
        s.starttls()
        s.login(SMTP_USER, SMTP_PASS)
        s.sendmail(SMTP_FROM, [TEST_EMAIL], msg.as_string())

    print("✅ 발송 성공!")
except Exception as e:
    print(f"❌ 오류: {e}")
