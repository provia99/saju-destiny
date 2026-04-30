# ─── db.py 에 추가할 내용 ─────────────────────────────────────────────────────
# create_tables() 함수 안의 마지막 c.execute 블록 뒤에 아래 테이블 생성 코드를 추가하세요.
# (deliveries 테이블 생성 코드 바로 뒤)

"""
        # remember_tokens 테이블 (자동 로그인 토큰)
        c.execute(\"\"\"CREATE TABLE IF NOT EXISTS remember_tokens (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            master_id  TEXT NOT NULL,
            token      TEXT UNIQUE NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (master_id) REFERENCES masters(master_id)
        )\"\"\")
        c.execute("CREATE INDEX IF NOT EXISTS idx_remember_tokens ON remember_tokens(token)")
"""

# ─── migrate() 함수 안에 아래 내용을 추가하세요 ───────────────────────────────
"""
        # remember_tokens 테이블이 없으면 생성
        try:
            c.execute("SELECT token FROM remember_tokens LIMIT 1")
        except sqlite3.OperationalError:
            c.execute(\"\"\"CREATE TABLE IF NOT EXISTS remember_tokens (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                master_id  TEXT NOT NULL,
                token      TEXT UNIQUE NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (master_id) REFERENCES masters(master_id)
            )\"\"\")
            c.execute("CREATE INDEX IF NOT EXISTS idx_remember_tokens ON remember_tokens(token)")
            conn.commit()
"""

# ─── db.py 파일 맨 아래 (migrate() 함수 뒤, create_tables()/migrate() 호출 전) 에 추가 ───
"""
def create_remember_token(master_id: str) -> str:
    \"\"\"자동 로그인 토큰 생성 (30일 유효)\"\"\"
    import secrets
    token = secrets.token_urlsafe(48)
    conn = get_conn()
    try:
        c = conn.cursor()
        # 만료 30일 후
        c.execute(\"\"\"INSERT INTO remember_tokens (master_id, token, expires_at)
                      VALUES (?, ?, datetime('now','localtime','+30 days'))\"\"\",
                  (master_id, token))
        conn.commit()
        return token
    finally:
        conn.close()

def get_remember_token(token: str):
    \"\"\"토큰으로 마스터 조회 (만료 안 된 것만)\"\"\"
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute(\"\"\"SELECT m.* FROM remember_tokens rt
                      JOIN masters m ON rt.master_id = m.master_id
                      WHERE rt.token = ?
                        AND datetime(rt.expires_at) > datetime('now','localtime')\"\"\",
                  (token,))
        row = c.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def delete_remember_token(token: str):
    \"\"\"토큰 삭제 (로그아웃 시)\"\"\"
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("DELETE FROM remember_tokens WHERE token=?", (token,))
        conn.commit()
    finally:
        conn.close()

def delete_all_remember_tokens(master_id: str):
    \"\"\"해당 마스터의 모든 토큰 삭제\"\"\"
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("DELETE FROM remember_tokens WHERE master_id=?", (master_id,))
        conn.commit()
    finally:
        conn.close()
"""
