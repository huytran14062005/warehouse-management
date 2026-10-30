from datetime import datetime

from sqlalchemy.orm import joinedload, selectinload

from web import app, db
from web.models import DamageReport, DamageReportItem, DamageReportStatus


def get_damage_reports(page=1, per_page=None, status=None, warehouse_id=None, reporter_id=None):
    query = DamageReport.query.options(
        selectinload(DamageReport.items).selectinload(DamageReportItem.product),
        joinedload(DamageReport.warehouse),
        joinedload(DamageReport.reported_by_employee),
        joinedload(DamageReport.reviewed_by_employee),
    )

    if status is not None:
        query = query.filter(DamageReport.status == status)
    if warehouse_id is not None:
        query = query.filter(DamageReport.warehouse_id == warehouse_id)
    if reporter_id is not None:
        query = query.filter(DamageReport.reported_by_employee_id == reporter_id)

    query = query.order_by(DamageReport.reported_at.desc(), DamageReport.id.desc())
    total = query.order_by(None).count()

    page = max(page or 1, 1)
    per_page = per_page or app.config.get("APPLICATION_SIZE", 10)
    reports = query.offset((page - 1) * per_page).limit(per_page).all()
    return reports, total


def get_damage_report_by_id(report_id):
    return (
        DamageReport.query.options(
            selectinload(DamageReport.items).selectinload(DamageReportItem.product),
            joinedload(DamageReport.warehouse),
            joinedload(DamageReport.reported_by_employee),
            joinedload(DamageReport.reviewed_by_employee),
        )
        .filter(DamageReport.id == report_id)
        .first()
    )


def create_damage_report(warehouse_id, reported_by_employee_id, note, items):
    try:
        report = DamageReport(
            warehouse_id=warehouse_id,
            reported_by_employee_id=reported_by_employee_id,
            note=note,
            status=DamageReportStatus.PENDING,
        )
        db.session.add(report)
        db.session.flush()

        db.session.add_all(
            [
                DamageReportItem(
                    damage_report_id=report.id,
                    product_id=item["product_id"],
                    quantity=item["quantity"],
                )
                for item in items
            ]
        )
        db.session.commit()
        return get_damage_report_by_id(report.id)
    except Exception:
        db.session.rollback()
        raise


def review_damage_report(report, manager_id, status, review_note):
    try:
        report.status = status
        report.reviewed_by_employee_id = manager_id
        report.reviewed_at = datetime.now()
        report.review_note = review_note
        db.session.commit()
        return get_damage_report_by_id(report.id)
    except Exception:
        db.session.rollback()
        raise
