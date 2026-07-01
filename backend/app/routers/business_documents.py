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


@router.post("/repositories/{repository_id}/sync")
def sync_documents(repository_id: str, session: Session = Depends(get_session)):
    try:
        data = sync_business_documents(session, repository_id)
        return success_response(
            data=data,
            message="business documents synced successfully",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/repositories/{repository_id}/quotations")
def get_quotations(repository_id: str, session: Session = Depends(get_session)):
    try:
        data = list_quotation_documents(session, repository_id)
        return success_response(
            data=data,
            message="quotation documents loaded successfully",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/repositories/{repository_id}/quotations/{quotation_document_id}")
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


@router.get("/repositories/{repository_id}/purchase-orders")
def get_purchase_orders(repository_id: str, session: Session = Depends(get_session)):
    try:
        data = list_purchase_order_documents(session, repository_id)
        return success_response(
            data=data,
            message="purchase order documents loaded successfully",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/repositories/{repository_id}/purchase-orders/{purchase_order_document_id}")
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
