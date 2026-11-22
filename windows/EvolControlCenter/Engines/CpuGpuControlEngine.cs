using System;
using System.Diagnostics;

namespace EvolControlCenter.Engines;

/// <summary>
/// Controls supported Windows CPU processor policies and safe GPU performance limits.
/// Never attempts undocumented MSR undervolting on locked 12th/13th Gen non-HX mobile SKUs.
/// </summary>
public sealed class CpuGpuControlEngine
{
    public const int SafeMinPl1Watts = 15;
    public const int SafeMaxPl1Watts = 55;
    public const int SafeMinPl2Watts = 25;
    public const int SafeMaxPl2Watts = 115;

    public (bool Success, string Message) ApplyProcessorBoostPolicy(string boostMode)
    {
        // Windows powercfg PERFBOOSTMODE setting:
        // 0 = Disabled, 1 = Enabled, 2 = Aggressive, 4 = Efficient Enabled
        var modeIndex = boostMode switch
        {
            "Disabled" => "0",
            "Aggressive" => "2",
            _ => "4",
        };

        try
        {
            RunPowerCfg($"/setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFBOOSTMODE {modeIndex}");
            RunPowerCfg($"/setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFBOOSTMODE {modeIndex}");
            RunPowerCfg("/setactive SCHEME_CURRENT");
            return (true, $"Applied CPU Boost Policy ({boostMode}) via Windows PowrProf.");
        }
        catch (Exception ex)
        {
            return (false, $"Failed to apply processor boost policy: {ex.Message}");
        }
    }

    private static void RunPowerCfg(string args)
    {
        using var proc = Process.Start(new ProcessStartInfo
        {
            FileName = "powercfg.exe",
            Arguments = args,
            CreateNoWindow = true,
            UseShellExecute = false,
            RedirectStandardError = true,
            RedirectStandardOutput = true,
        });
        proc?.WaitForExit(3000);
        if (proc is not null && proc.ExitCode != 0)
        {
            throw new InvalidOperationException($"powercfg exited with code {proc.ExitCode}");
        }
    }
}
