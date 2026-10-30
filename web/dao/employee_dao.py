from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, or_
from datetime import datetime

from web import db
from web.models import Employee, EmployeeRole
from web.config import Config
from web.utils.password_hasher import hash_password, verify_password


def get_employee_by_id(employee_id):
    return Employee.query.get(employee_id)


def get_employee_by_username(username):
    return Employee.query.filter(Employee.username == username.strip()).first()


def get_employee_by_phone(phone):
    return Employee.query.filter(Employee.phone == phone.strip()).first()


def get_employee_by_email(email):
    return Employee.query.filter(func.lower(Employee.email) == email.strip().lower()).first()


def auth_employee(username, password):
    employee = get_employee_by_username(username)

    if employee and verify_password(password, employee.password_hash):
        return employee

    return None


def add_employee(full_name, phone, username, email, password, role):
    employee = Employee(
        full_name=full_name,
        phone=phone,
        username=username,
        email=email,
        password_hash=hash_password(password),
        role=role,
    )

    db.session.add(employee)

    try:
        db.session.commit()
        return employee
    except IntegrityError:
        db.session.rollback()
        raise
    except Exception as ex:
        db.session.rollback()
        raise Exception(f"Lỗi hệ thống: {str(ex)}!")


def update_employee_password(employee, new_password):
    employee.password_hash = hash_password(new_password)
    try:
        db.session.commit()
        db.session.refresh(employee)
        return employee
    except Exception:
        db.session.rollback()
        raise


def get_manageable_employees(page=1, per_page=None, keyword=None, status=None):
    """Return non-manager employee accounts for manager administration."""
    query = Employee.query.filter(Employee.role != EmployeeRole.QUAN_LY)
    if keyword:
        term = f"%{keyword.strip()}%"
        query = query.filter(or_(
            Employee.full_name.ilike(term),
            Employee.username.ilike(term),
            Employee.email.ilike(term),
            Employee.phone.ilike(term),
        ))
    if status == "pending":
        query = query.filter(Employee.is_approved.is_(False))
    elif status == "approved":
        query = query.filter(Employee.is_approved.is_(True))
    elif status == "locked":
        query = query.filter(Employee.is_locked.is_(True))
    elif status == "active":
        query = query.filter(Employee.is_approved.is_(True), Employee.is_locked.is_(False))

    query = query.order_by(Employee.is_approved.asc(), Employee.created_at.desc(), Employee.id.desc())
    total = query.order_by(None).count()
    if per_page is None:
        per_page = Config.APPLICATION_SIZE
    rows = query.offset((page - 1) * per_page).limit(per_page).all()
    return rows, total


def approve_employee(employee):
    employee.is_approved = True
    employee.approved_at = datetime.now()
    try:
        db.session.commit()
        db.session.refresh(employee)
        return employee
    except Exception:
        db.session.rollback()
        raise


def set_employee_locked(employee, is_locked):
    employee.is_locked = bool(is_locked)
    try:
        db.session.commit()
        db.session.refresh(employee)
        return employee
    except Exception:
        db.session.rollback()
        raise
