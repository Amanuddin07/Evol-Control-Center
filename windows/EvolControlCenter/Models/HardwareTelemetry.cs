using System;
using System.Collections.Generic;

namespace EvolControlCenter.Models;

public sealed class HardwareTelemetry
{
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
    public string Source { get; set; } = "windows-agent";
    public string HostPlatform { get; set; } = "win32";

    // CPU
    public string CpuModel { get; set; } = "Detecting...";
    public int CpuCores { get; set; }
    public int CpuThreads { get; set; }
    public double? CpuClockMhz { get; set; }
    public double CpuUtilizationPct { get; set; }
    public double? CpuTemperatureC { get; set; }
    public List<double> CoreTemperaturesC { get; set; } = new();
    public double? CpuPackagePowerW { get; set; }
    public double? CpuVoltageV { get; set; }
    public bool? CpuThermalThrottling { get; set; }
    public bool? CpuPowerLimitThrottling { get; set; }

    // GPU (NVIDIA NVML)
    public bool GpuAvailable { get; set; }
    public string? GpuModel { get; set; }
    public double? GpuUtilizationPct { get; set; }
    public double? GpuTemperatureC { get; set; }
    public double? GpuHotspotC { get; set; }
    public double? GpuClockMhz { get; set; }
    public double? GpuVramUsedMb { get; set; }
    public double? GpuVramTotalMb { get; set; }
    public double? GpuPowerW { get; set; }
    public int? GpuFanRpm { get; set; }
    public bool? GpuThermalThrottling { get; set; }

    // Memory & Storage
    public double RamTotalGb { get; set; }
    public double RamAvailableGb { get; set; }
    public double RamUtilizationPct { get; set; }
    public int? RamFrequencyMhz { get; set; }
    public int? RamModuleCount { get; set; }

    public string? SsdModel { get; set; }
    public double SsdTotalGb { get; set; }
    public double SsdAvailableGb { get; set; }
    public double? SsdTemperatureC { get; set; }
    public string? SsdSmartStatus { get; set; }

    // Fans & Battery
    public int? CpuFanRpm { get; set; }
    public int? GpuFanRpmEc { get; set; }
    public bool EcFanWriteSupported { get; set; }

    public bool BatteryPresent { get; set; }
    public int? BatteryPct { get; set; }
    public string BatteryStatus { get; set; } = "Unknown";
    public double? BatteryWearPct { get; set; }
    public double? BatteryChargeRateW { get; set; }
    public int? BatteryCycleCount { get; set; }
    public bool? AcConnected { get; set; }

    // Platform
    public string? Motherboard { get; set; }
    public string? BiosVendor { get; set; }
    public string? BiosVersion { get; set; }
    public string? BiosReleaseDate { get; set; }
    public string OsVersion { get; set; } = Environment.OSVersion.ToString();
    public string? DisplayResolution { get; set; }
    public int? DisplayRefreshHz { get; set; }
    public List<int> SupportedRefreshRates { get; set; } = new();
}
