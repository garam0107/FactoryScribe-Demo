from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.database import get_session
from app.schemas.common import success_response
from app.services.inventory_service import (
    get_inventory_dashboard,
    list_shortage_quotation_documents,
    list_inventory_items,
    sync_inventory_items,
)

router = APIRouter()


@router.post(
    "/repositories/{repository_id}/sync",
    summary="재고 XLSX 데이터 적재",
    description=(
        "저장소의 재고 엑셀 시트를 읽어 구조화된 재고 데이터를 적재합니다. "
        "기존 재고 데이터는 저장소 기준으로 교체되며, 재고 대시보드/목록 조회 전에 실행합니다."
    ),
)
def sync_inventory(repository_id: str, session: Session = Depends(get_session)):
    try:
        data = sync_inventory_items(session, repository_id)
        return success_response(
            data=data,
            message="재고현황 데이터를 적재했습니다.",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/repositories/{repository_id}/dashboard",
    summary="재고 대시보드 지표 조회",
    description=(
        "전체 품목 수, 현재 재고 합계, 목표 재고 합계, 재고 잔여율, "
        "평균 가격 상승률, 부족 재고 수 등 재고 대시보드 지표를 조회합니다."
    ),
)
def inventory_dashboard(repository_id: str, session: Session = Depends(get_session)):
    try:
        data = get_inventory_dashboard(session, repository_id)
        return success_response(
            data=data,
            message="재고 대시보드 지표를 조회했습니다.",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/repositories/{repository_id}/items",
    summary="재고 품목 목록 조회",
    description=(
        "재고 적재 API로 저장된 구조화 재고 품목 목록을 조회합니다. "
        "shortage_only=true로 요청하면 현재 재고가 목표 재고보다 부족한 품목만 반환합니다."
    ),
)
def get_inventory_items(
    repository_id: str,
    shortage_only: bool = False,
    session: Session = Depends(get_session),
):
    try:
        items = list_inventory_items(
            session=session,
            repository_id=repository_id,
            shortage_only=shortage_only,
        )
        return success_response(
            data=items,
            message="재고 목록을 조회했습니다.",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/repositories/{repository_id}/shortage-quotations",
    summary="부족 재고 연관 견적서 목록 조회",
    description=(
        "현재 재고가 목표 재고보다 부족한 품목과 견적서 품목을 매칭하여, "
        "부족 재고가 포함된 견적서 목록과 각 견적서 안의 부족 품목 하위 목록을 함께 반환합니다."
    ),
)
def get_shortage_quotations(
    repository_id: str,
    session: Session = Depends(get_session),
):
    try:
        data = list_shortage_quotation_documents(session, repository_id)
        return success_response(
            data=data,
            message="부족 재고 연관 견적서 목록을 조회했습니다.",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
