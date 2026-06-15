from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.database import get_session
from app.schemas.quotation import QuotationCreateRequest
from app.services.quotation_service import create_and_generate_quotation

router = APIRouter()


@router.post("/generate-xlsx")
def generate_xlsx(req: QuotationCreateRequest, session: Session = Depends(get_session)):
    return create_and_generate_quotation(session, req)