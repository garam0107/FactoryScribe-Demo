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


class ConversationSummary(BaseModel):
    id: str
    repository_id: str | None = None
    title: str
    created_at: str
    updated_at: str


class ConversationMessageItem(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    created_at: str
