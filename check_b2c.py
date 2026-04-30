import sqlite3

conn = sqlite3.connect('data/banya.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

# masters 테이블 확인
c.execute("SELECT master_id, name FROM masters LIMIT 10")
rows = c.fetchall()
print("=== masters 목록 ===")
for r in rows:
    print(f"  master_id: {r['master_id']}, name: {r['name']}")

# b2c_shop 있는지 확인
c.execute("SELECT master_id FROM masters WHERE master_id='b2c_shop'")
row = c.fetchone()
if row:
    print("\nB2C 마스터 있음!")
else:
    print("\nB2C 마스터 없음 - 생성 필요")
    # b2c_shop 마스터 생성
    c.execute("""INSERT OR IGNORE INTO masters 
        (master_id, name, email) 
        VALUES ('b2c_shop', 'B2C 쇼핑몰', 'shop@banya.com')""")
    conn.commit()
    print("B2C 마스터 생성 완료!")

conn.close()

import sqlite3
conn = sqlite3.connect('data/banya.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()
c.execute("SELECT master_id FROM masters WHERE master_id='b2c_shop'")
row = c.fetchone()
if row:
    print('B2C 마스터 있음!')
else:
    c.execute("INSERT OR IGNORE INTO masters (master_id, name, email) VALUES ('b2c_shop', 'B2C Shop', 'shop@banya.com')")
    conn.commit()
    print('B2C 마스터 생성 완료!')
conn.close()

