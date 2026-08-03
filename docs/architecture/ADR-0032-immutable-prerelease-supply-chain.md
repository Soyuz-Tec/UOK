# ADR-0032: Immutable Prerelease Supply Chain

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Decision scope:** Git tag validation, OCI image publication, vulnerability
scanning, software bills of materials, artifact attestations, GitHub
prereleases, and rollback metadata.

## Context

UOK already produces a deterministic source package from one resolved Git
commit and builds a Podman-compatible OCI image in CI. It did not have a
release path that bound a protected source commit to one registry digest,
scanned the final image before publication, emitted standard SBOMs, generated
verifiable provenance, or published a checksummed GitHub prerelease.

Building once and then rebuilding for publication would leave uncertainty
about whether the scanned artifact is the published artifact. Publishing
moving tags such as `latest` would also make deployment and rollback evidence
ambiguous. A tag can also move after the first validation but before a
downstream job checks it out or publishes release state. Readable Docker base
tags have the same time-of-check/time-of-use weakness unless their registry
digests are pinned.

## Decision

1. `.github/workflows/uok-release.yml` is the sole UOK prerelease workflow. It
   runs only for pushed tags matching the broad `UOK-*` trigger; executable
   validation then accepts only canonical `UOK-X.Y.Z-alpha.N`,
   `UOK-X.Y.Z-beta.N`, or `UOK-X.Y.Z-rc.N` tags.
2. The tag must resolve to the workflow source commit, be reachable from
   `origin/main`, and match `APP_VERSION`, `TARGET_VERSION`, the README
   version, and the PEP 440 project version.
3. Repository ruleset `19715390`, `UOK immutable release tags`, is an active
   prerequisite. It targets tags, includes exactly `refs/tags/UOK-*`, excludes
   nothing, applies `update` and `deletion` rules, has no bypass actors, and
   reports `current_user_can_bypass: never`. Validation, image publication,
   and release publication read back this exact control and fail closed when
   any field is different or not observable. The workflow never creates or
   repairs the ruleset.
4. Source-processing jobs check out the validated source commit, never the tag
   ref. Immediately before registry publication and again in the same shell
   boundary as GitHub release creation, the workflow resolves the protected
   remote tag through GitHub's Git API and requires its peeled commit to be
   that same reviewed commit.
5. Every Dockerfile base uses a readable tag plus a reviewed Docker Hub OCI
   index digest. The current pins are:
   `python:3.14-alpine@sha256:26730869004e2b9c4b9ad09cab8625e81d256d1ce97e72df5520e806b1709f92`
   for both Python stages and
   `node:26-alpine@sha256:e88a35be04478413b7c71c455cd9865de9b9360e1f43456be5951032d7ac1a66`
   for the frontend stage. Registry manifest-digest output and an SHA-256 of
   the raw registry index agreed for each pin. ADR-0034 records the security
   evidence and compatibility decision for the Python base change.
6. Buildx is sourced from the exact reviewed v0.35.0 commit
   `a319e5b15052cf6557ceb666eb8ff6e32380b782`. Its BuildKit daemon is
   `moby/buildkit:v0.31.2@sha256:2f5adac4ecd194d9f8c10b7b5d7bceb5186853db1b26e5abd3a657af0b7e26ec`.
   The BuildKit value is the reviewed multi-platform OCI index digest.
7. The final Linux AMD64 image is built once and loaded locally. The workflow
   immediately records its immutable Docker image ID/configuration digest.
   Label checks, Trivy, both Syft SBOMs, archive export, later registry tagging,
   and remote configuration comparison all consume that ID rather than a
   mutable local tag.
8. Trivy blocks publication on any detected `HIGH` or `CRITICAL`
   vulnerability, including vulnerabilities without a fix. Syft emits both
   SPDX JSON and CycloneDX JSON SBOMs from that same local image.
9. The publisher obtains an authenticated GHCR response and treats only HTTP
   404 as absent; HTTP 200 and every other status fail. It then tags only the
   qualified image ID, captures the digest returned by the push, fetches that
   digest, and proves its configuration digest equals the qualified image ID.
   GHCR does not document an atomic create-only push or enforced immutable
   container tags, so this check cannot eliminate a concurrent authorized
   writer race.
