from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from typing import Any

from uok.util import dumps

from .schemas import GenerateReportRequest

DANGEROUS_SPREADSHEET_PREFIXES = ("=", "+", "-", "@", "\t", "\r", "\n")
MAX_ROWS = 10_000
MAX_COLUMNS = 120
MAX_CELL_CHARS = 4_000

MEDIA_TYPES = {
    "txt": "text/plain; charset=utf-8",
    "md": "text/markdown; charset=utf-8",
    "json": "application/json",
    "jsonl": "application/x-ndjson",
    "csv": "text/csv; charset=utf-8",
    "tsv": "text/tab-separated-values; charset=utf-8",
}


@dataclass(frozen=True)
class RenderedReport:
    format: str
    extension: str
    media_type: str
    content: bytes


def render_report(request: GenerateReportRequest, report_format: str) -> RenderedReport:
    if report_format == "json":
        text = dumps({"title": request.title, "payload": request.payload})
    elif report_format == "jsonl":
        text = _render_jsonl(request.payload)
    elif report_format == "csv":
        text = _render_delimited(request.payload, delimiter=",")
    elif report_format == "tsv":
        text = _render_delimited(request.payload, delimiter="\t")
    elif report_format == "md":
        text = _render_markdown(request)
    elif report_format == "txt":
        text = _render_text(request)
    else:
        raise ValueError(f"unsupported report format: {report_format}")
    return RenderedReport(
        format=report_format,
        extension=report_format,
        media_type=MEDIA_TYPES[report_format],
        content=text.encode("utf-8"),
    )


def _render_text(request: GenerateReportRequest) -> str:
    lines = [request.title, "=" * min(len(request.title), 80), ""]
    for key, value in request.payload.items():
        lines.append(f"{key}: {_text_value(value)}")
    return "\n".join(lines) + "\n"


def _render_markdown(request: GenerateReportRequest) -> str:
    rows = _extract_rows(request.payload)
    if rows:
        return f"# {request.title}\n\n" + _rows_as_markdown(rows)
    return f"# {request.title}\n\n```json\n{dumps(request.payload)}\n```\n"


def _render_jsonl(payload: dict[str, Any]) -> str:
    rows = _extract_rows(payload)
    if not rows:
        return dumps(payload) + "\n"
    return "\n".join(dumps(row) for row in rows[:MAX_ROWS]) + "\n"


def _render_delimited(payload: dict[str, Any], delimiter: str) -> str:
    rows = _extract_rows(payload)
    if not rows:
        rows = [{"key": key, "value": _text_value(value)} for key, value in payload.items()]
    columns = _columns_for_rows(rows)
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=columns, delimiter=delimiter, extrasaction="ignore")
    writer.writeheader()
    for row in rows[:MAX_ROWS]:
        writer.writerow({column: safe_spreadsheet_cell(row.get(column, "")) for column in columns})
    return output.getvalue()


def _extract_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    raw_rows = payload.get("rows") or payload.get("items") or []
    if not isinstance(raw_rows, list):
        return []
    rows: list[dict[str, Any]] = []
    for item in raw_rows[:MAX_ROWS]:
        if isinstance(item, dict):
            rows.append(item)
        else:
            rows.append({"value": item})
    return rows


def _columns_for_rows(rows: list[dict[str, Any]]) -> list[str]:
    columns: list[str] = []
    for row in rows:
        for key in row:
            column = str(key)[:80]
            if column not in columns:
                columns.append(column)
            if len(columns) >= MAX_COLUMNS:
                return columns
    return columns or ["value"]


def _rows_as_markdown(rows: list[dict[str, Any]]) -> str:
    columns = _columns_for_rows(rows)
    header = "| " + " | ".join(columns) + " |"
    divider = "| " + " | ".join("---" for _ in columns) + " |"
    body = []
    for row in rows[:MAX_ROWS]:
        body.append("| " + " | ".join(_markdown_cell(row.get(column, "")) for column in columns) + " |")
    return "\n".join([header, divider, *body]) + "\n"


def _markdown_cell(value: Any) -> str:
    return _text_value(value).replace("|", "\\|").replace("\n", " ")


def _text_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list, tuple)):
        text = dumps(value)
    else:
        text = str(value)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    if len(text) > MAX_CELL_CHARS:
        return text[:MAX_CELL_CHARS] + "…[truncated]"
    return text


def safe_spreadsheet_cell(value: Any) -> str:
    text = _text_value(value)
    if text.lstrip().startswith(DANGEROUS_SPREADSHEET_PREFIXES):
        return "'" + text
    return text
