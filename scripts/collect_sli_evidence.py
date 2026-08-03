from __future__ import annotations

import argparse
import json
import math
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable
from urllib.error import URLError
from urllib.request import urlopen


DEFAULT_OUTPUT_ROOT = Path(__file__).resolve().parents[1] / "var" / "evidence" / "operations"


def nearest_rank(values: list[float], percentile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, math.ceil(percentile * len(ordered)) - 1)
    return round(ordered[index], 3)


def collect_endpoint(
    url: str,
    *,
    samples: int,
    interval_ms: int,
    timeout_seconds: float,
    opener: Callable[..., Any] = urlopen,
) -> dict[str, Any]:
    observations: list[dict[str, Any]] = []
    for index in range(samples):
        started = time.perf_counter()
        status_code = 0
        body_status = "unavailable"
        try:
            with opener(url, timeout=timeout_seconds) as response:
                status_code = int(response.status)
                payload = json.loads(response.read().decode("utf-8"))
                body_status = str(payload.get("status", "unknown"))
        except (OSError, URLError, ValueError, json.JSONDecodeError):
            pass
        elapsed_ms = round((time.perf_counter() - started) * 1000, 3)
        observations.append(
            {
                "sample": index + 1,
                "status_code": status_code,
                "body_status": body_status,
                "latency_ms": elapsed_ms,
                "ok": status_code == 200 and body_status == "ok",
            }
        )
        if interval_ms and index + 1 < samples:
            time.sleep(interval_ms / 1000)

    successful = [row["latency_ms"] for row in observations if row["ok"]]
    return {
        "url": url,
        "samples": samples,
        "successful_samples": len(successful),
        "availability": round(len(successful) / samples, 6),
        "latency_ms": {
            "p50": nearest_rank(successful, 0.50),
            "p95": nearest_rank(successful, 0.95),
            "max": max(successful, default=None),
        },
        "observations": observations,
    }


def evaluate(
    report: dict[str, Any],
    *,
    availability_target: float,
    p95_target_ms: float,
) -> dict[str, bool]:
    latency = report["latency_ms"]["p95"]
    return {
        "availability": report["availability"] >= availability_target,
        "p95_latency": latency is not None and latency <= p95_target_ms,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Collect bounded UOK liveness and readiness SLI evidence."
    )
    parser.add_argument("--base-url", default="http://127.0.0.1:18088")
    parser.add_argument("--samples", type=int, default=30)
    parser.add_argument("--interval-ms", type=int, default=100)
    parser.add_argument("--timeout-seconds", type=float, default=3.0)
    parser.add_argument("--availability-target", type=float, default=0.995)
    parser.add_argument("--p95-target-ms", type=float, default=500.0)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--require-targets", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.samples < 1 or args.interval_ms < 0 or args.timeout_seconds <= 0:
        raise SystemExit("samples must be positive; interval must be nonnegative")
    if not 0 < args.availability_target <= 1 or args.p95_target_ms <= 0:
        raise SystemExit("targets must be positive and availability no greater than 1")

    base_url = args.base_url.rstrip("/")
    started_at = datetime.now(UTC)
    endpoints = {
        name: collect_endpoint(
            f"{base_url}{path}",
            samples=args.samples,
            interval_ms=args.interval_ms,
            timeout_seconds=args.timeout_seconds,
        )
        for name, path in (
            ("liveness", "/health/live"),
            ("readiness", "/health/ready"),
        )
    }
    checks = {
        name: evaluate(
            report,
            availability_target=args.availability_target,
            p95_target_ms=args.p95_target_ms,
        )
        for name, report in endpoints.items()
    }
    passed = all(all(result.values()) for result in checks.values())
    evidence = {
        "schema_version": 1,
        "started_at": started_at.isoformat(),
        "completed_at": datetime.now(UTC).isoformat(),
        "scope": "bounded_point_in_time_probe",
        "targets": {
            "availability": args.availability_target,
            "p95_latency_ms": args.p95_target_ms,
            "authority": "engineering_baseline_not_business_approved_slo",
        },
        "endpoints": endpoints,
        "checks": checks,
        "ok": passed,
    }
    output = args.output or (
        DEFAULT_OUTPUT_ROOT
        / f"sli-{started_at.strftime('%Y%m%dT%H%M%SZ')}.json"
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": passed, "evidence": str(output.resolve())}))
    return 1 if args.require_targets and not passed else 0


if __name__ == "__main__":
    raise SystemExit(main())
