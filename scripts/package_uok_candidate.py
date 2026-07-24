from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import subprocess
import unicodedata
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Sequence


MANIFEST_PATH = "UOK_PACKAGE_MANIFEST.json"
REGULAR_FILE_MODES = {"100644", "100755"}
LOCAL_OR_GENERATED_PARTS = set(
    ".git .pytest_cache .venv __pycache__ coverage data dist htmlcov node_modules var".split()
)
SENSITIVE_FILENAMES = set(
    (
        ".env credentials.json credentials.yaml credentials.yml id_dsa id_ecdsa id_ed25519 "
        "id_rsa secret.json secret.yaml secret.yml secrets.json secrets.yaml secrets.yml"
    ).split()
)
SAFE_ENV_TEMPLATE_FILENAMES = {".env.example", ".env.sample", ".env.template"}
SENSITIVE_OR_LOCAL_SUFFIXES = set(
    ".db .jks .kdbx .key .p12 .pem .pfx .pyc .pyo .sqlite .sqlite3 .tsbuildinfo .zip".split()
)
WINDOWS_RESERVED_NAMES = {
    "aux",
    "con",
    "conin$",
    "conout$",
    "nul",
    "prn",
    "com0",
    "lpt0",
    *(f"com{index}" for index in range(1, 10)),
    *(f"lpt{index}" for index in range(1, 10)),
}
WINDOWS_INVALID_FILENAME_CHARACTERS = set('<>"|?*')
VERSION_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._+-]{0,127}\Z")


class PackagingError(RuntimeError):
    """Raised when a source commit cannot be packaged safely."""


@dataclass(frozen=True)
class GitFile:
    path: str
    object_id: str
    mode: str


