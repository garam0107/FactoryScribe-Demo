from pydantic import BaseModel


class ChatRequest(BaseModel):
    repository_id: str
    conversation_id: str | None = None
    message: str

class SearchTestRequest(BaseModel):
    repository_id: str
    query: str
    limit: int = 5

class ChatResponse(BaseModel):
    conversation_id: str
    answer: str
    sources: list[dict]