# agents.core tests

Module-owned tests cover request and plan contracts, DAG and scope validation, lifecycle and permissions, approval and override gates, low-risk informational policy, recovery re-entry, evidence hashes, tenant isolation, disabled-module behavior, manifest ownership, migration declarations, and public composition hooks.

The tests deliberately prove that a generated command proposal does not mutate the target business module.
