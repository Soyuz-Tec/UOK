from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


QUESTION_TEMPLATE, QUESTION_ROUTE, SECURITY_ROUTE = ".github/ISSUE_TEMPLATE/question.yml", "https://github.com/Soyuz-Tec/UOK/issues/new?template=question.yml", "https://github.com/Soyuz-Tec/UOK/security/advisories/new"
ISSUE_FORMS = (".github/ISSUE_TEMPLATE/bug_report.yml", ".github/ISSUE_TEMPLATE/feature_request.yml", QUESTION_TEMPLATE)
REQUIRED_FILES = (
    "CONTRIBUTING.md", "SECURITY.md", "CODE_OF_CONDUCT.md", "SUPPORT.md", "GOVERNANCE.md",
    *ISSUE_FORMS, ".github/ISSUE_TEMPLATE/config.yml",
)
LICENSE_FILENAMES = ("LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING", "COPYING.md", "COPYING.txt")
_TYPES = {"checkboxes", "dropdown", "input", "markdown", "textarea"}
_ID = re.compile(r"^[A-Za-z0-9_-]+$")
_MAP = re.compile(r"^([A-Za-z_][A-Za-z0-9_-]*):(?:\s*(.*))?$")
_BLOCK = re.compile(r"(?ms)^  - type:\s*(\S+)\s*\n(.*?)(?=^  - type:|\Z)")

def _read(root: Path, relative: str) -> str:
    path = root / relative
    return path.read_text(encoding="utf-8", errors="ignore") if path.is_file() else ""

def _scalar(raw: str, relative: str, line: int, problems: list[str]) -> str:
    value = raw.strip()
    if not value or value in {"|", ">"}:
        return value
    if value[0] in {'"', "'"}:
        if len(value) < 2 or value[-1] != value[0]:
            problems.append(f"{relative}:{line} has an unterminated quoted scalar")
            return ""
        if value[0] == '"':
            try:
                return str(json.loads(value))
            except json.JSONDecodeError:
                problems.append(f"{relative}:{line} has an invalid quoted scalar")
                return ""
        return value[1:-1].replace("''", "'")
    if value.startswith(("[", "{", "&", "*", "!", "<<")):
        problems.append(f"{relative}:{line} uses unsupported YAML syntax")
        return ""
    return value

def _entry(text: str, relative: str, line: int, problems: list[str]) -> tuple[str, str]:
    match = _MAP.fullmatch(text)
    if match is None:
        problems.append(f"{relative}:{line} is not a valid mapping entry")
        return "", ""
    return match.group(1), _scalar(match.group(2) or "", relative, line, problems)

def _nested_form_line(
    indent: int, text: str, relative: str, number: int, problems: list[str],
    section: str, in_options: bool, option_mapping: bool,
) -> tuple[str, bool, bool, int]:
    block_indent = -1
    if indent == 4:
        key, value = _entry(text, relative, number, problems)
        if key in {"attributes", "validations"}:
            section = key
            if value:
                problems.append(f"{relative}:{number} {key} must be a mapping")
        elif key != "id":
            problems.append(f"{relative}:{number} has unsupported body key {key}")
        return section, False, False, block_indent
    if indent == 6 and section in {"attributes", "validations"}:
        key, value = _entry(text, relative, number, problems)
        in_options = section == "attributes" and key == "options" and not value
        return section, in_options, False, indent if value in {"|", ">"} else -1
    if indent == 8 and in_options and text.startswith("- "):
        option_mapping = bool(_MAP.fullmatch(text[2:]))
        if option_mapping:
            key, _ = _entry(text[2:], relative, number, problems)
            if key != "label":
                problems.append(f"{relative}:{number} option mapping must declare label")
        else:
            _scalar(text[2:], relative, number, problems)
        return section, in_options, option_mapping, block_indent
    if indent == 10 and in_options and option_mapping:
        key, _ = _entry(text, relative, number, problems)
        if key != "required":
            problems.append(f"{relative}:{number} has unsupported option key {key}")
        return section, in_options, option_mapping, block_indent
    problems.append(f"{relative}:{number} has unsupported issue-form structure")
    return section, in_options, option_mapping, block_indent

