import fitz


def parse_pdf(path: str) -> list[dict]:
    doc = fitz.open(path)
    results = []

    for page_index, page in enumerate(doc):
        text = page.get_text("text").strip()

        if not text:
            continue

        results.append({
            "text": text,
            "source": {
                "source_type": "pdf",
                "page_number": page_index + 1,
                "sheet_name": None,
                "row_start": None,
                "row_end": None,
            }
        })

    return results