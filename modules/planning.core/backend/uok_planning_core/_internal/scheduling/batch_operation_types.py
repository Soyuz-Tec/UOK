from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class AppliedBatchOperation:
    object_ids: list[str]
    direct_task_ids: set[str] = field(default_factory=set)
    cascade_dependencies: bool = False


__all__ = ["AppliedBatchOperation"]
