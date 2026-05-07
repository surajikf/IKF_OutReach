param(
    [switch]$SkipLint,
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"

function Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

function Pass($msg) {
    Write-Host "PASS: $msg" -ForegroundColor Green
}

function Warn($msg) {
    Write-Host "WARN: $msg" -ForegroundColor Yellow
}

function Fail($msg) {
    Write-Host "FAIL: $msg" -ForegroundColor Red
}

function Read-EnvFile([string]$path) {
    $map = @{}
    if (-not (Test-Path $path)) { return $map }
    Get-Content $path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $idx = $line.IndexOf("=")
        if ($idx -lt 1) { return }
        $k = $line.Substring(0, $idx).Trim()
        $v = $line.Substring($idx + 1).Trim().Trim('"')
        $map[$k] = $v
    }
    return $map
}

function Check-RequiredVars([hashtable]$envMap, [string[]]$keys, [string]$name) {
    $missing = @()
    foreach ($k in $keys) {
        if (-not $envMap.ContainsKey($k) -or [string]::IsNullOrWhiteSpace($envMap[$k])) {
            $missing += $k
        }
    }
    if ($missing.Count -gt 0) {
        Fail "$name missing vars: $($missing -join ', ')"
        return $false
    }
    Pass "$name required vars present"
    return $true
}

function Run-Npm([string]$cwd, [string]$cmd) {
    Step "$cwd :: npm run $cmd"
    Push-Location $cwd
    try {
        cmd /c "npm run $cmd"
        if ($LASTEXITCODE -ne 0) {
            throw "npm run $cmd failed in $cwd"
        }
    } finally {
        Pop-Location
    }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$frontend = Join-Path $root "frontend"
$backend = Join-Path $root "backend"

Step "Environment validation"
$backendEnvPath = Join-Path $backend ".env"
$frontendEnvPath = Join-Path $frontend ".env.local"
if (-not (Test-Path $frontendEnvPath)) {
    $frontendEnvPath = Join-Path $frontend ".env"
}

$backendEnv = Read-EnvFile $backendEnvPath
$frontendEnv = Read-EnvFile $frontendEnvPath

$backendOk = Check-RequiredVars $backendEnv @(
    "DATABASE_URL",
    "DIRECT_URL",
    "NEXTAUTH_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET"
) "backend/.env"

$frontendOk = Check-RequiredVars $frontendEnv @(
    "NEXTAUTH_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET"
) "frontend env"

if ($backendEnv.ContainsKey("DATABASE_URL") -and $backendEnv["DATABASE_URL"] -match ":([^:@/]+)@") {
    $dbUrl = $backendEnv["DATABASE_URL"]
    if ($dbUrl -match "://[^:]+:[^@]*@[^@]*@") {
        Warn "DATABASE_URL may contain unencoded '@' in password. Use %40 for '@'."
    } else {
        Pass "DATABASE_URL format looks valid"
    }
}

if ($backendEnv.ContainsKey("DIRECT_URL") -and $backendEnv["DIRECT_URL"] -match ":([^:@/]+)@") {
    $directUrl = $backendEnv["DIRECT_URL"]
    if ($directUrl -match "://[^:]+:[^@]*@[^@]*@") {
        Warn "DIRECT_URL may contain unencoded '@' in password. Use %40 for '@'."
    } else {
        Pass "DIRECT_URL format looks valid"
    }
}

if (-not $backendOk -or -not $frontendOk) {
    throw "Required environment variables are missing."
}

Step "Build and type checks"
Run-Npm $frontend "typecheck"
Run-Npm $frontend "build"
Run-Npm $backend "typecheck"

try {
    Run-Npm $backend "build"
} catch {
    Warn "Backend build failed. Common causes: Prisma engine lock on Windows or env path permission."
    throw
}

if (-not $SkipLint) {
    Step "Lint checks"
    try {
        Run-Npm $frontend "lint"
        Run-Npm $backend "lint"
    } catch {
        Warn "Lint failed. Not a runtime blocker, but required for strict quality gates."
        throw
    }
}

if (-not $SkipTests) {
    Step "Test checks"
    try {
        Run-Npm $backend "test -- --run"
    } catch {
        Warn "Tests failed or could not start. Check Vitest/esbuild permissions in this environment."
        throw
    }
}

Pass "Preflight complete. Project is ready based on selected checks."

