# banya_web — PC ↔ 노트북 개발 워크플로우

PC(메인) + 노트북(외부 작업용) 양쪽에서 같은 프로젝트를 개발하는 절차.

---

## 1. 현재 환경 구성

```
[GitHub Private repo]   https://github.com/provia99/saju-destiny
        ↑↓
        ├── PC (메인)              C:\Users\<사용자>\Desktop\banya_web
        │     · 운영 DB (data/banya.db)
        │     · Ollama + Gemma (챗봇)
        │     · cloudflared 외부 노출 (필요 시)
        │
        └── 노트북 (보조)          C:\Users\provi\Desktop\banya_web
              · 코드 작업만
              · DB 변경 자제
              · cloudflared 외부 노출 (필요 시)
```

---

## 2. 한 번만 셋업 (각 PC)

### PC (이미 일부 진행됨)

```powershell
# 도구 설치
winget install Python.Python.3.14
winget install OpenJS.NodeJS
winget install Git.Git
winget install Cloudflare.cloudflared
winget install Ollama.Ollama

# 프로젝트 클론
cd $env:USERPROFILE\Desktop
git clone https://github.com/provia99/saju-destiny.git banya_web
cd banya_web

# 자산 USB → 같은 위치에 복사
#   engine\fonts, engine\images
#   static\fonts, static\filler, static\tarot
#   templates\imagefolder
#   data\banya.db (서버 정지 후 받은 것)
#   .env

# Python 환경
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Node 환경
cd engine
npm install
cd ..

# Ollama 모델
ollama pull gemma3:9b      # 또는 gemma4:9b 정확한 태그
ollama pull exaone3.5:7.8b # 한국어 비교용

# Claude memory (선택)
# 노트북에서 USB로 복사한 14개 .md 파일을
# %USERPROFILE%\.claude\projects\<자동생성된프로젝트ID>\memory\ 에 붙여넣기

# 동작 확인
python main.py
# → http://localhost:8000 정상 렌더 확인
```

### 노트북 (이미 셋업 완료된 상태)

추가 셋업 없음. 위 PC 절차 중 본인 환경 누락된 것만 보완.

---

## 3. 일상 작업 흐름

### 노트북에서 외부 작업할 때

```powershell
# [가기 전 — PC에서]
cd $env:USERPROFILE\Desktop\banya_web
git push        # 최신 작업 GitHub에 올림

# [노트북 부팅 후]
cd C:\Users\provi\Desktop\banya_web
git pull        # PC에서 푸시한 거 받음

# (의존성 변동 있으면)
.venv\Scripts\activate
pip install -r requirements.txt
# 또는
cd engine && npm install && cd ..

# [작업 시작]
python main.py
# 브라우저: http://localhost:8000

# [외부 노출 필요 시]
# 새 터미널에서:
cloudflared tunnel --url http://localhost:8000
# → 출력의 https://xxx.trycloudflare.com URL 사용

# [작업 종료]
# 서버: Ctrl+C
# 외부 터널: Ctrl+C

# [GitHub로 변경 사항 전달]
git add .
git status                    # 변경 파일 점검
git commit -m "외부 작업: 변경 내용 한 줄"
git push

# 노트북 종료
```

### PC로 돌아왔을 때

```powershell
cd $env:USERPROFILE\Desktop\banya_web
git pull        # 노트북에서 푸시한 거 받음
# 평소처럼 작업
```

---

## 4. 동기화 안 되는 항목 (의식 필요)

| 항목 | 처리 |
|---|---|
| `data/banya.db` | PC가 마스터. 노트북에선 DB 쓰기 자제. 필요 시 USB로 PC→노트북 복사 |
| `.env` | 두 PC 각자 같은 내용 보관 (Git 제외) |
| `engine/fonts/`, `engine/images/` | 한 번 USB 복사 후 그대로 |
| `static/fonts/`, `static/filler/`, `static/tarot/` | 한 번 USB 복사 후 그대로 |
| `templates/imagefolder/` | 한 번 USB 복사 후 그대로 |
| `.venv/` | 각자 따로. requirements.txt 변경 시 `pip install -r requirements.txt` |
| `engine/node_modules/` | 각자 따로. package.json 변경 시 `npm install` |
| AI 모델 (Ollama) | 각자 설치. `ollama pull <모델>` |
| Claude 대화 로그 | PC별 독립 |
| `CLAUDE.md` | Git으로 자동 동기화 (양쪽 동일) |

---

## 5. 외부 접속 방법

### Cloudflare Quick Tunnel (권장, 즉석)

```powershell
# cloudflared 설치 (한 번만)
winget install Cloudflare.cloudflared

# 서버 띄운 채로 별 터미널
cloudflared tunnel --url http://localhost:8000
# → https://xxx-xxx.trycloudflare.com URL 받음
```

