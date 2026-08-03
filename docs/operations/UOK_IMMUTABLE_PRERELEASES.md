# UOK Immutable Prereleases

**Status:** Mandatory prerelease operations guide.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Applies to:** Exact Git tags, GHCR image publication, vulnerability reports,
SBOMs, GitHub artifact attestations, release assets, verification, and
rollback handoff.

## Purpose

This guide operates the decision in
`docs/architecture/ADR-0032-immutable-prerelease-supply-chain.md`. The release
workflow publishes evidence for an approved UOK prerelease; it does not deploy
the image or assert production readiness.

## Reviewed Base-Image Pins

Every Dockerfile stage retains its readable Docker Hub tag and pins the
registry OCI index digest:

| Stages | Reviewed input |
|---|---|
| OpenAPI generation and final runtime | `python:3.14-alpine@sha256:26730869004e2b9c4b9ad09cab8625e81d256d1ce97e72df5520e806b1709f92` |
| Frontend build | `node:26-alpine@sha256:e88a35be04478413b7c71c455cd9865de9b9360e1f43456be5951032d7ac1a66` |

These values were resolved from Docker Hub on 2026-07-25. For each tag,
`docker buildx imagetools inspect <image> --format '{{.Manifest.Digest}}'`
matched an independently calculated SHA-256 of the bytes returned by
`docker buildx imagetools inspect <image> --raw`.

The Python Alpine pin replaced the Debian slim pin after the exact hosted
candidate reported 23 release-blocking Debian OS-package findings with no
fixed versions. The same Trivy 0.70 database found zero `HIGH` or `CRITICAL`
findings in the reviewed Alpine input. ADR-0034 records the alternatives,
compatibility gates, and rollback boundary.

Refresh a pin only in a reviewed source change. Retain the readable tag,
confirm the new raw registry digest, run the release-policy tests, and rebuild
without publishing. The static policy rejects missing or unreviewed pins.

Buildx is also immutable input. The workflow builds v0.35.0 from commit
`a319e5b15052cf6557ceb666eb8ff6e32380b782`; it does not resolve a moving
Buildx tag. BuildKit is pinned to the reviewed multi-platform OCI index
`moby/buildkit:v0.31.2@sha256:2f5adac4ecd194d9f8c10b7b5d7bceb5186853db1b26e5abd3a657af0b7e26ec`.

## One-Time Repository Prerequisite

Immutable releases were enabled and read back for `Soyuz-Tec/UOK` on
2026-07-24. Verify the setting again before the first publication through
GitHub's current repository API:

```powershell
gh api `
  -H "Accept: application/vnd.github+json" `
  -H "X-GitHub-Api-Version: 2026-03-10" `
  repos/Soyuz-Tec/UOK/immutable-releases
```

A successful response reports `enabled: true`. The following mutation is only
for a future repository or a verified disabled state; do not run it merely
because this runbook contains the command:

```powershell
gh api --method PUT `
  -H "Accept: application/vnd.github+json" `
  -H "X-GitHub-Api-Version: 2026-03-10" `
  repos/Soyuz-Tec/UOK/immutable-releases
```

The active release-tag ruleset was also read back on 2026-07-24. Do not
recreate it. Verify exact ruleset ID `19715390`:

```powershell
gh api `
  -H "Accept: application/vnd.github+json" `
  -H "X-GitHub-Api-Version: 2026-03-10" `
  "repos/Soyuz-Tec/UOK/rulesets/19715390?includes_parents=true"
```

The response must report:

- name `UOK immutable release tags`;
- target `tag` and enforcement `active`;
- include exactly `refs/tags/UOK-*` and no exclusions;
- rules exactly `update` and `deletion`;
- an empty `bypass_actors` array; and
- `current_user_can_bypass: never`.

GitHub omits `bypass_actors` from callers that cannot observe the complete
ruleset. The workflow intentionally fails closed in that case; use a
credential with sufficient read visibility rather than weakening the check.
Also require the normal protected-main CI and OpenSSF Scorecard checks. GHCR
must allow this repository's `GITHUB_TOKEN` to publish its linked package.

## Pre-Tag Gate

1. Start from the reviewed, protected `main` commit.
2. Complete `TechnologyAudit`, `EngineeringEvidence`, `Audit`, and `Verify`.
3. Confirm GitHub required checks and independent approval.
4. Confirm `src/uok/__init__.py`, `pyproject.toml`, and `README.md` describe the
   same prerelease.
5. Run the nonpublishing release-policy check:

```powershell
python scripts/validate_release_workflow.py
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD = "1"
python -m pytest --noconftest -q -p no:cacheprovider `
  tests/test_release_identity.py `
  tests/test_remote_release_tag.py `
  tests/test_release_evidence.py `
  tests/test_release_tag_ruleset.py `
  tests/test_release_workflow_policy.py
```

This check does not push an image, create a tag, or create a release.

## Tag And Start The Workflow

Use an annotated canonical tag only after the pre-tag gate passes:

```powershell
git switch main
git pull --ff-only origin main
git tag -a UOK-3.1.0-alpha.3 -m "UOK 3.1.0-alpha.3 prerelease"
git push origin refs/tags/UOK-3.1.0-alpha.3
```

The workflow rejects a tag that does not:

- use `UOK-X.Y.Z-alpha.N`, `UOK-X.Y.Z-beta.N`, or `UOK-X.Y.Z-rc.N`;
- match all checked-in version authorities;
- resolve to the workflow source commit;
- remain reachable from `origin/main`; or
- retain the exact no-bypass release-tag ruleset and immutable-release setting;
  or
- pass the fail-closed GHCR absence check and name a new GitHub release.

