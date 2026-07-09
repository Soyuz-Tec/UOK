from __future__ import annotations

import csv
from io import StringIO
from typing import Any

from .util import dumps

DANGEROUS_SPREADSHEET_PREFIXES = ("=", "+", "-", "@", "\t", "\r", "\n")
DEFAULT_MAX_CELL_CHARS = 4_000


def text_cell(value: Any, max_chars: int = DEFAULT_MAX_CELL_CHARS) -> str:
    if value is None:
        return ""
    text = dumps(value) if isinstance(value, (dict, list, tuple)) else str(value)
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    if len(normalized) > max_chars:
        return normalized[:max_chars] + "...[truncated]"
    return normalized


def safe_spreadsheet_cell(value: Any, max_chars: int = DEFAULT_MAX_CELL_CHARS) -> str:
    text = text_cell(value, max_chars)
    if text.lstrip().startswith(DANGEROUS_SPREADSHEET_PREFIXES):
        return "'" + text
    return text


def csv_dict_rows(csv_text: str, max_bytes: int, max_rows: int) -> list[tuple[int, dict[str, Any]]]:
    if len(csv_text.encode("utf-8")) > max_bytes:
        raise ValueError(f"csv_text must be {max_bytes} bytes or fewer")
    rows: list[tuple[int, dict[str, Any]]] = []
    reader = csv.DictReader(StringIO(csv_text))
    for row_index, (row_number, row) in enumerate(enumerate(reader, start=2), start=1):
        if row_index > max_rows:
            raise ValueError(f"CSV import is limited to {max_rows} rows")
        rows.append((row_number, row))
    return rows
