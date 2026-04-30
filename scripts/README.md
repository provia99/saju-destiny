# scripts/ — 자동화 배치파일

PC/노트북 양쪽에서 똑같이 동작. 더블클릭 실행.

## 첫 셋업

| 파일 | 용도 | 언제 |
|---|---|---|
| `setup-env.bat` | venv + pip + npm 일괄 셋업 + 누락 점검 | PC 처음 한 번 |

## 일상 작업

| 파일 | 용도 | 언제 |
|---|---|---|
| `git-pull.bat` | GitHub 에서 최신 받기 + 의존성 변경 안내 | 작업 시작 시 |
| `start-server.bat` | uvicorn 서버 시작 (localhost:8000) | 작업 중 |
| `start-tunnel.bat` | Cloudflare Quick Tunnel (외부 HTTPS URL) | 외부 노출 필요 시 |
| `dev-up.bat` | pull + 서버 + (선택)터널 한 번에 | 종합 |
| `git-push.bat` | 메시지 입력받아 commit + push | 작업 종료 시 |
| `stop-all.bat` | python·cloudflared 모든 프로세스 종료 | 정리 |
| `backup-db.bat` | data\banya.db → backups\banya_YYYYMMDD_HHMM.db | 일일 백업 |

## 전형 흐름

**작업 시작**:
```
git-pull.bat → dev-up.bat
```

**또는 더 단순**:
```
dev-up.bat  (자체적으로 pull 도 함)
```

**작업 종료**:
```
git-push.bat → stop-all.bat
```

**일일 백업** (Windows 작업 스케줄러로 자동화 가능):
```
backup-db.bat
```

## 바로가기 만들기 (선택)

자주 쓰는 거(`dev-up.bat`, `git-push.bat`, `stop-all.bat`) 우클릭 → **바로 가기 만들기** → 바탕화면으로 옮김. 더블클릭 한 번에 실행.

## 작업 스케줄러 자동 백업 (선택)

매일 새벽 3시 DB 백업:
1. Windows + R → `taskschd.msc` 실행
2. 작업 만들기 → 트리거: 매일 03:00
3. 동작: `C:\Users\<사용자>\Desktop\banya_web\scripts\backup-db.bat`
4. 저장
