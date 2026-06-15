from app.config import settings


def split_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    text = text.strip()

    if not text:
        return []

    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start = end - overlap

        if start < 0:
            start = 0

    return chunks


def build_chunks(parsed_blocks: list[dict]) -> list[dict]:
    chunks = []

    for block in parsed_blocks:
        text = block["text"]
        source = block["source"]

        if source["source_type"] == "xlsx":
            chunks.append({
                "text": text,
                "source": source,
            })
            continue

        pieces = split_text(
            text=text,
            chunk_size=settings.chunk_size,
            overlap=settings.chunk_overlap,
        )

        for piece in pieces:
            chunks.append({
                "text": piece,
                "source": source,
            })

    return chunks