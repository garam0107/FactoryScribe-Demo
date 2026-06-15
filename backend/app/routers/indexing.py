from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.schemas.common import success_response
from app.database import get_session
from app.models.repository import DocumentRepository
from app.models.document import Document
from app.services.file_scan_service import scan_files
from app.utils.ids import new_id
from app.utils.time import now_utc
from app.utils.hashing import file_sha256
from app.models.chunk import DocumentChunk
from app.services.parser_service import parse_document
from app.services.chunk_service import build_chunks
from app.services.embedding_service import embed_text
from app.services.vector_service import add_vector_chunk
router = APIRouter()


@router.post("/repositories/{repository_id}/scan")
def scan_repository(repository_id: str, session: Session = Depends(get_session)):
    repo = session.get(DocumentRepository, repository_id)

    if not repo:
        raise HTTPException(status_code=404, detail="repository not found")

    files = scan_files(repo.path)
    now = now_utc()

    created = 0
    skipped = 0

    for f in files:
        file_hash = file_sha256(f["file_path"])

        existing = session.exec(
            select(Document).where(Document.file_hash == file_hash)
        ).first()

        if existing:
            skipped += 1
            continue

        doc = Document(
            id=new_id("doc"),
            repository_id=repo.id,
            filename=f["filename"],
            file_path=f["file_path"],
            file_ext=f["file_ext"],
            file_size=f["file_size"],
            file_hash=file_hash,
            indexed_status="pending",
            created_at=now,
            updated_at=now,
        )

        session.add(doc)
        created += 1

    session.commit()

    return success_response({
        "repository_id": repository_id,
        "found": len(files),
        "created": created,
        "skipped": skipped,
    }, message="문서 스캔이 완료되었습니다.")
@router.post("/repositories/{repository_id}/index")
def index_repository(repository_id: str, session: Session = Depends(get_session)):
    repo = session.get(DocumentRepository, repository_id)

    if not repo:
        raise HTTPException(status_code=404, detail="repository not found")

    docs = session.exec(
        select(Document).where(
            Document.repository_id == repository_id,
            Document.indexed_status == "pending",
        )
    ).all()

    indexed = 0
    failed = 0

    for doc in docs:
        try:
            parsed = parse_document(doc.file_path, doc.file_ext)
            chunks = build_chunks(parsed)

            for idx, chunk in enumerate(chunks):
                chunk_id = new_id("chunk")
                vector = embed_text(chunk["text"])

                source = chunk["source"]

                lance_record = {
                    "id": chunk_id,
                    "repository_id": repository_id,
                    "document_id": doc.id,
                    "text": chunk["text"],
                    "filename": doc.filename,
                    "file_ext": doc.file_ext,
                    "source_type": source.get("source_type"),
                    "page_number": source.get("page_number"),
                    "sheet_name": source.get("sheet_name"),
                    "row_start": source.get("row_start"),
                    "row_end": source.get("row_end"),
                    "vector": vector,
                }

                add_vector_chunk(lance_record)

                meta = DocumentChunk(
                    id=chunk_id,
                    document_id=doc.id,
                    chunk_index=idx,
                    content_preview=chunk["text"][:300],
                    source_type=source.get("source_type"),
                    page_number=source.get("page_number"),
                    sheet_name=source.get("sheet_name"),
                    row_start=source.get("row_start"),
                    row_end=source.get("row_end"),
                    lancedb_id=chunk_id,
                    created_at=now_utc(),
                )
                session.add(meta)

            doc.indexed_status = "indexed"
            doc.updated_at = now_utc()
            indexed += 1

        except Exception as e:
            doc.indexed_status = "failed"
            doc.error_message = str(e)
            doc.updated_at = now_utc()
            failed += 1

    repo.last_indexed_at = now_utc()
    repo.updated_at = now_utc()

    session.commit()

    return success_response({
        "repository_id": repository_id,
        "indexed": indexed,
        "failed": failed,
    }, message= "인덱싱이 완료되었습니다")