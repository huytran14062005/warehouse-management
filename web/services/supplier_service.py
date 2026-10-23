def serialize_supplier(supplier):
    return {
        "id": supplier.id,
        "name": supplier.name,
        "address": supplier.address,
    }
