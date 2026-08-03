param(
    [Parameter(Mandatory = $true)]
    [string]$ConfigPath
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$script:UokAutoStartLogPath = $null
$script:UokAutoStartRunId = $null
function Protect-UokAutoStartText {
    param([string]$Text)
    if (-not $Text) { return "" }
    $safe = $Text -replace '(?i)(password|secret|token|database_url)(\s*[:=]\s*)\S+', '$1$2[redacted]'
    return $safe -replace '(?i)([a-z][a-z0-9+.-]*://[^:\s/]+:)[^@\s]+@', '$1[redacted]@'
}
function Write-UokAutoStartLog {
    param(
        [string]$Event,
        [string]$Message,
        [ValidateSet("info", "warning", "error")]
        [string]$Level = "info"
    )
    $entry = [ordered]@{
        timestamp = (Get-Date).ToUniversalTime().ToString("o")
        run_id = $script:UokAutoStartRunId
        level = $Level
        event = $Event
        message = Protect-UokAutoStartText -Text $Message
    }
    $line = $entry | ConvertTo-Json -Compress
    Add-Content -LiteralPath $script:UokAutoStartLogPath -Value $line -Encoding UTF8
    Write-Host $line
}
function ConvertTo-UokNativeArgument {
    param([string]$Value)
    if ($Value.Contains('"')) { throw "Native arguments must not contain quotation marks." }
    if ($Value -notmatch '\s' -and $Value.Length -gt 0) { return $Value }
    $escaped = $Value -replace '(\\+)$', '$1$1'
    return '"' + $escaped + '"'
}
function Invoke-UokAutoStartNative {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [ValidateRange(1, 600)]
        [int]$TimeoutSeconds,
        [hashtable]$Environment = @{},
        [switch]$AllowFailure,
        [switch]$LogOutput
    )
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $FilePath
    $startInfo.Arguments = (($Arguments | ForEach-Object { ConvertTo-UokNativeArgument -Value $_ }) -join " ")
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.EnvironmentVariables.Remove("CONTAINER_HOST")
    $startInfo.EnvironmentVariables.Remove("DOCKER_HOST")
    foreach ($name in $Environment.Keys) {
        $startInfo.EnvironmentVariables[$name] = [string]$Environment[$name]
    }

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    if (-not $process.Start()) { throw "Unable to start native process: $FilePath" }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $exited = $process.WaitForExit($TimeoutSeconds * 1000)
    if (-not $exited) {
        $taskKill = Join-Path $env:SystemRoot "System32\taskkill.exe"
        $previousPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = "Continue"
            & $taskKill /PID "$($process.Id)" /T /F *> $null
        } finally {
            $ErrorActionPreference = $previousPreference
        }
        Write-UokAutoStartLog -Level "error" -Event "native_timeout" -Message "$FilePath exceeded ${TimeoutSeconds}s."
        throw "Native process timed out after $TimeoutSeconds seconds: $FilePath"
    }
    $process.WaitForExit()
    $stdout = $stdoutTask.Result.Trim()
    $stderr = $stderrTask.Result.Trim()
    $result = [pscustomobject]@{
        ExitCode = $process.ExitCode
        StdOut = $stdout
        StdErr = $stderr
    }
    if ($LogOutput) {
        if ($stdout) { Write-UokAutoStartLog -Event "native_stdout" -Message $stdout }
        if ($stderr) { Write-UokAutoStartLog -Event "native_stderr" -Message $stderr }
    }
    if (($result.ExitCode -ne 0) -and (-not $AllowFailure)) {
        if ($stdout) { Write-UokAutoStartLog -Level "error" -Event "native_stdout" -Message $stdout }
        if ($stderr) { Write-UokAutoStartLog -Level "error" -Event "native_stderr" -Message $stderr }
        throw "Native process exited with code $($result.ExitCode): $FilePath"
    }
    return $result
}
function Test-UokPodmanReady {
    param($Config, [string]$PodmanPath)
    $result = Invoke-UokAutoStartNative -FilePath $PodmanPath -Arguments @(
        "--connection", $Config.connection_name, "info", "--format", "{{.Host.OS}}"
    ) -TimeoutSeconds 10 -AllowFailure
    return $result.ExitCode -eq 0
}
function Wait-UokPodmanReady {
    param($Config, [string]$PodmanPath)
    $deadline = (Get-Date).AddSeconds(120)
    while ((Get-Date) -lt $deadline) {
        if (Test-UokPodmanReady -Config $Config -PodmanPath $PodmanPath) { return }
        Start-Sleep -Seconds 2
    }
    throw "Configured Podman connection did not become ready within 120 seconds."
}

