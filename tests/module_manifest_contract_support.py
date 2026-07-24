from __future__ import annotations

from pathlib import Path


def manifest_text(
    name: str,
    *,
    maturity: str = "source_present",
    required: bool = False,
    dependencies: tuple[str, ...] = (),
    extension_points: tuple[str, ...] = (),
    extra_fields: str = "",
) -> str:
    planned = maturity == "planned"
    lifecycle = ("planned",) if planned else (("installed", "upgraded") if required else (
        "available", "installed", "disabled", "upgraded", "uninstalled"
    ))
    enabled = "false" if planned else "true"
    uninstallable = "false" if planned or required else "true"
    return f"""manifest_schema: uok.module.v1
name: {name}
kind: capability_module
version: APP_VERSION
description: "Test module"
maturity: {maturity}
installable: {enabled}
uninstallable: {uninstallable}
updatable: {enabled}
maintainable: {enabled}
required: {str(required).lower()}
lifecycle: {_yaml_list(lifecycle)}
commands: []
events: []
dependencies: {_yaml_list(dependencies)}
backend_path: modules/{name}/backend
web_path: modules/{name}/web
migrations_path: modules/{name}/migrations
tests_path: modules/{name}/tests
api_prefixes: {_yaml_list((f'/api/{name}',) if 'api_router' in extension_points else ())}
{extra_fields}permissions: []
owned_tables: []
extension_points: {_yaml_list(extension_points)}
data_retention_policy: "Test records are retained."
"""


def write_module(
    module_root: Path,
    name: str,
    *,
    maturity: str = "source_present",
    required: bool = False,
    dependencies: tuple[str, ...] = (),
    package: str | None = None,
    exported_attribute: str = "router",
    verifier: bool = False,
    web_surface: str | None = None,
    release_assets: bool = True,
) -> None:
    root = module_root / name
    for folder in ("backend", "migrations", "web"):
        (root / folder).mkdir(parents=True, exist_ok=True)
    if release_assets:
        (root / "tests").mkdir()
        (root / "tests" / "test_contract.py").write_text(
            "def test_contract():\n    assert True\n", encoding="utf-8"
        )
    extensions: list[str] = []
    fields = ""
    if package:
        package_root = root / "backend" / package
        package_root.mkdir()
        (package_root / "__init__.py").write_text("", encoding="utf-8")
        (package_root / "api.py").write_text(f"{exported_attribute} = object()\n", encoding="utf-8")
        extensions.append("api_router")
        fields += f"api_router: {package}.api:router\n"
    if verifier:
        extensions.append("candidate_verifier")
        script = f"modules/{name}/verify/UokCandidateTest.ps1"
        fields += f"candidate_verifier_script: {script}\n"
        fields += "candidate_verifier_function: Invoke-UokCandidateTest\n"
        if release_assets:
            (root / "verify").mkdir()
            (module_root.parent / script).write_text(
                "function Invoke-UokCandidateTest {}\n", encoding="utf-8"
            )
    if web_surface is not None:
        extensions.append("web_surface")
        entry = f"modules/{name}/web/src/moduleSurface.tsx"
        fields += f"web_entry: {entry}\n"
        fields += f"web_section: {web_surface}\n"
        source_root = root / "web" / "src"
        source_root.mkdir(parents=True, exist_ok=True)
        (source_root / "moduleSurface.tsx").write_text(
            "export default {};\n", encoding="utf-8"
        )
    (root / "manifest.yaml").write_text(
        manifest_text(
            name,
            maturity=maturity,
            required=required,
            dependencies=dependencies,
            extension_points=tuple(extensions),
            extra_fields=fields,
        ),
        encoding="utf-8",
    )


def _yaml_list(values: tuple[str, ...]) -> str:
    if not values:
        return "[]"
    return "\n" + "".join(f"  - {value}\n" for value in values).rstrip()
