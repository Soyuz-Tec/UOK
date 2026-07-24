from __future__ import annotations

import heapq
from typing import Any


class ModuleOrderError(ValueError):
    """Raised when a module catalog cannot be ordered deterministically."""


def dependency_order(manifests: dict[str, dict[str, Any]]) -> list[str]:
    dependents: dict[str, list[str]] = {name: [] for name in manifests}
    indegree = {name: 0 for name in manifests}
    for module_name, manifest in manifests.items():
        required = manifest.get("required")
        if not isinstance(required, bool):
            raise ModuleOrderError(f"{module_name} required must be a boolean")
        for dependency in manifest.get("dependencies", []):
            if dependency not in manifests:
                raise ModuleOrderError(
                    f"{module_name} declares unknown dependency {dependency}"
                )
            if dependency == module_name:
                raise ModuleOrderError(f"{module_name} cannot depend on itself")
            dependents[dependency].append(module_name)
            indegree[module_name] += 1

    ready = [
        (_priority(name, manifests), name)
        for name, count in indegree.items()
        if count == 0
    ]
    heapq.heapify(ready)
    ordered: list[str] = []
    while ready:
        _, module_name = heapq.heappop(ready)
        ordered.append(module_name)
        for dependent in sorted(dependents[module_name]):
            indegree[dependent] -= 1
            if indegree[dependent] == 0:
                heapq.heappush(
                    ready,
                    (_priority(dependent, manifests), dependent),
                )
    if len(ordered) != len(manifests):
        cycle = ", ".join(
            sorted(name for name, count in indegree.items() if count > 0)
        )
        raise ModuleOrderError(
            f"module dependency cycle prevents ordering: {cycle}"
        )
    return ordered


def _priority(
    module_name: str,
    manifests: dict[str, dict[str, Any]],
) -> tuple[int, str]:
    return (0 if manifests[module_name]["required"] else 1, module_name.casefold())
