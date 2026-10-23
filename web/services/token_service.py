import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from flask import current_app
from sqlalchemy.orm import joinedload

from web import db
from web.models import RefreshSession
from web.services.exceptions import AuthenticationError


def create_access_token(employee):
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(
        seconds=current_app.config["JWT_ACCESS_TOKEN_EXPIRES_SECONDS"]
    )

    return jwt.encode({
        "employee_id": employee.id,
        "username": employee.username,
        "role": employee.role.value,
        "iat": issued_at,
        "exp": expires_at,
    }, current_app.config["JWT_SECRET"], algorithm="HS256")


def _hash_refresh_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _new_refresh_token():
    token = secrets.token_urlsafe(48)
    expires_at = _utc_now_naive() + timedelta(
        days=current_app.config["JWT_REFRESH_TOKEN_EXPIRES_DAYS"]
    )
    return token, expires_at


def _utc_now_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _commit_changes():
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def create_refresh_session(employee):
    token, expires_at = _new_refresh_token()
    refresh_session = RefreshSession(
        employee_id=employee.id,
        token_hash=_hash_refresh_token(token),
        expires_at=expires_at,
    )

    db.session.add(refresh_session)
    _commit_changes()

    return token


def validate_refresh_session(token):
    if not token:
        raise AuthenticationError("Phiên đăng nhập không tồn tại")

    now = _utc_now_naive()
    refresh_session = (
        RefreshSession.query
        .options(joinedload(RefreshSession.employee))
        .filter(RefreshSession.token_hash == _hash_refresh_token(token))
        .first()
    )

    if not refresh_session or refresh_session.revoked_at or refresh_session.expires_at <= now:
        raise AuthenticationError("Phiên đăng nhập đã hết hạn")

    employee = refresh_session.employee
    if not employee or employee.is_locked or not employee.is_approved:
        raise AuthenticationError("Tài khoản không thể tiếp tục đăng nhập")

    return employee


def rotate_refresh_session(token):
    """Atomically revoke a refresh token and issue its replacement."""
    if not token:
        raise AuthenticationError("Phiên đăng nhập không tồn tại")

    refresh_session = (
        RefreshSession.query
        .options(joinedload(RefreshSession.employee))
        .filter(RefreshSession.token_hash == _hash_refresh_token(token))
        .with_for_update()
        .first()
    )
    now = _utc_now_naive()
    if not refresh_session or refresh_session.revoked_at or refresh_session.expires_at <= now:
        raise AuthenticationError("Phiên đăng nhập đã hết hạn")

    employee = refresh_session.employee
    if not employee or employee.is_locked or not employee.is_approved:
        raise AuthenticationError("Tài khoản không thể tiếp tục đăng nhập")

    new_token, expires_at = _new_refresh_token()
    refresh_session.revoked_at = now
    db.session.add(RefreshSession(
        employee_id=employee.id,
        token_hash=_hash_refresh_token(new_token),
        expires_at=expires_at,
    ))
    _commit_changes()
    return employee, new_token


def revoke_refresh_session(token):
    if not token:
        return False

    refresh_session = RefreshSession.query.filter(
        RefreshSession.token_hash == _hash_refresh_token(token),
        RefreshSession.revoked_at.is_(None),
    ).first()

    if not refresh_session:
        return False

    refresh_session.revoked_at = _utc_now_naive()
    _commit_changes()

    return True


def revoke_all_refresh_sessions(employee_id):
    """Revoke every refresh session after a security-sensitive account change."""
    sessions = RefreshSession.query.filter(
        RefreshSession.employee_id == employee_id,
        RefreshSession.revoked_at.is_(None),
    ).all()
    now = _utc_now_naive()
    for session in sessions:
        session.revoked_at = now
    if sessions:
        _commit_changes()
    return len(sessions)
