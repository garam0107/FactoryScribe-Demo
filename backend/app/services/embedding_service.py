import httpx
from app.config import settings


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    url = f"{settings.ollama_base_url}/api/embed"

    payload = {
        "model": settings.ollama_embed_model,
        "input": texts,
        "keep_alive": settings.ollama_embed_keep_alive,
    }

    response = httpx.post(url, json=payload, timeout=300)
    response.raise_for_status()

    data = response.json()

    embeddings = data.get("embeddings")
    if not embeddings:
        raise ValueError("Ollama returned no embeddings")

    if len(embeddings) != len(texts):
        raise ValueError(
            f"Ollama returned {len(embeddings)} embeddings for {len(texts)} texts"
        )

    return embeddings


def embed_text(text: str) -> list[float]:
    return embed_texts([text])[0]
