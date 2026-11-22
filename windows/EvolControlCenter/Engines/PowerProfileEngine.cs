using System;
using System.Diagnostics;

namespace EvolControlCenter.Engines;

public sealed class PowerProfileEngine
{
    public const string HighPerformanceGuid = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";
    public const string BalancedGuid = "381b4222-f694-41f0-9685-ff5bb260df2e";
    public const string PowerSaverGuid = "a1841308-3541-4fab-bc81-f71556f20b4a";

    public (bool Success, string Message) ActivateWindowsPowerPlan(string planName)
    {
        var guid = planName switch
        {
            "High Performance" => HighPerformanceGuid,
            "Power Saver" => PowerSaverGuid,
            _ => BalancedGuid,
        };

        try
        {
            using var proc = Process.Start(new ProcessStartInfo
            {
                FileName = "powercfg.exe",
                Arguments = $"/setactive {guid}",
                CreateNoWindow = true,
                UseShellExecute = false,
            });
            proc?.WaitForExit(3000);
            if (proc is not null && proc.ExitCode == 0)
                return (true, $"Activated Windows {planName} power scheme.");
            return (false, $"powercfg /setactive failed with exit code {proc?.ExitCode}.");
        }
        catch (Exception ex)
        {
            return (false, $"Failed to switch Windows power scheme: {ex.Message}");
        }
    }
}
