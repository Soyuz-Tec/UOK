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
