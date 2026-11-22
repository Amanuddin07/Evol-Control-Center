# Dependency Documentation

| Package / API | Version | Purpose |
|---|---|---|
| `.NET 8 Windows Desktop SDK` | `8.0` | WPF UI, `PeriodicTimer`, `HttpListener`, `EventLog` |
| `LibreHardwareMonitorLib` | `0.9.3` | CPU MSR temperatures, package wattage, NVMe SMART temps, motherboard/EC sensor enumeration |
| `System.Management` | `8.0.0` | WMI queries (`Win32_BIOS`, `Win32_PhysicalMemory`, `Win32_Keyboard`, `MSAcpi_ThermalZoneTemperature`) |
| `Microsoft.Data.Sqlite` | `8.0.10` | Local profile, fan curve, and diagnostics event persistence |
| `nvml.dll` (NVIDIA Driver) | Driver-bundled | P/Invoke GPU die temp, hotspot, VRAM usage, TGP wattage, and clock throttle reasons |
| `user32.dll` / `powercfg.exe` | Windows Inbox | Documented display refresh-rate switching and Windows power scheme orchestration |
