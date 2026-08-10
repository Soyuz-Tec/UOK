# agents.core migrations

`001_agents_core.sql` owns tenant-scoped runbooks, runs, approvals, and hash-addressed evidence. Disable or uninstall retains these governance records; a future purge/anonymization capability requires explicit policy, authorization, audit, and migration coverage.
