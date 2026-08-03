function Get-UokPathDirectories {
    param([switch]$IncludeWindowsEnvironment)

    $values = @($env:PATH)
    if ($IncludeWindowsEnvironment) {
        $values += [Environment]::GetEnvironmentVariable("Path", "User")
        $values += [Environment]::GetEnvironmentVariable("Path", "Machine")
    }
    $separator = [regex]::Escape([string][IO.Path]::PathSeparator)
    $seen = [Collections.Generic.HashSet[string]]::new(
        [StringComparer]::OrdinalIgnoreCase
    )
    foreach ($value in $values) {
        foreach ($entry in @("$value" -split $separator)) {
            $directory = [Environment]::ExpandEnvironmentVariables($entry.Trim().Trim('"'))
            if ($directory -and $seen.Add($directory)) {
                Write-Output $directory
            }
        }
    }
}

function Add-UokPathPrefixes {
    param([Parameter(Mandatory = $true)][string[]]$Directories)

    $current = @(Get-UokPathDirectories)
    $combined = @($Directories) + $current
    $seen = [Collections.Generic.HashSet[string]]::new(
        [StringComparer]::OrdinalIgnoreCase
    )
    $ordered = foreach ($directory in $combined) {
        if ($directory -and $seen.Add($directory)) {
            $directory
        }
    }
    $env:PATH = $ordered -join [IO.Path]::PathSeparator
}

function Find-UokTargetInDirectories {
    param(
        [ValidateSet("Python", "Node.js", "npm")]
        [string]$Tool,
        [Parameter(Mandatory = $true)]
        [string[]]$Directories,
        [Parameter(Mandatory = $true)]
        [string[]]$FileNames
    )

    foreach ($directory in $Directories) {
        foreach ($fileName in $FileNames) {
            $path = Join-Path $directory $fileName
            if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
                continue
            }
            $candidate = Get-UokToolCandidate -Tool $Tool -Path $path
            if ($null -ne $candidate) {
                return $candidate
            }
        }
    }
    return $null
}

function Find-UokTargetPython {
    param([Parameter(Mandatory = $true)][string]$RepoRoot)

    $onWindows = $env:OS -eq "Windows_NT"
    $venvNames = if ($onWindows) { @("python.exe") } else { @("python") }
    $venvDirectories = @(
        (Join-Path $RepoRoot ".venv\Scripts"),
        (Join-Path $RepoRoot ".venv/bin")
    )
    $candidate = Find-UokTargetInDirectories `
        -Tool "Python" `
        -Directories $venvDirectories `
        -FileNames $venvNames
    if ($null -ne $candidate) {
        return $candidate
    }

    if ($onWindows) {
        $launcher = Get-UokExecutableCommand -Name "py"
        if ($null -ne $launcher) {
            try {
                $lines = @(
                    & $launcher.Path -3.14 -c "import sys; print(sys.executable)" 2>&1
                )
                $exitCode = $LASTEXITCODE
            } catch {
                $exitCode = 1
                $lines = @()
            }
            if ($exitCode -eq 0 -and $lines.Count -eq 1) {
                $pythonPath = "$($lines[0])".Trim()
                if (Test-Path -LiteralPath $pythonPath -PathType Leaf) {
                    $candidate = Get-UokToolCandidate -Tool "Python" -Path $pythonPath
                    if ($null -ne $candidate) {
                        return $candidate
                    }
                }
            }
        }
    }

    $directories = @(Get-UokPathDirectories -IncludeWindowsEnvironment:$onWindows)
    $fileNames = if ($onWindows) { @("python.exe") } else { @("python3", "python") }
    return Find-UokTargetInDirectories `
        -Tool "Python" `
        -Directories $directories `
        -FileNames $fileNames
}

