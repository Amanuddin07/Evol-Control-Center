using System;
using System.Collections.Generic;
using EvolControlCenter.Engines;
using EvolControlCenter.Models;

namespace EvolControlCenter.Services;

public sealed record CapabilityCheckItem(string Subsystem, string Status, string Details);

public sealed record FirstRunReport(
    DateTime CompletedAtUtc,
    string DetectedPlatform,
    IReadOnlyList<CapabilityCheckItem> Capabilities,
    string Summary);

/// <summary>
/// Automates first-time launch hardware detection, dependency verification,
/// safe default initialization, and compatibility reporting.
/// </summary>
public sealed class FirstRunService
{
    public FirstRunReport Initialize(
        EvolAppConfig config,
        ConfigStore store,
        HardwareTelemetry initialTelemetry,
        FanManagementEngine fanEngine,
        KeyboardEngine keyboardEngine,
        DisplayManagementEngine displayEngine)
    {
        var items = new List<CapabilityCheckItem>
        {
            new("CPU Sensors (LibreHardwareMonitor)",
                initialTelemetry.CpuTemperatureC.HasValue ? "Supported" : "Limited / Admin MSR Recommended",
                $"{initialTelemetry.CpuModel} ({initialTelemetry.CpuThreads} threads)"),
            new("NVIDIA GPU (NVML)",
                initialTelemetry.GpuAvailable ? "Supported" : "Unavailable",
                initialTelemetry.GpuModel ?? "No NVIDIA NVML adapter initialized."),
            new("Cooling Fans & EC",
                fanEngine.IsDirectEcControlSupported ? "Full EC Control" : "Read-Only / Safe Power Fallback",
                fanEngine.CapabilityNote),
            new("Keyboard Controller",
                keyboardEngine.PerKeyRgbSupported ? "Per-Key RGB" : "Single-Zone / OS Macros",
                keyboardEngine.ControllerSummary),
            new("Display Refresh Switching",
                displayEngine.GetSupportedRefreshRates().Count > 0 ? "Supported" : "Unavailable",
                $"Detected rates: {string.Join(", ", displayEngine.GetSupportedRefreshRates())} Hz"),
            new("Battery ACPI",
                initialTelemetry.BatteryPresent ? "Supported" : "No Battery / AC Only",
                initialTelemetry.BatteryPresent ? $"Status: {initialTelemetry.BatteryStatus}" : "No ACPI battery reported."),
        };

        if (!config.FirstRunCompleted)
        {
            config.FirstRunCompleted = true;
            config.ActiveMode = "work";
            store.Save(config);
        }

        var platform = $"{initialTelemetry.Motherboard ?? "Generic Laptop"} · {initialTelemetry.CpuModel}";
        var summary = $"Hardware audit complete ({items.Count} subsystems checked). Safe Work Mode defaults active.";
        return new FirstRunReport(DateTime.UtcNow, platform, items, summary);
    }
}
