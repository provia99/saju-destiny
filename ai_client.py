"""LLM 클라이언트 추상화 — 로컬 Ollama 기본, 차후 다른 백엔드로 교체 가능.

환경변수:
  AI_BACKEND      = "ollama" (기본) | "google" | …
  AI_MODEL        = "gemma3:9b" / "exaone3.5:7.8b" / "gemma:4b" 등 (Ollama 모델명)
  OLLAMA_HOST     = "http://localhost:11434" (기본)

사용:
  from ai_client import generate, generate_stream
  text = generate(system="...", user="...")
  for chunk in generate_stream(...): yield chunk
"""

from __future__ import annotations
import os
import json
import urllib.request
import urllib.error
from typing import Iterator, Optional

AI_BACKEND  = os.environ.get("AI_BACKEND", "ollama").lower()
AI_MODEL    = os.environ.get("AI_MODEL",   "gemma3:9b")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

# 응답 길이·온도 등 디폴트
DEFAULT_TEMPERATURE = 0.7
DEFAULT_NUM_PREDICT = 512  # 약 200~300자 한국어


class AIError(RuntimeError):
    pass


# ──────────────────────────────────────────────────────────────
# Ollama 백엔드
# ──────────────────────────────────────────────────────────────
def _ollama_chat(system: str, user: str, *,
                 stream: bool = False,
                 temperature: float = DEFAULT_TEMPERATURE,
                 num_predict: int = DEFAULT_NUM_PREDICT,
                 timeout: int = 60):
    """Ollama /api/chat 호출. stream=False 면 전체 텍스트, True 면 generator."""
    payload = {
        "model": AI_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        "stream": stream,
        "options": {
            "temperature": temperature,
            "num_predict": num_predict,
        },
    }
    url = f"{OLLAMA_HOST.rstrip('/')}/api/chat"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data,
                                  headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
    except urllib.error.URLError as e:
        raise AIError(f"Ollama 연결 실패 ({OLLAMA_HOST}): {e}") from e

    if not stream:
        body = resp.read().decode("utf-8")
        try:
            obj = json.loads(body)
            return (obj.get("message") or {}).get("content", "").strip()
        except json.JSONDecodeError as e:
            raise AIError(f"Ollama 응답 파싱 실패: {e}") from e

    # stream=True → NDJSON 라인별로 파싱하며 chunk yield
    def _gen():
        for line in resp:
            line = line.decode("utf-8").strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            content = (obj.get("message") or {}).get("content", "")
            if content:
                yield content
            if obj.get("done"):
                break
    return _gen()


# ──────────────────────────────────────────────────────────────
# 공용 인터페이스 — 백엔드 교체 가능
# ──────────────────────────────────────────────────────────────
def generate(system: str, user: str,
             *, temperature: float = DEFAULT_TEMPERATURE,
             num_predict: int = DEFAULT_NUM_PREDICT,
             timeout: int = 60) -> str:
    """단일 응답 (블로킹). 실패 시 AIError."""
    if AI_BACKEND == "ollama":
        return _ollama_chat(system, user,
                            stream=False, temperature=temperature,
                            num_predict=num_predict, timeout=timeout)
    raise AIError(f"지원하지 않는 백엔드: {AI_BACKEND}")


def generate_stream(system: str, user: str,
                    *, temperature: float = DEFAULT_TEMPERATURE,
                    num_predict: int = DEFAULT_NUM_PREDICT,
                    timeout: int = 60) -> Iterator[str]:
    """스트리밍 응답. chunk 단위 yield. 실패 시 AIError."""
    if AI_BACKEND == "ollama":
        return _ollama_chat(system, user,
                            stream=True, temperature=temperature,
                            num_predict=num_predict, timeout=timeout)
    raise AIError(f"지원하지 않는 백엔드: {AI_BACKEND}")


def health() -> dict:
    """현재 AI 백엔드·모델 정상 여부. 디버그용."""
    if AI_BACKEND == "ollama":
        try:
            url = f"{OLLAMA_HOST.rstrip('/')}/api/tags"
            resp = urllib.request.urlopen(url, timeout=3)
            tags = json.loads(resp.read().decode("utf-8"))
            models = [m.get("name") for m in (tags.get("models") or [])]
            return {
                "backend": "ollama",
                "host": OLLAMA_HOST,
                "model_set": AI_MODEL,
                "model_available": AI_MODEL in models,
                "installed_models": models,
            }
        except Exception as e:
            return {
                "backend": "ollama",
                "host": OLLAMA_HOST,
                "ok": False,
                "error": str(e),
            }
    return {"backend": AI_BACKEND, "ok": False, "error": "unsupported backend"}
