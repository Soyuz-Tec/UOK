from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from uok_planning_core._internal.delivery.api_support import require_planning_read
from uok_planning_core._internal.portfolio_audit.portfolio import planning_portfolio_read_model
from uok_planning_core._internal.portfolio_audit.portfolio_contracts import PlanningPortfolioResponse, PlanningProjectStatusFilter
from uok.db import get_db
from uok.security import Actor, current_actor

router = APIRouter(prefix="/api/planning", tags=["planning-portfolio"])


@router.get("/portfolio", response_model=PlanningPortfolioResponse)
def planning_portfolio(
    response: Response,
    query: str = Query(default="", max_length=80),
    status: PlanningProjectStatusFilter = Query(default=""),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=10_000),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    require_planning_read(db, actor)
    result = planning_portfolio_read_model(db, actor, query.strip(), status.strip(), limit, offset)
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Authorization"
    response.headers["Server-Timing"] = f"planning-portfolio;dur={result['diagnostics']['elapsed_ms']}"
    return result
