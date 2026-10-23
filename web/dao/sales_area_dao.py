from web.models import SalesArea


def get_active_sales_areas():
    return SalesArea.query.filter_by(is_active=True).order_by(SalesArea.name.asc()).all()


def get_sales_area_by_id(area_id):
    return SalesArea.query.filter_by(id=area_id, is_active=True).first()


def get_sales_area_by_name(name):
    return SalesArea.query.filter(SalesArea.name == name).first()
