import smtplib
from email.mime.text import MIMEText

SMTP_USER = "hello.saju8ja@gmail.com"
SMTP_PASS = "plcuupoiunaysdyb"

msg = MIMEText("테스트 이메일입니다.", "plain", "utf-8")
msg["Subject"] = "반야 SMTP 테스트"
msg["From"] = SMTP_USER
msg["To"] = SMTP_USER  # 자기 자신에게 발송

try:
    with smtplib.SMTP("smtp.gmail.com", 587) as s:
        s.ehlo()
        s.starttls()
        s.login(SMTP_USER, SMTP_PASS)
        s.sendmail(SMTP_USER, [SMTP_USER], msg.as_string())
    print("✅ 발송 성공!")
except Exception as e:
    print(f"❌ 오류: {e}")