특징:
- 계정·도메인 불필요
- 무료 무제한
- HTTPS 자동
- URL 재시작 시 변경됨

### 고정 도메인 (도메인 보유 시)

```powershell
# 한 번만
cloudflared login
cloudflared tunnel create banya-pc
cloudflared tunnel route dns banya-pc banya-pc.yourdomain.com

# 켤 때마다
cloudflared tunnel run --url http://localhost:8000 banya-pc
```

---

## 6. 충돌 방지 규칙

1. **같은 파일을 양쪽에서 동시 수정 X**
   한쪽이 push 한 뒤 다른쪽이 pull → 작업 → push

2. **DB 변경 작업은 PC에서만**
   노트북에서 회원 추가, 집필, 결제 등 DB 쓰기 자제

3. **작업 시작 = `git pull`, 작업 끝 = `git push`**
   항상 묶어서 진행

4. **충돌 발생 시**
   ```powershell
   git status                    # 충돌 파일 확인
   # 에디터에서 <<<<<<< ======= >>>>>>> 마커 직접 편집
   git add .
   git commit -m "충돌 해결"
   git push
   ```

---

## 7. 자주 막히는 곳

| 증상 | 원인 | 해결 |
|---|---|---|
| `pip install` 실패 | venv 미활성 | `.venv\Scripts\activate` 다시 |
| `python main.py` import 에러 | 의존성 빠짐 | `pip install -r requirements.txt` |
| 사주 엔진 호출 timeout | Node 경로 다름 | `routers/brand_site.py:74` 의 `_NODE_DIR_WIN` 확인 |
| 한글 파일명 깨짐 | 인코딩 문제 | zip 압축으로 옮기기 |
| Port 8000 사용 중 | 다른 프로세스 | `netstat -ano | findstr :8000` 으로 PID 찾아 kill |
| `git pull` 시 충돌 | 양쪽 동시 수정 | 위 6번 규칙 참조 |
| Ollama 응답 없음 | 서비스 미실행 | `ollama serve` 또는 시스템 서비스 시작 |
| cloudflared URL 안 받음 | 8000 안 떠있음 | 서버 먼저 띄우기 |

---

## 8. 자산 USB 복사 목록 (신규 PC 셋업 시)

크기 약 1.5GB:

```
banya_web_assets/
├── engine/
│   ├── fonts/       (288MB)  — PDF 폰트, ★ critical
│   └── images/      (511MB)  — PDF 배경·일러스트
├── static/
│   ├── fonts/       (178MB)  — 웹 폰트
│   ├── filler/      (402MB)  — PDF 패딩 페이지
│   └── tarot/       ( 20MB)  — 타로 이미지
├── templates/
│   └── imagefolder/ (105MB)  — 띠 그림 등
├── data/
│   └── banya.db              — DB (서버 정지 후 복사)
└── .env                      — 비밀키
```

---

## 9. 주요 URL/명령 모음

```
GitHub repo:        https://github.com/provia99/saju-destiny
로컬 서버:          http://localhost:8000
관리자 로그인:      http://localhost:8000/login (admin / admin1234)
B2C 인트로:         http://localhost:8000/expert/banya/

자주 쓰는 명령:
  python main.py                              # 서버 시작
  Ctrl+C                                       # 서버 종료
  cloudflared tunnel --url http://localhost:8000  # 외부 노출
  git pull                                     # 받기
  git push                                     # 올리기
  git status                                   # 변경 사항 확인
```

---

## 10. 비상 시 노트북 복원

만약 노트북에서 무언가 꼬였다면:

```powershell
# 옵션 A: 깨끗하게 새로 받기 (변경 사항 손실 주의)
cd $env:USERPROFILE\Desktop
ren banya_web banya_web_old
git clone https://github.com/provia99/saju-destiny.git banya_web
cd banya_web

# 자산·DB·env는 banya_web_old에서 복사해 옴
# 또는 USB에서 다시 복사

# 환경 재구성
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cd engine && npm install && cd ..

# 옵션 B: .git 백업 폴더 복원 (이전 history로 돌아감)
mv .git .git_broken
mv .git_backup_20260430_xxxx .git
```

---

## 11. 핵심 요약 (한 줄)

```
PC ─[push]─→ GitHub ←─[pull/작업/push]─ 노트북 ─[push]─→ GitHub ←─[pull]─ PC
```

GitHub 가 허브, 양쪽이 시간차로 받고 보내는 구조. 동시 작업·DB쓰기 자제.

---

작성: 2026-04-30
관련 파일: `CLAUDE.md` (프로젝트 컨텍스트), `README.md` (있으면)
