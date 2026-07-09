from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, Field, field_validator

SUPPORTED_REPORT_FORMATS = ("txt", "md", "json", "jsonl", "csv", "tsv")
MAX_FORMATS_PER_REQUEST = 6
MAX_PAYLOAD_BYTES = 250_000
SAFE_KEY_PATTERN = re.compile(r"^[A-Za-z0-9_.:-]+$")


class GenerateReportRequest(BaseModel):
    source_module: str = Field(..., min_length=3, max_length=120)
    template_key: str = Field(default="default", min_length=1, max_length=160)
    formats: list[str] = Field(default_factory=lambda: ["json"], min_length=1, max_length=MAX_FORMATS_PER_REQUEST)
    title: str = Field(default="UOK Report", min_length=1, max_length=180)
    filename_base: str | None = Field(default=None, max_length=160)
    payload: dict[str, Any] = Field(default_factory=dict)
    options: dict[str, Any] = Field(default_factory=dict)

    @field_validator("source_module", "template_key")
    @classmethod
    def keys_are_safe(cls, value: str) -> str:
        cleaned = value.strip()
        if not SAFE_KEY_PATTERN.fullmatch(cleaned):
            raise ValueError("report keys may contain only letters, numbers, dot, underscore, colon, or dash")
        return cleaned

    @field_validator("formats")
    @classmethod
    def formats_are_supported(cls, formats: list[str]) -> list[str]:
        normalized: list[str] = []
        for raw_format in formats:
            value = str(raw_format).lower().strip()
            if value not in SUPPORTED_REPORT_FORMATS:
                raise ValueError(f"unsupported report format: {raw_format}")
            if value not in normalized:
                normalized.append(value)
        return normalized


class ReportArtifactResponse(BaseModel):
    id: str
    source_module: str
    template_key: str
    artifact_kind: str
    format: str
    filename: str
    media_type: str
    content_sha256: str
    byte_size: int
    status: str
    metadata: dict[str, Any]
    created_at: str
    deleted_at: str | None = None


class GenerateReportResponse(BaseModel):
    artifacts: list[ReportArtifactResponse]
    artifact_count: int


class ReportFormatResponse(BaseModel):
    formats: list[str]
    default_format: str
    security_model: str
