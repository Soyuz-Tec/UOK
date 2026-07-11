# contacts.core

**Status:** Active optional capability module.

**Current candidate:** `UOK-3.1.0-alpha.3`

`contacts.core` is the optional UOK Party and Contacts capability for people, organizations, grouping, relationships, review workflows, quality signals, and derived business-intelligence profiles.

Backend and ORM ownership live under `modules/contacts.core/backend`; module migrations live under `modules/contacts.core/migrations`; production React, app hooks, and CSS live under `modules/contacts.core/web/src`; behavior and frontend tests live under `modules/contacts.core/tests`; candidate proof lives under `modules/contacts.core/verify`.

Other modules consume actor-authorized Party references through typed boundaries. Contacts remains the canonical Party owner, and derived profiles do not become a hidden source of truth.
