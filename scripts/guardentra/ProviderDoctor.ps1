# Read-only provider metadata. Never return raw CLI output or credential values.
Set-StrictMode -Version Latest

function Get-GuardentraCliObservation {
    param([ValidateSet('codex','cursor','gemini','gcloud','grok')][string]$Name)
    $binding=Get-GuardentraProviderBinding $Name
    $paths=@(if ($binding.found) { $binding.executable })
    $observations=@()
    foreach ($path in @($paths | Select-Object -Unique)) {
        $item=[ordered]@{ executable=$path; identity='unverified'; version='unknown'; auth='not_probed'; verdict='NOT_AVAILABLE'; reason='CLI identity/version unverified'; headless_supported=$null }
        $executable=$binding.native; $prefix=@($binding.prefix)
        if ($Name -eq 'gemini') { $item.identity='Gemini CLI' }
        try {
            if ($Name -in @('cursor','grok')) {
                $help=Invoke-GuardentraProviderProcess -Executable $executable -Arguments ($prefix + @('--help')) -Directory $script:GuardentraRoot -TimeoutSeconds 15
                if ($help.ExitCode -eq 0 -and $help.Output -match '(?im)^Grok Build TUI\b') { $item.identity='Grok Build TUI' }
                elseif ($help.ExitCode -eq 0 -and $help.Output -match '(?im)^Cursor (Agent|CLI)\b|Start the Cursor Agent') { $item.identity='Cursor CLI' }
                if ($Name -eq 'cursor' -and $item.identity -ne 'Cursor CLI') {
                    $item.reason='command is not identified as Cursor; no Cursor flags or login attempted'
                    $observations += [pscustomobject]$item; continue
                }
            }
            $version=Invoke-GuardentraProviderProcess -Executable $executable -Arguments ($prefix + @('--version')) -Directory $script:GuardentraRoot -TimeoutSeconds 15
            $pattern=switch ($Name) {
                'codex' { '(?m)^codex-cli ([0-9][0-9A-Za-z.+-]{0,63})\s*$' }
                'gcloud' { '(?m)^Google Cloud SDK ([0-9.]{1,32})\s*$' }
                'grok' { '(?m)^(?:Grok|grok|agent)(?: (?:Build TUI|version))?\s+([0-9][0-9A-Za-z.+-]{0,63})(?:\s|$)' }
                default { '(?m)^(?:[A-Za-z -]+ )?([0-9][0-9A-Za-z.+-]{0,63})\s*$' }
            }
            if ($version.ExitCode -eq 0 -and $version.Output -match $pattern) {
                $item.version=$Matches[1]
                if ($Name -eq 'codex') { $item.identity='Codex CLI' }
                if ($Name -eq 'gcloud') { $item.identity='Google Cloud SDK' }
                $item.verdict='PASS'; $item.reason='CLI detected; version metadata only, not inference proof'
            }
            if ($Name -eq 'gcloud' -and $item.identity -eq 'Google Cloud SDK') {
                $item.auth='not_probed'
                $item.reason='SDK version only; no credential enumeration; Gemini auth/runtime unproven'
            }
            if ($Name -eq 'gemini') {
                $help=Invoke-GuardentraProviderProcess -Executable $executable -Arguments ($prefix + @('--help')) -Directory $script:GuardentraRoot -TimeoutSeconds 20
                $item.headless_supported=($help.ExitCode -eq 0 -and $help.Output -match 'Gemini CLI' -and $help.Output -match '--prompt' -and $help.Output -match '--output-format')
                $item.reason='headless flags detected; no authenticated inference or tool confinement proven'
                $item.auth='unproven'
            }
        } catch { $item.verdict='NOT_AVAILABLE'; $item.reason='CLI metadata probe refused or failed; raw output omitted' }
        $observations += [pscustomobject]$item
    }
    return [pscustomobject]@{ name=$Name; found=($paths.Count -gt 0); observations=@($observations); search='exact owner-verified paths and fixed native launcher entry points' }
}

function Get-GuardentraProviderDoctor {
    $cli=@{}
    foreach ($name in @('codex','cursor','gemini','gcloud','grok')) { $cli[$name]=Get-GuardentraCliObservation $name }
    $presence=[ordered]@{}
    foreach ($name in @('GEMINI_API_KEY','GOOGLE_API_KEY','GOOGLE_APPLICATION_CREDENTIALS','XAI_API_KEY','CURSOR_API_KEY','GUARDENTRA_GEMINI_MODEL','GUARDENTRA_XAI_MODEL')) {
        $presence[$name]=[bool][Environment]::GetEnvironmentVariable($name)
    }
    $rows=@()
    foreach ($provider in @('codex','cursor','gemini','cloud','grok','xai')) {
        $capability=Get-GuardentraProviderCapability $provider
        if ($capability.state -cnotin $script:GuardentraProviderStates) { throw 'REFUSED: invalid provider state' }
        $names=switch ($provider) { 'cloud' { @('gemini','gcloud') } 'gemini' { @('gemini','gcloud') } 'xai' { @('grok') } default { @($provider) } }
        $rows += [pscustomobject]@{
            provider=$provider; state=$capability.state; auth=$capability.auth
            capability=$capability; cli=@($names | ForEach-Object { $cli[$_] })
            noninteractive=($capability.state -eq 'available'); common_adapter='Invoke-GuardentraProposalAdapter'
            real_run='NOT_RUN'; verdict='NOT_AVAILABLE'; reason='doctor metadata alone is not a real inference run'
        }
    }
    return [pscustomobject]@{ schema='guardentra.provider-doctor.v1'; utc=[datetime]::UtcNow.ToString('o'); providers=$rows; credential_presence=$presence; probe_boundary='Read-only metadata; no login, install, permission edits or inference. Real runs require Live-Adapters.ps1.' }
}
