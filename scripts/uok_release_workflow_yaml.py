from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any


class WorkflowSyntaxError(ValueError):
    """Raised for YAML outside the intentionally narrow workflow subset."""


@dataclass(frozen=True)
class Scalar:
    value: str
    line: int


@dataclass(frozen=True)
class BlockScalar:
    style: str
    body: str
    line: int


@dataclass(frozen=True)
class Mapping:
    values: dict[str, "Node"]
    line: int


@dataclass(frozen=True)
class Sequence:
    values: list["Node"]
    line: int


Node = Scalar | BlockScalar | Mapping | Sequence


def _commentless(value: str) -> str:
    quote: str | None = None
    escaped = False
    for index, character in enumerate(value):
        if escaped:
            escaped = False
            continue
        if quote == '"' and character == "\\":
            escaped = True
            continue
        if character in {"'", '"'}:
            if quote is None:
                quote = character
            elif quote == character:
                quote = None
            continue
        if (
            character == "#"
            and quote is None
            and (index == 0 or value[index - 1].isspace())
        ):
            return value[:index].rstrip()
    return value.rstrip()


def _split_pair(value: str, line: int) -> tuple[str, str]:
    quote: str | None = None
    for index, character in enumerate(value):
        if character in {"'", '"'}:
            quote = (
                None if quote == character else character if quote is None else quote
            )
        elif character == ":" and quote is None:
            key = value[:index].strip()
            forbidden = ("{", "}", "[", "]", "&", "*", "!")
            if not key or any(token in key for token in forbidden):
                break
            return key, value[index + 1 :].strip()
    raise WorkflowSyntaxError(f"Line {line}: expected a simple mapping entry")


def _scalar(value: str, line: int) -> Scalar:
    if value.startswith(("&", "*", "!", "[", "{")) and not value.startswith("${{"):
        raise WorkflowSyntaxError(f"Line {line}: unsupported YAML scalar syntax")
    if value.startswith('"') and value.endswith('"'):
        try:
            return Scalar(json.loads(value), line)
        except json.JSONDecodeError as exc:
            raise WorkflowSyntaxError(f"Line {line}: invalid quoted scalar") from exc
    if value.startswith("'") and value.endswith("'"):
        return Scalar(value[1:-1].replace("''", "'"), line)
    return Scalar(value, line)


