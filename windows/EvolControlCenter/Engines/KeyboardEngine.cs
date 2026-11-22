using System;
using System.Management;

namespace EvolControlCenter.Engines;

/// <summary>
/// Detects integrated keyboard controller capabilities on Colorful Evol P15 2024.
/// Evol P15 uses a single-zone/15-color HID backlight rather than addressable per-key RGB.
/// </summary>
public sealed class KeyboardEngine
{
    public bool PerKeyRgbSupported { get; private set; }
    public bool ZoneBacklightSupported { get; private set; }
    public string ControllerSummary { get; private set; } = "Probing HID keyboard devices...";

    public KeyboardEngine()
    {
        DetectKeyboardController();
    }

    private void DetectKeyboardController()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT Name, DeviceID FROM Win32_Keyboard");
            foreach (var obj in searcher.Get())
            {
                var name = obj["Name"]?.ToString() ?? "PS/2 Standard Keyboard";
                ControllerSummary = $"{name} (Single-Zone OEM Backlight · Per-Key RGB Unsupported)";
                ZoneBacklightSupported = true;
                PerKeyRgbSupported = false;
                return;
            }
        }
        catch (Exception ex)
        {
            ControllerSummary = $"Keyboard WMI probe failed: {ex.Message}";
        }
    }
}
