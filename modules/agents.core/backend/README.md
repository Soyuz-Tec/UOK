# agents.core backend

The backend owns Pydantic contracts, generated-plan policy, runbook and run services, read APIs, command handlers, role grants, evidence hashing, and four private SQLAlchemy mappings.

Runtime composition is exposed only through `uok_agents_core.public_api`. Implementation remains below `_internal`; the only Host imports are the exact `get_db` and `current_actor` seams in the FastAPI adapter.