10. The immutable `ghcr.io/<owner>/<repository>@sha256:<digest>` reference is
   release authority. The version tag is discovery metadata only. UOK does
   not publish a `latest` tag.
11. GitHub artifact attestations bind build provenance and both SBOMs to the
   image digest. A separate provenance attestation binds the checksummed
   source package and release evidence files. Privileged jobs independently
   reject directories, links, duplicate checksum entries, missing files, and
   extra files before using `SHA256SUMS`; checksum success alone is not the
   artifact allowlist.
12. The GitHub prerelease contains the deterministic source package, SPDX and
   CycloneDX SBOMs, Trivy report, release manifest, release notes, and
   `SHA256SUMS`. The manifest records exact source, image, gate, and rollback
   metadata.
13. Workflow permissions are divided across `validate`, `qualify`,
   `publish-image`, `prepare-release-bundle`, `attest`, and `release`.
   Repository code runs only in read-only jobs. Jobs with package,
   attestation, OIDC, or contents-write authority do not check out or execute
   repository code and accept only the exact checksummed artifact set.
   External actions are pinned to reviewed commits.
14. Repository-level immutable releases must be enabled before the first
    publication. The final writer re-reads that setting immediately before
    creation, then reads the published release back and requires
    `immutable: true` and the exact asset set. Repository files cannot enforce
    the administration setting by themselves.

## Consequences

- A successful prerelease has one reviewable chain from tag to source commit,
  source archive, scanned image, registry digest, SBOMs, attestations, and
  release assets.
- Consumers and deployment automation must use the digest, not the version
  tag. Rollback requires the previously approved digest from the target
  environment's deployment record.
- An existing version tag or release fails closed. Replacing an artifact under
  the same version is not a recovery mechanism.
- GHCR's version tag is not technically immutable and its absence check is not
  atomic. The residual race is an external platform limitation. Package-write
  access must remain tightly restricted, and consumers must verify and deploy
  the recorded digest.
- A moved or deleted remote tag fails the nearest publication boundary even
  though read-only jobs already have the reviewed commit checked out. The
  active no-bypass tag ruleset prevents authorized workflow participants from
  moving or deleting matching tags during publication.
- Base-image updates are intentional source changes reviewed through
  Dependabot or an equivalent digest-refresh PR; a readable tag never floats
  during an accepted build.
- A failure after the image is pushed but before the release is published may
  leave an unattached registry artifact. Operators must preserve it for
  investigation and publish a corrected new version; the workflow will not
  overwrite it.
- The first implementation publishes Linux AMD64 only. Multi-platform
  publication requires a later decision that preserves scan-to-digest
  identity for every platform and the image index.
- GitHub/Sigstore attestations improve provenance but do not claim SLSA,
  production readiness, or independent certification.

## Alternatives Rejected

- **Build once for scanning and again for publication:** rejected because the
  published bytes would not be the scanned bytes.
- **Publish `latest` plus semantic tags:** rejected because moving tags weaken
  deployment and rollback evidence.
- **Generate SBOMs from the source tree:** rejected as the primary evidence
  because it omits operating-system and final-image package truth.
- **Use unpinned action tags:** rejected because an upstream tag could move
  without a reviewed UOK source change.
- **Treat a version tag as immutable after a successful absence check:**
  rejected because GHCR exposes neither an atomic create-only tag push nor a
  repository tag-immutability control.
- **Check out the tag again in downstream jobs:** rejected because the tag
  could move after initial validation and silently change the build or release
  input.
- **Use readable base-image tags without digests:** rejected because a
  registry tag can resolve to different operating-system or runtime bytes
  between review and build.
- **Publish before vulnerability scanning:** rejected because a failed gate
  would already have exposed the versioned artifact.

## Validation

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

The live tag workflow remains unexecuted until an approved canonical
prerelease tag is intentionally pushed.
