# reports.core

**Status:** Active optional capability module.

**Current candidate:** `UOK-3.1.0-alpha.3`

`reports.core` is the optional UOK secure report-artifact capability for generation, storage, integrity metadata, audit, download, and deletion.

Backend and ORM ownership live under `modules/reports.core/backend`; module migrations live under `modules/reports.core/migrations`; its typed report client lives under `modules/reports.core/web/src`; behavior and frontend client tests live under `modules/reports.core/tests`; candidate proof lives under `modules/reports.core/verify`.

Reports currently declares no workbench surface. Planning uses the Reports-owned client only when the module is available, while local Timeline SVG export remains Planning-owned.
