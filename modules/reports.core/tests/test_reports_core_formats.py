from __future__ import annotations

from uok.host.module_paths import ensure_module_backend_paths

ensure_module_backend_paths()

from uok_reports_core.formats import render_report, safe_spreadsheet_cell  # noqa: E402
from uok_reports_core.schemas import GenerateReportRequest  # noqa: E402


def test_csv_formula_injection_guard_prefixes_dangerous_values() -> None:
    assert safe_spreadsheet_cell("=1+1") == "'=1+1"
    assert safe_spreadsheet_cell("+cmd") == "'+cmd"
    assert safe_spreadsheet_cell("@lookup") == "'@lookup"
    assert safe_spreadsheet_cell("   =1+1") == "'   =1+1"


def test_secure_core_renders_csv_json_and_markdown() -> None:
    req = GenerateReportRequest(
        source_module="contacts.core",
        template_key="contacts.export",
        title="Contacts Export",
        formats=["csv", "json", "md"],
        payload={"rows": [{"name": "Alice", "amount": "=1+1"}]},
    )
    csv_report = render_report(req, "csv")
    json_report = render_report(req, "json")
    md_report = render_report(req, "md")
    assert csv_report.media_type.startswith("text/csv")
    assert b"'=1+1" in csv_report.content
    assert json_report.media_type == "application/json"
    assert md_report.content.startswith(b"# Contacts Export")