function Find-UokTargetNode {
    $onWindows = $env:OS -eq "Windows_NT"
    $directories = @(Get-UokPathDirectories -IncludeWindowsEnvironment:$onWindows)
    $fileNames = if ($onWindows) { @("node.exe") } else { @("node") }
    return Find-UokTargetInDirectories `
        -Tool "Node.js" `
        -Directories $directories `
        -FileNames $fileNames
}

function Find-UokPairedNpm {
    param([Parameter(Mandatory = $true)][string]$NodePath)

    $directory = Split-Path -Parent $NodePath
    $fileNames = if ($env:OS -eq "Windows_NT") {
        @("npm.cmd", "npm.ps1", "npm.exe", "npm")
    } else {
        @("npm")
    }
    return Find-UokTargetInDirectories `
        -Tool "npm" `
        -Directories @($directory) `
        -FileNames $fileNames
}

function Assert-UokResolvedTool {
    param(
        [ValidateSet("Python", "Node.js", "npm")][string]$Tool,
        [string]$ExpectedDirectory = ""
    )

    $requirement = Get-UokToolRequirement -Tool $Tool
    $command = Get-UokExecutableCommand -Name $requirement.Command
    if ($null -eq $command) {
        throw "UOK target toolchain preflight failed: $($requirement.Command) is unavailable."
    }
    $candidate = Get-UokToolCandidate -Tool $Tool -Path $command.Path
    if ($null -eq $candidate) {
        $lines = @(& $command.Path @($requirement.Arguments) 2>&1)
        $actual = "$($lines -join ' ')".Trim()
        throw (
            "UOK target toolchain preflight failed: $Tool at '$($command.Path)' " +
            "reported '$actual'; required $($requirement.Display)."
        )
    }
    if ($ExpectedDirectory) {
        $actualDirectory = (Resolve-Path -LiteralPath (Split-Path -Parent $command.Path)).Path
        $requiredDirectory = (Resolve-Path -LiteralPath $ExpectedDirectory).Path
        if ($actualDirectory -ne $requiredDirectory) {
            throw (
                "UOK target toolchain preflight failed: npm must come from the " +
                "selected Node.js directory '$requiredDirectory', not '$actualDirectory'."
            )
        }
    }
    Write-Host "$Tool $($candidate.Version) [$($candidate.Path)]"
}

function Assert-UokTargetToolchain {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [switch]$Force
    )

    if (
        -not $Force `
        -and $script:UokVerifiedToolchainPath `
        -and $script:UokVerifiedToolchainPath -eq $env:PATH
    ) {
        return
    }

    $python = Find-UokTargetPython -RepoRoot $RepoRoot
    if ($null -eq $python) {
        throw "UOK target toolchain preflight failed: Python >=3.14,<3.15 was not found."
    }
    $node = Find-UokTargetNode
    if ($null -eq $node) {
        throw "UOK target toolchain preflight failed: Node.js >=26,<27 was not found."
    }

    $nodeDirectory = Split-Path -Parent $node.Path
    $npm = Find-UokPairedNpm -NodePath $node.Path
    if ($null -eq $npm) {
        throw (
            "UOK target toolchain preflight failed: the selected Node.js installation " +
            "'$nodeDirectory' has no compatible npm >=11,<12."
        )
    }
    Add-UokPathPrefixes -Directories @(
        (Split-Path -Parent $python.Path),
        $nodeDirectory
    )
    Write-Host "==> UOK target toolchain"
    Assert-UokResolvedTool -Tool "Python"
    Assert-UokResolvedTool -Tool "Node.js"
    Assert-UokResolvedTool -Tool "npm" -ExpectedDirectory $nodeDirectory
    Write-Host "No toolchain software was downloaded or installed."
    $script:UokVerifiedToolchainPath = $env:PATH
}

function Test-UokActionRequiresTargetToolchain {
    param([Parameter(Mandatory = $true)][string]$Action)

    return $Action -in @(
        "ToolchainPreflight",
        "Audit",
        "TechnologyAudit",
        "EngineeringEvidence",
        "UiProof",
        "Verify",
        "Rebuild",
        "PlanningReleaseReadiness",
        "AsuhTest"
    )
}
