from functools import wraps

from flask import current_app, jsonify
from sqlalchemy.exc import IntegrityError

from web import db
from web.services.exceptions import AppError


def handle_api_errors(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except AppError as ex:
            return jsonify({"error": str(ex)}), ex.status_code
        except ValueError as ex:
            return jsonify({"error": str(ex)}), 400
        except IntegrityError:
            db.session.rollback()
            return jsonify({"error": "Dữ liệu bị trùng hoặc không thể liên kết"}), 409
        except Exception as ex:
            current_app.logger.exception("Unhandled API error")
            return jsonify({"error": "Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau."}), 500

    return decorated
