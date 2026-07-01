from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.database import get_session
from app.schemas.common import success_response
from app.services.inventory_service import (
    get_inventory_dashboard,
    list_inventory_items,
    sync_inventory_items,
)

router = APIRouter()


@router.post("/repositories/{repository_id}/sync")
def sync_inventory(repository_id: str, session: Session = Depends(get_session)):
    try:
        data = sync_inventory_items(session, repository_id)
        return success_response(
            data=data,
            message="재고현황 데이터를 적재했습니다.",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/repositories/{repository_id}/dashboard")
def inventory_dashboard(repository_id: str, session: Session = Depends(get_session)):
    try:
        data = get_inventory_dashboard(session, repository_id)
        return success_response(
            data=data,
            message="재고 대시보드 지표를 조회했습니다.",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/repositories/{repository_id}/items")
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
