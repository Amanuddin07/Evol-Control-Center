[CmdletBinding()]
param(
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [switch]$SkipInstaller
)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectFile = Join-Path $ProjectDir "EvolControlCenter.csproj"
$PublishDir = Join-Path $ProjectDir "publish\$Runtime"
$DistDir = Join-Path $ProjectDir "dist"
$IssFile = Join-Path $ProjectDir "installer\EvolControlCenter.iss"

Write-Host "=== EVOL CONTROL CENTER Windows Build Pipeline ===" -ForegroundColor Cyan

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw ".NET 8 SDK ('dotnet') was not found on PATH. Install .NET 8 SDK x64 first."
}

$dotnetVersion = & dotnet --version
Write-Host "Detected .NET SDK: $dotnetVersion"

if (Test-Path $PublishDir) { Remove-Item -Recurse -Force $PublishDir }
if (-not (Test-Path $DistDir)) { New-Item -ItemType Directory -Path $DistDir | Out-Null }

Write-Host "Restoring NuGet packages..." -ForegroundColor Yellow
& dotnet restore $ProjectFile -r $Runtime
if ($LASTEXITCODE -ne 0) { throw "dotnet restore failed." }

Write-Host "Building $Configuration ($Runtime)..." -ForegroundColor Yellow
& dotnet build $ProjectFile -c $Configuration -r $Runtime --no-restore
if ($LASTEXITCODE -ne 0) { throw "dotnet build failed." }

Write-Host "Publishing self-contained single-file EVOL-Control-Center.exe..." -ForegroundColor Yellow
& dotnet publish $ProjectFile `
    -c $Configuration `
    -r $Runtime `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=true `
    -p:DebugType=None `
    -p:DebugSymbols=false `
    -o $PublishDir
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed." }

$ExePath = Join-Path $PublishDir "EVOL-Control-Center.exe"
if (-not (Test-Path $ExePath)) {
    throw "Expected executable not found at $ExePath"
}

Copy-Item $ExePath (Join-Path $DistDir "EVOL-Control-Center.exe") -Force

# Optional Authenticode signing if certificate env var is supplied
if ($env:EVOL_SIGN_CERT_PFX -and (Test-Path $env:EVOL_SIGN_CERT_PFX)) {
    $signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($signtool) {
        Write-Host "Signing EVOL-Control-Center.exe..." -ForegroundColor Yellow
        & $signtool.Source sign /fd SHA256 /f $env:EVOL_SIGN_CERT_PFX /p $env:EVOL_SIGN_CERT_PASSWORD /tr http://timestamp.digicert.com /td SHA256 (Join-Path $DistDir "EVOL-Control-Center.exe")
    }
}

if (-not $SkipInstaller) {
    $isccCandidates = @(
        (Get-Command ISCC.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles}\Inno Setup 6\ISCC.exe",
        "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
    ) | Where-Object { $_ -and (Test-Path $_) }

    $iscc = $isccCandidates | Select-Object -First 1
    if (-not $iscc) {
        throw "Inno Setup 6 (ISCC.exe) not found. Install Inno Setup 6 or run with -SkipInstaller."
    }

    Write-Host "Compiling Windows installer via Inno Setup: $iscc" -ForegroundColor Yellow
    & $iscc "/DPublishDir=$PublishDir" "/DOutputDir=$DistDir" $IssFile
    if ($LASTEXITCODE -ne 0) { throw "Inno Setup compilation failed." }

    $SetupExe = Join-Path $DistDir "EVOL-Control-Center-Setup.exe"
    if (-not (Test-Path $SetupExe)) {
        throw "Expected installer not found at $SetupExe"
    }
    if ($env:EVOL_SIGN_CERT_PFX -and (Test-Path $env:EVOL_SIGN_CERT_PFX) -and (Get-Command signtool.exe -ErrorAction SilentlyContinue)) {
        Write-Host "Signing EVOL-Control-Center-Setup.exe..." -ForegroundColor Yellow
        & signtool.exe sign /fd SHA256 /f $env:EVOL_SIGN_CERT_PFX /p $env:EVOL_SIGN_CERT_PASSWORD /tr http://timestamp.digicert.com /td SHA256 $SetupExe
    }
}

# Generate SHA-256 verification checksums
$checksumFile = Join-Path $DistDir "CHECKSUMS.txt"
Get-ChildItem -Path $DistDir -Filter "*.exe" | ForEach-Object {
    $hash = (Get-FileHash -Path $_.FullName -Algorithm SHA256).Hash
    "$hash  $($_.Name)"
} | Set-Content -Path $checksumFile -Encoding UTF8

Write-Host "Build completed successfully. Outputs in: $DistDir" -ForegroundColor Green
Get-ChildItem -Path $DistDir
