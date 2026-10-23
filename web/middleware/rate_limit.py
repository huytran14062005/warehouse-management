from collections import defaultdict, deque
from functools import wraps
from threading import Lock
from time import monotonic

from flask import jsonify, request


_requests = defaultdict(deque)
_lock = Lock()


def rate_limit(name, limit, window_seconds):
    """Small dependency-free limiter for authentication endpoints.

    It is intentionally process-local and protects a single app instance. In a
    multi-instance deployment, put the same policy in the API gateway as well.
    """
    def decorator(function):
        @wraps(function)
        def wrapped(*args, **kwargs):
            now = monotonic()
            key = (name, request.remote_addr or "unknown")
            with _lock:
                events = _requests[key]
                while events and now - events[0] >= window_seconds:
                    events.popleft()
                if len(events) >= limit:
                    retry_after = max(1, int(window_seconds - (now - events[0])))
                    response = jsonify({"error": "Có quá nhiều yêu cầu. Vui lòng thử lại sau."})
                    response.headers["Retry-After"] = str(retry_after)
                    return response, 429
                events.append(now)
            return function(*args, **kwargs)
        return wrapped
    return decorator
