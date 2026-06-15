from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.database import get_session
from app.schemas.repository import RepositoryCreateRequest
from app.services.repository_service import create_repository, list_repositories

router = APIRouter()


@router.post("")
def create_repo(req: RepositoryCreateRequest, session: Session = Depends(get_session)):
    try:
        return create_repository(session, req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("")
def get_repos(session: Session = Depends(get_session)):
    return list_repositories(session)