def _git_command(root: Path, *args: str, input_bytes: bytes | None = None) -> bytes:
    try:
        result = subprocess.run(
            ["git", "--no-replace-objects", "-C", str(root), *args],
            check=False,
            input=input_bytes,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except FileNotFoundError as exc:
        raise PackagingError("Git is required to build a UOK source package") from exc
    if result.returncode != 0:
        detail = result.stderr.decode("utf-8", errors="replace").strip()
        raise PackagingError(f"Git command failed ({' '.join(args)}): {detail or 'unknown error'}")
    return result.stdout


def resolve_source_commit(root: Path, source_ref: str = "HEAD") -> str:
    if not source_ref or source_ref.startswith("-"):
        raise PackagingError("Source ref must be a non-option Git revision")
    resolved = _git_command(
        root,
        "rev-parse",
        "--verify",
        "--end-of-options",
        f"{source_ref}^{{commit}}",
    ).decode("ascii", errors="strict").strip()
    if not re.fullmatch(r"[0-9a-fA-F]{40,64}", resolved):
        raise PackagingError(f"Git returned an invalid source commit id: {resolved!r}")
    return resolved.lower()


def validate_archive_path(path: str) -> None:
    if not path or path.startswith("/") or "\\" in path or ":" in path:
        raise PackagingError(f"Unsafe archive path: {path!r}")
    parts = path.split("/")
    if any(not part or part in {".", ".."} for part in parts):
        raise PackagingError(f"Unsafe archive path: {path!r}")
    if PurePosixPath(path).as_posix() != path:
        raise PackagingError(f"Non-canonical archive path: {path!r}")
    if unicodedata.normalize("NFC", path) != path:
        raise PackagingError(f"Unicode-normalization-unsafe archive path: {path!r}")

    for part in parts:
        if any(ord(character) < 32 or ord(character) == 127 for character in part):
            raise PackagingError(f"Control character in archive path: {path!r}")
        if part.endswith((" ", ".")):
            raise PackagingError(f"Windows-unsafe archive path: {path!r}")
        if any(character in WINDOWS_INVALID_FILENAME_CHARACTERS for character in part):
            raise PackagingError(f"Windows-unsafe archive path: {path!r}")
        device_stem = unicodedata.normalize("NFKC", part.split(".", maxsplit=1)[0]).casefold()
        if device_stem in WINDOWS_RESERVED_NAMES:
            raise PackagingError(f"Windows-reserved archive path: {path!r}")

    folded_parts = [part.casefold() for part in parts]
    if any(part in LOCAL_OR_GENERATED_PARTS for part in folded_parts):
        raise PackagingError(f"Local or generated path cannot be packaged: {path!r}")

    filename = folded_parts[-1]
    if filename == MANIFEST_PATH.casefold():
        raise PackagingError(f"Source commit uses reserved package path: {path!r}")
    if filename in SENSITIVE_FILENAMES:
        raise PackagingError(f"Sensitive path cannot be packaged: {path!r}")
    if filename.startswith(".env.") and filename not in SAFE_ENV_TEMPLATE_FILENAMES:
        raise PackagingError(f"Sensitive environment path cannot be packaged: {path!r}")
    if any(filename.endswith(suffix) for suffix in SENSITIVE_OR_LOCAL_SUFFIXES):
        raise PackagingError(f"Sensitive or local file cannot be packaged: {path!r}")


def list_commit_files(root: Path, source_commit: str) -> list[GitFile]:
    tree = _git_command(root, "ls-tree", "-r", "-z", "--full-tree", source_commit)
    files: list[GitFile] = []
    folded_paths: dict[str, str] = {}
    for raw_record in tree.split(b"\0"):
        if not raw_record:
            continue
        try:
            raw_metadata, raw_path = raw_record.split(b"\t", maxsplit=1)
            mode_bytes, type_bytes, object_id_bytes = raw_metadata.split(b" ", maxsplit=2)
            mode = mode_bytes.decode("ascii")
            object_type = type_bytes.decode("ascii")
            object_id = object_id_bytes.decode("ascii")
            path = raw_path.decode("utf-8", errors="strict")
        except (UnicodeDecodeError, ValueError) as exc:
            raise PackagingError("Source commit contains an unpackageable Git tree entry") from exc

        validate_archive_path(path)
        if object_type != "blob" or mode not in REGULAR_FILE_MODES:
            raise PackagingError(
                f"Non-regular Git entry cannot be packaged: {path!r} "
                f"(mode={mode}, type={object_type})"
            )
        if not re.fullmatch(r"[0-9a-fA-F]{40,64}", object_id):
            raise PackagingError(f"Invalid Git object id for {path!r}: {object_id!r}")

        folded = unicodedata.normalize("NFC", path).casefold()
        previous = folded_paths.get(folded)
        if previous is not None:
            raise PackagingError(
                f"Case-colliding archive paths cannot be packaged: {previous!r} and {path!r}"
            )
        folded_paths[folded] = path
        files.append(GitFile(path=path, object_id=object_id.lower(), mode=mode))
    return sorted(files, key=lambda item: item.path)


def read_commit_blobs(root: Path, files: Sequence[GitFile]) -> list[bytes]:
    if not files:
        return []
    request = b"".join(file.object_id.encode("ascii") + b"\n" for file in files)
    response = _git_command(root, "cat-file", "--batch", input_bytes=request)
    cursor = 0
    blobs: list[bytes] = []
    for file in files:
        header_end = response.find(b"\n", cursor)
        if header_end < 0:
            raise PackagingError(f"Truncated Git blob response for {file.path!r}")
        header = response[cursor:header_end].split(b" ")
        if len(header) != 3:
            raise PackagingError(f"Invalid Git blob response for {file.path!r}")
        response_id, object_type, raw_size = header
        try:
            size = int(raw_size)
        except ValueError as exc:
            raise PackagingError(f"Invalid Git blob size for {file.path!r}") from exc
        if response_id.decode("ascii").lower() != file.object_id or object_type != b"blob":
            raise PackagingError(f"Git blob identity mismatch for {file.path!r}")
        content_start = header_end + 1
        content_end = content_start + size
        if content_end >= len(response) or response[content_end : content_end + 1] != b"\n":
            raise PackagingError(f"Truncated Git blob content for {file.path!r}")
        blobs.append(response[content_start:content_end])
        cursor = content_end + 1
    if cursor != len(response):
        raise PackagingError("Unexpected trailing data from Git blob reader")
    return blobs


def build_package_manifest(
    *, version: str, source_commit: str, files: Sequence[GitFile], blobs: Sequence[bytes]
) -> bytes:
    if len(files) != len(blobs):
        raise PackagingError("Package manifest inputs do not match")
    manifest = {
        "files": [
            {
                "mode": file.mode,
                "path": file.path,
                "sha256": hashlib.sha256(blob).hexdigest(),
                "size": len(blob),
            }
            for file, blob in zip(files, blobs, strict=True)
        ],
        "hash_algorithm": "sha256",
        "schema": "uok.source_package_manifest.v1",
        "source_commit": source_commit,
        "version": version,
    }
    return (json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


def _zip_info(path: str, mode: str) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(path, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.create_system = 3
    permissions = 0o755 if mode == "100755" else 0o644
    info.external_attr = (0o100000 | permissions) << 16
    return info


def create_package(
    *,
    root: Path,
    version: str,
    output_directory: Path,
    source_ref: str = "HEAD",
    stamp: str | None = None,
) -> Path:
    if not VERSION_PATTERN.fullmatch(version):
        raise PackagingError(
            "Version must start with an alphanumeric character and contain only letters, "
            "numbers, dot, underscore, plus, or hyphen"
        )
    root = root.resolve()
    source_commit = resolve_source_commit(root, source_ref)
    files = list_commit_files(root, source_commit)
    blobs = read_commit_blobs(root, files)
    manifest = build_package_manifest(
        version=version,
        source_commit=source_commit,
        files=files,
        blobs=blobs,
    )

    output_directory = output_directory.resolve()
    output_directory.mkdir(parents=True, exist_ok=True)
    package_stamp = stamp or dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    package = output_directory / f"UOK_v{version}_local_candidate_{package_stamp}.zip"
    try:
        with zipfile.ZipFile(package, "x", compression=zipfile.ZIP_DEFLATED) as archive:
            for file, blob in zip(files, blobs, strict=True):
                archive.writestr(_zip_info(file.path, file.mode), blob)
            archive.writestr(_zip_info(MANIFEST_PATH, "100644"), manifest)
    except FileExistsError as exc:
        raise PackagingError(f"Package output already exists: {package}") from exc
    except Exception:
        package.unlink(missing_ok=True)
        raise
    return package


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build a deterministic UOK source package from one resolved Git commit."
    )
    parser.add_argument("--version", default="3.1.0-alpha.3")
    parser.add_argument("--output-directory", default="..")
    parser.add_argument(
        "--source-ref",
        "--commit",
        dest="source_ref",
        default="HEAD",
        help="Git revision to resolve and package (default: HEAD)",
    )
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output_directory = (root / args.output_directory).resolve()
    try:
        package = create_package(
            root=root,
            version=args.version,
            output_directory=output_directory,
            source_ref=args.source_ref,
        )
    except PackagingError as exc:
        parser.error(str(exc))
    print(package)


if __name__ == "__main__":
    main()
