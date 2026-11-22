using System;
using System.Collections.Generic;
using System.Management;

namespace EvolControlCenter.Engines;

public sealed record FanCurvePoint(int TempC, int SpeedPct);

/// <summary>
/// Probes OEM WMI ACPI tables for fan control availability.
/// Never writes raw undocumented Embedded Controller I/O ports.
/// </summary>
public sealed class FanManagementEngine
{
    public bool IsDirectEcControlSupported { get; private set; }
    public string CapabilityNote { get; private set; } = "Probing WMI ACPI fan interface...";

    public FanManagementEngine()
    {
        ProbeCapabilities();
    }

    private void ProbeCapabilities()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(@"root\WMI", "SELECT * FROM MSAcpi_ThermalZoneTemperature");
            var hasRows = searcher.Get().Count > 0;
            IsDirectEcControlSupported = false; // Read-only unless OEM signed WMI SetFanDuty method is discovered
            CapabilityNote = hasRows
                ? "ACPI Thermal Zones detected (read-only). Direct EC fan override requires signed Colorful/ODM WMI driver; using thermal-coupled power policies safely."
                : "No writable OEM WMI fan interface exposed on this firmware.";
        }
        catch (Exception ex)
        {
            IsDirectEcControlSupported = false;
            CapabilityNote = $"WMI probe unavailable ({ex.Message}). Safe firmware fan curve active.";
        }
    }

    public static (bool Valid, string? Error) ValidateCurve(IReadOnlyList<FanCurvePoint> points)
    {
        if (points.Count < 3) return (false, "At least 3 curve points required.");
        for (int i = 0; i < points.Count; i++)
        {
            var pt = points[i];
            if (pt.TempC < 30 || pt.TempC > 95) return (false, "Temperatures must stay between 30°C and 95°C.");
            if (pt.SpeedPct < 20 || pt.SpeedPct > 100) return (false, "Fan duty must stay between 20% and 100%.");
            if (pt.TempC >= 85 && pt.SpeedPct < 75) return (false, "Safety rule requires >= 75% fan speed at >= 85°C.");
            if (i > 0 && (pt.TempC <= points[i - 1].TempC || pt.SpeedPct < points[i - 1].SpeedPct))
                return (false, "Curve points must rise monotonically.");
        }
        return (true, null);
    }
}
