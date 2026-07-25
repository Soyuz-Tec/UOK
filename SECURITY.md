# UOK Security Policy

**Status:** Active security reporting policy
**Target:** UOK 3.1.0 alpha
**Purpose:** Provide a private, evidence-preserving path for vulnerability reports.
**Scope:** UOK source, dependencies, build workflows, container images, and deployment definitions.

## Supported Versions

UOK is currently an alpha project. Only the current `main` branch and the most
recent GitHub prerelease, when one exists, receive security fixes. Historical
baseline tags are retained as evidence and are not supported releases.

## Reporting a Vulnerability

Use GitHub's **Report a vulnerability** action in the repository Security tab
to open a private vulnerability report. Include:

- affected commit, tag, endpoint, module, or workflow;
- impact and required preconditions;
- reproduction steps or a minimal proof of concept;
- whether credentials, personal data, or tenant boundaries may be affected;
- suggested remediation, if known.

Do not include secrets, production personal data, or destructive payloads.
Do not open a public issue until the maintainers confirm that coordinated
disclosure is safe.

## Response Expectations

The maintainers will:

1. acknowledge a complete report within five business days;
2. preserve the report and remediation discussion privately;
3. validate severity and affected versions;
4. prepare tests, remediation, rollback guidance, and release evidence;
5. coordinate disclosure after a fixed version is available or the risk is
   otherwise contained.

These are response targets, not a bug-bounty promise or service-level
agreement.

## Security Boundaries

Local candidate evidence is not production certification. A security-sensitive
release must pass repository security checks, dependency and image audits,
tenant-isolation verification, required review, and the release workflow
defined by the active UOK engineering system.

## Validation

The repository community-profile check should discover this file. Internal
links and security workflow references are checked by the normal UOK
documentation and technology audits.
