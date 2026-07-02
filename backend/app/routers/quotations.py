from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.database import get_session
from app.schemas.quotation import QuotationCreateRequest
from app.services.quotation_service import create_and_generate_quotation

router = APIRouter()


@router.post(
    "/generate-xlsx",
    summary="견적서 XLSX 생성",
    description=(
        "견적서 초안 데이터를 저장하고 설정된 견적서 템플릿을 기반으로 "
        "XLSX 견적서 파일을 생성합니다."
    ),
)
def generate_xlsx(req: QuotationCreateRequest, session: Session = Depends(get_session)):
    return create_and_generate_quotation(session, req)
