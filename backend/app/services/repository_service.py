import os
from sqlmodel import Session, select, func
from app.models.document import Document
from app.models.chunk import DocumentChunk
from app.models.conversation import Conversation
from app.models.message import Message, MessageSource
from app.models.business_document import (
    PurchaseOrderDocument,
    PurchaseOrderItem,
    QuotationDocument,
    QuotationItem,
)
from app.models.inventory_item import InventoryItem
from app.models.repository import DocumentRepository
from app.models.transaction_record import TransactionRecord
from app.schemas.repository import RepositoryCreateRequest
from app.services.vector_service import delete_document_vectors
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


def delete_repository(session: Session, repository_id: str) -> dict:
    repo = session.get(DocumentRepository, repository_id)
    if not repo:
        raise ValueError("repository not found")

    documents = session.exec(
        select(Document).where(Document.repository_id == repository_id)
    ).all()
    document_ids = [document.id for document in documents]

    conversations = session.exec(
        select(Conversation).where(Conversation.repository_id == repository_id)
    ).all()
    conversation_ids = [conversation.id for conversation in conversations]

    if conversation_ids:
        messages = session.exec(
            select(Message).where(Message.conversation_id.in_(conversation_ids))
        ).all()
        message_ids = [message.id for message in messages]
    else:
        messages = []
        message_ids = []

    if message_ids:
        message_sources = session.exec(
            select(MessageSource).where(MessageSource.message_id.in_(message_ids))
        ).all()
        for source in message_sources:
            session.delete(source)

    if document_ids:
        document_sources = session.exec(
            select(MessageSource).where(MessageSource.document_id.in_(document_ids))
        ).all()
        for source in document_sources:
            session.delete(source)

        chunks = session.exec(
            select(DocumentChunk).where(DocumentChunk.document_id.in_(document_ids))
        ).all()
        for chunk in chunks:
            session.delete(chunk)

        for document_id in document_ids:
            delete_document_vectors(document_id)

    for message in messages:
        session.delete(message)

    for conversation in conversations:
        session.delete(conversation)

    for item in session.exec(
        select(InventoryItem).where(InventoryItem.repository_id == repository_id)
    ).all():
        session.delete(item)

    for item in session.exec(
        select(TransactionRecord).where(TransactionRecord.repository_id == repository_id)
    ).all():
        session.delete(item)

    for item in session.exec(
        select(QuotationItem).where(QuotationItem.repository_id == repository_id)
    ).all():
        session.delete(item)

    for item in session.exec(
        select(PurchaseOrderItem).where(PurchaseOrderItem.repository_id == repository_id)
    ).all():
        session.delete(item)

    for item in session.exec(
        select(QuotationDocument).where(QuotationDocument.repository_id == repository_id)
    ).all():
        session.delete(item)

    for item in session.exec(
        select(PurchaseOrderDocument).where(
            PurchaseOrderDocument.repository_id == repository_id
        )
    ).all():
        session.delete(item)

    for document in documents:
        session.delete(document)

    session.delete(repo)
    session.commit()

    return {
        "id": repository_id,
        "deleted": True,
    }


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
