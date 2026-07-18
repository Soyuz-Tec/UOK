from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SHIPMENT_WEB = ROOT / "modules" / "shipments.core" / "web" / "src"
FORBIDDEN_DOCUMENT_STORAGE_COLUMNS = {
    "blob",
    "bucket",
    "content_bytes",
    "contentbytes",
    "file_name",
    "file_path",
    "file_url",
    "filename",
    "filepath",
    "fileurl",
    "object_key",
    "object_store_key",
    "objectkey",
    "objectstorekey",
    "preview_url",
    "previewurl",
    "storage_key",
    "storagekey",
    "thumbnail_url",
    "thumbnailurl",
}
BINARY_SQL_TYPE_PATTERN = re.compile(
    r"\b(?:BINARY|BLOB|BYTEA|LONGBLOB|MEDIUMBLOB|TINYBLOB|VARBINARY)\b",
    re.IGNORECASE,
)
FRONTEND_FILE_PIPELINE_PATTERNS = {
    "binary Blob construction": re.compile(r"\bnew\s+Blob\s*\("),
    "browser file reader": re.compile(r"\bFileReader\b"),
    "file input control": re.compile(
        r"<input\b[^>]*\btype\s*=\s*(?:[\"']file[\"']|\{\s*[\"']file[\"']\s*\})",
        re.IGNORECASE | re.DOTALL,
    ),
    "multipart request": re.compile(r"\bmultipart/form-data\b", re.IGNORECASE),
    "object URL preview": re.compile(
        r"\b(?:URL\.)?(?:createObjectURL|revokeObjectURL)\b"
    ),
    "upload form payload": re.compile(r"\bFormData\b"),
    "upload pipeline": re.compile(r"\bupload(?:ed|ing|s)?\b", re.IGNORECASE),
}
BACKEND_FILE_PIPELINE_PATTERN = re.compile(
    r"\b(?:FileResponse|StreamingResponse|UploadFile|boto3|minio|multipart|s3fs)\b",
    re.IGNORECASE,
)


def document_storage_schema_violations(source: str) -> list[str]:
    lowered = source.casefold()
    violations = [
        f"forbidden storage column {column}"
        for column in sorted(FORBIDDEN_DOCUMENT_STORAGE_COLUMNS)
        if re.search(rf"\b{re.escape(column)}\b", lowered)
    ]
    if BINARY_SQL_TYPE_PATTERN.search(source):
        violations.append("binary SQL type")
    return violations


def frontend_file_pipeline_violations(source: str) -> list[str]:
    violations = [
        reason
        for reason, pattern in FRONTEND_FILE_PIPELINE_PATTERNS.items()
        if pattern.search(source)
    ]
    lowered = source.casefold()
    violations.extend(
        f"forbidden storage field {column}"
        for column in sorted(FORBIDDEN_DOCUMENT_STORAGE_COLUMNS)
        if re.search(rf"\b{re.escape(column)}\b", lowered)
    )
    return violations


def backend_file_pipeline_violations(source: str) -> list[str]:
    violations = document_storage_schema_violations(source)
    if BACKEND_FILE_PIPELINE_PATTERN.search(source):
        violations.append("backend file/upload pipeline")
    return violations
