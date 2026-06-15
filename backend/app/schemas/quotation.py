from pydantic import BaseModel


class QuotationItem(BaseModel):
    item_name: str
    part_code: str | None = None
    quantity: int
    unit_price: int
    amount: int


class QuotationCreateRequest(BaseModel):
    conversation_id: str | None = None
    customer_name: str
    project_name: str
    quotation_date: str
    items: list[QuotationItem]
    memo: str | None = None