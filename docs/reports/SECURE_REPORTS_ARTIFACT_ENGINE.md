# UOK Secure Reports & Artifact Engine

## Purpose

`reports.core` is the global UOK capability for generating, storing, auditing, verifying, downloading, and deleting report artifacts. Business modules must not embed their own file-generation utilities when a shared report artifact can be produced through this module.

## First deployed scope

The first secure foundation supports deterministic lightweight formats:

- `json`
- `jsonl`
- `txt`
- `md`
- `csv`
- `tsv`

These formats require no new third-party runtime dependencies and establish the security contract before adding PDF, DOCX, XLSX, image, or conversion adapters.

## Architecture

```text
Business module structured data
  -> GenerateReport command or /api/reports/generate
  -> reports.core service
  -> format renderer
  -> DATA_DIR/reports/<organization>/<artifact>.ext
  -> report_artifacts metadata row
  -> EventRecord audit event
```

## Security model

Apps pass structured payloads only. The report engine owns generation, storage, audit, verification, and download.

Non-negotiable rules:

1. No raw user HTML.
2. No shell command parameters from user payloads.
3. No arbitrary filesystem paths.
4. No arbitrary HTTP, HTTPS, file, data, FTP, or SMB URLs.
5. All artifacts are organization-scoped.
6. Artifact files are stored outside the public webroot.
7. Every artifact has a SHA-256 hash in metadata.
8. CSV and TSV exports pass through the formula-injection guard.
9. Renderer adapters must define size, time, and memory limits before production enablement.
10. PDF, DOCX, XLSX, image, browser, and conversion adapters must plug into the same module boundary.

## Permissions

`reports.core` declares these permissions:

- `reports.render`
- `reports.read`
- `reports.manage`
- `reports.delete`

Default module grants:

| Role | Grants |
|---|---|
| `ops_manager` | render, read, manage, delete |
| `trader` | render, read |
| `finance_manager` | render, read |
| `viewer` | read |

`platform_admin` already has `*` from the kernel.

## Command usage

```json
{
  "command_type": "GenerateReport",
  "idempotency_key": "contacts-export-20260709-001",
  "payload": {
    "source_module": "contacts.core",
    "template_key": "contacts.export",
    "title": "Contacts Export",
    "formats": ["csv", "json"],
    "payload": {
      "rows": [
        {"name": "Alice", "email": "alice@example.com"}
      ]
    }
  }
}
```

## HTTP usage

```text
GET    /api/reports/formats
POST   /api/reports/generate
GET    /api/reports/artifacts/{artifact_id}
GET    /api/reports/artifacts/{artifact_id}/download
POST   /api/reports/artifacts/{artifact_id}/verify
DELETE /api/reports/artifacts/{artifact_id}
```

## Future adapters

The following adapters should be added as separate modules or narrow renderer packages, not inside business modules:

| Future module | Formats | Default engine direction |
|---|---|---|
| `reports.pdf` | PDF | WeasyPrint first, enterprise adapters later |
| `reports.document` | DOCX/ODT/RTF | docxtpl/python-docx; Pandoc sidecar only when needed |
| `reports.spreadsheet` | XLSX | XlsxWriter for generation; openpyxl only for trusted templates |
| `reports.image` | SVG/PNG/JPEG/WebP | declarative chart spec plus safe image conversion |
| `reports.convert` | Office/document conversion | isolated sidecar only |
| `reports.browser` | UI screenshot/PDF | isolated browser sidecar only |

## File discipline

Keep source files under 300 lines. Split by service, schema, renderer, storage, audit, and policy responsibility.
