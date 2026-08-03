function Test-UokSourceSize {
    Invoke-UokStep "Source-size guardrail" {
        Invoke-Native "python" @("scripts/source_size_policy.py")
    }
}

function Test-UokFolderOrganization {
    Invoke-UokStep "Folder organization" {
        $required = @(
            "docs\ARCHITECTURE.md",
            "docs\DOCUMENTATION_INDEX.md",
            "docs\architecture\UOK_DEVELOPMENT_CONTINUITY_SYSTEM.md",
            "docs\operations\UOK_STANDARD_OPERATIONS.md",
            "docs\operations\UOK_ASUH_TEST_EVENTS.md"
        )
        foreach ($path in $required) {
            if (-not (Test-Path $path)) {
                throw "Required documentation artifact missing: $path"
            }
        }
        Get-ChildItem modules -Filter manifest.yaml -Recurse | ForEach-Object {
            $moduleRoot = Split-Path -Parent $_.FullName
            foreach ($folder in "backend", "web", "migrations", "tests") {
                if (-not (Test-Path (Join-Path $moduleRoot $folder))) {
                    throw "Module folder missing: $moduleRoot\$folder"
                }
            }
        }
        Write-Host "Required folders and documentation anchors are present."
    }
}
