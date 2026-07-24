function Invoke-UokStep {
    param([string]$Name, [scriptblock]$Body)
    Write-Host "==> $Name"
    & $Body
}

function Invoke-Native {
    param([string]$File, [string[]]$Arguments)
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$File exited with $LASTEXITCODE"
    }
}

function Sync-UokApiRecoveryImageTag {
    param([Parameter(Mandatory = $true)][string]$RuntimeProject)

    $containerName = "$RuntimeProject-api-1"
    $imageId = "$(
        & podman container inspect --format "{{.Image}}" $containerName |
            Select-Object -Last 1
    )".Trim()
    if ($LASTEXITCODE -ne 0 -or -not $imageId) {
        throw "Unable to resolve the exact API image for $containerName."
    }
    $recoveryImage = "docker.io/library/uok-api:latest"
    Invoke-Native "podman" @("tag", $imageId, $recoveryImage)
    $tagId = "$(
        & podman image inspect --format "{{.Id}}" $recoveryImage |
            Select-Object -Last 1
    )".Trim()
    if ($LASTEXITCODE -ne 0 -or $tagId -ne $imageId) {
        throw "The governed recovery API image tag does not match the live container."
    }
}
