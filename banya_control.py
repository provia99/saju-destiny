"""banya_web Control Panel — 서버·터널·Git 통합 GUI

실행:
    python banya_control.py            # 직접 실행
    또는 PyInstaller 로 .exe 빌드 후 더블클릭

기능:
    - 서버 시작/정지 (uvicorn)
    - Cloudflare Tunnel 시작/정지 (외부 노출 URL 자동 추출 표시)
    - Git pull / push (메시지 입력 다이얼로그)
    - DB 백업
    - 폴더 열기
    - 실시간 상태 표시 + 로그 패널
"""
from __future__ import annotations
import os
import re
import sys
import time
import shutil
import socket
import threading
import subprocess
import webbrowser
from pathlib import Path
from datetime import datetime

import tkinter as tk
from tkinter import ttk, messagebox, simpledialog, scrolledtext

# ──────────────────────────────────────────────────────────────
# 프로젝트 경로 (이 스크립트 위치 기준)
# ──────────────────────────────────────────────────────────────
if getattr(sys, 'frozen', False):
    # PyInstaller 로 빌드된 exe 일 때: exe 가 있는 폴더가 프로젝트 루트
    PROJECT_DIR = Path(sys.executable).resolve().parent
else:
    PROJECT_DIR = Path(__file__).resolve().parent

VENV_PYTHON = PROJECT_DIR / ".venv" / "Scripts" / "python.exe"
VENV_PIP    = PROJECT_DIR / ".venv" / "Scripts" / "pip.exe"

CLOUDFLARED = shutil.which("cloudflared") or "cloudflared"
GIT         = shutil.which("git") or "git"

# ──────────────────────────────────────────────────────────────
# 상태 구조
# ──────────────────────────────────────────────────────────────
class State:
    server_proc: subprocess.Popen | None = None
    tunnel_proc: subprocess.Popen | None = None
    tunnel_url:  str = ""

state = State()


# ──────────────────────────────────────────────────────────────
# 유틸 — 포트 점유 / 프로세스 살아있나 / 명령 실행 등
# ──────────────────────────────────────────────────────────────
def is_port_listening(port: int = 8000) -> bool:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.3)
    try:
        return s.connect_ex(("127.0.0.1", port)) == 0
    finally:
        s.close()


def proc_alive(p: subprocess.Popen | None) -> bool:
    return p is not None and p.poll() is None


def kill_proc_tree(p: subprocess.Popen | None):
    """Windows에서 자식 프로세스까지 정리."""
    if not p:
        return
    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(p.pid)],
                capture_output=True, timeout=5
            )
        else:
            p.terminate()
            try:
                p.wait(timeout=3)
            except subprocess.TimeoutExpired:
                p.kill()
    except Exception:
        pass


def kill_all_python_and_cloudflared():
    """비상 정지 — 모든 python.exe / cloudflared.exe 종료."""
    if os.name == "nt":
        for name in ("python.exe", "cloudflared.exe"):
            subprocess.run(["taskkill", "/F", "/IM", name],
                           capture_output=True, timeout=5)


