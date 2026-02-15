from sqlalchemy.orm import Session

from .models import Application, AppColumnXref, DbColumn, DbTable, UsageType


def seed(db: Session):
    if db.query(Application).first():
        return  # already seeded

    # Applications
    apps = [
        Application(name="OrderService", description="Handles order creation and fulfillment"),
        Application(name="InventoryManager", description="Tracks stock levels and warehouse data"),
        Application(name="CustomerPortal", description="Customer-facing web application"),
        Application(name="ReportingEngine", description="Generates nightly and ad-hoc reports"),
        Application(name="PaymentGateway", description="Processes payments and refunds"),
    ]
    db.add_all(apps)
    db.flush()

    # Tables & columns
    tables_data = [
        ("public", "customers", "Core customer records", [
            ("customer_id", "integer", "Primary key"),
            ("email", "varchar(255)", "Customer email address"),
            ("full_name", "varchar(255)", "Customer full name"),
            ("created_at", "timestamp", "Account creation date"),
            ("status", "varchar(50)", "Active, inactive, suspended"),
        ]),
        ("public", "orders", "Customer orders", [
            ("order_id", "integer", "Primary key"),
            ("customer_id", "integer", "FK to customers"),
            ("order_date", "timestamp", "When the order was placed"),
            ("total_amount", "numeric(12,2)", "Order total in USD"),
            ("status", "varchar(50)", "pending, shipped, delivered, cancelled"),
        ]),
        ("public", "order_items", "Line items within an order", [
            ("item_id", "integer", "Primary key"),
            ("order_id", "integer", "FK to orders"),
            ("product_id", "integer", "FK to products"),
            ("quantity", "integer", "Number of units"),
            ("unit_price", "numeric(10,2)", "Price per unit at time of order"),
        ]),
        ("public", "products", "Product catalog", [
            ("product_id", "integer", "Primary key"),
            ("sku", "varchar(100)", "Stock keeping unit"),
            ("product_name", "varchar(255)", "Display name"),
            ("category", "varchar(100)", "Product category"),
            ("price", "numeric(10,2)", "Current list price"),
        ]),
        ("inventory", "stock_levels", "Current inventory per warehouse", [
            ("stock_id", "integer", "Primary key"),
            ("product_id", "integer", "FK to products"),
            ("warehouse_id", "integer", "FK to warehouses"),
            ("quantity_on_hand", "integer", "Current stock count"),
            ("last_updated", "timestamp", "Last inventory check"),
        ]),
        ("billing", "payments", "Payment transactions", [
            ("payment_id", "integer", "Primary key"),
            ("order_id", "integer", "FK to orders"),
            ("amount", "numeric(12,2)", "Payment amount"),
            ("payment_method", "varchar(50)", "card, bank_transfer, wallet"),
            ("paid_at", "timestamp", "When payment was processed"),
            ("status", "varchar(50)", "success, failed, refunded"),
        ]),
    ]

    all_columns: dict[str, DbColumn] = {}
    for schema, tname, tdesc, cols in tables_data:
        tbl = DbTable(schema_name=schema, table_name=tname, description=tdesc)
        db.add(tbl)
        db.flush()
        for cname, dtype, cdesc in cols:
            col = DbColumn(table_id=tbl.id, column_name=cname, data_type=dtype, description=cdesc)
            db.add(col)
            db.flush()
            all_columns[f"{tname}.{cname}"] = col

    # Cross-references
    c = all_columns
    xrefs = [
        # OrderService
        (apps[0], c["orders.order_id"], UsageType.READ_WRITE),
        (apps[0], c["orders.customer_id"], UsageType.WRITE),
        (apps[0], c["orders.order_date"], UsageType.WRITE),
        (apps[0], c["orders.total_amount"], UsageType.READ_WRITE),
        (apps[0], c["orders.status"], UsageType.READ_WRITE),
        (apps[0], c["order_items.item_id"], UsageType.READ_WRITE),
        (apps[0], c["order_items.order_id"], UsageType.WRITE),
        (apps[0], c["order_items.quantity"], UsageType.WRITE),
        (apps[0], c["order_items.unit_price"], UsageType.WRITE),
        # InventoryManager
        (apps[1], c["stock_levels.stock_id"], UsageType.READ_WRITE),
        (apps[1], c["stock_levels.product_id"], UsageType.READ),
        (apps[1], c["stock_levels.quantity_on_hand"], UsageType.READ_WRITE),
        (apps[1], c["stock_levels.last_updated"], UsageType.WRITE),
        (apps[1], c["products.product_id"], UsageType.READ),
        (apps[1], c["products.sku"], UsageType.READ),
        # CustomerPortal
        (apps[2], c["customers.customer_id"], UsageType.READ),
        (apps[2], c["customers.email"], UsageType.READ_WRITE),
        (apps[2], c["customers.full_name"], UsageType.READ_WRITE),
        (apps[2], c["customers.status"], UsageType.READ),
        (apps[2], c["orders.order_id"], UsageType.READ),
        (apps[2], c["orders.order_date"], UsageType.READ),
        (apps[2], c["orders.total_amount"], UsageType.READ),
        (apps[2], c["orders.status"], UsageType.READ),
        # ReportingEngine
        (apps[3], c["customers.customer_id"], UsageType.READ),
        (apps[3], c["customers.full_name"], UsageType.READ),
        (apps[3], c["orders.order_id"], UsageType.READ),
        (apps[3], c["orders.total_amount"], UsageType.READ),
        (apps[3], c["payments.payment_id"], UsageType.READ),
        (apps[3], c["payments.amount"], UsageType.READ),
        (apps[3], c["payments.status"], UsageType.READ),
        (apps[3], c["products.product_name"], UsageType.READ),
        (apps[3], c["products.category"], UsageType.READ),
        # PaymentGateway
        (apps[4], c["payments.payment_id"], UsageType.READ_WRITE),
        (apps[4], c["payments.order_id"], UsageType.READ),
        (apps[4], c["payments.amount"], UsageType.READ_WRITE),
        (apps[4], c["payments.payment_method"], UsageType.READ),
        (apps[4], c["payments.paid_at"], UsageType.WRITE),
        (apps[4], c["payments.status"], UsageType.READ_WRITE),
    ]

    for app, col, usage in xrefs:
        db.add(AppColumnXref(application_id=app.id, column_id=col.id, usage_type=usage))

    db.commit()
