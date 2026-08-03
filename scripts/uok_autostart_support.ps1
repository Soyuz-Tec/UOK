function Get-UokAutoStartPaths {
    $stateRoot = Join-Path $env:LOCALAPPDATA "UOK\startup"
    return [pscustomobject]@{
        StateRoot = $stateRoot
        Releases = (Join-Path $stateRoot "releases")
        Disabled = (Join-Path $stateRoot "disabled")
        TaskBackup = (Join-Path $stateRoot "previous-task.xml")
        LegacyWorker = (Join-Path $stateRoot "Start-UokAfterLogin.ps1")
        StableWorker = (Join-Path $stateRoot "uok_autostart_worker.ps1")
        StableConfig = (Join-Path $stateRoot "autostart-config.json")
        StableCompose = (Join-Path $stateRoot "payload\compose-local-18088.yaml")
        StableOverride = (Join-Path $stateRoot "payload\compose-autostart.override.yaml")
        StableCapacity = (Join-Path $stateRoot "payload\database-capacity.env")
    }
}
function New-UokAutoStartReleasePaths {
    param($Paths)
    $releaseId = (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmssfff") + "-" + [guid]::NewGuid().ToString("N")
    $releaseRoot = Join-Path $Paths.Releases $releaseId
    return [pscustomobject]@{
        ReleaseRoot = $releaseRoot
        Worker = (Join-Path $releaseRoot "uok_autostart_worker.ps1")
        Config = (Join-Path $releaseRoot "autostart-config.json")
        Compose = (Join-Path $releaseRoot "compose-local-18088.yaml")
        Override = (Join-Path $releaseRoot "compose-autostart.override.yaml")
        Capacity = (Join-Path $releaseRoot "database-capacity.env")
    }
}
function Invoke-UokAutoStartTextCommand {
    param([string]$FilePath, [string[]]$Arguments)
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $output = @(& $FilePath @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
    }
    $text = (($output | ForEach-Object { [string]$_ }) -join "`n").Trim()
    if ($exitCode -ne 0) { throw "$FilePath exited with code $exitCode for '$($Arguments -join ' ')'. Output: $text" }
    return $text
}
function Resolve-UokComposeProvider {
    foreach ($name in "podman-compose.exe", "podman-compose", "docker-compose.exe", "docker-compose") {
        $command = Get-Command $name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($command -and (Test-Path -LiteralPath $command.Source)) { return $command.Source }
    }
    throw "No supported Compose provider is installed. Install podman-compose or Docker Compose before enabling auto-start."
}
function Get-UokNamedTasks {
    return @(Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue)
}
function Test-UokManagedTask {
    param($Task)
    $action = @($Task.Actions) | Select-Object -First 1
    return [string]$Task.Description -like "$ContractVersion*" -and $action -and [string]$action.Arguments -like "*uok_autostart_worker.ps1*"
}
function Test-UokLegacyPrototypeTask {
    param($Task, $Paths)
    if ($Task.TaskPath -ne "\") { return $false }
    return [string]$Task.Actions.Arguments -like "*$($Paths.LegacyWorker)*"
}

function Assert-UokTaskOwnership {
    param($Paths)
    $foreign = @(Get-UokNamedTasks | Where-Object {
        -not (Test-UokManagedTask -Task $_) -and -not (Test-UokLegacyPrototypeTask -Task $_ -Paths $Paths)
    })
    if ($foreign.Count -gt 0) { throw "A foreign scheduled task already uses the name '$TaskName'; it will not be overwritten." }
}

function Ensure-UokTaskFolder {
    $service = New-Object -ComObject "Schedule.Service"
    $service.Connect()
    $folderPath = $TaskPath.TrimEnd("\")
    try {
        $service.GetFolder($folderPath) | Out-Null
    } catch {
        $service.GetFolder("\").CreateFolder("UOK") | Out-Null
    }
}

function Get-UokSourceVersion {
    $versionText = Get-Content -Raw -LiteralPath (Join-Path $RepoRoot "src\uok\__init__.py")
    $match = [regex]::Match($versionText, 'APP_VERSION\s*=\s*"(?<version>[^"]+)"')
    if (-not $match.Success) { throw "Unable to resolve the UOK application version." }
    return $match.Groups["version"].Value
}

function Get-UokPodmanInspection {
    param([string]$PodmanPath, [string]$Connection, [string]$Kind, [string]$Object)
    $json = Invoke-UokAutoStartTextCommand -FilePath $PodmanPath -Arguments @("--connection", $Connection, $Kind, "inspect", $Object)
    try { return @($json | ConvertFrom-Json -ErrorAction Stop)[0] }
    catch { throw "Unable to parse Podman $Kind inspection for ${Object}: $($_.Exception.Message)" }
}

function Get-UokMountedVolumeIdentity {
    param([string]$PodmanPath, [string]$Connection, [string]$Container, [string]$Destination)
    $inspection = Get-UokPodmanInspection -PodmanPath $PodmanPath -Connection $Connection -Kind "container" -Object $Container
    $mounts = @($inspection.Mounts | Where-Object { $_.Destination -eq $Destination -and $_.Type -eq "volume" })
    $name = if ($mounts.Count -eq 1) { "$($mounts[0].Name)" } else { "" }
    if (-not $name -or $name -notmatch "^[a-zA-Z0-9][a-zA-Z0-9_.-]+$") {
        throw "Unable to resolve the named volume mounted at $Destination for $Container."
    }
    $volume = Get-UokPodmanInspection -PodmanPath $PodmanPath -Connection $Connection -Kind "volume" -Object $name
    $fingerprint = "$($volume.Name)|$($volume.Driver)|$($volume.CreatedAt)"
    return [pscustomobject]@{ Name = $name; Fingerprint = $fingerprint }
}

function Copy-UokAutoStartPayload {
    param($Release)
    New-Item -ItemType Directory -Force -Path $Release.ReleaseRoot | Out-Null
    $sources = [ordered]@{
        worker = (Join-Path $RepoRoot "scripts\uok_autostart_worker.ps1")
        compose = (Join-Path $RepoRoot "deploy\compose-local-18088.yaml")
        override = (Join-Path $RepoRoot "deploy\compose-autostart.override.yaml")
        capacity = (Join-Path $RepoRoot "deploy\database-capacity.env")
    }
    foreach ($source in $sources.Values) {
        if (-not (Test-Path -LiteralPath $source)) { throw "Auto-start source payload is missing: $source" }
    }
    Copy-Item -Force -LiteralPath $sources.worker -Destination $Release.Worker
    Copy-Item -Force -LiteralPath $sources.compose -Destination $Release.Compose
    Copy-Item -Force -LiteralPath $sources.override -Destination $Release.Override
    Copy-Item -Force -LiteralPath $sources.capacity -Destination $Release.Capacity
    return [ordered]@{
        worker = (Get-FileHash -Algorithm SHA256 -LiteralPath $Release.Worker).Hash.ToLowerInvariant()
        compose = (Get-FileHash -Algorithm SHA256 -LiteralPath $Release.Compose).Hash.ToLowerInvariant()
        override = (Get-FileHash -Algorithm SHA256 -LiteralPath $Release.Override).Hash.ToLowerInvariant()
        capacity = (Get-FileHash -Algorithm SHA256 -LiteralPath $Release.Capacity).Hash.ToLowerInvariant()
    }
}

function New-UokAutoStartConfig {
    param(
        $Release,
        $PayloadHashes,
        [int]$ConfiguredDelaySeconds,
        [int]$ConfiguredCheckIntervalMinutes,
        [datetime]$ConfiguredPeriodicStart,
        [string]$UserId
    )
    $podmanPath = (Get-Command "podman.exe" -CommandType Application -ErrorAction Stop).Source
    $parsedConnections = Invoke-UokAutoStartTextCommand -FilePath $podmanPath -Arguments @("system", "connection", "list", "--format", "json") | ConvertFrom-Json
    $connections = @($parsedConnections | ForEach-Object { $_ })
    $connection = $connections | Where-Object { $_.Name -eq $MachineName -and $_.IsMachine } | Select-Object -First 1
    if (-not $connection) { throw "Podman machine connection '$MachineName' is not installed." }
    $apiImage = "docker.io/library/uok-api:latest"
    $dbImage = "docker.io/library/postgres:18-alpine"
    $apiImageInspect = Get-UokPodmanInspection -PodmanPath $podmanPath -Connection $connection.Name -Kind "image" -Object $apiImage
    $dbImageInspect = Get-UokPodmanInspection -PodmanPath $podmanPath -Connection $connection.Name -Kind "image" -Object $dbImage
    $liveApiInspect = Get-UokPodmanInspection -PodmanPath $podmanPath -Connection $connection.Name -Kind "container" -Object "uok-api-1"
    $liveDbInspect = Get-UokPodmanInspection -PodmanPath $podmanPath -Connection $connection.Name -Kind "container" -Object "uok-db-1"
    $apiImageId, $dbImageId = "$($apiImageInspect.Id)", "$($dbImageInspect.Id)"
    $liveApiImageId, $liveDbImageId = "$($liveApiInspect.Image)", "$($liveDbInspect.Image)"
    $dbVolume = Get-UokMountedVolumeIdentity -PodmanPath $podmanPath -Connection $connection.Name -Container "uok-db-1" -Destination "/var/lib/postgresql"
    $filesVolume = Get-UokMountedVolumeIdentity -PodmanPath $podmanPath -Connection $connection.Name -Container "uok-api-1" -Destination "/data"
    $sourceCommit = Invoke-UokAutoStartTextCommand -FilePath "git.exe" -Arguments @("-C", $RepoRoot, "rev-parse", "HEAD")
    $sourceStatus = Invoke-UokAutoStartTextCommand -FilePath "git.exe" -Arguments @("-C", $RepoRoot, "status", "--porcelain", "--untracked-files=normal")
    $sourceVersion = Get-UokSourceVersion
    $imageVersion = "$($apiImageInspect.Labels.'org.opencontainers.image.version')"
    $imageRevision = "$($apiImageInspect.Labels.'org.opencontainers.image.revision')"
    if ($sourceStatus) { throw "Auto-start installation requires a clean committed worktree." }
    if ($liveApiImageId -ne $apiImageId -or $liveDbImageId -ne $dbImageId) {
        throw "Live container images do not match the governed recovery image references."
    }
    if ($imageVersion -ne $sourceVersion -or $imageRevision -ne $sourceCommit) {
        throw "API image labels do not match the clean source version and commit."
    }
    return [ordered]@{
        contract_version = $ContractVersion
        installed_at_utc = (Get-Date).ToUniversalTime().ToString("o")
        source_commit = $sourceCommit
        source_tree_state = "clean"
        installed_user_id = $UserId
        delay_seconds = $ConfiguredDelaySeconds
        check_interval_minutes = $ConfiguredCheckIntervalMinutes
        periodic_start_boundary_utc = $ConfiguredPeriodicStart.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss'Z'")
        project_name = "uok"
        machine_name = $MachineName
        connection_name = $connection.Name
        base_url = "http://127.0.0.1:18088"
        expected_name = "UOK"
        expected_version = $sourceVersion
        podman_path = $podmanPath
        compose_provider_path = Resolve-UokComposeProvider
        api_image = $apiImage
        api_image_id = $apiImageId
        api_image_version = $imageVersion
        api_image_revision = $imageRevision
        db_image = $dbImage
        db_image_id = $dbImageId
        db_volume = $dbVolume.Name
        db_volume_fingerprint = $dbVolume.Fingerprint
        files_volume = $filesVolume.Name
        files_volume_fingerprint = $filesVolume.Fingerprint
        payload_paths = [ordered]@{
            worker = $Release.Worker
            compose = $Release.Compose
            override = $Release.Override
            capacity = $Release.Capacity
        }
        payload_hashes = $PayloadHashes
    }
}

function Get-UokTaskConfigPath {
    param($Task)
    $action = @($Task.Actions) | Select-Object -First 1
    $match = [regex]::Match([string]$action.Arguments, '(?i)-ConfigPath\s+"(?<path>[^"]+)"')
    if ($match.Success) { return $match.Groups["path"].Value }
    return $null
}

function Get-UokTaskArguments {
    param([string]$WorkerPath, [string]$ConfigPath)
    return '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" -ConfigPath "{1}"' -f $WorkerPath, $ConfigPath
}

function Test-UokAutoStartPayload {
    param($Config)
    try {
        $required = @(
            "api_image_version", "api_image_revision", "db_volume",
            "db_volume_fingerprint", "files_volume", "files_volume_fingerprint"
        )
        foreach ($name in $required) {
            if (-not $Config.psobject.Properties[$name] -or -not [string]$Config.$name) { return $false }
        }
        if ($Config.source_tree_state -ne "clean" -or [string]$Config.api_image_revision -cnotmatch "^[0-9a-f]{40}$") { return $false }
        foreach ($hash in $Config.payload_hashes.psobject.Properties) {
            $path = [string]$Config.payload_paths.($hash.Name)
            if (-not (Test-Path -LiteralPath $path)) { return $false }
            if ((Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant() -ne [string]$hash.Value) { return $false }
        }
        return $true
    } catch { return $false }
}

function Get-UokConfiguredCheckIntervalMinutes {
    param($Config)
    if (-not $Config -or -not $Config.psobject.Properties["check_interval_minutes"]) { return $null }
    $interval = 0
    if (-not [int]::TryParse([string]$Config.check_interval_minutes, [ref]$interval)) { return $null }
    if ($interval -lt 1 -or $interval -gt 1440) { return $null }
    return $interval
}

function Test-UokAutoStartTaskDefinition {
    param($Task, $Config, [string]$ConfigPath)
    try {
        if (-not $Task -or -not $Config -or -not (Test-UokManagedTask -Task $Task)) { return $false }
        $triggers = @($Task.Triggers)
        if (@($Task.Actions).Count -ne 1 -or $triggers.Count -ne 2 -or -not $Task.Settings.Enabled) { return $false }
        $logonTriggers = @($triggers | Where-Object { $_.Id -eq "UOKLogonRecovery" })
        $periodicTriggers = @($triggers | Where-Object { $_.Id -eq "UOKPeriodicRecovery" })
        if ($logonTriggers.Count -ne 1 -or $periodicTriggers.Count -ne 1) { return $false }
        $action = @($Task.Actions) | Select-Object -First 1
        $logonTrigger = $logonTriggers[0]
        $periodicTrigger = $periodicTriggers[0]
        $powerShellPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
        $expectedArguments = Get-UokTaskArguments -WorkerPath $Config.payload_paths.worker -ConfigPath $ConfigPath
        $expectedPrincipal = ([string]$Config.installed_user_id -split '\\')[-1]
        $intervalMinutes = Get-UokConfiguredCheckIntervalMinutes -Config $Config
        if ($null -eq $intervalMinutes) { return $false }
        $expectedInterval = "PT${intervalMinutes}M"
        $dateStyles = [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal
        $expectedStart = [datetimeoffset]::Parse([string]$Config.periodic_start_boundary_utc, [System.Globalization.CultureInfo]::InvariantCulture, $dateStyles)
        $actualStart = [datetimeoffset]::Parse([string]$periodicTrigger.StartBoundary, [System.Globalization.CultureInfo]::InvariantCulture, $dateStyles)
        $periodicStartMatches = $actualStart.UtcDateTime.Ticks -eq $expectedStart.UtcDateTime.Ticks
        return $action.Execute -eq $powerShellPath -and $action.Arguments -eq $expectedArguments -and $action.WorkingDirectory -eq (Split-Path -Parent $ConfigPath) -and
            $Task.Principal.RunLevel -eq "Limited" -and $Task.Principal.LogonType -eq "Interactive" -and $Task.Principal.UserId -eq $expectedPrincipal -and
            $logonTrigger.CimClass.CimClassName -eq "MSFT_TaskLogonTrigger" -and $logonTrigger.Enabled -and
            $logonTrigger.UserId -eq $Config.installed_user_id -and $logonTrigger.Delay -eq "PT$($Config.delay_seconds)S" -and
            $periodicTrigger.CimClass.CimClassName -eq "MSFT_TaskTimeTrigger" -and $periodicTrigger.Enabled -and
            -not [string]::IsNullOrWhiteSpace([string]$periodicTrigger.StartBoundary) -and
            $periodicStartMatches -and
            [string]::IsNullOrWhiteSpace([string]$periodicTrigger.EndBoundary) -and
            $periodicTrigger.Repetition.Interval -eq $expectedInterval -and
            [string]::IsNullOrWhiteSpace([string]$periodicTrigger.Repetition.Duration) -and
            $Task.Settings.MultipleInstances -eq "IgnoreNew" -and $Task.Settings.RestartCount -eq 3 -and $Task.Settings.RestartInterval -eq "PT1M" -and
            $Task.Settings.ExecutionTimeLimit -eq "PT15M" -and $Task.Settings.StartWhenAvailable -and
            -not $Task.Settings.DisallowStartIfOnBatteries -and -not $Task.Settings.StopIfGoingOnBatteries
    } catch { return $false }
}
