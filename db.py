import sqlite3, hashlib, uuid, os
from config import DB_PATH

def get_conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # WAL 모드: 동시 읽기/쓰기 허용 (멀티 집필 필수)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA busy_timeout=5000")  # 5초간 락 대기
    return conn

def create_tables():
    conn = get_conn()
    try:
        c = conn.cursor()

        c.execute("""CREATE TABLE IF NOT EXISTS masters (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            master_id     TEXT UNIQUE NOT NULL,
            선생님이름    TEXT NOT NULL,
            연구소명      TEXT DEFAULT '',
            서명문구      TEXT DEFAULT '',
            마무리인사    TEXT DEFAULT '',
            호칭조사      TEXT DEFAULT '이',
            연락처        TEXT DEFAULT '',
            이메일        TEXT DEFAULT '',
            홈페이지      TEXT DEFAULT '',
            카카오채널    TEXT DEFAULT '',
            브랜드색상    TEXT DEFAULT '#1A3A6A',
            금색          TEXT DEFAULT '#C8B860',
            api_key       TEXT UNIQUE,
            login_id      TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role          TEXT DEFAULT 'master',
            status        TEXT DEFAULT '활성',
            plan          TEXT DEFAULT 'basic',
            memo          TEXT DEFAULT '',
            created_at    TEXT DEFAULT (datetime('now','localtime')),
            updated_at    TEXT DEFAULT (datetime('now','localtime'))
        )""")

        c.execute("""CREATE TABLE IF NOT EXISTS members (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            master_id       TEXT NOT NULL,
            client_id       INTEGER DEFAULT NULL,
            name            TEXT NOT NULL,
            phone           TEXT DEFAULT '',
            email           TEXT DEFAULT '',
            birth_year      INTEGER NOT NULL,
            birth_month     INTEGER NOT NULL,
            birth_day       INTEGER NOT NULL,
            birth_time      TEXT NOT NULL,
            gender          TEXT NOT NULL,
            lunar_yn        INTEGER DEFAULT 0,
            leap_month_yn   INTEGER DEFAULT 0,
            activity_type   TEXT DEFAULT '직장인',
            marital_status  TEXT DEFAULT '미혼',
            has_children    TEXT DEFAULT '없음',
            concern_area    TEXT DEFAULT '종합',
            has_siblings    TEXT DEFAULT '있음',
            parent_status   TEXT DEFAULT '양친',
            health_concern  TEXT DEFAULT '없음',
            memo            TEXT DEFAULT '',
            good_periods    TEXT DEFAULT '',
            bad_periods     TEXT DEFAULT '',
            birth_region    TEXT DEFAULT '',
            birth_time_accuracy TEXT DEFAULT '',
            self_q1         TEXT DEFAULT '',
            self_q2         TEXT DEFAULT '',
            self_q3         TEXT DEFAULT '',
            self_q4         TEXT DEFAULT '',
            self_q5         TEXT DEFAULT '',
            self_q6         TEXT DEFAULT '',
            self_q7         TEXT DEFAULT '',
            status          TEXT DEFAULT '활성',
            request_status  TEXT DEFAULT '대기',
            created_at      TEXT DEFAULT (datetime('now','localtime')),
            updated_at      TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (master_id) REFERENCES masters(master_id)
        )""")
        c.execute("CREATE INDEX IF NOT EXISTS idx_members_master ON members(master_id)")

        c.execute("""CREATE TABLE IF NOT EXISTS saju_books (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            master_id     TEXT NOT NULL,
            member_id     INTEGER NOT NULL,
            book_year     INTEGER NOT NULL,
            edition       TEXT DEFAULT '초판',
            product_type  TEXT DEFAULT 'saju_full',
            master_json   TEXT DEFAULT '',
            pdf_path      TEXT DEFAULT '',
            status        TEXT DEFAULT '대기',
            error_msg     TEXT DEFAULT '',
            price         INTEGER DEFAULT 0,
            paid_yn       INTEGER DEFAULT 0,
            slot_dir      TEXT DEFAULT '',
            partner_member_ids TEXT DEFAULT '',
            created_at    TEXT DEFAULT (datetime('now','localtime')),
            completed_at  TEXT DEFAULT '',
            FOREIGN KEY (master_id) REFERENCES masters(master_id),
            FOREIGN KEY (member_id) REFERENCES members(id)
        )""")

        c.execute("""CREATE TABLE IF NOT EXISTS logs (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            master_id  TEXT DEFAULT '',
            member_id  INTEGER DEFAULT 0,
            action     TEXT DEFAULT '',
            detail     TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime'))
        )""")

        # clients 테이블 (고객 계정 - 손님이 직접 가입)
        c.execute("""CREATE TABLE IF NOT EXISTS clients (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            master_id     TEXT NOT NULL,
            name          TEXT NOT NULL,
            email         TEXT,
            password_hash TEXT NOT NULL,
            phone         TEXT NOT NULL,
            status        TEXT DEFAULT '활성',
            created_at    TEXT DEFAULT (datetime('now','localtime')),
            UNIQUE(master_id, phone),
            UNIQUE(master_id, email),
            FOREIGN KEY (master_id) REFERENCES masters(master_id)
        )""")
        c.execute("CREATE INDEX IF NOT EXISTS idx_clients_master ON clients(master_id)")

        # ===== B2C 결제 시스템 테이블 =====
        # products 테이블 (상품 관리)
        c.execute("""CREATE TABLE IF NOT EXISTS products (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            name                TEXT NOT NULL,
            price               INTEGER NOT NULL,
            delivery_type       TEXT DEFAULT 'immediate',
            delivery_delay_hours INTEGER DEFAULT 0,
            product_type        TEXT DEFAULT 'pdf',
            is_active           INTEGER DEFAULT 1,
            created_at          TEXT DEFAULT (datetime('now','localtime')),
            updated_at          TEXT DEFAULT (datetime('now','localtime'))
        )""")

        # orders 테이블 (주문 관리)
        c.execute("""CREATE TABLE IF NOT EXISTS orders (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id            TEXT UNIQUE NOT NULL,
            client_id           INTEGER,
            product_id          INTEGER NOT NULL,
            amount              INTEGER NOT NULL,
            status              TEXT DEFAULT 'pending',
            payment_key         TEXT,
            payment_method      TEXT,
            created_at          TEXT DEFAULT (datetime('now','localtime')),
            updated_at          TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (client_id) REFERENCES clients(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )""")
        c.execute("CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)")

        # deliveries 테이블 (배송 관리)
        c.execute("""CREATE TABLE IF NOT EXISTS deliveries (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id                INTEGER NOT NULL,
            status                  TEXT DEFAULT 'pending',
            scheduled_delivery_time TEXT,
            actual_delivery_time    TEXT,
            created_at              TEXT DEFAULT (datetime('now','localtime')),
            updated_at              TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (order_id) REFERENCES orders(id)
        )""")
        c.execute("CREATE INDEX IF NOT EXISTS idx_deliveries_order ON deliveries(order_id)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status)")

        # admin 초기 계정
        c.execute("SELECT COUNT(*) FROM masters WHERE login_id='admin'")
        if c.fetchone()[0] == 0:
            pw = hashlib.sha256("admin1234".encode()).hexdigest()
            c.execute("""INSERT INTO masters
                (master_id,선생님이름,login_id,password_hash,role,status)
                VALUES ('admin','운영자','admin',?,'admin','활성')""", (pw,))

        conn.commit()
    finally:
        conn.close()

