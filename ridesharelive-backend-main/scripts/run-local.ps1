param(
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$mavenArgs = @("spring-boot:run", "-Dspring-boot.run.profiles=local")

if ($SkipTests) {
    $mavenArgs = @("-DskipTests") + $mavenArgs
}

Push-Location $projectRoot
try {
    & .\mvnw.cmd @mavenArgs
} finally {
    Pop-Location
}
