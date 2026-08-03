from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from pathlib import Path

import pytest


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import source_size_configuration as configuration  # noqa: E402
import source_size_policy as policy  # noqa: E402


TODAY = date(2026, 7, 25)
IDENTITY = "function:src/example.py::work"


def _write_config(
    path: Path,
    *,
    baseline: list[dict[str, object]] | None = None,
    exceptions: list[dict[str, object]] | None = None,
) -> Path:
    payload = {
        "schema": "uok.source_size_policy.v1",
        "baseline": baseline or [],
        "exceptions": exceptions or [],
    }
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def _exception(expires_on: date, max_lines: int = 80) -> dict[str, object]:
    return {
        "identity": IDENTITY,
        "kind": "function",
        "path": "src/example.py",
        "symbol": "work",
        "max_lines": max_lines,
        "owner": "@Soyuz-Tec",
        "reason": "Temporary bounded refactor debt with an exact owner.",
        "issue": "https://github.com/Soyuz-Tec/UOK/issues/123",
        "expires_on": expires_on.isoformat(),
    }


def test_expired_or_overlong_exception_fails_configuration(
    tmp_path: Path,
) -> None:
    source = tmp_path / "src/example.py"
    source.parent.mkdir(parents=True)
    source.write_text(
        "\n".join(["def work():", *(["    pass"] * 69)]) + "\n",
        encoding="utf-8",
    )
    config = tmp_path / "policy.json"
    _write_config(
        config,
        exceptions=[_exception(TODAY - timedelta(days=1))],
    )
    report = policy.run_source_size_policy(tmp_path, config_path=config, today=TODAY)
    assert report["hard_findings"][0]["rule"] == "configuration_invalid"

    _write_config(
        config,
        exceptions=[_exception(TODAY + timedelta(days=91))],
    )
    report = policy.run_source_size_policy(tmp_path, config_path=config, today=TODAY)
    assert report["hard_findings"][0]["rule"] == "configuration_invalid"


def test_configuration_rejects_unknown_and_duplicate_keys(tmp_path: Path) -> None:
    config = tmp_path / "policy.json"
    config.write_text(
        '{"schema":"uok.source_size_policy.v1","baseline":[],"exceptions":[],"extra":1}',
        encoding="utf-8",
    )
    with pytest.raises(configuration.SourceSizeConfigurationError, match="keys"):
        configuration.load_source_size_configuration(config, today=TODAY)

    config.write_text(
        '{"schema":"uok.source_size_policy.v1","baseline":[],"baseline":[],"exceptions":[]}',
        encoding="utf-8",
    )
    with pytest.raises(configuration.SourceSizeConfigurationError, match="duplicate"):
        configuration.load_source_size_configuration(config, today=TODAY)


def test_configuration_requires_sorted_unique_canonical_baseline(
    tmp_path: Path,
) -> None:
    config = tmp_path / "policy.json"
    _write_config(
        config,
        baseline=[
            {"identity": "file:web/src/z.ts", "max_lines": 251},
            {"identity": "file:web/src/a.ts", "max_lines": 251},
        ],
    )
    with pytest.raises(configuration.SourceSizeConfigurationError, match="sorted"):
        configuration.load_source_size_configuration(config, today=TODAY)

    _write_config(
        config,
        baseline=[
            {"identity": "file:web/src/a.ts", "max_lines": 251},
            {"identity": "file:web/src/a.ts", "max_lines": 251},
        ],
    )
    with pytest.raises(configuration.SourceSizeConfigurationError, match="unique"):
        configuration.load_source_size_configuration(config, today=TODAY)


def test_configuration_rejects_symlink(tmp_path: Path) -> None:
    target = _write_config(tmp_path / "target.json")
    link = tmp_path / "policy.json"
    try:
        link.symlink_to(target)
    except OSError as exc:
        pytest.skip(f"symlink creation is unavailable: {exc}")

    with pytest.raises(configuration.SourceSizeConfigurationError, match="symlink"):
        configuration.load_source_size_configuration(link, today=TODAY)


def test_exact_exception_can_temporarily_cover_a_hard_function_cap(
    tmp_path: Path,
) -> None:
    source = tmp_path / "src/example.py"
    source.parent.mkdir(parents=True)
    source.write_text(
        "\n".join(["def work():", *(["    pass"] * 120)]) + "\n",
        encoding="utf-8",
    )
    config = _write_config(
        tmp_path / "policy.json",
        exceptions=[_exception(TODAY + timedelta(days=30), 125)],
    )

    report = policy.run_source_size_policy(tmp_path, config_path=config, today=TODAY)

    assert report["ok"] is True
    assert report["hard_cap_count"] == 1
    assert report["active_exception_count"] == 1
    assert report["ratchet"]["new_count"] == 1
