import os
from sqlmodel import Session, select, func
from app.models.document import Document
from app.models.chunk import DocumentChunk
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


def list_repository_documents(session: Session, repository_id: str) -> list[dict]:
    repo = session.get(DocumentRepository, repository_id)
    if not repo:
        raise ValueError("repository not found")

    statement = (
        select(
            Document.filename,
            Document.file_ext,
            Document.indexed_status,
            Document.error_message,
            func.count(DocumentChunk.id).label("chunk_count"),
        )
        .select_from(Document)
        .where(Document.repository_id == repository_id)
        .join(DocumentChunk, DocumentChunk.document_id == Document.id, isouter=True)
        .group_by(
            Document.id,
            Document.filename,
            Document.file_ext,
            Document.indexed_status,
            Document.error_message,
            Document.created_at,
        )
        .order_by(Document.created_at.desc())
    )

    rows = session.exec(statement).all()

    return [
        {
            "filename": row.filename,
            "file_ext": row.file_ext,
            "indexed_status": row.indexed_status,
            "error_message": row.error_message,
            "chunk_count": row.chunk_count,
        }
        for row in rows
    ]
