from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.database import get_session
from app.schemas.common import success_response
from app.schemas.repository import RepositoryCreateRequest
from app.services.repository_service import (
    create_repository,
    delete_repository,
    list_repositories,
    list_repository_documents,
)

router = APIRouter()


@router.post(
    "",
    summary="문서 저장소 등록",
    description=(
        "로컬 문서 저장소 경로를 등록합니다. "
        "등록된 경로는 문서 스캔, 인덱싱, 재고/견적서/발주 데이터 적재에 사용합니다."
    ),
)
def create_repo(req: RepositoryCreateRequest, session: Session = Depends(get_session)):
    try:
        repo = create_repository(session, req)
        return success_response(
            data=repo,
            message="문서 저장소가 등록되었습니다.",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "",
    summary="문서 저장소 목록 조회",
    description="등록된 모든 문서 저장소의 상태와 메타데이터를 조회합니다.",
)
def get_repos(session: Session = Depends(get_session)):
    repos = list_repositories(session)
    return success_response(
        data=repos,
        message="문서 저장소 목록을 조회했습니다.",
    )


@router.delete(
    "/{repository_id}",
    summary="문서 저장소 삭제",
    description="등록된 문서 저장소와 저장소에 연결된 데이터를 함께 삭제합니다.",
)
def delete_repo(repository_id: str, session: Session = Depends(get_session)):
    try:
        result = delete_repository(session, repository_id)
        return success_response(
            data=result,
            message="문서 저장소를 삭제했습니다.",
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get(
    "/{repository_id}/documents",
    summary="저장소 문서 목록 조회",
    description=(
        "저장소 스캔 API로 발견한 문서 목록을 조회합니다. "
        "파일 정보와 인덱싱 상태를 함께 반환합니다."
    ),
)
def get_repository_documents(repository_id: str, session: Session = Depends(get_session)):
    try:
        documents = list_repository_documents(session, repository_id)
        return success_response(
            data=documents,
            message="문서 목록을 조회했습니다.",
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
