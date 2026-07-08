import httpx
from app.config import settings


def chat_with_ollama(messages: list[dict], timeout: int = 600) -> str:
    url = f"{settings.ollama_base_url}/api/chat"

    payload = {
        "model": settings.ollama_chat_model,
        "messages": messages,
        "stream": False,
    }

    response = httpx.post(url, json=payload, timeout=timeout)
    response.raise_for_status()

    data = response.json()
    return data["message"]["content"]