# ──────────────────────────────────────────────────────────────
# GUI
# ──────────────────────────────────────────────────────────────
class App:
    def __init__(self, root: tk.Tk):
        self.root = root
        root.title("banya_web Control Panel")
        root.geometry("680x560")
        root.minsize(640, 520)

        try:
            root.tk.call("tk", "scaling", 1.2)
        except Exception:
            pass

        self._build_ui()
        self._poll_status()

        root.protocol("WM_DELETE_WINDOW", self._on_close)

    # ─── UI 빌드 ───
    def _build_ui(self):
        pad = {"padx": 8, "pady": 4}

        # 헤더
        header = ttk.Frame(self.root)
        header.pack(fill="x", padx=10, pady=(10, 4))
        ttk.Label(header, text="banya_web", font=("Segoe UI", 14, "bold")).pack(side="left")
        ttk.Label(header, text=f"  ({PROJECT_DIR})",
                  font=("Segoe UI", 8), foreground="#666").pack(side="left")

        # 상태 라인
        status_frame = ttk.LabelFrame(self.root, text="상태")
        status_frame.pack(fill="x", padx=10, pady=4)

        self.lbl_server = ttk.Label(status_frame, text="● 서버: 정지", font=("Segoe UI", 10))
        self.lbl_server.grid(row=0, column=0, sticky="w", **pad)
        self.lbl_tunnel = ttk.Label(status_frame, text="○ 터널: 정지", font=("Segoe UI", 10))
        self.lbl_tunnel.grid(row=1, column=0, sticky="w", **pad)
        self.lbl_url = ttk.Label(status_frame, text="외부 URL: -",
                                  font=("Consolas", 9), foreground="#0a5")
        self.lbl_url.grid(row=2, column=0, sticky="w", **pad)

        ttk.Button(status_frame, text="URL 복사",
                   command=self._copy_url).grid(row=2, column=1, sticky="e", **pad)
        ttk.Button(status_frame, text="브라우저 열기",
                   command=self._open_browser).grid(row=0, column=1, sticky="e", **pad)
        status_frame.grid_columnconfigure(0, weight=1)

        # 메인 액션
        actions = ttk.LabelFrame(self.root, text="실행")
        actions.pack(fill="x", padx=10, pady=4)

        self.btn_server = ttk.Button(actions, text="▶ 서버 시작", width=18,
                                      command=self._toggle_server)
        self.btn_server.grid(row=0, column=0, **pad)
        self.btn_tunnel = ttk.Button(actions, text="🌐 터널 시작", width=18,
                                      command=self._toggle_tunnel)
        self.btn_tunnel.grid(row=0, column=1, **pad)
        ttk.Button(actions, text="⏹ 모두 정지", width=18,
                   command=self._stop_all).grid(row=0, column=2, **pad)

        # Git
        git_frame = ttk.LabelFrame(self.root, text="Git")
        git_frame.pack(fill="x", padx=10, pady=4)
        ttk.Button(git_frame, text="⬇ Pull (받기)", width=18,
                   command=self._git_pull).grid(row=0, column=0, **pad)
        ttk.Button(git_frame, text="⬆ Push (올리기)", width=18,
                   command=self._git_push).grid(row=0, column=1, **pad)
        ttk.Button(git_frame, text="📋 상태 보기", width=18,
                   command=self._git_status).grid(row=0, column=2, **pad)

        # 도구
        tools = ttk.LabelFrame(self.root, text="도구")
        tools.pack(fill="x", padx=10, pady=4)
        ttk.Button(tools, text="💾 DB 백업", width=18,
                   command=self._backup_db).grid(row=0, column=0, **pad)
        ttk.Button(tools, text="📁 폴더 열기", width=18,
                   command=self._open_folder).grid(row=0, column=1, **pad)
        ttk.Button(tools, text="🧹 로그 지우기", width=18,
                   command=self._clear_log).grid(row=0, column=2, **pad)

        # 로그 패널
        log_frame = ttk.LabelFrame(self.root, text="로그 / 출력")
        log_frame.pack(fill="both", expand=True, padx=10, pady=(4, 10))
        self.log = scrolledtext.ScrolledText(log_frame, height=12,
                                              font=("Consolas", 9), wrap="word")
        self.log.pack(fill="both", expand=True, padx=4, pady=4)
        self.log.tag_config("info",  foreground="#333")
        self.log.tag_config("ok",    foreground="#0a5")
        self.log.tag_config("warn",  foreground="#a60")
        self.log.tag_config("err",   foreground="#c00")
        self.log.tag_config("hint",  foreground="#888", font=("Consolas", 9, "italic"))

        self._log("준비 완료. 버튼을 눌러 시작하세요.", "hint")
        self._log(f"프로젝트: {PROJECT_DIR}", "hint")

    # ─── 로그 ───
    def _log(self, msg: str, tag: str = "info"):
        ts = datetime.now().strftime("%H:%M:%S")
        self.log.insert("end", f"[{ts}] {msg}\n", tag)
        self.log.see("end")

    def _clear_log(self):
        self.log.delete("1.0", "end")

    # ─── 상태 폴링 ───
    def _poll_status(self):
        # 서버
        listening = is_port_listening(8000)
        managed = proc_alive(state.server_proc)
        if listening:
            self.lbl_server.config(text="● 서버: 실행 중 (port 8000)", foreground="#0a5")
            self.btn_server.config(text="■ 서버 정지")
        else:
            self.lbl_server.config(text="○ 서버: 정지", foreground="#888")
            self.btn_server.config(text="▶ 서버 시작")
            if managed and not listening:
                # 외부에서 죽었거나 막 시작 중
                pass

        # 터널
        if proc_alive(state.tunnel_proc):
            self.lbl_tunnel.config(text="● 터널: 실행 중", foreground="#0a5")
            self.btn_tunnel.config(text="■ 터널 정지")
            if state.tunnel_url:
                self.lbl_url.config(text=f"외부 URL: {state.tunnel_url}")
            else:
                self.lbl_url.config(text="외부 URL: (URL 발급 대기 중...)")
        else:
            self.lbl_tunnel.config(text="○ 터널: 정지", foreground="#888")
            self.btn_tunnel.config(text="🌐 터널 시작")
            if not state.tunnel_url:
                self.lbl_url.config(text="외부 URL: -")

        self.root.after(1000, self._poll_status)

    # ─── 서버 ───
    def _toggle_server(self):
        if proc_alive(state.server_proc) or is_port_listening(8000):
            self._stop_server()
        else:
            self._start_server()

    def _start_server(self):
        if not VENV_PYTHON.exists():
            self._log("[!] .venv 가 없습니다. setup-env.bat 먼저 실행하세요.", "err")
            messagebox.showerror("환경 미설치",
                                  ".venv 가 없습니다.\nscripts\\setup-env.bat 을 먼저 실행해 주세요.")
            return
        if is_port_listening(8000):
            self._log("[!] 이미 8000 포트가 사용 중입니다. 다른 서버 정지 후 재시도.", "warn")
            return
        try:
            cmd = [str(VENV_PYTHON), "main.py"]
            CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0
            state.server_proc = subprocess.Popen(
                cmd, cwd=str(PROJECT_DIR),
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                creationflags=CREATE_NO_WINDOW,
            )
            self._log(f"서버 시작 (PID {state.server_proc.pid}) — http://localhost:8000", "ok")
            threading.Thread(target=self._read_proc_output,
                              args=(state.server_proc, "[server]"), daemon=True).start()
        except Exception as e:
            self._log(f"서버 시작 실패: {e}", "err")

    def _stop_server(self):
        kill_proc_tree(state.server_proc)
        state.server_proc = None
        # 외부 실행이었으면 잔여 python 도 정리
        if is_port_listening(8000):
            if os.name == "nt":
                subprocess.run(["taskkill", "/F", "/IM", "python.exe"],
                               capture_output=True, timeout=5)
        self._log("서버 정지", "ok")

    # ─── 터널 ───
    def _toggle_tunnel(self):
        if proc_alive(state.tunnel_proc):
            self._stop_tunnel()
        else:
            self._start_tunnel()

    def _start_tunnel(self):
        if not shutil.which("cloudflared"):
            self._log("[!] cloudflared 미설치. winget install Cloudflare.cloudflared", "err")
            messagebox.showerror("cloudflared 없음",
                                  "cloudflared 가 설치되지 않았습니다.\nwinget install Cloudflare.cloudflared")
            return
        try:
            cmd = ["cloudflared", "tunnel", "--url", "http://localhost:8000"]
            CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0
            state.tunnel_proc = subprocess.Popen(
                cmd, cwd=str(PROJECT_DIR),
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding="utf-8", errors="ignore",
                creationflags=CREATE_NO_WINDOW,
            )
            state.tunnel_url = ""
            self._log(f"터널 시작 (PID {state.tunnel_proc.pid}) — URL 발급 대기...", "ok")
            threading.Thread(target=self._read_tunnel_output, daemon=True).start()
        except Exception as e:
            self._log(f"터널 시작 실패: {e}", "err")

    def _stop_tunnel(self):
        kill_proc_tree(state.tunnel_proc)
        state.tunnel_proc = None
        state.tunnel_url = ""
        self._log("터널 정지", "ok")

    def _read_tunnel_output(self):
        """cloudflared 출력에서 trycloudflare URL 추출."""
        proc = state.tunnel_proc
        if not proc or not proc.stdout:
            return
        url_re = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")
        for line in proc.stdout:
            if not line:
                break
            line = line.rstrip()
            if not state.tunnel_url:
                m = url_re.search(line)
                if m:
                    state.tunnel_url = m.group(0)
                    self._log(f"외부 URL 발급: {state.tunnel_url}", "ok")

    def _read_proc_output(self, proc, prefix):
        """서버 출력 일부만 로그에 (한 줄씩)."""
        try:
            for line in iter(proc.stdout.readline, b""):
                if not line:
                    break
                try:
                    text = line.decode("utf-8", errors="ignore").rstrip()
                except Exception:
                    text = str(line)
                if any(k in text for k in ("Application startup complete", "ERROR", "WARNING")):
                    self._log(f"{prefix} {text}", "info")
        except Exception:
            pass

    # ─── 일괄 정지 ───
    def _stop_all(self):
        self._log("모든 프로세스 정지 중...", "info")
        kill_proc_tree(state.server_proc); state.server_proc = None
        kill_proc_tree(state.tunnel_proc); state.tunnel_proc = None
        state.tunnel_url = ""
        kill_all_python_and_cloudflared()
        self._log("정지 완료", "ok")

    # ─── Git (DB 안전 — 서버 자동 정지·재시작) ───
    def _safe_db_op(self, op_name: str, op_fn):
        """DB 안전 흐름: 서버 정지 → pull/push → (필요 시) 재시작."""
        was_running = is_port_listening(8000) or proc_alive(state.server_proc)
        if was_running:
            self._log(f"{op_name}: DB 안전 위해 서버 일시 정지...", "info")
            kill_proc_tree(state.server_proc); state.server_proc = None
            if os.name == "nt":
                subprocess.run(["taskkill", "/F", "/IM", "python.exe"],
                               capture_output=True, timeout=5)
            time.sleep(2)

        op_fn()

        if was_running:
            self._log("서버 자동 재시작...", "info")
            time.sleep(0.5)
            self._start_server()

    def _git_pull(self):
        def _do_pull():
            self._run_git(["pull"], "Pull")
        threading.Thread(target=lambda: self._safe_db_op("Pull", _do_pull),
                          daemon=True).start()

    def _git_push(self):
        # 변경 점검 (서버 안 끄고 미리 봄)
        try:
            r = subprocess.run([GIT, "status", "--porcelain"], cwd=str(PROJECT_DIR),
                               capture_output=True, text=True, timeout=10)
            if not r.stdout.strip():
                self._log("변경 사항 없음 — push 안 함", "warn")
                return
        except Exception as e:
            self._log(f"git status 실패: {e}", "err")
            return

        msg = simpledialog.askstring("커밋 메시지",
                                       "변경 사항 요약 한 줄:",
                                       parent=self.root)
        if not msg:
            self._log("취소됨", "warn")
            return

        def _do_push():
            steps = [
                ([GIT, "add", "."], "stage"),
                ([GIT, "commit", "-m", msg], "commit"),
                ([GIT, "push"], "push"),
            ]
            for cmd, label in steps:
                self._log(f"git {label}...", "info")
                r = subprocess.run(cmd, cwd=str(PROJECT_DIR),
                                    capture_output=True, text=True,
                                    encoding="utf-8", errors="ignore")
                if r.returncode != 0:
                    self._log(f"  실패: {(r.stderr or r.stdout).strip()}", "err")
                    return
            self._log("Push 완료 ✓", "ok")

        threading.Thread(target=lambda: self._safe_db_op("Push", _do_push),
                          daemon=True).start()

    def _git_status(self):
        def _status():
            try:
                r = subprocess.run([GIT, "status", "--short", "--branch"],
                                    cwd=str(PROJECT_DIR),
                                    capture_output=True, text=True,
                                    encoding="utf-8", errors="ignore", timeout=10)
                self._log("git status:", "info")
                for line in (r.stdout or "").splitlines():
                    self._log(f"  {line}", "info")
                if not r.stdout.strip():
                    self._log("  (변경 없음, 깨끗한 상태)", "ok")
            except Exception as e:
                self._log(f"git status 실패: {e}", "err")
        threading.Thread(target=_status, daemon=True).start()

    def _run_git(self, args, label):
        self._log(f"git {label} 시작...", "info")
        try:
            r = subprocess.run([GIT] + args, cwd=str(PROJECT_DIR),
                                capture_output=True, text=True,
                                encoding="utf-8", errors="ignore", timeout=120)
            if r.returncode == 0:
                if r.stdout: self._log(r.stdout.strip(), "info")
                self._log(f"{label} 완료 ✓", "ok")
            else:
                self._log(f"{label} 실패:\n{r.stderr or r.stdout}", "err")
        except subprocess.TimeoutExpired:
            self._log(f"{label} 타임아웃", "err")

    # ─── DB 백업 ───
    def _backup_db(self):
        src = PROJECT_DIR / "data" / "banya.db"
        if not src.exists():
            self._log("data/banya.db 없음", "warn")
            return
        dst_dir = PROJECT_DIR / "backups"
        dst_dir.mkdir(exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M")
        dst = dst_dir / f"banya_{ts}.db"
        try:
            shutil.copy2(src, dst)
            self._log(f"DB 백업 완료: backups/{dst.name} ({dst.stat().st_size:,} bytes)", "ok")
        except Exception as e:
            self._log(f"백업 실패: {e}", "err")

    def _open_folder(self):
        os.startfile(str(PROJECT_DIR))

    def _open_browser(self):
        url = state.tunnel_url or "http://localhost:8000"
        webbrowser.open(url)

    def _copy_url(self):
        url = state.tunnel_url or "http://localhost:8000"
        self.root.clipboard_clear()
        self.root.clipboard_append(url)
        self._log(f"클립보드 복사: {url}", "ok")

    def _on_close(self):
        if proc_alive(state.server_proc) or proc_alive(state.tunnel_proc):
            if not messagebox.askyesno("종료 확인",
                                          "서버/터널이 실행 중입니다. 정지 후 종료할까요?"):
                return
            self._stop_all()
        self.root.destroy()


if __name__ == "__main__":
    root = tk.Tk()
    try:
        ttk.Style().theme_use("vista" if os.name == "nt" else "clam")
    except Exception:
        pass
    App(root)
    root.mainloop()
