# scripts/ — 자동화 도구

## 🎛 컨트롤 패널 (GUI .exe) ⭐ 추천

`banya_control.py` (프로젝트 루트) — Tkinter 기반 통합 GUI. 더블클릭 한 번으로 모든 기능.

### 빌드 (한 번만)
```
scripts\build-exe.bat 더블클릭
```
→ `dist\banya_control.exe` 생성 → 프로젝트 루트로 자동 복사 옵션.

### 실행
```
banya_control.exe 더블클릭
```

### GUI 기능
- 서버 시작/정지 (uvicorn, port 8000)
- Cloudflare Tunnel 시작/정지 (외부 URL 자동 발급·표시·복사)
- Git Pull / Push (커밋 메시지 입력 다이얼로그)
- DB 백업 (`backups/banya_YYYYMMDD_HHMM.db`)
- 폴더 열기 / 브라우저 열기
- 실시간 상태·로그 패널

---

## 📜 개별 배치파일 (전통 방식)

GUI 안 쓰고 싶거나 작업 스케줄러로 자동화할 때.

### 첫 셋업
| 파일 | 용도 |
|---|---|
| `setup-env.bat` | venv + pip + npm + 누락 점검 |
| `build-exe.bat` | banya_control.exe 빌드 (PyInstaller) |

### 일상 작업
| 파일 | 용도 |
|---|---|
| `git-pull.bat` | 최신 받기 + 의존성 변경 안내 |
| `start-server.bat` | uvicorn 서버 시작 |
| `start-tunnel.bat` | Cloudflare Quick Tunnel |
| `dev-up.bat` | pull + 서버 + (선택)터널 한 번에 |
| `git-push.bat` | 메시지 입력 → commit + push |
| `stop-all.bat` | python·cloudflared 종료 |
| `backup-db.bat` | DB 타임스탬프 백업 |

---

## 추천 흐름

**처음 한 번** (신규 PC):
```
1. scripts\setup-env.bat 더블클릭     (venv·의존성 자동)
2. scripts\build-exe.bat 더블클릭     (banya_control.exe 빌드)
3. banya_control.exe 를 바탕화면 바로가기로 만들기
```

**일상**:
```
바탕화면의 banya_control.exe 더블클릭
  └─ 서버 시작/정지, 터널, Git pull/push, DB 백업 모두 한 화면에서
```

**예외 상황** (GUI 안 띄우고 빠르게):
```
scripts\stop-all.bat   ← 강제 정지
scripts\backup-db.bat  ← DB만 백업 (작업 스케줄러 등록도 가능)
```

---

## 작업 스케줄러로 일일 백업

매일 새벽 3시 DB 자동 백업:

1. Windows + R → `taskschd.msc`
2. 작업 만들기:
   - 트리거: 매일 03:00
   - 동작: 프로그램 시작 → `C:\Users\<사용자>\Desktop\banya_web\scripts\backup-db.bat`
3. 저장

---

## 주의

- `banya_control.exe` 는 PyInstaller 로 빌드된 단일 실행파일 — 첫 실행 시 임시 폴더에 압축 해제하느라 1~2초 지연 정상
- 어느 PC 든 `banya_control.exe` 가 위치한 폴더 = 프로젝트 루트로 인식 (스크립트가 자기 위치 기준 동작)
- 양 PC (노트북·PC) 각자 빌드해서 사용 (빌드 산출물은 Git 제외)
