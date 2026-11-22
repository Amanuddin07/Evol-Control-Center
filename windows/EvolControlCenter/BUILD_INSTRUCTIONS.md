# BUILD INSTRUCTIONS — EVOL CONTROL CENTER (Windows 10 / 11 x64)

## Overview
This directory contains the complete, Windows-build-ready **.NET 8 WPF** application (`EVOL-Control-Center.exe`), automated PowerShell/Batch build scripts, Inno Setup installer configuration (`EVOL-Control-Center-Setup.exe`), and a GitHub Actions workflow (`/.github/workflows/build-windows.yml`).

> **Hardware Verification Notice:** Because this project was authored in a Linux container without physical **Colorful Evol P15 2024 India Edition** hardware, compilation on Windows and physical-laptop sensor behavior (NVIDIA NVML, LibreHardwareMonitor CPU MSRs, Embedded Controller fan RPMs, ACPI battery wear, and USB HID keyboard controls) are marked **unverified until executed on target Windows hardware**.

---

## Option A: Automated Cloud Build via GitHub Actions (No Local Compiler Required)
1. Push this repository (including `.github/workflows/build-windows.yml` and `windows/EvolControlCenter/`) to GitHub.
2. Open the repository's **Actions** tab and run **Build Windows Desktop App & Installer** (`workflow_dispatch` or push to `main`).
3. Once the `windows-latest` runner completes, download the published artifacts directly from the workflow run summary:
   - **`EVOL-Control-Center-Portable`** (`EVOL-Control-Center.exe` + `CHECKSUMS.txt`)
   - **`EVOL-Control-Center-Setup`** (`EVOL-Control-Center-Setup.exe` + `CHECKSUMS.txt`)

---

## Option B: One-Click Local Build on Windows 10 / 11
### Prerequisites
1. **Windows 10 (1809+) or Windows 11 (64-bit)**
2. **[.NET 8 SDK (x64)](https://dotnet.microsoft.com/en-us/download/dotnet/8.0)**
3. **[Inno Setup 6](https://jrsoftware.org/isinfo.php)** (for generating `EVOL-Control-Center-Setup.exe`)

### Build Steps
1. Open the `EvolControlCenter` folder.
2. Double-click **`build.bat`** (or run `.\build.ps1` in PowerShell).
3. The script automatically:
   - Restores NuGet packages (`LibreHardwareMonitorLib`, `System.Management`, `System.Diagnostics.EventLog`, `Microsoft.Data.Sqlite`).
   - Compiles and publishes a self-contained single-file executable (`publish\win-x64\EVOL-Control-Center.exe`) with the .NET 8 desktop runtime bundled.
   - Compiles `installer\EvolControlCenter.iss` via `ISCC.exe` to generate `dist\EVOL-Control-Center-Setup.exe`.
   - Computes `dist\CHECKSUMS.txt` (SHA-256 hashes for both `.exe` deliverables).

### Optional Authenticode Code Signing
Set these environment variables before running `build.ps1`:
```powershell
$env:EVOL_SIGN_CERT_PFX = "C:\certs\codesign.pfx"
$env:EVOL_SIGN_CERT_PASSWORD = "<your-pfx-password>"
.\build.ps1
```

---

## First-Time Launch Behavior on Windows
When `EVOL-Control-Center.exe` starts for the first time:
1. `FirstRunService` scans CPU, NVIDIA NVML GPU, RAM, NVMe storage, ACPI battery, cooling fan WMI tables, keyboard HID, and display refresh rates.
2. `ConfigStore` writes safe defaults to `%LOCALAPPDATA%\EvolControlCenter\config.json` (preserved across installer upgrades).
3. Unsupported hardware controls (e.g., locked 12th/13th Gen FIVR voltage offset or locked OEM EC fan writes) are labeled in the **Hardware Compatibility Report** tab rather than simulated.
