param(
    [switch]$SkipTests,
    [switch]$SkipDependencies,
    [string]$EnvFile = ""
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$mavenArgs = @("spring-boot:run", "-Dspring-boot.run.profiles=postgres")

function Import-EnvFile {
    param(
        [string]$Path
    )

    if (-not (Test-Path $Path)) {
        return
    }

    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) {
            return
        }

        $parts = $line.Split("=", 2)
        if ($parts.Count -ne 2) {
            return
        }

        $name = $parts[0].Trim()
        if (-not $name) {
            return
        }
        $value = $parts[1].Trim()
        Set-Item -Path ("Env:{0}" -f $name) -Value $value
    }
}

if ($SkipTests) {
    $mavenArgs = @("-DskipTests") + $mavenArgs
}

Push-Location $projectRoot
try {
    if ($EnvFile -and $EnvFile.Trim()) {
        $resolvedEnvFile = Join-Path $projectRoot $EnvFile
        Import-EnvFile -Path $resolvedEnvFile
    }

    if (-not $SkipDependencies) {
        docker compose up -d postgresdb redis
    }

    & .\mvnw.cmd @mavenArgs
} finally {
    Pop-Location
}
