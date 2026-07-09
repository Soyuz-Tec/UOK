from __future__ import annotations

from graphlib import CycleError, TopologicalSorter
from typing import Iterable, Protocol


class DependencyLike(Protocol):
    predecessor_task_id: str
    successor_task_id: str


def dependency_order(task_ids: Iterable[str], dependencies: Iterable[DependencyLike]) -> list[str] | None:
    ids = set(task_ids)
    sorter = TopologicalSorter()
    for task_id in ids:
        sorter.add(task_id)
    for dep in dependencies:
        if dep.predecessor_task_id in ids and dep.successor_task_id in ids:
            sorter.add(dep.successor_task_id, dep.predecessor_task_id)
    try:
        return list(sorter.static_order())
    except CycleError:
        return None
