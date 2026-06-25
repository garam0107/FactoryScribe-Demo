import pyarrow as pa
import lancedb
from app.config import settings
TABLE_NAME = "factory_doc_chunks"
'''
주의: vector 차원은 embedding 모델마다 다릅니다. 
embeddinggemma의 실제 반환 차원을 먼저 확인하고, 
위 [0.0] * 768 부분을 맞춰야 합니다. 초기에는 첫 embedding 결과 길이를 설정값으로 저장하거나, 
테이블을 첫 실제 데이터로 생성하는 방식이 더 안전합니다.
'''
VECTOR_DIM = settings.embedding_vector_dim


def _sql_string(value: str) -> str:
    return value.replace("'", "''")


def get_lancedb():
    return lancedb.connect(settings.lancedb_path)


def _table_exists(db) -> bool:
    return TABLE_NAME in db.table_names()


def get_or_create_table(vector_dim: int | None = None):
    db = get_lancedb()

    if _table_exists(db):
        return db.open_table(TABLE_NAME)

    dim = vector_dim or VECTOR_DIM
    schema = pa.schema([
        pa.field("id", pa.string()),
        pa.field("repository_id", pa.string()),
        pa.field("document_id", pa.string()),
        pa.field("text", pa.string()),
        pa.field("filename", pa.string()),
        pa.field("file_ext", pa.string()),
        pa.field("source_type", pa.string()),
        pa.field("page_number", pa.int64()),
        pa.field("sheet_name", pa.string()),
        pa.field("row_start", pa.int64()),
        pa.field("row_end", pa.int64()),
        pa.field("vector", pa.list_(pa.float32(), dim)),
    ])

    return db.create_table(TABLE_NAME, schema=schema)


def add_vector_chunks(records: list[dict]):
    if not records:
        return

    vector_dim = len(records[0]["vector"])

    for record in records:
        if len(record["vector"]) != vector_dim:
            raise ValueError("all vectors in a batch must have the same dimension")

    table = get_or_create_table(vector_dim=vector_dim)
    table.add(records)


def add_vector_chunk(record: dict):
    add_vector_chunks([record])


def delete_document_vectors(document_id: str):
    db = get_lancedb()

    if not _table_exists(db):
        return

    table = db.open_table(TABLE_NAME)
    table.delete(f"document_id = '{_sql_string(document_id)}'")


def search_vector(query_vector: list[float], repository_id: str, limit: int = 5):
    db = get_lancedb()

    if not _table_exists(db):
        return []

    table = db.open_table(TABLE_NAME)
    return (
        table.search(query_vector, vector_column_name="vector")
        .where(f"repository_id = '{_sql_string(repository_id)}'")
        .limit(limit)
        .to_list()
    )
