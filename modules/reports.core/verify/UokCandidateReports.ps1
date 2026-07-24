function Invoke-UokReportsCandidateScenario {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $installed = Invoke-UokJson -Method "POST" -Path "/api/modules/reports.core/install" -Headers $Headers
    if ($installed.status -ne "installed") {
        throw "Reports core install failed: $($installed | ConvertTo-Json -Depth 20)"
    }

    $formats = Invoke-UokJson -Path "/api/reports/formats" -Headers $OpsHeaders
    if (-not ($formats.formats -contains "csv") -or -not ($formats.formats -contains "json")) {
        throw "Reports formats are incomplete: $($formats | ConvertTo-Json -Depth 20)"
    }

    Assert-UokHttpFailure -StatusCode 403 -UnexpectedSuccessMessage "Viewer report generation unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $ViewerHeaders -Body @{
            command_type = "GenerateReport"
            payload = @{
                source_module = "contacts.core"
                template_key = "reports.denied"
                title = "Denied Report $Stamp"
                formats = @("json")
                payload = @{ rows = @(@{ name = "Denied" }) }
            }
            idempotency_key = "uok-report-denied-$Stamp"
        }
    }

    $generated = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "GenerateReport"
        payload = @{
            source_module = "contacts.core"
            template_key = "contacts.export"
            title = "Reports Candidate $Stamp"
            filename_base = "reports-candidate-$Stamp"
            formats = @("csv", "json", "md")
            payload = @{
                rows = @(
                    @{ name = "Safe Row"; amount = "42" },
                    @{ name = "Formula Guard"; amount = "=1+1" }
                )
            }
        }
        idempotency_key = "uok-report-generate-$Stamp"
    }
    if ($generated.result.artifact_count -ne 3) {
        throw "Report generation failed: $($generated | ConvertTo-Json -Depth 30)"
    }

    $replay = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "GenerateReport"
        payload = @{
            source_module = "contacts.core"
            template_key = "contacts.export"
            title = "Reports Candidate $Stamp"
            filename_base = "reports-candidate-$Stamp"
            formats = @("csv", "json", "md")
            payload = @{
                rows = @(
                    @{ name = "Safe Row"; amount = "42" },
                    @{ name = "Formula Guard"; amount = "=1+1" }
                )
            }
        }
        idempotency_key = "uok-report-generate-$Stamp"
    }
    if (-not $replay.idempotent) {
        throw "Report idempotency replay failed: $($replay | ConvertTo-Json -Depth 30)"
    }

    $csvArtifact = $generated.result.artifacts | Where-Object { $_.format -eq "csv" } | Select-Object -First 1
    if (-not $csvArtifact.id) {
        throw "CSV artifact was not returned: $($generated | ConvertTo-Json -Depth 30)"
    }

    $verify = Invoke-UokJson -Method "POST" -Path "/api/reports/artifacts/$($csvArtifact.id)/verify" -Headers $OpsHeaders
    if (-not $verify.ok) {
        throw "Report artifact verification failed: $($verify | ConvertTo-Json -Depth 20)"
    }

    $download = Invoke-WebRequest -UseBasicParsing -Method "GET" -Uri "$BaseUrl/api/reports/artifacts/$($csvArtifact.id)/download" -Headers $OpsHeaders
    if ($download.Content -notmatch "'=1\+1") {
        throw "CSV formula guard was not present in downloaded report: $($download.Content)"
    }

    return @{ artifact_id = $csvArtifact.id; artifact_count = $generated.result.artifact_count }
}
