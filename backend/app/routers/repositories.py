from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.database import get_session
from app.schemas.common import success_response
from app.schemas.repository import RepositoryCreateRequest
from app.services.repository_service import create_repository, list_repositories, list_repository_documents

router = APIRouter()



@router.post("")
def create_repo(req: RepositoryCreateRequest, session: Session = Depends(get_session)):
    try:
        repo = create_repository(session, req)
        return success_response(
            data=repo,
            message="문서 저장소가 등록되었습니다.",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("")
def get_repos(session: Session = Depends(get_session)):
    repos = list_repositories(session)
    return success_response(
        data=repos,
        message="문서 저장소 목록을 조회했습니다.",
    )

@router.get("/{repository_id}/documents")
def get_repository_documents(repository_id: str, session: Session = Depends(get_session)):
    try:
        documents = list_repository_documents(session, repository_id)
        return success_response(
            data=documents,
            message="문서 목록을 조회했습니다.",
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))