def hash_pw(pw): return hashlib.sha256(pw.encode()).hexdigest()
def verify_pw(pw, h): return hash_pw(pw) == h
def clean_phone(phone): return "".join(filter(str.isdigit, str(phone))) if phone else ""

def login(login_id, pw):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM masters WHERE login_id=?", (login_id,))
    row = c.fetchone()
    conn.close()
    if not row or not verify_pw(pw, row['password_hash']): return None
    return dict(row)

def get_all_masters(search=None, status=None):
    conn = get_conn()
    c = conn.cursor()
    sql = "SELECT * FROM masters WHERE role != 'admin'"
    params = []
    if search:
        sql += " AND (선생님이름 LIKE ? OR master_id LIKE ?)"
        params += [f"%{search}%"]*2
    if status and status != "전체":
        sql += " AND status=?"
        params.append(status)
    sql += " ORDER BY created_at DESC"
    c.execute(sql, params)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def get_master(master_id):
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("SELECT * FROM masters WHERE master_id=?", (master_id,))
        row = c.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def insert_master(data):
    conn = get_conn()
    c = conn.cursor()
    c.execute("""INSERT INTO masters
        (master_id,선생님이름,연구소명,서명문구,마무리인사,호칭조사,
         연락처,이메일,홈페이지,카카오채널,브랜드색상,금색,
         api_key,login_id,password_hash,role,status,plan,memo)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", (
        data['master_id'], data['선생님이름'], data.get('연구소명',''),
        data.get('서명문구',''), data.get('마무리인사',''), data.get('호칭조사','이'),
        clean_phone(data.get('연락처','')), data.get('이메일',''), data.get('홈페이지',''),
        data.get('카카오채널',''), data.get('브랜드색상','#1A3A6A'),
        data.get('금색','#C8B860'), data.get('api_key',''),
        data['login_id'], data['password_hash'],
        data.get('role','master'), data.get('status','대기'),
        data.get('plan','basic'), data.get('memo','')
    ))
    conn.commit(); conn.close()

def update_master(master_id, data):
    conn = get_conn()
    c = conn.cursor()
    allowed = ['선생님이름','연구소명','서명문구','마무리인사','호칭조사',
               '연락처','이메일','홈페이지','카카오채널','브랜드색상','금색',
               'status','plan','memo','password_hash']
    updates = {k:v for k,v in data.items() if k in allowed}
    if '연락처' in updates: updates['연락처'] = clean_phone(updates['연락처'])
    if not updates: conn.close(); return
    set_clause = ", ".join(f"{k}=?" for k in updates)
    set_clause += ", updated_at=datetime('now','localtime')"
    c.execute(f"UPDATE masters SET {set_clause} WHERE master_id=?",
              list(updates.values()) + [master_id])
    conn.commit(); conn.close()

def get_members(master_id, search=None, status=None):
    conn = get_conn()
    try:
        c = conn.cursor()
        sql = "SELECT * FROM members WHERE master_id=?"
        params = [master_id]
        if search:
            sql += " AND (name LIKE ? OR phone LIKE ?)"
            params += [f"%{search}%"]*2
        if status and status != "전체":
            sql += " AND status=?"
            params.append(status)
        sql += " ORDER BY created_at DESC"
        c.execute(sql, params)
        rows = [dict(r) for r in c.fetchall()]
        return rows
    finally:
        conn.close()

def get_member(member_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM members WHERE id=?", (member_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def insert_member(data):
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("""INSERT INTO members
            (master_id,client_id,name,phone,email,birth_year,birth_month,birth_day,
             birth_time,gender,lunar_yn,leap_month_yn,activity_type,marital_status,
             has_children,concern_area,has_siblings,parent_status,health_concern,memo,request_status,
             birth_region,birth_time_accuracy,self_q1,self_q2,self_q3,self_q4,self_q5,self_q6,self_q7,
             good_periods,bad_periods)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", (
            data['master_id'], data.get('client_id'), data['name'], clean_phone(data.get('phone','')),
            data.get('email',''), int(data['birth_year']), int(data['birth_month']),
            int(data['birth_day']), data['birth_time'], data['gender'],
            int(data.get('lunar_yn',0)), int(data.get('leap_month_yn',0)),
            data.get('activity_type','직장인'),
            data.get('marital_status','미혼'), data.get('has_children','없음'),
            data.get('concern_area','종합'), data.get('has_siblings','있음'),
            data.get('parent_status','양친'), data.get('health_concern','없음'),
            data.get('memo',''), data.get('request_status','대기'),
            data.get('birth_region',''), data.get('birth_time_accuracy',''),
            data.get('self_q1',''), data.get('self_q2',''), data.get('self_q3',''),
            data.get('self_q4',''), data.get('self_q5',''), data.get('self_q6',''), data.get('self_q7',''),
            data.get('good_periods',''), data.get('bad_periods','')
        ))
        new_id = c.lastrowid
        conn.commit()
        return new_id
    finally:
        conn.close()

