from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from time import perf_counter
from app.config import settings
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
from app.services.embedding_service import embed_texts
from app.services.vector_service import add_vector_chunks, delete_document_vectors
router = APIRouter()


def _batched(items: list[dict], batch_size: int) -> list[list[dict]]:
    return [items[i:i + batch_size] for i in range(0, len(items), batch_size)]


def _delete_document_chunk_rows(session: Session, document_id: str) -> None:
    rows = session.exec(
        select(DocumentChunk).where(DocumentChunk.document_id == document_id)
    ).all()

    for row in rows:
        session.delete(row)


def _cleanup_document_index(session: Session, document_id: str) -> str | None:
    errors = []

    try:
        delete_document_vectors(document_id)
    except Exception as e:
        errors.append(f"vector cleanup failed: {e}")

    try:
        _delete_document_chunk_rows(session, document_id)
    except Exception as e:
        errors.append(f"chunk cleanup failed: {e}")

    if errors:
        return " | ".join(errors)

    return None


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
            select(Document).where(
                Document.repository_id == repository_id,
                Document.file_hash == file_hash,
            )
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
    started_at = perf_counter()
    repo = session.get(DocumentRepository, repository_id)

    if not repo:
        raise HTTPException(status_code=404, detail="repository not found")

    docs = session.exec(
        select(Document).where(
            Document.repository_id == repository_id,
            Document.indexed_status.in_(["pending", "indexing"]),
        )
    ).all()

    indexed = 0
    empty = 0
    failed = 0
    total_chunks = 0
    total_batches = 0
    batch_size = max(1, settings.indexing_batch_size)

    for doc in docs:
        doc_id = doc.id

        try:
            cleanup_error = _cleanup_document_index(session, doc_id)
            if cleanup_error:
                raise RuntimeError(cleanup_error)

            doc.indexed_status = "indexing"
            doc.error_message = None
            doc.updated_at = now_utc()
            session.commit()

            parsed = parse_document(doc.file_path, doc.file_ext)
            chunks = build_chunks(parsed)

            if not chunks:
                doc.indexed_status = "empty"
                doc.error_message = "no extractable text chunks"
                doc.updated_at = now_utc()
                session.commit()
                empty += 1
                continue

            chunk_index = 0
            doc_chunks = 0
            doc_batches = 0

            for chunk_batch in _batched(chunks, batch_size):
                vectors = embed_texts([chunk["text"] for chunk in chunk_batch])
                lance_records = []
                chunk_rows = []

                for chunk, vector in zip(chunk_batch, vectors):
                    chunk_id = new_id("chunk")
                    source = chunk["source"]

                    lance_records.append({
                        "id": chunk_id,
                        "repository_id": repository_id,
                        "document_id": doc_id,
                        "text": chunk["text"],
                        "filename": doc.filename,
                        "file_ext": doc.file_ext,
                        "source_type": source.get("source_type"),
                        "page_number": source.get("page_number"),
                        "sheet_name": source.get("sheet_name"),
                        "row_start": source.get("row_start"),
                        "row_end": source.get("row_end"),
                        "vector": vector,
                    })

                    chunk_rows.append(DocumentChunk(
                        id=chunk_id,
                        document_id=doc_id,
                        chunk_index=chunk_index,
                        content_preview=chunk["text"][:300],
                        source_type=source.get("source_type"),
                        page_number=source.get("page_number"),
                        sheet_name=source.get("sheet_name"),
                        row_start=source.get("row_start"),
                        row_end=source.get("row_end"),
                        lancedb_id=chunk_id,
                        created_at=now_utc(),
                    ))

                    chunk_index += 1

                add_vector_chunks(lance_records)
                session.add_all(chunk_rows)
                doc_chunks += len(chunk_batch)
                doc_batches += 1

            doc.indexed_status = "indexed"
            doc.error_message = None
            doc.updated_at = now_utc()
            session.commit()
            total_chunks += doc_chunks
            total_batches += doc_batches
            indexed += 1

        except Exception as e:
            session.rollback()
            error_message = str(e)

            cleanup_error = _cleanup_document_index(session, doc_id)
            if cleanup_error:
                error_message = f"{error_message} | {cleanup_error}"

            doc = session.get(Document, doc_id)
            if doc:
                doc.indexed_status = "failed"
                doc.error_message = error_message
                doc.updated_at = now_utc()
                session.commit()

            failed += 1

    repo.last_indexed_at = now_utc()
    repo.updated_at = now_utc()

    session.commit()

    return success_response({
        "repository_id": repository_id,
        "documents": len(docs),
        "indexed": indexed,
        "empty": empty,
        "failed": failed,
        "chunks": total_chunks,
        "embedding_batches": total_batches,
        "batch_size": batch_size,
        "elapsed_seconds": round(perf_counter() - started_at, 3),
    }, message= "인덱싱이 완료되었습니다")
