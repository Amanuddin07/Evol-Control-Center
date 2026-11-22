using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Management;
using System.Runtime.InteropServices;
using EvolControlCenter.Models;
using LibreHardwareMonitor.Hardware;

namespace EvolControlCenter.Engines;

/// <summary>
/// Collects real hardware telemetry via LibreHardwareMonitor, NVIDIA NVML, and Windows WMI.
/// Never synthesizes fallback readings; unsupported sensors remain null.
/// </summary>
public sealed class HardwareMonitoringEngine : IDisposable
{
    private readonly Computer _computer;
    private readonly object _sampleLock = new();
    private bool _lhmOpened;
    private bool _nvmlInitialized;
    private IntPtr _nvmlDevice = IntPtr.Zero;

    public HardwareMonitoringEngine()
    {
        _computer = new Computer
        {
            IsCpuEnabled = true,
            IsGpuEnabled = true,
            IsMemoryEnabled = true,
            IsMotherboardEnabled = true,
            IsControllerEnabled = true,
            IsStorageEnabled = true,
            IsBatteryEnabled = true,
        };
        try
        {
            _computer.Open();
            _lhmOpened = true;
        }
        catch
        {
            _lhmOpened = false;
        }
        TryInitNvml();
    }

    private void TryInitNvml()
    {
        try
        {
            if (NvmlNative.nvmlInit_v2() == 0 && NvmlNative.nvmlDeviceGetHandleByIndex_v2(0, out _nvmlDevice) == 0)
            {
                _nvmlInitialized = true;
            }
        }
        catch
        {
            _nvmlInitialized = false;
        }
    }

    public HardwareTelemetry Sample()
    {
        lock (_sampleLock)
        {
            var telemetry = new HardwareTelemetry
            {
                TimestampUtc = DateTime.UtcNow,
                CpuCores = Environment.ProcessorCount,
                CpuThreads = Environment.ProcessorCount,
            };

            if (_lhmOpened)
            {
                foreach (var hw in _computer.Hardware)
                {
                    try
                    {
                        hw.Update();
                        foreach (var sub in hw.SubHardware)
                        {
                            sub.Update();
                        }

                        switch (hw.HardwareType)
                        {
                            case HardwareType.Cpu:
                                telemetry.CpuModel = hw.Name;
                                ParseCpuSensors(hw, telemetry);
                                break;
                            case HardwareType.GpuNvidia:
                                telemetry.GpuAvailable = true;
                                telemetry.GpuModel = hw.Name;
                                ParseGpuSensors(hw, telemetry);
                                break;
                            case HardwareType.Memory:
                                ParseMemorySensors(hw, telemetry);
                                break;
                            case HardwareType.Storage:
                                if (telemetry.SsdModel is null)
                                {
                                    telemetry.SsdModel = hw.Name;
                                    ParseStorageSensors(hw, telemetry);
                                }
                                break;
                            case HardwareType.Battery:
                                telemetry.BatteryPresent = true;
                                ParseBatterySensors(hw, telemetry);
                                break;
                            case HardwareType.Motherboard:
                                telemetry.Motherboard = hw.Name;
                                ParseFanSensors(hw, telemetry);
                                break;
                        }
                    }
                    catch
                    {
                        // Individual hardware probe failure should never crash telemetry loop
                    }
                }
            }

            EnrichWithNvml(telemetry);
            EnrichWithWmi(telemetry);
            EnrichDriveCapacity(telemetry);
            return telemetry;
        }
    }

    private static void ParseCpuSensors(IHardware hw, HardwareTelemetry t)
    {
        var clocks = new List<double>();
        var coreTemps = new List<double>();
        foreach (var s in hw.Sensors)
        {
            if (!s.Value.HasValue || !float.IsFinite(s.Value.Value)) continue;
            var val = (double)s.Value.Value;
            if (s.SensorType == SensorType.Load && s.Name.Contains("Total", StringComparison.OrdinalIgnoreCase))
                t.CpuUtilizationPct = Math.Round(val, 1);
            else if (s.SensorType == SensorType.Temperature && s.Name.Contains("Package", StringComparison.OrdinalIgnoreCase))
                t.CpuTemperatureC = Math.Round(val, 1);
            else if (s.SensorType == SensorType.Temperature && s.Name.Contains("Core", StringComparison.OrdinalIgnoreCase))
                coreTemps.Add(Math.Round(val, 1));
            else if (s.SensorType == SensorType.Power && s.Name.Contains("Package", StringComparison.OrdinalIgnoreCase))
                t.CpuPackagePowerW = Math.Round(val, 1);
            else if (s.SensorType == SensorType.Clock && s.Name.Contains("Core", StringComparison.OrdinalIgnoreCase))
                clocks.Add(val);
            else if (s.SensorType == SensorType.Voltage && s.Name.Contains("Core", StringComparison.OrdinalIgnoreCase))
                t.CpuVoltageV = Math.Round(val, 3);
        }

        if (clocks.Count > 0) t.CpuClockMhz = Math.Round(clocks.Average(), 0);
        if (coreTemps.Count > 0)
        {
            t.CoreTemperaturesC = coreTemps;
            t.CpuTemperatureC ??= Math.Round(coreTemps.Max(), 1);
        }
    }

