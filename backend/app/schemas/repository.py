from pydantic import BaseModel


class RepositoryCreateRequest(BaseModel):
    name: str
    path: str


class RepositoryResponse(BaseModel):
    id: str
    name: str
    path: str
    status: str

class RepositoryDocumentResponse(BaseModel):
    filename: str
    file_ext: str
    indexed_status: str
    chunk_count: int