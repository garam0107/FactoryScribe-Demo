from openpyxl import load_workbook
import os


def _cell_to_text(value) -> str:
    if value is None:
        return ""

    return str(value).strip()


def _is_empty_row(row: tuple) -> bool:
    return not any(_cell_to_text(v) for v in row)


def _detect_header_row(rows: list[tuple]) -> int:
    header_keywords = {
        "제품명", "품명", "품번", "제품코드", "부품코드",
        "현재고", "재고", "수량", "안전재고", "창고",
        "단가", "거래처", "공급사", "자재명", "규격",
        "구분", "항목", "단위", "금액"
    }

    for idx, row in enumerate(rows):
        values = [_cell_to_text(v) for v in row]
        hit_count = sum(1 for v in values if v in header_keywords)

        if hit_count >= 2:
            return idx

    for idx, row in enumerate(rows):
        if not _is_empty_row(row):
            return idx

    return 0


def parse_xlsx(path: str) -> list[dict]:
    wb = load_workbook(path, data_only=True)
    results = []
    filename = os.path.basename(path)

    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))

        if not rows:
            continue

        header_idx = _detect_header_row(rows)
        headers = [_cell_to_text(v) for v in rows[header_idx]]

        for row_idx, row in enumerate(rows[header_idx + 1:], start=header_idx + 2):
            if _is_empty_row(row):
                continue

            values = [_cell_to_text(v) for v in row]

            pairs = []

            for col_idx, value in enumerate(values):
                if not value:
                    continue

                header = headers[col_idx] if col_idx < len(headers) else ""

                if header:
                    pairs.append(f"{header}={value}")
                else:
                    pairs.append(value)

            if not pairs:
                continue

            raw_row_text = " | ".join(v for v in values if v)
            structured_text = ", ".join(pairs)

            text = (
                f"파일명={filename}, "
                f"시트={ws.title}, "
                f"행={row_idx}, "
                f"{structured_text}. "
                f"원본행={raw_row_text}"
            )

            results.append({
                "text": text,
                "source": {
                    "source_type": "xlsx",
                    "page_number": None,
                    "sheet_name": ws.title,
                    "row_start": row_idx,
                    "row_end": row_idx,
                }
            })

    return results