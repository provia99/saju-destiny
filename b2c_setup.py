# -*- coding: utf-8 -*-
import sqlite3
import hashlib

conn = sqlite3.connect('data/banya.db')
c = conn.cursor()

# b2c_shop 이미 있는지 확인
c.execute("SELECT master_id FROM masters WHERE master_id='b2c_shop'")
row = c.fetchone()

if row:
    print('B2C 마스터 이미 있음!')
else:
    try:
        pw_hash = hashlib.sha256('b2c_shop_pw'.encode()).hexdigest()
        c.execute(
            "INSERT INTO masters "
            "(master_id, \uc120\uc0dd\ub2d8\uc774\ub984, \uc774\uba54\uc77c, login_id, password_hash, role, status) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            ('b2c_shop', 'B2C \uc1fc\ud551\ub9f0', 'shop@banya.com',
             'b2c_shop', pw_hash, 'master', '\ud65c\uc131')
        )
        conn.commit()
        print('B2C \ub9c8\uc2a4\ud130 \uc0dd\uc131 \uc644\ub8cc!')
    except Exception as e:
        print('Error:', e)

conn.close()
