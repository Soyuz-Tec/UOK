param(
    [ValidateSet("Install", "Refresh", "Status", "Verify", "Disable", "Enable", "Uninstall")]
    [string]$Action = "Status",
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$TaskName = "UOK Podman Auto Start",
    [string]$MachineName = "podman-machine-default",
    [ValidateRange(0, 600)]
    [int]$DelaySeconds = 30,
    [ValidateRange(1, 1440)]
    [int]$CheckIntervalMinutes = 1,
    [switch]$RunNow,
    [switch]$ConfirmUninstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ContractVersion = "uok.windows-autostart.v1"
$TaskPath = "\UOK\"
$TaskDescription = "$ContractVersion managed task. Restores the frozen UOK local candidate after sign-in and during periodic health recovery."
. (Join-Path $PSScriptRoot "uok_autostart_support.ps1")

function Assert-UokWindowsAutoStartHost {
    if ($env:OS -ne "Windows_NT") { throw "UOK Windows auto-start operations require Windows." }
    if (-not $env:LOCALAPPDATA) { throw "LOCALAPPDATA is required for the UOK auto-start payload." }
}

function Get-UokAutoStartStatus {
    $paths = Get-UokAutoStartPaths
    $tasks = Get-UokNamedTasks
    $managed = @($tasks | Where-Object { Test-UokManagedTask -Task $_ })
    $task = $managed | Where-Object { $_.TaskPath -eq $TaskPath } | Select-Object -First 1
    $configPath = if ($task) { Get-UokTaskConfigPath -Task $task } else { $null }
    $config = $null
    if ($configPath -and (Test-Path -LiteralPath $configPath)) {
        try { $config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json } catch { $config = $null }
    }
    $checkInterval = if ($config) { Get-UokConfiguredCheckIntervalMinutes -Config $config } else { $null }
    $payloadOk = if ($config) { Test-UokAutoStartPayload -Config $config } else { $false }
    $definitionOk = if ($config) { Test-UokAutoStartTaskDefinition -Task $task -Config $config -ConfigPath $configPath } else { $false }
    $info = if ($task) { Get-ScheduledTaskInfo -TaskName $TaskName -TaskPath $TaskPath } else { $null }
    return [pscustomobject]@{
        Installed = [bool]$task
        Managed = $managed.Count -gt 0
        ForeignTaskPresent = @($tasks | Where-Object { -not (Test-UokManagedTask -Task $_) -and -not (Test-UokLegacyPrototypeTask -Task $_ -Paths $paths) }).Count -gt 0
        TaskDefinitionValid = $definitionOk
        State = if ($task) { $task.State } else { "Absent" }
        LastRunTime = if ($info) { $info.LastRunTime } else { $null }
        LastTaskResult = if ($info) { $info.LastTaskResult } else { $null }
        PayloadIntegrity = $payloadOk
        Disabled = Test-Path -LiteralPath $paths.Disabled
        SourceCommit = if ($config) { $config.source_commit } else { $null }
        SourceTreeState = if ($config -and $config.psobject.Properties["source_tree_state"]) { $config.source_tree_state } else { "legacy-unknown" }
        CheckIntervalMinutes = $checkInterval
        ConfigPath = $configPath
    }
}

function Install-UokAutoStart {
    $paths = Get-UokAutoStartPaths
    Assert-UokTaskOwnership -Paths $paths
    New-Item -ItemType Directory -Force -Path $paths.StateRoot, $paths.Releases | Out-Null
    $existingManaged = Get-UokNamedTasks | Where-Object { Test-UokManagedTask -Task $_ } | Select-Object -First 1
    $previousXml = $null
    $previousTaskPath = $null
    if ($existingManaged) {
        $previousTaskPath = $existingManaged.TaskPath
        $previousXml = Export-ScheduledTask -TaskName $TaskName -TaskPath $previousTaskPath
        $previousXml | Set-Content -LiteralPath $paths.TaskBackup -Encoding UTF8
    }

    $release = New-UokAutoStartReleasePaths -Paths $paths
    $hashes = Copy-UokAutoStartPayload -Release $release
    $userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $periodicStart = (Get-Date).AddMinutes(1)
    $periodicStart = $periodicStart.AddTicks(-($periodicStart.Ticks % [TimeSpan]::TicksPerSecond))
    $config = New-UokAutoStartConfig -Release $release -PayloadHashes $hashes -ConfiguredDelaySeconds $DelaySeconds -ConfiguredCheckIntervalMinutes $CheckIntervalMinutes -ConfiguredPeriodicStart $periodicStart -UserId $userId
    $config | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $release.Config -Encoding UTF8
    $config = Get-Content -Raw -LiteralPath $release.Config | ConvertFrom-Json
    if (-not (Test-UokAutoStartPayload -Config $config)) { throw "Staged UOK auto-start payload failed integrity validation." }

    Ensure-UokTaskFolder
    $powerShellPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
    $arguments = Get-UokTaskArguments -WorkerPath $release.Worker -ConfigPath $release.Config
    $action = New-ScheduledTaskAction -Execute $powerShellPath -Argument $arguments -WorkingDirectory $release.ReleaseRoot
    $logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
    $logonTrigger.Id = "UOKLogonRecovery"
    $logonTrigger.Delay = "PT${DelaySeconds}S"
    $periodicTrigger = New-ScheduledTaskTrigger -Once -At $periodicStart -RepetitionInterval (New-TimeSpan -Minutes $CheckIntervalMinutes)
    $periodicTrigger.Id = "UOKPeriodicRecovery"
    $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -MultipleInstances IgnoreNew
    $definition = New-ScheduledTask -Action $action -Trigger @($logonTrigger, $periodicTrigger) -Principal $principal -Settings $settings -Description $TaskDescription
    try {
        Register-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -InputObject $definition -Force | Out-Null
        $registered = Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath
        if (-not (Test-UokAutoStartTaskDefinition -Task $registered -Config $config -ConfigPath $release.Config)) {
            throw "Registered UOK auto-start task failed definition readback."
        }
    } catch {
        $failedTask = Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue
        if ($failedTask -and (Test-UokManagedTask -Task $failedTask)) { Unregister-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Confirm:$false }
        if ($previousXml) { Register-ScheduledTask -TaskName $TaskName -TaskPath $previousTaskPath -Xml $previousXml -Force | Out-Null }
        throw
    }
    foreach ($stale in @(Get-UokNamedTasks | Where-Object { (Test-UokManagedTask -Task $_) -and $_.TaskPath -ne $TaskPath })) {
        Unregister-ScheduledTask -TaskName $TaskName -TaskPath $stale.TaskPath -Confirm:$false
    }
    foreach ($legacy in @(Get-UokNamedTasks | Where-Object { Test-UokLegacyPrototypeTask -Task $_ -Paths $paths })) {
        Unregister-ScheduledTask -TaskName $TaskName -TaskPath $legacy.TaskPath -Confirm:$false
    }
    Get-UokAutoStartStatus | Format-List
    if ($RunNow) { Test-UokAutoStart }
}

function Test-UokAutoStart {
    $status = Get-UokAutoStartStatus
    if ($status.Disabled) { throw "UOK auto-start verification is unavailable while maintenance disable is active." }
    if (-not $status.Installed -or -not $status.PayloadIntegrity -or -not $status.TaskDefinitionValid) {
        throw "UOK auto-start is not installed with an intact payload and exact managed task definition."
    }
    $before = (Get-ScheduledTaskInfo -TaskName $TaskName -TaskPath $TaskPath).LastRunTime
    Start-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath
    $deadline = (Get-Date).AddMinutes(16)
    do {
        Start-Sleep -Seconds 2
        $task = Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath
        $info = Get-ScheduledTaskInfo -TaskName $TaskName -TaskPath $TaskPath
    } while ((($info.LastRunTime -le $before) -or $task.State -eq "Running") -and (Get-Date) -lt $deadline)
    if ($info.LastRunTime -le $before) { throw "UOK auto-start verification did not observe a new task run within 16 minutes." }
    if ($task.State -eq "Running" -or $info.LastTaskResult -ne 0) { throw "UOK auto-start verification failed with task result $($info.LastTaskResult)." }
    $config = Get-Content -Raw -LiteralPath $status.ConfigPath | ConvertFrom-Json
    $health = Invoke-RestMethod -UseBasicParsing -Uri "$($config.base_url)/health" -TimeoutSec 10
    if ($health.status -ne "ok" -or $health.name -ne $config.expected_name -or $health.version -ne $config.expected_version) { throw "UOK auto-start health identity verification failed." }
    Write-Host "UOK auto-start verification passed."
}

function Set-UokAutoStartDisabled {
    param([bool]$Disabled)
    $paths = Get-UokAutoStartPaths
    if ($Disabled) {
        New-Item -ItemType Directory -Force -Path $paths.StateRoot | Out-Null
        (Get-Date).ToUniversalTime().ToString("o") | Set-Content -LiteralPath $paths.Disabled -Encoding UTF8
    } elseif (Test-Path -LiteralPath $paths.Disabled) {
        Remove-Item -LiteralPath $paths.Disabled
    }
    Get-UokAutoStartStatus | Format-List
}

function Uninstall-UokAutoStart {
    if (-not $ConfirmUninstall) { throw "Use -ConfirmUninstall to remove the managed UOK auto-start task and installed payload." }
    $paths = Get-UokAutoStartPaths
    Assert-UokTaskOwnership -Paths $paths
    $tasks = Get-UokNamedTasks
    if (@($tasks | Where-Object { $_.State -eq "Running" }).Count -gt 0) { throw "Wait for the UOK auto-start task to finish before uninstalling." }
    foreach ($task in @($tasks)) {
        if ((Test-UokManagedTask -Task $task) -or (Test-UokLegacyPrototypeTask -Task $task -Paths $paths)) {
            Unregister-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -Confirm:$false
        }
    }
    foreach ($path in $paths.LegacyWorker, $paths.StableWorker, $paths.StableConfig, $paths.StableCompose, $paths.StableOverride, $paths.StableCapacity, $paths.Disabled, $paths.TaskBackup) {
        if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
    }
    if (Test-Path -LiteralPath $paths.Releases) {
        $resolvedStateRoot = [System.IO.Path]::GetFullPath($paths.StateRoot + [System.IO.Path]::DirectorySeparatorChar)
        $resolvedReleases = [System.IO.Path]::GetFullPath($paths.Releases)
        if (-not $resolvedReleases.StartsWith($resolvedStateRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Refusing to remove an auto-start release path outside the managed state root." }
        Remove-Item -LiteralPath $resolvedReleases -Recurse -Force
    }
    Write-Host "Removed the owned UOK auto-start task and payload. Containers, images, volumes, database data, and logs were left unchanged."
}

Assert-UokWindowsAutoStartHost
$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)
switch ($Action) {
    "Install" { Install-UokAutoStart }
    "Refresh" {
        $status = Get-UokAutoStartStatus
        if ($status.Installed) {
            if (-not $PSBoundParameters.ContainsKey("CheckIntervalMinutes") -and $null -ne $status.CheckIntervalMinutes) {
                $CheckIntervalMinutes = [int]$status.CheckIntervalMinutes
            }
            Install-UokAutoStart
        }
    }
    "Status" { Get-UokAutoStartStatus | Format-List }
    "Verify" { Test-UokAutoStart }
    "Disable" { Set-UokAutoStartDisabled -Disabled $true }
    "Enable" { Set-UokAutoStartDisabled -Disabled $false }
    "Uninstall" { Uninstall-UokAutoStart }
}
