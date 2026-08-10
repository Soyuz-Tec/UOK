from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_api_image_uses_bounded_readiness_healthcheck() -> None:
    dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")

    assert "HEALTHCHECK --interval=30s --timeout=5s" in dockerfile
    assert "--start-period=30s --retries=3" in dockerfile
    assert "http://127.0.0.1:8080/health/ready" in dockerfile
    assert "timeout=3" in dockerfile
