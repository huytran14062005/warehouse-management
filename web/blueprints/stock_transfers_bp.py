from flask import Blueprint, jsonify, request

from web.blueprints.api_errors import handle_api_errors
from web.middleware.auth_middleware import verify_role, verify_token
from web.models import EmployeeRole, StockTransfer
from web.services.authorization import (
    ensure_warehouse_access,
    get_accessible_warehouses,
    get_central_warehouse,
    scoped_warehouse_id,
)
from web.services.exceptions import NotFoundError
from web.services.stock_transfer_service import (
    create_stock_transfer_service,
    get_stock_transfer_detail_service,
    get_stock_transfers_list_service,
    get_sales_employees_service,
    serialize_employee_stock,
    serialize_stock_transfer,
    serialize_stock_transfer_summary,
)
from web.utils.pagination import build_pagination


stock_transfers_bp = Blueprint("stock_transfers", __name__)


@stock_transfers_bp.route("/api/sales-employees", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.THU_KHO, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_sales_employees():
    warehouses = get_accessible_warehouses(request.employee_id)
    central = get_central_warehouse()
    default_warehouse = next(
        (warehouse for warehouse in warehouses if warehouse.id == central.id),
        warehouses[0] if warehouses else central,
    )
    return jsonify({
        "employees": get_sales_employees_service(),
        "warehouse": {
            "id": default_warehouse.id,
            "name": default_warehouse.name,
            "address": default_warehouse.address,
        },
        "warehouses": [
            {"id": warehouse.id, "name": warehouse.name, "address": warehouse.address}
            for warehouse in warehouses
        ],
    }), 200


@stock_transfers_bp.route("/api/warehouses", methods=["GET"])
@verify_token
@verify_role(
    EmployeeRole.NHAN_VIEN_BAN_HANG,
    EmployeeRole.THU_KHO,
    EmployeeRole.KE_TOAN,
    EmployeeRole.QUAN_LY,
)
@handle_api_errors
def get_warehouses():
    warehouses = get_accessible_warehouses(request.employee_id)
    central = get_central_warehouse()
    default_warehouse = next(
        (warehouse for warehouse in warehouses if warehouse.id == central.id),
        warehouses[0] if warehouses else central,
    )
    return jsonify({
        "warehouses": [
            {"id": warehouse.id, "name": warehouse.name, "address": warehouse.address}
            for warehouse in warehouses
        ],
        "default_warehouse_id": default_warehouse.id,
    }), 200


@stock_transfers_bp.route("/api/employee-stock/me", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_my_employee_stock():
    return jsonify(serialize_employee_stock(
        request.employee_id,
        page_value=request.args.get("page"),
        per_page_value=request.args.get("per_page"),
    )), 200


@stock_transfers_bp.route("/api/employee-stock/<int:employee_id>", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.THU_KHO, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_employee_stock(employee_id):
    return jsonify(serialize_employee_stock(
        employee_id,
        page_value=request.args.get("page"),
        per_page_value=request.args.get("per_page"),
    )), 200


@stock_transfers_bp.route("/api/stock-transfers", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.THU_KHO, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_stock_transfers_list():
    transfers, total, page, per_page = get_stock_transfers_list_service(
        page_value=request.args.get("page"),
        per_page_value=request.args.get("per_page"),
        warehouse_id=scoped_warehouse_id(request.employee_id, request.args.get("warehouse_id")),
    )
    return jsonify({
        "transfers": [
            serialize_stock_transfer_summary(transfer, items_count, total_quantity)
            for transfer, items_count, total_quantity in transfers
        ],
        "pagination": build_pagination(page, per_page, total),
    }), 200


@stock_transfers_bp.route("/api/stock-transfers/<int:transfer_id>", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.THU_KHO, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_stock_transfer_detail(transfer_id):
    transfer = StockTransfer.query.get(transfer_id)
    if not transfer:
        raise NotFoundError("Phiếu điều chuyển không tồn tại")
    ensure_warehouse_access(request.employee_id, transfer.warehouse_id)
    transfer, items, total, all_items_count, total_quantity, remaining_by_item, page, per_page = get_stock_transfer_detail_service(
        transfer_id,
        page_value=request.args.get("page"),
        per_page_value=request.args.get("per_page"),
        keyword=request.args.get("keyword"),
    )
    return jsonify({
        "transfer": serialize_stock_transfer(
            transfer,
            items=items,
            items_count=all_items_count,
            total_quantity=total_quantity,
            remaining_by_item=remaining_by_item,
        ),
        "pagination": build_pagination(page, per_page, total),
        "total_items_count": all_items_count,
    }), 200


@stock_transfers_bp.route("/api/stock-transfers", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.THU_KHO, EmployeeRole.QUAN_LY)
@handle_api_errors
def create_stock_transfer():
    data = request.get_json(silent=True) or {}
    transfer = create_stock_transfer_service(
        created_by_employee_id=request.employee_id,
        employee_id=data.get("employee_id"),
        warehouse_id=data.get("warehouse_id"),
        items=data.get("items"),
        note=data.get("note", ""),
    )
    return jsonify({
        "message": "Đã cấp hàng cho nhân viên bán hàng",
        "transfer": {
            "id": transfer.id,
            "employee_id": transfer.employee_id,
            "warehouse_id": transfer.warehouse_id,
            "transferred_at": transfer.transferred_at.isoformat(),
        },
    }), 201