function Get-UokContainerId {
    param($Config, [string]$PodmanPath, [string]$Service)
    $result = Invoke-UokAutoStartNative -FilePath $PodmanPath -Arguments @(
        "--connection", $Config.connection_name, "ps", "-a",
        "--filter", "label=com.docker.compose.project=$($Config.project_name)",
        "--filter", "label=com.docker.compose.service=$Service", "--format", "{{.ID}}"
    ) -TimeoutSeconds 15
    $ids = @($result.StdOut -split "`r?`n" | Where-Object { $_ })
    if ($ids.Count -gt 1) { throw "Multiple $Service containers match the configured UOK project." }
    if ($ids.Count -eq 1) { return $ids[0] }
    return $null
}
function Get-UokInspectValue {
    param($Config, [string]$PodmanPath, [string]$ObjectId, [string]$Format)
    $result = Invoke-UokAutoStartNative -FilePath $PodmanPath -Arguments @(
        "--connection", $Config.connection_name, "inspect", $ObjectId, "--format", $Format
    ) -TimeoutSeconds 15
    return $result.StdOut.Trim()
}

function Assert-UokContainerContract {
    param($Config, [string]$PodmanPath, [string]$ContainerId, [string]$ExpectedImageId, [string]$Service, [string]$Destination, [string]$ExpectedVolume)
    $result = Invoke-UokAutoStartNative -FilePath $PodmanPath -Arguments @(
        "--connection", $Config.connection_name, "inspect", $ContainerId
    ) -TimeoutSeconds 15
    $inspection = @($result.StdOut | ConvertFrom-Json -ErrorAction Stop)[0]
    $actual = "$($inspection.Image)"
    if ($actual -ne $ExpectedImageId) { throw "$Service container image does not match the installed auto-start contract." }
    $mounts = @($inspection.Mounts | Where-Object { $_.Destination -eq $Destination -and $_.Type -eq "volume" })
    if ($mounts.Count -ne 1 -or "$($mounts[0].Name)" -ne $ExpectedVolume) { throw "$Service container volume does not match the installed auto-start contract." }
}

function Wait-UokDatabaseHealthy {
    param($Config, [string]$PodmanPath, [string]$ContainerId)
    $deadline = (Get-Date).AddSeconds(120)
    while ((Get-Date) -lt $deadline) {
        $state = Get-UokInspectValue -Config $Config -PodmanPath $PodmanPath -ObjectId $ContainerId -Format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}"
        if ($state -eq "healthy") { return }
        if ($state -eq "exited" -or $state -eq "dead") { throw "UOK database container entered state '$state'." }
        Start-Sleep -Seconds 2
    }
    throw "UOK database did not become healthy within 120 seconds."
}

function Wait-UokApplicationHealth {
    param($Config)
    $healthUrl = "$($Config.base_url.TrimEnd('/'))/health"
    $deadline = (Get-Date).AddSeconds(180)
    $lastError = "no response"
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-RestMethod -UseBasicParsing -Uri $healthUrl -TimeoutSec 5
            if ($response.status -eq "ok" -and $response.name -eq $Config.expected_name -and $response.version -eq $Config.expected_version) {
                Write-UokAutoStartLog -Event "health_ready" -Message "$healthUrl returned the expected UOK identity."
                return
            }
            $lastError = "unexpected health identity"
        } catch {
            $lastError = $_.Exception.Message
        }
        Start-Sleep -Seconds 2
    }
    throw "UOK health did not become ready within 180 seconds. Last error: $lastError"
}

