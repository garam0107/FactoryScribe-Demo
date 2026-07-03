from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.database import get_session
from app.schemas.common import success_response
from app.services.purchase_recommendation_service import list_required_order_items

router = APIRouter()


@router.get(
    "/repositories/{repository_id}/required-orders",
    summary="필요 발주 품목 조회",
    description=(
        "견적서에는 포함되어 있지만 현재 재고현황에는 없는 품목을 조회합니다. "
        "품목코드 또는 품목명이 재고현황에 존재하면 제외하고, 둘 다 없을 때 필요 발주 품목으로 반환합니다. "
        "응답에는 품목, 거래처, 단가, 납품기한 정보를 포함합니다."
    ),
)
def get_required_orders(
    repository_id: str,
    session: Session = Depends(get_session),
):
    try:
        data = list_required_order_items(session, repository_id)
        return success_response(
            data=data,
            message="필요 발주 품목을 조회했습니다.",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
