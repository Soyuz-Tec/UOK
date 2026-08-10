from __future__ import annotations

import ast

from source_size_discovery import hard_finding
from source_size_models import (
    HARD_FUNCTION_LINE_LIMIT,
    SOFT_FUNCTION_LINE_LIMIT,
    FunctionSpan,
    SourceFinding,
    function_identity,
    is_python_function_exempt,
)


FUNCTION_THRESHOLDS = (
    (
        SOFT_FUNCTION_LINE_LIMIT,
        "soft",
        "function_soft_60",
        "function exceeds preferred length",
    ),
    (
        HARD_FUNCTION_LINE_LIMIT,
        "hard",
        "function_hard_120",
        "function exceeds hard line limit",
    ),
)


class FunctionCollector(ast.NodeVisitor):
    def __init__(self) -> None:
        self.scope: list[str] = []
        self.spans: list[FunctionSpan] = []

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        self.scope.append(node.name)
        self.generic_visit(node)
        self.scope.pop()

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self._visit_function(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self._visit_function(node)

    def _visit_function(
        self,
        node: ast.FunctionDef | ast.AsyncFunctionDef,
    ) -> None:
        if node.end_lineno is None:
            raise ValueError(f"function {node.name} has no end line")
        start = min((item.lineno for item in node.decorator_list), default=node.lineno)
        qualified_name = ".".join([*self.scope, node.name])
        self.spans.append(
            FunctionSpan(qualified_name, start, node.end_lineno - start + 1)
        )
        self.scope.extend((node.name, "<locals>"))
        self.generic_visit(node)
        del self.scope[-2:]


def _collect_function_spans(path: str, source: str) -> list[FunctionSpan]:
    tree = ast.parse(source, filename=path)
    collector = FunctionCollector()
    collector.visit(tree)
    return collector.spans


def _duplicate_identity_finding(
    identity: str,
    path: str,
    span: FunctionSpan,
) -> SourceFinding:
    return hard_finding(
        f"identity:{identity}",
        "identity",
        path,
        "duplicate_function_identity",
        f"function identity is not unique: {span.qualified_name}",
    )


def _function_size_findings(
    identity: str,
    path: str,
    span: FunctionSpan,
) -> list[SourceFinding]:
    return [
        SourceFinding(
            identity,
            "function",
            path,
            span.lines,
            threshold,
            severity,
            rule,
            reason,
            span.qualified_name,
            span.line,
        )
        for threshold, severity, rule, reason in FUNCTION_THRESHOLDS
        if span.lines > threshold
    ]


def python_findings(path: str, source: str) -> list[SourceFinding]:
    try:
        spans = _collect_function_spans(path, source)
    except (SyntaxError, ValueError) as exc:
        return [
            hard_finding(
                f"parse:{path}",
                "parse",
                path,
                "python_parse",
                f"Python source cannot be parsed for function sizing: {exc}",
            )
        ]
    if is_python_function_exempt(path):
        return []
    findings: list[SourceFinding] = []
    seen: set[str] = set()
    for span in spans:
        identity = function_identity(path, span.qualified_name)
        if identity in seen:
            findings.append(_duplicate_identity_finding(identity, path, span))
            continue
        seen.add(identity)
        findings.extend(_function_size_findings(identity, path, span))
    return findings
