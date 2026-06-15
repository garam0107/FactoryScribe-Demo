import os
from sqlmodel import Session, select

from app.models.repository import DocumentRepository
from app.schemas.repository import RepositoryCreateRequest
from app.utils.ids import new_id
from app.utils.time import now_utc


def create_repository(session: Session, req: RepositoryCreateRequest) -> DocumentRepository:
    if not os.path.isdir(req.path):
        raise ValueError("path is not a valid directory")
        # 같은 path가 이미 있으면 막기
    existing = session.exec(select(DocumentRepository).where(DocumentRepository.path == req.path)).first()
    if existing:
        raise ValueError("이미 등록된 경로입니다.")
    now = now_utc()
    repo = DocumentRepository(
        id=new_id("repo"),
        name=req.name,
        path=req.path,
        status="active",
        created_at=now,
        updated_at=now,
    )

    session.add(repo)
    session.commit()
    session.refresh(repo)
    return repo


def list_repositories(session: Session) -> list[DocumentRepository]:
    return session.exec(select(DocumentRepository)).all()