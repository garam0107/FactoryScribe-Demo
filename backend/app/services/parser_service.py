from app.parsers.pdf_parser import parse_pdf
from app.parsers.docx_parser import parse_docx
from app.parsers.xlsx_parser import parse_xlsx
from app.parsers.hwpx_parser import parse_hwpx


def parse_document(file_path: str, file_ext: str) -> list[dict]:
    if file_ext == "pdf":
        return parse_pdf(file_path)

    if file_ext == "docx":
        return parse_docx(file_path)

    if file_ext == "xlsx":
        return parse_xlsx(file_path)

    if file_ext == "hwpx":
        return parse_hwpx(file_path)

    raise ValueError(f"unsupported file extension: {file_ext}")