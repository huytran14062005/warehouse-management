"""Shared cache for serialized, read-only API results.

MySQL remains authoritative. Redis is optional and cache failures fall back to
the original database query. A successful ORM commit rotates the cache version.
"""

import hashlib
import json
import os
from functools import lru_cache
from urllib.request import Request, urlopen
from uuid import uuid4

from flask import current_app, has_app_context
from sqlalchemy import event
from sqlalchemy.orm import Session


_SCHEMA_VERSION = "v2"
_TIMEOUT_SECONDS = 1.5


class _UpstashRestClient:
    """Bounded-time client for the Redis commands used by this cache."""

    def __init__(self, url, token):
        if not url.startswith("https://"):
            raise ValueError("Upstash REST URL must use HTTPS")
        self.url = url.rstrip("/")
        self.token = token

    def _command(self, *parts):
        request = Request(
            self.url,
            data=json.dumps(parts).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
            },
        )
        with urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
            payload = json.load(response)
        if "error" in payload:
            raise RuntimeError("Redis command failed")
        return payload["result"]

    def get(self, key):
        return self._command("GET", key)

    def set(self, key, value, ttl=None, only_if_missing=False):
        command = ["SET", key, value]
        if ttl is not None:
            command.extend(["EX", ttl])
        if only_if_missing:
            command.append("NX")
        return self._command(*command)


@lru_cache(maxsize=1)
def _client():
    url = os.getenv("UPSTASH_REDIS_REST_URL")
    token = os.getenv("UPSTASH_REDIS_REST_TOKEN")
    return _UpstashRestClient(url, token) if url and token else None


def _prefix():
    database = current_app.config["SQLALCHEMY_DATABASE_URI"]
    database_id = hashlib.sha256(database.encode("utf-8")).hexdigest()[:16]
    namespace = os.getenv("CACHE_NAMESPACE", "warehouse")
    return f"{namespace}:{_SCHEMA_VERSION}:{database_id}"


def _generation_key():
    return f"{_prefix()}:generation"


def _generation(client):
    key = _generation_key()
    version = client.get(key)
    if version is not None:
        return str(version)
    # An evicted version marker must not make old cache entries visible again.
    candidate = uuid4().hex
    client.set(key, candidate, only_if_missing=True)
    version = client.get(key)
    if version is None:
        raise RuntimeError("Redis generation marker unavailable")
    return str(version)


def cached_query(scope, parameters, ttl_seconds, load):
    """Cache a JSON-compatible result; never cache exceptions or ORM objects."""
    try:
        client = _client()
    except Exception:
        current_app.logger.warning("Cache client unavailable; querying MySQL")
        client = None
    if client is None:
        return load()

    fingerprint = hashlib.sha256(
        json.dumps(parameters, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()
    try:
        generation = _generation(client)
        key = f"{_prefix()}:{generation}:{scope}:{fingerprint}"
        cached = client.get(key)
        if cached is not None:
            return current_app.json.loads(cached)
    except Exception:
        current_app.logger.warning("Cache read unavailable; querying MySQL")
        return load()

    result = load()
    try:
        if _generation(client) == generation:
            client.set(key, current_app.json.dumps(result), ttl=ttl_seconds)
    except Exception:
        current_app.logger.warning("Cache write unavailable; returning MySQL result")
    return result


def invalidate_cached_queries():
    """Switch readers to a new namespace after a successful business commit."""
    if not has_app_context():
        return
    try:
        client = _client()
        if client is not None:
            client.set(_generation_key(), uuid4().hex)
    except Exception:
        current_app.logger.warning("Cache invalidation unavailable")


@event.listens_for(Session, "before_flush")
def _mark_business_change(session, _flush_context, _instances):
    changed = session.new.union(session.dirty).union(session.deleted)
    if any(getattr(type(row), "__tablename__", None) != "refresh_sessions" for row in changed):
        session.info["query_cache_changed"] = True


@event.listens_for(Session, "do_orm_execute")
def _mark_bulk_change(state):
    if state.is_update or state.is_delete:
        state.session.info["query_cache_changed"] = True


@event.listens_for(Session, "after_commit")
def _invalidate_after_commit(session):
    if session.info.pop("query_cache_changed", False):
        invalidate_cached_queries()


@event.listens_for(Session, "after_rollback")
def _clear_after_rollback(session):
    session.info.pop("query_cache_changed", None)