function Assert-UokPayloadIntegrity {
    param($Config)
    foreach ($item in $Config.payload_hashes.psobject.Properties) {
        $path = [string]$Config.payload_paths.($item.Name)
        if (-not (Test-Path -LiteralPath $path)) { throw "Installed auto-start payload is missing: $($item.Name)" }
        $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant()
        if ($actual -ne [string]$item.Value) { throw "Installed auto-start payload hash drifted: $($item.Name)" }
    }
}
function Assert-UokImageReference {
    param($Config, [string]$PodmanPath, [string]$Image, [string]$ExpectedImageId)
    $result = Invoke-UokAutoStartNative -FilePath $PodmanPath -Arguments @(
        "--connection", $Config.connection_name, "image", "inspect", $Image, "--format", "{{.Id}}"
    ) -TimeoutSeconds 15
    if ($result.StdOut.Trim() -ne $ExpectedImageId) { throw "Image reference drifted from the installed auto-start contract: $Image" }
}
function Start-UokApiContainer {
    param($Config, [string]$PodmanPath, [string]$ContainerId)
    $state = Get-UokInspectValue -Config $Config -PodmanPath $PodmanPath -ObjectId $ContainerId -Format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}"
    $action = if ($state -eq "unhealthy") { "restart" } else { "start" }
    Invoke-UokAutoStartNative -FilePath $PodmanPath -Arguments @("--connection", $Config.connection_name, $action, $ContainerId) -TimeoutSeconds 30 | Out-Null
    Write-UokAutoStartLog -Event "api_container_$action" -Message "API state was '$state'; bounded $action requested."
}
function Assert-UokVolumeReference {
    param($Config, [string]$PodmanPath, [string]$Name, [string]$Expected)
    $result = Invoke-UokAutoStartNative -FilePath $PodmanPath -Arguments @(
        "--connection", $Config.connection_name, "volume", "inspect", $Name
    ) -TimeoutSeconds 15 -AllowFailure
    if ($result.ExitCode -ne 0) { throw "Required UOK volume is absent or its identity changed: $Name" }
    $inspection = @($result.StdOut | ConvertFrom-Json -ErrorAction Stop)[0]
    $actual = "$($inspection.Name)|$($inspection.Driver)|$($inspection.CreatedAt)"
    if ($actual -ne $Expected) { throw "Required UOK volume is absent or its identity changed: $Name" }
}
$resolvedConfigPath = [System.IO.Path]::GetFullPath($ConfigPath)
$releaseRoot = Split-Path -Parent $resolvedConfigPath
$releasesRoot = Split-Path -Parent $releaseRoot
if ((Split-Path -Leaf $releasesRoot) -ne "releases") { throw "Auto-start configuration is not inside the managed releases directory." }
$stateRoot = Split-Path -Parent $releasesRoot
$lockPath = Join-Path $stateRoot "autostart.lock"
$lockStream = $null
try {
    try {
        $lockStream = [System.IO.File]::Open($lockPath, "OpenOrCreate", "ReadWrite", "None")
    } catch [System.IO.IOException] {
        exit 0
    }
    $logDirectory = Join-Path (Split-Path -Parent $stateRoot) "logs"
    New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
    $script:UokAutoStartLogPath = Join-Path $logDirectory "podman-autostart.jsonl"
    $script:UokAutoStartRunId = [guid]::NewGuid().ToString()
    if ((Test-Path -LiteralPath $script:UokAutoStartLogPath) -and ((Get-Item -LiteralPath $script:UokAutoStartLogPath).Length -gt 2MB)) {
        Move-Item -Force -LiteralPath $script:UokAutoStartLogPath -Destination "$($script:UokAutoStartLogPath).previous"
    }
    Write-UokAutoStartLog -Event "recovery_started" -Message "UOK login recovery started."
    if (Test-Path -LiteralPath (Join-Path $stateRoot "disabled")) {
        Write-UokAutoStartLog -Event "maintenance_disabled" -Message "Automatic recovery is disabled by the maintenance marker."
        exit 0
    }
    if (-not (Test-Path -LiteralPath $resolvedConfigPath)) { throw "Auto-start configuration is missing." }
    $config = Get-Content -Raw -LiteralPath $resolvedConfigPath | ConvertFrom-Json
    if ($config.contract_version -ne "uok.windows-autostart.v1") { throw "Unsupported auto-start contract version." }
    Assert-UokPayloadIntegrity -Config $config

    $podmanPath = [string]$config.podman_path
    if (-not (Test-Path -LiteralPath $podmanPath)) {
        $podmanPath = (Get-Command "podman.exe" -ErrorAction Stop).Source
        Write-UokAutoStartLog -Level "warning" -Event "podman_path_changed" -Message "Using the current Podman executable after the installed path changed."
    }
    if (-not (Test-UokPodmanReady -Config $config -PodmanPath $podmanPath)) {
        Write-UokAutoStartLog -Event "machine_start" -Message "Starting configured Podman machine '$($config.machine_name)'."
        $startResult = Invoke-UokAutoStartNative -FilePath $podmanPath -Arguments @(
            "machine", "start", $config.machine_name
        ) -TimeoutSeconds 90 -AllowFailure -LogOutput
        if ($startResult.ExitCode -ne 0) {
            Write-UokAutoStartLog -Level "warning" -Event "machine_start_race" -Message "Machine start returned nonzero; readiness will decide whether another process completed startup."
        }
    }
    Wait-UokPodmanReady -Config $config -PodmanPath $podmanPath
    Assert-UokVolumeReference -Config $config -PodmanPath $podmanPath -Name $config.db_volume -Expected $config.db_volume_fingerprint
    Assert-UokVolumeReference -Config $config -PodmanPath $podmanPath -Name $config.files_volume -Expected $config.files_volume_fingerprint
    $dbId = Get-UokContainerId -Config $config -PodmanPath $podmanPath -Service "db"
    $apiId = Get-UokContainerId -Config $config -PodmanPath $podmanPath -Service "api"
    if ($dbId -and $apiId) {
        Assert-UokContainerContract -Config $config -PodmanPath $podmanPath -ContainerId $dbId -ExpectedImageId $config.db_image_id -Service "Database" -Destination "/var/lib/postgresql" -ExpectedVolume $config.db_volume
        Assert-UokContainerContract -Config $config -PodmanPath $podmanPath -ContainerId $apiId -ExpectedImageId $config.api_image_id -Service "API" -Destination "/data" -ExpectedVolume $config.files_volume
        Invoke-UokAutoStartNative -FilePath $podmanPath -Arguments @("--connection", $config.connection_name, "start", $dbId) -TimeoutSeconds 30 | Out-Null
        Wait-UokDatabaseHealthy -Config $config -PodmanPath $podmanPath -ContainerId $dbId
        Start-UokApiContainer -Config $config -PodmanPath $podmanPath -ContainerId $apiId
        Write-UokAutoStartLog -Event "existing_containers_started" -Message "Recovered the installed UOK database and API containers."
    } else {
        if ($dbId) { Assert-UokContainerContract -Config $config -PodmanPath $podmanPath -ContainerId $dbId -ExpectedImageId $config.db_image_id -Service "Database" -Destination "/var/lib/postgresql" -ExpectedVolume $config.db_volume }
        if ($apiId) { Assert-UokContainerContract -Config $config -PodmanPath $podmanPath -ContainerId $apiId -ExpectedImageId $config.api_image_id -Service "API" -Destination "/data" -ExpectedVolume $config.files_volume }
        Assert-UokImageReference -Config $config -PodmanPath $podmanPath -Image $config.db_image -ExpectedImageId $config.db_image_id
        Assert-UokImageReference -Config $config -PodmanPath $podmanPath -Image $config.api_image -ExpectedImageId $config.api_image_id
        if (-not (Test-Path -LiteralPath $config.compose_provider_path)) { throw "Installed Compose provider is unavailable." }
        Invoke-UokAutoStartNative -FilePath $podmanPath -Arguments @(
            "--connection", $config.connection_name, "compose", "-p", $config.project_name,
            "-f", $config.payload_paths.compose, "-f", $config.payload_paths.override,
            "up", "-d", "--no-build", "--no-recreate"
        ) -TimeoutSeconds 120 -Environment @{ PODMAN_COMPOSE_PROVIDER = $config.compose_provider_path } -LogOutput | Out-Null
        $dbId = Get-UokContainerId -Config $config -PodmanPath $podmanPath -Service "db"
        $apiId = Get-UokContainerId -Config $config -PodmanPath $podmanPath -Service "api"
        if (-not $dbId -or -not $apiId) { throw "Compose recovery did not produce the expected UOK service labels." }
        Assert-UokContainerContract -Config $config -PodmanPath $podmanPath -ContainerId $dbId -ExpectedImageId $config.db_image_id -Service "Database" -Destination "/var/lib/postgresql" -ExpectedVolume $config.db_volume
        Assert-UokContainerContract -Config $config -PodmanPath $podmanPath -ContainerId $apiId -ExpectedImageId $config.api_image_id -Service "API" -Destination "/data" -ExpectedVolume $config.files_volume
        Wait-UokDatabaseHealthy -Config $config -PodmanPath $podmanPath -ContainerId $dbId
        Write-UokAutoStartLog -Event "compose_recovered" -Message "Recovered the UOK project from the frozen no-build payload."
    }
    Wait-UokApplicationHealth -Config $config
    Write-UokAutoStartLog -Event "recovery_completed" -Message "UOK login recovery completed successfully."
} catch {
    if ($script:UokAutoStartLogPath) {
        Write-UokAutoStartLog -Level "error" -Event "recovery_failed" -Message $_.Exception.Message
    }
    throw
} finally {
    if ($lockStream) { $lockStream.Dispose() }
}
