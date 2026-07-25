function ConvertTo-UokToolVersion {
    param(
        [ValidateSet("Python", "Node.js", "npm")]
        [string]$Tool,
        [Parameter(Mandatory = $true)]
        [string]$Output
    )

    $text = $Output.Trim()
    $pattern = switch ($Tool) {
        "Python" { "^Python (?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$" }
        "Node.js" { "^v(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$" }
        "npm" { "^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$" }
    }
    $match = [regex]::Match(
        $text,
        $pattern,
        [System.Text.RegularExpressions.RegexOptions]::CultureInvariant
    )
    if (-not $match.Success) {
        throw "$Tool returned an unsupported version format: '$text'."
    }

    return [version]::new(
        [int]$match.Groups["major"].Value,
        [int]$match.Groups["minor"].Value,
        [int]$match.Groups["patch"].Value
    )
}

function Get-UokToolRequirement {
    param([ValidateSet("Python", "Node.js", "npm")][string]$Tool)

    switch ($Tool) {
        "Python" {
            return [pscustomobject]@{
                Tool = $Tool
                Command = "python"
                Arguments = @("--version")
                Minimum = [version]"3.14.0"
                Maximum = [version]"3.15.0"
                Display = "Python >=3.14,<3.15"
            }
        }
        "Node.js" {
            return [pscustomobject]@{
                Tool = $Tool
                Command = "node"
                Arguments = @("--version")
                Minimum = [version]"26.0.0"
                Maximum = [version]"27.0.0"
                Display = "Node.js >=26,<27"
            }
        }
        "npm" {
            return [pscustomobject]@{
                Tool = $Tool
                Command = "npm"
                Arguments = @("--version")
                Minimum = [version]"11.0.0"
                Maximum = [version]"12.0.0"
                Display = "npm >=11,<12"
            }
        }
    }
}

function Test-UokToolVersionSupported {
    param(
        [ValidateSet("Python", "Node.js", "npm")]
        [string]$Tool,
        [Parameter(Mandatory = $true)]
        [version]$Version
    )

    $requirement = Get-UokToolRequirement -Tool $Tool
    return $Version -ge $requirement.Minimum -and $Version -lt $requirement.Maximum
}

function Get-UokExecutableCommand {
    param([Parameter(Mandatory = $true)][string]$Name)

    return Get-Command -Name $Name -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandType -in @("Application", "ExternalScript") } |
        Select-Object -First 1
}

function Get-UokToolCandidate {
    param(
        [ValidateSet("Python", "Node.js", "npm")]
        [string]$Tool,
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $requirement = Get-UokToolRequirement -Tool $Tool
    try {
        $lines = @(& $Path @($requirement.Arguments) 2>&1)
        $exitCode = $LASTEXITCODE
    } catch {
        return $null
    }
    if ($exitCode -ne 0 -or $lines.Count -ne 1) {
        return $null
    }
    try {
        $version = ConvertTo-UokToolVersion -Tool $Tool -Output "$($lines[0])"
    } catch {
        return $null
    }
    if (-not (Test-UokToolVersionSupported -Tool $Tool -Version $version)) {
        return $null
    }
    return [pscustomobject]@{
        Tool = $Tool
        Path = $Path
        Version = $version
    }
}
