import os

SUPPORTED_EXTS = {".pdf", ".docx", ".xlsx", ".hwpx"}


def scan_files(root_path: str) -> list[dict]:
    results = []

    for root, _, files in os.walk(root_path):
        for filename in files:
            ext = os.path.splitext(filename)[1].lower()

            if ext not in SUPPORTED_EXTS:
                continue

            file_path = os.path.join(root, filename)
            stat = os.stat(file_path)

            results.append({
                "filename": filename,
                "file_path": file_path,
                "file_ext": ext.replace(".", ""),
                "file_size": stat.st_size,
            })

    return results