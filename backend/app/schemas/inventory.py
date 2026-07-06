from pydantic import BaseModel
from datetime import date, datetime


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
    previous_year_usage_quantity: float | None = None
    current_remaining_quantity: float | None = None
    current_year_expected_quantity: float | None = None
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


class ShortageQuotationItemResponse(BaseModel):
    quotation_item_id: str
    inventory_item_id: str
    item_code: str
    item_name: str
    required_quantity: float
    unit_price: float | None = None
    current_stock: float
    target_stock: float | None = None
    shortage_quantity: float


class ShortageQuotationDocumentResponse(BaseModel):
    quotation_document_id: str
    quotation_no: str
    quotation_date: date | None = None
    recipient_company_name: str | None = None
    project_name: str | None = None
    delivery_terms: str | None = None
    source_filename: str | None = None
    shortage_item_count: int
    shortage_items: list[ShortageQuotationItemResponse]
