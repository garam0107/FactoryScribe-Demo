from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.database import get_session
from app.schemas.common import success_response
from app.services.business_document_service import (
    get_purchase_order_document,
    get_quotation_document,
    list_purchase_order_documents,
    list_quotation_documents,
    sync_business_documents,
)

router = APIRouter()


@router.post(
    "/repositories/{repository_id}/sync",
    summary="견적서/발주서 XLSX 데이터 적재",
    description=(
        "저장소의 견적서와 발주서 엑셀 파일을 읽어 문서 헤더와 품목 라인을 추출합니다. "
        "기존 견적서/발주서 구조화 데이터는 저장소 기준으로 교체됩니다."
    ),
)
def sync_documents(repository_id: str, session: Session = Depends(get_session)):
    try:
        data = sync_business_documents(session, repository_id)
        return success_response(
            data=data,
            message="business documents synced successfully",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/repositories/{repository_id}/quotations",
    summary="견적서 목록 조회",
    description=(
        "적재된 견적서 문서와 품목 라인을 조회합니다. "
        "견적서 소요 수량과 현재 재고를 비교할 때 사용하는 데이터입니다."
    ),
)
def get_quotations(repository_id: str, session: Session = Depends(get_session)):
    try:
        data = list_quotation_documents(session, repository_id)
        return success_response(
            data=data,
            message="quotation documents loaded successfully",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/repositories/{repository_id}/quotations/{quotation_document_id}",
    summary="견적서 상세 조회",
    description="적재된 견적서 1건과 해당 견적서의 모든 품목 라인을 조회합니다.",
)
def get_quotation(
    repository_id: str,
    quotation_document_id: str,
    session: Session = Depends(get_session),
):
    try:
        data = get_quotation_document(session, repository_id, quotation_document_id)
        return success_response(
            data=data,
            message="quotation document loaded successfully",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/repositories/{repository_id}/purchase-orders",
    summary="발주서 목록 조회",
    description=(
        "적재된 발주서 문서와 품목 라인을 조회합니다. "
        "이미 발주된 수량과 추가 발주 필요 수량을 계산할 때 사용하는 데이터입니다."
    ),
)
def get_purchase_orders(repository_id: str, session: Session = Depends(get_session)):
    try:
        data = list_purchase_order_documents(session, repository_id)
        return success_response(
            data=data,
            message="purchase order documents loaded successfully",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/repositories/{repository_id}/purchase-orders/{purchase_order_document_id}",
    summary="발주서 상세 조회",
    description="적재된 발주서 1건과 해당 발주서의 모든 품목 라인을 조회합니다.",
)
def get_purchase_order(
    repository_id: str,
    purchase_order_document_id: str,
    session: Session = Depends(get_session),
):
    try:
        data = get_purchase_order_document(
            session,
            repository_id,
            purchase_order_document_id,
        )
        return success_response(
            data=data,
            message="purchase order document loaded successfully",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