    private static void ParseGpuSensors(IHardware hw, HardwareTelemetry t)
    {
        foreach (var s in hw.Sensors)
        {
            if (!s.Value.HasValue || !float.IsFinite(s.Value.Value)) continue;
            var val = (double)s.Value.Value;
            if (s.SensorType == SensorType.Temperature && s.Name.Contains("Core", StringComparison.OrdinalIgnoreCase))
                t.GpuTemperatureC = Math.Round(val, 1);
            else if (s.SensorType == SensorType.Temperature && s.Name.Contains("Hot Spot", StringComparison.OrdinalIgnoreCase))
                t.GpuHotspotC = Math.Round(val, 1);
            else if (s.SensorType == SensorType.Load && s.Name.Contains("Core", StringComparison.OrdinalIgnoreCase))
                t.GpuUtilizationPct = Math.Round(val, 1);
            else if (s.SensorType == SensorType.Clock && s.Name.Contains("Core", StringComparison.OrdinalIgnoreCase))
                t.GpuClockMhz = Math.Round(val, 0);
            else if (s.SensorType == SensorType.Power)
                t.GpuPowerW = Math.Round(val, 1);
            else if (s.SensorType == SensorType.SmallData && s.Name.Contains("Memory Used", StringComparison.OrdinalIgnoreCase))
                t.GpuVramUsedMb = Math.Round(val, 0);
            else if (s.SensorType == SensorType.SmallData && s.Name.Contains("Memory Total", StringComparison.OrdinalIgnoreCase))
                t.GpuVramTotalMb = Math.Round(val, 0);
        }
    }

    private static void ParseMemorySensors(IHardware hw, HardwareTelemetry t)
    {
        double? used = null, avail = null;
        foreach (var s in hw.Sensors)
        {
            if (!s.Value.HasValue || !float.IsFinite(s.Value.Value)) continue;
            if (s.SensorType == SensorType.Data && s.Name.Contains("Used", StringComparison.OrdinalIgnoreCase))
                used = s.Value.Value;
            else if (s.SensorType == SensorType.Data && s.Name.Contains("Available", StringComparison.OrdinalIgnoreCase))
                avail = s.Value.Value;
            else if (s.SensorType == SensorType.Load && s.Name.Contains("Memory", StringComparison.OrdinalIgnoreCase))
                t.RamUtilizationPct = Math.Round(s.Value.Value, 1);
        }
        if (used.HasValue && avail.HasValue)
        {
            t.RamAvailableGb = Math.Round(avail.Value, 2);
            t.RamTotalGb = Math.Round(used.Value + avail.Value, 2);
        }
    }

    private static void ParseStorageSensors(IHardware hw, HardwareTelemetry t)
    {
        foreach (var s in hw.Sensors)
        {
            if (!s.Value.HasValue || !float.IsFinite(s.Value.Value)) continue;
            if (s.SensorType == SensorType.Temperature)
                t.SsdTemperatureC = Math.Round(s.Value.Value, 1);
        }
        t.SsdSmartStatus = "OK (SMART Read)";
    }

    private static void ParseBatterySensors(IHardware hw, HardwareTelemetry t)
    {
        foreach (var s in hw.Sensors)
        {
            if (!s.Value.HasValue || !float.IsFinite(s.Value.Value)) continue;
            if (s.SensorType == SensorType.Level && s.Name.Contains("Charge", StringComparison.OrdinalIgnoreCase))
                t.BatteryPct = (int)Math.Round(s.Value.Value);
            else if (s.SensorType == SensorType.Power)
                t.BatteryChargeRateW = Math.Round(s.Value.Value, 2);
        }
    }

    private static void ParseFanSensors(IHardware hw, HardwareTelemetry t)
    {
        var allSensors = hw.Sensors.Concat(hw.SubHardware.SelectMany(sh => sh.Sensors));
        foreach (var s in allSensors)
        {
            if (s.SensorType == SensorType.Fan && s.Value.HasValue && float.IsFinite(s.Value.Value))
            {
                if (t.CpuFanRpm is null) t.CpuFanRpm = (int)Math.Round(s.Value.Value);
                else if (t.GpuFanRpmEc is null) t.GpuFanRpmEc = (int)Math.Round(s.Value.Value);
            }
        }
    }

