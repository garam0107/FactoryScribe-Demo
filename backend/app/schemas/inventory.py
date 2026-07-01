from pydantic import BaseModel
from datetime import datetime


class InventorySyncResponse(BaseModel):
    repository_id: str
    files: list[str]
    sheets: list[str]
    imported_items: int


class InventoryDashboardResponse(BaseModel):
    repository_id: str
    total_items: int
    total_current_stock: float
    total_target_stock: float
    inventory_remaining_rate: float | None = None
    average_price_increase_rate: float | None = None
    shortage_items: int


class InventoryItemResponse(BaseModel):
    id: str
    repository_id: str
    item_code: str
    item_name: str
    category: str | None = None
    spec: str | None = None
    unit: str | None = None
    supplier: str | None = None
    current_stock: float
    safety_stock: float | None = None
    target_stock: float | None = None
    avg_monthly_usage: float | None = None
    current_unit_price: float | None = None
    previous_unit_price: float | None = None
    price_change_rate: float | None = None
    stock_status: str | None = None
    expected_depletion_days: float | None = None
    warehouse_location: str | None = None
    last_inbound_date: datetime | None = None
    note: str | None = None
    source_filename: str | None = None
    source_sheet_name: str | None = None
    source_row: int | None = None
    created_at: datetime
    updated_at: datetime
    is_shortage: bool
