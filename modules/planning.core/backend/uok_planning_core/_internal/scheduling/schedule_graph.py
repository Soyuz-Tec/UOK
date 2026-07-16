from __future__ import annotations

from collections import defaultdict
from heapq import heapify, heappop, heappush
from typing import Iterable, Protocol


class DependencyLike(Protocol):
    predecessor_task_id: str
    successor_task_id: str


def dependency_order(task_ids: Iterable[str], dependencies: Iterable[DependencyLike]) -> list[str] | None:
    ids = set(task_ids)
    indegree = {task_id: 0 for task_id in ids}
    successors: dict[str, set[str]] = defaultdict(set)
    for dep in dependencies:
        predecessor = dep.predecessor_task_id
        successor = dep.successor_task_id
        if predecessor in ids and successor in ids and successor not in successors[predecessor]:
            successors[predecessor].add(successor)
            indegree[successor] += 1
    ready = [task_id for task_id, count in indegree.items() if count == 0]
    heapify(ready)
    ordered: list[str] = []
    while ready:
        task_id = heappop(ready)
        ordered.append(task_id)
        for successor in sorted(successors[task_id]):
            indegree[successor] -= 1
            if indegree[successor] == 0:
                heappush(ready, successor)
    return ordered if len(ordered) == len(ids) else None
