# Apps Manager Web

The Apps Manager UI is implemented in `web/src/features/apps` and governed by
this module manifest. It presents runtime status separately from manifest
maturity and exposes actions only when the lifecycle and operation flags allow
them. Planned modules remain visible without install or upgrade actions.
Persisted status or manifest-snapshot drift exposes a dedicated Reconcile
action while normal lifecycle actions remain suppressed.

Apps Manager is a required bootstrap control surface, so it remains part of the
shared shell rather than an optional module surface registry entry.