class _Parser:
    def __init__(self, text: str) -> None:
        if text.startswith("\ufeff"):
            raise WorkflowSyntaxError("UTF-8 BOM is not permitted")
        if "\t" in text:
            raise WorkflowSyntaxError("Tabs are not permitted")
        self.lines = text.replace("\r\n", "\n").replace("\r", "\n").splitlines()
        for number, line in enumerate(self.lines, 1):
            if line.strip() in {"---", "..."}:
                raise WorkflowSyntaxError(
                    f"Line {number}: multiple YAML documents are forbidden"
                )

    def parse(self) -> Mapping:
        node, index = self._block(self._next(0), 0)
        if self._next(index) != len(self.lines) or not isinstance(node, Mapping):
            raise WorkflowSyntaxError("Workflow root must be one mapping")
        return node

    def _next(self, index: int) -> int:
        while index < len(self.lines):
            stripped = self.lines[index].strip()
            if stripped and not stripped.startswith("#"):
                break
            index += 1
        return index

    def _indent(self, index: int) -> int:
        return len(self.lines[index]) - len(self.lines[index].lstrip(" "))

    def _block(self, index: int, indent: int) -> tuple[Node, int]:
        if index >= len(self.lines) or self._indent(index) != indent:
            raise WorkflowSyntaxError(
                f"Line {index + 1}: expected indentation {indent}"
            )
        if self.lines[index][indent:].startswith("- "):
            return self._sequence(index, indent)
        return self._mapping(index, indent)

    def _value(self, value: str, index: int, indent: int) -> tuple[Node, int]:
        line = index + 1
        if value in {"|", "|-", ">", ">-"}:
            body_lines: list[str] = []
            cursor = index + 1
            while cursor < len(self.lines):
                raw = self.lines[cursor]
                if raw.strip() and self._indent(cursor) <= indent:
                    break
                if raw.strip() and self._indent(cursor) < indent + 2:
                    raise WorkflowSyntaxError(
                        f"Line {cursor + 1}: malformed block scalar"
                    )
                body_lines.append(raw[indent + 2 :] if raw.strip() else "")
                cursor += 1
            return BlockScalar(value, "\n".join(body_lines), line), cursor
        if value:
            return _scalar(_commentless(value), line), index + 1
        cursor = self._next(index + 1)
        if cursor >= len(self.lines) or self._indent(cursor) != indent + 2:
            raise WorkflowSyntaxError(f"Line {line}: empty mapping value")
        return self._block(cursor, indent + 2)

    def _insert(
        self,
        values: dict[str, Node],
        key: str,
        node: Node,
        line: int,
    ) -> None:
        if key in values:
            raise WorkflowSyntaxError(f"Line {line}: duplicate key {key!r}")
        if key == "<<":
            raise WorkflowSyntaxError(f"Line {line}: merge keys are forbidden")
        values[key] = node

    def _mapping(
        self,
        index: int,
        indent: int,
        initial: tuple[str, Node, int] | None = None,
    ) -> tuple[Mapping, int]:
        values: dict[str, Node] = {}
        start = index + 1
        if initial is not None:
            self._insert(values, initial[0], initial[1], initial[2])
        cursor = index
        while (cursor := self._next(cursor)) < len(self.lines):
            current_indent = self._indent(cursor)
            if current_indent < indent:
                break
            is_sequence = self.lines[cursor][indent:].startswith("- ")
            if current_indent != indent or is_sequence:
                if current_indent > indent:
                    raise WorkflowSyntaxError(
                        f"Line {cursor + 1}: unexpected indentation"
                    )
                break
            content = _commentless(self.lines[cursor][indent:])
            key, raw_value = _split_pair(content, cursor + 1)
            node, cursor = self._value(raw_value, cursor, indent)
            self._insert(values, key, node, cursor if cursor else 1)
        return Mapping(values, start), cursor

    def _sequence(self, index: int, indent: int) -> tuple[Sequence, int]:
        values: list[Node] = []
        start = index + 1
        cursor = index
        while (cursor := self._next(cursor)) < len(self.lines):
            current_indent = self._indent(cursor)
            is_item = self.lines[cursor][indent:].startswith("- ")
            if current_indent < indent:
                break
            if current_indent != indent or not is_item:
                if current_indent > indent:
                    raise WorkflowSyntaxError(
                        f"Line {cursor + 1}: unexpected indentation"
                    )
                break
            content = _commentless(self.lines[cursor][indent + 2 :])
            line = cursor + 1
            try:
                key, raw_value = _split_pair(content, line)
            except WorkflowSyntaxError:
                values.append(_scalar(content, line))
                cursor += 1
                continue
            node, next_index = self._value(raw_value, cursor, indent + 2)
            item, cursor = self._mapping(
                next_index,
                indent + 2,
                initial=(key, node, line),
            )
            values.append(item)
        return Sequence(values, start), cursor


def parse_workflow(text: str) -> Mapping:
    return _Parser(text).parse()


def plain(node: Node) -> Any:
    if isinstance(node, Scalar):
        return node.value
    if isinstance(node, BlockScalar):
        return {"block": node.style, "body": node.body}
    if isinstance(node, Sequence):
        return [plain(value) for value in node.values]
    return {key: plain(value) for key, value in node.values.items()}


def require_mapping(node: Node, context: str) -> Mapping:
    if not isinstance(node, Mapping):
        raise WorkflowSyntaxError(f"{context} must be a mapping")
    return node


def mapping_value(node: Mapping, key: str) -> Mapping:
    return require_mapping(node.values[key], key)


def sequence_value(node: Mapping, key: str) -> Sequence:
    value = node.values[key]
    if not isinstance(value, Sequence):
        raise WorkflowSyntaxError(f"{key} must be a sequence")
    return value


def scalar_value(node: Mapping, key: str) -> str:
    value = node.values[key]
    if not isinstance(value, Scalar):
        raise WorkflowSyntaxError(f"{key} must be a scalar")
    return value.value


def string_map(node: Mapping, key: str) -> dict[str, str]:
    mapping = mapping_value(node, key)
    return {name: scalar_value(mapping, name) for name in mapping.values}


def needs(job: Mapping) -> tuple[str, ...]:
    value = job.values.get("needs")
    if value is None:
        return ()
    if isinstance(value, Scalar):
        return (value.value,)
    if isinstance(value, Sequence):
        if any(not isinstance(item, Scalar) for item in value.values):
            raise WorkflowSyntaxError("needs entries must be scalars")
        return tuple(item.value for item in value.values)
    raise WorkflowSyntaxError("needs must be a scalar or sequence")