def _form_syntax_problems(content: str, relative: str) -> list[str]:
    problems: list[str] = []
    in_body = have_item = in_options = option_mapping = False
    section, block_indent = "", -1
    for number, raw in enumerate(content.splitlines(), start=1):
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if "\t" in raw:
            problems.append(f"{relative}:{number} contains a tab")
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        text = raw[indent:]
        if block_indent >= 0 and indent > block_indent:
            continue
        block_indent = -1
        if indent % 2:
            problems.append(f"{relative}:{number} has invalid indentation")
            continue
        if indent == 0:
            key, value = _entry(text, relative, number, problems)
            if in_body:
                problems.append(f"{relative}:{number} places a top-level key after body")
            if key == "body":
                in_body = True
                if value:
                    problems.append(f"{relative}:{number} body must be a YAML list")
            elif key not in {"name", "description", "title", "labels", "assignees"}:
                problems.append(f"{relative}:{number} has unsupported top-level key {key}")
            continue
        if indent == 2 and text.startswith("- "):
            if not in_body:
                _scalar(text[2:], relative, number, problems)
                continue
            key, value = _entry(text[2:], relative, number, problems)
            if key != "type" or not value:
                problems.append(f"{relative}:{number} body entry must declare type")
            have_item, section, in_options, option_mapping = True, "", False, False
            continue
        if not have_item:
            problems.append(f"{relative}:{number} has content before a body entry")
            continue
        section, in_options, option_mapping, block_indent = _nested_form_line(
            indent, text, relative, number, problems, section, in_options, option_mapping
        )
    return problems

def _value(text: str, key: str, indent: int) -> str:
    match = re.search(rf"(?m)^{' ' * indent}{re.escape(key)}:\s*(.*?)\s*$", text)
    return match.group(1).strip().strip("\"'") if match else ""

def _required(block: str) -> bool:
    return bool(re.search(r"(?m)^    validations:\s*\n      required:\s*true\s*$", block))

def _options(block: str) -> list[str]:
    match = re.search(r"(?ms)^      options:\s*\n(.*?)(?=^ {4,6}[A-Za-z_][\w-]*:|\Z)", block)
    return re.findall(r"(?m)^        -\s+(.+?)\s*$", match.group(1)) if match else []

def _form_problems(content: str, relative: str) -> list[str]:
    problems = _form_syntax_problems(content, relative)
    if re.search(r"(?m)^body:\s*$", content) is None:
        problems.append(f"{relative} requires a body list")
    for key in ("name", "description"):
        if not _value(content, key, 0):
            problems.append(f"{relative} requires a non-empty top-level {key}")
    items: dict[str, tuple[str, str]] = {}
    for index, match in enumerate(_BLOCK.finditer(content), start=1):
        item_type, block = match.groups()
        if item_type not in _TYPES:
            problems.append(f"{relative} body item {index} has invalid type")
            continue
        if item_type == "markdown":
            if not _value(block, "value", 6) and not re.search(r"(?m)^      value:\s*[|>]\s*\n        \S", block):
                problems.append(f"{relative} markdown item {index} requires content")
            continue
        item_id = _value(block, "id", 4)
        if not _ID.fullmatch(item_id):
            problems.append(f"{relative} body item {index} requires a valid id")
        elif item_id in items:
            problems.append(f"{relative} duplicates body id {item_id}")
        else:
            items[item_id] = (item_type, block)
        if not _value(block, "label", 6):
            problems.append(f"{relative} body item {index} requires a label")
        options = _options(block)
        if item_type == "dropdown" and (len(options) < 2 or any(_MAP.fullmatch(value) for value in options)):
            problems.append(f"{relative} dropdown {item_id} requires at least two options")
        if item_type == "checkboxes" and (not options or any(re.match(r"^label:\s*\S", value) is None for value in options)):
            problems.append(f"{relative} checkboxes {item_id} requires valid options")
    if not list(_BLOCK.finditer(content)):
        problems.append(f"{relative} requires at least one body item")
    if relative == QUESTION_TEMPLATE:
        question = items.get("question", ("", ""))
        area = items.get("area", ("", ""))
        safety = items.get("safety", ("", ""))
        if question[0] != "textarea" or not _required(question[1]):
            problems.append(f"{relative} requires a required question textarea")
        if area[0] != "dropdown" or not _required(area[1]):
            problems.append(f"{relative} requires a required area dropdown")
        if safety[0] != "checkboxes" or not re.search(r"(?m)^          required:\s*true\s*$", safety[1]):
            problems.append(f"{relative} requires a mandatory safety confirmation")
    return problems

