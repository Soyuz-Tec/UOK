from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from uok.host.database import get_db
from uok.host.security import current_actor
from uok.kernel.module_runtime import ensure_module_operational
from uok.kernel.security import Actor, require_permission

from .schemas import ProductDefinitionResponse, ProductNameHistoryResponse
from .service import get_product_definition, list_product_definitions, list_product_name_history, product_definition_response

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/definitions", response_model=list[ProductDefinitionResponse])
def definitions(
    include_archived: bool = False,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    _require_read_access(db, actor)
    return list_product_definitions(db, actor, include_archived)


@router.get("/definitions/{product_definition_id}", response_model=ProductDefinitionResponse)
def definition(
    product_definition_id: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    _require_read_access(db, actor)
    try:
        return product_definition_response(get_product_definition(db, actor, product_definition_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc)}) from exc


@router.get(
    "/definitions/{product_definition_id}/name-history",
    response_model=list[ProductNameHistoryResponse],
)
def name_history(
    product_definition_id: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    _require_read_access(db, actor)
    try:
        return list_product_name_history(db, actor, product_definition_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc)}) from exc


def _require_read_access(db: Session, actor: Actor) -> None:
    try:
        require_permission(actor, "products.read")
        ensure_module_operational(db, actor.organization_id, "product.master")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
