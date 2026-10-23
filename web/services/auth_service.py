from web import dao
from web.models import EmployeeRole
from web.services.exceptions import ValidationError
from web.services.validators import (
    validate_full_name,
    validate_email,
    validate_password_confirmation,
    validate_password_strength,
    validate_phone,
    validate_required_fields,
    validate_username_format,
)


REGISTERABLE_ROLES = {
    role.value: role
    for role in EmployeeRole
    if role != EmployeeRole.QUAN_LY
}


def check_constraint_of_username(username):
    text = validate_username_format(username)

    if dao.get_employee_by_username(text):
        raise ValidationError("Username này đã tồn tại!")

    return text


def check_constraint_of_phone(phone):
    text = validate_phone(phone)

    if dao.get_employee_by_phone(text):
        raise ValidationError("Số điện thoại này đã tồn tại!")

    return text


def check_constraint_of_email(email):
    text = validate_email(email)

    if dao.get_employee_by_email(text):
        raise ValidationError("Email này đã tồn tại!")

    return text


def check_constraint_of_password(password, confirm):
    validate_password_strength(password)
    validate_password_confirmation(password, confirm)

    return True


def parse_register_role(role_value):
    role = REGISTERABLE_ROLES.get(str(role_value or "").strip())

    if not role:
        raise ValidationError("Vai trò không hợp lệ!")

    return role


def register_service(full_name, phone, username, email, password, confirm, role):
    validate_required_fields(
        full_name=full_name,
        phone=phone,
        username=username,
        email=email,
        password=password,
        confirm=confirm,
        role=role,
    )

    employee_role = parse_register_role(role)
    clean_full_name = validate_full_name(full_name)
    clean_phone = check_constraint_of_phone(phone)
    clean_username = check_constraint_of_username(username)
    clean_email = check_constraint_of_email(email)
    check_constraint_of_password(password, confirm)

    return dao.add_employee(
        full_name=clean_full_name,
        phone=clean_phone,
        username=clean_username,
        email=clean_email,
        password=password,
        role=employee_role,
    )


def login_service(username, password):
    validate_required_fields(username=username, password=password)

    employee = dao.auth_employee(username=username, password=password)

    if not employee:
        raise ValidationError("Sai tên đăng nhập hoặc mật khẩu!")

    if employee.is_locked:
        raise ValidationError("Tài khoản của bạn đã bị đình chỉ.")

    if not employee.is_approved:
        raise ValidationError("Tài khoản phải được duyệt bởi quản lý.")

    return employee
