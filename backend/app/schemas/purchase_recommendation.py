from pydantic import BaseModel


class RequiredOrderItemResponse(BaseModel):
    quotation_item_id: str
    quotation_document_id: str
    quotation_no: str
    item_code: str
    item_name: str
    customer_name: str | None = None
    unit_price: float | None = None
    delivery_deadline: str | None = None
