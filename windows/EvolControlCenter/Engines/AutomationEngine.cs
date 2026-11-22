using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;

namespace EvolControlCenter.Engines;

/// <summary>
/// Centralized workflowless automation engine that coordinates mode switching,
/// safe rollback on failure, and automatic game detection.
/// </summary>
public sealed class AutomationEngine
{
    private readonly PowerProfileEngine _powerEngine;
    private readonly CpuGpuControlEngine _cpuGpuEngine;
    private readonly DisplayManagementEngine _displayEngine;

    public string ActiveMode { get; private set; } = "work";
    private string _previousMode = "work";

    public AutomationEngine(
        PowerProfileEngine powerEngine,
        CpuGpuControlEngine cpuGpuEngine,
        DisplayManagementEngine displayEngine)
    {
        _powerEngine = powerEngine;
        _cpuGpuEngine = cpuGpuEngine;
        _displayEngine = displayEngine;
    }

    public (bool Success, string Summary) SwitchMode(string targetMode)
    {
        _previousMode = ActiveMode;
        var (planName, boost, targetHz) = targetMode switch
        {
            "gaming" => ("High Performance", "Aggressive", 144),
            "battery" => ("Power Saver", "Disabled", 60),
            _ => ("Balanced", "Efficient Enabled", 144),
        };

        var pwr = _powerEngine.ActivateWindowsPowerPlan(planName);
        if (!pwr.Success)
        {
            return (false, $"Aborted mode switch: {pwr.Message}");
        }

        var cpu = _cpuGpuEngine.ApplyProcessorBoostPolicy(boost);
        if (!cpu.Success)
        {
            // Safe rollback to previous power plan
            _powerEngine.ActivateWindowsPowerPlan(_previousMode == "gaming" ? "High Performance" : _previousMode == "battery" ? "Power Saver" : "Balanced");
            return (false, $"Reverted to {_previousMode} after CPU policy failure: {cpu.Message}");
        }

        var supportedRates = _displayEngine.GetSupportedRefreshRates();
        if (supportedRates.Contains(targetHz))
        {
            _displayEngine.SetRefreshRate(targetHz);
        }

        ActiveMode = targetMode;
        return (true, $"Switched to {targetMode} mode ({planName}, Boost: {boost}).");
    }

    public string? DetectRunningGame(IEnumerable<string> knownGameExecutables)
    {
        var running = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var proc in Process.GetProcesses())
        {
            using (proc)
            {
                try
                {
                    running.Add($"{proc.ProcessName}.exe");
                }
                catch
                {
                    // Process exited mid-enumeration
                }
            }
        }
        return knownGameExecutables.FirstOrDefault(running.Contains);
    }
}
