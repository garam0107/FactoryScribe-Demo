from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.database import get_session
from app.schemas.common import success_response
from app.services.transaction_service import list_transaction_records, sync_transaction_records

router = APIRouter()


@router.post(
    "/repositories/{repository_id}/sync",
    summary="입출고내역 XLSX 데이터 적재",
    description=(
        "등록된 저장소 경로에서 입출고내역 양식의 XLSX 파일을 찾아 행 단위 거래 데이터를 추출합니다. "
        "거래일자, 거래번호, 품목코드, 품목명, 거래유형, 수량, 단가, 금액, 거래처/부서, "
        "프로젝트/발주번호, 창고위치, 담당자와 원본 파일/시트/행 정보를 저장합니다. "
        "기존 입출고내역 구조화 데이터는 저장소 기준으로 교체됩니다."
    ),
)
def sync_transactions(repository_id: str, session: Session = Depends(get_session)):
    try:
        data = sync_transaction_records(session, repository_id)
        return success_response(
            data=data,
            message="입출고내역 데이터를 적재했습니다.",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/repositories/{repository_id}/records",
    summary="입출고내역 목록 조회",
    description=(
        "적재된 입출고내역 거래 행 목록을 조회합니다. "
        "거래처별 거래 이력 질문, 품목별 입출고 확인, 발주번호 기반 확인에 사용하는 구조화 데이터입니다."
    ),
)
def get_transaction_records(repository_id: str, session: Session = Depends(get_session)):
    try:
        records = list_transaction_records(session, repository_id)
        return success_response(
            data=[
                record.model_dump() if hasattr(record, "model_dump") else record.dict()
                for record in records
            ],
            message="입출고내역 목록을 조회했습니다.",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
