import math
from flask import current_app


def parse_page(value, default=1):
    if value is None:
        return default
    try:
        page = int(value)
        return page if page > 0 else default
    except (ValueError, TypeError):
        return default


def parse_per_page(value, default):
    if value is None:
        return default
    try:
        per_page = int(value)
        return min(per_page, current_app.config.get("MAX_PAGE_SIZE", 100)) if per_page > 0 else default
    except (ValueError, TypeError):
        return default


def parse_paging_args(page_value, per_page_value):
    default_size = current_app.config.get("APPLICATION_SIZE", 10)
    return parse_page(page_value), parse_per_page(per_page_value, default_size)


def apply_pagination(query, page, page_size=None):
    total = query.order_by(None).count()
    if not page or page < 1:
        page = 1
    if page_size is None:
        page_size = current_app.config.get("APPLICATION_SIZE", 10)
    start = (page - 1) * page_size
    return query.slice(start, start + page_size), total


def build_pagination(page, per_page, total):
    return {
        "page": page,
        "per_page": per_page,
        "total": total,
        "total_pages": math.ceil(total / per_page) if per_page > 0 else 0,
    }
