using System;
using System.Globalization;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using EvolControlCenter.Models;

namespace EvolControlCenter.Engines;

public sealed class DataLoggingEngine : IDisposable
{
    private CancellationTokenSource? _cts;
    private readonly string _logDir;

    public DataLoggingEngine(string? logDirectory = null)
    {
        _logDir = logDirectory ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
            "EvolControlCenter",
            "Logs");
        Directory.CreateDirectory(_logDir);
    }

    public void Start(Func<HardwareTelemetry> sampleProvider, Func<string> modeProvider, int intervalSeconds = 5)
    {
        Stop();
        _cts = new CancellationTokenSource();
        var token = _cts.Token;
        _ = Task.Run(async () =>
        {
            try
            {
                using var timer = new PeriodicTimer(TimeSpan.FromSeconds(Math.Max(1, intervalSeconds)));
                while (await timer.WaitForNextTickAsync(token))
                {
                    try
                    {
                        WriteSample(sampleProvider(), modeProvider());
                    }
                    catch
                    {
                        // Ignore transient CSV file locks (e.g. file opened in Excel)
                    }
                }
            }
            catch (OperationCanceledException)
            {
                // Expected on Stop() / Dispose()
            }
        }, token);
    }

    public void Stop()
    {
        _cts?.Cancel();
        _cts?.Dispose();
        _cts = null;
    }

    private void WriteSample(HardwareTelemetry t, string activeMode)
    {
        var path = Path.Combine(_logDir, $"evol_session_{DateTime.UtcNow:yyyy-MM-dd}.csv");
        bool writeHeader = !File.Exists(path);
        using var writer = new StreamWriter(path, append: true);
        if (writeHeader)
        {
            writer.WriteLine("timestamp,cpu_temp_c,cpu_utilization_pct,cpu_clock_mhz,cpu_power_w,gpu_temp_c,gpu_utilization_pct,gpu_clock_mhz,gpu_power_w,ram_utilization_pct,vram_utilization_pct,fan_rpm,ssd_temp_c,battery_pct,battery_power_w,active_mode,thermal_throttling");
        }

        string Fmt(double? v) => v.HasValue ? v.Value.ToString("0.0", CultureInfo.InvariantCulture) : "N/A";
        var vramPct = (t.GpuVramUsedMb.HasValue && t.GpuVramTotalMb is > 0) ? (t.GpuVramUsedMb / t.GpuVramTotalMb) * 100.0 : null;
        var fan = t.CpuFanRpm ?? t.GpuFanRpm ?? t.GpuFanRpmEc;
        var throttle = t.CpuThermalThrottling == true || t.GpuThermalThrottling == true ? "YES" : "NO";

        writer.WriteLine(string.Join(",",
            t.TimestampUtc.ToString("O"),
            Fmt(t.CpuTemperatureC),
            t.CpuUtilizationPct.ToString("0.0", CultureInfo.InvariantCulture),
            Fmt(t.CpuClockMhz),
            Fmt(t.CpuPackagePowerW),
            Fmt(t.GpuTemperatureC),
            Fmt(t.GpuUtilizationPct),
            Fmt(t.GpuClockMhz),
            Fmt(t.GpuPowerW),
            t.RamUtilizationPct.ToString("0.0", CultureInfo.InvariantCulture),
            Fmt(vramPct),
            fan?.ToString(CultureInfo.InvariantCulture) ?? "N/A",
            Fmt(t.SsdTemperatureC),
            t.BatteryPct?.ToString(CultureInfo.InvariantCulture) ?? "N/A",
            Fmt(t.BatteryChargeRateW),
            activeMode,
            throttle));
    }

    public void Dispose() => Stop();
}
