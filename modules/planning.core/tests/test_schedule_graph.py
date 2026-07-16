from dataclasses import dataclass
from pathlib import Path
import sys

BACKEND = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from uok_planning_core._internal.scheduling.schedule_graph import dependency_order


@dataclass(frozen=True)
class Dependency:
    predecessor_task_id: str
    successor_task_id: str


def test_dependency_order_uses_topological_sort_for_transitive_links() -> None:
    order = dependency_order(["review", "design", "build"], [Dependency("design", "build"), Dependency("build", "review")])

    assert order is not None
    assert order.index("design") < order.index("build") < order.index("review")


def test_dependency_order_returns_none_for_cycles() -> None:
    assert dependency_order(["a", "b"], [Dependency("a", "b"), Dependency("b", "a")]) is None
