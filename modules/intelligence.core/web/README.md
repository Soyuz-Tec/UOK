# intelligence.core web surface

**Status:** Active module-owned frontend surface.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Purpose:** Present tenant-scoped Shipment Readiness signals, including
bounded document-expiry attention, as a deterministic read-only list-and-detail
workspace.

**Scope:** React components, HTTP reads, filters, session-ephemeral saved views,
visible explicit-as-of UTC evaluation, localization, accessible keyboard
selection, and module-owned CSS under `modules/intelligence.core/web/src`.
Frontend tests live under `modules/intelligence.core/tests/web`.

The canonical entry is
`modules/intelligence.core/web/src/moduleSurface.tsx`. It consumes only the
neutral `ModuleSurfaceHostContext`; it does not import another module's web
implementation or issue foreign-module or mutation requests. Owner navigation
is restricted to a same-origin Shipment workspace path.

The workbench labels and sends an explicit **As of (UTC)** date on every read,
shows the inclusive 30-day through-date, and treats missing expiry dates as
informational. It never infers a tenant time zone from browser locale or calls
Shipment/Compliance APIs directly.

Validate with:

```powershell
Push-Location web
npm test -- ../modules/intelligence.core/tests/web
npm run build:static
Pop-Location
```
