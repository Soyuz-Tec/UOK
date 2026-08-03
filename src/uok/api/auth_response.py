from __future__ import annotations

from ..host.security import issue_token
from ..kernel.security import Actor
from ..kernel_models import Membership, User
from .auth_policy import is_valid_email


def session_user_payload(user: User, membership: Membership) -> dict[str, str | None]:
    return {
        "username": user.username,
        "display_name": user.display_name,
        "email": user.username if is_valid_email(user.username) else None,
        "role": membership.role,
    }


def session_response(
    user: User,
    membership: Membership,
    user_payload: dict[str, str | None],
) -> dict[str, object]:
    actor = Actor(
        user_id=user.id,
        username=user.username,
        organization_id=membership.organization_id,
        role=membership.role,
    )
    return {
        "access_token": issue_token(actor),
        "user": user_payload,
    }
