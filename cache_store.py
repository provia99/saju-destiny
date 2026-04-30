"""사용자별 결과물 캐시 — 신년운세·정통사주·짝궁합·오늘의운세 등 재사용 결과 저장.

API 만 안정적으로 유지하면 내부 구현은 트래픽 증가 시점에 SQLite/Redis 등으로 무중단 교체 가능.

현재 구현: in-memory dict (서버 재시작 시 휘발).
점진 업그레이드 경로:
  ~수백명: 그대로
  ~1만명:  SQLite (data/cache.db) 단일 테이블
  ~10만명: + 인덱스/WAL/만료정리
  10만+:   샤딩 또는 외부 KV

캐시 키 가이드:
  - 입력값 해시(input_hash)를 키 일부에 포함 → 입력 변경 시 자동 무효 (수동 invalidate 빠뜨려도 안전)
  - 시간 의존(오늘의운세)이면 ttl_seconds 사용 + 키에 날짜 포함
"""

from __future__ import annotations
import hashlib
import json
import time
from typing import Any, Optional, Iterable

# (client_id, namespace, key) -> (value, expires_at_unix_or_None)
_MEM: dict[tuple[int, str, str], tuple[Any, Optional[float]]] = {}


def get(client_id: int, namespace: str, key: str) -> Optional[Any]:
    """캐시 조회. 만료된 항목은 즉시 제거. 없으면 None."""
    k = (int(client_id), str(namespace), str(key))
    item = _MEM.get(k)
    if not item:
        return None
    value, expires_at = item
    if expires_at is not None and time.time() > expires_at:
        _MEM.pop(k, None)
        return None
    return value


def set(client_id: int, namespace: str, key: str,
        value: Any, ttl_seconds: Optional[int] = None) -> None:
    """캐시 저장. ttl_seconds 가 주어지면 그 초 후 만료. JSON-직렬화 가능한 값만 권장."""
    k = (int(client_id), str(namespace), str(key))
    expires_at = (time.time() + ttl_seconds) if ttl_seconds else None
    _MEM[k] = (value, expires_at)


def invalidate(client_id: int, namespace: Optional[str] = None) -> int:
    """해당 클라이언트의 캐시 무효화.
    namespace 가 None 이면 그 사용자 전체, 아니면 해당 namespace 만 삭제.
    삭제된 항목 수 반환."""
    cid = int(client_id)
    targets = [
        k for k in _MEM
        if k[0] == cid and (namespace is None or k[1] == namespace)
    ]
    for k in targets:
        _MEM.pop(k, None)
    return len(targets)


def cleanup_expired() -> int:
    """만료된 항목 일괄 삭제. 크론용. 삭제된 항목 수 반환."""
    now = time.time()
    targets = [k for k, (_, exp) in _MEM.items() if exp is not None and now > exp]
    for k in targets:
        _MEM.pop(k, None)
    return len(targets)


def stats() -> dict:
    """디버그/모니터링용 — 현재 캐시 항목 수 등."""
    now = time.time()
    total = len(_MEM)
    expired = sum(1 for _, exp in _MEM.values() if exp is not None and now > exp)
    by_ns: dict[str, int] = {}
    for (_, ns, _) in _MEM:
        by_ns[ns] = by_ns.get(ns, 0) + 1
    return {
        "total": total,
        "expired_pending_cleanup": expired,
        "by_namespace": by_ns,
    }


# ──────────────────────────────────────────────────────────────
# 입력 해시 헬퍼 — 사용자 사주·자가응답을 하나의 안정적인 키로
# ──────────────────────────────────────────────────────────────
_INPUT_FIELDS_DEFAULT = (
    "birth_year", "birth_month", "birth_day", "birth_time",
    "lunar_yn", "leap_month_yn", "gender",
    "self_q1", "self_q2", "self_q3", "self_q4", "self_q5", "self_q6", "self_q7",
)


def input_hash(client: dict, fields: Optional[Iterable[str]] = None, length: int = 12) -> str:
    """클라이언트 사주·자가응답으로부터 SHA1 해시 생성.
    fields 가 None 이면 표준 사주+자가응답 필드 사용.
    값 하나라도 변경되면 해시가 달라져 기존 캐시는 자동 미스."""
    keys = list(fields) if fields is not None else list(_INPUT_FIELDS_DEFAULT)
    parts = []
    for k in keys:
        v = client.get(k) if isinstance(client, dict) else None
        parts.append(f"{k}={v if v is not None else ''}")
    payload = "|".join(parts).encode("utf-8")
    return hashlib.sha1(payload).hexdigest()[:length]
