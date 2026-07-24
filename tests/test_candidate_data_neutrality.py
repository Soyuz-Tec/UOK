from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from uok.candidate_verifier_catalog import candidate_verifier_catalog  # noqa: E402


def _read(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def test_candidate_api_identifies_disposable_state() -> None:
    system_api = _read("src/uok/api/system.py")
    compose = _read("deploy/compose-candidate-isolated.yaml")

    assert 'os.getenv("UOK_CANDIDATE_STATE", "persistent")' in system_api
    assert "UOK_CANDIDATE_STATE: ephemeral" in compose
    assert "build:" not in compose
    assert "image: ${UOK_CANDIDATE_API_IMAGE}" in compose
    assert "image: ${UOK_CANDIDATE_DB_IMAGE}" in compose
    assert compose.count("pull_policy: never") == 2
    assert '"127.0.0.1:${UOK_CANDIDATE_HOST_PORT}:8080"' in compose
    assert "candidate_pg18:" in compose
    assert "candidate_files:" in compose
    assert compose.count("uok.candidate.run: ${UOK_CANDIDATE_RUN_ID}") == 5


def test_mutating_candidate_verifier_fails_closed_for_persistent_targets() -> None:
    verifier = _read("scripts/verify_uok_candidate.ps1")

    guard_index = verifier.index("if (-not $EphemeralTarget)")
    catalog_index = verifier.index("candidate_verifier_catalog.py")
    assert guard_index < catalog_index
    assert '$health.candidate_state -ne "ephemeral"' in verifier
    assert "Use scripts\\verify_uok_candidate_isolated.ps1" in verifier
    assert "AllowPersistent" not in verifier


def test_isolated_runner_uses_exact_runtime_image_and_always_removes_volumes() -> None:
    runner = _read("scripts/verify_uok_candidate_isolated.ps1")

    assert '"$RuntimeProject-$ServiceName-1"' in runner
    assert '-ServiceName "api"' in runner
    assert '-ServiceName "db"' in runner
    assert '--format "{{.Image}}"' in runner
    assert '--format "{{.Id}}"' in runner
    assert '$env:UOK_CANDIDATE_API_IMAGE = $resolvedImage' in runner
    assert "$env:UOK_CANDIDATE_DB_IMAGE = $resolvedDatabaseImage" in runner
    assert '$health.candidate_state -eq "ephemeral"' in runner
    assert '"down", "-v", "--remove-orphans"' in runner
    assert '& (Join-Path $PSScriptRoot "verify_uok_candidate.ps1")' in runner
    assert "function Assert-UokCandidateResourcesRemoved" in runner
    assert '"ps", "-a", "--filter", "label=uok.candidate.run=$RunId"' in runner
    assert '"volume", "ls", "--filter", "label=uok.candidate.run=$RunId"' in runner
    assert '"network", "ls", "--filter", "label=uok.candidate.run=$RunId"' in runner
    assert "function Remove-UokCandidateResidualResources" in runner
    assert "$primaryError = $_" in runner
    assert "$cleanupErrors += $_.Exception.Message" in runner
    assert "Cleanup also failed" in runner
    assert "-EphemeralTarget" in runner


def test_neutrality_gate_runs_two_fresh_stacks_from_the_same_images() -> None:
    runner = _read("scripts/verify_uok_candidate_isolated.ps1")

    assert "[int]$Runs = 2" in runner
    assert "for ($run = 1; $run -le $Runs; $run++)" in runner
    assert runner.index("$resolvedImage = Get-UokCandidateImage") < runner.index(
        "for ($run = 1; $run -le $Runs; $run++)"
    )
    assert '$runId = [Guid]::NewGuid().ToString("N")' in runner
    assert '$candidateProject = "uok-candidate-$runId"' in runner
    assert "Invoke-UokCandidateIsolatedRun" in runner
    assert "removed all disposable resources" in runner


def test_failure_is_captured_before_unconditional_teardown_and_postconditions() -> None:
    runner = _read("scripts/verify_uok_candidate_isolated.ps1")
    run_function = runner[
        runner.index("function Invoke-UokCandidateIsolatedRun") :
        runner.index("$resolvedCompose =")
    ]

    failure_capture = run_function.index("$primaryError = $_")
    teardown = run_function.index('"down", "-v", "--remove-orphans"')
    postcondition = run_function.index("Assert-UokCandidateResourcesRemoved")
    primary_rethrow = run_function.index("if ($primaryError)", postcondition)
    assert failure_capture < teardown < postcondition < primary_rethrow


def test_controlled_post_verification_failure_qualifies_teardown_path() -> None:
    runner = _read("scripts/verify_uok_candidate_isolated.ps1")

    assert "[switch]$FailAfterVerification" in runner
    assert "Controlled post-verification failure for teardown qualification." in runner
    assert "-InjectFailure ($FailAfterVerification -and $run -eq 1)" in runner


def test_shipment_fixture_is_consumed_by_intelligence_in_catalog_order() -> None:
    names = [entry["name"] for entry in candidate_verifier_catalog()]

    assert names.index("shipments.core") < names.index("intelligence.core")


def test_standard_operations_only_use_the_isolated_candidate_runner() -> None:
    operations = _read("scripts/uok_ops.ps1")
    planning = _read("scripts/uok_planning_release_ops.ps1")

    assert operations.count("verify_uok_candidate_isolated.ps1") == 2
    assert "verify_uok_candidate.ps1" not in operations
    assert "verify_uok_candidate_isolated.ps1" in planning
    assert "verify_uok_candidate.ps1" not in planning
