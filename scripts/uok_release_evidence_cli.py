from __future__ import annotations

import argparse
import json
from pathlib import Path

from uok_release_evidence import (
    ReleaseEvidenceError,
    create_release_evidence,
    verify_release_evidence,
)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create or verify immutable UOK release evidence."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    create = subparsers.add_parser("create")
    create.add_argument("--output-directory", type=Path, required=True)
    create.add_argument("--tag", required=True)
    create.add_argument("--version", required=True)
    create.add_argument("--source-commit", required=True)
    create.add_argument("--github-repository", required=True)
    create.add_argument("--image-repository", required=True)
    create.add_argument("--image-digest", required=True)
    create.add_argument("--image-config-digest", required=True)
    create.add_argument("--source-package", type=Path, required=True)
    create.add_argument("--spdx-sbom", type=Path, required=True)
    create.add_argument("--cyclonedx-sbom", type=Path, required=True)
    create.add_argument("--vulnerability-report", type=Path, required=True)
    verify = subparsers.add_parser("verify")
    verify.add_argument("--directory", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == "verify":
            result = verify_release_evidence(args.directory)
        else:
            paths = create_release_evidence(
                output_directory=args.output_directory,
                tag=args.tag,
                version=args.version,
                source_commit=args.source_commit,
                github_repository=args.github_repository,
                image_repository=args.image_repository,
                image_digest=args.image_digest,
                image_config_digest=args.image_config_digest,
                source_package=args.source_package,
                spdx_sbom=args.spdx_sbom,
                cyclonedx_sbom=args.cyclonedx_sbom,
                vulnerability_report=args.vulnerability_report,
            )
            result = {name: str(path) for name, path in paths.items()}
    except ReleaseEvidenceError as exc:
        parser.error(str(exc))
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
