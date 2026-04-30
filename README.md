# 반야선생 사주 관리 웹앱 — banya_web

## 설치
```
pip install -r requirements.txt
```

## Node.js 설치 확인 (집필 엔진용)
```
node --version   # v18 이상 필요
```

## 실행
```
uvicorn main:app --reload --port 8000
```

## 접속
- 관리자: http://localhost:8000/login  (admin / admin1234)
- 고객 랜딩: http://localhost:8000/expert/banya

## 폴더 구조
```
banya_web/
├── main.py              # FastAPI 앱 (바이브코딩으로 생성)
├── db.py                # DB CRUD (바이브코딩으로 생성)
├── brand.py             # 브랜드 관리 (바이브코딩으로 생성)
├── config.py            # 설정 (바이브코딩으로 생성)
├── routers/             # URL 라우터 (바이브코딩으로 생성)
├── templates/           # HTML 템플릿 (바이브코딩으로 생성)
├── static/              # CSS/JS
├── engine/              # 집필 엔진 ← 이미 완성
│   ├── run_all.js       
│   ├── saju_calc.js     # 생시 버그 수정본
│   ├── brands/          # 브랜드 설정
│   └── queue/           # 집필 입출력 폴더
├── data/                # SQLite DB 저장
└── output/              # 완성된 결과 파일 저장
```

## 바이브코딩 시작
vibe_web_app.txt 파일의 STEP 1부터 순서대로 붙여넣기
