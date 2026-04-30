import sqlite3
conn = sqlite3.connect("data/banya.db")

# 마스터 상태 확인
print("=== 마스터 상태 ===")
rows = conn.execute("SELECT master_id, status FROM masters").fetchall()
for r in rows:
    print(r)

# 등록된 B2C 고객 확인
print("\n=== B2C 고객 목록 ===")
rows = conn.execute("SELECT master_id, email, name FROM clients").fetchall()
for r in rows:
    print(r)

conn.close()