def _config_problems(content: str) -> list[str]:
    relative = ".github/ISSUE_TEMPLATE/config.yml"
    problems: list[str] = []
    if _value(content, "blank_issues_enabled", 0).lower() != "false":
        problems.append(f"{relative} must disable blank issues")
    blocks = re.findall(r"(?ms)^  - name:\s*(.+?)\s*\n(.*?)(?=^  - name:|\Z)", content)
    security_route = False
    for name, block in blocks:
        url, about = _value(block, "url", 4), _value(block, "about", 4)
        parsed = urlparse(url)
        security_route |= url.rstrip("/") == SECURITY_ROUTE
        if not name.strip() or not about or parsed.scheme != "https" or not parsed.netloc:
            problems.append(f"{relative} contains an unusable contact link")
    if not security_route:
        problems.append(f"{relative} requires the private security advisory route")
    allowed = re.compile(r"(?m)^(blank_issues_enabled|contact_links):(?:\s*.*)?$|^  - name:\s*.+$|^    (url|about):\s*.+$|^\s*$")
    for number, line in enumerate(content.splitlines(), start=1):
        if "\t" in line or (line.strip() and not allowed.fullmatch(line)):
            problems.append(f"{relative}:{number} has invalid structure")
    return problems

def community_health_report(repo_root: Path) -> dict[str, Any]:
    missing = [path for path in REQUIRED_FILES if not (repo_root / path).is_file()]
    empty = [path for path in REQUIRED_FILES if (repo_root / path).is_file() and not _read(repo_root, path).strip()]
    problems = [f"missing community artifact: {path}" for path in missing]
    problems.extend(f"empty community artifact: {path}" for path in empty)
    for relative in ISSUE_FORMS:
        content = _read(repo_root, relative)
        if content.strip():
            problems.extend(_form_problems(content, relative))
    config = _read(repo_root, ".github/ISSUE_TEMPLATE/config.yml")
    if config.strip():
        problems.extend(_config_problems(config))
    phrases = (("SECURITY.md", "Report a vulnerability"), ("CONTRIBUTING.md", "TechnologyAudit"),
               ("CONTRIBUTING.md", "CODEOWNERS"), ("GOVERNANCE.md", "independent human maintainers"),
               ("SUPPORT.md", QUESTION_ROUTE))
    for relative, phrase in phrases:
        content = _read(repo_root, relative)
        if content.strip() and phrase not in content:
            problems.append(f"{relative} missing required community policy phrase: {phrase}")
    license_path = next(
        (path for path in LICENSE_FILENAMES if (repo_root / path).is_file()), None
    )
    return {
        "ok": not problems,
        "missing": missing,
        "empty": empty,
        "problems": problems,
        "license": {
            "present": license_path is not None,
            "path": license_path,
            "status": "declared" if license_path else "owner_decision_required",
        },
        "independent_review": {
            "status": "external_configuration_required",
            "source": ".github/CODEOWNERS and effective GitHub rules",
        },
    }

def community_health_problems(repo_root: Path) -> list[str]:
    return list(community_health_report(repo_root)["problems"])
