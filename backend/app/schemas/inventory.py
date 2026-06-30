from pydantic import BaseModel


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