def update_member(member_id, data):
    conn = get_conn()
    c = conn.cursor()
    allowed = ['name','phone','email','activity_type','marital_status',
               'has_children','concern_area','has_siblings','parent_status',
               'health_concern','memo','good_periods','bad_periods',
               'status','request_status','lunar_yn','leap_month_yn',
               'birth_year','birth_month','birth_day','birth_time','gender',
               'birth_region','birth_time_accuracy',
               'self_q1','self_q2','self_q3','self_q4','self_q5','self_q6','self_q7']
    updates = {k:v for k,v in data.items() if k in allowed}
    if 'phone' in updates: updates['phone'] = clean_phone(updates['phone'])
    if not updates: conn.close(); return
    set_clause = ", ".join(f"{k}=?" for k in updates)
    set_clause += ", updated_at=datetime('now','localtime')"
    c.execute(f"UPDATE members SET {set_clause} WHERE id=?",
              list(updates.values()) + [member_id])
    conn.commit(); conn.close()

def delete_member(member_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("UPDATE members SET status='삭제' WHERE id=?", (member_id,))
    conn.commit(); conn.close()

def insert_book(data):
    conn = get_conn()
    c = conn.cursor()
    c.execute("""INSERT INTO saju_books
        (master_id,member_id,book_year,edition,product_type,status)
        VALUES (?,?,?,?,?,?)""", (
        data['master_id'], data['member_id'],
        data.get('book_year',2026), data.get('edition','초판'),
        data.get('product_type','saju_full'), '대기'
    ))
    new_id = c.lastrowid
    conn.commit(); conn.close()
    return new_id

def update_book(book_id, data):
    conn = get_conn()
    c = conn.cursor()
    allowed = ['master_json','pdf_path','status','error_msg','completed_at','product_type',
               'slot_dir','partner_member_ids','price','paid_yn']
    updates = {k:v for k,v in data.items() if k in allowed}
    if not updates: conn.close(); return
    set_clause = ", ".join(f"{k}=?" for k in updates)
    c.execute(f"UPDATE saju_books SET {set_clause} WHERE id=?",
              list(updates.values()) + [book_id])
    conn.commit(); conn.close()

def get_book(book_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM saju_books WHERE id=?", (book_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def get_books(master_id=None, member_id=None):
    conn = get_conn()
    c = conn.cursor()
    sql = "SELECT * FROM saju_books WHERE 1=1"
    params = []
    if master_id:
        sql += " AND master_id=?"; params.append(master_id)
    if member_id:
        sql += " AND member_id=?"; params.append(member_id)
    sql += " ORDER BY created_at DESC"
    c.execute(sql, params)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def get_stats(master_id):
    conn = get_conn()
    c = conn.cursor()
    def cnt(sql, p): c.execute(sql, p); return c.fetchone()[0]
    stats = {
        '전체회원': cnt("SELECT COUNT(*) FROM members WHERE master_id=? AND status='활성'", [master_id]),
        '완료': cnt("SELECT COUNT(*) FROM saju_books WHERE master_id=? AND status='완료'", [master_id]),
        '대기': cnt("SELECT COUNT(*) FROM saju_books WHERE master_id=? AND status='대기'", [master_id]),
        '오류': cnt("SELECT COUNT(*) FROM saju_books WHERE master_id=? AND status='오류'", [master_id]),
    }
    conn.close()
    return stats

def log_action(master_id, action, detail, member_id=0):
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("INSERT INTO logs (master_id,member_id,action,detail) VALUES (?,?,?,?)",
                  (master_id, member_id, action, detail))
        conn.commit()
    finally:
        conn.close()

def get_client_by_email(master_id: str, email: str):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM clients WHERE master_id=? AND email=?",
              (master_id, email))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def get_client(client_id: int):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM clients WHERE id=?", (client_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def insert_client(data: dict) -> int:
    """
    B2C 회원 생성.
    사주 정보(birth_year 등)가 포함된 경우 members 테이블도 자동 생성.
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        # 1) clients 테이블: 계정 정보만
        c.execute("""INSERT INTO clients
            (master_id, name, email, password_hash, phone)
            VALUES (?,?,?,?,?)""",
            (data['master_id'], data['name'], data.get('email'),
             data['password_hash'], clean_phone(data.get('phone',''))))
        client_id = c.lastrowid
        conn.commit()

        # 2) 사주 정보가 있으면 members 테이블에도 자동 생성
        if data.get('birth_year'):
            c.execute("""INSERT INTO members
                (master_id, client_id, name, phone, email,
                 birth_year, birth_month, birth_day, birth_time,
                 gender, lunar_yn, leap_month_yn,
                 activity_type, marital_status, has_children,
                 concern_area, has_siblings, parent_status,
                 health_concern, memo, request_status)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (data['master_id'], client_id, data['name'],
                 clean_phone(data.get('phone','')), data.get('email',''),
                 int(data['birth_year']), int(data['birth_month']),
                 int(data['birth_day']), data.get('birth_time','모름'),
                 data.get('gender','남'),
                 int(data.get('lunar_yn', 0)),
                 int(data.get('leap_month_yn', 0)),
                 data.get('activity_type','직장인'),
                 data.get('marital_status','미혼'),
                 data.get('has_children','없음'),
                 data.get('concern_area','종합'),
                 data.get('has_siblings','있음'),
                 data.get('parent_status','양친'),
                 data.get('health_concern','없음'),
                 data.get('memo',''), '대기'))
            conn.commit()

        return client_id
    finally:
        conn.close()

