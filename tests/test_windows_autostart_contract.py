from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def _read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def _function_body(script: str, name: str, next_name: str) -> str:
    start = script.index(f"function {name}")
    end = script.index(f"function {next_name}", start)
    return script[start:end]


def test_compose_recovery_is_no_pull_and_restartable() -> None:
    compose = _read("deploy/compose-local-18088.yaml")
    override = _read("deploy/compose-autostart.override.yaml")

    assert compose.count("restart: unless-stopped") == 2
    assert override.count("restart: unless-stopped") == 2
    assert override.count("pull_policy: never") == 2
    assert "image: docker.io/library/uok-api:latest" in override
    assert "password:" not in override.lower()
    assert "secret:" not in override.lower()


def test_worker_is_bounded_pinned_and_non_destructive() -> None:
    worker = _read("scripts/uok_autostart_worker.ps1")

    assert "--no-build" in worker
    assert "--no-recreate" in worker
    assert '"--connection", $Config.connection_name' in worker
    assert 'EnvironmentVariables.Remove("CONTAINER_HOST")' in worker
    assert 'EnvironmentVariables.Remove("DOCKER_HOST")' in worker
    assert "PODMAN_COMPOSE_PROVIDER" in worker
    assert "TimeoutSeconds" in worker
    assert "taskkill.exe" in worker
    assert "payload_hashes" in worker
    assert "com.docker.compose.project" in worker
    assert "com.docker.compose.service" in worker
    assert "expected_name" in worker
    assert "expected_version" in worker
    assert 'Join-Path $stateRoot "disabled"' in worker
    assert 'Split-Path -Leaf $releasesRoot' in worker
    assert "C:\\Users\\" not in worker
    for forbidden in ('"--build"', '"pull"', '"down"', '"rm"', '"prune"', '"machine", "rm"', '"machine", "reset"'):
        assert forbidden not in worker


def test_task_installation_is_user_scoped_owned_and_reversible() -> None:
    operations = _read("scripts/uok_autostart_ops.ps1")
    support = _read("scripts/uok_autostart_support.ps1")
    contract = operations + support

    assert 'ContractVersion = "uok.windows-autostart.v1"' in contract
    assert 'TaskPath = "\\UOK\\"' in contract
    assert "A foreign scheduled task already uses the name" in contract
    assert "Export-ScheduledTask" in contract
    assert "-LogonType Interactive -RunLevel Limited" in operations
    assert 'trigger.Delay = "PT${DelaySeconds}S"' in contract
    assert "-RestartCount 3" in operations
    assert "-MultipleInstances IgnoreNew" in operations
    assert "ConfirmUninstall" in operations
    assert "Containers, images, volumes, database data, and logs were left unchanged" in operations
    assert "New-UokAutoStartReleasePaths" in contract
    assert "Test-UokAutoStartTaskDefinition" in contract
    assert "Register-ScheduledTask -TaskName $TaskName -TaskPath $previousTaskPath -Xml $previousXml" in contract
    assert "@($Task.Actions).Count -ne 1" in contract
    assert "@($Task.Triggers).Count -ne 1" in contract
    assert "Task.Settings.Enabled" in contract
    assert "source_tree_state" in contract
    assert "Remove-ItemProperty" not in contract
    assert "HKEY_" not in contract
    assert "C:\\Users\\" not in contract
    for secret_field in ("database_url =", "password =", "secret =", "token ="):
        assert secret_field not in contract.lower()


def test_status_is_read_only_and_payload_aware() -> None:
    operations = _read("scripts/uok_autostart_ops.ps1")
    support = _read("scripts/uok_autostart_support.ps1")
    body = _function_body(operations, "Get-UokAutoStartStatus", "Install-UokAutoStart")

    assert "Test-UokAutoStartPayload" in body
    assert "Get-FileHash" in support
    assert "PayloadIntegrity" in body
    assert "TaskDefinitionValid" in body
    assert "Start-ScheduledTask" not in body
    assert "Register-ScheduledTask" not in body
    assert "podman" not in body.lower()


def test_standard_operations_routes_the_full_lifecycle() -> None:
    operations = _read("scripts/uok_ops.ps1")

    for action in (
        "AutoStartInstall",
        "AutoStartStatus",
        "AutoStartVerify",
        "AutoStartDisable",
        "AutoStartEnable",
        "AutoStartUninstall",
    ):
        assert action in operations
    assert "uok_autostart_ops.ps1" in operations
    assert '"-Action", "Refresh"' in operations
    assert len(operations.splitlines()) <= 300
    assert len(_read("scripts/uok_autostart_support.ps1").splitlines()) <= 300
