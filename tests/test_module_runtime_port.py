from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys

from uok.kernel.module_runtime import module_catalog, module_runtime_configured
from uok.kernel.security import role_grants_configured


ROOT = Path(__file__).resolve().parents[1]


def test_module_runtime_fails_explicitly_without_host_configuration() -> None:
    env = dict(os.environ)
    env["PYTHONPATH"] = os.pathsep.join(
        value for value in (str(ROOT / "src"), env.get("PYTHONPATH", "")) if value
    )
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "from uok.kernel.module_runtime import module_catalog; module_catalog()",
        ],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode != 0
    assert "module runtime is not configured" in result.stderr


def test_host_application_configures_module_runtime() -> None:
    import uok.host.application  # noqa: F401

    assert module_runtime_configured()
    assert role_grants_configured()
    assert "contacts.core" in module_catalog()


def test_security_policy_fails_explicitly_without_host_configuration() -> None:
    env = dict(os.environ)
    env["PYTHONPATH"] = os.pathsep.join(
        value for value in (str(ROOT / "src"), env.get("PYTHONPATH", "")) if value
    )
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "from uok.kernel.security import Actor, has_permission; "
                "has_permission(Actor('u', 'user', 'o', 'viewer'), 'module.read')"
            ),
        ],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode != 0
    assert "security policy is not configured" in result.stderr