def get_member_by_client(master_id: str, client_id: int):
    """client_id로 해당 마스터의 member 조회"""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("""SELECT * FROM members
                      WHERE master_id=? AND client_id=?
                      ORDER BY id DESC LIMIT 1""",
                  (master_id, client_id))
        row = c.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def update_client_visit(client_id: int):
    """방문 카운트 및 최근 방문일 업데이트"""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("""UPDATE clients
            SET visit_count = COALESCE(visit_count, 0) + 1,
                last_visit  = datetime('now','localtime')
            WHERE id=?""", (client_id,))
        conn.commit()
    finally:
        conn.close()

# ── 등급제 (멤버 등록 한도) ─────────────────────────────
TIER_TABLE = [
    (50000, 50),  # 5만원+ → 50명
    (20000, 20),  # 2만원+ → 20명
    (10000, 10),  # 1만원+ → 10명
    (0,      5),  # 무료 → 5명
]

def get_total_paid(client_id: int) -> int:
    """누적 결제액(원). saju_books.price(paid_yn=1) + orders.amount(status=paid 류) 합산."""
    if not client_id:
        return 0
    conn = get_conn()
    c = conn.cursor()
    total = 0
    # B2C orders 테이블
    try:
        c.execute("SELECT COALESCE(SUM(amount),0) FROM orders WHERE client_id=? AND status IN ('paid','completed','done','승인','완료')",
                  (client_id,))
        total += int(c.fetchone()[0] or 0)
    except Exception:
        pass
    # saju_books (마스터 직접 발급분도 client에 연결되어 있으면 합산)
    try:
        c.execute("""SELECT COALESCE(SUM(b.price),0) FROM saju_books b
                     JOIN members m ON m.id = b.member_id
                     WHERE m.client_id=? AND b.paid_yn=1""", (client_id,))
        total += int(c.fetchone()[0] or 0)
    except Exception:
        pass
    conn.close()
    return total


def get_member_limit(client_id: int) -> dict:
    """client의 등록 한도 + 현황 + 다음 등급까지 정보."""
    paid = get_total_paid(client_id)
    limit = 5
    next_threshold = None
    for threshold, lim in TIER_TABLE:
        if paid >= threshold:
            limit = lim
            break
    # 다음 등급 임계
    for threshold, lim in reversed(TIER_TABLE):
        if threshold > paid:
            next_threshold = (threshold, lim)
            break
    # 현재 활성 회원 수
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM members WHERE client_id=? AND status='활성'", (client_id,))
    count = int(c.fetchone()[0] or 0)
    conn.close()
    return {
        "paid": paid,
        "limit": limit,
        "count": count,
        "remaining": max(0, limit - count),
        "next_threshold": next_threshold,  # (금액, 한도) or None
    }


