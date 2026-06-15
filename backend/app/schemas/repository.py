from pydantic import BaseModel


class RepositoryCreateRequest(BaseModel):
    name: str
    path: str


class RepositoryResponse(BaseModel):
    id: str
    name: str
    path: str
    status: str