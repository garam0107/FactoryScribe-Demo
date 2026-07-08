from dataclasses import dataclass, field
from datetime import date, datetime


@dataclass
class HandlerResult:
    answer: str
    sources: list[dict] = field(default_factory=list)
    action: dict | None = None


def format_number(value: float | int | None) -> str:
    if value is None:
        return "-"

    if float(value).is_integer():
        return f"{int(value):,}"

    return f"{value:,.3f}".rstrip("0").rstrip(".")


def format_date(value: date | datetime | None) -> str:
    if value is None:
        return "-"

    if isinstance(value, datetime):
        return value.date().isoformat()

    return value.isoformat()


def row_citation(filename: str | None, sheet_name: str | None, row: int | None) -> str:
    parts = [filename or "알 수 없는 파일"]
    if sheet_name:
        parts.append(sheet_name)
    if row:
        parts.append(f"Row {row}")
    return " / ".join(parts)


def source_dict(
    *,
    source_type: str,
    citation: str,
    text: str,
    filename: str | None = None,
    row: int | None = None,
    document_id: str | None = None,
) -> dict:
    return {
        "document_id": document_id,
        "chunk_id": None,
        "filename": filename,
        "citation": citation,
        "score": None,
        "source_type": source_type,
        "row": row,
        "text": text,
    }
