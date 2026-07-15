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
    param($Release, $PayloadHashes, [int]$ConfiguredDelaySeconds, [string]$UserId)
    $podmanPath = (Get-Command "podman.exe" -CommandType Application -ErrorAction Stop).Source
    $parsedConnections = Invoke-UokAutoStartTextCommand -FilePath $podmanPath -Arguments @("system", "connection", "list", "--format", "json") | ConvertFrom-Json
    $connections = @($parsedConnections | ForEach-Object { $_ })
    $connection = $connections | Where-Object { $_.Name -eq $MachineName -and $_.IsMachine } | Select-Object -First 1
    if (-not $connection) { throw "Podman machine connection '$MachineName' is not installed." }
    $apiImage = "docker.io/library/uok-api:latest"
    $dbImage = "docker.io/library/postgres:18-alpine"
    $apiImageId = Invoke-UokAutoStartTextCommand -FilePath $podmanPath -Arguments @("--connection", $connection.Name, "image", "inspect", $apiImage, "--format", "{{.Id}}")
    $dbImageId = Invoke-UokAutoStartTextCommand -FilePath $podmanPath -Arguments @("--connection", $connection.Name, "image", "inspect", $dbImage, "--format", "{{.Id}}")
    $sourceCommit = Invoke-UokAutoStartTextCommand -FilePath "git.exe" -Arguments @("-C", $RepoRoot, "rev-parse", "HEAD")
    $sourceStatus = Invoke-UokAutoStartTextCommand -FilePath "git.exe" -Arguments @("-C", $RepoRoot, "status", "--porcelain", "--untracked-files=normal")
    return [ordered]@{
        contract_version = $ContractVersion
        installed_at_utc = (Get-Date).ToUniversalTime().ToString("o")
        source_commit = $sourceCommit
        source_tree_state = if ($sourceStatus) { "dirty" } else { "clean" }
        installed_user_id = $UserId
        delay_seconds = $ConfiguredDelaySeconds
        project_name = "uok"
        machine_name = $MachineName
        connection_name = $connection.Name
        base_url = "http://127.0.0.1:18088"
        expected_name = "UOK"
        expected_version = Get-UokSourceVersion
        podman_path = $podmanPath
        compose_provider_path = Resolve-UokComposeProvider
        api_image = $apiImage
        api_image_id = $apiImageId
        db_image = $dbImage
        db_image_id = $dbImageId
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
        foreach ($hash in $Config.payload_hashes.psobject.Properties) {
            $path = [string]$Config.payload_paths.($hash.Name)
            if (-not (Test-Path -LiteralPath $path)) { return $false }
            if ((Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant() -ne [string]$hash.Value) { return $false }
        }
        return $true
    } catch { return $false }
}

function Test-UokAutoStartTaskDefinition {
    param($Task, $Config, [string]$ConfigPath)
    try {
    if (-not $Task -or -not $Config -or -not (Test-UokManagedTask -Task $Task)) { return $false }
    if (@($Task.Actions).Count -ne 1 -or @($Task.Triggers).Count -ne 1 -or -not $Task.Settings.Enabled) { return $false }
    $action = @($Task.Actions) | Select-Object -First 1
    $trigger = @($Task.Triggers) | Select-Object -First 1
    $powerShellPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
    $expectedArguments = Get-UokTaskArguments -WorkerPath $Config.payload_paths.worker -ConfigPath $ConfigPath
    $expectedPrincipal = ([string]$Config.installed_user_id -split '\\')[-1]
    return $action.Execute -eq $powerShellPath -and $action.Arguments -eq $expectedArguments -and $action.WorkingDirectory -eq (Split-Path -Parent $ConfigPath) -and
        $Task.Principal.RunLevel -eq "Limited" -and $Task.Principal.LogonType -eq "Interactive" -and $Task.Principal.UserId -eq $expectedPrincipal -and
        $trigger.UserId -eq $Config.installed_user_id -and $trigger.Delay -eq "PT$($Config.delay_seconds)S" -and
        $Task.Settings.MultipleInstances -eq "IgnoreNew" -and $Task.Settings.RestartCount -eq 3 -and $Task.Settings.RestartInterval -eq "PT1M" -and
        $Task.Settings.ExecutionTimeLimit -eq "PT15M" -and $Task.Settings.StartWhenAvailable -and
        -not $Task.Settings.DisallowStartIfOnBatteries -and -not $Task.Settings.StopIfGoingOnBatteries
    } catch { return $false }
}
