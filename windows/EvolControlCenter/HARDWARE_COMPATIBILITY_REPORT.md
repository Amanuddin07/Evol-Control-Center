# Hardware Compatibility Report — Colorful Evol P15 2024 India Edition

## 1. Platform Overview
The Colorful Evol P15 2024 India Edition pairs 12th/13th Gen Intel Core H-series processors (`i5-12450H`, `i7-12650H`, `i7-13620H`) with NVIDIA GeForce `RTX 4050` or `RTX 4060` Laptop GPUs on a Clevo/Tongfang-derived ODM chassis.

## 2. Interface Support Assessment
- **CPU Sensors & Power (`LibreHardwareMonitor` + `PowrProf`)**: Package temperature, per-core temperatures, clock speeds, and package wattage are readable. FIVR core voltage offset (undervolting) is hardware-locked on non-HX 12th/13th Gen mobile CPUs; EVOL uses safe Windows processor boost policies (`PERFBOOSTMODE`) and power plans instead.
- **NVIDIA Discrete GPU (`NVML`)**: Full read access to utilization, core/hotspot temperature, VRAM allocation, core clock, board power (W), and throttle flags.
- **Embedded Controller (EC) & Fans**: Read-only ACPI/SuperIO RPM sensing where exposed by firmware. Direct EC register writing is intentionally avoided unless a signed manufacturer WMI method is present, preventing fan lockups or EC corruption.
- **Keyboard Lighting**: The India Edition chassis ships with a single-zone/15-color backlight controller rather than per-key addressable RGB LEDs. Per-key RGB matrices are flagged unavailable; OS-level macro profiles and hotkeys remain supported.
- **Display Management**: Instant refresh-rate switching (`60 Hz <-> 144 Hz / 165 Hz`) via `User32` APIs with automatic rollback protection. Color profiles operate via Windows GDI `GammaRamp` (software calibration).
- **BIOS / UEFI**: Read-only SMBIOS telemetry (`Win32_BIOS`) plus safe `shutdown /r /fw` restart into UEFI setup. Silent BIOS flashing is never performed.
