param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath,
    [Parameter(Mandatory = $true)]
    [string]$DatabaseImage,
    [string]$EvidencePath = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$runId = [Guid]::NewGuid().ToString("N")
$containerName = "uok-restore-drill-$runId"
$volumeName = "uok-restore-drill-$runId"
$label = "io.uok.restore-drill=$runId"
$containerCreated = $false
$volumeCreated = $false
$failure = $null

function Invoke-Podman {
    param([string[]]$Arguments)
    $output = & podman @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "podman $($Arguments[0]) failed: $($output -join [Environment]::NewLine)"
    }
    return @($output)
}

function Invoke-PodmanProbe {
    param([string[]]$Arguments)
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "SilentlyContinue"
        & podman @Arguments *> $null
        return $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
    }
}

function Test-CustomDump {
    param([string]$Path)
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $header = [byte[]]::new(5)
        if ($stream.Read($header, 0, 5) -ne 5) {
            return $false
        }
        return [System.Text.Encoding]::ASCII.GetString($header) -eq "PGDMP"
    } finally {
        $stream.Dispose()
    }
}

function Test-ResourceAbsent {
    param(
        [ValidateSet("container", "volume")]
        [string]$Kind,
        [string]$Name
    )
    $exitCode = Invoke-PodmanProbe -Arguments @($Kind, "exists", $Name)
    if ($exitCode -eq 0) {
        return $false
    }
    if ($exitCode -eq 1) {
        return $true
    }
    throw "podman $Kind exists returned unexpected exit code $exitCode."
}

$resolvedBackup = (Resolve-Path -LiteralPath $BackupPath).Path
if (-not (Test-Path -LiteralPath $resolvedBackup -PathType Leaf)) {
    throw "BackupPath must identify a file."
}
if (-not (Test-CustomDump -Path $resolvedBackup)) {
    throw "BackupPath is not a PostgreSQL custom-format dump."
}
$normalizedImage = $DatabaseImage -replace "^sha256:", ""
$isImageId = $normalizedImage -match "^[0-9a-fA-F]{64}$"
$isDigest = $DatabaseImage -match "@sha256:[0-9a-fA-F]{64}$"
if (-not ($isImageId -or $isDigest)) {
    throw "DatabaseImage must be an immutable 64-character image ID or digest reference."
}

$startedAt = [DateTimeOffset]::UtcNow
$backup = Get-Item -LiteralPath $resolvedBackup
$backupSha256 = (Get-FileHash -LiteralPath $resolvedBackup -Algorithm SHA256).Hash.ToLowerInvariant()
if (-not $EvidencePath) {
    $evidenceRoot = Join-Path $RepoRoot "var\evidence\operations"
    $EvidencePath = Join-Path $evidenceRoot "restore-drill-$runId.json"
}
$resolvedEvidence = [System.IO.Path]::GetFullPath($EvidencePath)
$report = [ordered]@{
    schema_version = 1
    run_id = $runId
    status = "running"
    started_at = $startedAt.ToString("o")
    completed_at = $null
    backup = [ordered]@{
        filename = $backup.Name
        bytes = $backup.Length
        sha256 = $backupSha256
        format = "postgresql_custom"
    }
    database = [ordered]@{
        requested_image = $DatabaseImage
        image_id = $null
        server_version = $null
        public_table_count = $null
        schema_versions = @()
    }
    isolation = [ordered]@{
        network = "none"
        published_ports = 0
        container = $containerName
        volume = $volumeName
        label = $label
    }
    cleanup = [ordered]@{
        container_absent = $false
        volume_absent = $false
    }
    error = $null
}

try {
    $imageId = (Invoke-Podman -Arguments @(
        "image", "inspect", $DatabaseImage, "--format", "{{.Id}}"
    ) | Select-Object -First 1).Trim()
    if (-not $imageId) {
        throw "Immutable database image could not be inspected."
    }
    $report.database.image_id = $imageId

    Invoke-Podman -Arguments @(
        "volume", "create", "--label", $label, $volumeName
    ) | Out-Null
    $volumeCreated = $true

    Invoke-Podman -Arguments @(
        "run", "--detach",
        "--name", $containerName,
        "--label", $label,
        "--network", "none",
        "--env", "POSTGRES_USER=uok",
        "--env", "POSTGRES_DB=uok",
        "--env", "POSTGRES_HOST_AUTH_METHOD=trust",
        "--volume", "${volumeName}:/var/lib/postgresql",
        $imageId
    ) | Out-Null
    $containerCreated = $true

    $ready = $false
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        $probe = Invoke-PodmanProbe -Arguments @(
            "exec", $containerName, "pg_isready", "--quiet", "-U", "uok", "-d", "uok"
        )
        if ($probe -eq 0) {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) {
        throw "Disposable PostgreSQL did not become ready."
    }

    Invoke-Podman -Arguments @(
        "cp", $resolvedBackup, "${containerName}:/tmp/uok-restore.dump"
    ) | Out-Null
    Invoke-Podman -Arguments @(
        "exec", $containerName,
        "pg_restore", "--list", "/tmp/uok-restore.dump"
    ) | Out-Null
    Invoke-Podman -Arguments @(
        "exec", $containerName,
        "pg_restore",
        "--username", "uok",
        "--dbname", "uok",
        "--exit-on-error",
        "--single-transaction",
        "--no-owner",
        "--no-privileges",
        "/tmp/uok-restore.dump"
    ) | Out-Null

    $report.database.server_version = (
        Invoke-Podman -Arguments @(
            "exec", $containerName, "psql", "-X", "-qAt",
            "-U", "uok", "-d", "uok",
            "-c", "SHOW server_version;"
        ) | Select-Object -First 1
    ).Trim()
    $report.database.public_table_count = [int](
        Invoke-Podman -Arguments @(
            "exec", $containerName, "psql", "-X", "-qAt",
            "-U", "uok", "-d", "uok",
            "-c", "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
        ) | Select-Object -First 1
    )
    $report.database.schema_versions = @(
        Invoke-Podman -Arguments @(
            "exec", $containerName, "psql", "-X", "-qAt",
            "-U", "uok", "-d", "uok",
            "-c", "SELECT version FROM public.schema_versions ORDER BY version;"
        )
    )
    if ($report.database.public_table_count -lt 1 -or $report.database.schema_versions.Count -lt 1) {
        throw "Restored database did not contain the expected UOK schema."
    }
    $report.status = "passed"
} catch {
    $failure = $_
    $report.status = "failed"
    $report.error = $_.Exception.Message
} finally {
    if ($containerCreated) {
        & podman rm --force $containerName *> $null
    }
    if ($volumeCreated) {
        & podman volume rm --force $volumeName *> $null
    }
    $report.cleanup.container_absent = Test-ResourceAbsent -Kind container -Name $containerName
    $report.cleanup.volume_absent = Test-ResourceAbsent -Kind volume -Name $volumeName
    if (-not ($report.cleanup.container_absent -and $report.cleanup.volume_absent)) {
        $report.status = "failed"
        $report.error = "Disposable restore resources were not fully removed."
        $failure = [System.InvalidOperationException]::new($report.error)
    }
    $report.completed_at = [DateTimeOffset]::UtcNow.ToString("o")
    $evidenceDirectory = Split-Path -Parent $resolvedEvidence
    New-Item -ItemType Directory -Force -Path $evidenceDirectory | Out-Null
    $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedEvidence -Encoding utf8
}

if ($failure) {
    throw $failure
}
Write-Host "Disposable restore drill passed. Evidence: $resolvedEvidence"