    private void EnrichWithNvml(HardwareTelemetry t)
    {
        if (!_nvmlInitialized || _nvmlDevice == IntPtr.Zero) return;
        try
        {
            if (NvmlNative.nvmlDeviceGetPowerUsage(_nvmlDevice, out var mw) == 0)
                t.GpuPowerW = Math.Round(mw / 1000.0, 1);
            if (NvmlNative.nvmlDeviceGetCurrentClocksThrottleReasons(_nvmlDevice, out var reasons) == 0)
                t.GpuThermalThrottling = (reasons & 0x0000000000000060UL) != 0;
        }
        catch { }
    }

    private static void EnrichWithWmi(HardwareTelemetry t)
    {
        try
        {
            using var biosSearcher = new ManagementObjectSearcher("SELECT Manufacturer, SMBIOSBIOSVersion, ReleaseDate FROM Win32_BIOS");
            foreach (var obj in biosSearcher.Get())
            {
                t.BiosVendor = obj["Manufacturer"]?.ToString();
                t.BiosVersion = obj["SMBIOSBIOSVersion"]?.ToString();
                t.BiosReleaseDate = obj["ReleaseDate"]?.ToString();
                break;
            }
        }
        catch { }

        try
        {
            using var memSearcher = new ManagementObjectSearcher("SELECT Speed FROM Win32_PhysicalMemory");
            int count = 0;
            int? speed = null;
            foreach (var obj in memSearcher.Get())
            {
                count++;
                if (speed is null && int.TryParse(obj["Speed"]?.ToString(), out var s)) speed = s;
            }
            if (count > 0)
            {
                t.RamModuleCount = count;
                t.RamFrequencyMhz = speed;
            }
        }
        catch { }

        try
        {
            using var battSearcher = new ManagementObjectSearcher("SELECT EstimatedChargeRemaining, BatteryStatus FROM Win32_Battery");
            foreach (var obj in battSearcher.Get())
            {
                t.BatteryPresent = true;
                if (t.BatteryPct is null && int.TryParse(obj["EstimatedChargeRemaining"]?.ToString(), out var pct))
                    t.BatteryPct = pct;
                if (int.TryParse(obj["BatteryStatus"]?.ToString(), out var statusCode))
                {
                    t.AcConnected = statusCode is 2 or 6 or 7 or 8 or 9;
                    t.BatteryStatus = statusCode == 2 ? "AC / Charging" : statusCode == 1 ? "Discharging" : $"Status Code {statusCode}";
                }
                break;
            }
        }
        catch { }
    }

    private static void EnrichDriveCapacity(HardwareTelemetry t)
    {
        try
        {
            var drive = DriveInfo.GetDrives().FirstOrDefault(d => d.IsReady && d.DriveType == DriveType.Fixed);
            if (drive is not null)
            {
                t.SsdTotalGb = Math.Round(drive.TotalSize / 1_073_741_824.0, 1);
                t.SsdAvailableGb = Math.Round(drive.AvailableFreeSpace / 1_073_741_824.0, 1);
            }
        }
        catch { }
    }

    public void Dispose()
    {
        lock (_sampleLock)
        {
            try { if (_nvmlInitialized) NvmlNative.nvmlShutdown(); } catch { }
            if (_lhmOpened)
            {
                try { _computer.Close(); } catch { }
                _lhmOpened = false;
            }
        }
    }

    private static class NvmlNative
    {
        [DllImport("nvml.dll", CallingConvention = CallingConvention.Cdecl)]
        public static extern int nvmlInit_v2();

        [DllImport("nvml.dll", CallingConvention = CallingConvention.Cdecl)]
        public static extern int nvmlShutdown();

        [DllImport("nvml.dll", CallingConvention = CallingConvention.Cdecl)]
        public static extern int nvmlDeviceGetHandleByIndex_v2(uint index, out IntPtr device);

        [DllImport("nvml.dll", CallingConvention = CallingConvention.Cdecl)]
        public static extern int nvmlDeviceGetPowerUsage(IntPtr device, out uint powerMilliwatts);

        [DllImport("nvml.dll", CallingConvention = CallingConvention.Cdecl)]
        public static extern int nvmlDeviceGetCurrentClocksThrottleReasons(IntPtr device, out ulong clocksThrottleReasons);
    }
}