Do not push a tag merely to test the workflow. Use the static policy validator
and focused tests for dry-run evidence.

## Publication Sequence

The workflow performs these stages in order:

1. Validate tag, commit, source versions, main ancestry, exact tag ruleset,
   immutable-release setting, and workflow policy.
2. In the read-only `qualify` job, check out the validated commit; do not check
   out the tag.
3. Build the final Linux AMD64 image once with commit-pinned Buildx and
   digest-pinned BuildKit/base images. Capture its Docker image
   ID/configuration digest immediately.
4. Verify OCI labels and scan that immutable image ID with Trivy. Any `HIGH` or
   `CRITICAL` finding blocks
   publication.
5. Generate SPDX JSON and CycloneDX JSON SBOMs from that image ID.
6. Build the deterministic source package from the validated commit.
7. Save that exact image ID plus all evidence, checksum the set, and cross the
   artifact boundary.
8. In `publish-image`, verify the checksums, load the archive, and require the
   loaded ID to equal the qualification output before obtaining GHCR
   credentials.
9. Re-read ruleset `19715390`, resolve the protected remote tag to the reviewed
   commit, and classify the authenticated GHCR tag lookup: 404 alone may
   proceed; 200 or any other status fails.
10. Tag only the qualified image ID, push it, capture the returned manifest
    digest, and prove the digest's configuration equals the qualified ID.
11. In read-only `prepare-release-bundle`, generate the manifest, checksums,
    release notes, and rollback boundary.
12. In `attest`, execute no repository code; reject non-file entries and any
    file not listed exactly once by `SHA256SUMS`, verify checksums, and attest
    the image digest, both SBOMs, and release files.
13. In `release`, execute no repository code; repeat the exact file-set and
    checksum gate, verify manifest identity, re-read the ruleset, and refuse an
    existing release.
14. In one shell boundary, resolve the protected tag to the reviewed commit and
    re-read immutable-release enforcement immediately before creating the
    GitHub prerelease. Read the published release back and require
    `immutable: true` plus the exact expected asset-name set.

The workflow never publishes `latest` and never rebuilds after scanning.

## Required Release Assets

Every prerelease contains:

| Asset | Evidence |
|---|---|
| `UOK-<version>-source.zip` | Deterministic tracked source plus `UOK_PACKAGE_MANIFEST.json` |
| `uok.spdx.json` | SPDX JSON SBOM for the final image |
| `uok.cyclonedx.json` | CycloneDX JSON SBOM for the final image |
| `uok-trivy.json` | Passing blocking vulnerability scan |
| `UOK_RELEASE_MANIFEST.json` | Tag, source commit, image and configuration digests, artifact hashes, controls, gate, and rollback policy |
| `SHA256SUMS` | Exact SHA-256 coverage for every other release file |
| `RELEASE_NOTES.md` | Digest-first verification and rollback instructions |

## Consumer Verification

Download and verify the release:

```powershell
gh release verify UOK-3.1.0-alpha.3 --repo Soyuz-Tec/UOK
gh release download UOK-3.1.0-alpha.3 --repo Soyuz-Tec/UOK --dir .\uok-release
Set-Location .\uok-release
Get-Content SHA256SUMS
```

On a system with `sha256sum`, verify the entire bundle:

```bash
sha256sum --check SHA256SUMS
```

Read the digest from `UOK_RELEASE_MANIFEST.json`, authenticate to GHCR when
required, then verify provenance and pull by digest:

```bash
gh attestation verify \
  oci://ghcr.io/soyuz-tec/uok@sha256:<digest> \
  --repo Soyuz-Tec/UOK \
  --signer-workflow Soyuz-Tec/UOK/.github/workflows/uok-release.yml \
  --source-ref refs/tags/UOK-3.1.0-alpha.3
docker pull ghcr.io/soyuz-tec/uok@sha256:<digest>
```

## Rollback

Deployment records must retain the previously approved image digest. To roll
back:

1. Stop promotion of the new digest.
2. Redeploy the previous `ghcr.io/...@sha256:<digest>`.
3. Apply only a separately reviewed, backward-compatible database procedure.
4. Verify `/health`, readiness, database compatibility, and operator access.
5. Record the rejected and restored digests plus the incident reason.

Never move the Git tag, overwrite the version tag, or introduce `latest` as a
rollback shortcut.

## GHCR Residual Boundary

GHCR does not document a package setting that makes container tags immutable,
nor a conditional create-only manifest push. The authenticated 404 check is
therefore fail-closed but not atomic with the following push. The release
manifest records this limitation explicitly:

- `version_tag_is_authority: false`;
- `tag_immutability_enforced: false`;
- `atomic_create_supported: false`; and
- `digest_is_authority: true`.

Restrict package-write access to the release workflow. Treat the published
version tag only as discovery metadata and always verify, deploy, and roll back
by the manifest digest. A registry with an enforced immutable-tag or
compare-and-set policy is required to eliminate this external race fully.

## Failure Handling

- Before registry publication: fix the reviewed source and use a new canonical
  version after the full gate passes.
- After registry publication but before GitHub release publication: preserve
  the digest and workflow evidence for investigation. Do not overwrite the
  version tag. Repair the pipeline and issue a new prerelease version.
- After immutable release publication: release assets and the associated tag
  are permanent. Use a new version for corrections.
- A scanner database outage, attestation outage, missing permission, checksum
  mismatch, or absent asset is a release failure, not a warning.

## Validation Boundary

The checked-in workflow and local tests prove policy shape and deterministic
metadata handling. Only an intentionally pushed approved tag can prove GHCR
publication, GitHub attestation, and repository release immutability end to
end. Do not claim that hosted proof before it exists.
