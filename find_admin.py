import sqlite3
conn = sqlite3.connect("data/banya.db")
conn.row_factory = sqlite3.Row
c = conn.cursor()
c.execute("SELECT login_id, role, status FROM masters")
for r in c.fetchall():
    print(r["login_id"], r["role"], r["status"])
conn.close()
