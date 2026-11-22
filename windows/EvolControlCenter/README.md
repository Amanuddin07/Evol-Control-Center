# EVOL CONTROL CENTER — Windows .NET 8 Companion & Standalone App

Optimized for the **Colorful Evol P15 2024 India Edition** (Windows 11 x64).

## Build & Installation Instructions

### Prerequisites
1. Windows 10/11 (64-bit)
2. [.NET 8 SDK (x64)](https://dotnet.microsoft.com/en-us/download/dotnet/8.0)
3. Official NVIDIA GeForce Notebook Driver (includes `nvml.dll`)

### Build & Run
```powershell
cd EvolControlCenter
dotnet restore
dotnet build -c Release
dotnet run -c Release
```

### Connecting to the EVOL Web Console
When `EvolControlCenter.exe` runs on Windows, `LocalBridgeServer` listens exclusively on loopback `http://127.0.0.1:17830/`.
Open the EVOL CONTROL CENTER web interface -> Settings -> set Windows Companion Agent URL to `http://127.0.0.1:17830` and click **Connect Agent** to stream real LibreHardwareMonitor, NVML, and WMI sensor telemetry.
