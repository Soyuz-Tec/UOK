# Apps Manager Backend

`apps.manager` is the required control module. Its FastAPI adapter is owned by
`uok_apps_manager.api` and mounted only through the manifest-declared
`api_router` extension.

The UOK platform core retains the generic manifest catalog, lifecycle services,
dependency enforcement, status projection, event persistence, and maintenance
reporting. The module adapter owns only authentication-aware HTTP composition.
Its protected reconciliation endpoint repairs persisted module-control drift
through the shared locked, audited lifecycle service.
