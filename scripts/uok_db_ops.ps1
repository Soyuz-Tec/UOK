function Get-UokDbContainer {
    $container = podman ps --filter "name=$ProjectName-db-1" --format "{{.ID}}" | Select-Object -First 1
    if (-not $container) {
        throw "Database container for project '$ProjectName' is not running."
    }
    return $container
}

function Invoke-UokBackupDb {
    $container = Get-UokDbContainer
    $backupDir = Join-Path $RepoRoot "var\backups\postgres"
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    if (-not $BackupPath) {
        $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $BackupPath = Join-Path $backupDir "uok_pg18_$stamp.dump"
    }
    $fileName = Split-Path -Leaf $BackupPath
    Invoke-UokStep "Create PostgreSQL custom dump" {
        Invoke-Native "podman" @(
            "exec",
            $container,
            "pg_dump",
            "-U",
            "uok",
            "-d",
            "uok",
            "--format=custom",
            "--no-owner",
            "--no-acl",
            "--file",
            "/tmp/$fileName"
        )
    }
    Invoke-UokStep "Copy dump to host" {
        Invoke-Native "podman" @("cp", "${container}:/tmp/$fileName", $BackupPath)
        Invoke-Native "podman" @("exec", $container, "rm", "-f", "/tmp/$fileName")
        Write-Host "Backup written to $BackupPath"
    }
}

function Invoke-UokRestoreDb {
    if (-not $ConfirmRestore) {
        throw "Restore is destructive. Re-run with -ConfirmRestore and -BackupPath <dump>."
    }
    if (-not $BackupPath -or -not (Test-Path -LiteralPath $BackupPath)) {
        throw "BackupPath is required and must exist."
    }
    $container = Get-UokDbContainer
    $fileName = Split-Path -Leaf $BackupPath
    Invoke-UokStep "Stop API before restore" {
        Invoke-Native "podman" @("compose", "-p", $ProjectName, "-f", $ComposeFile, "stop", "api")
    }
    try {
        Invoke-UokStep "Copy dump to database container" {
            Invoke-Native "podman" @("cp", $BackupPath, "${container}:/tmp/$fileName")
        }
        Invoke-UokStep "Restore PostgreSQL dump" {
            Invoke-Native "podman" @(
                "exec",
                $container,
                "pg_restore",
                "-U",
                "uok",
                "-d",
                "uok",
                "--clean",
                "--if-exists",
                "--no-owner",
                "--no-acl",
                "/tmp/$fileName"
            )
        }
    } finally {
        Invoke-Native "podman" @("exec", $container, "rm", "-f", "/tmp/$fileName")
        Invoke-Native "podman" @("compose", "-p", $ProjectName, "-f", $ComposeFile, "up", "-d", "api")
    }
    Invoke-UokHealth
}
