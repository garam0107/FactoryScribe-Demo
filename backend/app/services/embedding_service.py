import httpx
from app.config import settings


def embed_text(text: str) -> list[float]:
    url = f"{settings.ollama_base_url}/api/embed"

    payload = {
        "model": settings.ollama_embed_model,
        "input": text,
    }

    response = httpx.post(url, json=payload, timeout=120)
    response.raise_for_status()

    data = response.json()

    embeddings = data.get("embeddings")
    if not embeddings:
        raise ValueError("Ollama returned no embeddings")

    return embeddings[0]