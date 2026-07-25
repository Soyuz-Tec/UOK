from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "collect_sli_evidence.py"
SPEC = importlib.util.spec_from_file_location("collect_sli_evidence", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class FakeResponse:
    status = 200

    def __enter__(self) -> FakeResponse:
        return self

    def __exit__(self, *_args: Any) -> None:
        return None

    def read(self) -> bytes:
        return b'{"status":"ok"}'


def test_nearest_rank_is_deterministic() -> None:
    assert MODULE.nearest_rank([], 0.95) is None
    assert MODULE.nearest_rank([4.0, 1.0, 3.0, 2.0], 0.50) == 2.0
    assert MODULE.nearest_rank([4.0, 1.0, 3.0, 2.0], 0.95) == 4.0


def test_collect_and_evaluate_endpoint(monkeypatch: Any) -> None:
    ticks = iter((1.000, 1.010, 2.000, 2.020))
    monkeypatch.setattr(MODULE.time, "perf_counter", lambda: next(ticks))

    report = MODULE.collect_endpoint(
        "http://uok.test/health/live",
        samples=2,
        interval_ms=0,
        timeout_seconds=1,
        opener=lambda *_args, **_kwargs: FakeResponse(),
    )

    assert report["successful_samples"] == 2
    assert report["availability"] == 1.0
    assert report["latency_ms"] == {"p50": 10.0, "p95": 20.0, "max": 20.0}
    assert MODULE.evaluate(
        report,
        availability_target=1.0,
        p95_target_ms=20.0,
    ) == {"availability": True, "p95_latency": True}
