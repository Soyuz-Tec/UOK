from __future__ import annotations

import re

from uok.kernel.command_contracts import CommandPreconditionError

from .models import CommunicationThread

STRONG_THREAD_ETAG = re.compile(r'^"communication-thread:([0-9a-f-]{36}):v([1-9][0-9]*)"$')


def communication_thread_etag(thread: CommunicationThread) -> str:
    return f'"communication-thread:{thread.id}:v{thread.revision}"'


def require_thread_precondition(thread: CommunicationThread, supplied: str | None) -> None:
    current_etag = communication_thread_etag(thread)
    reload_url = f"/api/communications/threads/{thread.id}"
    if thread.status == "archived":
        reload_url += "?include_archived=true"
    common = {
        "current_revision": int(thread.revision),
        "current_etag": current_etag,
        "object_ids": [thread.id],
        "reload_url": reload_url,
    }
    if supplied is None or not supplied.strip():
        raise CommandPreconditionError(
            code="precondition_required",
            message="A current strong communication-thread ETag is required for this lifecycle change.",
            status_code=428,
            repair="Reload the thread, review its current lifecycle state, then open and confirm the action again.",
            **common,
        )
    match = STRONG_THREAD_ETAG.fullmatch(supplied)
    if not match or match.group(1) != thread.id:
        raise CommandPreconditionError(
            code="invalid_precondition",
            message="If-Match must contain the exact strong ETag for this communication thread.",
            status_code=400,
            repair="Use the ETag from the latest exact thread response; wildcards, weak tags, lists, and another thread's ETag are rejected.",
            **common,
        )
    if supplied != current_etag:
        raise CommandPreconditionError(
            code="stale_precondition",
            message="The communication thread changed after it was loaded.",
            status_code=412,
            repair="Review the reloaded thread, then explicitly open and confirm Delete or Restore again.",
            **common,
        )


__all__ = ["communication_thread_etag", "require_thread_precondition"]
