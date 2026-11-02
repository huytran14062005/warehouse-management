"""Small Socket.IO notification channel. MySQL remains the source of truth."""

import logging
import os

import jwt
from flask import current_app
from flask_socketio import SocketIO, join_room

from web import db
from web.models import Employee, EmployeeRole, SalesInvoice


socketio = SocketIO(async_mode="threading", logger=False, engineio_logger=False)


def init_realtime(app):
    socketio.init_app(
        app,
        cors_allowed_origins=app.config["FRONTEND_ORIGINS"],
        message_queue=os.getenv("SOCKETIO_REDIS_URL") or None,
        channel="warehouse_sales_invoices",
    )


@socketio.on("connect")
def authorize_socket(auth):
    token = (auth or {}).get("token") if isinstance(auth, dict) else None
    if not token:
        return False
    try:
        claims = jwt.decode(
            token, current_app.config["JWT_SECRET"], algorithms=["HS256"],
            options={"require": ["employee_id", "iat", "exp"]},
        )
        employee = db.session.get(Employee, claims["employee_id"])
        if not employee or employee.is_locked or not employee.is_approved:
            return False
        if claims.get("role") and claims["role"] != employee.role.value:
            return False
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        return False
    join_room(f"employee:{employee.id}")
    if employee.role in {
        EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.THU_KHO,
        EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY,
    }:
        join_room("sales_staff")
    return True


def notify_invoice_changed(invoice_id):
    """Best effort hint after commit. Clients refetch and recover on reconnect."""
    try:
        invoice = db.session.get(SalesInvoice, invoice_id)
        if not invoice:
            return
        payload = {"id": invoice_id}
        socketio.emit("sales-invoice:changed", payload, to="sales_staff")
        for employee_id in {invoice.current_assignee_id, invoice.delivery_employee_id} - {None}:
            socketio.emit("sales-invoice:changed", payload, to=f"employee:{employee_id}")
    except Exception:
        logging.exception("Socket.IO invoice notification failed for %s", invoice_id)
