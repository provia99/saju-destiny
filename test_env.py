import os
from dotenv import load_dotenv
load_dotenv()

smtp_user = os.getenv("SMTP_USER", "")
smtp_pass = os.getenv("SMTP_PASS", "")

print(f"SMTP_USER: '{smtp_user}'")
print(f"SMTP_PASS: '{smtp_pass[:4]}****' (앞 4자리만 표시)")

if not smtp_user:
    print("❌ .env 파일이 없거나 SMTP_USER가 설정되지 않았습니다!")
else:
    print("✅ .env 설정 정상")