def get_client_by_phone(master_id: str, phone: str):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM clients WHERE master_id=? AND phone=?", (master_id, phone))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def client_login(master_id: str, login_id: str, pw: str):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM clients WHERE master_id=? AND (email=? OR phone=?)",
              (master_id, login_id, clean_phone(login_id)))
    row = c.fetchone()
    conn.close()
    if not row: return None
    client = dict(row)
    if not verify_pw(pw, client['password_hash']): return None
    if client['status'] != '활성': return None
    return client

def get_members_with_requests(master_id: str):
    conn = get_conn()
    c = conn.cursor()
    c.execute("""SELECT m.*, c.email as client_email
                 FROM members m
                 LEFT JOIN clients c ON m.client_id = c.id
                 WHERE m.master_id=?
                 ORDER BY m.created_at DESC""", (master_id,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def approve_member_request(member_id: int):
    conn = get_conn()
    c = conn.cursor()
    c.execute("UPDATE members SET request_status='승인' WHERE id=?", (member_id,))
    conn.commit(); conn.close()

def update_client(client_id: int, data: dict):
    conn = get_conn()
    c = conn.cursor()
    allowed = ['name', 'email', 'phone', 'password_hash']
    updates = {k: v for k, v in data.items() if k in allowed}
    if 'phone' in updates: updates['phone'] = clean_phone(updates['phone'])
    if not updates:
        conn.close()
        return
    set_clause = ", ".join(f"{k}=?" for k in updates)
    c.execute(f"UPDATE clients SET {set_clause} WHERE id=?",
              list(updates.values()) + [client_id])
    conn.commit()
    conn.close()


def soft_delete_client(client_id: int):
    """회원 탈퇴 — clients.status='탈퇴', 연결된 members.status='탈퇴'.
    데이터는 보존(되돌리기/감사용)되고 활성 조회에선 제외됨."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("UPDATE clients SET status='탈퇴' WHERE id=?", (client_id,))
        c.execute("UPDATE members SET status='탈퇴' WHERE client_id=?", (client_id,))
        conn.commit()
    finally:
        conn.close()

# ===== B2C 결제 시스템 헬퍼 함수 =====

def get_products(is_active=True, active_only=None):
    """모든 상품 조회"""
    if active_only is not None:
        is_active = active_only
    conn = get_conn()
    try:
        c = conn.cursor()
        if is_active:
            c.execute("SELECT * FROM products WHERE is_active=1 ORDER BY id")
        else:
            c.execute("SELECT * FROM products ORDER BY id")
        rows = [dict(r) for r in c.fetchall()]
        return rows
    finally:
        conn.close()

def get_product(product_id: int):
    """특정 상품 조회"""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("SELECT * FROM products WHERE id=?", (product_id,))
        row = c.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def insert_product(data: dict) -> int:
    """상품 추가"""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("""INSERT INTO products
            (name, price, delivery_type, delivery_delay_hours, product_type, is_active)
            VALUES (?,?,?,?,?,?)""",
            (data['name'], data['price'], data.get('delivery_type','immediate'),
             data.get('delivery_delay_hours',0), data.get('product_type','pdf'),
             data.get('is_active',1)))
        new_id = c.lastrowid
        conn.commit()
        return new_id
    finally:
        conn.close()

def update_product(product_id: int, data: dict):
    """상품 수정"""
    conn = get_conn()
    try:
        c = conn.cursor()
        allowed = ['name','price','delivery_type','delivery_delay_hours','product_type','is_active']
        updates = {k:v for k,v in data.items() if k in allowed}
        if not updates: return
        set_clause = ", ".join(f"{k}=?" for k in updates)
        set_clause += ", updated_at=datetime('now','localtime')"
        c.execute(f"UPDATE products SET {set_clause} WHERE id=?",
                  list(updates.values()) + [product_id])
        conn.commit()
    finally:
        conn.close()

def insert_order(data: dict) -> int:
    """주문 생성"""
    conn = get_conn()
    try:
        c = conn.cursor()
        order_id = f"ORD-{uuid.uuid4().hex[:12].upper()}"
        c.execute("""INSERT INTO orders
            (order_id, client_id, product_id, amount, status, payment_method)
            VALUES (?,?,?,?,?,?)""",
            (order_id, data.get('client_id'), data['product_id'],
             data['amount'], 'pending', data.get('payment_method','toss')))
        new_id = c.lastrowid
        conn.commit()
        return new_id
    finally:
        conn.close()

def get_order(order_id_or_pk):
    """주문 조회 (order_id 또는 pk)"""
    conn = get_conn()
    try:
        c = conn.cursor()
        if isinstance(order_id_or_pk, str):
            c.execute("SELECT * FROM orders WHERE order_id=?", (order_id_or_pk,))
        else:
            c.execute("SELECT * FROM orders WHERE id=?", (order_id_or_pk,))
        row = c.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def get_orders_by_client(client_id: int):
    """고객의 모든 주문 조회"""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("SELECT * FROM orders WHERE client_id=? ORDER BY created_at DESC", (client_id,))
        rows = [dict(r) for r in c.fetchall()]
        return rows
    finally:
        conn.close()

def update_order(order_id_pk: int, data: dict):
    """주문 상태 업데이트"""
    conn = get_conn()
    try:
        c = conn.cursor()
        allowed = ['status','payment_key','payment_method']
        updates = {k:v for k,v in data.items() if k in allowed}
        if not updates: return
        set_clause = ", ".join(f"{k}=?" for k in updates)
        set_clause += ", updated_at=datetime('now','localtime')"
        c.execute(f"UPDATE orders SET {set_clause} WHERE id=?",
                  list(updates.values()) + [order_id_pk])
        conn.commit()
    finally:
        conn.close()

def insert_delivery(order_id: int, scheduled_time: str = None):
    """배송 생성"""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("""INSERT INTO deliveries
            (order_id, status, scheduled_delivery_time)
            VALUES (?,?,?)""",
            (order_id, 'pending', scheduled_time))
        new_id = c.lastrowid
        conn.commit()
        return new_id
    finally:
        conn.close()

def get_delivery_by_order(order_id: int):
    """주문의 배송 정보 조회"""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("SELECT * FROM deliveries WHERE order_id=?", (order_id,))
        row = c.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def get_pending_deliveries():
    """배송 대기 중인 모든 배송 조회"""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("""SELECT d.*, o.client_id, p.name as product_name
                     FROM deliveries d
                     JOIN orders o ON d.order_id = o.id
                     JOIN products p ON o.product_id = p.id
                     WHERE d.status='pending' AND datetime(d.scheduled_delivery_time) <= datetime('now','localtime')
                     ORDER BY d.scheduled_delivery_time ASC""")
        rows = [dict(r) for r in c.fetchall()]
        return rows
    finally:
        conn.close()

def update_delivery(delivery_id: int, data: dict):
    """배송 상태 업데이트"""
    conn = get_conn()
    try:
        c = conn.cursor()
        allowed = ['status','actual_delivery_time']
        updates = {k:v for k,v in data.items() if k in allowed}
        if not updates: return
        set_clause = ", ".join(f"{k}=?" for k in updates)
        set_clause += ", updated_at=datetime('now','localtime')"
        c.execute(f"UPDATE deliveries SET {set_clause} WHERE id=?",
                  list(updates.values()) + [delivery_id])
        conn.commit()
    finally:
        conn.close()

def migrate():
    conn = get_conn()
    try:
        c = conn.cursor()
        # members 테이블에 leap_month_yn 컬럼이 없으면 추가
        try:
            c.execute("SELECT leap_month_yn FROM members LIMIT 1")
        except sqlite3.OperationalError:
            c.execute("ALTER TABLE members ADD COLUMN leap_month_yn INTEGER DEFAULT 0")
            conn.commit()
        # 참고: marriage_date·children_count 는 acquaintances(관계)에만 저장.
        #       members 측 결혼일/자녀수는 마스터 입력 폼과 불일치라 사용 안 함.

        # saju_books 테이블에 product_type 컬럼이 없으면 추가
        try:
            c.execute("SELECT product_type FROM saju_books LIMIT 1")
        except sqlite3.OperationalError:
            c.execute("ALTER TABLE saju_books ADD COLUMN product_type TEXT DEFAULT 'saju_full'")
            conn.commit()

        # clients 테이블 email NULL 허용으로 마이그레이션
        c.execute("UPDATE clients SET email = NULL WHERE email = ''")
        conn.commit()
        # clients 테이블에 방문 통계 컬럼 추가
        for col, definition in [
            ('visit_count', 'INTEGER DEFAULT 0'),
            ('last_visit',  "TEXT DEFAULT ''"),
        ]:
            try:
                c.execute(f"SELECT {col} FROM clients LIMIT 1")
            except sqlite3.OperationalError:
                c.execute(f"ALTER TABLE clients ADD COLUMN {col} {definition}")
                conn.commit()
        # product_questions 테이블 (상품별 추가 질문)
        try:
            c.execute("SELECT id FROM product_questions LIMIT 1")
        except sqlite3.OperationalError:
            c.execute("""CREATE TABLE IF NOT EXISTS product_questions (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id     INTEGER NOT NULL,
                question_key   TEXT NOT NULL,
                question_label TEXT NOT NULL,
                input_type     TEXT DEFAULT 'text',
                options        TEXT DEFAULT '',
                required       INTEGER DEFAULT 1,
                sort_order     INTEGER DEFAULT 0,
                FOREIGN KEY (product_id) REFERENCES products(id)
            )""")
            conn.commit()
        # order_answers 테이블 (주문별 추가 질문 답변)
        try:
            c.execute("SELECT id FROM order_answers LIMIT 1")
        except sqlite3.OperationalError:
            c.execute("""CREATE TABLE IF NOT EXISTS order_answers (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id      INTEGER NOT NULL,
                question_key  TEXT NOT NULL,
                answer_value  TEXT DEFAULT '',
                FOREIGN KEY (order_id) REFERENCES orders(id)
            )""")
            conn.commit()

        # password_reset_tokens 테이블 (B2C 고객 비밀번호 재설정)
        try:
            c.execute("SELECT token FROM password_reset_tokens LIMIT 1")
        except sqlite3.OperationalError:
            c.execute("""CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id  INTEGER NOT NULL,
                token      TEXT UNIQUE NOT NULL,
                expires_at TEXT NOT NULL,
                used       INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (client_id) REFERENCES clients(id)
            )""")
            c.execute("CREATE INDEX IF NOT EXISTS idx_reset_tokens ON password_reset_tokens(token)")
            conn.commit()
        # remember_tokens 테이블이 없으면 생성
        try:
            c.execute("SELECT token FROM remember_tokens LIMIT 1")
        except sqlite3.OperationalError:
            c.execute("""CREATE TABLE IF NOT EXISTS remember_tokens (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                master_id  TEXT NOT NULL,
                token      TEXT UNIQUE NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (master_id) REFERENCES masters(master_id)
            )""")
            c.execute("CREATE INDEX IF NOT EXISTS idx_remember_tokens ON remember_tokens(token)")
            conn.commit()

        # acquaintances (지인) — client가 등록한 가족·친구·동료 사주
        try:
            c.execute("SELECT id FROM acquaintances LIMIT 1")
        except sqlite3.OperationalError:
            c.execute("""CREATE TABLE IF NOT EXISTS acquaintances (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id       INTEGER NOT NULL,
                name            TEXT NOT NULL,
                gender          TEXT DEFAULT '남',
                birth_year      INTEGER NOT NULL,
                birth_month     INTEGER NOT NULL,
                birth_day       INTEGER NOT NULL,
                birth_time      TEXT DEFAULT '모름',
                lunar_yn        INTEGER DEFAULT 0,
                leap_month_yn   INTEGER DEFAULT 0,
                relation        TEXT DEFAULT '기타',
                memo            TEXT DEFAULT '',
                relation_stage  TEXT,
                relation_years  INTEGER,
                children_count  INTEGER,
                marriage_date   TEXT,
                created_at      TEXT DEFAULT (datetime('now','localtime')),
                updated_at      TEXT DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (client_id) REFERENCES clients(id)
            )""")
            c.execute("CREATE INDEX IF NOT EXISTS idx_acq_client ON acquaintances(client_id)")
            conn.commit()
        # 부가 컬럼 마이그레이션 (기존 테이블에 신규 컬럼 추가)
        _acq_cols = {r[1] for r in c.execute("PRAGMA table_info(acquaintances)").fetchall()}
        # relation_months 가 있으면 relation_years 로 리네임 (구버전 호환)
        if "relation_months" in _acq_cols and "relation_years" not in _acq_cols:
            c.execute("ALTER TABLE acquaintances RENAME COLUMN relation_months TO relation_years")
            _acq_cols.discard("relation_months"); _acq_cols.add("relation_years")
        for _col, _ddl in [
            ("relation_stage", "TEXT"),
            ("relation_years", "INTEGER"),
            ("children_count", "INTEGER"),
            ("marriage_date",  "TEXT"),
        ]:
            if _col not in _acq_cols:
                c.execute(f"ALTER TABLE acquaintances ADD COLUMN {_col} {_ddl}")
        conn.commit()

    finally:
        conn.close()


# ──────────────────────────────────────────────────────────────
# 지인(acquaintances) CRUD — client별 가족·친구·동료 사주 관리
# ──────────────────────────────────────────────────────────────
def insert_acquaintance(client_id: int, data: dict) -> int:
    """지인 추가 → id 반환."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("""INSERT INTO acquaintances
            (client_id, name, gender, birth_year, birth_month, birth_day,
             birth_time, lunar_yn, leap_month_yn, relation, memo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (client_id,
             data.get("name", "").strip(),
             data.get("gender", "남"),
             int(data.get("birth_year", 1990)),
             int(data.get("birth_month", 1)),
             int(data.get("birth_day", 1)),
             data.get("birth_time", "모름"),
             1 if data.get("lunar_yn") else 0,
             1 if data.get("leap_month_yn") else 0,
             data.get("relation", "기타"),
             data.get("memo", "").strip()))
        conn.commit()
        return c.lastrowid
    finally:
        conn.close()


def get_acquaintances_by_client(client_id: int) -> list:
    """해당 client의 지인 목록 (최근 추가순)."""
    conn = get_conn()
    try:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM acquaintances WHERE client_id=? ORDER BY id DESC", (client_id,))
        return [dict(r) for r in c.fetchall()]
    finally:
        conn.close()


def get_acquaintance(acq_id: int) -> dict | None:
    conn = get_conn()
    try:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM acquaintances WHERE id=?", (acq_id,))
        row = c.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def update_acquaintance(acq_id: int, data: dict) -> None:
    conn = get_conn()
    try:
        c = conn.cursor()
        allowed = ["name","gender","birth_year","birth_month","birth_day",
                   "birth_time","lunar_yn","leap_month_yn","relation","memo",
                   "relation_stage","relation_years","children_count","marriage_date"]
        sets, vals = [], []
        for k in allowed:
            if k in data:
                sets.append(f"{k}=?")
                v = data[k]
                if k in ("lunar_yn","leap_month_yn"):
                    v = 1 if v else 0
                elif k in ("birth_year","birth_month","birth_day"):
                    v = int(v)
                elif k in ("relation_years","children_count"):
                    v = int(v) if (v not in (None,"")) else None
                elif k == "marriage_date":
                    v = (v or None) or None
                vals.append(v)
        if not sets:
            return
        sets.append("updated_at=datetime('now','localtime')")
        vals.append(acq_id)
        c.execute(f"UPDATE acquaintances SET {', '.join(sets)} WHERE id=?", vals)
        conn.commit()
    finally:
        conn.close()


def delete_acquaintance(acq_id: int) -> None:
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("DELETE FROM acquaintances WHERE id=?", (acq_id,))
        conn.commit()
    finally:
        conn.close()

def create_remember_token(master_id: str) -> str:
    """자동 로그인 토큰 생성 (30일 유효)"""
    import secrets
    token = secrets.token_urlsafe(48)
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("""INSERT INTO remember_tokens (master_id, token, expires_at)
                      VALUES (?, ?, datetime('now','localtime','+30 days'))""",
                  (master_id, token))
        conn.commit()
        return token
    finally:
        conn.close()

def get_remember_token(token: str):
    """토큰으로 마스터 조회 (만료 안 된 것만)"""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("""SELECT m.* FROM remember_tokens rt
                      JOIN masters m ON rt.master_id = m.master_id
                      WHERE rt.token = ?
                        AND datetime(rt.expires_at) > datetime('now','localtime')""",
                  (token,))
        row = c.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def delete_remember_token(token: str):
    """토큰 삭제 (로그아웃 시)"""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("DELETE FROM remember_tokens WHERE token=?", (token,))
        conn.commit()
    finally:
        conn.close()



def create_password_reset_token(client_id: int) -> str:
    """비밀번호 재설정 토큰 생성 (1시간 유효)"""
    import secrets
    token = secrets.token_urlsafe(32)
    conn = get_conn()
    try:
        c = conn.cursor()
        # 기존 미사용 토큰 삭제
        c.execute("DELETE FROM password_reset_tokens WHERE client_id=? AND used=0", (client_id,))
        c.execute("""INSERT INTO password_reset_tokens (client_id, token, expires_at)
                      VALUES (?, ?, datetime('now','localtime','+1 hours'))""",
                  (client_id, token))
        conn.commit()
        return token
    finally:
        conn.close()

def get_password_reset_token(token: str):
    """토큰으로 client 조회 (만료 안 된 것만)"""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("""SELECT c.*, prt.id as token_pk FROM password_reset_tokens prt
                      JOIN clients c ON prt.client_id = c.id
                      WHERE prt.token = ?
                        AND prt.used = 0
                        AND datetime(prt.expires_at) > datetime('now','localtime')""",
                  (token,))
        row = c.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def use_password_reset_token(token: str, new_pw: str) -> bool:
    """토큰으로 비밀번호 변경 후 토큰 사용 처리"""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("""SELECT prt.id, prt.client_id FROM password_reset_tokens prt
                      WHERE prt.token = ?
                        AND prt.used = 0
                        AND datetime(prt.expires_at) > datetime('now','localtime')""",
                  (token,))
        row = c.fetchone()
        if not row:
            return False
        token_pk, client_id = row[0], row[1]
        new_hash = hash_pw(new_pw)
        c.execute("UPDATE clients SET password_hash=? WHERE id=?", (new_hash, client_id))
        c.execute("UPDATE password_reset_tokens SET used=1 WHERE id=?", (token_pk,))
        conn.commit()
        return True
    finally:
        conn.close()

# ===== 메인 배너 슬라이더 (어드민 관리) =====
def get_banners(master_id: str = None, active_only: bool = True):
    """배너 목록 조회. master_id 지정 시: 그 마스터 + 전역(master_id='') 합쳐서 반환."""
    conn = get_conn()
    c = conn.cursor()
    if master_id:
        sql = "SELECT * FROM banners WHERE (master_id=? OR master_id='')"
        params = [master_id]
    else:
        sql = "SELECT * FROM banners WHERE 1=1"
        params = []
    if active_only:
        sql += " AND is_active=1"
    sql += " ORDER BY position ASC, id ASC"
    c.execute(sql, params)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def get_banner(banner_id: int):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM banners WHERE id=?", (banner_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None


def insert_banner(data: dict) -> int:
    conn = get_conn()
    c = conn.cursor()
    c.execute("""INSERT INTO banners
        (master_id, badge, title_top, title_bottom, sub, icon, href, position, is_active)
        VALUES (?,?,?,?,?,?,?,?,?)""", (
        data.get("master_id", "") or "",
        data.get("badge", ""), data.get("title_top", ""), data.get("title_bottom", ""),
        data.get("sub", ""), data.get("icon", ""), data.get("href", ""),
        int(data.get("position", 0) or 0),
        int(data.get("is_active", 1) or 0),
    ))
    new_id = c.lastrowid
    conn.commit(); conn.close()
    return new_id


def update_banner(banner_id: int, data: dict):
    conn = get_conn()
    c = conn.cursor()
    allowed = ["master_id","badge","title_top","title_bottom","sub","icon","href","position","is_active"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if not updates: conn.close(); return
    set_clause = ", ".join(f"{k}=?" for k in updates) + ", updated_at=datetime('now','localtime')"
    c.execute(f"UPDATE banners SET {set_clause} WHERE id=?",
              list(updates.values()) + [banner_id])
    conn.commit(); conn.close()


def delete_banner(banner_id: int):
    conn = get_conn()
    c = conn.cursor()
    c.execute("DELETE FROM banners WHERE id=?", (banner_id,))
    conn.commit(); conn.close()


create_tables()
migrate()
