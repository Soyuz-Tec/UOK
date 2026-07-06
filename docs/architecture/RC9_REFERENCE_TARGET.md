# UOK V3.0.0-rc9 Target

**Target version:** `UOK-3.0.0-rc9`

RC9 is the production-readiness hardening candidate. It keeps the RC8 React + TypeScript + Vite foundation and adds executable release evidence around migrations, PostgreSQL 18, transaction proof, and the first CRM business-module slice.

## Objective

RC9 must prove that UOK can run as a disciplined modular monolith with:

- Ordered migration registry checks and applied schema-version evidence.
- GitHub CI using PostgreSQL 18 plus backend tests, source-boundary checks, OpenAPI generation, frontend tests, and frontend build.
- Product-neutral transaction evidence that proves a contacts-backed cargo transaction, closed lifecycle, role denial, validation failure, workflow evidence, and governance seed.
- A reusable CRM Basic module that starts the next business capability without duplicating Contacts data.
- A maintainable source layout that keeps route composition, command dispatch, frontend hooks, CSS, and tests split by responsibility before new modules are added.
- Strict source-boundary violation count of `0`.

## Candidate Gates

RC9 is complete only when these gates pass:

- `python -m compileall -q src`
- `python -m pytest -q`
- `npm run test`
- `npm run build:static`
- `scripts/verify_uok_candidate.ps1`

## Comparison Record

Future builds should compare themselves against this RC9 baseline:

- Migration discipline remains executable and schema-version aware.
- PostgreSQL 18 remains the declared and tested production-shaped database runtime.
- CRM reuses Contacts parties and relationships instead of defining its own customer/contact store.
- Product-specific source stays inside product modules; core transaction evidence remains product-neutral.
- Architecture alignment, naming discipline, language-stack policy, and UI policy remain active verifier gates.
- Source-size and responsibility scans remain active architecture guidance so new code stays within reviewable limits and does not force avoidable rewrites later.
