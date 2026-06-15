from pydantic import BaseModel


class ChatRequest(BaseModel):
    repository_id: str
    conversation_id: str | None = None
    message: str


class ChatResponse(BaseModel):
    conversation_id: str
    answer: str
    sources: list[dict]